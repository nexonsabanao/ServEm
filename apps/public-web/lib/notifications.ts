import { formatPhp } from './format';
import { query, transact, type Database, type NotificationRecord } from './store';

/**
 * Notifications (§10.10).
 *
 * Records are written by the domain modules at the moment something happens —
 * an offer arrives, a booking moves, a review lands — and this module is the one
 * place that turns them into something a person can read. Two rules:
 *
 * 1. **The recipient is decided when the record is written, never when it is
 *    read.** A notification carries a recipient id; listing one account's
 *    notifications never looks at another account's work. That is also what
 *    stops the feed from disclosing a private job to an unrelated provider
 *    (§16, test 12) — there is simply no record addressed to them.
 * 2. **The link is derived, not stored.** Deleted or missing referents fall back
 *    to the account area rather than producing a dead link.
 */

export type Notification = {
  id: string;
  type: string;
  title: string;
  detail?: string;
  href: string;
  readAt?: string;
  createdAt: string;
};

export type NotificationFeed = {
  items: Notification[];
  unreadCount: number;
};

const DEFAULT_LIMIT = 50;

/** Where a booking's two sides each go to see it. */
function bookingHref(database: Database, bookingId: string, userId: string): string {
  const booking = database.bookings.find((row) => row.id === bookingId);
  if (!booking) return '/account/requests';
  if (booking.userId === userId) {
    return booking.jobPostId ? `/account/jobs/${booking.jobPostId}` : '/account/requests';
  }
  return booking.jobPostId ? `/servmate/jobs/${booking.jobPostId}` : '/account/requests';
}

/** Where each side of a job goes to see it. */
function jobHref(jobPostId: string, userId: string, customerId: string): string {
  return jobPostId && customerId !== userId ? `/servmate/jobs/${jobPostId}` : `/account/jobs/${jobPostId}`;
}

/**
 * One stored notification, read as the recipient.
 *
 * Every branch either resolves a real referent or falls back; none of them
 * reveal anything the recipient could not already open, because the copy names
 * only records they are party to.
 */
function toNotification(
  database: Database,
  record: NotificationRecord,
  userId: string,
): Notification {
  const base = {
    id: record.id,
    type: record.notificationType,
    ...(record.readAt ? { readAt: record.readAt } : {}),
    createdAt: record.createdAt,
  };

  if (record.entityType === 'offer' && record.entityId) {
    const offer = database.jobOffers.find((row) => row.id === record.entityId);
    const job = offer ? database.jobPosts.find((row) => row.id === offer.jobPostId) : undefined;
    if (!offer || !job) {
      return { ...base, title: 'An offer on a job', href: '/account/jobs' };
    }
    const href = jobHref(job.id, userId, job.customerId);
    if (record.notificationType === 'offer_received') {
      const profile = database.servmateProfiles.find((row) => row.id === offer.servmateProfileId);
      const name =
        database.users.find((row) => row.id === profile?.userId)?.name ?? 'A ServMate';
      return {
        ...base,
        title: `${name} offered ${formatPhp(offer.amountCentavos)}`,
        detail: job.title,
        href,
      };
    }
    return {
      ...base,
      title: record.notificationType === 'offer_declined' ? 'Your offer was declined' : 'Offer update',
      detail: job.title,
      href,
    };
  }

  if (record.entityType === 'booking' && record.entityId) {
    const booking = database.bookings.find((row) => row.id === record.entityId);
    const href = bookingHref(database, record.entityId, userId);
    const job = booking?.jobPostId
      ? database.jobPosts.find((row) => row.id === booking.jobPostId)
      : undefined;
    const subject = job?.title ?? booking?.serviceTitle ?? 'your booking';

    switch (record.notificationType) {
      case 'offer_accepted':
        return { ...base, title: 'Your offer was accepted', detail: subject, href };
      case 'booking_started':
        return { ...base, title: 'Work has started', detail: subject, href };
      case 'completion_requested':
        return {
          ...base,
          title: 'The ServMate says the work is done',
          detail: `Confirm ${subject} when you have had a look.`,
          href,
        };
      case 'booking_confirmed':
        return { ...base, title: 'The work is confirmed complete', detail: subject, href };
      case 'booking_cancelled':
        return { ...base, title: 'A booking was cancelled', detail: subject, href };
      case 'review_received': {
        const profileId = booking?.servmateProfileId;
        return {
          ...base,
          title: 'You received a review',
          detail: 'It is on your public profile.',
          href: profileId ? `/providers/${profileId}` : '/servmate',
        };
      }
      default:
        return { ...base, title: 'Booking update', detail: subject, href };
    }
  }

  return { ...base, title: 'Update', href: '/account' };
}

/** This account's notifications, newest first, with its unread count. */
export async function listNotifications(
  userId: string,
  limit = DEFAULT_LIMIT,
): Promise<NotificationFeed> {
  return query((database) => {
    const mine = database.notifications
      .filter((record) => record.recipientUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      items: mine.slice(0, limit).map((record) => toNotification(database, record, userId)),
      unreadCount: mine.filter((record) => !record.readAt).length,
    };
  });
}

/** Just the badge number, for the shell. */
export async function countUnread(userId: string): Promise<number> {
  return query(
    (database) =>
      database.notifications.filter(
        (record) => record.recipientUserId === userId && !record.readAt,
      ).length,
  );
}

export type MarkReadResult = { ok: true; unreadCount: number } | { ok: false; error: 'not_found' };

/**
 * Marks one notification read, or every one this account has.
 *
 * A notification belonging to somebody else is reported as absent rather than
 * refused differently, so this cannot be used to probe for other accounts'
 * activity.
 */
export async function markNotificationsRead(
  userId: string,
  notificationId?: string,
): Promise<MarkReadResult> {
  return transact((database) => {
    const now = new Date().toISOString();
    const mine = database.notifications.filter((record) => record.recipientUserId === userId);

    if (notificationId) {
      const target = mine.find((record) => record.id === notificationId);
      if (!target) return { ok: false as const, error: 'not_found' as const };
      if (!target.readAt) target.readAt = now;
    } else {
      for (const record of mine) {
        if (!record.readAt) record.readAt = now;
      }
    }

    return {
      ok: true as const,
      unreadCount: mine.filter((record) => !record.readAt).length,
    };
  });
}
