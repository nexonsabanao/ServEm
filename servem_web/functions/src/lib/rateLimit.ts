/**
 * Firestore-backed fixed-window rate limiter for write-heavy callables.
 * Documents live in the server-only `rateLimits` collection and are swept by
 * the daily maintenance job; they are throwaway counters, safe to delete.
 *
 * Doc id: `${action}__${uid}__${windowStartEpoch}` — one document per
 * (actor, action, window), so contention stays per-user.
 */
import type { Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './firestore';

export async function enforceRateLimit(
  action: string,
  uid: string,
  maxPerWindow: number,
  windowSeconds: number,
): Promise<void> {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const ref = db.collection('rateLimits').doc(`${action}__${uid}__${windowStart}`);

  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const count = Number(snap.data()?.count) || 0;
      if (count >= maxPerWindow) {
        throw new HttpsError(
          'resource-exhausted',
          `Too many '${action}' requests. Try again in ${windowSeconds}s.`,
        );
      }
      tx.update(ref, { count: count + 1, updatedAt: new Date(now) });
    } else {
      tx.set(ref, { action, uid, windowStart, count: 1, createdAt: new Date(now) });
    }
  });
}
