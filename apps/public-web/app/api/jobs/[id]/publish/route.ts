import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse } from '@/lib/http';
import { publishJobPost } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/:id/publish — publish a draft for private discovery.
 *
 * Publishing makes a job eligible for eligible ServMates only. It never enters
 * the public catalog, and a job that fails validation at publication time is
 * refused rather than published unfindable.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const { id } = await context.params;
    const result = await publishJobPost(account.id, id);

    if (result.ok) return jsonResponse({ job: result.job }, 200);
    if (result.error === 'not_found') {
      return jsonResponse({ message: 'That job was not found.' }, 404);
    }
    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    if (result.error === 'already_published') {
      return jsonResponse({ message: 'That job is already published.' }, 409);
    }
    if (result.error === 'already_booked') {
      return jsonResponse({ message: 'That job is already booked.' }, 409);
    }
    return jsonResponse({ message: 'This job cannot be published again.' }, 409);
  });
}
