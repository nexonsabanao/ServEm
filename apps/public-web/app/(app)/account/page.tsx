import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WorkDocket } from '@/app/components/work-order';
import { ChevronRightIcon, GearIcon } from '@/app/components/icons';
import { getSessionProfile } from '@/lib/auth';
import { OPEN_BOOKING_STATUSES, listBookings, summariseBookings } from '@/lib/bookings';
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
 * The account overview: who you are, what is moving, and nothing else.
 *
 * The old screen repeated the shell's navigation as six rows of labels. The
 * frame already goes to Messages, Requests and Jobs, so this page now leads
 * with the answer a person actually opens it for — how many things are open —
 * and shows the live work order underneath. Profile and Settings live on the
 * identity card, where you look for them.
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
  /*
   * The same set the "Open requests" stat counts — requested, confirmed,
   * in progress and awaiting completion. The docket used to look only for a
   * fresh request, so an accepted job read "Nothing booked" beside a count of
   * one; both statements now describe the same bookings.
   */
  const open =
    bookings.find((booking) => OPEN_BOOKING_STATUSES.includes(booking.status)) ?? null;
  const available = new Map(catalog.items.map((item) => [item.id, item]));
  const recent = bookings.slice(0, 3);

  const stats = [
    { href: '/account/requests', value: summary.open, label: 'Open requests' },
    { href: '/account/messages', value: conversations.length, label: 'Messages' },
    { href: '/account/notifications', value: feed.unreadCount, label: 'Unread alerts' },
    { href: '/account/jobs', value: jobs.length, label: 'Jobs posted' },
  ];

  return (
    <div className="account-page">
      {/*
       * The identity card is the page's heading, its way into the profile and
       * the route to Settings. A screen that answers "who am I here" should not
       * need a separate title above it.
       */}
      <header className="account-hero">
        <Link className="account-hero-id" href="/account/profile">
          <span className="account-hero-avatar" aria-hidden="true">{initialFor(account.name)}</span>
          <span className="account-hero-copy">
            <span className="account-hero-eyebrow">Your account</span>
            <h1 className="account-hero-name">{account.name}</h1>
            <span className="account-hero-area">
              {account.profile.area ?? 'Area not set'}
              <span className="account-hero-edit">Edit profile</span>
            </span>
          </span>
        </Link>
        <Link className="account-hero-settings" href="/account/settings">
          <GearIcon />
          Settings
        </Link>
      </header>

      <nav className="account-stats" aria-label="Your work at a glance">
        {stats.map((stat) => (
          <Link key={stat.href} className="account-stat" href={stat.href}>
            <span className="account-stat-value">{stat.value}</span>
            <span className="account-stat-label">{stat.label}</span>
          </Link>
        ))}
      </nav>

      <section className="account-section" aria-labelledby="current-title">
        <div className="account-section-head">
          <h2 id="current-title">{open ? 'Current request' : 'Nothing booked'}</h2>
          {open && (
            <Link className="account-section-link" href={`/account/messages/${open.id}`}>
              Message
              <span className="account-section-link-icon" aria-hidden="true"><ChevronRightIcon /></span>
            </Link>
          )}
        </div>

        {open ? (
          <WorkDocket
            booking={open}
            rateCentavos={available.get(open.serviceId)?.startingPriceCentavos}
          />
        ) : (
          <div className="account-quiet">
            <p>Your next booking will appear here.</p>
            <Link className="quiet-button" href="/home">Find a service</Link>
          </div>
        )}
      </section>

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

function initialFor(value: string): string {
  const first = Array.from(value.trim())[0];
  return first ? first.toLocaleUpperCase() : 'S';
}
