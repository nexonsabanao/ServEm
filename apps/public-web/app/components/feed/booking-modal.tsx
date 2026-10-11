'use client';

import { useEffect, useRef, useState } from 'react';
import { CloseIcon, LocationIcon, StarIcon } from '@/app/components/icons';
import { providerById, type FeedService } from '@/lib/feed-data';
import { formatPhp } from '@/lib/format';
import { ServiceThumb, StarRating } from './service-card';

/**
 * Booking request modal for a feed service card.
 *
 * It posts to the same `POST /api/bookings` endpoint the storefront uses, so a
 * request is scoped to the signed-in session server-side and gets a reference.
 * The endpoint derives ownership from the cookie, never the payload.
 */
export function BookingModal({
  service,
  onClose,
  onBooked,
}: {
  service: FeedService | null;
  onClose: () => void;
  onBooked: (reference: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const provider = service ? providerById.get(service.providerId) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (service && !dialog.open) {
      setMessage('');
      setError('');
      setConfirmed(null);
      dialog.showModal();
    }
    if (!service && dialog.open) dialog.close();
  }, [service]);

  async function submit() {
    if (!service || pending) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ serviceId: service.id, serviceTitle: service.title, area: service.area, message }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

      if (response.status === 401) {
        setError('Your session ended. Sign in again to send this request.');
        return;
      }
      if (!response.ok) {
        const fields = body.errors && typeof body.errors === 'object' ? (body.errors as Record<string, unknown>) : {};
        const fieldMessage = typeof fields.message === 'string' ? fields.message : undefined;
        setError(fieldMessage ?? (typeof body.message === 'string' ? body.message : 'That request could not be sent. Try again.'));
        return;
      }
      const booking = body.booking && typeof body.booking === 'object' ? (body.booking as Record<string, unknown>) : null;
      if (!booking || typeof booking.reference !== 'string') {
        setError('The server returned an unexpected response. Try again.');
        return;
      }
      setConfirmed(booking.reference);
      onBooked(booking.reference);
    } catch {
      setError('That request could not be sent. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog className="book-dialog" ref={dialogRef} onClose={onClose} aria-label="Book this service">
      {service && (
        <div className="book-sheet">
          <button type="button" className="book-close" onClick={onClose} aria-label="Close booking dialog"><CloseIcon /></button>

          {confirmed ? (
            <div className="book-confirmed" role="status">
              <span className="book-confirmed-mark" aria-hidden="true">✓</span>
              <h3>Request sent</h3>
              <p>
                Reference <strong>{confirmed}</strong>. {provider?.name ?? 'The ServMate'} confirms the visit
                time, and payment only happens after the job is done.
              </p>
              <button type="button" className="book-primary" onClick={onClose}>Done</button>
            </div>
          ) : (
            <>
              <div className="book-head">
                <ServiceThumb service={service} className="book-thumb" />
                <div>
                  <h3 className="book-title">{service.title}</h3>
                  {provider && <p className="book-provider">{provider.name}</p>}
                  <div className="book-meta">
                    <StarRating rating={service.rating} />
                    <span className="book-area"><LocationIcon /> {service.area}</span>
                  </div>
                  <p className="book-price">{formatPhp(service.startingPriceCentavos)} <span>starting</span></p>
                </div>
              </div>

              <label className="book-label" htmlFor="book-message">What needs doing?</label>
              <textarea
                id="book-message"
                className="book-input"
                rows={4}
                maxLength={4000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Describe the job, the address area, and a time that suits you…"
              />
              {error && <p className="book-error" role="alert">{error}</p>}

              <div className="book-foot">
                <span className="book-note"><StarIcon /> No payment until the job is done</span>
                <button type="button" className="book-primary" onClick={() => void submit()} disabled={pending}>
                  {pending ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
