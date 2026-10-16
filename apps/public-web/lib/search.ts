import type { FeedService, Provider } from './feed-data';

/**
 * Searching the marketplace.
 *
 * A pure function over the same read models the storefront renders, so a result
 * can never describe a listing differently from the card it links to. Two
 * habits are deliberate:
 *
 * 1. **A provider is a result in their own right.** Someone searching a name
 *    wants the person, not the four cards that happen to belong to them, so
 *    providers are matched separately and ranked above services.
 * 2. **Ranking is stated, not implied.** A name that starts with what you typed
 *    is a better answer than one that merely contains it, and a rated provider
 *    beats an unrated one at the same position — otherwise results look shuffled
 *    to anyone who compares two searches.
 */

export type SearchResults = {
  query: string;
  /** True when there was something to search for, so an empty list can say why. */
  searched: boolean;
  services: FeedService[];
  providers: Provider[];
};

const MAX_PER_GROUP = 12;

/** Lower-cased, trimmed, with runs of whitespace folded to one space. */
export function normaliseQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Where a term sits in a field: 0 starts it, 1 contains it, -1 does not. */
function position(haystack: string, needle: string): number {
  const hay = haystack.toLowerCase();
  if (hay === needle) return 0;
  if (hay.startsWith(needle)) return 0;
  return hay.includes(needle) ? 1 : -1;
}

/** The best position a term reaches across the fields it is allowed to match. */
function bestPosition(fields: string[], needle: string): number {
  let best = -1;
  for (const field of fields) {
    const found = position(field, needle);
    if (found === 0) return 0;
    if (found === 1) best = 1;
  }
  return best;
}

export function searchProvider(provider: Provider, needle: string): number {
  return bestPosition([provider.name, provider.handle, provider.area, provider.headline], needle);
}

export function searchService(service: FeedService, needle: string): number {
  return bestPosition(
    [service.title, service.category, service.area, service.provider.name, service.provider.headline],
    needle,
  );
}

export function searchCatalog(
  query: string,
  services: FeedService[],
  providers: Provider[],
): SearchResults {
  const needle = normaliseQuery(query);
  if (needle.length === 0) {
    return { query: '', searched: false, services: [], providers: [] };
  }

  const rank = <T,>(items: T[], match: (item: T) => number, rate: (item: T) => number): T[] =>
    items
      .map((item) => ({ item, at: match(item) }))
      .filter((entry) => entry.at >= 0)
      .sort((a, b) => (a.at !== b.at ? a.at - b.at : rate(b.item) - rate(a.item)))
      .slice(0, MAX_PER_GROUP)
      .map((entry) => entry.item);

  return {
    query: needle,
    searched: true,
    providers: rank(providers, (provider) => searchProvider(provider, needle), (p) => p.rating),
    services: rank(
      services,
      (service) => searchService(service, needle),
      (service) => service.rating,
    ),
  };
}
