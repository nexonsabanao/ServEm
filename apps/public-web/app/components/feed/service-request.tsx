'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeedService } from '@/lib/feed-data';
import { QUOTE_PHRASE, formatFromPrice } from '@/lib/format';
import { BookingModal } from './booking-modal';

/**
 * The one action a service page exists for.
 *
 * It is a client leaf because it owns the booking sheet's open state; the page
 * around it stays server-rendered. The rate is printed here rather than in the
 * page so the number and the button that acts on it can never disagree, and a
 * signed-out visitor gets the same sheet the storefront gives them — the form
 * replaced by the sign-in door, never a request they cannot send.
 */
export function ServiceRequest({
  service,
  signedOut,
}: {
  service: FeedService;
  /** Whether there is no session here, so the sheet gates instead of posting. */
  signedOut: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const quoteOnly = service.startingPriceCentavos === undefined;

  return (
    <div className="sd-buy">
      <p className="sd-price">
        {quoteOnly ? (
          /* The same words `formatFromPrice` uses in the fact list below and on
             every card: one fact, one phrasing, owned by `lib/format`. */
          <span className="sd-price-quote">{QUOTE_PHRASE}</span>
        ) : (
          <>
            <span className="sd-price-label">From</span>
            <span className="sd-price-value">{formatFromPrice(service.startingPriceCentavos)}</span>
          </>
        )}
      </p>

      <button type="button" className="sd-request" onClick={() => setOpen(true)}>
        Request this service
      </button>

      <BookingModal
        service={open ? service : null}
        signedOut={signedOut}
        onSignIn={() => window.location.assign('/?signin=1')}
        onClose={() => setOpen(false)}
        onBooked={() => router.refresh()}
      />
    </div>
  );
}
