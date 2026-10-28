/**
 * Booking lifecycle: createBooking + updateBookingStatus.
 *
 * Both run entirely server-side: pricing is recomputed from the stored
 * service document, status transitions follow a fixed state machine, and the
 * actor's role (customer / provider / admin) is derived from Firestore data
 * and verified auth claims — never from client-supplied role flags.
 */
import type { Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { db, assertSafePathSegment, round2, serverTs } from './lib/firestore';
import { CORS_REGEX } from './lib/cors';
import { REGION } from './lib/params';
import { requireAuth } from './lib/guards';
import { enforceRateLimit } from './lib/rateLimit';
import { computePricing } from './lib/pricing';
import { writeAuditLog } from './lib/audit';
import { notify } from './lib/notify';
import {
  bookingStatusSchema,
  dateSchema,
  idSchema,
  parseInput,
  paymentMethodSchema,
  sanitizedText,
  timeSchema,
} from './lib/validate';

const MAX_HORIZON_DAYS = 90;
const MIN_LEAD_MINUTES = 15;

// ---------------------------------------------------------------------------
// createBooking
// ---------------------------------------------------------------------------

const createBookingSchema = z.object({
  serviceId: idSchema,
  providerId: idSchema.optional(),
  date: dateSchema,
  time: timeSchema,
  hours: z.coerce.number().finite().min(0.5).max(24),
  address: sanitizedText(10, 400),
  unit: sanitizedText(0, 40).optional().default(''),
  city: sanitizedText(2, 100),
  province: sanitizedText(2, 100),
  postalCode: z.string().regex(/^\d{4}$/, 'Philippine postal codes are 4 digits'),
  notes: sanitizedText(0, 500).optional().default(''),
  arrivalInstructions: sanitizedText(0, 1000).optional().default(''),
  placeType: z.enum(['home', 'condo', 'apartment', 'office', 'retail', 'other']),
  paymentMethod: paymentMethodSchema,
});

export const createBooking = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 30, memory: '256MiB' },
  async (req: CallableRequest) => {
    const authed = requireAuth(req);
    const input = parseInput(createBookingSchema, req.data);
    assertSafePathSegment(input.serviceId);

    await enforceRateLimit('createBooking', authed.uid, 10, 15 * 60);

    const profile = await db.collection('profiles').doc(authed.uid).get();
    if (!profile.exists) {
      throw new HttpsError('failed-precondition', 'Your profile is still being created. Try again in a moment.');
    }

    // --- service must exist, be live, and carry a sane server-side price ---
    const serviceSnap = await db.collection('services').doc(input.serviceId).get();
    if (!serviceSnap.exists) throw new HttpsError('not-found', 'Service not found.');
    const service = (serviceSnap.data() ?? {}) as Record<string, any>;
    if (service.status !== 'live') throw new HttpsError('failed-precondition', 'This service is not bookable right now.');
    const serviceRate = Number(service.rate);
    if (!Number.isFinite(serviceRate) || serviceRate <= 0 || serviceRate > 1_000_000) {
      throw new HttpsError('failed-precondition', 'Service pricing is not configured correctly.');
    }
    const providerId = String(service.providerId ?? '');
    if (!providerId) throw new HttpsError('failed-precondition', 'Service has no assigned provider.');
    if (input.providerId && input.providerId !== providerId) {
      throw new HttpsError('invalid-argument', 'providerId does not match the service listing.');
    }
    assertSafePathSegment(providerId);

    const servmateSnap = await db.collection('servmates').doc(providerId).get();
    if (!servmateSnap.exists || (servmateSnap.data() ?? {}).status !== 'active') {
      throw new HttpsError('failed-precondition', 'This ServMate is not accepting bookings.');
    }

    const minHours = Number(service.minHours);
    if (Number.isFinite(minHours) && input.hours < minHours) {
      throw new HttpsError('invalid-argument', `This service requires at least ${minHours} hour(s).`);
    }

    // --- schedule window, interpreted as Asia/Manila (UTC+8) ---
    const scheduledMs = Date.parse(`${input.date}T${input.time}:00+08:00`);
    if (Number.isNaN(scheduledMs)) throw new HttpsError('invalid-argument', 'Invalid date/time combination.');
    const now = Date.now();
    if (scheduledMs < now + MIN_LEAD_MINUTES * 60_000) {
      throw new HttpsError('invalid-argument', 'Bookings must be scheduled at least 15 minutes ahead.');
    }
    if (scheduledMs > now + MAX_HORIZON_DAYS * 86_400_000) {
      throw new HttpsError('invalid-argument', `Bookings cannot be scheduled more than ${MAX_HORIZON_DAYS} days ahead.`);
    }

    // --- server-calculated pricing: client price fields are never read ---
    const pricing = await computePricing(serviceRate, input.hours);

    const profileData = (profile.data() ?? {}) as Record<string, any>;
    const bookingRef = db.collection('bookings').doc();
    const threadRef = db.collection('threads').doc(bookingRef.id);

    const batch = db.batch();
    batch.set(bookingRef, {
      serviceId: input.serviceId,
      service: String(service.name ?? ''),
      providerId,
      provider: String(servmateSnap.data()?.name ?? service.provider ?? ''),
      providerPhoto: String(servmateSnap.data()?.photo ?? ''),
      customerId: authed.uid,
      customer: String(profileData.name ?? profileData.email ?? ''),
      date: input.date,
      time: input.time,
      scheduledAt: new Date(scheduledMs),
      hours: input.hours,
      status: 'requested',
      paymentMethod: input.paymentMethod,
      paymentStatus: 'unpaid',
      address: input.address,
      notes: input.notes,
      rate: pricing.rate,
      fee: pricing.fee,
      total: pricing.total,
      // serverTimestamp() cannot nest inside arrays — the server clock is
      // authoritative here since this write happens in Cloud Functions only.
      statusHistory: [{ status: 'requested', by: authed.uid, at: new Date().toISOString() }],
      createdAt: serverTs(),
      updatedAt: serverTs(),
    });
    batch.set(threadRef, {
      bookingId: bookingRef.id,
      members: [authed.uid, providerId],
      messages: [],
      lastMessageAt: serverTs(),
      createdAt: serverTs(),
      updatedAt: serverTs(),
    });
    await batch.commit();

    await notify(providerId, 'booking', 'New booking request', `${String(profileData.name ?? 'A customer')} requested ${String(service.name ?? 'a service')}.`, bookingRef.id);
    await writeAuditLog({
      actorUid: authed.uid,
      actorLabel: 'customer',
      action: 'booking.created',
      targetType: 'booking',
      targetId: bookingRef.id,
      detail: { serviceId: input.serviceId, providerId, total: pricing.total, paymentMethod: input.paymentMethod },
    });

    return { bookingId: bookingRef.id, threadId: threadRef.id, status: 'requested', rate: pricing.rate, fee: pricing.fee, total: pricing.total };
  },
);

