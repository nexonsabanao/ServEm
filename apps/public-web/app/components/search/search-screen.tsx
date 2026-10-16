'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRightIcon, SearchIcon, UserIcon } from '@/app/components/icons';
import { BookingModal } from '@/app/components/feed/booking-modal';
import { ServiceCard } from '@/app/components/feed/service-card';
import type { FeedService } from '@/lib/feed-data';
import type { SearchResults } from '@/lib/search';

const RECENT_KEY = 'servem:recent-searches';
/** The same bookmarks the storefront keeps, so a card saved here is saved there. */
const SAVED_KEY = 'servem:saved-services';
const MAX_RECENT = 6;

/**
 * The search screen.
 *
 * One field, the terms you used recently, and the answers as rows and tickets
 * you can act on without leaving the page — the same booking dialog the
 * storefront uses. Results are decided on the server from the query, so a
 * search is a URL you can reload, share or go back to.
 */
export function SearchScreen({ results }: { results: SearchResults }) {
  const router = useRouter();
  const [recent, setRecent] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [booking, setBooking] = useState<FeedService | null>(null);

  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => setSaved(readSaved()), []);

  // Being on a search screen is the strongest sign a term was worth keeping.
  useEffect(() => {
    if (!results.searched) return;
    const next = [results.query, ...readRecent().filter((term) => term !== results.query)].slice(
      0,
      MAX_RECENT,
    );
    writeRecent(next);
    setRecent(next);
  }, [results.searched, results.query]);

  function clearRecent() {
    writeRecent([]);
    setRecent([]);
  }

  function toggleSave(id: string) {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      // The bookmark still holds for this session when storage is unavailable.
    }
  }

  const nothing =
    results.searched && results.services.length === 0 && results.providers.length === 0;

  return (
    <div className="search-screen">
      <h1 className="visually-hidden">Search</h1>

      <form className="search-form" action="/search" method="get" role="search">
        <span className="search-form-icon" aria-hidden="true"><SearchIcon /></span>
        <label className="visually-hidden" htmlFor="search-q">Search services and ServMates</label>
        <input
          id="search-q"
          type="search"
          name="q"
          autoComplete="off"
          maxLength={80}
          defaultValue={results.query}
          placeholder="Search services, areas or ServMates"
          // The whole screen is this field; landing anywhere else would be a detour.
          autoFocus
        />
        <button type="submit" className="search-submit">Search</button>
      </form>

      {recent.length > 0 && (
        <div className="search-recent">
          <span className="search-recent-label">Recent</span>
          {recent.map((term) => (
            <Link key={term} className="search-chip" href={`/search?q=${encodeURIComponent(term)}`}>
              {term}
            </Link>
          ))}
          <button type="button" className="search-clear" onClick={clearRecent}>
            Clear
          </button>
        </div>
      )}

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
                      {provider.verified && <span className="svc-verified">Verified</span>}
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

function readSaved(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]');
    return Array.isArray(stored)
      ? stored.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

function readRecent(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(stored)
      ? stored.filter((term): term is string => typeof term === 'string').slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(terms: string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(terms));
  } catch {
    // Recent searches are a convenience; the screen works without them.
  }
}
