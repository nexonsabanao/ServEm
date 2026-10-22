import { randomUUID } from 'node:crypto';
import { bookingTitle } from './bookings';
import { verifyPassword } from './passwords';
import {
  query,
  transact,
  type BookingStatus,
  type Database,
  type JobStatus,
  type UserRecord,
} from './store';

/**
 * Deleting an account, and what survives it.
 *
 * The PH Data Privacy Act gives a person the right to erasure; a marketplace
 * also owes the *other* party a record of work that already happened. Those two
 * duties meet here:
 *
 * 1. **Live work blocks deletion.** A booking that either side can still change,
 *    or a job that is still open, is an obligation. Deleting underneath it would
 *    strand the other person, so the request is refused with the exact list of
 *    what is live and the account is untouched.
 * 2. **Personal data goes now.** Words, pictures, profile fields, listings,
 *    preferences, blocks, notifications, sessions and credentials are removed in
 *    the same transaction, not queued for later.
 * 3. **Finished work keeps a tombstone.** A booking that is `completed` or
 *    `cancelled` is the counterparty's history — and possible evidence in a
 *    later dispute — so the booking, its title snapshot and the messages on it
 *    stay readable, with the person shown as "Deleted account". The tombstone
 *    row carries no password, no email anyone can reach, no name, no profile and
 *    no provider capability.
 * 4. **The tombstone expires.** After `PURGE_DAYS` the row is removed, and the
 *    bookings it anchored are detached to a constant actor id rather than left
 *    pointing at a person who no longer exists.
 *
 * Point 4 needs a clock, and now has one: `lib/purge-scheduler.ts` sweeps at
 * server boot and then hourly, started by `instrumentation.ts` — so a tombstone
 * expires without a request having to arrive. `purgeDueAccounts` stays the one
 * sweep, and the deployment requirement for hosts that suspend the process
 * between requests is stated in that module.
 */

const PURGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A booking is live while either party can still change what happens. */
const LIVE_BOOKING_STATUSES: BookingStatus[] = [
  'requested',
  'confirmed',
  'in_progress',
  'completion_pending',
  'disputed',
];

/** A job is live while it can still take offers or is booked work in flight. */
const LIVE_JOB_STATUSES: JobStatus[] = [
  'open',
  'offer_received',
  'booked',
  'in_progress',
  'completion_pending',
];

/** Terminal bookings are kept: they are the counterparty's record. */
const RETAINED_BOOKING_STATUSES: BookingStatus[] = ['completed', 'cancelled'];

/** The actor id a retained booking points at once the tombstone is purged. */
export const PURGED_ACCOUNT_ACTOR = 'deleted-account';

/**
 * A reason deletion is refused, written for the person reading it.
 *
 * `reference` is the booking reference or job id — something they can open. The
 * list is not a count: "you have 2 live bookings" would make them hunt.
 */
export type DeletionBlocker = {
  kind: 'booking' | 'job';
  reference: string;
  title: string;
  status: string;
};

export type DeletionPreview = {
  canDelete: boolean;
  blockers: DeletionBlocker[];
  /** Finished bookings that will outlive the account, as a count. */
  retainedBookings: number;
  purgeAfterDays: number;
  /** Whether a password must be typed; OAuth-only accounts have none. */
  hasPassword: boolean;
};

/** Live bookings and jobs this account is party to, as blockers. */
function blockersFor(database: Database, user: UserRecord): DeletionBlocker[] {
  const profile = database.servmateProfiles.find((row) => row.userId === user.id);
  const blockers: DeletionBlocker[] = [];

  for (const booking of database.bookings) {
    if (!LIVE_BOOKING_STATUSES.includes(booking.status)) continue;
    const isCustomer = booking.userId === user.id;
    const isProvider = Boolean(profile && booking.servmateProfileId === profile.id);
    if (!isCustomer && !isProvider) continue;
    blockers.push({
      kind: 'booking',
      reference: booking.reference,
      title: bookingTitle(database, booking),
      status: booking.status,
    });
  }

  for (const job of database.jobPosts) {
    if (job.customerId !== user.id) continue;
    if (!LIVE_JOB_STATUSES.includes(job.jobStatus)) continue;
    // A job already booked also appears as a booking blocker; one entry per
    // thing the person has to deal with is enough.
    if (blockers.some((blocker) => blocker.kind === 'booking' && blocker.title === job.title)) {
      continue;
    }
    blockers.push({
      kind: 'job',
      reference: job.id,
      title: job.title,
      status: job.jobStatus,
    });
  }

  return blockers;
}

