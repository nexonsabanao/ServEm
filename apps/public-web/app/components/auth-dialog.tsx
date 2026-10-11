'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CloseIcon } from '@/app/components/icons';
import Link from 'next/link';

export type Account = {
  id: string;
  name: string;
  email: string;
};

export type AuthMode = 'signin' | 'signup';
export type ProviderId = 'google' | 'apple';

type ProviderState = Record<ProviderId, boolean>;

type Props = {
  open: boolean;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onAuthenticated: (account: Account) => void;
};

type Errors = Record<string, string>;

const PROVIDER_LABELS: Record<ProviderId, string> = { google: 'Google', apple: 'Apple' };

const PROVIDER_ORDER: ProviderId[] = ['google', 'apple'];

const UNAVAILABLE: ProviderState = { google: false, apple: false };

export function AuthDialog({ open, mode, onModeChange, onClose, onAuthenticated }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [providers, setProviders] = useState<ProviderState | null>(null);
  const [redirecting, setRedirecting] = useState<ProviderId | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || providers !== null) return;
    let cancelled = false;
    fetch('/api/auth/providers', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled) return;
        setProviders(readProviderState(payload));
      })
      .catch(() => {
        if (!cancelled) setProviders(UNAVAILABLE);
      });
    return () => {
      cancelled = true;
    };
  }, [open, providers]);

  function resetFeedback() {
    setErrors({});
    setMessage('');
  }

  function switchMode(next: AuthMode) {
    if (next === mode) return;
    resetFeedback();
    setPassword('');
    onModeChange(next);
  }

  function close() {
    if (pending || redirecting) return;
    resetFeedback();
    setPassword('');
    onClose();
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }

  function startProvider(provider: ProviderId) {
    if (pending || redirecting || providers?.[provider] !== true) return;
    resetFeedback();
    setRedirecting(provider);
    // A full navigation, not a fetch: the provider needs the top-level window.
    window.location.assign(`/api/auth/oauth/${provider}/start`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || redirecting) return;

    setPending(true);
    resetFeedback();

    try {
      const response = await fetch(mode === 'signup' ? '/api/auth/signup' : '/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(
          mode === 'signup' ? { name, email, password } : { email, password },
        ),
      });

      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};

      if (!response.ok) {
        const fieldErrors = isRecord(body.errors) ? (body.errors as Errors) : {};
        setErrors(fieldErrors);
        setMessage(
          typeof body.message === 'string'
            ? body.message
            : 'That did not work. Check your connection and try again.',
        );
        focusFirstError(fieldErrors);
        return;
      }

      const account = body.account;
      if (!isAccount(account)) {
        setMessage('The server returned an unexpected response. Try again.');
        return;
      }

      setName('');
      setEmail('');
      setPassword('');
      resetFeedback();
      onAuthenticated(account);
    } catch {
      setMessage('That did not work. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  function focusFirstError(fieldErrors: Errors) {
    if (fieldErrors.name) nameRef.current?.focus();
    else if (fieldErrors.email) emailRef.current?.focus();
    else if (fieldErrors.password) passwordRef.current?.focus();
  }

  const isSignup = mode === 'signup';
  const busy = pending || redirecting !== null;

  return (
    <dialog
      className="auth-dialog"
      ref={dialogRef}
      aria-labelledby="auth-dialog-title"
      onClose={() => { if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current) close(); }}
    >
      <div className="dialog-content auth-content">
        <div className="dialog-topline">
          <span className="dialog-kicker">{isSignup ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</span>
          <button type="button" className="dialog-close" aria-label="Close sign in" onClick={close}><CloseIcon /></button>
        </div>

        <h2 id="auth-dialog-title">{isSignup ? 'Join ServEm' : 'Sign in to ServEm'}</h2>
        <p className="auth-lede">
          {isSignup
            ? 'Create an account to send booking requests and keep track of them.'
            : 'Your requests and ServMate details stay tied to your account.'}
        </p>

        <form className="auth-form" onSubmit={submit} noValidate>
          {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-name">Your name</label>
              <input
                id="auth-name"
                ref={nameRef}
                type="text"
                name="name"
                autoComplete="name"
                maxLength={80}
                value={name}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? 'auth-name-error' : undefined}
                onChange={(event) => setName(event.target.value)}
              />
              {errors.name && <p className="auth-error" id="auth-name-error">{errors.name}</p>}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              ref={emailRef}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              maxLength={254}
              value={email}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'auth-email-error' : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email && <p className="auth-error" id="auth-email-error">{errors.email}</p>}
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              ref={passwordRef}
              type="password"
              name="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'auth-password-error' : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {isSignup && !errors.password && (
              <p className="auth-hint">At least 8 characters.</p>
            )}
            {errors.password && <p className="auth-error" id="auth-password-error">{errors.password}</p>}
          </div>

          {isSignup && (
            <p className="auth-terms">
              By creating an account you accept the{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer">
                Terms and conditions
              </Link>
              .
            </p>
          )}

          {message && <p className="auth-status" role="status" aria-live="polite">{message}</p>}

          <button className="button button-primary auth-submit" type="submit" disabled={busy}>
            {pending
              ? (isSignup ? 'Creating account…' : 'Signing in…')
              : (isSignup ? 'Create account' : 'Sign in')}
          </button>
        </form>

        <p className="auth-divider"><span>or continue with</span></p>

        <div className="auth-providers" role="group" aria-label="Continue with another account">
          {PROVIDER_ORDER.map((provider) => {
            const available = providers?.[provider] === true;
            const label = PROVIDER_LABELS[provider];
            const unavailable = providers !== null && !available;
            return (
              <button
                key={provider}
                type="button"
                className="provider-button"
                data-provider={provider}
                disabled={!available || busy}
                title={unavailable ? `${label} sign-in is not configured on this server` : undefined}
                onClick={() => startProvider(provider)}
              >
                <span className="provider-icon" aria-hidden="true">
                  {provider === 'google' ? <GoogleMark /> : <AppleMark />}
                </span>
                {redirecting === provider
                  ? `Continuing to ${label}…`
                  : `${isSignup ? 'Sign up' : 'Sign in'} with ${label}`}
              </button>
            );
          })}
        </div>

        <p className="auth-switch">
          {isSignup ? 'Already have an account?' : 'New to ServEm?'}
          {' '}
          <button type="button" className="auth-switch-button" onClick={() => switchMode(isSignup ? 'signin' : 'signup')}>
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </p>

        <p className="auth-note">
          Local development build. Accounts are stored on this machine only.
        </p>
      </div>
    </dialog>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" focusable="false">
      <path fill="#ea4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285f4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z" />
      <path fill="#fbbc05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19Z" />
      <path fill="#34a853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" focusable="false">
      <path
        fill="currentColor"
        d="M16.36 12.72c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.71-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.19-.02 1.94-1.08 2.66-2.15.84-1.24 1.19-2.44 1.21-2.5-.03-.01-2.32-.89-2.34-3.53Zm-2.2-6.44c.61-.74 1.02-1.77.91-2.79-.88.04-1.94.59-2.57 1.32-.56.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.58-1.23Z"
      />
    </svg>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAccount(value: unknown): value is Account {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string'
  );
}

/** Anything the endpoint did not explicitly enable is treated as unavailable. */
function readProviderState(payload: unknown): ProviderState {
  if (!isRecord(payload)) return UNAVAILABLE;
  return {
    google: payload.google === true,
    apple: payload.apple === true,
  };
}
