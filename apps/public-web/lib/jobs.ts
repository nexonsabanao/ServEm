import { randomUUID } from 'node:crypto';
import { getCategoryById } from './categories';
import { EDITABLE_JOB_STATUSES, isJobBooked } from './policy';
import { SERVICE_AREAS } from './presentation';
import { query, transact, type JobPostRecord } from './store';

/**
 * The customer's job posts.
 *
 * A job is the private request a customer publishes so eligible ServMates can
 * offer on it (blueprint §4.4). It is deliberately *not* a listing: it never
 * appears in the public catalog, and the only route to it is discovery by a
 * ServMate whose structured category, coverage area and schedule rules match —
 * all decided in `./policy`, never here.
 *
 * Two rules this module owns:
 *
 * 1. **A job's budget is not a price.** `budgetCentavos` is what the customer is
 *    willing to spend; the offer carries the proposed amount and the booking
 *    snapshots the agreed one (§5.3, §9).
 * 2. **Closing a job invalidates the offers on it**, in the same transaction, so
 *    no ServMate is left holding a live offer on dead work (§11).
 */

/** How long a published job stays open before it expires. */
const OPEN_WINDOW_DAYS = 14;

const TITLE_MAX = 160;
const DESCRIPTION_MAX = 4000;
const NOTES_MAX = 500;

export type JobPost = JobPostRecord;

/** The facts of a job post. The author is the session, never this object. */
export type JobFacts = {
  categoryId: string;
  subcategoryId?: string;
  title: string;
  description: string;
  pricingModel: JobPostRecord['pricingModel'];
  budgetCentavos: number;
  budgetMaxCentavos?: number;
  locationCity: string;
  locationBarangay?: string;
  locationNotes?: string;
  preferredStart?: string;
  preferredEnd?: string;
  scheduleFlexible: boolean;
};

export type JobValidation =
  | { ok: true; facts: JobFacts }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates the facts of a job post or edit.
 *
 * Called by create, update and publish, so none of them can store or publish a
 * job with a retired category, a fractional budget, a start after its own end or
 * a city outside the coverage list the matching rules compare against.
 *
 * `base` supplies the fields a partial edit leaves out, which is also how a
 * stored draft is re-checked before it is published.
 */
