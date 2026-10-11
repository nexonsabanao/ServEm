import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AccountTabs } from '@/app/components/feed/account-tabs';
import { AppShell } from '@/app/components/feed/app-shell';
import { firstLetter } from '@/lib/feed-data';
import { getSessionProfile } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';
import { formatMonth } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My account — ServEm',
};

/**
 * The account area keeps one compact identity header and section navigation
 * shared across overview, messages, requests, and profile settings.
 * Signed-out visitors are sent to the storefront to sign in.
 */
export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  const bookings = await listBookings(profile.id);
  const summary = summariseBookings(bookings);

  return (
    <AppShell account={{ name: profile.name, email: profile.email }} requestCount={summary.total}>
      <div className="acct">
        <section className="acct-profile" aria-label="Your account">
          <span className="acct-avatar" aria-hidden="true">{firstLetter(profile.name)}</span>
          <div className="acct-id">
            <h1>{profile.name}</h1>
            <p className="acct-email">{profile.email}</p>
            <p className="acct-since">Member since {formatMonth(profile.createdAt)}</p>
          </div>
        </section>
        <AccountTabs />
        {children}
      </div>
    </AppShell>
  );
}


