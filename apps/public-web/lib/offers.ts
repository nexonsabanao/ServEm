import { randomUUID } from 'node:crypto';
import { buildBookingReference } from './bookings';
import { canServMateDiscoverJob } from './policy';
import { providerViews, type ProviderView } from './servmate-profile';
import { query, transact, type Database, type JobOfferRecord } from './store';

/**
 * Job offers (blueprint §4.5, §5.6, §9).
 *
 * An offer is one ServMate's proposed price, schedule and scope for a job. Three
 * rules shape this module:
 *
 * 1. **Eligibility is re-checked on every write.** Submitting re-runs the
 *    discovery decision, so an offer cannot be created for a job the provider
 *    may not see, and accepting re-runs it too — a job whose category changed
 *    after the offer arrived cannot be booked by a provider who is no longer
 *    eligible (§6.3).
 * 2. **Several offers coexist.** A job that has received an offer stays
 *    discoverable, so a customer can collect and compare several (§4.5). The job's
 *    status changes to `offer_received`, which is still a discoverable status.
 * 3. **Acceptance is one transaction.** The winning offer, the losing offers, the
 *    job's status, the booking and its agreed-terms snapshot all change together
 *    (§4.7), so there is no instant in which two providers hold accepted offers
 *    on the same job.
 */

export type JobOffer = JobOfferRecord;

/** The provider's standing, attached to an offer so a customer can compare. */
export type OfferComparison = {
  offer: JobOffer;
  provider: ProviderView;
};

const SCOPE_MAX = 1000;
const MESSAGE_MAX = 2000;

export type SubmitOfferInput = {
  jobPostId: string;
  amountCentavos: number;
  proposedStart?: string;
  scopeDescription?: string;
  exclusions?: string;
  message?: string;
  expiresAt?: string;
};

export type SubmitOfferResult =
  | { ok: true; offer: JobOffer }
  | {
      ok: false;
      error:
        | 'job_not_found'
        | 'not_eligible'
        | 'job_closed'
        | 'self_offer'
        | 'already_offered';
      detail?: string;
    }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

/**
 * Submits an offer on a job.
 *
 * The provider is identified by the session-derived `servmateProfileId` and
 * `userId`; the caller never supplies either. The amount is an integer number of
 * centavos, because money is never a float (§5.3).
 */
