import { SearchScreen } from '@/app/components/search/search-screen';
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
 *
 * The frame and the session guard belong to `app/(app)/layout.tsx`; this page
 * is only the query and the answers to it.
 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstValue(params.q).slice(0, 80);

  const [listings, providers] = await Promise.all([listFeedServices(), listProviderCards()]);
  const results = searchCatalog(q, listings, providers);

  return <SearchScreen results={results} />;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
