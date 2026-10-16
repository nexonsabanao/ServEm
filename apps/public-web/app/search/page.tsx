import { redirect } from 'next/navigation';
import { SearchScreen } from '@/app/components/search/search-screen';
import { AppShell } from '@/app/components/feed/app-shell';
import { getSessionAccount } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';
import { searchCatalog } from '@/lib/search';
import { listFeedServices, listProviderCards } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Search — ServEm',
};

type SearchParams = Promise<{ q?: string | string[] }>;

/**
 * Search, as its own screen.
 *
 * The top bar's field is a form that submits here, so this page works before any
 * JavaScript loads and can be linked to, shared or reloaded. It matches the same
 * listings and ServMates the storefront renders, and hands the result to one
 * client component that owns the booking dialog — so an answer can be acted on
 * without going back to Home first.
 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const params = await searchParams;
  const q = firstValue(params.q).slice(0, 80);
  const [bookings, listings, providers] = await Promise.all([
    listBookings(account.id),
    listFeedServices(),
    listProviderCards(),
  ]);

  const results = searchCatalog(q, listings, providers);
  const summary = summariseBookings(bookings);

  return (
    <AppShell account={{ name: account.name }} requestCount={summary.total} searchQuery={q}>
      <SearchScreen results={results} />
    </AppShell>
  );
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
