import type {
  BookingRecord,
  BookingStatus,
  Database,
  JobPostRecord,
  ServMateProfileRecord,
} from './store';

/**
 * Authorization policy.
 *
 * One module answers every "may this person see or do this?" question, and it
 * always answers it from a store snapshot plus ids — never from anything the
 * browser supplied. Routes and pages call in here; components never re-implement
 * a permission check, because scattered checks are how the same rule ends up
 * being true in one place and false in another (blueprint §3.3).
 *
 * Two habits are deliberate:
 *
 * 1. **Deny is indistinguishable from absent.** A caller that is not allowed to
 *    see a private job gets the same answer as one asking about a job that does
 *    not exist, so counts, error text and timing cannot be used to confirm that
 *    someone else's job is there (blueprint §6.4).
 * 2. **Discoverable is not the same as open.** A job that has received one offer
 *    is still `open` for discovery — `offer_received` means an offer exists, not
 *    that the job closed. A customer needs several offers to compare (§4.5), so
 *    `DISCOVERABLE_JOB_STATUSES` includes both.
 */

/** Job statuses in which eligible ServMates may still discover and offer. */
export const DISCOVERABLE_JOB_STATUSES: JobPostRecord['jobStatus'][] = [
  'open',
  'offer_received',
];

/**
 * Booking statuses in which the work is still live for the customer.
 *
 * Shared by the account area and the message thread, and deliberately declared
 * here with the other domain rules rather than in a component: whether a thread
 * accepts a new message is a rule about the booking, not about the screen.
 */
export const OPEN_BOOKING_STATUSES: BookingStatus[] = [
  'requested',
  'confirmed',
  'in_progress',
  'completion_pending',
];

/** Statuses in which the job is finished, withdrawn or otherwise closed. */
export const CLOSED_JOB_STATUSES: JobPostRecord['jobStatus'][] = [
  'booked',
  'in_progress',
  'completion_pending',
  'completed',
  'cancelled',
  'expired',
];

export type DenialReason =
  | 'not_found'
  | 'not_authenticated'
  | 'not_a_provider'
  | 'provider_inactive'
  | 'not_eligible'
  | 'self'
  | 'blocked'
  | 'outside_service_area'
  | 'schedule_conflict'
  | 'job_closed'
  | 'not_owner'
  | 'not_a_participant'
  | 'not_reviewable';

export type Decision<T> = { allowed: true; value: T } | { allowed: false; reason: DenialReason };

function allow<T>(value: T): Decision<T> {
  return { allowed: true, value };
}

function deny<T>(reason: DenialReason): Decision<T> {
  return { allowed: false, reason };
}

/* ---------------------------------------------------------------- *
 * Providers
 * ---------------------------------------------------------------- */

/** The ServMate profile an account owns, if it has provider capability. */
export function servMateProfileFor(
  database: Database,
  userId: string,
): ServMateProfileRecord | undefined {
  return database.servmateProfiles.find((profile) => profile.userId === userId);
}

/** A provider may only act while its profile is active. */
export function isProviderActive(profile: ServMateProfileRecord | undefined): boolean {
  return profile?.providerStatus === 'active';
}

/** The structured categories a ServMate is eligible to work in. */
export function eligibleCategoryIds(database: Database, servmateProfileId: string): Set<string> {
  return new Set(
    database.servmateCategories
      .filter((row) => row.servmateProfileId === servmateProfileId && row.status === 'active')
      .map((row) => row.categoryId),
  );
}

/** The areas a ServMate covers. */
export function coverageAreas(database: Database, servmateProfileId: string): Set<string> {
  return new Set(
    database.servmateServiceAreas
      .filter((row) => row.servmateProfileId === servmateProfileId)
      .map((row) => row.areaLabel),
  );
}

/**
 * Whether either party blocked the other.
 *
 * A block is symmetric for visibility: it does not matter who pressed the
 * button, the two accounts must not see each other's jobs or offers.
 */
export function isBlockedEitherWay(
  database: Database,
  firstUserId: string,
  secondUserId: string,
): boolean {
  return database.userBlocks.some(
    (block) =>
      (block.blockerUserId === firstUserId && block.blockedUserId === secondUserId) ||
      (block.blockerUserId === secondUserId && block.blockedUserId === firstUserId),
  );
}

