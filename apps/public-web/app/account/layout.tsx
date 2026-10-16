import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/app/components/feed/app-shell';
import { getSessionProfile } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My account — ServEm',
};

/**
 * The account area's frame.
 *
 * Nothing here repeats who you are: the shared shell already carries the
 * account, and a name, an email and a join date on top of every screen was
 * noise that pushed the actual content down. The one place those facts belong is
 * Settings, and that is the only place that shows them.
 */
export default async function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/?signin=1');

  const bookings = await listBookings(profile.id);
  const summary = summariseBookings(bookings);

  return (
    <AppShell account={{ name: profile.name }} requestCount={summary.total}>
      {children}
    </AppShell>
  );
}