export function readJobFacts(body: Record<string, unknown>, base?: JobPostRecord): JobValidation {
  const errors: Record<string, string> = {};

  const title = typeof body.title === 'string' ? body.title.trim() : (base?.title ?? '');
  if (!title) errors.title = 'Describe the job in a title.';
  else if (Array.from(title).length > TITLE_MAX) {
    errors.title = `Keep the title under ${TITLE_MAX} characters.`;
  }

  const description =
    typeof body.description === 'string' ? body.description.trim() : (base?.description ?? '');
  if (!description) errors.description = 'Describe what needs doing.';
  else if (Array.from(description).length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
  }

  const categoryId = typeof body.categoryId === 'string' ? body.categoryId : (base?.categoryId ?? '');
  if (!getCategoryById(categoryId)) errors.categoryId = 'Pick a category from the list.';

  const rawModel = typeof body.pricingModel === 'string' ? body.pricingModel : base?.pricingModel;
  const pricingModel = rawModel === 'fixed' || rawModel === 'negotiable' ? rawModel : undefined;
  if (!pricingModel) errors.pricingModel = 'Choose a fixed or negotiable budget.';

  const rawBudget = body.budgetCentavos ?? base?.budgetCentavos;
  const budgetCentavos =
    typeof rawBudget === 'number' && Number.isSafeInteger(rawBudget) && rawBudget >= 0
      ? rawBudget
      : undefined;
  if (budgetCentavos === undefined) errors.budgetCentavos = 'Enter a budget in whole centavos.';

  const rawMax = body.budgetMaxCentavos ?? base?.budgetMaxCentavos;
  let budgetMaxCentavos: number | undefined;
  if (rawMax !== undefined && rawMax !== null) {
    if (typeof rawMax === 'number' && Number.isSafeInteger(rawMax) && rawMax >= 0) {
      if (budgetCentavos !== undefined && rawMax < budgetCentavos) {
        errors.budgetMaxCentavos = 'The maximum cannot be below the budget.';
      } else {
        budgetMaxCentavos = rawMax;
      }
    } else {
      errors.budgetMaxCentavos = 'Enter the maximum in whole centavos.';
    }
  }

  const locationCity =
    typeof body.locationCity === 'string' ? body.locationCity.trim() : (base?.locationCity ?? '');
  if (!locationCity) errors.locationCity = 'Pick the city or municipality.';
  else if (!SERVICE_AREAS.includes(locationCity)) {
    // A ServMate's coverage is compared against this list, so a city outside it
    // could never be matched by anyone.
    errors.locationCity = 'Pick a city from the coverage list.';
  }

  const locationBarangay = readOptionalString(body.locationBarangay, base?.locationBarangay);
  const locationNotes = readOptionalString(body.locationNotes, base?.locationNotes);
  if (locationNotes && Array.from(locationNotes).length > NOTES_MAX) {
    errors.locationNotes = `Keep the access notes under ${NOTES_MAX} characters.`;
  }

  const preferredStart = readOptionalString(body.preferredStart, base?.preferredStart);
  const preferredEnd = readOptionalString(body.preferredEnd, base?.preferredEnd);
  const startMs = preferredStart ? Date.parse(preferredStart) : undefined;
  const endMs = preferredEnd ? Date.parse(preferredEnd) : undefined;
  if (preferredStart && (startMs === undefined || Number.isNaN(startMs))) {
    errors.preferredStart = 'Enter a valid date and time.';
  }
  if (preferredEnd && (endMs === undefined || Number.isNaN(endMs))) {
    errors.preferredEnd = 'Enter a valid date and time.';
  }
  if (
    startMs !== undefined &&
    endMs !== undefined &&
    !Number.isNaN(startMs) &&
    !Number.isNaN(endMs) &&
    endMs < startMs
  ) {
    errors.preferredEnd = 'The end cannot come before the start.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    facts: {
      categoryId,
      ...(typeof body.subcategoryId === 'string' && body.subcategoryId
        ? { subcategoryId: body.subcategoryId }
        : base?.subcategoryId
          ? { subcategoryId: base.subcategoryId }
          : {}),
      title,
      description,
      pricingModel: pricingModel as JobPostRecord['pricingModel'],
      budgetCentavos: budgetCentavos as number,
      ...(budgetMaxCentavos === undefined ? {} : { budgetMaxCentavos }),
      locationCity,
      ...(locationBarangay ? { locationBarangay } : {}),
      ...(locationNotes ? { locationNotes } : {}),
      ...(preferredStart ? { preferredStart } : {}),
      ...(preferredEnd ? { preferredEnd } : {}),
      scheduleFlexible: (body.scheduleFlexible ?? base?.scheduleFlexible) === true,
    },
  };
}

function readOptionalString(value: unknown, fallback?: string): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return fallback;
}

export type CreateJobResult =
  | { ok: true; job: JobPost }
  | { ok: false; errors: Record<string, string> };

/**
 * Creates a job in `draft`.
 *
 * A draft is not discoverable, which is what lets the posting flow collect the
 * description, media, budget, location and schedule before anything is published
 * (blueprint §4.4 step F).
 */
export async function createJobPost(
  customerId: string,
  body: Record<string, unknown>,
): Promise<CreateJobResult> {
  const validation = readJobFacts(body);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const now = new Date().toISOString();
  const record: JobPostRecord = {
    id: randomUUID(),
    customerId,
    jobStatus: 'draft',
    currency: 'PHP',
    createdAt: now,
    updatedAt: now,
    ...validation.facts,
  };

  return transact((database) => {
    database.jobPosts.push(record);
    return { ok: true as const, job: record };
  });
}

