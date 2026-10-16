'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { REPORT_REASON_LABELS, REPORT_REASONS } from '@/lib/presentation';

/**
 * Report and block, from the page where the problem is.
 *
 * Reporting and blocking answer different needs — one asks the marketplace to
 * look, the other stops the contact immediately — so they are two actions in one
 * place rather than one button with unclear consequences. Neither is a delete:
 * a block is reversible from the account settings, and a report is a record a
 * person reviews.
 *
 * The disclosure is a `<details>`, so both controls work with the keyboard and
 * without JavaScript, and the reason list is the same registry the API validates
 * against rather than a second copy that can drift.
 */
export function TrustControls({
  subject,
  reportedUserId,
  reportedJobId,
  initiallyBlocked = false,
}: {
  subject: string;
  reportedUserId?: string;
  reportedJobId?: string;
  initiallyBlocked?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(initiallyBlocked);

  async function report(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          reasonCode: reason,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(reportedJobId ? { reportedJobId } : {}),
          ...(reportedUserId ? { reportedUserId } : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};
      if (!response.ok) {
        setError(typeof body.message === 'string' ? body.message : 'That report was not sent.');
        return;
      }
      setDone('Report sent. A moderator will look at it.');
      setReason('');
      setDescription('');
    } catch {
      setError('That report was not sent. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function toggleBlock() {
    if (pending || !reportedUserId) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/blocks/${reportedUserId}`, {
        method: blocked ? 'DELETE' : 'POST',
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};
      if (!response.ok) {
        setError(typeof body.message === 'string' ? body.message : 'That did not go through.');
        return;
      }
      setBlocked(!blocked);
      setDone(
        blocked
          ? `Unblocked ${subject}. Their work and yours can appear again.`
          : `Blocked ${subject}. Neither of you sees the other's jobs now.`,
      );
      router.refresh();
    } catch {
      setError('That did not go through. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="trust-controls">
      <summary className="trust-summary">Report or block</summary>

      <div className="trust-body">
        <form className="job-field" onSubmit={report}>
          <label className="job-label" htmlFor="trust-reason">
            Report {subject}
          </label>
          <select
            id="trust-reason"
            className="job-input"
            value={reason}
            required
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">Pick a reason</option>
            {REPORT_REASONS.map((option) => (
              <option key={option} value={option}>
                {REPORT_REASON_LABELS[option]}
              </option>
            ))}
          </select>

          <label className="job-label" htmlFor="trust-description">
            What happened (optional)
          </label>
          <textarea
            id="trust-description"
            className="job-input job-textarea"
            rows={3}
            maxLength={1000}
            value={description}
            placeholder="Anything a moderator should know."
            onChange={(event) => setDescription(event.target.value)}
          />

          <div className="job-actions">
            <button type="submit" className="quiet-button" disabled={pending || reason === ''}>
              {pending ? 'Sending…' : 'Send report'}
            </button>
            {reportedUserId && (
              <button
                type="button"
                className="quiet-button"
                disabled={pending}
                onClick={toggleBlock}
              >
                {blocked ? `Unblock ${subject}` : `Block ${subject}`}
              </button>
            )}
          </div>
        </form>

        {error && (
          <p className="job-field-error" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="job-media-hint" role="status">
            {done}
          </p>
        )}
        <p className="job-media-hint">
          A report does not by itself hide anything — a moderator decides what happens next. A block
          takes effect immediately, and you can undo it under Account → Settings.
        </p>
      </div>
    </details>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
