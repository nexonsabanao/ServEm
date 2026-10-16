import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse } from '@/lib/http';
import { cancelJobPost } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/:id/cancel — close an open job.
 *
 * Cancelling also withdraws the offers on it, in the same transaction, so no
 * ServMate is left holding a live offer on work that no longer exists.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const { id } = await context.params;
    const result = await cancelJobPost(account.id, id);

    if (result.ok) return jsonResponse({ job: result.job }, 200);
    if (result.error === 'not_found') {
      return jsonResponse({ message: 'That job was not found.' }, 404);
    }
    return jsonResponse({ message: 'That job is already closed.' }, 409);
  });
}
