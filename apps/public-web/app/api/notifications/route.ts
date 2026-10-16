import { requireSession } from '@/lib/auth';
import { guarded, jsonResponse } from '@/lib/http';
import { listNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications — this account's own notifications.
 *
 * The recipient is taken from the session, so a caller can only ever read the
 * records addressed to them. That is the whole of the privacy rule here: a
 * notification about a job is written to the people party to it, and nobody else
 * has a record to read (§16, test 12).
 */
export async function GET() {
  return guarded(async () => {
    const account = await requireSession();
    const feed = await listNotifications(account.id);
    return jsonResponse({ notifications: feed.items, unreadCount: feed.unreadCount }, 200);
  });
}
