import { randomUUID } from 'node:crypto';
import { query, transact, type BookingRecord, type BookingStatus } from './store';

export type Booking = {
  id: string;
  reference: string;
  serviceId: string;
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

function toBooking(record: BookingRecord): Booking {
  return {
    id: record.id,
    reference: record.reference,
    serviceId: record.serviceId,
    serviceTitle: record.serviceTitle,
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

  await transact((database) => {
    database.bookings.push(record);
  });

  return toBooking(record);
}

export async function listBookings(userId: string): Promise<Booking[]> {
  return query((database) =>
    database.bookings
      .filter((record) => record.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toBooking),
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
    return { ok: true as const, booking: toBooking(record) };
  });
}

export function summariseBookings(bookings: Booking[]): BookingSummary {
  return {
    total: bookings.length,
    open: bookings.filter((booking) => booking.status === 'requested').length,
    cancelled: bookings.filter((booking) => booking.status === 'cancelled').length,
    areas: Array.from(
      new Set(bookings.map((booking) => booking.area).filter((area): area is string => Boolean(area))),
    ).sort(),
  };
}
