/**
 * Shared payment recording used by BOTH the admin `recordPayment` callable
 * and the PayMongo webhook. Writes are idempotent per booking:
 * payments doc id = `booking_<bookingId>`.
 *
 * IMPORTANT: this records payment *state* in Firestore only. No money moves
 * until a verified payment-provider integration exists (see SECURITY.md).
 */
import type { Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { db, round2, serverTs } from './firestore';
import { writeAuditLog } from './audit';
import { notify } from './notify';

export type PaymentSource = 'admin_manual' | 'paymongo_webhook';

export interface RecordPaymentInput {
  bookingId: string;
  amount: number;
  method: string;
  reference?: string;
  source: PaymentSource;
  actorUid: string;
}

export type Doc = Record<string, any>;

export async function applyPaymentRecord(input: RecordPaymentInput): Promise<{ paymentId: string; status: string }> {
  const amount = round2(input.amount);
  const bookingRef = db.collection('bookings').doc(input.bookingId);
  const paymentId = `booking_${input.bookingId}`;
  const paymentRef = db.collection('payments').doc(paymentId);

  const outcome = await db.runTransaction(async (tx: Transaction) => {
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) {
      throw new HttpsError('not-found', 'Booking not found.');
    }
    const booking: Doc = bookingSnap.data() ?? {};
    const expected = round2(Number(booking.total) || 0);
    if (Math.abs(expected - amount) > 0.01) {
      throw new HttpsError(
        'failed-precondition',
        `Amount ${amount} does not match the server-computed booking total ${expected}.`,
      );
    }
    const existing = await tx.get(paymentRef);
    if (existing.exists && existing.data()?.status === 'paid') {
      return { paymentId, status: 'already_paid', booking: (existing.data() ?? {}) as Doc };
    }

    tx.set(paymentRef, {
      bookingId: input.bookingId,
      customerId: booking.customerId ?? null,
      providerId: booking.providerId ?? null,
      serviceId: booking.serviceId ?? null,
      amount: expected,
      fee: round2(Number(booking.fee) || 0),
      method: input.method,
      reference: input.reference ?? null,
      source: input.source,
      status: 'paid',
      recordedBy: input.actorUid,
      createdAt: serverTs(),
    });
    tx.update(bookingRef, {
      paymentStatus: 'paid',
      paidAt: serverTs(),
      updatedAt: serverTs(),
    });
    return { paymentId, status: 'paid', booking };
  });

  if (outcome.status === 'paid') {
    await writeAuditLog({
      actorUid: input.actorUid,
      actorLabel: input.source,
      action: 'payment.recorded',
      targetType: 'booking',
      targetId: input.bookingId,
      detail: { amount, method: input.method, reference: input.reference ?? null, source: input.source },
    });
    const customerId = String(outcome.booking.customerId ?? '');
    const providerId = String(outcome.booking.providerId ?? '');
    for (const uid of [customerId, providerId]) {
      if (uid) await notify(uid, 'booking', 'Payment recorded', `Payment of PHP ${amount} recorded for your booking.`, input.bookingId);
    }
  }

  return { paymentId, status: outcome.status };
}
