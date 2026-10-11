'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AuthDialog } from '@/app/components/auth-dialog';
import { CloseIcon, MenuIcon } from '@/app/components/icons';
import type { Account, AuthMode } from '@/app/components/auth-dialog';
import { CATEGORY_ORDER } from '@/lib/catalog';
import type { Catalog, ServiceSummary } from '@/lib/catalog';

type Props = {
  catalog: Catalog;
  account: Account | null;
  initialQuery: string;
  initialPricing: 'all' | 'fixed' | 'quote';
  initialSort: string;
  initialCategory: string;
  initialNotice: string;
  initialServiceId: string;
  signInIntent: boolean;
};

type Pricing = 'all' | 'fixed' | 'quote';
type Sort = 'recommended' | 'price-low' | 'price-high';

export function Marketplace({
  catalog: initialCatalog,
  account: initialAccount,
  initialQuery,
  initialPricing,
  initialSort,
  initialCategory,
  initialNotice,
  initialServiceId,
  signInIntent,
}: Props) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [query, setQuery] = useState(initialQuery);
  const [pricing, setPricing] = useState<Pricing>(initialPricing);
  const [sort, setSort] = useState<Sort>(
    initialSort === 'price-low' || initialSort === 'price-high' ? initialSort : 'recommended',
  );
  const [category, setCategory] = useState(initialCategory);
  const [selectedService, setSelectedService] = useState<ServiceSummary | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState(initialNotice);
  const [requestMessage, setRequestMessage] = useState('');
  const serviceDialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [nextCursor, setNextCursor] = useState(initialCatalog.nextCursor ?? null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [account, setAccount] = useState(initialAccount);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [bookingCount, setBookingCount] = useState(0);
  const [confirmedBooking, setConfirmedBooking] = useState<{ reference: string } | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // The OAuth callback lands back here with the outcome in the query string.
  // Show it once, then drop it so a refresh or a shared link does not replay it.
  // `signin` is a redirect intent, not something to keep in the address bar.
  useEffect(() => {
    if (!initialNotice && !signInIntent) return;
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ['auth', 'auth_error', 'signin']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [initialNotice, signInIntent]);

  // `/account` bounces signed-out people here, so open the dialog for them.
  useEffect(() => {
    if (!signInIntent || initialAccount) return;
    setAuthMode('signin');
    setAuthOpen(true);
  }, [signInIntent, initialAccount]);

  // A deep link to one service, used by the account area's "Book again" links.
  useEffect(() => {
    if (!initialServiceId) return;
    const service = initialCatalog.items.find((item) => item.id === initialServiceId);
    if (service) openService(service);
    // Runs once for the id the page was rendered with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialServiceId]);

  useEffect(() => {
    if (!account) {
      setBookingCount(0);
      return;
    }
    let cancelled = false;
    fetch('/api/bookings', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled || !isRecord(payload) || !Array.isArray(payload.bookings)) return;
        setBookingCount(payload.bookings.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [account]);

  useEffect(() => {
    const dialog = serviceDialog.current;
    if (!dialog) return;
    if (selectedService && !dialog.open) dialog.showModal();
    if (!selectedService && dialog.open) dialog.close();
  }, [selectedService]);

  const categories = useMemo(() => {
    const available = new Set(
      catalog.items.map((service) => service.category).filter(Boolean) as string[],
    );
    return CATEGORY_ORDER.filter((name) => available.has(name));
  }, [catalog.items]);

  const areas = useMemo(
    () => Array.from(new Set(catalog.items.map((service) => service.area).filter(Boolean) as string[])).sort(),
    [catalog.items],
  );

  const services = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = catalog.items.filter((service) => {
      const matchesQuery = service.title.toLocaleLowerCase().includes(normalizedQuery);
      const matchesPrice =
        pricing === 'all' ||
        (pricing === 'quote' && service.startingPriceCentavos === undefined) ||
        (pricing === 'fixed' && service.startingPriceCentavos !== undefined);
      const matchesCategory = category === 'all' || service.category === category;
      return matchesQuery && matchesPrice && matchesCategory;
    });

    if (sort === 'recommended') return matches;
    return [...matches].sort((a, b) => {
      const aPrice = a.startingPriceCentavos;
      const bPrice = b.startingPriceCentavos;
      if (aPrice === undefined) return bPrice === undefined ? 0 : 1;
      if (bPrice === undefined) return -1;
      return sort === 'price-low' ? aPrice - bPrice : bPrice - aPrice;
    });
  }, [catalog.items, pricing, query, sort, category]);

  const activeFilterCount =
    (category === 'all' ? 0 : 1) + (pricing === 'all' ? 0 : 1) + (query.trim() ? 1 : 0);

  async function refreshCatalog() {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/services', { cache: 'no-store' });
      const nextCatalog = (await response.json()) as Catalog;
      setCatalog(nextCatalog);
      setNextCursor(nextCatalog.nextCursor ?? null);
      if (!response.ok) setNotice(nextCatalog.message ?? 'The catalog could not be refreshed.');
      else setNotice('Services refreshed.');
    } catch {
      setNotice('The services catalog could not be reached. Check your connection and try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function loadMoreServices() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setNotice('');
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      const response = await fetch(`/api/services?${params.toString()}`, { cache: 'no-store' });
      const nextPage = (await response.json()) as Catalog;
      if (!response.ok || nextPage.status !== 'live') {
        setNotice(nextPage.message ?? 'More services could not be loaded. Try again.');
        return;
      }
      const uniqueItems = new Map(catalog.items.map((item) => [item.id, item]));
      for (const item of nextPage.items) uniqueItems.set(item.id, item);
      setCatalog({ status: 'live', items: Array.from(uniqueItems.values()), nextCursor: nextPage.nextCursor });
      setNextCursor(nextPage.nextCursor ?? null);
    } catch {
      setNotice('More services could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
    setNotice('');
  }

  function handleAuthenticated(next: Account) {
    setAccount(next);
    setAuthOpen(false);
    // After a successful password sign-in/up, go straight to the home feed.
    // A full navigation reloads with the fresh session cookie so the server
    // guard on /home can see the account.
    window.location.assign('/home');
  }

  async function signOut() {
    try {
      await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' });
    } catch {
      // The cookie is cleared on the next successful call either way.
    }
    setAccount(null);
    setBookingCount(0);
    setNotice('You are signed out.');
  }

  function openService(service: ServiceSummary) {
    setSelectedService(service);
    setConfirmedBooking(null);
    setBookingError('');
    setNotice('');
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService || isBooking) return;

    setIsBooking(true);
    setBookingError('');

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ serviceId: selectedService.id, message: requestMessage }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};

      if (response.status === 401) {
        setBookingError('Your session ended. Sign in again to send this request.');
        openAuth('signin');
        return;
      }

      if (!response.ok) {
        const fieldErrors = isRecord(body.errors) ? body.errors : {};
        setBookingError(
          typeof fieldErrors.message === 'string'
            ? fieldErrors.message
            : typeof body.message === 'string'
              ? body.message
              : 'That request could not be sent. Try again.',
        );
        return;
      }

      const booking = isRecord(body.booking) ? body.booking : null;
      if (!booking || typeof booking.reference !== 'string') {
        setBookingError('The server returned an unexpected response. Try again.');
        return;
      }

      setConfirmedBooking({ reference: booking.reference });
      setRequestMessage('');
      setBookingCount((count) => count + 1);
    } catch {
      setBookingError('That request could not be sent. Check your connection and try again.');
    } finally {
      setIsBooking(false);
    }
  }

  function closeServiceDialog() {
    serviceDialog.current?.close();
    setSelectedService(null);
    setRequestMessage('');
    setConfirmedBooking(null);
    setBookingError('');
    setNotice('');
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="header-inner shell">            <Link href="/" className="brand" aria-label="ServEm home" translate="no">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span className="brand-word">servem</span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#explore">Browse services</a>
            <a href="#how-it-works">How booking works</a>
            <a href="#providers">For ServMates</a>
          </nav>
          <div className="header-actions">
            {account ? (
              <div className="account-chip">
                <Link href="/account" className="account-chip-link">
                  <span className="account-avatar" aria-hidden="true">{firstLetter(account.name)}</span>
                  <span className="account-name">{account.name}</span>
                  {bookingCount > 0 && (
                    <span className="account-count" title={`${bookingCount} booking requests`}>{bookingCount}</span>
                  )}
                </Link>
                <button type="button" className="text-button account-signout" onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="text-button sign-in-button"
                onClick={() => openAuth('signin')}
              >
                Sign in <span aria-hidden="true">↗</span>
              </button>
            )}
            <details className="mobile-menu" open={menuOpen} onToggle={(event) => setMenuOpen(event.currentTarget.open)}>
              <summary aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}>{menuOpen ? <CloseIcon /> : <MenuIcon />}</summary>
              <nav aria-label="Mobile navigation">
                <a href="#explore" onClick={() => setMenuOpen(false)}>Browse services</a>
                <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How booking works</a>
                <a href="#providers" onClick={() => setMenuOpen(false)}>For ServMates</a>
                {account ? (
                  <>
                    <Link href="/account" onClick={() => setMenuOpen(false)}>My account</Link>
                    <button type="button" onClick={() => { setMenuOpen(false); void signOut(); }}>Sign out</button>
                  </>
                ) : (
                  <button type="button" onClick={() => { setMenuOpen(false); openAuth('signin'); }}>Sign in</button>
                )}
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> LOCAL SERVICES, BOOKED SIMPLY</p>
            <h1 id="hero-title">Good help,<br /><em>right nearby.</em></h1>
            <p className="hero-description">
              Book verified ServMates for the jobs at home and around the neighborhood —
              cleaning, repairs, tutoring, events, and errands.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#explore">
                Browse local services <span aria-hidden="true">↓</span>
              </a>
              <a className="quiet-link" href="#how-it-works">See how booking works</a>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-halo halo-one" />
            <div className="art-halo halo-two" />
            <div className="art-ticket">
              <span className="ticket-perforation" />
              <div className="ticket-head">
                <span className="ticket-brand">ServEm</span>
                <span className="ticket-kind">Work order<span className="ticket-no">#1042</span></span>
              </div>
              <div className="ticket-flags">
                <span className="ticket-tag">Home repair</span>
                <span className="ticket-status"><span /> Scheduled</span>
              </div>
              <span className="ticket-title">Book a ServMate<br />next door.</span>
              <dl className="ticket-ledger">
                <div>
                  <dt>When</dt>
                  <span className="ticket-leader" />
                  <dd>Tue, 3:00 PM</dd>
                </div>
                <div>
                  <dt>Where</dt>
                  <span className="ticket-leader" />
                  <dd>Bacoor, Cavite</dd>
                </div>
                <div>
                  <dt>Rate</dt>
                  <span className="ticket-leader" />
                  <dd>₱1,200 · set rate</dd>
                </div>
              </dl>
              <div className="ticket-total">
                <span>Due after the visit</span>
                <strong>₱1,200</strong>
              </div>
              <div className="ticket-stub">
                <span className="ticket-stub-mark">S</span>
                <span className="ticket-stub-copy">
                  <strong>Verified ServMate</strong>
                  4.9 ★ · 128 jobs done
                </span>
              </div>
            </div>
            <span className="art-mark">S</span>
          </div>
        </section>

        {areas.length > 0 && (
          <div className="coverage-bar">
            <div className="shell coverage-inner">
              <span className="coverage-label"><span className="coverage-ping" aria-hidden="true" /> Now serving</span>
              <ul className="coverage-list">
                {areas.map((area) => <li key={area}>{area}</li>)}
              </ul>
              <span className="coverage-note">More cities opening soon</span>
            </div>
          </div>
        )}

        <section className="catalog-section" id="explore" aria-labelledby="catalog-title">
          <div className="shell">
            <div className="section-heading">
              <div>
                <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> BROWSE BY SERVICE</p>
                <h2 id="catalog-title">What needs doing?</h2>
                <p className="section-description">Vetted ServMates, clear rates, and slots that fit around your day.</p>
              </div>
              <div className="catalog-meta">
                <span className="catalog-count" aria-live="polite">
                  {services.length} {services.length === 1 ? 'service' : 'services'} nearby
                </span>
                {catalog.status === 'preview' && <span className="preview-tag">Design preview</span>}
              </div>
            </div>

            {catalog.status === 'preview' && (
              <div className="preview-notice" role="status">
                <span aria-hidden="true">✳</span>
                <p>{catalog.message}</p>
              </div>
            )}

            {categories.length > 0 && (
              <div className="category-rail" role="group" aria-label="Filter by service category">
                <button
                  type="button"
                  className="category-chip"
                  aria-pressed={category === 'all'}
                  onClick={() => setCategory('all')}
                >
                  All services
                </button>
                {categories.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="category-chip"
                    aria-pressed={category === name}
                    onClick={() => setCategory(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            <form className="catalog-controls" action="/" method="get" role="search" aria-label="Search and filter services">
              <input type="hidden" name="category" value={category} />
              <label className="search-field">
                <span className="search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.4 4.4" /></svg>
                </span>
                <span className="visually-hidden">Search service titles</span>
                <input
                  ref={searchInput}
                  type="search"
                  name="q"
                  autoComplete="off"
                  maxLength={120}
                  placeholder="Try “cleaning”, “aircon”, “math tutor”…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="clear-search"
                    aria-label="Clear search"
                    onClick={() => { setQuery(''); searchInput.current?.focus(); }}
                  ><CloseIcon /></button>
                )}
              </label>
              <label className="filter-select-wrap">
                <span className="visually-hidden">Filter by rate type</span>
                <select name="pricing" value={pricing} onChange={(event) => setPricing(event.target.value as Pricing)}>
                  <option value="all">Any rate</option>
                  <option value="fixed">Set rate</option>
                  <option value="quote">Quote first</option>
                </select>
                <span className="select-chevron" aria-hidden="true">⌄</span>
              </label>
              <label className="filter-select-wrap sort-select-wrap">
                <span className="visually-hidden">Sort services</span>
                <select name="sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                  <option value="recommended">Recommended</option>
                  <option value="price-low">Lowest rate first</option>
                  <option value="price-high">Highest rate first</option>
                </select>
                <span className="select-chevron" aria-hidden="true">⌄</span>
              </label>
            </form>

            {notice && <p className="live-notice" aria-live="polite">{notice}</p>}

            {services.length > 0 ? (
              <div className="service-grid">
                {services.map((service, index) => (
                  <article className={`service-card card-tone-${index % 4}`} key={service.id}>
                    <div className="service-card-art" aria-hidden="true">
                      {service.category && <span className="service-category">{service.category}</span>}
                      <span className="service-glyph">{firstLetter(service.title)}</span>
                      <span className="service-art-line" />
                    </div>
                    <div className="service-card-body">
                      <div className="service-card-meta">
                        <span>{service.startingPriceCentavos === undefined ? 'QUOTE FIRST' : 'SET RATE'}</span>
                        <span className="service-meta-dot" aria-hidden="true">·</span>
                        <span>VERIFIED SERVMATE</span>
                      </div>
                      <h3>{service.title}</h3>
                      <div className="service-card-bottom">
                        <p className="service-price">
                          {service.startingPriceCentavos === undefined
                            ? 'Ask for a quote'
                            : <>From <strong>{formatPhp(service.startingPriceCentavos)}</strong></>}
                          {service.area && <span className="service-area">{service.area}</span>}
                        </p>
                        <button type="button" className="arrow-button" onClick={() => openService(service)} aria-label={`View ${service.title}`}>
                          <span aria-hidden="true">↗</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : catalog.status === 'unavailable' ? (
              <div className="catalog-state catalog-error">
                <span className="state-symbol" aria-hidden="true">↻</span>
                <h3>The catalog is taking a breather.</h3>
                <p>{catalog.message}</p>
                <button type="button" className="button button-secondary" onClick={refreshCatalog} disabled={isRefreshing}>
                  {isRefreshing ? 'Refreshing…' : 'Try again'}
                </button>
              </div>
            ) : (
              <div className="catalog-state">
                <span className="state-symbol" aria-hidden="true">{catalog.items.length === 0 ? '—' : '⌕'}</span>
                <h3>{catalog.items.length === 0 ? 'No services are listed yet.' : 'Nothing matches those filters.'}</h3>
                <p>
                  {catalog.items.length === 0
                    ? 'Local services appear here as soon as nearby ServMates are verified and publish their rates.'
                    : 'Try a shorter search, or clear your filters to see every service nearby.'}
                </p>
                {catalog.items.length > 0 && (
                  <a className="button button-secondary" href="/">Clear search and filters</a>
                )}
              </div>
            )}

            {catalog.status === 'live' && nextCursor && (
              <div className="load-more-wrap">
                <button className="button button-secondary" type="button" onClick={loadMoreServices} disabled={isLoadingMore}>
                  {isLoadingMore ? 'Loading services…' : 'Load more services'}
                </button>
              </div>
            )}

            {services.length > 0 && catalog.status === 'unavailable' && (
              <p className="catalog-footnote">Showing the last catalog response available on this page.</p>
            )}
          </div>
        </section>

        <section className="steps-section shell" id="how-it-works" aria-labelledby="steps-title">
          <div className="steps-intro">
            <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> HOW BOOKING WORKS</p>
            <h2 id="steps-title">From request<br />to done.</h2>
            <p>ServEm keeps the whole visit in one place, so you know who is coming, what they charge, and when they arrive.</p>
          </div>
          <ol className="steps-list">
            <li>
              <span className="step-number">01</span>
              <div><h3>Describe the job</h3><p>Tell us what needs doing, where, and when. Add a photo if it helps explain the work.</p></div>
            </li>
            <li>
              <span className="step-number">02</span>
              <div><h3>Compare local ServMates</h3><p>See verified ServMates near you with their rate, their rating, and their earliest available slot.</p></div>
            </li>
            <li>
              <span className="step-number">03</span>
              <div><h3>Confirm the visit</h3><p>Pick a time that works. Payment runs through the platform once the job is finished.</p></div>
            </li>
          </ol>
        </section>

        <section className="provider-band" id="providers" aria-labelledby="provider-title">
          <div className="shell provider-inner">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> FOR LOCAL SERVMATES</p>
              <h2 id="provider-title">Turn your skills<br />into steady work.</h2>
            </div>
            <div className="provider-copy">
              <p>Set your own rates, choose the jobs you accept, and get paid through the platform once the work is done.</p>
            </div>
          </div>
        </section>

        <section className="faq-section shell" aria-labelledby="faq-title">
          <div className="faq-heading">
            <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> GOOD TO KNOW</p>
            <h2 id="faq-title">A few useful details.</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>Which areas do you cover?<span aria-hidden="true">+</span></summary>
              <p>Cavite is the only area ServEm covers for now. Your address decides which local ServMates can see and accept your request.</p>
            </details>
            <details>
              <summary>How are ServMates vetted?<span aria-hidden="true">+</span></summary>
              <p>Each ServMate completes identity verification and a background check before their first booking. Ratings come only from jobs the platform has confirmed as finished.</p>
            </details>
            <details>
              <summary>Where do these listings come from?<span aria-hidden="true">+</span></summary>
              <p>Live listings come from the public catalog and show only services published by the platform. Listings marked as a design preview are synthetic examples.</p>
            </details>
            <details>
              <summary>Can I send a booking request now?<span aria-hidden="true">+</span></summary>
              <p>Yes. Sign in, describe the job, and the request is saved with a reference code you can quote later. Nothing is charged until the job is done.</p>
            </details>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="account">
        <div className="shell footer-main">
          <div>
            <Link href="/" className="brand footer-brand" aria-label="ServEm home" translate="no">
              <span className="brand-mark" aria-hidden="true">S</span><span className="brand-word">servem</span>
            </Link>
            <p className="footer-tagline">Real help, close to home.</p>
          </div>
          <div className="footer-note">
            <p>ServEm connects households with verified ServMates for local, in-person services.</p>
            <p>Rates, coverage areas, and booking rules are published before you book.</p>
          </div>
          {account ? (
            <Link href="/account" className="footer-sign-in">
              My account <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <button type="button" className="footer-sign-in" onClick={() => openAuth('signup')}>
              Account access <span aria-hidden="true">↗</span>
            </button>
          )}
        </div>
        <div className="shell footer-bottom">
          <span>© ServEm · <Link href="/terms">Terms and conditions</Link></span>
          <span>{activeFilterCount > 1 ? `${activeFilterCount} filters applied` : 'Verified ServMates · Clear rates · Local'}</span>
        </div>
      </footer>

      <dialog
        className="service-dialog"
        ref={serviceDialog}
        aria-labelledby="service-dialog-title"
        onClose={() => { setSelectedService(null); setRequestMessage(''); }}
        onClick={(event) => { if (event.target === serviceDialog.current) closeServiceDialog(); }}
      >
        {selectedService && (
          <div className="dialog-content">
            <div className="dialog-topline">
              <span className="dialog-kicker">
                {selectedService.category ? `${selectedService.category.toUpperCase()} · ` : ''}PUBLISHED SERVICE
              </span>
              <button type="button" className="dialog-close" aria-label="Close service details" onClick={closeServiceDialog}><CloseIcon /></button>
            </div>
            <h2 id="service-dialog-title">{selectedService.title}</h2>
            <p className="dialog-provider">
              Verified ServMate{selectedService.area ? ` · ${selectedService.area}` : ''}
            </p>
            <p className="dialog-price">
              {selectedService.startingPriceCentavos === undefined
                ? 'Ask for a quote'
                : <>From <strong>{formatPhp(selectedService.startingPriceCentavos)}</strong></>}
            </p>
            <dl className="dialog-facts">
              <div><dt>Visit</dt><dd>At your address</dd></div>
              <div><dt>Rate</dt><dd>{selectedService.startingPriceCentavos === undefined ? 'Quoted after details' : 'Set by the ServMate'}</dd></div>
              <div><dt>Payment</dt><dd>After the job is done</dd></div>
            </dl>
            {confirmedBooking ? (
              <div className="booking-confirmed" role="status">
                <span className="booking-confirmed-mark" aria-hidden="true">✓</span>
                <div>
                  <h3>Request sent</h3>
                  <p>
                    Reference <strong>{confirmedBooking.reference}</strong>. The ServMate confirms
                    the visit time, and payment only happens after the job is done.
                  </p>
                </div>
              </div>
            ) : account ? (
              <form onSubmit={submitRequest} className="request-form">
                <label htmlFor="request-message">What needs doing?</label>
                <textarea
                  id="request-message"
                  name="customerMessage"
                  rows={4}
                  maxLength={4000}
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value)}
                  autoComplete="off"
                  aria-invalid={bookingError ? true : undefined}
                  aria-describedby={bookingError ? 'request-error' : undefined}
                  placeholder="Describe the job, the address area, and a time that suits you…"
                />
                {bookingError && <p className="auth-error" id="request-error">{bookingError}</p>}
                <div className="form-footer">
                  <span>{requestMessage.length}/4000</span>
                  <button className="button button-primary" type="submit" disabled={isBooking}>
                    {isBooking ? 'Sending…' : 'Send request'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="dialog-gated-note">
                <span aria-hidden="true">◇</span>
                <div>
                  <p>Sign in to send a booking request. You can review this service without an account.</p>
                  <button type="button" className="button button-primary" onClick={() => openAuth('signin')}>
                    Sign in to request
                  </button>
                </div>
              </div>
            )}
            {notice && <p className="dialog-status" role="status" aria-live="polite">{notice}</p>}
          </div>
        )}
      </dialog>

      {notice && !selectedService && (
        <div className="toast" role="status" aria-live="polite">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><CloseIcon /></button>
        </div>
      )}

      <AuthDialog
        open={authOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstLetter(title: string): string {
  const first = Array.from(title.trim())[0];
  return first ? first.toLocaleUpperCase() : 'S';
}

function formatPhp(centavos: number): string {
  const pesos = Math.floor(centavos / 100);
  const remainder = centavos % 100;
  const groupedPesos = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(pesos);
  return `₱${groupedPesos}${remainder === 0 ? '' : `.${remainder.toString().padStart(2, '0')}`}`;
}