/* ---------------------------------------------------------------- *
 * Listings (§5.4)
 * ---------------------------------------------------------------- */

/** A listing is publicly visible only once published and not withdrawn. */
export function isListingPublished(listing: { publicationStatus: string }): boolean {
  return listing.publicationStatus === 'published';
}

/** Only the owning account may edit or unpublish a listing. */
export function canEditListing(
  database: Database,
  listingId: string,
  userId: string,
): Decision<string> {
  const listing = database.serviceListings.find((row) => row.id === listingId);
  if (!listing) return deny('not_found');
  const profile = servMateProfileFor(database, userId);
  if (!profile) return deny('not_a_provider');
  if (profile.id !== listing.servmateProfileId) return deny('not_owner');
  return allow(listing.id);
}

/* ---------------------------------------------------------------- *
 * Private job discovery (§6.3, §6.4)
 * ---------------------------------------------------------------- */

/**
 * Whether a job is available for private discovery at all.
 *
 * The schedule rules enforced here are the two the data supports:
 *
 * - an expired job (`expiresAt` in the past) is no longer discoverable, and
 * - a job with a fixed start already in the past is stale, so it is not either.
 *
 * Per-ServMate availability windows are **not** modelled yet — a listing's
 * `availability` is a human-readable string, not a calendar — so no rule here
 * pretends otherwise. See `docs/PROJECT_STATUS.md`.
 */
export function isJobDiscoverable(job: JobPostRecord, now: Date): Decision<JobPostRecord> {
  if (!DISCOVERABLE_JOB_STATUSES.includes(job.jobStatus)) return deny('job_closed');
  if (!job.publishedAt) return deny('job_closed');
  if (job.expiresAt && Date.parse(job.expiresAt) <= now.getTime()) return deny('job_closed');
  if (!job.scheduleFlexible && job.preferredStart) {
    const start = Date.parse(job.preferredStart);
    if (!Number.isNaN(start) && start < now.getTime()) return deny('schedule_conflict');
  }
  return allow(job);
}

/**
 * Whether this ServMate may discover this job.
 *
 * Every clause of blueprint §6.3 in order: authenticated provider, active
 * profile, structured category eligibility, not the job's own author, no block
 * in either direction, the job's city inside the provider's coverage, and the
 * publication/schedule rules above.
 */
export function canServMateDiscoverJob(
  database: Database,
  input: { jobId: string; userId: string; now?: Date },
): Decision<JobPostRecord> {
  const now = input.now ?? new Date();
  const job = database.jobPosts.find((row) => row.id === input.jobId);
  if (!job) return deny('not_found');
  if (job.customerId === input.userId) return deny('self');

  const profile = servMateProfileFor(database, input.userId);
  if (!profile) return deny('not_a_provider');
  if (!isProviderActive(profile)) return deny('provider_inactive');
  if (isBlockedEitherWay(database, profile.userId, job.customerId)) return deny('blocked');

  const eligible = eligibleCategoryIds(database, profile.id);
  if (!eligible.has(job.categoryId)) return deny('not_eligible');

  const covered = coverageAreas(database, profile.id);
  if (!covered.has(job.locationCity)) return deny('outside_service_area');

  const discoverable = isJobDiscoverable(job, now);
  if (!discoverable.allowed) return discoverable;

  return allow(job);
}

/**
 * Whether this account may read the *full* job, including the barangay and the
 * access notes, which discovery never reveals (§7.2).
 *
 * Three callers qualify: the customer who owns it, an eligible ServMate during
 * discovery, and the ServMate whose offer was accepted — the last of whom may
 * need the address after the job has left discovery.
 */
export function canViewJobDetail(
  database: Database,
  input: { jobId: string; userId: string; now?: Date },
): Decision<JobPostRecord> {
  const job = database.jobPosts.find((row) => row.id === input.jobId);
  if (!job) return deny('not_found');

  if (job.customerId === input.userId) {
    // The owner always sees their own job, at any status.
    return allow(job);
  }

  const profile = servMateProfileFor(database, input.userId);
  if (!profile) return deny('not_a_provider');

  const assigned = database.bookings.some(
    (booking) =>
      booking.jobPostId === job.id &&
      booking.servmateProfileId === profile.id &&
      booking.status !== 'cancelled',
  );
  if (assigned) return allow(job);

  return canServMateDiscoverJob(database, input);
}