/** Finished bookings where this account is either party. */
function retainedBookingsFor(database: Database, user: UserRecord): string[] {
  const profile = database.servmateProfiles.find((row) => row.userId === user.id);
  return database.bookings
    .filter(
      (booking) =>
        (booking.userId === user.id ||
          Boolean(profile && booking.servmateProfileId === profile.id)) &&
        RETAINED_BOOKING_STATUSES.includes(booking.status),
    )
    .map((booking) => booking.id);
}

/** What deleting this account would do, without doing it. */
export async function deletionPreview(userId: string): Promise<DeletionPreview | null> {
  return query((database) => {
    const user = database.users.find((row) => row.id === userId);
    if (!user || user.deletedAt) return null;

    const blockers = blockersFor(database, user);
    return {
      canDelete: blockers.length === 0,
      blockers,
      retainedBookings: retainedBookingsFor(database, user).length,
      purgeAfterDays: PURGE_DAYS,
      hasPassword: Boolean(user.passwordHash),
    };
  });
}

export type DeleteAccountResult =
  | { ok: true; purgeAfter: string; retainedBookings: number }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'wrong_password' }
  | { ok: false; error: 'active_obligations'; blockers: DeletionBlocker[] };

/**
 * Deletes the account, or explains why it cannot be deleted yet.
 *
 * The password is checked before the transaction (scrypt is asynchronous and the
 * store's transaction body is deliberately synchronous), then the obligations
 * are re-checked inside it, so a booking that arrived between the two cannot be
 * deleted underneath.
 */
