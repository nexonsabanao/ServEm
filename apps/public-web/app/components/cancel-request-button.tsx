'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Withdraws one request. The server owns the decision — this only reports what
 * it said, and refreshes the page data so the row shows its real new state.
 */
export function CancelRequestButton({ bookingId, reference }: { bookingId: string; reference: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [message, setMessage] = useState('');

  async function cancel() {
    setState('pending');
    setMessage('');
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};

      if (!response.ok) {
        setState('failed');
        setMessage(
          typeof body.message === 'string'
            ? body.message
            : `Request ${reference} could not be withdrawn. Try again.`,
        );
        return;
      }

      setState('idle');
      router.refresh();
    } catch {
      setState('failed');
      setMessage(`Request ${reference} could not be withdrawn. Check your connection and try again.`);
    }
  }

  return (
    <span className="order-action-wrap">
      <button
        type="button"
        className="quiet-button"
        onClick={() => void cancel()}
        disabled={state === 'pending'}
        aria-label={`Withdraw request ${reference}`}
      >
        {state === 'pending' ? 'Withdrawing…' : 'Withdraw'}
      </button>
      {message && (
        <span className="order-action-error" role="status" aria-live="polite">{message}</span>
      )}
    </span>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
