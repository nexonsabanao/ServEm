'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The customer's way out of a bad job, and their way back in.
 *
 * Two states share one component because they are one decision seen twice: a
 * booking that is under way or awaiting confirmation can be disputed, and a
 * disputed booking can be taken back or abandoned. The server is the authority
 * on which is possible — the button only says which one it is offering.
 */
export function DisputeControls({
  bookingId,
  status,
}: {
  bookingId: string;
  /** The booking's current status, straight from the server render. */
  status: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [writing, setWriting] = useState(false);
  const [pending, setPending] = useState<'open' | 'withdraw' | 'cancel' | null>(null);
  const [message, setMessage] = useState('');

  const disputed = status === 'disputed';
  const canOpen = status === 'in_progress' || status === 'completion_pending';

  if (!disputed && !canOpen) return null;

  async function act(action: 'open' | 'withdraw' | 'cancel') {
    if (pending) return;
    setPending(action);
    setMessage('');
    try {
      const response = await fetch(`/api/bookings/${bookingId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(action === 'open' ? { action, reason } : { action }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : {};

      if (!response.ok) {
        const fields =
          typeof body.errors === 'object' && body.errors !== null
            ? (body.errors as Record<string, string>)
            : {};
        setMessage(
          typeof body.message === 'string'
            ? body.message
            : fields.reason ?? 'That could not be saved. Try again.',
        );
        setPending(null);
        return;
      }
      setWriting(false);
      setReason('');
      router.refresh();
    } catch {
      setMessage('Check your connection and try again.');
    } finally {
      setPending(null);
    }
  }

  if (disputed) {
    return (
      <div className="dispute-panel" data-state="disputed" role="group" aria-label="A problem was reported">
        <p className="dispute-note">
          You reported a problem with this job. Nothing is marked complete and no review can be
          written while it is open — the ServMate cannot finish the booking past it.
        </p>
        <div className="dispute-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => void act('withdraw')}
            disabled={pending !== null}
          >
            {pending === 'withdraw' ? 'Closing…' : 'The work was fine after all'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void act('cancel')}
            disabled={pending !== null}
          >
            {pending === 'cancel' ? 'Cancelling…' : 'Cancel this booking'}
          </button>
        </div>
        {message && (
          <p className="order-action-error" role="status" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="dispute-panel">
      <p className="dispute-note">
        If the work is not what was agreed, say so before confirming it. The booking stays open
        while it is reported, and no review can be written either way.
      </p>

      {writing ? (
        <>
          <label className="dispute-label" htmlFor={`dispute-reason-${bookingId}`}>
            What went wrong?
          </label>
          <textarea
            id={`dispute-reason-${bookingId}`}
            className="dispute-reason"
            rows={3}
            maxLength={4000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Describe what was agreed and what happened instead."
          />
          <div className="dispute-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => void act('open')}
              disabled={pending !== null || reason.trim().length === 0}
            >
              {pending === 'open' ? 'Sending…' : 'Report the problem'}
            </button>
            <button
              type="button"
              className="quiet-button"
              onClick={() => {
                setWriting(false);
                setMessage('');
              }}
              disabled={pending !== null}
            >
              Not now
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="quiet-button"
          onClick={() => setWriting(true)}
          disabled={pending !== null}
        >
          Report a problem
        </button>
      )}

      {message && (
        <p className="order-action-error" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
