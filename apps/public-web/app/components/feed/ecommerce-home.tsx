'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookmarkIcon, LocationIcon, SearchIcon } from '@/app/components/icons';
import { BookingModal } from './booking-modal';
import { ServiceCard } from './service-card';
import { SERVICE_AREAS, type FeedService } from '@/lib/feed-data';
import { SORT_OPTIONS, type SortPreference } from '@/lib/preferences';

const SAVED_SERVICES_KEY = 'servem:saved-services';

/** Category order is fixed so the index reads the same way every visit. */
const CATEGORY_ORDER = ['Cleaning', 'Home Repair', 'Tutoring', 'Events', 'Errands', 'Beauty'];

type Sort = SortPreference;

/**
 * The signed-in home — a service counter, not a storefront.
 *
 * It opens on the one question a local marketplace has to answer first ("where
 * do you need help?"), then a plain category index with live counts, then the
 * bookable services themselves as work-order tickets. There is no promo banner,
 * no second search box (the shell's top bar already searches), and no invented
 * discounts or sales figures: every figure on a card comes from the listing.
 */
export function EcommerceHome({
  listings,
  initialQuery = '',
  initialArea = 'All',
  initialSort = 'fastest',
}: {
  /**
   * Every published listing, read from the store on the server and handed down.
   * The filtering, sorting and counts below are the same work the component
   * always did — it just no longer owns the data.
   */
  listings: FeedService[];
  initialQuery?: string;
  /** The account's saved default area, from Settings. */
  initialArea?: string;
  /** The account's saved default sort, from Settings. */
  initialSort?: Sort;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('All');
  const [area, setArea] = useState(initialArea);
  const [sort, setSort] = useState<Sort>(initialSort);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedReady, setSavedReady] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [booking, setBooking] = useState<FeedService | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(SAVED_SERVICES_KEY) ?? '[]');
      const validIds = new Set(listings.map((service) => service.id));
      if (Array.isArray(stored)) {
        setSaved(stored.filter((id): id is string => typeof id === 'string' && validIds.has(id)));
      }
    } catch {
      // Bookmarks remain usable in this session if browser storage is unavailable.
    } finally {
      setSavedReady(true);
    }
  }, [listings]);

  useEffect(() => {
    if (!savedReady) return;
    try {
      window.localStorage.setItem(SAVED_SERVICES_KEY, JSON.stringify(saved));
    } catch {
      // The in-memory bookmark state still works when storage is unavailable.
    }
  }, [saved, savedReady]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = listings.filter((service) => {
      const matchesQuery =
        !q ||
        service.title.toLowerCase().includes(q) ||
        service.category.toLowerCase().includes(q) ||
        service.area.toLowerCase().includes(q) ||
        service.provider.name.toLowerCase().includes(q);
      const matchesCategory = category === 'All' || service.category === category;
      const matchesArea = area === 'All' || service.area === area;
      const matchesSaved = !savedOnly || saved.includes(service.id);
      return matchesQuery && matchesCategory && matchesArea && matchesSaved;
    });
    const sorted = [...matches];
    switch (sort) {
      case 'fastest':
        sorted.sort(
          (a, b) =>
            (a.provider.responseMins || Infinity) - (b.provider.responseMins || Infinity),
        );
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'price-low':
        sorted.sort((a, b) => (a.startingPriceCentavos ?? Infinity) - (b.startingPriceCentavos ?? Infinity));
        break;
      case 'price-high':
        sorted.sort((a, b) => (b.startingPriceCentavos ?? -Infinity) - (a.startingPriceCentavos ?? -Infinity));
        break;
    }
    return sorted;
  }, [listings, query, category, area, savedOnly, saved, sort]);

  const filtered = Boolean(query.trim() || category !== 'All' || area !== 'All' || savedOnly);

  function showAll() {
    setQuery('');
    setCategory('All');
    setArea('All');
    setSavedOnly(false);
    router.replace('/home', { scroll: false });
  }

  function toggleSave(id: string) {
    setSaved((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function countIn(nextCategory: string, nextArea: string) {
    return listings.filter(
      (service) =>
        (nextCategory === 'All' || service.category === nextCategory) &&
        (nextArea === 'All' || service.area === nextArea),
    ).length;
  }

  return (
    <div className="shop">
      {/* Step one for a local marketplace: where the work happens. */}
      <section className="shop-ask">
        <h1 className="shop-ask-title">Where do you need help?</h1>
        <div className="shop-chips" role="group" aria-label="Filter services by area">
          <AreaChip label="All of Cavite" value="All" area={area} count={countIn(category, 'All')} onSelect={setArea} />
          {SERVICE_AREAS.map((item) => (
            <AreaChip key={item} label={item} value={item} area={area} count={countIn(category, item)} onSelect={setArea} />
          ))}
        </div>
      </section>

      {/* Category index — labels and live counts, no decorative tiles. */}
      <nav className="shop-index" aria-label="Filter services by category">
        <CategoryTab label="All" value="All" category={category} count={countIn('All', area)} onSelect={setCategory} />
        {CATEGORY_ORDER.map((label) => (
          <CategoryTab key={label} label={label} value={label} category={category} count={countIn(label, area)} onSelect={setCategory} />
        ))}
      </nav>

      <section className="shop-toolbar" aria-label="Service results and sorting">
        <p className="shop-result-count" role="status" aria-live="polite">
          {results.length} {results.length === 1 ? 'service' : 'services'}
          {category !== 'All' ? ` · ${category}` : ''}
          {area !== 'All' ? ` · ${area}` : ''}
          {savedOnly ? ' · Saved' : ''}
        </p>
        <div className="shop-toolbar-actions">
          <button
            type="button"
            className="shop-saved-toggle"
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly((active) => !active)}
          >
            <BookmarkIcon filled={savedOnly} />
            <span>Saved</span>
            <span className="shop-saved-count">{saved.length}</span>
          </button>
          <div className="shop-sortwrap">
            <label className="visually-hidden" htmlFor="shop-sort">Sort by</label>
            <select id="shop-sort" className="shop-sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section id="shop-grid" className="shop-grid" aria-label="Services">
        {results.length === 0 ? (
          <div className="shop-empty" role="status">
            <span className="shop-empty-icon" aria-hidden="true"><SearchIcon /></span>
            <h2>{emptyTitle({ savedOnly, savedCount: saved.length, category, area, query })}</h2>
            <p>{emptyBody({ savedOnly, category, area, query })}</p>
            <button type="button" className="shop-empty-action" onClick={showAll}>Show all services</button>
          </div>
        ) : (
          <>
            {results.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onBook={setBooking}
                saved={saved.includes(service.id)}
                onToggleSave={toggleSave}
              />
            ))}
            {filtered && (
              <button type="button" className="shop-reset" onClick={showAll}>
                Show all services
              </button>
            )}
          </>
        )}
      </section>

      <p className="shop-foot">
        <LocationIcon /> Sample listings for design preview — not real ServMates. Pay only after the job is done.
      </p>

      <BookingModal service={booking} onClose={() => setBooking(null)} onBooked={() => router.refresh()} />
    </div>
  );
}

