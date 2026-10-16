import { randomUUID } from 'node:crypto';
import { OPEN_BOOKING_STATUSES, canCancelBooking, isJobBooked } from './policy';
import {
  query,
  transact,
  type BookingRecord,
  type BookingStatus,
  type Database,
  type JobStatus,
} from './store';

export { OPEN_BOOKING_STATUSES };

/**
 * The account's service requests and bookings.
 *
 * A booking is either a **service-level request** — the storefront's original
 * "request this listing" flow, which stores the listing's title directly — or a
 * **job booking**, created when a customer accepts a ServMate's offer. The
 * second carries no title of its own, so `bookingTitle` resolves one from the
 * job post; that is why the view below takes the snapshot rather than just the
 * record.
 */

export type Booking = {
  id: string;
  reference: string;
  serviceId: string;
  /** Always present in the view, resolved from the job post when needed. */
  serviceTitle: string;
  area?: string;
  message: string;
  status: BookingStatus;
  createdAt: string;
  cancelledAt?: string;
};

export type BookingSummary = {
  total: number;
  open: number;
  cancelled: number;
  areas: string[];
};

/**
 * The title to show for a booking.
 *
 * A service-level request stored its own title. A job booking did not — the work
 * is described by the job post — so the job's title is used, and a record whose
 * job has since been removed still shows something truthful rather than blank.
 */
export function bookingTitle(database: Database, record: BookingRecord): string {
  if (record.serviceTitle) return record.serviceTitle;
  if (record.jobPostId) {
    const job = database.jobPosts.find((candidate) => candidate.id === record.jobPostId);
    if (job) return job.title;
  }
  return 'Service request';
}

function toBooking(database: Database, record: BookingRecord): Booking {
  return {
    id: record.id,
    reference: record.reference,
    serviceId: record.serviceId ?? '',
    serviceTitle: bookingTitle(database, record),
    ...(record.area ? { area: record.area } : {}),
    message: record.message,
    status: record.status,
    createdAt: record.createdAt,
    ...(record.cancelledAt ? { cancelledAt: record.cancelledAt } : {}),
  };
}

/**
 * The customer-facing reference for a booking.
 *
 * Exported because a booking created by accepting an offer is built in
 * `./offers` and must carry the same reference format as one created from the
 * storefront.
 */