export async function submitOffer(input: {
  jobPostId: string;
  userId: string;
  servmateProfileId: string;
  body: Record<string, unknown>;
}): Promise<SubmitOfferResult> {
  const amount = input.body.amountCentavos;
  const errors: Record<string, string> = {};
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0) {
    errors.amountCentavos = 'Enter your price in whole centavos.';
  }
  const scope = readText(input.body.scopeDescription, SCOPE_MAX);
  if (scope === null) errors.scopeDescription = `Keep the scope under ${SCOPE_MAX} characters.`;
  const message = readText(input.body.message, MESSAGE_MAX);
  if (message === null) errors.message = `Keep your note under ${MESSAGE_MAX} characters.`;
  const exclusions = readText(input.body.exclusions, SCOPE_MAX);
  if (exclusions === null) errors.exclusions = `Keep exclusions under ${SCOPE_MAX} characters.`;

  const proposedStart = readIso(input.body.proposedStart, errors, 'proposedStart');
  const expiresAt = readIso(input.body.expiresAt, errors, 'expiresAt');

  if (Object.keys(errors).length > 0) return { ok: false, error: 'invalid', errors };
  const amountCentavos = amount as number;

  return transact((database) => {
    const job = database.jobPosts.find((candidate) => candidate.id === input.jobPostId);
    if (!job) return { ok: false as const, error: 'job_not_found' as const };

    /**
     * The discovery decision is the single authority on who may offer: it
     * applies category eligibility, the provider's active status, the block
     * rules, the coverage area and the publication/schedule rules in one place.
     * Its refusals are reported to the provider, who is entitled to know why
     * their own offer was rejected.
     */
    const decision = canServMateDiscoverJob(database, {
      jobId: input.jobPostId,
      userId: input.userId,
    });
    if (!decision.allowed) {
      if (decision.reason === 'self') return { ok: false as const, error: 'self_offer' as const };
      if (decision.reason === 'job_closed') return { ok: false as const, error: 'job_closed' as const };
      return {
        ok: false as const,
        error: 'not_eligible' as const,
        detail: decision.reason,
      };
    }

    const alreadyOffered = database.jobOffers.some(
      (offer) =>
        offer.jobPostId === input.jobPostId &&
        offer.servmateProfileId === input.servmateProfileId &&
        (offer.offerStatus === 'pending' || offer.offerStatus === 'accepted'),
    );
    if (alreadyOffered) return { ok: false as const, error: 'already_offered' as const };

    const now = new Date().toISOString();
    const previous = database.jobOffers.filter(
      (offer) =>
        offer.jobPostId === input.jobPostId &&
        offer.servmateProfileId === input.servmateProfileId,
    );
    const record: JobOfferRecord = {
      id: randomUUID(),
      jobPostId: input.jobPostId,
      servmateProfileId: input.servmateProfileId,
      amountCentavos,
      currency: 'PHP',
      offerStatus: 'pending',
      /** A counteroffer is a new revision of the same provider's position. */
      revision: previous.reduce((highest, offer) => Math.max(highest, offer.revision), 0) + 1,
      ...(proposedStart ? { proposedStart } : {}),
      ...(scope ? { scopeDescription: scope } : {}),
      ...(exclusions ? { exclusions } : {}),
      ...(message ? { message } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      createdAt: now,
      updatedAt: now,
    };
    database.jobOffers.push(record);

    if (job.jobStatus === 'open') {
      job.jobStatus = 'offer_received';
      job.updatedAt = now;
    }

    database.notifications.push({
      id: randomUUID(),
      recipientUserId: job.customerId,
      notificationType: 'offer_received',
      entityType: 'offer',
      entityId: record.id,
      createdAt: now,
    });

    return { ok: true as const, offer: record };
  });
}

function readText(value: unknown, max: number): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (Array.from(trimmed).length > max) return null;
  return trimmed === '' ? undefined : trimmed;
}

function readIso(
  value: unknown,
  errors: Record<string, string>,
  field: string,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    errors[field] = 'Enter a valid date and time.';
    return undefined;
  }
  return value;
}

export type WithdrawOfferResult =
  | { ok: true; offer: JobOffer }
  | { ok: false; error: 'not_found' | 'not_pending' };

/** Withdraws the provider's own pending offer. */
export async function withdrawOffer(
  offerId: string,
  servmateProfileId: string,
): Promise<WithdrawOfferResult> {
  return transact((database) => {
    const offer = database.jobOffers.find(
      (candidate) => candidate.id === offerId && candidate.servmateProfileId === servmateProfileId,
    );
    if (!offer) return { ok: false as const, error: 'not_found' as const };
    if (offer.offerStatus !== 'pending') return { ok: false as const, error: 'not_pending' as const };

    offer.offerStatus = 'withdrawn';
    offer.updatedAt = new Date().toISOString();

    const job = database.jobPosts.find((candidate) => candidate.id === offer.jobPostId);
    if (job && job.jobStatus === 'offer_received') {
      const stillPending = database.jobOffers.some(
        (candidate) =>
          candidate.jobPostId === job.id &&
          candidate.id !== offer.id &&
          candidate.offerStatus === 'pending',
      );
      if (!stillPending) {
        job.jobStatus = 'open';
        job.updatedAt = offer.updatedAt;
      }
    }

    return { ok: true as const, offer };
  });
}

