/**
 * Daily maintenance.
 *
 *  - Sweeps expired rateLimit counters and stale webhookEvents. These docs
 *    are throwaway operational state; deleting them is safe and bounded.
 *  - Audit-log retention is OFF by default and only prunes when
 *    ENABLE_AUDIT_RETENTION='true' (and never more than 2000 docs/day).
 *  - There is deliberately NO email/notification fan-out here: no delivery
 *    provider is configured or verified, and silently "sending" mail that
 *    does not exist would be a fake control. See SECURITY.md.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { db } from './lib/firestore';
import { AUDIT_RETENTION_DAYS, ENABLE_AUDIT_RETENTION, REGION } from './lib/params';

const SWEEP_BATCH = 200;
const MAX_SWEEP_DOCS = 1000;

async function deleteOlderThan(collection: string, field: string, olderThanMs: number, maxDocs: number): Promise<number> {
  let removed = 0;
  const cutoff = Timestamp.fromMillis(olderThanMs);
  while (removed < maxDocs) {
    const snap = await db
      .collection(collection)
      .where(field, '<', cutoff)
      .limit(SWEEP_BATCH)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc: DocumentSnapshot) => batch.delete(doc.ref));
    await batch.commit();
    removed += snap.size;
    if (snap.size < SWEEP_BATCH) break;
  }
  return removed;
}

export const scheduledMaintenance = onSchedule(
  { region: REGION, schedule: 'every 24 hours', timeZone: 'Asia/Manila', timeoutSeconds: 540, memory: '256MiB' },
  async () => {
    const now = Date.now();

    // Disposable fixed-window counters: anything older than 2 days is dead.
    const limits = await deleteOlderThan('rateLimits', 'createdAt', now - 2 * 86_400_000, MAX_SWEEP_DOCS);

    // Webhook idempotency records: keep 180 days, well beyond provider retries.
    const events = await deleteOlderThan('webhookEvents', 'receivedAt', now - 180 * 86_400_000, MAX_SWEEP_DOCS);

    let audit = 0;
    const enabled = (ENABLE_AUDIT_RETENTION.value() ?? '').toLowerCase() === 'true';
    if (enabled) {
      const days = Number.parseInt(AUDIT_RETENTION_DAYS.value(), 10);
      const safeDays = Number.isFinite(days) && days >= 30 ? days : 365;
      audit = await deleteOlderThan('auditLog', 'createdAt', now - safeDays * 86_400_000, MAX_SWEEP_DOCS);
    }

    console.log(`[maintenance] rateLimitsRemoved=${limits} webhookEventsRemoved=${events} auditLogRemoved=${audit} retentionEnabled=${enabled}`);
  },
);
