import { searchCatalog } from '@/lib/search';
import { listFeedServices, listProviderCards } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

/**
 * A handful of answers for the top-bar combobox.
 *
 * Read-only and scoped to what a signed-out visitor may already see: every
 * listing here is one the public storefront renders, and the ranker is the same
 * `searchCatalog` the search screen uses — a suggestion can never describe a
 * result differently from the page it opens.
 *
 * Four services and three ServMates is a menu, not a results page; the full
 * answer lives at `/search`. Two characters shorter than that is not a query,
 * so the answer is empty rather than the whole catalogue.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);

  if (query.length < 2) {
    return Response.json(
      { services: [], providers: [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [listings, providers] = await Promise.all([listFeedServices(), listProviderCards()]);
  const results = searchCatalog(query, listings, providers);

  return Response.json(
    {
      services: results.services.slice(0, 4).map((service) => ({
        id: service.id,
        title: service.title,
        area: service.area,
      })),
      providers: results.providers.slice(0, 3).map((provider) => ({
        id: provider.id,
        name: provider.name,
        area: provider.area,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
