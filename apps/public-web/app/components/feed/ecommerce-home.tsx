'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BookmarkIcon, ChevronDownIcon, LocationIcon, SearchIcon } from '@/app/components/icons';
import { BookingModal } from './booking-modal';
import { ServiceCard } from './service-card';
import { useSavedServices } from './use-saved-services';
import { SERVICE_AREAS, type FeedService } from '@/lib/feed-data';
import { SORT_OPTIONS, type SortPreference } from '@/lib/preferences';

/** Category order is fixed so the index reads the same way every visit. */
const CATEGORY_ORDER = ['Cleaning', 'Home Repair', 'Tutoring', 'Events', 'Errands', 'Beauty'];

type Sort = SortPreference;

/** Rate types: a set price, a listing that quotes first, or no filter. */
type Pricing = 'all' | 'fixed' | 'quote';

const PRICING_OPTIONS: { value: Pricing; label: string }[] = [
  { value: 'all', label: 'Any rate' },
  { value: 'fixed', label: 'Set rate' },
  { value: 'quote', label: 'Quote first' },
];

/**
 * One screen of results before the grid asks to show more. The list is loaded
 * whole, so this only decides how much renders at once — the same progressive
 * reveal the storefront used to do from its own catalog page.
 */
const PAGE_SIZE = 12;

/**
 * The signed-in home — a service counter, not a storefront.
 *
 * It opens on the one question a local marketplace has to answer first ("where
 * do you need help?"), then a plain category index with live counts, then the
 * bookable services themselves as work-order tickets. There is no promo banner,
 * no second search box (the shell's top bar already searches), and no invented
 * discounts or sales figures: every figure on a card comes from the listing.
 *
 * This is the one feed both front doors render: the signed-out storefront at
 * `/` hands it `signedOut` plus the dialog opener, and the signed-in `/home`
 * hands it nothing extra. The rate filter and the paginated grid are the same
 * affordances the old storefront carried, kept here so the two URLs cannot
 * drift apart.
 */