/** The provider's own offers, newest first. */
export async function listOwnOffers(servmateProfileId: string): Promise<JobOffer[]> {
  return query((database) =>
    database.jobOffers
      .filter((offer) => offer.servmateProfileId === servmateProfileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

/** How many offers a customer's job is carrying, and how many are still live. */
export type OfferCounts = { total: number; pending: number };

/**
 * Offer counts for every one of the account's own job posts, in one pass.
 *
 * The customer's job list needs "3 offers" beside each row; reading each job
 * separately would re-scan the offer table once per row.
 */
export async function offerCountsForJobs(customerId: string): Promise<Map<string, OfferCounts>> {
  return query((database) => {
    const counts = new Map<string, OfferCounts>();
    const mine = new Set(
      database.jobPosts
        .filter((job) => job.customerId === customerId)
        .map((job) => job.id),
    );
    for (const offer of database.jobOffers) {
      if (!mine.has(offer.jobPostId)) continue;
      const current = counts.get(offer.jobPostId) ?? { total: 0, pending: 0 };
      current.total += 1;
      if (offer.offerStatus === 'pending') current.pending += 1;
      counts.set(offer.jobPostId, current);
    }
    return counts;
  });
}

/**
 * Every offer on one of the account's own jobs, with the provider behind it.
 *
 * This is the comparison view: the offer's terms plus the ServMate's rating and
 * completed-work history, so the customer decides with the facts in front of
 * them. Only the job's owner can read it.
 */
export async function listOffersForJob(
  jobId: string,
  customerId: string,
): Promise<OfferComparison[] | null> {
  return query((database) => {
    const job = database.jobPosts.find(
      (candidate) => candidate.id === jobId && candidate.customerId === customerId,
    );
    if (!job) return null;

    const providers = new Map(providerViews(database).map((view) => [view.id, view]));
    return database.jobOffers
      .filter((offer) => offer.jobPostId === jobId)
      .sort((a, b) => a.amountCentavos - b.amountCentavos || a.createdAt.localeCompare(b.createdAt))
      .flatMap((offer) => {
        const provider = providers.get(offer.servmateProfileId);
        return provider ? [{ offer, provider }] : [];
      });
  });
}

/** One offer the provider owns, with the job it belongs to. */
export async function getOwnOffer(
  offerId: string,
  servmateProfileId: string,
): Promise<{ offer: JobOffer; job: { id: string; title: string } } | null> {
  return query((database) => {
    const offer = database.jobOffers.find(
      (candidate) => candidate.id === offerId && candidate.servmateProfileId === servmateProfileId,
    );
    if (!offer) return null;
    const job = database.jobPosts.find((candidate) => candidate.id === offer.jobPostId);
    return job ? { offer, job: { id: job.id, title: job.title } } : null;
  });
}

export type AcceptOfferResult =
  | { ok: true; bookingId: string; reference: string }
  | {
      ok: false;
      error:
        | 'offer_not_found'
        | 'not_owner'
        | 'offer_not_pending'
        | 'job_not_open'
        | 'provider_not_eligible';
    };

/**
 * Accepts one offer, books the job and withdraws the rest — atomically.
 *
 * The booking stores an immutable snapshot of the agreed amount, scope and
 * schedule, so a later edit to the listing, the job's budget or the offer can
 * never rewrite what was agreed (§4.7, §9).
 *
 * The losing offers are marked `withdrawn`: the job closed, so they are no longer
 * live, and that is what a provider sees on their own offer — rather than being
 * told the customer rejected them by name.
 */
export async function acceptOffer(
  offerId: string,
  customerId: string,
): Promise<AcceptOfferResult> {
  return transact((database) => {
    const offer = database.jobOffers.find((candidate) => candidate.id === offerId);
    if (!offer) return { ok: false as const, error: 'offer_not_found' as const };
    if (offer.offerStatus !== 'pending') return { ok: false as const, error: 'offer_not_pending' as const };

    // An offer past its own expiry is no longer live. It is recorded as expired
    // rather than reported as "still pending but unacceptable".
    if (offer.expiresAt && Date.parse(offer.expiresAt) <= Date.now()) {
      offer.offerStatus = 'expired';
      offer.updatedAt = new Date().toISOString();
      return { ok: false as const, error: 'offer_not_pending' as const };
    }

    const job = database.jobPosts.find((candidate) => candidate.id === offer.jobPostId);
    if (!job || job.customerId !== customerId) return { ok: false as const, error: 'not_owner' as const };
    if (job.jobStatus !== 'open' && job.jobStatus !== 'offer_received') {
      return { ok: false as const, error: 'job_not_open' as const };
    }

    const provider = database.servmateProfiles.find(
      (candidate) => candidate.id === offer.servmateProfileId,
    );
    if (!provider) return { ok: false as const, error: 'provider_not_eligible' as const };

    /**
     * Re-check eligibility at the moment of booking. The category, the coverage
     * area or a block may have changed since the offer arrived, and work must not
     * be booked with a provider who could no longer see it.
     */
    const stillEligible = canServMateDiscoverJob(database, {
      jobId: job.id,
      userId: provider.userId,
    });
    if (!stillEligible.allowed) {
      return { ok: false as const, error: 'provider_not_eligible' as const };
    }

    const now = new Date().toISOString();

    offer.offerStatus = 'accepted';
    offer.updatedAt = now;

    for (const other of database.jobOffers) {
      if (other.jobPostId === offer.jobPostId && other.id !== offer.id && other.offerStatus === 'pending') {
        other.offerStatus = 'withdrawn';
        other.updatedAt = now;
      }
    }

    job.jobStatus = 'booked';
    job.updatedAt = now;

    const bookingId = randomUUID();
    const reference = buildBookingReference(bookingId);
    database.bookings.push({
      id: bookingId,
      reference,
      userId: customerId,
      jobPostId: job.id,
      acceptedOfferId: offer.id,
      servmateProfileId: provider.id,
      area: job.locationCity,
      /** The provider's note, or the customer's own description of the work. */
      message: offer.message ?? job.description.slice(0, 500),
      status: 'confirmed',
      agreedAmountCentavos: offer.amountCentavos,
      agreedCurrency: 'PHP',
      ...(offer.scopeDescription ? { agreedScope: offer.scopeDescription } : {}),
      ...(offer.proposedStart ? { agreedStart: offer.proposedStart } : {}),
      confirmedAt: now,
      createdAt: now,
    });

    database.bookingStatusHistory.push({
      id: randomUUID(),
      bookingId,
      oldStatus: '',
      newStatus: 'confirmed',
      actorUserId: customerId,
      createdAt: now,
    });

    database.notifications.push({
      id: randomUUID(),
      recipientUserId: provider.userId,
      notificationType: 'offer_accepted',
      entityType: 'booking',
      entityId: bookingId,
      createdAt: now,
    });

    return { ok: true as const, bookingId, reference };
  });
}

export type DeclineOfferResult =
  | { ok: true; offer: JobOffer }
  | { ok: false; error: 'not_found' | 'not_owner' | 'not_pending' };

/**
 * Declines one offer without booking the job.
 *
 * The job stays open with its other offers intact, so a customer comparing
 * prices can narrow the field before committing.
 */
export async function declineOffer(
  offerId: string,
  customerId: string,
): Promise<DeclineOfferResult> {
  return transact((database) => {
    const offer = database.jobOffers.find((candidate) => candidate.id === offerId);
    if (!offer) return { ok: false as const, error: 'not_found' as const };
    const job = database.jobPosts.find((candidate) => candidate.id === offer.jobPostId);
    if (!job || job.customerId !== customerId) return { ok: false as const, error: 'not_owner' as const };
    if (offer.offerStatus !== 'pending') return { ok: false as const, error: 'not_pending' as const };

    const now = new Date().toISOString();
    offer.offerStatus = 'rejected';
    offer.updatedAt = now;

    job.jobStatus = 'open';
    job.updatedAt = now;

    const providerUserId = database.servmateProfiles.find(
      (profile) => profile.id === offer.servmateProfileId,
    )?.userId;
    if (providerUserId) {
      database.notifications.push({
        id: randomUUID(),
        recipientUserId: providerUserId,
        notificationType: 'offer_declined',
        entityType: 'offer',
        entityId: offer.id,
        createdAt: now,
      });
    }

    return { ok: true as const, offer };
  });
}
