'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Catalog, ServiceSummary } from '@/lib/catalog';

type Props = {
  catalog: Catalog;
  initialQuery: string;
  initialPricing: 'all' | 'fixed' | 'quote';
  initialSort: string;
};

export function Marketplace({ catalog: initialCatalog, initialQuery, initialPricing, initialSort }: Props) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [query, setQuery] = useState(initialQuery);
  const [pricing, setPricing] = useState(initialPricing);
  const [sort, setSort] = useState<'recommended' | 'price-low' | 'price-high'>(
    initialSort === 'price-low' || initialSort === 'price-high' ? initialSort : 'recommended',
  );
  const [selectedService, setSelectedService] = useState<ServiceSummary | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const serviceDialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [nextCursor, setNextCursor] = useState(initialCatalog.nextCursor ?? null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const dialog = serviceDialog.current;
    if (!dialog) return;
    if (selectedService && !dialog.open) dialog.showModal();
    if (!selectedService && dialog.open) dialog.close();
  }, [selectedService]);

  const services = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = catalog.items.filter((service) => {
      const matchesQuery = service.title.toLocaleLowerCase().includes(normalizedQuery);
      const matchesPrice =
        pricing === 'all' ||
        (pricing === 'quote' && service.startingPriceCentavos === undefined) ||
        (pricing === 'fixed' && service.startingPriceCentavos !== undefined);
      return matchesQuery && matchesPrice;
    });

    if (sort === 'recommended') return matches;
    return [...matches].sort((a, b) => {
      const aPrice = a.startingPriceCentavos;
      const bPrice = b.startingPriceCentavos;
      if (aPrice === undefined) return bPrice === undefined ? 0 : 1;
      if (bPrice === undefined) return -1;
      return sort === 'price-low' ? aPrice - bPrice : bPrice - aPrice;
    });
  }, [catalog.items, pricing, query, sort]);

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

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (catalog.status === 'preview') {
      setNotice('Preview only: your request was not sent or saved.');
    } else {
      setNotice('Secure sign-in and booking rules are not connected yet. No request was sent.');
    }
  }

  function closeServiceDialog() {
    serviceDialog.current?.close();
    setSelectedService(null);
    setRequestMessage('');
    setNotice('');
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="header-inner shell">
          <Link href="/" className="brand" aria-label="ServEm home">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span>servem</span>
          </Link>
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#explore">Explore services</a>
            <a href="#how-it-works">How it works</a>
            <a href="#providers">For providers</a>
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="text-button sign-in-button"
              onClick={() => setNotice('Secure sign-in is not connected yet. No account data is being collected.')}
            >
              Sign in <span aria-hidden="true">↗</span>
            </button>
            <details className="mobile-menu" open={menuOpen} onToggle={(event) => setMenuOpen(event.currentTarget.open)}>
              <summary aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></summary>
              <nav aria-label="Mobile navigation">
                <a href="#explore" onClick={() => setMenuOpen(false)}>Explore services</a>
                <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
                <a href="#providers" onClick={() => setMenuOpen(false)}>For providers</a>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> THE SERVICE MARKETPLACE</p>
            <h1 id="hero-title">Good work,<br /><em>well matched.</em></h1>
            <p className="hero-description">
              Find independent people with the skills to move your next idea forward.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#explore">
                Explore services <span aria-hidden="true">↓</span>
              </a>
              <a className="quiet-link" href="#how-it-works">See how it works</a>
            </div>
            <div className="hero-note">
              <span className="status-dot" aria-hidden="true" />
              Published offers from independent providers
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-square square-one" />
            <div className="art-square square-two" />
            <div className="art-card">
              <span className="art-card-label">A GOOD PLACE TO START</span>
              <span className="art-card-title">Your next<br />good idea.</span>
              <span className="art-card-footer"><span /> Find the right skills</span>
            </div>
            <span className="art-mark">S</span>
          </div>
        </section>

        <section className="catalog-section" id="explore" aria-labelledby="catalog-title">
          <div className="shell">
            <div className="section-heading">
              <div>
                <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> MAKE SOMETHING HAPPEN</p>
                <h2 id="catalog-title">Start with a service.</h2>
                <p className="section-description">Clear offers, thoughtful work, and room to find the right fit.</p>
              </div>
              <div className="catalog-meta">
                <span className="catalog-count" aria-live="polite">{services.length} offers</span>
                {catalog.status === 'preview' && <span className="preview-tag">Design preview</span>}
              </div>
            </div>

            {catalog.status === 'preview' && (
              <div className="preview-notice" role="status">
                <span aria-hidden="true">✳</span>
                <p>{catalog.message}</p>
              </div>
            )}

            <form className="catalog-controls" action="/" method="get" role="search" aria-label="Search and filter services">
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
                  placeholder="Try “brand”, “website”, “writing”…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="clear-search"
                    aria-label="Clear search"
                    onClick={() => { setQuery(''); searchInput.current?.focus(); }}
                  >×</button>
                )}
              </label>
              <label className="filter-select-wrap">
                <span className="visually-hidden">Filter by pricing</span>
                <select name="pricing" value={pricing} onChange={(event) => setPricing(event.target.value as typeof pricing)}>
                  <option value="all">All pricing</option>
                  <option value="fixed">Starting price</option>
                  <option value="quote">Quote first</option>
                </select>
                <span className="select-chevron" aria-hidden="true">⌄</span>
              </label>
              <label className="filter-select-wrap sort-select-wrap">
                <span className="visually-hidden">Sort services</span>
                <select name="sort" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                  <option value="recommended">Recommended</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
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
                      <span className="service-glyph">{firstLetter(service.title)}</span>
                      <span className="service-art-line" />
                    </div>
                    <div className="service-card-body">
                      <div className="service-card-meta">
                        <span>{service.startingPriceCentavos === undefined ? 'QUOTE FIRST' : 'STARTING PRICE'}</span>
                        <span className="service-meta-dot" aria-hidden="true">·</span>
                        <span>INDEPENDENT PROVIDER</span>
                      </div>
                      <h3>{service.title}</h3>
                      <div className="service-card-bottom">
                        <p className="service-price">
                          {service.startingPriceCentavos === undefined
                            ? 'Ask for a quote'
                            : <>From <strong>{formatPhp(service.startingPriceCentavos)}</strong></>}
                        </p>
                        <button type="button" className="arrow-button" onClick={() => { setSelectedService(service); setNotice(''); }} aria-label={`View ${service.title}`}>
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
                <h3>{catalog.items.length === 0 ? 'No services are listed yet.' : 'No services match that search.'}</h3>
                <p>
                  {catalog.items.length === 0
                    ? 'Published services will appear here when providers are ready to list their work.'
                    : 'Try a shorter search, or clear your filters to see the full list.'}
                </p>
                {catalog.items.length > 0 && <a className="button button-secondary" href="/">Clear search and filters</a>}
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
            <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> THE SHORT VERSION</p>
            <h2 id="steps-title">Good work starts<br />with a clear brief.</h2>
            <p>ServEm brings customers and independent providers together around specific services and clear expectations.</p>
          </div>
          <ol className="steps-list">
            <li>
              <span className="step-number">01</span>
              <div><h3>Explore the offer</h3><p>Review the published service and its starting price or quote-first approach.</p></div>
            </li>
            <li>
              <span className="step-number">02</span>
              <div><h3>Share what you need</h3><p>A booking request flow will be available once secure sign-in and service policies are in place.</p></div>
            </li>
            <li>
              <span className="step-number">03</span>
              <div><h3>Keep the details clear</h3><p>Booking status and next steps belong to the platform and its service rules.</p></div>
            </li>
          </ol>
        </section>

        <section className="provider-band" id="providers" aria-labelledby="provider-title">
          <div className="shell provider-inner">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> FOR INDEPENDENT PROVIDERS</p>
              <h2 id="provider-title">Your craft deserves<br />a clear place to land.</h2>
            </div>
            <div className="provider-copy">
              <p>Provider profiles and service publishing will open after eligibility, verification, and category rules are finalized.</p>
              <span className="provider-status"><span aria-hidden="true" /> Provider setup is in preparation</span>
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
              <summary>Where do these services come from?<span aria-hidden="true">+</span></summary>
              <p>Live listings come from the public catalog and show only services published by the platform. Design-preview listings are synthetic examples and are labeled as such.</p>
            </details>
            <details>
              <summary>Can I send a booking request now?<span aria-hidden="true">+</span></summary>
              <p>Not yet. Secure sign-in and approved booking policies are still being connected. This website will not claim a request was sent when it was not.</p>
            </details>
            <details>
              <summary>How are provider accounts handled?<span aria-hidden="true">+</span></summary>
              <p>Provider access depends on server-side account status and verification. The website cannot grant provider permissions by itself.</p>
            </details>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="account">
        <div className="shell footer-main">
          <div>
            <Link href="/" className="brand footer-brand" aria-label="ServEm home">
              <span className="brand-mark" aria-hidden="true">S</span><span>servem</span>
            </Link>
            <p className="footer-tagline">A clearer start for good work.</p>
          </div>
          <div className="footer-note">
            <p>ServEm is a marketplace connecting customers with independent service providers.</p>
            <p>Policies and account tools will be published before they are needed.</p>
          </div>
          <button type="button" className="footer-sign-in" onClick={() => setNotice('Account access is not connected yet.')}>Account access <span aria-hidden="true">↗</span></button>
        </div>
        <div className="shell footer-bottom">
          <span>© ServEm</span>
          <span>Built around clear offers and careful access.</span>
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
              <span className="dialog-kicker">PUBLISHED SERVICE</span>
              <button type="button" className="dialog-close" aria-label="Close service details" onClick={closeServiceDialog}>×</button>
            </div>
            <h2 id="service-dialog-title">{selectedService.title}</h2>
            <p className="dialog-provider">Offered by an independent provider</p>
            <p className="dialog-price">
              {selectedService.startingPriceCentavos === undefined
                ? 'Request a quote'
                : <>Starting at <strong>{formatPhp(selectedService.startingPriceCentavos)}</strong></>}
            </p>
            {catalog.status === 'preview' ? (
              <>
                <div className="dialog-preview-note">Preview only. Nothing here contacts a provider or creates a booking.</div>
                <form onSubmit={submitRequest} className="request-form">
                  <label htmlFor="request-message">What are you working on?</label>
                  <textarea
                    id="request-message"
                    name="customerMessage"
                    rows={4}
                    maxLength={4000}
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    placeholder="Describe your project…"
                  />
                  <div className="form-footer">
                    <span>{requestMessage.length}/4000</span>
                    <button className="button button-primary" type="submit" disabled={!requestMessage.trim()}>
                      Preview request
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="dialog-gated-note">
                <span aria-hidden="true">◇</span>
                <p>Secure sign-in and booking policies are not connected yet. You can review this offer, but requests are not available.</p>
              </div>
            )}
            {notice && <p className="dialog-status" role="status" aria-live="polite">{notice}</p>}
          </div>
        )}
      </dialog>

      {notice && !selectedService && (
        <div className="toast" role="status" aria-live="polite">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button>
        </div>
      )}
    </>
  );
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
