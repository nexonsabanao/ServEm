/**
 * Admin-gated workflows. Every entry point here either requires the `admin`
 * custom claim or (for setAdminClaim only) the one-time bootstrap secret.
 *
 * Money posture: processRefund RECORDS a refund intent for admin review and
 * payment-provider follow-up. It never marks money as moved, because no live
 * PayMongo API integration is verified in this environment.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { auth as adminAuth, db, assertSafePathSegment, serverTs } from './lib/firestore';
import { CORS_REGEX } from './lib/cors';
import { ADMIN_BOOTSTRAP_TOKEN, REGION } from './lib/params';
import { requireAdmin, requireAuth } from './lib/guards';
import { enforceRateLimit } from './lib/rateLimit';
import { writeAuditLog } from './lib/audit';
import { notify } from './lib/notify';
import { applyPaymentRecord } from './lib/payments';
import { idSchema, moneySchema, parseInput, paymentMethodSchema, sanitizedText } from './lib/validate';

function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ---------------------------------------------------------------------------
// setAdminClaim
// ---------------------------------------------------------------------------

const setAdminClaimSchema = z.object({
  targetUid: idSchema,
  admin: z.boolean().optional().default(true),
  bootstrapToken: z.string().max(512).optional(),
});

export const setAdminClaim = onCall(
  {
    region: REGION,
    cors: CORS_REGEX,
    secrets: [ADMIN_BOOTSTRAP_TOKEN],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (req: CallableRequest) => {
    const authed = requireAuth(req); // bootstrap still requires a signed-in account
    const input = parseInput(setAdminClaimSchema, req.data);
    assertSafePathSegment(input.targetUid);

    const callerIsAdmin = authed.token.admin === true;
    let viaBootstrap = false;
    if (!callerIsAdmin) {
      let secret = '';
      try {
        secret = ADMIN_BOOTSTRAP_TOKEN.value();
      } catch {
        secret = ''; // secret not configured — bootstrap is unavailable
      }
      if (!secret || !input.bootstrapToken || !constantTimeEqual(secret, input.bootstrapToken)) {
        throw new HttpsError('permission-denied', 'Admin privileges or a valid bootstrap token are required.');
      }
      viaBootstrap = true;
    }

    if (viaBootstrap) {
      // Bootstrap may only promote the CALLER to admin, never anyone else,
      // and never demote. This keeps the break-glass path single-purpose.
      if (!input.admin || input.targetUid !== authed.uid) {
        throw new HttpsError('permission-denied', 'Bootstrap can only grant the admin role to your own account.');
      }
    }

    // Merge instead of replace so other custom claims survive; custom claims
    // are fully replaced by setCustomUserClaims, so read-modify-write here.
    const userRecord = await adminAuth.getUser(input.targetUid);
    const existingClaims = (userRecord.customClaims ?? {}) as Record<string, unknown>;
    const nextClaims: Record<string, unknown> = { ...existingClaims };
    if (input.admin) nextClaims.admin = true;
    else delete nextClaims.admin;
    await adminAuth.setCustomUserClaims(input.targetUid, nextClaims);

    // Keep the profile doc's role in sync when it exists (best effort).
    const profileRef = db.collection('profiles').doc(input.targetUid);
    if ((await profileRef.get()).exists) {
      await profileRef.update({ role: input.admin ? 'admin' : 'customer', updatedAt: serverTs() });
    }

    await writeAuditLog({
      actorUid: authed.uid,
      actorLabel: viaBootstrap ? 'bootstrap' : 'admin',
      action: 'admin.claim_changed',
      targetType: 'user',
      targetId: input.targetUid,
      detail: { admin: input.admin, viaBootstrap },
    });

    return { targetUid: input.targetUid, admin: input.admin };
  },
);

// ---------------------------------------------------------------------------
// processRefund (admin-only intent; no money moves here)
// ---------------------------------------------------------------------------

const refundSchema = z.object({
  bookingId: idSchema,
  amount: moneySchema.optional(),
  reason: sanitizedText(10, 500),
});

export const processRefund = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 30, memory: '256MiB' },
  async (req: CallableRequest) => {
    const authed = requireAdmin(req);
    const input = parseInput(refundSchema, req.data);
    assertSafePathSegment(input.bookingId);
    await enforceRateLimit('processRefund', authed.uid, 20, 10 * 60);

    const bookingSnap = await db.collection('bookings').doc(input.bookingId).get();
    if (!bookingSnap.exists) throw new HttpsError('not-found', 'Booking not found.');
    const booking = (bookingSnap.data() ?? {}) as Record<string, any>;

    const paymentRef = db.collection('payments').doc(`booking_${input.bookingId}`);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists || paymentSnap.data()?.status !== 'paid') {
      throw new HttpsError('failed-precondition', 'No recorded payment to refund for this booking.');
    }

    const refundAmount = input.amount !== undefined ? Number(input.amount) : Number(paymentSnap.data()?.amount ?? booking.total ?? 0);
    const paidAmount = Number(paymentSnap.data()?.amount ?? 0);
    if (!(refundAmount > 0) || refundAmount > paidAmount + 0.01) {
      throw new HttpsError('invalid-argument', 'Refund amount must be positive and not exceed the recorded payment.');
    }

    // Intent only — status stays 'refund_pending' until a verified payment
    // provider confirms the transfer. Do NOT write 'refunded' here.
    await paymentRef.update({
      status: 'refund_pending',
      refundAmount: refundAmount,
      refundReason: input.reason,
      refundRequestedBy: authed.uid,
      refundRequestedAt: serverTs(),
      updatedAt: serverTs(),
    });
    await db.collection('bookings').doc(input.bookingId).update({
      refundStatus: 'pending',
      updatedAt: serverTs(),
    });

    for (const uid of [String(booking.customerId ?? ''), String(booking.providerId ?? '')]) {
      if (uid) await notify(uid, 'system', 'Refund requested', `A refund of PHP ${refundAmount} is pending review for your booking.`, input.bookingId);
    }
    await writeAuditLog({
      actorUid: authed.uid,
      actorLabel: 'admin',
      action: 'refund.requested',
      targetType: 'booking',
      targetId: input.bookingId,
      detail: { amount: refundAmount, reason: input.reason, moneyMoved: false },
    });

    return { bookingId: input.bookingId, status: 'refund_pending', amount: refundAmount };
  },
);

// ---------------------------------------------------------------------------
// resolveDispute (admin-only)
// ---------------------------------------------------------------------------

const disputeOutcomeSchema = z.enum(['refund_customer', 'release_provider', 'split', 'dismissed']);

const resolveDisputeSchema = z.object({
  disputeId: idSchema,
  outcome: disputeOutcomeSchema,
  note: sanitizedText(10, 1000),
});

export const resolveDispute = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 30, memory: '256MiB' },
  async (req: CallableRequest) => {
    const authed = requireAdmin(req);
    const input = parseInput(resolveDisputeSchema, req.data);
    assertSafePathSegment(input.disputeId);
    await enforceRateLimit('resolveDispute', authed.uid, 30, 10 * 60);

    const disputeRef = db.collection('disputes').doc(input.disputeId);
    const disputeSnap = await disputeRef.get();
    if (!disputeSnap.exists) throw new HttpsError('not-found', 'Dispute not found.');
    const dispute = (disputeSnap.data() ?? {}) as Record<string, any>;
    if (dispute.status === 'resolved') {
      throw new HttpsError('failed-precondition', 'Dispute is already resolved.');
    }

    await disputeRef.update({
      status: 'resolved',
      outcome: input.outcome,
      resolutionNote: input.note,
      resolvedBy: authed.uid,
      resolvedAt: serverTs(),
      updatedAt: serverTs(),
    });

    const bookingId = String(dispute.bookingId ?? '');
    if (bookingId) {
      const bookingSnap = await db.collection('bookings').doc(bookingId).get();
      const booking = (bookingSnap.data() ?? {}) as Record<string, any>;
      for (const uid of [String(booking.customerId ?? ''), String(booking.providerId ?? '')]) {
        if (uid) await notify(uid, 'system', 'Dispute resolved', `Your dispute was resolved: ${input.outcome.replace(/_/g, ' ')}.`, bookingId);
      }
    }
    await writeAuditLog({
      actorUid: authed.uid,
      actorLabel: 'admin',
      action: 'dispute.resolved',
      targetType: 'dispute',
      targetId: input.disputeId,
      detail: { outcome: input.outcome, note: input.note, bookingId: bookingId || null },
    });

    return { disputeId: input.disputeId, status: 'resolved', outcome: input.outcome };
  },
);

// ---------------------------------------------------------------------------
// recordPayment (admin-only callable; webhook uses the same internal helper)
// ---------------------------------------------------------------------------

const recordPaymentSchema = z.object({
  bookingId: idSchema,
  amount: moneySchema,
  method: paymentMethodSchema,
  reference: z.string().trim().max(120).optional(),
});

export const recordPayment = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 30, memory: '256MiB' },
  async (req: CallableRequest) => {
    const authed = requireAdmin(req);
    const input = parseInput(recordPaymentSchema, req.data);
    assertSafePathSegment(input.bookingId);
    await enforceRateLimit('recordPayment', authed.uid, 30, 10 * 60);

    const result = await applyPaymentRecord({
      bookingId: input.bookingId,
      amount: input.amount,
      method: input.method,
      reference: input.reference,
      source: 'admin_manual',
      actorUid: authed.uid,
    });

    return result;
  },
);
