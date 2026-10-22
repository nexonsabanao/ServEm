'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { BookmarkIcon, CloseIcon } from '@/app/components/icons';
import { formatFromPrice, formatReplies } from '@/lib/format';
import type { FeedService } from '@/lib/feed-data';
import { useSavedServices } from './use-saved-services';
import { BookingModal } from './booking-modal';
import { ServiceCard, ServiceThumb, StarRating, VerifiedMark } from './service-card';

/** How many saved services fit on the board before it stops being readable. */
const MAX_COMPARE = 4;

/**
 * Saved services, as a decision rather than a list.
 *
 * A bookmark answers "I might want this"; the question that follows is "which
 * one?". So every saved listing is laid out as the same small board: the
 * service, its ServMate, and the six facts a customer actually weighs — rate,
 * rating, replies, area, availability, category — always in that order, so the
 * answer to each question sits in the same place on every card.
 *
 * It is a board of cards rather than a comparison table on purpose. A table was
 * the right shape for four columns on a desktop, but it had to be 660px wide to
 * stay readable, which on a phone meant scrolling sideways to find the second
 * service — the one thing a comparison is for. The cards keep their own width
 * at every size (they never stretch to fill a wide screen), and the fact rows
 * keep the same height, so four of them side by side still read across as a
 * table, and one of them still reads down as a product.
 *
 * The shortlist lives on this device and nowhere else (see `lib/device-store`),
 * so the screen says that instead of implying an account-synced list. Removing a
 * card updates the same store the cards' own bookmark buttons write, through the
 * one hook that owns that list, so the two surfaces cannot disagree.
 *
 * One saved service is not a comparison yet, so it is shown as the ordinary
 * service card rather than a single lonely column.
 */
export function Shortlist({ listings }: { listings: FeedService[] }) {
  const router = useRouter();
  const { saved, ready, remove } = useSavedServices(
    listings.map((listing) => listing.id),
  );
  const [booking, setBooking] = useState<FeedService | null>(null);

  const chosen = saved
    .map((id) => listings.find((listing) => listing.id === id))
    .filter((listing): listing is FeedService => Boolean(listing))
    .slice(0, MAX_COMPARE);

  if (!ready) return <p className="shortlist-loading">Reading this device’s shortlist…</p>;

  if (chosen.length === 0) {
    return (
      <div className="pane-blank">
        <span className="account-empty-mark" aria-hidden="true">
          <BookmarkIcon />
        </span>
        <h1>Your shortlist is empty</h1>
        <p>
          Tap the bookmark on any service to keep it here. Two or more, and this screen lays them
          out side by side.
        </p>
        <Link className="button button-primary" href="/home">
          Browse services
        </Link>
      </div>
    );
  }

  return (
    <div className="shortlist">
      <header className="shortlist-head">
        <div>
          <h1 className="screen-title">Shortlist</h1>
          <p className="screen-sub">
            {chosen.length === 1
              ? 'One saved service. Save another to compare them side by side.'
              : `${chosen.length} saved services, compared on the facts each listing states.`}
          </p>
        </div>
        <span className="shortlist-device">Saved on this device</span>
      </header>

      {chosen.length === 1 ? (
        <div className="shortlist-single">
          <ServiceCard
            service={chosen[0]}
            onBook={setBooking}
            saved
            onToggleSave={() => remove(chosen[0].id)}
          />
        </div>
      ) : (
        <ul className="shortlist-board">
          {chosen.map((service) => (
            <ComparisonCard
              key={service.id}
              service={service}
              onBook={setBooking}
              onRemove={remove}
            />
          ))}
        </ul>
      )}

      {saved.length > chosen.length && (
        <p className="shortlist-overflow">
          Showing {chosen.length} of {saved.length}. Remove one above to make room for another.
        </p>
      )}

      <BookingModal
        service={booking}
        onClose={() => setBooking(null)}
        onBooked={() => {
          setBooking(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * One service on the comparison board.
 *
 * The root is the list item because the board is a `<ul>`: the cards are a set,
 * and the list element is what says so to assistive technology. Its only
 * outward actions are the two a comparison needs — book this one, or take it
 * off the board — so it owns no state and cannot disagree with the list.
 */
function ComparisonCard({
  service,
  onBook,
  onRemove,
}: {
  service: FeedService;
  onBook: (service: FeedService) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="shortlist-card">
      <div className="shortlist-card-top">
        <span className="shortlist-art" aria-hidden="true">
          <ServiceThumb service={service} />
        </span>
        <div className="shortlist-card-copy">
          <h2 className="shortlist-title">
            <Link href={`/services/${service.id}`}>{service.title}</Link>
          </h2>
          <p className="shortlist-provider">
            {service.provider.name}
            {service.provider.verified && <VerifiedMark />}
          </p>
        </div>
        <button
          type="button"
          className="shortlist-remove"
          onClick={() => onRemove(service.id)}
          aria-label={`Remove ${service.title} from your shortlist`}
        >
          <CloseIcon />
        </button>
      </div>

      <dl className="shortlist-facts">
        {factsFor(service).map((fact) => (
          <div className="shortlist-fact" key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="shortlist-card-foot">
        <button type="button" className="svc-book" onClick={() => onBook(service)}>
          Request
        </button>
        <Link className="shortlist-profile" href={`/providers/${service.providerId}`}>
          View ServMate
        </Link>
      </div>
    </li>
  );
}

/**
 * The six questions, in one order for every card.
 *
 * Defined once so a card cannot quietly ask a different set — the comparison
 * only works because row three means the same thing on every service.
 */
function factsFor(service: FeedService): { label: string; value: ReactNode }[] {
  return [
    {
      label: 'Rate',
      value: formatFromPrice(service.startingPriceCentavos),
    },
    {
      label: 'Rating',
      value: <StarRating rating={service.rating} count={service.provider.reviews} />,
    },
    {
      label: 'Replies',
      value:
        service.provider.responseMins > 0
          ? formatReplies(service.provider.responseMins)
          : 'No stated time',
    },
    { label: 'Area', value: service.area },
    { label: 'Availability', value: service.availability || 'Not stated' },
    { label: 'Category', value: service.category },
  ];
}
