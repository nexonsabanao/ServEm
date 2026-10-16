import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse } from '@/lib/http';
import { blockUser, unblockUser } from '@/lib/trust';

export const dynamic = 'force-dynamic';

/**
 * POST /api/blocks/:userId — block an account.
 *
 * Blocking is enforced in both directions by the matching policy, so a blocked
 * ServMate stops seeing this customer's jobs and stops being discoverable to
 * them, without either side being told.
 */
export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const { userId } = await context.params;
    const result = await blockUser(account.id, userId);

    if (result.ok) return jsonResponse({ blocked: true }, 200);
    if (result.error === 'self') {
      return jsonResponse({ message: 'You cannot block your own account.' }, 400);
    }
    return jsonResponse({ message: 'That account was not found.' }, 404);
  });
}

/** DELETE /api/blocks/:userId — remove a block this account placed. */
export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const { userId } = await context.params;
    const result = await unblockUser(account.id, userId);

    if (result.ok) return jsonResponse({ blocked: false }, 200);
    return jsonResponse({ message: 'That account was not found.' }, 404);
  });
}
