'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The customer's side of closing a job: the ServMate may report the work
 * finished, but only the customer's confirmation completes the booking — and a
 * completed booking is the only thing that can be reviewed (§4.8, §10.9).
 */
export function ConfirmCompletionButton({
  bookingId,
  reference,
}: {
  bookingId: string;
  reference: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'pending'>('idle');
  const [message, setMessage] = useState('');

  async function confirm() {
    if (state === 'pending') return;
    setState('pending');
    setMessage('');
    try {
      const response = await fetch(`/api/bookings/${bookingId}/confirm`, {
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
          typeof body.message === 'string' ? body.message : `Booking ${reference} could not be confirmed.`,
        );
        setState('idle');
        return;
      }
      router.refresh();
    } catch {
      setState('idle');
      setMessage('Check your connection and try again.');
    }
  }

  return (
    <span className="order-action-wrap">
      <button
        type="button"
        className="button button-primary"
        onClick={() => void confirm()}
        disabled={state === 'pending'}
      >
        {state === 'pending' ? 'Confirming…' : 'Confirm the work is done'}
      </button>
      {message && (
        <span className="order-action-error" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </span>
  );
}
