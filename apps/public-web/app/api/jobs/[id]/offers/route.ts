import { requireSession } from '@/lib/auth';
import { guarded, jsonResponse } from '@/lib/http';
import { listOffersForJob } from '@/lib/offers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs/:id/offers — every offer on one of the account's own jobs.
 *
 * This is the comparison view: each offer's terms with the ServMate behind it,
 * cheapest first, so the customer can see who is offering what. A job belonging
 * to another account answers 404.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return guarded(async () => {
    const account = await requireSession();
    const { id } = await context.params;
    const offers = await listOffersForJob(id, account.id);

    if (!offers) return jsonResponse({ message: 'That job was not found.' }, 404);
    return jsonResponse({ offers }, 200);
  });
}
