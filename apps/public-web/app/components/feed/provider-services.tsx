'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocationIcon } from '@/app/components/icons';
import { gradientStyle, type FeedService } from '@/lib/feed-data';
import { formatFromPrice } from '@/lib/format';
import { BookingModal } from './booking-modal';
import { ServiceGlyph } from './service-card';

/**
 * A ServMate's listings on their public page, each one requestable.
 *
 * Requests post to the same `POST /api/bookings` endpoint the storefront uses,
 * so a request sent here lands in that ServMate's workbench queue with the same
 * reference — one path from the customer side to the provider side.
 */
export function ProviderServiceList({ services }: { services: FeedService[] }) {
  const router = useRouter();
  const [booking, setBooking] = useState<FeedService | null>(null);

  return (
    <>
      <ul className="pv-services">
        {services.map((service) => (
          <li className="pv-svc" key={service.id}>
            <span className="pv-svc-art" style={gradientStyle(service.thumbnail)} aria-hidden="true">
              <ServiceGlyph kind={service.glyph} />
            </span>
            <div className="pv-svc-copy">
              <h3 className="pv-svc-title">{service.title}</h3>
              <p className="pv-svc-meta">
                {service.category}
                <span className="pv-dot" aria-hidden="true">·</span>
                <LocationIcon /> {service.area}
                <span className="pv-dot" aria-hidden="true">·</span>
                {service.availability}
              </p>
            </div>
            <p className="pv-svc-price">
              {formatFromPrice(service.startingPriceCentavos)}
              <span>starting</span>
            </p>
            <button type="button" className="pv-svc-request" onClick={() => setBooking(service)}>
              Request
            </button>
          </li>
        ))}
      </ul>

      <BookingModal service={booking} onClose={() => setBooking(null)} onBooked={() => router.refresh()} />
    </>
  );
}
