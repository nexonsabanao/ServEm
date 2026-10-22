import type { FeedService } from './feed-data';

/**
 * Which other listings a service page may recommend.
 *
 * This is **policy, not data access**: it takes finished cards and answers with
 * a shortlist, so it lives beside the card builders rather than inside
 * `./servmate-profile`, which owns the reads. Keeping the split means the
 * ranking can be reasoned about — and tested — without a datastore, and a
 * second surface that wants alternatives can reuse it without importing the
 * server-only module.
 *
 * Two rules shape the answer:
 *
 * 1. **Closest first.** Same category in the same area beats same category,
 *    which beats same area, which beats the rest of the catalogue. A small
 *    catalogue runs out of close matches long before it runs out of services,
 *    so the fallback is deliberate: a real alternative three steps away is
 *    still more useful than an empty strip.
 * 2. **Never repeat.** One card per ServMate and one per title (folded, so
 *    spare whitespace and case agree), and the listing being read is excluded
 *    by both id and title. A catalogue can hold a dozen near-identical rows —
 *    seeded duplicate providers are exactly that — and showing them as three
 *    "recommendations" reads as broken rather than helpful. The strip is
 *    allowed to be shorter than `RELATED_LIMIT`: distinct services first,
 *    minimum count second.
 *
 * Ties are broken by rating, then by the catalogue's own order (the sort is
 * stable), so the same catalogue always produces the same strip.
 */

/**
 * How many alternatives the strip offers.
 *
 * Three, not four: the strip is the feed's own three-column grid, so a fourth
 * card would sit alone on a second row with nothing beside it — a shape that
 * reads as a loading glitch rather than a recommendation.
 */
export const RELATED_LIMIT = 3;

/** How close `card` is to the listing being read: 0 closest, 3 the rest. */
function relatedRank(card: FeedService, service: FeedService): number {
  const sameCategory = card.categoryId === service.categoryId;
  const sameArea = card.area === service.area;
  if (sameCategory && sameArea) return 0;
  if (sameCategory) return 1;
  if (sameArea) return 2;
  return 3;
}

/** A title folded for comparison, so `Deep clean ` and `deep clean` agree. */
function titleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** The alternatives for one listing: closest first, distinct by ServMate and title. */
export function relatedTo(catalogue: FeedService[], service: FeedService): FeedService[] {
  const ranked = catalogue
    .filter((card) => card.id !== service.id)
    .map((card) => ({ card, rank: relatedRank(card, service) }))
    .sort((a, b) => a.rank - b.rank || b.card.rating - a.card.rating);

  const providers = new Set<string>();
  const titles = new Set<string>([titleKey(service.title)]);
  const picked: FeedService[] = [];

  for (const { card } of ranked) {
    if (picked.length === RELATED_LIMIT) break;
    const title = titleKey(card.title);
    if (providers.has(card.providerId) || titles.has(title)) continue;
    providers.add(card.providerId);
    titles.add(title);
    picked.push(card);
  }

  return picked;
}
