import { requireSession } from '@/lib/auth';
import { guarded, jsonResponse } from '@/lib/http';
import { listCustomerJobs } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

/** GET /api/jobs/mine — the account's own job posts, newest first. */
export async function GET() {
  return guarded(async () => {
    const account = await requireSession();
    const jobs = await listCustomerJobs(account.id);
    return jsonResponse({ jobs }, 200);
  });
}