export function buildBookingReference(id: string): string {
  return `SE-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export async function createBooking(input: {
  userId: string;
  serviceId: string;
  serviceTitle: string;
  area?: string;
  message: string;
}): Promise<Booking> {
  const id = randomUUID();
  const record: BookingRecord = {
    id,
    reference: buildBookingReference(id),
    userId: input.userId,
    serviceId: input.serviceId,
    serviceTitle: input.serviceTitle,
    ...(input.area ? { area: input.area } : {}),
    message: input.message.trim(),
    status: 'requested',
    createdAt: new Date().toISOString(),
  };

  return transact((database) => {
    database.bookings.push(record);
    return toBooking(database, record);
  });
}

export async function listBookings(userId: string): Promise<Booking[]> {
  return query((database) =>
    database.bookings
      .filter((record) => record.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((record) => toBooking(database, record)),
  );
}

export type CancelResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: 'not_found' | 'already_cancelled' | 'invalid_state' };

/**
 * Cancels one of the account's own requests. The userId check is part of the
 * lookup, so a request belonging to somebody else is indistinguishable from one
 * that does not exist.
 *
 * Whether the move is legal at all is not decided here: `canCancelBooking` owns
 * that rule (§4.7), so a booking that has finished, or that is frozen for a
 * dispute, is refused with `invalid_state` instead of being closed. A finished
 * job has already been reported and confirmed — closing it now would tell the
 * ServMate their finished work was withdrawn.
 *
 * A booking carved out of an accepted offer also closes its job in the same
 * transaction: the offers on that job were already withdrawn when it was booked,
 * so leaving the job `booked` would strand it as work nobody can reopen.
 */
export async function cancelBooking(userId: string, bookingId: string): Promise<CancelResult> {
  return transact((database) => {
    const decision = canCancelBooking(database, bookingId, userId);
    if (!decision.allowed) {
      if (decision.reason === 'already_cancelled') {
        return { ok: false as const, error: 'already_cancelled' as const };
      }
      if (decision.reason === 'invalid_state') {
        return { ok: false as const, error: 'invalid_state' as const };
      }
      return { ok: false as const, error: 'not_found' as const };
    }
    const record = decision.value;
    const now = new Date().toISOString();
    const previous = record.status;
    record.status = 'cancelled';
    record.cancelledAt = now;

    database.bookingStatusHistory.push({
      id: randomUUID(),
      bookingId: record.id,
      oldStatus: previous,
      newStatus: 'cancelled',
      actorUserId: userId,
      createdAt: now,
    });

    if (record.jobPostId) {
      const job = database.jobPosts.find((candidate) => candidate.id === record.jobPostId);
      if (job && isJobBooked(job.jobStatus)) {
        job.jobStatus = 'cancelled';
        job.closedAt = now;
        job.updatedAt = now;
      }
    }
    const providerUserId = providerUserIdFor(database, record);
    if (providerUserId) {
      database.notifications.push({
        id: randomUUID(),
        recipientUserId: providerUserId,
        notificationType: 'booking_cancelled',
        entityType: 'booking',
        entityId: record.id,
        createdAt: now,
      });
    }

    return { ok: true as const, booking: toBooking(database, record) };
  });
}

/* ---------------------------------------------------------------- *
 * The booked-job state machine (§4.7, §4.8)
 *
 * A booking carved out of an accepted offer is a piece of work with a
 * lifecycle: the ServMate starts it, reports it finished when the work is done,
 * and the customer confirms that it really was. Each move records who made it,
 * tells the other party, and mirrors the state onto the job post so the two
 * records never disagree about where the work stands.
 * ---------------------------------------------------------------- */

export type TransitionResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: 'not_found' | 'not_yours' | 'invalid_state' };

/**
 * Anybody who may move a booking: the two parties, and an operator.
 *
 * `moderator` is not an account and is not checked against the rows here — the
 * credential that unlocks `lib/moderation.ts` is what authenticated it, and the
 * audit row records the operator's label. Keeping the side in this union rather
 * than adding a second transition path is what makes an operator verdict obey the
 * same legality rules as every other move: `from: ['disputed']` still has to
 * hold, the history row is still written, and both parties are still told.
 */
type ActorSide = 'customer' | 'provider' | 'moderator';

/** Which side of a booking an actor is on — decided from rows, never from input. */
function canAct(
  database: Database,
  record: BookingRecord,
  actorUserId: string,
  side: ActorSide,
): boolean {
  if (side === 'moderator') return true;
  if (side === 'customer') return record.userId === actorUserId;
  if (!record.servmateProfileId) return false;
  const profile = database.servmateProfiles.find(
    (candidate) => candidate.id === record.servmateProfileId,
  );
  return profile?.userId === actorUserId;
}

/** The user id to notify — the party *not* performing the move. */
function otherParty(
  database: Database,
  record: BookingRecord,
  actorSide: ActorSide,
): string | undefined {
  if (actorSide === 'provider') return record.userId;
  if (!record.servmateProfileId) return undefined;
  return database.servmateProfiles.find(
    (candidate) => candidate.id === record.servmateProfileId,
  )?.userId;
}

/**
 * Everybody to tell about a move.
 *
 * A party's move interests the other party; an operator's move interests both of
 * them, which is the one case where `otherParty` is not enough.
 */
function recipients(database: Database, record: BookingRecord, actorSide: ActorSide): string[] {
  if (actorSide !== 'moderator') {
    const other = otherParty(database, record, actorSide);
    return other ? [other] : [];
  }
  const both = [record.userId, providerUserIdFor(database, record)];
  return [...new Set(both.filter((id): id is string => Boolean(id)))];
}

/** The provider's user id behind a booking, when one is attached. */
function providerUserIdFor(database: Database, record: BookingRecord): string | undefined {
  if (!record.servmateProfileId) return undefined;
  return database.servmateProfiles.find(
    (candidate) => candidate.id === record.servmateProfileId,
  )?.userId;
}

type MoveInput = {
  actorUserId: string;
  actorSide: ActorSide;
  /** Statuses the booking must be in for this move to be legal. */
  from: BookingStatus[];
  to: BookingStatus;
  /**
   * The job post mirrors the booking, so both surfaces agree. Omit it when the
   * move must not touch the job — a dispute freezes the booking without
   * pretending the job itself changed state.
   */
  jobStatus?: JobStatus;
  notificationType: string;
  /** Recorded on the history row: why the move was made, not just that it was. */
  reason?: string;
};

/**
 * Checks side and state, then applies the move. Returns a reason rather than
 * throwing, because every one of them is a normal answer the route must render.
 */
function transition(
  database: Database,
  record: BookingRecord,
  input: MoveInput,
): TransitionResult {
  if (!canAct(database, record, input.actorUserId, input.actorSide)) {
    // Indistinguishable from an absent booking: a stranger learns nothing.
    return { ok: false as const, error: 'not_yours' as const };
  }
  if (!input.from.includes(record.status)) {
    return { ok: false as const, error: 'invalid_state' as const };
  }

  const now = new Date().toISOString();
  const oldStatus = record.status;
  record.status = input.to;
  if (input.to === 'in_progress') record.startedAt = now;
  if (input.to === 'completed') record.completedAt = now;

  database.bookingStatusHistory.push({
    id: randomUUID(),
    bookingId: record.id,
    oldStatus,
    newStatus: input.to,
    actorUserId: input.actorUserId,
    ...(input.reason ? { reason: input.reason } : {}),
    createdAt: now,
  });

  if (input.jobStatus && record.jobPostId) {
    const job = database.jobPosts.find((candidate) => candidate.id === record.jobPostId);
    // A closed job is not reopened by a late click on stale work.
    if (job && isJobBooked(job.jobStatus)) {
      job.jobStatus = input.jobStatus;
      job.updatedAt = now;
    }
  }

  for (const recipient of recipients(database, record, input.actorSide)) {
    database.notifications.push({
      id: randomUUID(),
      recipientUserId: recipient,
      notificationType: input.notificationType,
      entityType: 'booking',
      entityId: record.id,
      createdAt: now,
    });
  }

  return { ok: true as const, booking: toBooking(database, record) };
}

/** The ServMate marks booked work under way. Only that ServMate may do it. */
export async function startBooking(
  servmateUserId: string,
  bookingId: string,
): Promise<TransitionResult> {
  return transact((database) => {
    const record = database.bookings.find((candidate) => candidate.id === bookingId);
    if (!record) return { ok: false as const, error: 'not_found' as const };
    return transition(database, record, {
      actorUserId: servmateUserId,
      actorSide: 'provider',
      from: ['confirmed'],
      to: 'in_progress',
      jobStatus: 'in_progress',
      notificationType: 'booking_started',
    });
  });
}

/** The ServMate reports the work finished; the customer still has to confirm it. */
export async function requestCompletion(
  servmateUserId: string,
  bookingId: string,
): Promise<TransitionResult> {
  return transact((database) => {
    const record = database.bookings.find((candidate) => candidate.id === bookingId);
    if (!record) return { ok: false as const, error: 'not_found' as const };
    return transition(database, record, {
      actorUserId: servmateUserId,
      actorSide: 'provider',
      from: ['in_progress'],
      to: 'completion_pending',
      jobStatus: 'completion_pending',
      notificationType: 'completion_requested',
    });
  });
}

/** The customer confirms the work is done, closing the booking and the job. */
export async function confirmCompletion(
  customerId: string,
  bookingId: string,
): Promise<TransitionResult> {
  return transact((database) => {
    const record = database.bookings.find((candidate) => candidate.id === bookingId);
    if (!record) return { ok: false as const, error: 'not_found' as const };
    return transition(database, record, {
      actorUserId: customerId,
      actorSide: 'customer',
      from: ['completion_pending'],
      to: 'completed',
      jobStatus: 'completed',
      notificationType: 'booking_confirmed',
    });
  });
}

/**
 * The customer reports a problem with work that is under way or awaiting their
 * confirmation.
 *
 * A dispute is the one state that stops the machine rather than advancing it:
 * while it stands, the ServMate cannot re-report completion, the customer
 * cannot confirm it, and nobody can review it — so a completion cannot quietly
 * finish the booking underneath an open complaint. Only the customer can open
 * one, because only the customer can be on the wrong end of work they did not
 * receive.
 */
export async function openDispute(
  customerId: string,
  bookingId: string,
  reason: string,
): Promise<TransitionResult> {
  const note = reason.trim();
  return transact((database) => {
    const record = database.bookings.find((candidate) => candidate.id === bookingId);
    if (!record) return { ok: false as const, error: 'not_found' as const };
    return transition(database, record, {
      actorUserId: customerId,
      actorSide: 'customer',
      from: ['in_progress', 'completion_pending'],
      to: 'disputed',
      notificationType: 'booking_disputed',
      reason: note,
    });
  });
}

/**
 * How a dispute ends: the customer takes it back, or walks away from the work.
 *
 * `withdraw` returns the booking to the state it was in — the ServMate's
 * completion still stands, awaiting confirmation. `cancel` ends the booking and
 * closes the job. Neither can be done by the other party: the person who raised
 * the complaint is the person who decides whether it still stands.
 */
export type DisputeOutcome = 'withdraw' | 'cancel';

export async function resolveDispute(
  customerId: string,
  bookingId: string,
  outcome: DisputeOutcome,
): Promise<TransitionResult> {
  return transact((database) => {
    const record = database.bookings.find((candidate) => candidate.id === bookingId);
    if (!record) return { ok: false as const, error: 'not_found' as const };

    const cancelling = outcome === 'cancel';
    const result = transition(database, record, {
      actorUserId: customerId,
      actorSide: 'customer',
      from: ['disputed'],
      to: cancelling ? 'cancelled' : 'completion_pending',
      ...(cancelling ? { jobStatus: 'cancelled' as JobStatus } : {}),
      notificationType: cancelling ? 'booking_cancelled' : 'dispute_withdrawn',
      reason: cancelling ? 'Dispute closed — the booking was cancelled.' : 'Dispute withdrawn.',
    });

    if (cancelling && result.ok) {
      const now = new Date().toISOString();
      record.cancelledAt = now;
      if (record.jobPostId) {
        const job = database.jobPosts.find((candidate) => candidate.id === record.jobPostId);
        if (job && job.jobStatus === 'cancelled') {
          job.closedAt = now;
          job.updatedAt = now;
        }
      }
    }

    return result;
  });
}

/**
 * An operator's verdict on a disputed booking, applied inside the caller's
 * transaction.
 *
 * The counterpart to `resolveDispute` for the case the customer cannot or will
 * not close themselves: the booking leaves `disputed` for `completed` (the work
 * stands and the agreed amount is owed) or `cancelled` (it does not), the job
 * mirrors, both parties are notified, and the move is recorded in
 * `bookingStatusHistory` with the operator's label as the actor. `completed`
 * stamps `completedAt` exactly as the customer's own confirmation would, so
 * nothing downstream can tell a confirmed booking from an adjudicated one except
 * the history row — which is where that difference belongs.
 *
 * Synchronous and database-taking on purpose: `lib/moderation.ts` writes the
 * booking move and its own audit row in one transaction, so a verdict can never
 * exist without a record of who made it. Callers must already be inside
 * `transact`.
 */
export function applyModeratorOutcome(
  database: Database,
  input: {
    bookingId: string;
    verdict: 'completed' | 'cancelled';
    note: string;
    actorLabel: string;
  },
): TransitionResult {
  const record = database.bookings.find((candidate) => candidate.id === input.bookingId);
  if (!record) return { ok: false as const, error: 'not_found' as const };

  const cancelling = input.verdict === 'cancelled';
  const result = transition(database, record, {
    actorUserId: `moderator:${input.actorLabel}`,
    actorSide: 'moderator',
    from: ['disputed'],
    to: cancelling ? 'cancelled' : 'completed',
    jobStatus: cancelling ? 'cancelled' : 'completed',
    notificationType: cancelling ? 'booking_cancelled' : 'booking_confirmed',
    reason: `Decided by an operator (${input.actorLabel}): ${input.note}`,
  });

  if (result.ok && cancelling) {
    const now = new Date().toISOString();
    record.cancelledAt = now;
    if (record.jobPostId) {
      const job = database.jobPosts.find((candidate) => candidate.id === record.jobPostId);
      if (job && job.jobStatus === 'cancelled') {
        job.closedAt = now;
        job.updatedAt = now;
      }
    }
  }

  return result;
}

/**
 * Bookings the signed-in account holds as the ServMate, newest first.
 *
 * The provider's half of the work queue: what was booked with them and where it
 * stands. Resolved through the profile the account owns, so a customer can never
 * ask for somebody else's queue by supplying a profile id.
 */
export async function listServmateBookings(userId: string): Promise<Booking[]> {
  return query((database) => {
    const profile = database.servmateProfiles.find(
      (candidate) => candidate.userId === userId,
    );
    if (!profile) return [];
    return database.bookings
      .filter((record) => record.servmateProfileId === profile.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((record) => toBooking(database, record));
  });
}

/**
 * The booking a job was carved into, for its own customer.
 *
 * The job page needs it to show the agreed terms, the current status and the
 * one action still outstanding — "confirm the work is done" — so those facts
 * come from the same rows the rest of the marketplace reads.
 */
export async function getBookingForJob(
  userId: string,
  jobId: string,
): Promise<Booking | null> {
  return query((database) => {
    const record = database.bookings.find(
      (candidate) => candidate.jobPostId === jobId && candidate.userId === userId,
    );
    return record ? toBooking(database, record) : null;
  });
}


export function summariseBookings(bookings: Booking[]): BookingSummary {
  return {
    total: bookings.length,
    open: bookings.filter((booking) => OPEN_BOOKING_STATUSES.includes(booking.status)).length,
    cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
    areas: Array.from(
      new Set(bookings.map((booking) => booking.area).filter((area): area is string => Boolean(area))),
    ).sort(),
  };
}
