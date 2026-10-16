'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The ServMate's half of a booked job.
 *
 * Starting it and reporting it finished are the only two moves this side owns:
 * the customer has to confirm the work before it is actually completed, and the
 * server refuses any move that is not the next one.
 */
export function ProviderWorkActions({
  bookingId,
  status,
  title,
}: {
  bookingId: string;
  status: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'start' | 'complete' | null>(null);
  const [message, setMessage] = useState('');

  async function act(action: 'start' | 'complete') {
    if (pending) return;
    setPending(action);
    setMessage('');
    try {
      const response = await fetch(`/api/bookings/${bookingId}/${action}`, {
        method: 'POST',
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);
      const body =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : {};

      if (!response.ok) {
        setMessage(typeof body.message === 'string' ? body.message : `“${title}” could not be updated.`);
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
    <span className="order-action-group">
      {status === 'confirmed' && (
        <button
          type="button"
          className="button button-primary"
          onClick={() => void act('start')}
          disabled={pending !== null}
        >
          {pending === 'start' ? 'Starting…' : 'Start the work'}
        </button>
      )}
      {status === 'in_progress' && (
        <button
          type="button"
          className="button button-primary"
          onClick={() => void act('complete')}
          disabled={pending !== null}
        >
          {pending === 'complete' ? 'Sending…' : 'Report the work finished'}
        </button>
      )}
      {status === 'completion_pending' && (
        <span className="order-when">Waiting on the customer to confirm.</span>
      )}
      {status === 'disputed' && (
        <span className="order-when">
          The customer reported a problem. Completion and review are held until they close it.
        </span>
      )}
      {message && (
        <span className="order-action-error" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </span>
  );
}