// ---------------------------------------------------------------------------
// updateBookingStatus
// ---------------------------------------------------------------------------

const updateStatusSchema = z.object({
  bookingId: idSchema,
  status: bookingStatusSchema,
  reason: sanitizedText(3, 300).optional(),
});

/** Legal transitions per the marketplace state machine. */
const TRANSITIONS: Record<string, string[]> = {
  requested: ['accepted', 'declined', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: ['reviewed'],
  reviewed: [],
  declined: [],
  cancelled: [],
};

/** Transitions each participant role may perform (admin may perform any). */
const CUSTOMER_ALLOWED: Record<string, string[]> = {
  requested: ['cancelled'],
  accepted: ['cancelled'],
  completed: ['reviewed'],
};
const PROVIDER_ALLOWED: Record<string, string[]> = {
  requested: ['accepted', 'declined'],
  accepted: ['in_progress'],
  in_progress: ['completed'],
};

export const updateBookingStatus = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 30, memory: '256MiB' },
  async (req: CallableRequest) => {
    const authed = requireAuth(req);
    const input = parseInput(updateStatusSchema, req.data);
    assertSafePathSegment(input.bookingId);
    await enforceRateLimit('updateBookingStatus', authed.uid, 30, 10 * 60);

    const bookingRef = db.collection('bookings').doc(input.bookingId);
    const result = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Booking not found.');
      const booking = (snap.data() ?? {}) as Record<string, any>;

      const current = String(booking.status ?? '');
      const isAdminActor = authed.token.admin === true;
      const isCustomer = booking.customerId === authed.uid;
      const isProvider = booking.providerId === authed.uid;
      if (!isAdminActor && !isCustomer && !isProvider) {
        throw new HttpsError('permission-denied', 'You are not a participant of this booking.');
      }

      const allowedFromState = TRANSITIONS[current] ?? [];
      if (!allowedFromState.includes(input.status)) {
        if (!isAdminActor) {
          throw new HttpsError('failed-precondition', `Illegal transition ${current} -> ${input.status}.`);
        }
      } else if (isAdminActor) {
        // admin may also override outside the machine; still logged below
      } else if (isCustomer && !(CUSTOMER_ALLOWED[current] ?? []).includes(input.status)) {
        throw new HttpsError('permission-denied', `Customers cannot move a ${current} booking to ${input.status}.`);
      } else if (isProvider && !(PROVIDER_ALLOWED[current] ?? []).includes(input.status)) {
        throw new HttpsError('permission-denied', `Providers cannot move a ${current} booking to ${input.status}.`);
      }

      // A customer may only mark 'reviewed' after the review exists;
      // createReview performs the same transition atomically.
      if (isCustomer && input.status === 'reviewed' && !isAdminActor) {
        const reviewSnap = await tx.get(db.collection('reviews').doc(input.bookingId));
        if (!reviewSnap.exists) throw new HttpsError('failed-precondition', 'Submit your review to mark this booking reviewed.');
      }

      const updates: Record<string, unknown> = {
        status: input.status,
        updatedAt: serverTs(),
        statusHistory: [...(Array.isArray(booking.statusHistory) ? booking.statusHistory : []), {
          status: input.status,
          from: current,
          by: authed.uid,
          as: isAdminActor ? 'admin' : isProvider ? 'provider' : 'customer',
          reason: input.reason ?? null,
          at: new Date().toISOString(),
        }],
      };

      if (input.status === 'completed') {
        const total = round2(Number(booking.total) || 0);
        const fee = round2(Number(booking.fee) || 0);
        updates.providerEarnings = round2(total - fee);
        updates.payoutStatus = 'unpaid';
        updates.completedAt = serverTs();
      }
      if (input.status === 'cancelled' || input.status === 'declined') {
        updates.cancelledAt = serverTs();
      }

      tx.update(bookingRef, updates);
      return { current, customerId: String(booking.customerId ?? ''), providerId: String(booking.providerId ?? '') };
    });

    const counterpart = authed.uid === result.customerId ? result.providerId : result.customerId;
    if (counterpart) {
      await notify(
        counterpart,
        'booking',
        `Booking ${input.status.replace(/_/g, ' ')}`,
        `Your booking was moved from '${result.current}' to '${input.status.replace(/_/g, ' ')}'.`,
        input.bookingId,
      );
    }
    await writeAuditLog({
      actorUid: authed.uid,
      actorLabel: authed.token.admin === true ? 'admin' : authed.uid === result.providerId ? 'provider' : 'customer',
      action: 'booking.status_changed',
      targetType: 'booking',
      targetId: input.bookingId,
      detail: { from: result.current, to: input.status, reason: input.reason ?? null },
    });

    return { bookingId: input.bookingId, status: input.status };
  },
);
