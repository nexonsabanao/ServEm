import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { markNotificationsRead } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/read — mark one notification read, or all of them.
 *
 * With no `id` the whole feed is marked read, which is what the account page's
 * one button does. An id belonging to somebody else answers 404, the same as an
 * id that does not exist.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const body = (await readJsonBody(request)) ?? {};
    const id = typeof body.id === 'string' && body.id !== '' ? body.id : undefined;

    const result = await markNotificationsRead(account.id, id);
    if (!result.ok) return jsonResponse({ message: 'That notification was not found.' }, 404);
    return jsonResponse({ unreadCount: result.unreadCount }, 200);
  });
}
