'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Takes back a pending offer.
 *
 * A withdrawn offer stays on the record so both sides can see what happened to
 * it; the job, meanwhile, goes back to plain `open` for the other ServMates.
 */
export function WithdrawOfferButton({ offerId }: { offerId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'pending'>('idle');
  const [message, setMessage] = useState('');

  async function withdraw() {
    if (state === 'pending') return;
    setState('pending');
    setMessage('');
    try {
      const response = await fetch(`/api/servmate/me/offers/${offerId}/withdraw`, {
        method: 'POST',
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);
      const body =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : {};

      if (!response.ok) {
        setMessage(typeof body.message === 'string' ? body.message : 'That offer was not withdrawn.');
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
        className="quiet-button"
        onClick={() => void withdraw()}
        disabled={state === 'pending'}
      >
        {state === 'pending' ? 'Withdrawing…' : 'Withdraw offer'}
      </button>
      {message && (
        <span className="order-action-error" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </span>
  );
}
