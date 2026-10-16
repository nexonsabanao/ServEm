import { redirect } from 'next/navigation';
import { NotificationsPanel } from '@/app/components/notifications-panel';
import { getSessionAccount } from '@/lib/auth';
import { listNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Notifications — ServEm',
};

/**
 * Everything that happened to this account, newest first.
 *
 * One surface for both sides of the marketplace, because the same account can be
 * both a customer and a ServMate (blueprint §1) and a person does not want two
 * inboxes for one identity. Each row links to the job or booking it is about —
 * the same screen the notification was written from.
 */
export default async function NotificationsPage() {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const feed = await listNotifications(account.id);

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="notifications-title">
        <NotificationsPanel items={feed.items} unreadCount={feed.unreadCount} />
      </section>
    </div>
  );
}
