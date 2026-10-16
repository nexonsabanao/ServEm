'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The ServMate's offer on a job.
 *
 * What makes an offer valid — whole centavos, a scope short enough to compare,
 * eligibility at the moment of booking — is decided by the server. This form
 * collects the terms and shows whatever the server says back, because two
 * providers must be held to the same rules whichever screen they typed on.
 */
export function OfferForm({ jobId, budgetCentavos }: { jobId: string; budgetCentavos: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState('');
  const [proposedStart, setProposedStart] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setErrors({});
    try {
      const response = await fetch(`/api/servmate/me/available-jobs/${jobId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          amountCentavos: Math.round(Number(amount) * 100),
          ...(scope ? { scopeDescription: scope } : {}),
          ...(proposedStart ? { proposedStart: new Date(proposedStart).toISOString() } : {}),
          ...(message ? { message } : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : {};

      if (response.status === 401) {
        setError('Your session ended. Sign in again to offer.');
        return;
      }
      if (!response.ok) {
        setErrors(
          typeof body.errors === 'object' && body.errors !== null
            ? (body.errors as Record<string, string>)
            : {},
        );
        setError(typeof body.message === 'string' ? body.message : 'That offer was not sent.');
        return;
      }
      router.refresh();
    } catch {
      setError('Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="job-form" onSubmit={submit} noValidate>
      <div className="job-grid">
        <div className="job-field">
          <label className="job-label" htmlFor="offer-amount">
            Your price (₱)
          </label>
          <input
            id="offer-amount"
            className="job-input"
            inputMode="numeric"
            value={amount}
            placeholder={String(Math.round(budgetCentavos / 100))}
            aria-invalid={errors.amountCentavos ? true : undefined}
            onChange={(event) => setAmount(event.target.value)}
          />
          {errors.amountCentavos && <p className="job-field-error">{errors.amountCentavos}</p>}
        </div>

        <div className="job-field">
          <label className="job-label" htmlFor="offer-start">
            When you could start
          </label>
          <input
            id="offer-start"
            className="job-input"
            type="datetime-local"
            value={proposedStart}
            onChange={(event) => setProposedStart(event.target.value)}
          />
        </div>
      </div>

      <div className="job-field">
        <label className="job-label" htmlFor="offer-scope">
          What that price covers
        </label>
        <textarea
          id="offer-scope"
          className="job-input job-textarea"
          rows={3}
          maxLength={1000}
          value={scope}
          placeholder="Two people, three hours, cleaning supplies included."
          aria-invalid={errors.scopeDescription ? true : undefined}
          onChange={(event) => setScope(event.target.value)}
        />
        {errors.scopeDescription && <p className="job-field-error">{errors.scopeDescription}</p>}
      </div>

      <div className="job-field">
        <label className="job-label" htmlFor="offer-message">
          A note for the customer
        </label>
        <textarea
          id="offer-message"
          className="job-input job-textarea"
          rows={2}
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      {error && (
        <p className="job-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="job-actions">
        <button type="submit" className="button button-primary" disabled={pending}>
          {pending ? 'Sending…' : 'Send offer'}
        </button>
      </div>
    </form>
  );
}
