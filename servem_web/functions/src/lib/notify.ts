/**
 * In-app notification helper. Writes notifications/{id} docs that only the
 * recipient (and admin) can read per Firestore rules. No email/SMS is sent:
 * there is no verified delivery provider in this project, and faking one
 * would be worse than nothing.
 */
import { db, serverTs } from './firestore';

export type NotificationKind = 'booking' | 'message' | 'system' | 'payout';

export async function notify(
  uid: string,
  kind: NotificationKind,
  title: string,
  body: string,
  bookingId?: string,
): Promise<void> {
  await db.collection('notifications').add({
    uid,
    kind,
    title: title.slice(0, 120),
    body: body.slice(0, 500),
    bookingId: bookingId ?? null,
    read: false,
    createdAt: serverTs(),
  });
}
