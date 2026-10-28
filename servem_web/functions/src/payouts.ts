/**
 * requestPayout — a ServMate withdraws their accumulated, server-computed
 * earnings. The callable never accepts an arbitrary amount from the client
 * without checking it against completed booking earnings, enforces the
 * minimum, and only ever creates a PENDING payout for admin review. No money
 * moves without a verified disbursement integration.
 */
import { z } from 'zod';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { DocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import { db, round2, serverTs } from './lib/firestore';
import { CORS_REGEX } from './lib/cors';
import { MIN_PAYOUT_PHP, REGION } from './lib/params';
import { requireAuth, requireProfile, requireRole } from './lib/guards';
import { enforceRateLimit } from './lib/rateLimit';
import { writeAuditLog } from './lib/audit';
import { notify } from './lib/notify';
import { moneySchema, parseInput, payoutMethodSchema, sanitizedText } from './lib/validate';

const ELIGIBLE_STATUSES = ['completed', 'reviewed'];
const MAX_BOOKINGS_PER_PAYOUT = 200;

const requestPayoutSchema = z.object({
  amount: moneySchema,
  // Optional: the app records the request; an admin confirms the destination.
  method: payoutMethodSchema.optional(),
  accountRef: sanitizedText(4, 80).optional(),
});

export const requestPayout = onCall(
  { region: REGION, cors: CORS_REGEX, timeoutSeconds: 60, memory: '256MiB' },
  async (req: CallableRequest) => {
    const authed = requireAuth(req);
    const input = parseInput(requestPayoutSchema, req.data);
    await enforceRateLimit('requestPayout', authed.uid, 5, 60 * 60);

    const profile = await requireProfile(authed.uid);
    requireRole(profile, 'servmate');

    const minPayout = Number.parseFloat(MIN_PAYOUT_PHP.value());
    const amount = round2(input.amount);
    if (!(minPayout > 0) || amount < minPayout) {
      throw new HttpsError('invalid-argument', `Minimum payout is PHP ${minPayout}.`);
    }

    // Eligible earnings: completed/reviewed bookings whose payout is unpaid.
    const eligibleSnap = await db.collection('bookings')
      .where('providerId', '==', authed.uid)
      .where('payoutStatus', '==', 'unpaid')
      .where('status', 'in', ELIGIBLE_STATUSES)
      .limit(MAX_BOOKINGS_PER_PAYOUT)
      .get();

    if (eligibleSnap.empty) {
      throw new HttpsError('failed-precondition', 'You have no available earnings to withdraw yet.');
    }

    const eligibleIds: string[] = [];
    let available = 0;
    eligibleSnap.forEach((docSnap: DocumentSnapshot) => {
      const b = (docSnap.data() ?? {}) as Record<string, any>;
      const earned = b.providerEarnings !== undefined ? Number(b.providerEarnings) : round2((Number(b.total) || 0) - (Number(b.fee) || 0));
      available += Number.isFinite(earned) && earned > 0 ? earned : 0;
      eligibleIds.push(docSnap.id);
    });
    available = round2(available);

    if (amount > available + 0.01) {
      throw new HttpsError(
        'failed-precondition',
        `Requested PHP ${amount} exceeds available earnings of PHP ${available}.`,
      );
    }

    const payoutRef = db.collection('payouts').doc();
    await db.runTransaction(async (tx: Transaction) => {
      tx.set(payoutRef, {
        providerId: authed.uid,
        providerName: String(profile.name ?? profile.email ?? ''),
        amount,
        method: input.method,
        accountRef: input.accountRef,
        status: 'pending',
        sourceBookingIds: eligibleIds,
        requestedAt: serverTs(),
        createdAt: serverTs(),
      });
      // Reserve the bookings so a concurrent second request cannot double-spend.
      for (const id of eligibleIds) {
        tx.update(db.collection('bookings').doc(id), { payoutStatus: 'pending', payoutId: payoutRef.id });
      }
    });

    await notify(authed.uid, 'payout', 'Payout requested', `PHP ${amount} via ${input.method} is pending admin review.`);
    await writeAuditLog({
      actorUid: authed.uid,
      actorLabel: 'servmate',
      action: 'payout.requested',
      targetType: 'payout',
      targetId: payoutRef.id,
      detail: { amount, method: input.method, sourceBookings: eligibleIds.length, available },
    });

    return { payoutId: payoutRef.id, amount, status: 'pending', availableBefore: available };
  },
);
