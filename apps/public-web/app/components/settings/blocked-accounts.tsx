'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The accounts this person has blocked, with the way back.
 *
 * A block is a safety tool, not a punishment, so undoing it has to be as easy as
 * placing it — otherwise people leave blocks in place out of friction. The list
 * shows only what this account placed: a block against you is not disclosed,
 * here or anywhere else.
 */
export function BlockedAccounts({
  blocked,
}: {
  blocked: { userId: string; name: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unblock(userId: string, name: string) {
    if (pending) return;
    setPending(userId);
    setError(null);
    try {
      const response = await fetch(`/api/blocks/${userId}`, { method: 'DELETE', cache: 'no-store' });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const body = isRecord(payload) ? payload : {};
        setError(
          typeof body.message === 'string'
            ? body.message
            : `${name} could not be unblocked. Try again.`,
        );
        return;
      }
      router.refresh();
    } catch {
      setError(`${name} could not be unblocked. Check your connection and try again.`);
    } finally {
      setPending(null);
    }
  }

  if (blocked.length === 0) {
    return (
      <p className="set-row-note">
        Nobody blocked. A block hides your work from each other without telling either of you.
      </p>
    );
  }

  return (
    <>
      <ul className="blocked-list">
        {blocked.map((account) => (
          <li key={account.userId} className="blocked-row">
            <span className="blocked-name">{account.name}</span>
            <button
              type="button"
              className="quiet-button"
              disabled={pending === account.userId}
              onClick={() => unblock(account.userId, account.name)}
            >
              {pending === account.userId ? 'Unblocking…' : 'Unblock'}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="job-field-error" role="alert">
          {error}
        </p>
      )}
      <p className="job-media-hint">
        Unblocking returns both of you to each other&apos;s matching; reports are separate.
      </p>
    </>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