export async function deleteAccount(
  userId: string,
  password: string | null,
): Promise<DeleteAccountResult> {
  const user = await query((database) => database.users.find((row) => row.id === userId));
  if (!user || user.deletedAt) return { ok: false, error: 'not_found' };

  if (user.passwordHash) {
    if (!password || !(await verifyPassword(password, user.passwordHash))) {
      return { ok: false, error: 'wrong_password' };
    }
  }

  type Outcome =
    | { ok: true; keys: string[] }
    | { ok: false; blockers: DeletionBlocker[] };

  const outcome = await transact<Outcome>((database) => {
    const record = database.users.find((row) => row.id === userId);
    if (!record || record.deletedAt) return { ok: true, keys: [] };

    const blockers = blockersFor(database, record);
    // Nothing is written on this path: `transact` persists whatever the body
    // returns, and the body returns the refusal instead of mutating anything.
    if (blockers.length > 0) return { ok: false, blockers };

    const removedKeys: string[] = [];
    const removedKeysPush = (key: string) => {
      if (!removedKeys.includes(key)) removedKeys.push(key);
    };

    const now = new Date();
    const nowIso = now.toISOString();
    const purgeAfter = new Date(now.getTime() + PURGE_DAYS * DAY_MS).toISOString();
    const profile = database.servmateProfiles.find((row) => row.userId === userId);
    const profileId = profile?.id;
    const ownedJobs = database.jobPosts.filter((job) => job.customerId === userId);
    const ownedJobIds = new Set(ownedJobs.map((job) => job.id));
    const profileListings = profileId
      ? new Set(
          database.serviceListings
            .filter((listing) => listing.servmateProfileId === profileId)
            .map((listing) => listing.id),
        )
      : new Set<string>();

    // 1. Anchor retained bookings to a title before their job goes away. A
    //    booking made from an offer carries no title of its own; without this
    //    snapshot the counterparty's history would read "Service request".
    const retained = database.bookings.filter(
      (booking) =>
        (booking.userId === userId ||
          Boolean(profileId && booking.servmateProfileId === profileId)) &&
        RETAINED_BOOKING_STATUSES.includes(booking.status),
    );
    for (const booking of retained) {
      if (!booking.serviceTitle) booking.serviceTitle = bookingTitle(database, booking);
    }

    // 2. Withdraw offers still on the table, and remove the ones attached to
    //    this account's own jobs (those rows are about to go).
    for (const offer of database.jobOffers) {
      if (ownedJobIds.has(offer.jobPostId)) continue;
      if (profileId && offer.servmateProfileId === profileId && offer.offerStatus === 'pending') {
        offer.offerStatus = 'withdrawn';
        offer.updatedAt = nowIso;
      }
    }

    // 3. Remove the account's own jobs and everything hanging off them.
    const removedJobIds = new Set<string>();
    for (const job of ownedJobs) {
      removedJobIds.add(job.id);
      for (const media of database.jobPostMedia.filter((row) => row.jobPostId === job.id)) {
        const asset = database.mediaAssets.find((row) => row.id === media.mediaAssetId);
        if (asset) removedKeysPush(asset.storageKey);
      }
    }
    database.jobPostMedia = database.jobPostMedia.filter((row) => !removedJobIds.has(row.jobPostId));
    database.jobOffers = database.jobOffers.filter(
      (offer) =>
        !removedJobIds.has(offer.jobPostId) &&
        !(profileId && offer.servmateProfileId === profileId),
    );
    database.jobPosts = database.jobPosts.filter((job) => job.customerId !== userId);

    // Conversations about those jobs go with them; conversations the person
    // shared with somebody else stay, minus their membership row.
    const jobConversationIds = new Set(
      database.conversations
        .filter((row) => row.jobPostId && removedJobIds.has(row.jobPostId))
        .map((row) => row.id),
    );
    database.conversations = database.conversations.filter(
      (row) => !jobConversationIds.has(row.id),
    );
    database.conversationParticipants = database.conversationParticipants.filter(
      (row) => !jobConversationIds.has(row.conversationId),
    );
    database.messages = database.messages.filter(
      (row) => !(row.conversationId && jobConversationIds.has(row.conversationId)),
    );
    database.conversationParticipants = database.conversationParticipants.filter(
      (row) => row.userId !== userId,
    );

    // 4. Provider capability and its public content.
    if (profileId) {
      database.serviceListings = database.serviceListings.filter(
        (row) => !profileListings.has(row.id),
      );
      database.servmateCategories = database.servmateCategories.filter(
        (row) => row.servmateProfileId !== profileId,
      );
      database.servmateServiceAreas = database.servmateServiceAreas.filter(
        (row) => row.servmateProfileId !== profileId,
      );
      database.portfolioItems = database.portfolioItems.filter(
        (row) => row.servmateProfileId !== profileId,
      );
      database.workPosts = database.workPosts.filter(
        (row) => row.servmateProfileId !== profileId,
      );
      // A review is a statement about a public profile; with the profile gone
      // there is nothing for it to describe.
      database.reviews = database.reviews.filter(
        (row) => row.servmateProfileId !== profileId,
      );
      database.servmateProfiles = database.servmateProfiles.filter(
        (row) => row.id !== profileId,
      );
    }

    // 5. Pictures and video this account uploaded.
    for (const asset of database.mediaAssets.filter((row) => row.ownerUserId === userId)) {
      removedKeysPush(asset.storageKey);
    }
    database.mediaAssets = database.mediaAssets.filter((row) => row.ownerUserId !== userId);

    // 6. Everything addressed to the account, or blocking it.
    database.notifications = database.notifications.filter(
      (row) => row.recipientUserId !== userId,
    );
    database.userBlocks = database.userBlocks.filter(
      (row) => row.blockerUserId !== userId && row.blockedUserId !== userId,
    );
    database.passwordResets = database.passwordResets.filter((row) => row.userId !== userId);

    // 7. Every session, so a stolen cookie dies with the account.
    database.sessions = database.sessions.filter((row) => row.userId !== userId);

    // 8. The tombstone: no name, no reachable address, no credentials, no
    //    profile, no capability. Only the id the retained bookings point at.
    const tombstoneEmail = `deleted+${userId}@servem.invalid`;
    delete record.username;
    delete record.passwordHash;
    delete record.identities;
    delete record.preferences;
    delete record.profile;
    record.name = 'Deleted account';
    record.email = tombstoneEmail;
    record.isServMate = false;
    record.deletedAt = nowIso;
    record.purgeAfter = purgeAfter;

    database.accountDeletions.push({
      id: randomUUID(),
      userId,
      requestedAt: nowIso,
      purgeAfter,
      retainedBookingIds: retained.map((booking) => booking.id),
    });

    return { ok: true, keys: removedKeys };
  });

  if (!outcome.ok) {
    return { ok: false, error: 'active_obligations', blockers: outcome.blockers };
  }

  // Bytes live outside the JSON transaction, so they are removed after it. A
  // failure here leaves an orphaned file, never a visible record.
  if (outcome.keys.length > 0) {
    const { discardStoredBytes } = await import('./media');
    await Promise.all(outcome.keys.map((key) => discardStoredBytes(key).catch(() => undefined)));
  }

  const purgeAfter = await query(
    (database) => database.users.find((row) => row.id === userId)?.purgeAfter,
  );
  const retainedBookings = await query(
    (database) => database.accountDeletions.find((row) => row.userId === userId)?.retainedBookingIds.length ?? 0,
  );

  return {
    ok: true,
    purgeAfter: purgeAfter ?? new Date(Date.now() + PURGE_DAYS * DAY_MS).toISOString(),
    retainedBookings,
  };
}

