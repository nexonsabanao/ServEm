import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WorkDocket } from '@/app/components/work-order';
import {
  BagIcon,
  BellIcon,
  ChatIcon,
  DocketIcon,
  GearIcon,
  UserIcon,
} from '@/app/components/icons';
import { SettingsRow } from '@/app/components/settings/settings-screen';
import { getSessionProfile } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';
import { getCatalog } from '@/lib/catalog-source';
import { listConversations } from '@/lib/conversations';
import { formatDayShort } from '@/lib/format';
import { listCustomerJobs } from '@/lib/jobs';
import { listNotifications } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your account — ServEm',
};

/**
 * The account overview: what is happening now, and a door to everywhere else.
 *
 * A person opens this screen to answer one of two questions — is anything moving
 * on my work, or where do I go next — so it shows the live work order and a list
 * of destinations that already carry their own counts. Nothing here explains the
 * product; the screens behind the rows do that when you need them.
 */
export default async function AccountOverview() {
  const account = await getSessionProfile();
  if (!account) redirect('/?signin=1');

  const [bookings, catalog, conversations, jobs, feed] = await Promise.all([
    listBookings(account.id),
    getCatalog(),
    listConversations(account.id),
    listCustomerJobs(account.id),
    listNotifications(account.id),
  ]);
  const summary = summariseBookings(bookings);
  const open = bookings.find((booking) => booking.status === 'requested') ?? null;
  const available = new Map(catalog.items.map((item) => [item.id, item]));
  const recent = bookings.slice(0, 3);

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="current-title">
        <div className="account-section-head">
          <h1 id="current-title">Current request</h1>
          {open && (
            <Link className="account-section-link" href={`/account/messages/${open.id}`}>
              Message ServMate
            </Link>
          )}
        </div>
        <WorkDocket
          booking={open}
          rateCentavos={open ? available.get(open.serviceId)?.startingPriceCentavos : undefined}
        />
      </section>

      <ul className="row-list" aria-label="Your account">
        <SettingsRow
          href="/account/requests"
          label="Requests"
          value={summary.open > 0 ? `${summary.open} open of ${summary.total}` : `${summary.total} sent`}
          icon={BagIcon}
        />
        <SettingsRow
          href="/account/jobs"
          label="Jobs"
          value={jobs.length > 0 ? `${jobs.length} posted` : 'Nothing posted yet'}
          icon={DocketIcon}
        />
        <SettingsRow
          href="/account/messages"
          label="Messages"
          value={
            conversations.length > 0
              ? `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}`
              : 'No conversations yet'
          }
          icon={ChatIcon}
        />
        <SettingsRow
          href="/account/notifications"
          label="Alerts"
          value={feed.unreadCount > 0 ? `${feed.unreadCount} unread` : 'All read'}
          icon={BellIcon}
        />
        <SettingsRow
          href="/account/profile"
          label="Profile"
          value={account.profile.area ? `Area: ${account.profile.area}` : 'Area not set yet'}
          icon={UserIcon}
        />
        <SettingsRow
          href="/account/settings"
          label="Settings"
          value="Account, privacy and display"
          icon={GearIcon}
        />
      </ul>

      {recent.length > 0 && (
        <section className="account-section" aria-labelledby="recent-title">
          <div className="account-section-head">
            <h2 id="recent-title">Recent</h2>
            <Link className="account-section-link" href="/account/requests">
              All requests
            </Link>
          </div>
          <ul className="again-list">
            {recent.map((booking) => {
              const service = available.get(booking.serviceId);
              return (
                <li key={booking.id}>
                  <span className="again-date">{formatDayShort(booking.createdAt)}</span>
                  <span className="again-title">{booking.serviceTitle}</span>
                  {service ? (
                    <Link className="quiet-button" href={`/home?service=${encodeURIComponent(booking.serviceId)}`}>
                      Book again
                    </Link>
                  ) : (
                    <span className="again-unavailable">No longer listed</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
