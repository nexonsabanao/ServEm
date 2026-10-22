'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DeletionBlocker } from '@/lib/account-deletion';

/**
 * Delete-account control.
 *
 * It is closed until asked for, because a destructive action beside an export
 * link is a trap. Open, it says exactly what goes, what stays for the other
 * person, and when that goes too — then asks for the word DELETE and the current
 * password. The button stays disabled until the word matches, so the first click
 * on it can never be the accident.
 *
 * A refusal is rendered where the person is, with each live booking or job
 * named and linked: "finish your work first" is not actionable on its own.
 *
 * A refusal can also arrive after the screen was drawn — somebody sends a request
 * from their phone while this page is open — so the blocked panel carries its own
 * "Check again": the person fixes the obligation in the tab beside this one and
 * re-reads the answer here, instead of hunting for a way back to this screen.
 */
export function DeleteAccountPanel({
  blockers,
  retainedBookings,
  purgeAfterDays,
  hasPassword,
}: {
  blockers: DeletionBlocker[];
  retainedBookings: number;
  purgeAfterDays: number;
  hasPassword: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [live, setLive] = useState<DeletionBlocker[]>(blockers);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = live.length > 0;
  const ready = phrase.trim() === 'DELETE' && (!hasPassword || password.length > 0) && !pending;

  /*
   * Re-reads the server's answer without leaving the screen. When the last
   * obligation is gone, the confirmation form comes back with what was typed
   * still in it, so the person finishes what they started.
   */
  async function checkAgain() {
    if (checking) return;
    setChecking(true);
    try {
      const response = await fetch('/api/account', { cache: 'no-store' });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};

      if (!response.ok || !Array.isArray(body.blockers)) {
        setError('That check did not go through. Try again.');
        return;
      }

      const next = body.blockers as DeletionBlocker[];
      setLive(next);
      if (next.length === 0) {
        setError(null);
        setOpen(true);
      }
    } catch {
      setError('The request did not reach the server. Check your connection and try again.');
    } finally {
      setChecking(false);
    }
  }

  async function remove() {
    if (!ready) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          confirmation: 'DELETE',
          ...(hasPassword ? { password } : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};

      if (response.status === 409 && Array.isArray(body.blockers)) {
        setLive(body.blockers as DeletionBlocker[]);
        setError(typeof body.message === 'string' ? body.message : 'That account still has live work.');
        return;
      }
      if (!response.ok) {
        setError(typeof body.message === 'string' ? body.message : 'The account could not be deleted.');
        return;
      }

      // The session is gone; a full navigation is the honest way to leave a page
      // that no longer has a signed-in viewer.
      window.location.assign('/?deleted=1');
    } catch {
      setError('The request did not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="delete-panel">
      {!blocked && (
        <dl className="delete-facts">
          <div>
            <dt>Deleted now</dt>
            <dd>Name, email, password, preferences, profile, listings, photos, notifications.</dd>
          </div>
          <div>
            <dt>Kept {purgeAfterDays} days</dt>
            <dd>
              {retainedBookings > 0
                ? `${retainedBookings} finished ${retainedBookings === 1 ? 'booking' : 'bookings'} and messages stay readable to the other person, shown as “Deleted account”.`
                : 'Nothing is shared with anyone else, so nothing is retained.'}
            </dd>
          </div>
          <div>
            <dt>Then erased</dt>
            <dd>
              Account row removed; the other person’s finished bookings keep their title and
              reference.
            </dd>
          </div>
        </dl>
      )}

      {blocked && (
        <div className="delete-blockers" role="alert">
          <p className="delete-blockers-title">This account still has work in flight</p>
          <p className="delete-blockers-note">
            Finish or cancel each one, then check again — deleting mid-booking strands the other
            person.
          </p>
          <ul className="delete-blocker-list">
            {live.map((blocker) => (
              <li key={`${blocker.kind}:${blocker.reference}`}>
                <Link
                  className="delete-blocker"
                  href={blocker.kind === 'booking' ? '/account/requests' : `/account/jobs/${blocker.reference}`}
                >
                  <span className="delete-blocker-title">{blocker.title}</span>
                  <span className="delete-blocker-state">{humanStatus(blocker.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="delete-actions">
            <button
              type="button"
              className="set-secondary"
              onClick={() => void checkAgain()}
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Check again'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="job-field-error" role="alert">
          {error}
        </p>
      )}

      {!open && !blocked && (
        <button type="button" className="set-secondary delete-open" onClick={() => setOpen(true)}>
          Delete this account
        </button>
      )}

      {open && !blocked && (
        <div className="delete-confirm">
          <div className="delete-field">
            <label htmlFor="delete-phrase">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="delete-phrase"
              type="text"
              value={phrase}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setPhrase(event.target.value)}
            />
          </div>

          {hasPassword && (
            <div className="delete-field">
              <label htmlFor="delete-password">Your current password</label>
              <input
                id="delete-password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          )}

          <div className="delete-actions">
            <button
              type="button"
              className="button delete-submit"
              disabled={!ready}
              onClick={() => void remove()}
            >
              {pending ? 'Deleting…' : 'Delete my account'}
            </button>
            <button
              type="button"
              className="set-secondary"
              onClick={() => {
                setOpen(false);
                setPhrase('');
                setPassword('');
                setError(null);
              }}
            >
              Keep my account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function humanStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
