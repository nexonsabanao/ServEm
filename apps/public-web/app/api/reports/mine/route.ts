import { requireSession } from '@/lib/auth';
import { guarded, jsonResponse } from '@/lib/http';
import { listOwnReports } from '@/lib/trust';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/mine — the reports this account filed.
 *
 * The reporter comes from the session, so this route cannot be pointed at
 * somebody else's report queue however it is called. A report is readable by the
 * account that filed it and by the moderation surface, and by nobody else: the
 * account a report names never learns it exists.
 *
 * This is the reading half of the pair that starts at `POST /api/reports`, which
 * is why it lives beside the write rather than under `/api/account` — a report is
 * the marketplace's record, not a private note.
 */
export async function GET() {
  return guarded(async () => {
    const account = await requireSession();
    return jsonResponse({ reports: await listOwnReports(account.id) }, 200);
  });
}
