'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChatIcon, ChevronDownIcon, LocationIcon, StarIcon, VerifiedIcon } from '@/app/components/icons';
import { SignOutButton } from '@/app/components/sign-out-button';
import {
  COVERAGE_CHOICES,
  emptyDraft,
  emptyPreviewState,
  parsePreviewState,
  SERVEMATE_PREVIEW_KEY,
  type ServmateDecision,
  type ServmatePreviewState,
  type ServmateProfileDraft,
  type WorkbenchData,
  type WorkbenchRequest,
} from '@/lib/servmate';

const DECISION_LABEL: Record<ServmateDecision, string> = {
  accepted: 'Accepted',
  declined: 'Declined',
};

/**
 * The ServMate workbench.
 *
 * One queue, one listing sheet, one money panel — the three things a provider
 * opens the app to see. Every figure is server-formatted text handed in through
 * `data`, so the first client render matches the server markup exactly and the
 * queue can be re-grouped locally once the device's saved decisions load.
 */
export function ServmateWorkbench({ data, accountName }: { data: WorkbenchData; accountName: string }) {
  const router = useRouter();
  const [state, setState] = useState<ServmatePreviewState>(emptyPreviewState);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const provider = data.provider;

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(SERVEMATE_PREVIEW_KEY) ?? 'null');
      setState(parsePreviewState(stored));
    } catch {
      // Decisions stay in memory for this session when storage is unavailable.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(SERVEMATE_PREVIEW_KEY, JSON.stringify(state));
    } catch {
      // The in-memory decisions still work when storage is unavailable.
    }
  }, [state, ready]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const openRequests = data.requests.filter((request) => request.status === 'requested');
  const waiting = openRequests.filter((request) => !state.decisions[request.id]);
  const handled = data.requests.filter(
    (request) => Boolean(state.decisions[request.id]) || request.status !== 'requested',
  );
  const draft = state.profiles[provider.id];
  const headline = draft?.headline.trim() || provider.headline;

  function updateDraft(patch: Partial<ServmateProfileDraft>) {
    setState((prev) => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [provider.id]: { ...(prev.profiles[provider.id] ?? emptyDraft()), ...patch },
      },
    }));
  }

  function decide(bookingId: string, decision: ServmateDecision) {
    setState((prev) => ({ ...prev, decisions: { ...prev.decisions, [bookingId]: decision } }));
  }

  function undo(bookingId: string) {
    setState((prev) => {
      const decisions = { ...prev.decisions };
      delete decisions[bookingId];
      return { ...prev, decisions };
    });
  }

  return (
    <div className="sm">
      <ServmateBar
        providerName={provider.name}
        providerId={provider.id}
        area={provider.area}
        roster={data.roster}
        accepting={state.accepting}
        menuOpen={menuOpen}
        menuRef={menuRef}
        initial={firstLetter(accountName)}
        accountName={accountName}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onCloseMenu={() => setMenuOpen(false)}
        onAcceptingChange={(accepting) => setState((prev) => ({ ...prev, accepting }))}
        onPreviewChange={(id) => router.push(`/servmate?as=${id}`)}
      />

      <div className="sm-body">
        <section className="sm-identity" aria-label="ServMate">
          <span className="sm-identity-avatar" aria-hidden="true">{firstLetter(provider.name)}</span>
          <div className="sm-identity-copy">
            <h1 className="sm-identity-name">{provider.name}</h1>
            <p className="sm-identity-headline">{headline}</p>
            <p className="sm-identity-meta">
              {provider.handle}
              <span className="sm-dot" aria-hidden="true">·</span>
              <LocationIcon /> {provider.area}
              {provider.verified && (
                <>
                  <span className="sm-dot" aria-hidden="true">·</span>
                  <span className="sm-verified"><VerifiedIcon /> Verified</span>
                </>
              )}
            </p>
            <p className="sm-identity-rating">
              <StarIcon /> {provider.rating.toFixed(1)}
              <span className="sm-rating-count">{provider.reviews.toLocaleString('en-PH')} reviews</span>
            </p>
          </div>
          <Link className="sm-identity-link" href={`/providers/${provider.id}`}>
            See what customers see <span aria-hidden="true">↗</span>
          </Link>
        </section>

        <section className="sm-section" aria-labelledby="sm-profile-title">
          <div className="sm-section-head">
            <h2 className="sm-section-title" id="sm-profile-title">Your public profile</h2>
            {draft && (draft.headline || draft.about || draft.areas.length > 0) && (
              <span className="sm-draft-tag">Edited on this device</span>
            )}
          </div>
          <div className="sm-profile">
            <div className="sm-profile-fields">
              <div className="sm-profile-field">
                <label className="sm-profile-label" htmlFor="sm-headline">Headline</label>
                <input
                  id="sm-headline"
                  className="sm-profile-input"
                  value={draft?.headline ?? ''}
                  maxLength={90}
                  placeholder={provider.headline}
                  onChange={(event) => updateDraft({ headline: event.target.value })}
                />
                <span className="sm-profile-note">
                  One line about what you do. Leave it blank to keep the sample headline.
                </span>
              </div>
              <div className="sm-profile-field">
                <label className="sm-profile-label" htmlFor="sm-about">About</label>
                <textarea
                  id="sm-about"
                  className="sm-profile-textarea"
                  value={draft?.about ?? ''}
                  maxLength={400}
                  rows={4}
                  placeholder="What you do, what to expect, and anything a customer should book ahead for."
                  onChange={(event) => updateDraft({ about: event.target.value })}
                />
                <span className="sm-profile-note sm-profile-count">
                  {Array.from(draft?.about ?? '').length}/400
                </span>
              </div>
              <fieldset className="sm-profile-field sm-profile-areas">
                <legend className="sm-profile-label">Areas you cover</legend>
                <div className="sm-area-row">
                  {COVERAGE_CHOICES.map((area) => {
                    const active = (draft?.areas ?? []).includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        className="sm-area-chip"
                        aria-pressed={active}
                        onClick={() =>
                          updateDraft({
                            areas: active
                              ? (draft?.areas ?? []).filter((value) => value !== area)
                              : [...(draft?.areas ?? []), area],
                          })
                        }
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
                <span className="sm-profile-note">
                  Customers see these on your profile. Pick none to use your listing areas.
                </span>
              </fieldset>
            </div>
            <aside className="sm-profile-preview" aria-label="Profile preview">
              <p className="sm-preview-label">Customers see</p>
              <p className="sm-preview-headline">{headline}</p>
              <p className="sm-preview-about">
                {draft?.about.trim() || 'No description yet. Your listings and areas carry the profile.'}
              </p>
              <p className="sm-preview-areas">
                {(draft?.areas ?? []).length > 0
                  ? (draft?.areas ?? []).join(' · ')
                  : data.listings.map((listing) => listing.area).filter((area, index, all) => all.indexOf(area) === index).join(' · ')}
              </p>
            </aside>
          </div>
          <p className="sm-note">
            Saved on this device only. Publishing a profile to other customers needs a provider API,
            which is still an open decision.
          </p>
        </section>

        <section className="ledger-strip" aria-label="Your standing">
          <dl>
            <div>
              <dt>Waiting on you</dt>
              <dd>{data.standing.waitingLabel}</dd>
            </div>
            <div>
              <dt>Live listings</dt>
              <dd>{data.standing.listingsLabel}</dd>
            </div>
            <div>
              <dt>Rates from</dt>
              <dd>{data.standing.fromLabel}</dd>
            </div>
            <div>
              <dt>Replies in</dt>
              <dd>{data.standing.repliesLabel}</dd>
            </div>
          </dl>
        </section>

        <section className="sm-section" aria-labelledby="sm-queue-title">
          <div className="sm-section-head">
            <h2 className="sm-section-title" id="sm-queue-title">Waiting on you</h2>
            <span className="sm-section-count">{waiting.length}</span>
          </div>

          {!state.accepting && (
            <p className="sm-notice" role="status">
              You are paused for new bookings. Requests already sent still need a decision.
            </p>
          )}

          {waiting.length > 0 ? (
            <ul className="sm-queue">
              {waiting.map((request, index) => (
                <li key={request.id}>
                  <RequestTicket
                    request={request}
                    position={index === 0 ? 'Next up' : `Position ${index + 1}`}
                    onDecide={decide}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="sm-empty">
              <h3>{openRequests.length > 0 ? 'Nothing waiting on you' : 'No requests for these listings'}</h3>
              <p>
                {openRequests.length > 0
                  ? 'Every open request has a decision. Customer-side changes will appear here.'
                  : 'A request sent from the customer side lands here. Book one of these listings from the storefront to watch it arrive.'}
              </p>
              <Link className="sm-empty-link" href="/home">Browse the storefront</Link>
            </div>
          )}
        </section>

        {handled.length > 0 && (
          <section className="sm-section" aria-labelledby="sm-handled-title">
            <div className="sm-section-head">
              <h2 className="sm-section-title" id="sm-handled-title">Handled</h2>
              <span className="sm-section-count">{handled.length}</span>
            </div>
            <ul className="sm-handled">
              {handled.map((request) => {
                const decision = state.decisions[request.id];
                return (
                  <li className="sm-handled-row" key={request.id}>
                    <span className="sm-handled-ref">{request.reference}</span>
                    <span className="sm-handled-title">{request.serviceTitle}</span>
                    <span className="sm-handled-time">{request.receivedLabel}</span>
                    <span className="sm-stamp" data-decision={decision ?? 'withdrawn'}>
                      {decision ? DECISION_LABEL[decision] : 'Withdrawn'}
                    </span>
                    {decision ? (
                      <button type="button" className="sm-undo" onClick={() => undo(request.id)}>
                        Undo
                      </button>
                    ) : (
                      <span className="sm-handled-note">By the customer</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="sm-section" aria-labelledby="sm-listings-title">
          <div className="sm-section-head">
            <h2 className="sm-section-title" id="sm-listings-title">Your listings</h2>
            <span className="sm-section-count">{data.listings.length}</span>
          </div>
          <div className="sm-listings">
            {data.listings.map((listing) => (
              <article className="sm-listing" key={listing.id}>
                <h3 className="sm-listing-title">{listing.title}</h3>
                <dl className="sm-listing-facts">
                  <div>
                    <dt>Category</dt>
                    <span className="sm-leader" />
                    <dd>{listing.category}</dd>
                  </div>
                  <div>
                    <dt>Area</dt>
                    <span className="sm-leader" />
                    <dd><LocationIcon /> {listing.area}</dd>
                  </div>
                  <div>
                    <dt>Turnaround</dt>
                    <span className="sm-leader" />
                    <dd>{listing.availability}</dd>
                  </div>
                  <div className="sm-listing-rate">
                    <dt>Rate from</dt>
                    <span className="sm-leader" />
                    <dd className="sm-listing-price">{listing.fromLabel}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <p className="sm-note">Rates and listings come from the sample catalog; editing them needs a provider API.</p>
        </section>

        <section className="sm-section" aria-labelledby="sm-money-title">
          <div className="sm-section-head">
            <h2 className="sm-section-title" id="sm-money-title">Money and status</h2>
          </div>
          <div className="sm-panels">
            <article className="sm-panel">
              <h3 className="sm-panel-title">Payouts</h3>
              <p className="sm-panel-state" data-state="off">Not enabled</p>
              <p className="sm-panel-note">
                ServEm does not move money yet. When a payment provider supports this marketplace&rsquo;s
                collection, settlement and payout flow, this panel shows settled jobs and payout
                status. Nothing is held on your behalf until then.
              </p>
            </article>
            <article className="sm-panel">
              <h3 className="sm-panel-title">Verification</h3>
              <p className="sm-panel-state" data-state={provider.verified ? 'on' : 'pending'}>
                {provider.verified ? 'Verified ServMate' : 'In review'}
              </p>
              <p className="sm-panel-note">
                {provider.verified
                  ? 'Your identity and skills check is complete, so your listings carry the Verified mark.'
                  : 'Identity and skills checks are still being reviewed. Your listings stay visible without the Verified mark.'}
              </p>
            </article>
          </div>
        </section>

        <p className="sm-foot">
          Design preview · sample ServMates and listings. Accept and Decline are saved on this device
          only; no provider API is connected yet.
        </p>
      </div>
    </div>
  );
}

function RequestTicket({
  request,
  position,
  onDecide,
}: {
  request: WorkbenchRequest;
  position: string;
  onDecide: (bookingId: string, decision: ServmateDecision) => void;
}) {
  return (
    <article className="sm-req">
      <header className="sm-req-top">
        <span className="sm-req-ref">{request.reference}</span>
        <span className="sm-req-position">{position}</span>
        <time className="sm-req-time">{request.receivedLabel}</time>
      </header>
      <h3 className="sm-req-title">{request.serviceTitle}</h3>
      <p className="sm-req-meta">
        {request.category}
        {request.area && (
          <>
            <span className="sm-dot" aria-hidden="true">·</span>
            <LocationIcon /> {request.area}
          </>
        )}
      </p>
      <blockquote className="sm-req-words">{request.message || 'No details given.'}</blockquote>
      <div className="sm-req-foot">
        <Link className="sm-open" href={`/account/messages/${request.id}`}>
          <ChatIcon /> Open conversation
        </Link>
        <div className="sm-req-actions">
          <button type="button" className="sm-decline" onClick={() => onDecide(request.id, 'declined')}>
            Decline
          </button>
          <button type="button" className="sm-accept" onClick={() => onDecide(request.id, 'accepted')}>
            Accept
          </button>
        </div>
      </div>
    </article>
  );
}

function ServmateBar({
  providerName,
  providerId,
  area,
  roster,
  accepting,
  menuOpen,
  menuRef,
  initial,
  accountName,
  onToggleMenu,
  onCloseMenu,
  onAcceptingChange,
  onPreviewChange,
}: {
  providerName: string;
  providerId: string;
  area: string;
  roster: WorkbenchData['roster'];
  accepting: boolean;
  menuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  initial: string;
  accountName: string;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onAcceptingChange: (accepting: boolean) => void;
  onPreviewChange: (id: string) => void;
}) {
  return (
    <header className="sm-bar">
      <div className="sm-bar-inner">
        <span className="sm-brand">
          <span className="sm-brand-mark" aria-hidden="true">S</span>
          <span className="sm-brand-word">servem</span>
          <span className="sm-mode">ServMate</span>
        </span>

        <div className="sm-bar-actions">
          <label className="sm-preview-pick">
            <span className="visually-hidden">Preview this workbench as</span>
            <select value={providerId} onChange={(event) => onPreviewChange(event.target.value)}>
              {roster.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.area}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="sm-toggle"
            aria-pressed={accepting}
            onClick={() => onAcceptingChange(!accepting)}
          >
            <span className="sm-toggle-track" aria-hidden="true"><span className="sm-toggle-thumb" /></span>
            {accepting ? 'Accepting jobs' : 'Paused'}
          </button>

          <div className="sm-account" ref={menuRef}>
            <button
              type="button"
              className="sm-account-trigger"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={onToggleMenu}
            >
              <span className="sm-account-avatar" aria-hidden="true">{initial}</span>
              <span className="sm-account-name">{accountName.split(' ')[0]}</span>
              <span className="sm-account-caret" aria-hidden="true"><ChevronDownIcon /></span>
            </button>
            {menuOpen && (
              <div className="sm-account-menu" role="menu" onMouseLeave={onCloseMenu}>
                <div className="sm-account-id">
                  <strong>Previewing {providerName}</strong>
                  <span>Workbench is a design preview</span>
                </div>
                <Link href={`/providers/${providerId}`} role="menuitem" onClick={onCloseMenu}>
                  Your public profile
                </Link>
                <Link href="/home" role="menuitem" onClick={onCloseMenu}>
                  Switch to customer view
                </Link>
                <div className="sm-account-signout">
                  <SignOutButton className="sm-signout" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function firstLetter(value: string): string {
  const first = Array.from(value.trim())[0];
  return first ? first.toLocaleUpperCase() : 'S';
}
