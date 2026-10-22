import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/app/components/feed/app-shell';
import { getSessionAccount } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

/**
 * The signed-in frame: one owner for the three things every screen below share —
 * who is signed in, how many requests are open, and the shell around them.
 *
 * This is a route group, so nothing here appears in a URL: `/home`,
 * `/search`, `/providers/:id`, `/servmate/*` and `/account/*` are exactly where
 * they were. What changed is who does the work: a page below renders its own
 * content and nothing else, so it cannot forget the frame, repeat the session
 * read or recount the badge, and the session and count are read once for the
 * whole tree instead of once per page (`lib/auth` memoises the read per request,
 * so a page that needs the account for its own queries shares this one).
 *
 * No `metadata` is declared here deliberately — every screen sets its own title,
 * and adding a fallback would rename the tabs that inherited the root layout's.
 */
export default async function SignedInLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const bookings = await listBookings(account.id);

  return (
    <AppShell account={{ name: account.name }} requestCount={summariseBookings(bookings).total}>
      {children}
    </AppShell>
  );
}
