'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Unlocking the moderation console.
 *
 * There is deliberately no "sign in" here in the account sense: an operator
 * presents the deployment's own moderation token, and no ServEm account can open
 * this. The field is `type="password"` with autocomplete off and spellcheck off so
 * a browser neither offers to save it as a login nor offers to spell-correct it,
 * and the server's refusal is shown verbatim — which for every failure, including
 * a switched-off console, is the same "Not found."
 */
export function OperatorUnlock() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || token.trim() === '') return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/moderation/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};
      if (!response.ok) {
        setError(
          typeof body.message === 'string'
            ? body.message
            : 'That credential was not accepted.',
        );
        return;
      }
      setToken('');
      router.refresh();
    } catch {
      setError('That did not go through. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="docket-unlock" onSubmit={submit}>
      <label className="job-label" htmlFor="operator-token">
        Operator token
      </label>
      <input
        id="operator-token"
        className="job-input"
        type="password"
        name="token"
        value={token}
        autoComplete="off"
        spellCheck={false}
        aria-describedby="operator-token-hint"
        onChange={(event) => setToken(event.target.value)}
      />
      <p className="docket-hint" id="operator-token-hint">
        The value of <code translate="no">SERVEM_MODERATION_TOKEN</code> on this deployment. This is
        not an account: signing in as a customer does not open this console, and nothing here can be
        reached with a customer session.
      </p>
      <button type="submit" className="button button-primary" disabled={pending || token.trim() === ''}>
        {pending ? 'Checking…' : 'Unlock console'}
      </button>
      {error && (
        <p className="job-field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Closing the console.
 *
 * Clearing the cookie is the whole of signing out here, and it is the right
 * control for a shared machine: it ends this browser's session without touching
 * the deployment's token, so nothing has to be rotated to lock a laptop.
 */
export function OperatorLockButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function lock() {
    if (pending) return;
    setPending(true);
    try {
      await fetch('/api/moderation/session', { method: 'DELETE', cache: 'no-store' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" className="quiet-button" onClick={lock} disabled={pending}>
      {pending ? 'Locking…' : 'Lock console'}
    </button>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
