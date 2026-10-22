import test from 'node:test';
import assert from 'node:assert/strict';

import { RELATED_LIMIT, relatedTo } from '../lib/related';
import type { FeedService, Provider } from '../lib/feed-data';

/**
 * Related services: closest first, and never a repeat of what is already there.
 *
 * The strip under a listing is a recommendation, so the two ways it can fail are
 * worth pinning: it can rank a distant service above a near one, and it can fill
 * itself with copies — a catalogue with a dozen similarly-titled rows from
 * similarly-named ServMates used to render three identical cards. These tests
 * use finished cards only, which is the point of the policy living in its own
 * module rather than inside the datastore.
 */

const tone = { from: '#6d8196', to: '#4a4a4a' };

function provider(overrides: Partial<Provider> & { id: string; name: string }): Provider {
  return {
    handle: overrides.id,
    verified: true,
    avatar: tone,
    rating: 4.5,
    reviews: 20,
    responseMins: 15,
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
    startingPriceCentavos: 180_000,
    rating: overrides.provider.rating,
    availability: 'Same day',
    thumbnail: tone,
    glyph: 'sparkle',
    ...overrides,
  };
}

const current = service({
  id: 's-current',
  title: 'Deep clean · two-bedroom condo',
  provider: provider({ id: 'p-rosa', name: 'Rosa Cleaning Co.' }),
});

test('the listing being read is never offered as its own alternative', () => {
  const ids = relatedTo([current], current).map((card) => card.id);
  assert.deepEqual(ids, []);
});

test('neighbours are ranked by category and area before anything else', () => {
  const sameBoth = service({
    id: 's-both',
    title: 'Move-out clean',
    provider: provider({ id: 'p-both', name: 'Both' }),
  });
  const sameCategory = service({
    id: 's-category',
    title: 'Post-renovation clean',
    provider: provider({ id: 'p-category', name: 'Category' }),
    area: 'Imus',
  });
  const sameArea = service({
    id: 's-area',
    title: 'Sink repair',
    provider: provider({ id: 'p-area', name: 'Area' }),
    category: 'Home Repair',
    categoryId: 'home-repair',
  });
  const neither = service({
    id: 's-neither',
    title: 'Birthday photography',
    provider: provider({ id: 'p-neither', name: 'Neither' }),
    category: 'Events',
    categoryId: 'events',
    area: 'Tagaytay',
  });

  const ids = relatedTo([neither, sameArea, sameCategory, sameBoth], current).map((card) => card.id);
  assert.deepEqual(ids, ['s-both', 's-category', 's-area']);
});

test('the fallback reaches the rest of the catalogue rather than returning empty', () => {
  const farAway = service({
    id: 's-far',
    title: 'Errand run',
    provider: provider({ id: 'p-far', name: 'Far' }),
    category: 'Errands',
    categoryId: 'errands',
    area: 'Dasmariñas',
  });
  const ids = relatedTo([farAway], current).map((card) => card.id);
  assert.deepEqual(ids, ['s-far']);
});

test('one listing per ServMate, even when their titles differ', () => {
  const fixit = provider({ id: 'p-fixit', name: 'FixIt Handyman' });
  const first = service({
    id: 's-fixit-1',
    title: 'Handyman visit · small fixes',
    provider: fixit,
    category: 'Home Repair',
    categoryId: 'home-repair',
  });
  const second = service({
    id: 's-fixit-2',
    title: 'Furniture assembly',
    provider: fixit,
    category: 'Home Repair',
    categoryId: 'home-repair',
  });

  // The same person twice is not two alternatives, however different the work.
  const ids = relatedTo([first, second], current).map((card) => card.id);
  assert.deepEqual(ids, ['s-fixit-1']);
});

test('duplicate titles are folded before they are compared', () => {
  const twin = service({
    id: 's-twin',
    title: '  DEEP   clean · two-bedroom condo ',
    provider: provider({ id: 'p-twin', name: 'Twin' }),
  });
  const ids = relatedTo([twin], current).map((card) => card.id);
  assert.deepEqual(ids, []);
});

test('a strip of repeats is shorter, not padded with copies', () => {
  const one = service({
    id: 's-one',
    title: 'Deep clean · two-bedroom condo',
    provider: provider({ id: 'p-one', name: 'Cleaner One' }),
    rating: 5,
  });
  const two = service({
    id: 's-two',
    title: 'Deep clean · two-bedroom condo',
    provider: provider({ id: 'p-two', name: 'Cleaner Two' }),
    rating: 4.9,
  });
  const three = service({
    id: 's-three',
    title: 'Deep clean · two-bedroom condo',
    provider: provider({ id: 'p-three', name: 'Cleaner Three' }),
    rating: 4.8,
  });

  // Three rows that are the same service under different accounts recommend
  // nothing: the honest answer is "nothing else like this yet", not a full strip.
  assert.deepEqual(relatedTo([one, two, three], current), []);
});

test('the strip is capped, and ties follow rating', () => {
  const cards = Array.from({ length: 6 }, (_, index) =>
    service({
      id: `s-${index}`,
      title: `Home clean ${index}`,
      provider: provider({ id: `p-${index}`, name: `Cleaner ${index}`, rating: 4 + index / 10 }),
    }),
  );

  const picked = relatedTo([...cards].reverse(), current);
  assert.equal(picked.length, RELATED_LIMIT);
  assert.deepEqual(
    picked.map((card) => card.id),
    ['s-5', 's-4', 's-3'],
  );
});
