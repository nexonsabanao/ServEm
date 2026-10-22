'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRightIcon, SearchIcon, UserIcon } from '@/app/components/icons';
import { BookingModal } from '@/app/components/feed/booking-modal';
import { ServiceCard, VerifiedMark } from '@/app/components/feed/service-card';
import { useSavedServices } from '@/app/components/feed/use-saved-services';
import type { FeedService } from '@/lib/feed-data';
import type { SearchResults } from '@/lib/search';

/**
 * The answers to a search.
 *
 * The query itself has one owner: the mode-wide field in the top bar
 * (`search-combobox.tsx`), which also keeps the recent terms. This screen only
 * renders what the server decided the query means, as rows and tickets you can
 * act on without leaving the page — the same booking dialog the storefront
 * uses. Because the query is the URL, a search is a page you can reload, share
 * or go back to, and its field is already filled when you arrive.
 */
export function SearchScreen({ results }: { results: SearchResults }) {
  const router = useRouter();
  const [booking, setBooking] = useState<FeedService | null>(null);
  /* No catalogue is passed: these are one query's matches, so a save that does
     not appear here must not be pruned just because it missed the search. */
  const { saved, toggle: toggleSave } = useSavedServices();

  const nothing =
    results.searched && results.services.length === 0 && results.providers.length === 0;

  return (
    <div className="search-screen">
      <h1 className="phone-title">Search</h1>

      {/*
       * On a phone the shell's top bar belongs to home, so this screen carries
       * its own field. It is a plain GET form in the URL, which means the same
       * search still works before hydration and lands on the same page.
       */}
      <form className="search-inline" action="/search" method="get" role="search">
        <span className="search-inline-icon" aria-hidden="true"><SearchIcon /></span>
        <label className="visually-hidden" htmlFor="search-inline-input">Search services and ServMates</label>
        <input
          id="search-inline-input"
          name="q"
          type="search"
          defaultValue={results.query}
          placeholder="Search services"
          autoComplete="off"
          maxLength={80}
        />
        <button type="submit">Search</button>
      </form>

      {!results.searched && (
        <div className="pane-blank">
          <span className="account-empty-mark" aria-hidden="true"><SearchIcon /></span>
          <h2>What do you need?</h2>
          <p>Search a service, a category, an area, or the name of a ServMate.</p>
          <Link className="button button-secondary" href="/home">Browse everything</Link>
        </div>
      )}

      {nothing && (
        <div className="pane-blank">
          <h2>Nothing matches “{results.query}”</h2>
          <p>Try a shorter word, another area, or browse the whole marketplace.</p>
          <Link className="button button-primary" href="/home">Browse everything</Link>
        </div>
      )}

      {results.providers.length > 0 && (
        <section className="search-group" aria-label="ServMates">
          <div className="search-group-head">
            <h2>ServMates</h2>
            <span className="account-section-note">
              {results.providers.length} {results.providers.length === 1 ? 'match' : 'matches'}
            </span>
          </div>
          <ul className="row-list">
            {results.providers.map((provider) => (
              <li key={provider.id}>
                <Link className="row" href={`/providers/${provider.id}`}>
                  <span className="row-icon" aria-hidden="true"><UserIcon /></span>
                  <span className="row-copy">
                    <span className="row-title">
                      {provider.name}
                      {provider.verified && <VerifiedMark />}
                    </span>
                    <span className="row-value">
                      {provider.area} · {provider.rating.toFixed(1)} ★ ·{' '}
                      {provider.reviews === 1
                        ? '1 review'
                        : `${provider.reviews.toLocaleString('en-PH')} reviews`}
                    </span>
                  </span>
                  <span className="row-chevron" aria-hidden="true"><ChevronRightIcon /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.services.length > 0 && (
        <section className="search-group" aria-label="Services">
          <div className="search-group-head">
            <h2>Services</h2>
            <Link href={`/home?q=${encodeURIComponent(results.query)}`}>
              Filter on Home
            </Link>
          </div>
          <div className="search-services">
            {results.services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onBook={setBooking}
                saved={saved.includes(service.id)}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        </section>
      )}

      <BookingModal service={booking} onClose={() => setBooking(null)} onBooked={() => router.refresh()} />
    </div>
  );
}
