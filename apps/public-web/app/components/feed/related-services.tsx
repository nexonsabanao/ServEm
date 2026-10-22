'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeedService } from '@/lib/feed-data';
import { BookingModal } from './booking-modal';
import { ServiceCard } from './service-card';
import { useSavedServices } from './use-saved-services';

/**
 * The alternatives under a service, as the ordinary service cards.
 *
 * Same cards, same save button, same booking sheet as the feed — a
 * recommendation that behaved differently from the grid it came from would be a
 * second marketplace to learn. Bookmarks made here land in the device's one
 * saved list, which is what the shortlist reads.
 *
 * An empty strip says so plainly instead of showing an empty grid: with a small
 * catalogue, "nothing else like this yet" is the honest answer.
 */
export function RelatedServices({
  services,
  signedOut,
}: {
  services: FeedService[];
  /** Whether there is no session here, so the sheet gates instead of posting. */
  signedOut: boolean;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState<FeedService | null>(null);
  const { saved, toggle } = useSavedServices();

  if (services.length === 0) {
    return (
      <p className="sd-empty">
        Nothing else like this is listed yet. <Link href="/home">Browse every service</Link>.
      </p>
    );
  }

  return (
    <>
      <div className="shop-grid">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onBook={setBooking}
            saved={saved.includes(service.id)}
            onToggleSave={toggle}
          />
        ))}
      </div>

      <BookingModal
        service={booking}
        signedOut={signedOut}
        onSignIn={() => window.location.assign('/?signin=1')}
        onClose={() => setBooking(null)}
        onBooked={() => {
          setBooking(null);
          router.refresh();
        }}
      />
    </>
  );
}
