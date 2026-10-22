'use client';

import { useState } from 'react';
import { validatePassword } from '@/lib/validation';

/**
 * Password change.
 *
 * The current password is required and checked on the server, so a borrowed
 * session cannot be turned into a takeover. A successful change ends the
 * account's other sessions; this browser stays signed in.
 */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!hasPassword) {
    return (
      <p className="set-gated">
        Google or Apple sign-in — no ServEm password to change, and linking is not built.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const localError =
      (!current && 'Enter your current password.') ||
      validatePassword(next) ||
      (next === current && 'Choose a password you have not used here.') ||
      (next !== confirm && 'The two new passwords do not match.') ||
      null;

    if (localError) {
      setError(localError);
      setDone(null);
      return;
    }

    setPending(true);
    setError(null);
    setDone(null);
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ current, next }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

      if (response.status === 401) {
        setError('Your session ended. Sign in again to change your password.');
        return;
      }
      if (!response.ok) {
        const fields = body.errors && typeof body.errors === 'object' ? (body.errors as Record<string, unknown>) : {};
        setError(
          (typeof fields.current === 'string' && fields.current) ||
            (typeof fields.next === 'string' && fields.next) ||
            (typeof body.message === 'string' && body.message) ||
            'That password could not be changed.',
        );
        return;
      }

      const ended = typeof body.otherSessionsEnded === 'number' ? body.otherSessionsEnded : 0;
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(
        ended === 0
          ? 'Password changed. No other devices were signed in.'
          : `Password changed. ${ended} other ${ended === 1 ? 'device was' : 'devices were'} signed out.`,
      );
    } catch {
      setError('That password could not be changed. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="set-form" onSubmit={submit}>
      <div className="set-fields">
        <Field
          id="pw-current"
          label="Current password"
          value={current}
          autoComplete="current-password"
          onChange={(value) => {
            setCurrent(value);
            setError(null);
          }}
        />
        <Field
          id="pw-next"
          label="New password"
          hint="At least 8 characters."
          value={next}
          autoComplete="new-password"
          onChange={(value) => {
            setNext(value);
            setError(null);
          }}
        />
        <Field
          id="pw-confirm"
          label="Repeat new password"
          value={confirm}
          autoComplete="new-password"
          onChange={(value) => {
            setConfirm(value);
            setError(null);
          }}
        />
      </div>
      <div className="set-actions">
        <button type="submit" className="set-save" disabled={pending}>
          {pending ? 'Changing…' : 'Change password'}
        </button>
        {error && <p className="set-status" data-tone="error" role="alert">{error}</p>}
        {done && !error && <p className="set-status" data-tone="ok" role="status">{done}</p>}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="set-field">
      <label className="set-row-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="set-input"
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <span className="set-row-note">{hint}</span>}
    </div>
  );
}

/**
 * Ends the account's other sessions. The signed-in browser keeps its own, so
 * this never signs the person out of the page they are standing on.
 */
export function OtherDevicesPanel() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'ok' | 'error'>('ok');

  async function signOutOthers() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/account/sessions', { method: 'POST', cache: 'no-store' });
      const payload: unknown = await response.json().catch(() => null);
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

      if (!response.ok) {
        setTone('error');
        setMessage(
          response.status === 401
            ? 'Your session ended. Sign in again to do this.'
            : typeof body.message === 'string'
              ? body.message
              : 'Those sessions could not be ended.',
        );
        return;
      }

      const ended = typeof body.otherSessionsEnded === 'number' ? body.otherSessionsEnded : 0;
      setTone('ok');
      setMessage(
        ended === 0
          ? 'No other device was signed in to this account.'
          : `${ended} other ${ended === 1 ? 'session was' : 'sessions were'} ended. This browser stays signed in.`,
      );
    } catch {
      setTone('error');
      setMessage('Those sessions could not be ended. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="set-inline">
      <button type="button" className="set-secondary" onClick={() => void signOutOthers()} disabled={pending}>
        {pending ? 'Ending…' : 'Sign out other devices'}
      </button>
      {message && (
        <p className="set-status" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>{message}</p>
      )}
    </div>
  );
}