export type UpdateJobResult =
  | { ok: true; job: JobPost }
  | { ok: false; error: 'not_found' | 'not_editable' | 'already_booked' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

/**
 * Edits one of the account's own job posts.
 *
 * A job stays editable while it is live — including once offers have arrived,
 * because a customer editing their own description or budget is normal. It stops
 * being editable when the work is committed: a booking means the agreed terms are
 * frozen, so the edit is refused rather than quietly changing work somebody has
 * already taken on.
 */
export async function updateJobPost(
  customerId: string,
  jobId: string,
  body: Record<string, unknown>,
): Promise<UpdateJobResult> {
  return transact((database) => {
    const job = database.jobPosts.find(
      (candidate) => candidate.id === jobId && candidate.customerId === customerId,
    );
    if (!job) return { ok: false as const, error: 'not_found' as const };
    if (!EDITABLE_JOB_STATUSES.includes(job.jobStatus)) {
      return {
        ok: false as const,
        error: isJobBooked(job.jobStatus) ? ('already_booked' as const) : ('not_editable' as const),
      };
    }

    const validation = readJobFacts(body, job);
    if (!validation.ok) return { ok: false as const, error: 'invalid' as const, errors: validation.errors };

    const categoryChanged = validation.facts.categoryId !== job.categoryId;
    Object.assign(job, validation.facts);
    job.updatedAt = new Date().toISOString();

    /**
     * A category change re-decides who may see the job (§6.3), so offers that
     * were eligible under the old category can no longer be trusted. They are
     * marked rather than deleted, so a provider sees why their offer stopped
     * being live instead of finding it gone.
     */
    if (categoryChanged) {
      for (const offer of database.jobOffers) {
        if (offer.jobPostId === job.id && offer.offerStatus === 'pending') {
          offer.offerStatus = 'category_changed';
          offer.updatedAt = job.updatedAt;
        }
      }
      if (job.jobStatus === 'offer_received') job.jobStatus = 'open';
    }

    return { ok: true as const, job };
  });
}

export type PublishJobResult =
  | { ok: true; job: JobPost }
  | { ok: false; error: 'not_found' | 'already_published' | 'already_booked' | 'not_publishable' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

/**
 * Publishes a draft so eligible ServMates can discover it.
 *
 * The stored draft is re-validated before publication: a draft written before a
 * category was retired must not become discoverable by a rule that no longer
 * exists. Publication makes the job eligible for *private* discovery only — it
 * still never appears in the public catalog (§4.4).
 */
export async function publishJobPost(
  customerId: string,
  jobId: string,
): Promise<PublishJobResult> {
  return transact((database) => {
    const job = database.jobPosts.find(
      (candidate) => candidate.id === jobId && candidate.customerId === customerId,
    );
    if (!job) return { ok: false as const, error: 'not_found' as const };
    if (job.jobStatus === 'draft') {
      // Publishable; validated below.
    } else if (job.jobStatus === 'open' || job.jobStatus === 'offer_received') {
      return { ok: false as const, error: 'already_published' as const };
    } else if (isJobBooked(job.jobStatus)) {
      return { ok: false as const, error: 'already_booked' as const };
    } else {
      // Cancelled or expired: reviving a closed job is not offered yet, so it is
      // reported plainly rather than silently reopened.
      return { ok: false as const, error: 'not_publishable' as const };
    }

    const validation = readJobFacts({}, job);
    if (!validation.ok) return { ok: false as const, error: 'invalid' as const, errors: validation.errors };

    const now = new Date();
    job.jobStatus = 'open';
    job.publishedAt = now.toISOString();
    job.updatedAt = job.publishedAt;
    job.expiresAt = new Date(now.getTime() + OPEN_WINDOW_DAYS * 86_400_000).toISOString();
    return { ok: true as const, job };
  });
}

export type CloseJobResult =
  | { ok: true; job: JobPost }
  | { ok: false; error: 'not_found' | 'already_closed' };

/**
 * Cancels one of the account's own jobs and withdraws the live offers on it.
 *
 * Both changes happen in one transaction: a cancelled job must never leave a
 * provider holding a pending offer on work that no longer exists (§11).
 */
export async function cancelJobPost(customerId: string, jobId: string): Promise<CloseJobResult> {
  return transact((database) => {
    const job = database.jobPosts.find(
      (candidate) => candidate.id === jobId && candidate.customerId === customerId,
    );
    if (!job) return { ok: false as const, error: 'not_found' as const };
    if (!EDITABLE_JOB_STATUSES.includes(job.jobStatus)) {
      // Booked work is cancelled through the booking, not the job post.
      return { ok: false as const, error: 'already_closed' as const };
    }

    const now = new Date().toISOString();
    job.jobStatus = 'cancelled';
    job.closedAt = now;
    job.updatedAt = now;

    for (const offer of database.jobOffers) {
      if (offer.jobPostId === job.id && offer.offerStatus === 'pending') {
        offer.offerStatus = 'withdrawn';
        offer.updatedAt = now;
      }
    }

    return { ok: true as const, job };
  });
}

/** The account's own jobs, newest first. */
export async function listCustomerJobs(customerId: string): Promise<JobPost[]> {
  return query((database) =>
    database.jobPosts
      .filter((job) => job.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

/** One of the account's own jobs, or null. */
export async function getCustomerJob(jobId: string, customerId: string): Promise<JobPost | null> {
  return query(
    (database) =>
      database.jobPosts.find((job) => job.id === jobId && job.customerId === customerId) ?? null,
  );
}
