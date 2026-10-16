'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';

type Errors = Record<string, string>;

/**
 * The two states of `/reset`, in one form.
 *
 * With no token it asks which address the account uses and POSTs a recovery
 * request; the success copy deliberately does not depend on whether that address
 * has an account, because saying "we sent it" only to real addresses would turn
 * the form into a directory.
 *
 * With a token it sets a new password. The page has already checked that the
 * token is still live, so this form only has to confirm the two fields agree —
 * the server decides whether the token is any good regardless.
 */
export function ResetForm({ token, live }: { token: string | null; live: boolean }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const byEmail = token === null;

  useEffect(() => {
    if (byEmail) window.setTimeout(() => emailRef.current?.focus(), 0);
  }, [byEmail]);

  function resetFeedback() {
    setErrors({});
    setMessage('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    resetFeedback();

    try {
      if (byEmail) {
        const response = await fetch('/api/auth/password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ email }),
        });
        const body = await readBody(response);
        if (!response.ok) {
          const fieldErrors = body.errors ?? {};
          setErrors(fieldErrors);
          setMessage(body.message || 'That did not work. Try again.');
          focusFirstError(fieldErrors);
          return;
        }
        setDone(true);
        setMessage('If that address has a ServEm account, a reset link is on its way.');
        return;
      }

      if (password !== confirm) {
        const fieldErrors = { confirm: 'Those two passwords do not match.' };
        setErrors(fieldErrors);
        setMessage('Check the highlighted fields.');
        focusFirstError(fieldErrors);
        return;
      }

      const response = await fetch('/api/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token, password }),
      });
      const body = await readBody(response);
      if (!response.ok) {
        const fieldErrors = body.errors ?? {};
        setErrors(fieldErrors);
        setMessage(body.message || 'That link has expired. Ask for a new one.');
        focusFirstError(fieldErrors);
        return;
      }
      setDone(true);
      setMessage('Your password has been changed. Sign in with it now.');
    } catch {
      setMessage('That did not work. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  function focusFirstError(fieldErrors: Errors) {
    if (fieldErrors.email) emailRef.current?.focus();
    else if (fieldErrors.password) passwordRef.current?.focus();
    else if (fieldErrors.confirm) confirmRef.current?.focus();
  }

  if (!byEmail && !live) {
    return (
      <div className="auth-form">
        <p className="auth-status" role="status">
          That link has expired or has already been used. Ask for a new one and we will send a
          fresh link.
        </p>
        <Link className="button button-primary auth-submit" href="/reset">
          Send a new link
        </Link>
        <p className="auth-switch">
          <Link className="auth-switch-button" href="/">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  if (done && byEmail) {
    return (
      <div className="auth-form" role="status">
        <p className="auth-status">{message}</p>
        <p className="auth-hint">
          The link works once and expires in an hour. Nothing happens until you open it.
        </p>
        <Link className="button button-secondary auth-submit" href="/">
          Back to ServEm
        </Link>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {byEmail ? (
        <div className="auth-field">
          <label htmlFor="reset-email">Email address</label>
          <input
            id="reset-email"
            ref={emailRef}
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={254}
            value={email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'reset-email-error' : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          {errors.email && (
            <p className="auth-error" id="reset-email-error">
              {errors.email}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="auth-field">
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              ref={passwordRef}
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={password}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'reset-password-error' : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {!errors.password && <p className="auth-hint">At least 8 characters.</p>}
            {errors.password && (
              <p className="auth-error" id="reset-password-error">
                {errors.password}
              </p>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="reset-confirm">Repeat the new password</label>
            <input
              id="reset-confirm"
              ref={confirmRef}
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              aria-invalid={errors.confirm ? true : undefined}
              aria-describedby={errors.confirm ? 'reset-confirm-error' : undefined}
              onChange={(event) => setConfirm(event.target.value)}
            />
            {errors.confirm && (
              <p className="auth-error" id="reset-confirm-error">
                {errors.confirm}
              </p>
            )}
          </div>
        </>
      )}

      {message && (
        <p className="auth-status" role="status" aria-live="polite">
          {message}
        </p>
      )}

      <button className="button button-primary auth-submit" type="submit" disabled={pending}>
        {pending
          ? byEmail
            ? 'Sending…'
            : 'Changing password…'
          : byEmail
            ? 'Send reset link'
            : 'Change password'}
      </button>

      <p className="auth-switch">
        {byEmail ? 'Remembered it? ' : ''}
        <Link className="auth-switch-button" href="/">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

async function readBody(response: Response): Promise<{
  message?: string;
  errors?: Errors;
}> {
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  const errors =
    typeof record.errors === 'object' && record.errors !== null && !Array.isArray(record.errors)
      ? (record.errors as Errors)
      : {};
  return {
    ...(typeof record.message === 'string' ? { message: record.message } : {}),
    errors,
  };
}
