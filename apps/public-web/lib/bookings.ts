import { randomUUID } from 'node:crypto';
import { OPEN_BOOKING_STATUSES } from './policy';
import { query, transact, type BookingRecord, type BookingStatus, type Database } from './store';

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

function buildReference(id: string): string {
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
    reference: buildReference(id),
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
  | { ok: false; error: 'not_found' | 'already_cancelled' };

/**
 * Cancels one of the account's own requests. The userId check is part of the
 * lookup, so a request belonging to somebody else is indistinguishable from one
 * that does not exist.
 */
export async function cancelBooking(userId: string, bookingId: string): Promise<CancelResult> {
  return transact((database) => {
    const record = database.bookings.find(
      (candidate) => candidate.id === bookingId && candidate.userId === userId,
    );
    if (!record) return { ok: false as const, error: 'not_found' as const };
    if (record.status === 'cancelled') {
      return { ok: false as const, error: 'already_cancelled' as const };
    }
    record.status = 'cancelled';
    record.cancelledAt = new Date().toISOString();
    return { ok: true as const, booking: toBooking(database, record) };
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
