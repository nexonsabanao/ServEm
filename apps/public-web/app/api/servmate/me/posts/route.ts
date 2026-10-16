import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { addWorkPost } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

/** POST /api/servmate/me/posts — publish a short work update on your profile. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireServMate();
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await addWorkPost(account.id, { body: body.body, dataUrl: body.dataUrl });
    if (result.ok) return jsonResponse({ post: result.post }, 201);

    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    if (result.error === 'too_many') {
      return jsonResponse({ message: 'You have reached the update limit for now.' }, 409);
    }
    return jsonResponse({ message: 'Open the ServMate workbench first.' }, 404);
  });
}
