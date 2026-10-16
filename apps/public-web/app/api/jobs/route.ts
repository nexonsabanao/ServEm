import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { createJobPost } from '@/lib/jobs';
import { consume, tooManyResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs — start a job post.
 *
 * The job is created in `draft`, which is not discoverable: the posting flow
 * collects the description, media, budget, location and schedule before anything
 * is published (§4.4). The author is the session account, never the payload.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();

    // Ten posts an hour is a busy day of hiring; beyond it the account is
    // spraying jobs rather than planning work.
    const post = consume('jobCreate', account.id);
    if (!post.ok) return tooManyResponse(post.retryAfterSeconds);

    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await createJobPost(account.id, body);
    if (!result.ok) {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    return jsonResponse({ job: result.job }, 201);
  });
}
