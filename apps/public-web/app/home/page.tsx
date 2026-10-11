import { redirect } from 'next/navigation';
import { AppShell } from '@/app/components/feed/app-shell';
import { EcommerceHome } from '@/app/components/feed/ecommerce-home';
import { getSessionAccount, getSessionPreferences } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ServEm — Book local services',
};

type SearchParams = Promise<{ q?: string | string[] }>;

/**
 * The signed-in marketplace home. Guarded on the session server-side so a
 * signed-out visitor is bounced to the storefront with the sign-in dialog
 * open. Lives inside the shared app shell so navigation to Account and back
 * never returns to the public landing page.
 */
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const params = await searchParams;
  const q = firstValue(params.q).slice(0, 80);
  const [bookings, preferences] = await Promise.all([
    listBookings(account.id),
    getSessionPreferences(),
  ]);
  const summary = summariseBookings(bookings);

  return (
    <AppShell account={account} requestCount={summary.total} searchQuery={q}>
      <EcommerceHome
        initialQuery={q}
        initialArea={preferences.defaultArea}
        initialSort={preferences.defaultSort}
      />
    </AppShell>
  );
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

