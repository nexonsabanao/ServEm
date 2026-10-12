'use client';

import Link from 'next/link';
import { BookmarkIcon, LocationIcon, StarIcon } from '@/app/components/icons';
import { gradientStyle, type FeedService } from '@/lib/feed-data';
import { formatFromPrice, formatReplies } from '@/lib/format';

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
 * A bookable service as a work-order ticket: who is offering it, where, how
 * fast they reply, and what it starts at. The dotted ledger and the perforated
 * foot carry the same receipt language as the account docket, so the unit of
 * the marketplace reads as a job rather than a product.
 *
 * Only facts the preview data actually holds are shown — no struck-through
 * prices, discount bursts or sales counters, which would be invented urgency.
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
  const replies = provider.responseMins > 0 ? formatReplies(provider.responseMins) : null;

  return (
    <article className="svc-card">
      <div className="svc-card-media">
        <ServiceThumb service={service} />
        <span className="svc-card-cat">{service.category}</span>
      </div>

      <div className="svc-card-body">
        <h3 className="svc-card-title">{service.title}</h3>

        {provider && (
          <p className="svc-card-provider">
            <Link className="svc-card-name" href={`/providers/${provider.id}`}>
              {provider.name}
            </Link>
            {provider.verified && <span className="svc-verified">Verified</span>}
          </p>
        )}

        <dl className="svc-ledger">
          <div>
            <dt>Area</dt>
            <span className="svc-leader" />
            <dd><LocationIcon /> {service.area}</dd>
          </div>
          <div>
            <dt>Rating</dt>
            <span className="svc-leader" />
            <dd><StarIcon /> {service.rating.toFixed(1)}</dd>
          </div>
          <div>
            <dt>Replies</dt>
            <span className="svc-leader" />
            <dd>{replies ?? '—'}</dd>
          </div>
          <div className="svc-ledger-from">
            <dt>From</dt>
            <span className="svc-leader" />
            <dd className="svc-price">{formatFromPrice(service.startingPriceCentavos)}</dd>
          </div>
        </dl>
      </div>

      <div className="svc-card-foot">
        <button type="button" className="svc-book" onClick={() => onBook(service)}>
          Request
        </button>
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
    </article>
  );
}