/** Whether this account may read media attached to the job (§6.4). */
export function canViewJobMedia(
  database: Database,
  input: { jobPostId: string; userId: string; now?: Date },
): Decision<string> {
  const decision = canViewJobDetail(database, {
    jobId: input.jobPostId,
    userId: input.userId,
    ...(input.now ? { now: input.now } : {}),
  });
  if (!decision.allowed) return decision;
  return allow(input.jobPostId);
}

/**
 * The projection of a job that discovery may return.
 *
 * Field-for-field this is the "job card" in §5.5: enough to judge whether the
 * work is worth offering on, and deliberately without the barangay, the access
 * notes, the customer's identity or exact coordinates.
 */
export type JobDiscoverySummary = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  pricingModel: JobPostRecord['pricingModel'];
  budgetCentavos: number;
  currency: 'PHP';
  /** City/municipality only — never the barangay or a street address. */
  locationCity: string;
  scheduleFlexible: boolean;
  preferredStart?: string;
  publishedAt: string;
};

/** Truncation length for the discovery card's description. */
const SUMMARY_DESCRIPTION_MAX = 200;

export function toJobDiscoverySummary(job: JobPostRecord): JobDiscoverySummary {
  return {
    id: job.id,
    categoryId: job.categoryId,
    title: job.title,
    description: job.description.slice(0, SUMMARY_DESCRIPTION_MAX),
    pricingModel: job.pricingModel,
    budgetCentavos: job.budgetCentavos,
    currency: 'PHP',
    locationCity: job.locationCity,
    scheduleFlexible: job.scheduleFlexible,
    ...(job.preferredStart ? { preferredStart: job.preferredStart } : {}),
    publishedAt: job.publishedAt ?? job.createdAt,
  };
}

/* ---------------------------------------------------------------- *
 * Conversations and messages (§8)
 * ---------------------------------------------------------------- */

/**
 * Whether this account participates in a conversation.
 *
 * Membership is a stored row, never inferred from the URL, so subscribing to or
 * fetching a guessed conversation id yields nothing.
 */
export function canViewConversation(
  database: Database,
  conversationId: string,
  userId: string,
): Decision<string> {
  const conversation = database.conversations.find((row) => row.id === conversationId);
  if (!conversation) return deny('not_found');

  const isParticipant = database.conversationParticipants.some(
    (row) => row.conversationId === conversationId && row.userId === userId,
  );
  if (!isParticipant) {
    // A job-linked thread also admits the job's owner, so a conversation row is
    // not the only thing standing between a customer and their own job messages.
    if (conversation.jobPostId) {
      const job = database.jobPosts.find((row) => row.id === conversation.jobPostId);
      if (job?.customerId === userId) return allow(conversationId);
    }
    return deny('not_a_participant');
  }
  return allow(conversationId);
}

/* ---------------------------------------------------------------- *
 * Bookings and reviews (§4.7, §4.8, §10.9)
 * ---------------------------------------------------------------- */

/** Whether this account may read a booking: its customer, or its ServMate. */
export function canViewBooking(
  database: Database,
  bookingId: string,
  userId: string,
): Decision<BookingRecord> {
  const booking = database.bookings.find((row) => row.id === bookingId);
  if (!booking) return deny('not_found');
  if (booking.userId === userId) return allow(booking);

  const profile = servMateProfileFor(database, userId);
  if (profile && booking.servmateProfileId === profile.id) return allow(booking);

  return deny('not_owner');
}

/**
 * Whether this account may review this booking (§10.9).
 *
 * A review is tied to a completed booking, written by its customer, exactly
 * once — so a rating can only ever describe work that actually happened.
 */
export function canReviewBooking(
  database: Database,
  bookingId: string,
  userId: string,
): Decision<BookingRecord> {
  const booking = database.bookings.find((row) => row.id === bookingId);
  if (!booking) return deny('not_found');
  if (booking.userId !== userId) return deny('not_owner');
  if (!booking.servmateProfileId) return deny('not_reviewable');
  if (booking.status !== 'completed') return deny('not_reviewable');

  const alreadyReviewed = database.reviews.some(
    (review) => review.bookingId === bookingId && review.reviewerUserId === userId,
  );
  if (alreadyReviewed) return deny('not_reviewable');

  return allow(booking);
}
