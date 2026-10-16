import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse } from '@/lib/http';
import { removeWorkPost } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/servmate/me/posts/:postId — withdraw one of your own updates.
 *
 * The post is marked removed rather than deleted, so what was published stays on
 * the record even though it stops being shown.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireServMate();
    const { postId } = await context.params;
    const result = await removeWorkPost(account.id, postId);
    if (result.ok) return jsonResponse({ removed: postId }, 200);
    return jsonResponse({ message: 'That update was not found.' }, 404);
  });
}
