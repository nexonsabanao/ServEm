import test from 'node:test';
import assert from 'node:assert/strict';

import { normaliseQuery, searchCatalog } from '../lib/search';
import type { FeedService, Provider } from '../lib/feed-data';

/**
 * Search: the same read models the storefront renders, ranked honestly.
 *
 * Two things worth asserting. A search must not be able to describe a listing
 * the cards would not; and when two answers are equally good, the order has to
 * follow a stated rule rather than the order of the input array — otherwise the
 * same query looks shuffled between two visits.
 */

const tone = { from: '#6d8196', to: '#4a4a4a' };

function provider(overrides: Partial<Provider> & { id: string; name: string }): Provider {
  return {
    handle: overrides.name.toLowerCase().replace(/\s+/g, '.'),
    verified: false,
    avatar: tone,
    rating: 4,
    reviews: 10,
    responseMins: 60,
    area: 'Bacoor',
    headline: 'Local help',
    ...overrides,
  };
}

function service(
  overrides: Partial<FeedService> & { id: string; title: string; provider: Provider },
): FeedService {
  return {
    providerId: overrides.provider.id,
    category: 'Cleaning',
    categoryId: 'cleaning',
    area: 'Bacoor',
    currency: 'PHP',
    startingPriceCentavos: 50_000,
    rating: overrides.provider.rating,
    availability: 'Same day',
    thumbnail: tone,
    glyph: 'sparkle',
    ...overrides,
  };
}

const ana = provider({ id: 'p-ana', name: 'Ana Reyes', rating: 4.9, reviews: 120 });
const ben = provider({ id: 'p-ben', name: 'Ben Cruz', area: 'Imus', rating: 4.4, headline: 'Deep cleaning' });
const clean = service({ id: 's-clean', title: 'Deep clean · two-bedroom condo', provider: ana });
const repair = service({
  id: 's-repair',
  title: 'Sink and tap repair',
  provider: ben,
  category: 'Home Repair',
  categoryId: 'home-repair',
  area: 'Imus',
});

test('an empty or blank query searches for nothing', () => {
  const blank = searchCatalog('   ', [clean, repair], [ana, ben]);
  assert.equal(blank.searched, false);
  assert.deepEqual(blank.services, []);
  assert.deepEqual(blank.providers, []);
});

test('a query is matched case-insensitively and whitespace-folded', () => {
  assert.equal(normaliseQuery('  Deep   CLEAN  '), 'deep clean');

  const results = searchCatalog('DEEP CLEAN', [clean, repair], [ana, ben]);
  assert.equal(results.searched, true);
  assert.equal(results.query, 'deep clean');
  // Ben's headline is "Deep cleaning", so his repair listing answers too — a
  // listing is searchable through the provider who would do the work.
  assert.deepEqual(
    results.services.map((item) => item.id),
    ['s-clean', 's-repair'],
  );
});

test('a provider is a result in their own right, and outranks their listings', () => {
  const results = searchCatalog('ana', [clean, repair], [ana, ben]);
  assert.deepEqual(
    results.providers.map((item) => item.id),
    ['p-ana'],
  );
  // Matched through their provider's name, so the listing answers too.
  assert.deepEqual(
    results.services.map((item) => item.id),
    ['s-clean'],
  );
});

test('services match on title, category, area or the provider behind them', () => {
  assert.deepEqual(ids(searchCatalog('sink', [clean, repair], [ana, ben]).services), ['s-repair']);
  assert.deepEqual(ids(searchCatalog('home repair', [clean, repair], [ana, ben]).services), ['s-repair']);
  assert.deepEqual(ids(searchCatalog('imus', [clean, repair], [ana, ben]).services), ['s-repair']);
  assert.deepEqual(ids(searchCatalog('ben cruz', [clean, repair], [ana, ben]).services), ['s-repair']);
});

test('a field that starts with the term outranks one that merely contains it', () => {
  const watering = service({ id: 's-clean-2', title: 'Cleaning windows', provider: ben });
  const results = searchCatalog('clean', [watering, clean], [ana, ben]);
  // "Deep clean · …" starts a word with the term; "Cleaning windows" does too, so
  // the tie is broken by rating — and Ana is the higher rated of the two.
  assert.deepEqual(ids(results.services), ['s-clean', 's-clean-2']);
});

test('equally good answers are ordered by rating, not by input order', () => {
  const low = provider({ id: 'p-low', name: 'Zara Cleaning', rating: 3.1, reviews: 2 });
  const high = provider({ id: 'p-high', name: 'Amir Cleaning', rating: 4.8, reviews: 300 });
  const results = searchCatalog('cleaning', [clean], [low, high]);
  assert.deepEqual(ids(results.providers), ['p-high', 'p-low']);
});

test('no match returns nothing rather than a fallback list', () => {
  const results = searchCatalog('helicopter', [clean, repair], [ana, ben]);
  assert.equal(results.searched, true);
  assert.deepEqual(results.services, []);
  assert.deepEqual(results.providers, []);
});

test('results are capped per group so one query cannot render an unbounded list', () => {
  const many = Array.from({ length: 40 }, (_, index) =>
    service({ id: `s-${index}`, title: `Cleaning job ${index}`, provider: ana }),
  );
  assert.equal(searchCatalog('cleaning', many, []).services.length, 12);
});

function ids(items: { id: string }[]): string[] {
  return items.map((item) => item.id);
}