function AreaChip({
  label,
  value,
  area,
  count,
  onSelect,
}: {
  label: string;
  value: string;
  area: string;
  count: number;
  onSelect: (value: string) => void;
}) {
  const active = area === value;
  return (
    <button
      type="button"
      className={`shop-chip ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={() => onSelect(active ? 'All' : value)}
    >
      {label}
      <span className="shop-chip-count">{count}</span>
    </button>
  );
}

function CategoryTab({
  label,
  value,
  category,
  count,
  onSelect,
}: {
  label: string;
  value: string;
  category: string;
  count: number;
  onSelect: (value: string) => void;
}) {
  const active = category === value;
  return (
    <button
      type="button"
      className={`shop-tab ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={() => onSelect(active ? 'All' : value)}
    >
      {label}
      <span className="shop-tab-count">{count}</span>
    </button>
  );
}

function emptyTitle({
  savedOnly,
  savedCount,
  category,
  area,
  query,
}: {
  savedOnly: boolean;
  savedCount: number;
  category: string;
  area: string;
  query: string;
}) {
  if (savedOnly) {
    return savedCount === 0 ? 'No saved services yet' : 'Nothing saved matches these filters';
  }
  if (query.trim()) return `No services match “${query.trim()}”`;
  if (category !== 'All' && area !== 'All') return `No ${category} services in ${area}`;
  if (area !== 'All') return `No services in ${area} yet`;
  return `No ${category} services yet`;
}

function emptyBody({
  savedOnly,
  category,
  area,
}: {
  savedOnly: boolean;
  category: string;
  area: string;
  query: string;
}) {
  if (savedOnly) return 'Tap the bookmark on a service card and it will appear here.';
  if (area !== 'All') return 'Try another area, or clear your filters to see everything nearby.';
  if (category !== 'All') return 'Try another category, or clear your filters to see everything nearby.';
  return 'Clear your filters to see everything nearby.';
}
