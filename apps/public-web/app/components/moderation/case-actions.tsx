'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Deciding a case.
 *
 * Both controls are ordinary forms with a note field and a submit button per
 * outcome, so the whole console works with the keyboard and without JavaScript
 * deciding anything: the buttons carry the outcome in their value, and the
 * server — not the component — decides whether that outcome is legal from here.
 * A refusal is shown against the form it came from rather than being swallowed,
 * because an operator who cannot tell whether a verdict landed will click it
 * twice.
 *
 * The note is required by the server for any closing outcome, and duplicated
 * here only as `required` so the browser can say so first; the server still
 * refuses a note made of spaces.
 */

/**
 * One button per outcome.
 *
 * `tone` picks the visual weight, and it is not decoration: the outcome that
 * changes what the parties are told is the primary one, and the outcome that ends
 * someone's work or dismisses their complaint is not. An operator should be able
 * to tell which button they are about to press from its weight alone.
 */
type Outcome = { value: string; label: string; closes: boolean; tone: 'primary' | 'secondary' };

export function ReportCaseActions({ reportId, status }: { reportId: string; status: string }) {
  const outcomes: Outcome[] =
    status === 'reviewing'
      ? [
          { value: 'resolved', label: 'Resolved — we acted', closes: true, tone: 'primary' },
          { value: 'dismissed', label: 'Dismissed — no action', closes: true, tone: 'secondary' },
        ]
      : [
          { value: 'reviewing', label: 'Claim for review', closes: false, tone: 'secondary' },
          { value: 'resolved', label: 'Resolved — we acted', closes: true, tone: 'primary' },
          { value: 'dismissed', label: 'Dismissed — no action', closes: true, tone: 'secondary' },
        ];

  return (
    <OperatorActionForm
      action={`/api/moderation/reports/${reportId}`}
      field="outcome"
      outcomes={outcomes}
      noteLabel="What was decided"
      noteHint="Kept with the case. Once a report leaves the queue this note is the only record of why."
      noteRequiredForClosing
    />
  );
}

export function DisputeCaseActions({ bookingId }: { bookingId: string }) {
  return (
    <OperatorActionForm
      action={`/api/moderation/disputes/${bookingId}`}
      field="verdict"
      outcomes={[
        { value: 'completed', label: 'The work stands — completed', closes: true, tone: 'primary' },
        { value: 'cancelled', label: 'Cancel the booking', closes: true, tone: 'secondary' },
      ]}
      noteLabel="Why this outcome"
      noteHint="Both sides are told this outcome, and the note is what tells them why. It needs at least 10 characters."
      noteRequiredForClosing
      minLength={10}
      confirm={{
        value: 'cancelled',
        message:
          'Cancelling ends the work and closes the job for both sides. The customer is told the work does not stand. Continue?',
      }}
    />
  );
}

function OperatorActionForm({
  action,
  field,
  outcomes,
  noteLabel,
  noteHint,
  noteRequiredForClosing,
  minLength,
  confirm,
}: {
  action: string;
  field: 'outcome' | 'verdict';
  outcomes: Outcome[];
  noteLabel: string;
  noteHint: string;
  noteRequiredForClosing: boolean;
  minLength?: number;
  confirm?: { value: string; message: string };
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const chosen = submitter?.value;
    if (!chosen || pending) return;

    const outcome = outcomes.find((option) => option.value === chosen);
    if (confirm && confirm.value === chosen && !window.confirm(confirm.message)) return;

    setPending(chosen);
    setError(null);
    setDone(null);
    try {
      const response = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ [field]: chosen, note }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};
      if (!response.ok) {
        const fieldErrors = isRecord(body.errors) ? Object.values(body.errors) : [];
        const first = fieldErrors.find((value): value is string => typeof value === 'string');
        setError(first ?? (typeof body.message === 'string' ? body.message : 'That did not go through.'));
        return;
      }
      setNote('');
      setDone(
        outcome?.closes
          ? 'Recorded. It is off the queue and the decision is in the case history.'
          : 'Claimed. Any operator can see it is being reviewed.',
      );
      router.refresh();
    } catch {
      setError('That did not go through. Check your connection and try again.');
    } finally {
      setPending(null);
    }
  }

  return (
    <form className="docket-actions" onSubmit={submit}>
      <label className="job-label" htmlFor={`case-note-${action}`}>
        {noteLabel}
      </label>
      <textarea
        id={`case-note-${action}`}
        className="job-input job-textarea"
        rows={3}
        maxLength={1000}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <p className="docket-hint">{noteHint}</p>

      <div className="docket-buttons">
        {outcomes.map((option) => {
          const blocked = noteRequiredForClosing && option.closes && note.trim().length < (minLength ?? 4);
          return (
            <button
              key={option.value}
              type="submit"
              name={field}
              value={option.value}
              className={option.tone === 'primary' ? 'button button-primary' : 'quiet-button'}
              disabled={pending !== null || blocked}
            >
              {pending === option.value ? 'Recording…' : option.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="job-field-error" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="docket-hint" role="status">
          {done}
        </p>
      )}
    </form>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