export function EcommerceHome({
  listings,
  initialQuery = '',
  initialArea = 'All',
  initialSort = 'fastest',
  initialService = '',
  signedOut = false,
  onSignIn,
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
  /**
   * A listing to open on arrival, from a link like "Book again". The card's own
   * sheet is what opens, so the screen is the same one the button on the card
   * would have produced.
   */
  initialService?: string;
  /** Whether nobody is signed in here, so the sheet gates on sign-in. */
  signedOut?: boolean;
  /** Opens the sign-in dialog, which the storefront around this feed owns. */
  onSignIn?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('All');
  const [area, setArea] = useState(initialArea);
  const [pricing, setPricing] = useState<Pricing>('all');
  const [sort, setSort] = useState<Sort>(initialSort);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [savedOnly, setSavedOnly] = useState(false);
  const [booking, setBooking] = useState<FeedService | null>(null);
  /* Saves live on this device and are shared with the shortlist and search, so
     the list is read and written in one place (`use-saved-services`). Passing
     the catalogue lets that owner drop ids for listings that no longer exist. */
  const { saved, toggle: toggleSave } = useSavedServices(listings.map((service) => service.id));

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialService) return;
    const match = listings.find((service) => service.id === initialService);
    if (match) setBooking(match);
  }, [initialService, listings]);

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
      const matchesRate =
        pricing === 'all' ||
        (pricing === 'quote' && service.startingPriceCentavos === undefined) ||
        (pricing === 'fixed' && service.startingPriceCentavos !== undefined);
      return matchesQuery && matchesCategory && matchesArea && matchesSaved && matchesRate;
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
  }, [listings, query, category, area, pricing, savedOnly, saved, sort]);

  const filtered = Boolean(
    query.trim() || category !== 'All' || area !== 'All' || pricing !== 'all' || savedOnly,
  );

  function showAll() {
    setQuery('');
    setCategory('All');
    setArea('All');
    setPricing('all');
    setSavedOnly(false);
    // Reset in place: on the storefront `/`, "Show all" must not bounce a
    // signed-out visitor through /home and back to the sign-in dialog.
    router.replace(pathname, { scroll: false });
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
      {/*
       * The counter board: the one question that has to be answered first, and
       * a single area control instead of a chip for every town. Eight chips
       * repeated a count beside every area and pushed the first card below the
       * fold; the same choice is one tap here, and the counts stay in the menu.
       *
       * There is no "N local services · Cavite" line above the title: the area
       * control beside it already states where the customer is, and the count
       * is repeated by the result line below the category index. Printing it a
       * third time only pushed the work further down the page.
       */}
      <section className="shop-hero">
        <div className="shop-hero-copy">
          <h1 className="shop-hero-title">Find help nearby.</h1>
        </div>

        <div className="shop-area">
          <span className="shop-area-icon" aria-hidden="true"><LocationIcon /></span>
          <span className="shop-area-copy">
            <span className="shop-area-label">Area</span>
            <span className="shop-area-value">{area === 'All' ? 'All of Cavite' : area}</span>
          </span>
          <span className="shop-area-caret" aria-hidden="true"><ChevronDownIcon /></span>
          <label className="visually-hidden" htmlFor="shop-area">Filter services by area</label>
          <select
            id="shop-area"
            className="shop-area-select"
            value={area}
            onChange={(event) => setArea(event.target.value)}
          >
            <option value="All">All of Cavite ({countIn(category, 'All')})</option>
            {SERVICE_AREAS.map((item) => (
              <option key={item} value={item}>
                {item} ({countIn(category, item)})
              </option>
            ))}
          </select>
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
          <strong>{results.length}</strong> {results.length === 1 ? 'service' : 'services'}
        </p>
        <div className="shop-toolbar-actions">
          <button
            type="button"
            className="shop-saved-toggle"
            aria-pressed={savedOnly}
            aria-label={`Saved services, ${saved.length} saved`}
            onClick={() => setSavedOnly((active) => !active)}
          >
            <BookmarkIcon filled={savedOnly} />
            <span className="shop-saved-label">Saved</span>
            <span className="shop-saved-count">{saved.length}</span>
          </button>
          <div className="shop-sortwrap">
            <label className="visually-hidden" htmlFor="shop-pricing">Rate type</label>
            <select
              id="shop-pricing"
              className="shop-sort"
              value={pricing}
              onChange={(event) => setPricing(event.target.value as Pricing)}
            >
              {PRICING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
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
            <h2>{emptyTitle({ savedOnly, savedCount: saved.length, category, area, pricing, query })}</h2>
            <p>{emptyBody({ savedOnly })}</p>
            <button type="button" className="shop-empty-action" onClick={showAll}>Show all services</button>
          </div>
        ) : (
          <>
            {results.slice(0, visible).map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onBook={setBooking}
                saved={saved.includes(service.id)}
                onToggleSave={toggleSave}
              />
            ))}
            {results.length > visible && (
              <button
                type="button"
                className="shop-load-more"
                onClick={() => setVisible((count) => count + PAGE_SIZE)}
              >
                Load more services
              </button>
            )}
            {filtered && (
              <button type="button" className="shop-reset" onClick={showAll}>
                Show all services
              </button>
            )}
          </>
        )}
      </section>

      <p className="shop-foot">
        <LocationIcon /> Sample listings · pay after the job is done
      </p>

      <BookingModal
        service={booking}
        signedOut={signedOut}
        onSignIn={onSignIn}
        onClose={() => setBooking(null)}
        onBooked={() => router.refresh()}
      />
    </div>
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
  pricing,
  query,
}: {
  savedOnly: boolean;
  savedCount: number;
  category: string;
  area: string;
  pricing: Pricing;
  query: string;
}) {
  if (savedOnly) {
    return savedCount === 0 ? 'No saved services yet' : 'Nothing saved matches';
  }
  if (query.trim()) return `No services match “${query.trim()}”`;
  if (pricing !== 'all') {
    return pricing === 'fixed' ? 'No set-rate services here' : 'No quote-first services here';
  }
  if (category !== 'All' && area !== 'All') return `No ${category} services in ${area}`;
  if (area !== 'All') return `No services in ${area} yet`;
  return `No ${category} services yet`;
}

function emptyBody({ savedOnly }: { savedOnly: boolean }) {
  if (savedOnly) return 'Tap the bookmark on a card to keep it here.';
  return 'Try a wider area, or clear the filters.';
}
