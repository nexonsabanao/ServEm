'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Accept or pass on one offer.
 *
 * Accepting is the moment a job stops being a job and becomes booked work with
 * a frozen price, so the decision is deliberately a server one: this only asks
 * and reports the answer. The route accepts it exactly once, and every other
 * live offer on the job is withdrawn in the same transaction.
 */
export function OfferActions({
  jobId,
  offerId,
  amountLabel,
  providerName,
}: {
  jobId: string;
  offerId: string;
  amountLabel: string;
  providerName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  const [message, setMessage] = useState('');

  async function act(action: 'accept' | 'decline') {
    if (pending) return;
    setPending(action);
    setMessage('');
    try {
      const response = await fetch(`/api/jobs/${jobId}/offers/${offerId}/${action}`, {
        method: 'POST',
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);
      const body =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : {};

      if (!response.ok) {
        setMessage(
          typeof body.message === 'string'
            ? body.message
            : `That offer from ${providerName} could not be updated.`,
        );
        return;
      }
      router.refresh();
    } catch {
      setMessage('Check your connection and try again.');
    } finally {
      setPending(null);
    }
  }

  return (
    <span className="offer-actions">
      <button
        type="button"
        className="button button-primary offer-accept"
        onClick={() => void act('accept')}
        disabled={pending !== null}
      >
        {pending === 'accept' ? 'Accepting…' : `Accept ${amountLabel}`}
      </button>
      <button
        type="button"
        className="quiet-button"
        onClick={() => void act('decline')}
        disabled={pending !== null}
      >
        {pending === 'decline' ? 'Passing…' : 'Pass'}
      </button>
      {message && (
        <span className="order-action-error" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </span>
  );
}
