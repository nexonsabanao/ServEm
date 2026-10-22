'use client';

import Link from 'next/link';
import {
  BookmarkIcon,
  ChevronRightIcon,
  LocationIcon,
  StarIcon,
  VerifiedIcon,
} from '@/app/components/icons';
import { gradientStyle, type FeedService } from '@/lib/feed-data';
import { QUOTE_PHRASE, formatFromPrice } from '@/lib/format';

/** The glyph drawn on a service thumbnail so it is not a bare gradient. */
export function ServiceGlyph({ kind }: { kind: FeedService['glyph'] }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="svc-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {kind === 'sparkle' && (
        <>
          <path d="M24 10l2.6 6.4L33 19l-6.4 2.6L24 28l-2.6-6.4L15 19l6.4-2.6Z" {...common} />
          <path d="M34 30l1.4 3.2 3.2 1.4-3.2 1.4L34 39l-1.4-3.2-3.2-1.4 3.2-1.4Z" {...common} />
        </>
      )}
      {kind === 'wrench' && (
        <>
          <path d="M31 10a6 6 0 0 0-5.2 9L16 28.8a4.5 4.5 0 1 0 3.2 3.2L29 22.2A6 6 0 1 0 31 10Zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" {...common} />
        </>
      )}
      {kind === 'book' && (
        <>
          <path d="M12 14a3 3 0 0 1 3-3h8v28h-8a3 3 0 0 1-3-3Z" {...common} />
          <path d="M36 14a3 3 0 0 0-3-3h-8v28h8a3 3 0 0 0 3-3Z" {...common} />
          <path d="M23 11v28" {...common} />
        </>
      )}
      {kind === 'camera' && (
        <>
          <path d="M10 18a3 3 0 0 1 3-3h4l2-3h10l2 3h4a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3Z" {...common} />
          <circle cx="24" cy="27" r="6" {...common} />
        </>
      )}
      {kind === 'scissors' && (
        <>
          <circle cx="15" cy="35" r="4" {...common} />
          <circle cx="33" cy="35" r="4" {...common} />
          <path d="M17 32 32 11M31 32 16 11" {...common} />
        </>
      )}
      {kind === 'box' && (
        <>
          <path d="M10 17 24 9l14 8v14L24 39 10 31Z" {...common} />
          <path d="M10 17l14 8 14-8M24 25v14" {...common} />
        </>
      )}
    </svg>
  );
}

export function ServiceThumb({ service, className = '' }: { service: FeedService; className?: string }) {
  return (
    <div className={`svc-thumb ${className}`} style={gradientStyle(service.thumbnail)} aria-hidden="true">
      <ServiceGlyph kind={service.glyph} />
    </div>
  );
}

export function StarRating({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="stars" aria-label={`Rated ${rating} out of 5`}>
      <span className="stars-icon"><StarIcon /></span>
      <span className="stars-value">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="stars-count">({count})</span>}
    </span>
  );
}

/**
 * The verified mark, in one place.
 *
 * A ServMate's verification appears on a Home card, a search row and a
 * shortlist column; all three draw this same 14px badge with the same
 * accessible name. Two surfaces used to put the word "Verified" inside this
 * class after the card had turned it into an icon slot, which spilled out of
 * the badge — so the mark is defined once here instead of once per screen.
 */
export function VerifiedMark() {
  return (
    <span className="svc-verified" title="Verified ServMate">
      <VerifiedIcon />
      <span className="visually-hidden">Verified ServMate</span>
    </span>
  );
}

/**
 * A bookable service as a printed ticket: a short colour band, the service's
 * name, one line of facts, and a perforated footer carrying the only two things
 * a person needs to act — what it costs, and the request.
 *
 * The ticket opens the service's own page: the name and the picture are links,
 * which is where a customer reads the full listing before deciding. They are two
 * links to one destination because the picture is the larger target on a phone;
 * the picture's link is hidden from assistive technology and the tab order so the
 * title stays the single accessible way in. The save button rides above the
 * picture rather than inside the link, because a button inside an anchor is not
 * something a browser can honour.
 *
 * The reply speed that used to sit on the card is gone. It still decides the
 * "Fastest reply" sort, but as a third fact beside the rating and the area it
 * was noise on every card; the ServMate's page is where the detail belongs.
 */
export function ServiceCard({
  service,
  onBook,
  saved,
  onToggleSave,
}: {
  service: FeedService;
  onBook: (service: FeedService) => void;
  saved: boolean;
  onToggleSave: (id: string) => void;
}) {
  const provider = service.provider;
  const quoteOnly = service.startingPriceCentavos === undefined;

  return (
    <article className="svc-card">
      <div className="svc-card-media">
        <Link
          className="svc-card-art"
          href={`/services/${service.id}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <ServiceThumb service={service} />
        </Link>
        <span className="svc-card-cat">{service.category}</span>
        <button
          type="button"
          className="svc-save"
          aria-label={saved ? `Remove ${service.title} from saved` : `Save ${service.title}`}
          aria-pressed={saved}
          onClick={() => onToggleSave(service.id)}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>

      <div className="svc-card-body">
        <h3 className="svc-card-title">
          <Link href={`/services/${service.id}`}>{service.title}</Link>
        </h3>

        {provider && (
          <p className="svc-card-provider">
            <Link className="svc-card-name" href={`/providers/${provider.id}`}>
              {provider.name}
            </Link>
            {provider.verified && <VerifiedMark />}
          </p>
        )}

        <p className="svc-card-meta">
          <StarRating rating={service.rating} />
          <span className="svc-meta-sep" aria-hidden="true" />
          <span className="svc-card-area">
            <LocationIcon />
            {service.area}
          </span>
        </p>

        <div className="svc-card-ticket">
          {quoteOnly ? (
            <p className="svc-price is-quote">{QUOTE_PHRASE}</p>
          ) : (
            <p className="svc-price-row">
              <span className="svc-price-from">From</span>
              <span className="svc-price">{formatFromPrice(service.startingPriceCentavos)}</span>
            </p>
          )}

          <button type="button" className="svc-book" onClick={() => onBook(service)}>
            Request
            <span className="svc-book-arrow" aria-hidden="true"><ChevronRightIcon /></span>
          </button>
        </div>
      </div>
    </article>
  );
}
