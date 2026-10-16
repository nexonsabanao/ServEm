'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Publishes a draft or closes a live job.
 *
 * The server owns the decision about whether a job may move; these buttons
 * report what it said and refresh the page so the row shows its real new state.
 */
export function JobActions({
  jobId,
  status,
  title,
}: {
  jobId: string;
  status: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'publish' | 'cancel' | null>(null);
  const [message, setMessage] = useState('');

  async function act(action: 'publish' | 'cancel') {
    if (pending) return;
    setPending(action);
    setMessage('');
    try {
      const response = await fetch(`/api/jobs/${jobId}/${action}`, {
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
            : action === 'publish'
              ? `“${title}” could not be published.`
              : `“${title}” could not be closed.`,
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
    <span className="order-action-group">
      {status === 'draft' && (
        <button
          type="button"
          className="quiet-button"
          onClick={() => void act('publish')}
          disabled={pending !== null}
        >
          {pending === 'publish' ? 'Publishing…' : 'Publish'}
        </button>
      )}
      {(status === 'draft' || status === 'open' || status === 'offer_received') && (
        <button
          type="button"
          className="quiet-button"
          onClick={() => void act('cancel')}
          disabled={pending !== null}
        >
          {pending === 'cancel' ? 'Closing…' : 'Close job'}
        </button>
      )}
      {message && (
        <span className="order-action-error" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </span>
  );
}
