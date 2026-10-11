'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateName } from '@/lib/validation';

/**
 * Changes the display name shown on requests, messages and the ServMate
 * workbench. The email address sits beside it as a read-only fact: changing it
 * needs a verification flow, which is still an open decision.
 */
export function NameForm({ initialName, email }: { initialName: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim() !== initialName;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const localError = validateName(name);
    if (localError) {
      setError(localError);
      setSaved(null);
      return;
    }

    setPending(true);
    setError(null);
    setSaved(null);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

      if (response.status === 401) {
        setError('Your session ended. Sign in again to save this.');
        return;
      }
      if (!response.ok) {
        const fields = body.errors && typeof body.errors === 'object' ? (body.errors as Record<string, unknown>) : {};
        setError(typeof fields.name === 'string' ? fields.name : 'That name could not be saved.');
        return;
      }

      setSaved(name.trim());
      router.refresh();
    } catch {
      setError('That name could not be saved. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="set-form" onSubmit={submit}>
      <div className="set-rows">
        <div className="set-row">
          <div className="set-row-copy">
            <label className="set-row-label" htmlFor="account-name">Display name</label>
            <span className="set-row-note">Shown to ServMates on your requests and in messages.</span>
          </div>
          <div className="set-row-control">
            <input
              id="account-name"
              className="set-input"
              value={name}
              maxLength={80}
              autoComplete="name"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'account-name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
            />
          </div>
        </div>
        <div className="set-row">
          <div className="set-row-copy">
            <span className="set-row-label">Email address</span>
            <span className="set-row-note">
              Changing your email needs a verification step, which is not built yet.
            </span>
          </div>
          <div className="set-row-control">
            <span className="set-readonly">{email}</span>
          </div>
        </div>
      </div>

      <div className="set-actions">
        <button type="submit" className="set-save" disabled={pending || !dirty}>
          {pending ? 'Saving…' : 'Save name'}
        </button>
        {error && <p className="set-status" data-tone="error" id="account-name-error" role="alert">{error}</p>}
        {saved && !error && <p className="set-status" data-tone="ok" role="status">Saved as {saved}.</p>}
      </div>
    </form>
  );
}