/**
 * Removes tombstones whose retention window has passed.
 *
 * Retained bookings keep their title snapshot and reference; they are detached
 * from the person by pointing at `PURGED_ACCOUNT_ACTOR`, which reads as a
 * deleted account everywhere a name would have been resolved.
 *
 * The sweep runs on a timer now (see `lib/purge-scheduler`), so it reads before
 * it writes: an hourly tick with nothing due must not rewrite the store file.
 */
export async function purgeDueAccounts(now: Date = new Date()): Promise<number> {
  const due = await query(
    (database) =>
      database.users.filter(
        (user) =>
          Boolean(user.deletedAt && user.purgeAfter) &&
          new Date(user.purgeAfter as string).getTime() <= now.getTime(),
      ).length,
  );
  if (due === 0) return 0;

  return transact((database) => {
    const due = database.users.filter(
      (user) =>
        Boolean(user.deletedAt && user.purgeAfter) &&
        new Date(user.purgeAfter as string).getTime() <= now.getTime(),
    );
    if (due.length === 0) return 0;

    for (const user of due) {
      database.users = database.users.filter((row) => row.id !== user.id);
      database.sessions = database.sessions.filter((row) => row.userId !== user.id);
      database.notifications = database.notifications.filter(
        (row) => row.recipientUserId !== user.id,
      );
      database.userBlocks = database.userBlocks.filter(
        (row) => row.blockerUserId !== user.id && row.blockedUserId !== user.id,
      );
      database.passwordResets = database.passwordResets.filter((row) => row.userId !== user.id);
      database.conversationParticipants = database.conversationParticipants.filter(
        (row) => row.userId !== user.id,
      );
      for (const booking of database.bookings) {
        if (booking.userId === user.id) booking.userId = PURGED_ACCOUNT_ACTOR;
      }
      database.accountDeletions = database.accountDeletions.filter(
        (row) => row.userId !== user.id,
      );
    }

    return due.length;
  });
}
