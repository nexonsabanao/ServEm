'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The customer's review of finished work.
 *
 * A review may only exist against a completed booking, exactly once, from the
 * customer who paid — the server checks all three, so this form can simply show
 * the answer rather than trying to enforce it in the browser.
 */
export function ReviewForm({ bookingId, reference }: { bookingId: string; reference: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || rating < 1) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ rating, comment }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body =
        typeof payload === 'object' && payload !== null
          ? (payload as Record<string, unknown>)
          : {};

      if (!response.ok) {
        setError(typeof body.message === 'string' ? body.message : 'That review was not saved.');
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
    <form className="review-form" onSubmit={submit}>
      <fieldset className="review-stars">
        <legend className="job-label">How did {reference} go?</legend>
        <span className="review-star-row" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={`review-star ${value <= (hovered || rating) ? 'is-lit' : ''}`}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              aria-pressed={rating === value}
              onMouseEnter={() => setHovered(value)}
              onFocus={() => setHovered(value)}
              onClick={() => setRating(value)}
            >
              ★
            </button>
          ))}
        </span>
      </fieldset>

      <div className="job-field">
        <label className="job-label" htmlFor="review-comment">
          What would you tell a neighbour about this work?
        </label>
        <textarea
          id="review-comment"
          className="job-input job-textarea"
          rows={3}
          maxLength={1000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>

      {error && (
        <p className="job-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="job-actions">
        <button
          type="submit"
          className="button button-primary"
          disabled={pending || rating < 1}
        >
          {pending ? 'Sending…' : 'Post review'}
        </button>
      </div>
    </form>
  );
}
