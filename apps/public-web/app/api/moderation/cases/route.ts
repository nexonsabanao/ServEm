import { guarded, jsonResponse } from '@/lib/http';
import { requireModerator } from '@/lib/moderation-access';
import { listCases } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/moderation/cases — the operator's work queue.
 *
 * Open reports and open disputes, oldest first, so a person works through them in
 * the order they arrived. Closed reports drop off the queue (their audit rows stay
 * readable on the case), which is what makes this a queue rather than an archive.
 *
 * The gate is `requireModerator`, which throws the same `404` for an absent
 * credential, a wrong one and a switched-off surface. There is no session account
 * involved at all: this is the one surface in the app that is not answered from a
 * customer login, which is exactly what the threat model asked for.
 */
export async function GET() {
  return guarded(async () => {
    await requireModerator();
    const queue = await listCases();
    return jsonResponse({ reports: queue.reports, disputes: queue.disputes }, 200);
  });
}
