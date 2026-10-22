'use client';

import { useEffect, useState } from 'react';
import { AuthDialog } from '@/app/components/auth-dialog';
import type { AuthMode } from '@/app/components/auth-dialog';
import { CloseIcon } from '@/app/components/icons';
import type { FeedService } from '@/lib/feed-data';
import type { SortPreference } from '@/lib/preferences';
import { AppShell, type ShellAccount } from './app-shell';
import { EcommerceHome } from './ecommerce-home';

/**
 * The public front door: the shell's own feed with the sign-in apparatus the
 * old storefront used to own.
 *
 * One component serves both sessions, so `/` and `/home` can never grow into
 * two products again. Signed out, it opens the dialog that every gated page in
 * the app bounces visitors to (`/?signin=1`), shows the OAuth outcome once and
 * then clears it from the URL, and hands `onSignIn` to the frame and the
 * booking sheet so any "sign in" control anywhere on the screen opens the same
 * dialog. A successful sign-in still ends in a full navigation to `/home`,
 * exactly where the old storefront sent people.
 */
export function Storefront({
  account,
  requestCount,
  listings,
  initialQuery,
  initialArea,
  initialSort,
  initialService,
  notice,
  signInIntent,
}: {
  /** `null` for a signed-out visitor; the account's name when there is one. */
  account: ShellAccount | null;
  requestCount: number;
  listings: FeedService[];
  initialQuery: string;
  initialArea: string;
  initialSort: SortPreference;
  /** A listing to open on arrival, from a `?service=` link. */
  initialService: string;
  /** The OAuth outcome, already mapped to a sentence on the server. */
  notice: string;
  /** `?signin=1` — a bounce from a gated page, so the dialog belongs open. */
  signInIntent: boolean;
}) {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [message, setMessage] = useState(notice);

  /*
   * The outcome and the redirect intent arrive in the query string. Show them
   * once, then drop them so a refresh or a shared link does not replay the
   * message or re-open the dialog.
   */
  useEffect(() => {
    if (!notice && !signInIntent) return;
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ['auth', 'auth_error', 'signin', 'deleted']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [notice, signInIntent]);

  useEffect(() => {
    // A bounce from a gated page lands here signed out — that is the dialog's
    // whole reason to exist. Someone who is already signed in never sees it.
    if (!signInIntent || account) return;
    setAuthMode('signin');
    setAuthOpen(true);
  }, [signInIntent, account]);

  function openSignIn() {
    setAuthMode('signin');
    setMessage('');
    setAuthOpen(true);
  }

  function handleAuthenticated() {
    // A full navigation, not a fetch: the server guard on /home has to see the
    // fresh session cookie before the shell renders as signed in.
    window.location.assign('/home');
  }

  return (
    <>
      <AppShell account={account} requestCount={requestCount} onSignIn={openSignIn}>
        <EcommerceHome
          listings={listings}
          initialQuery={initialQuery}
          initialArea={initialArea}
          initialSort={initialSort}
          initialService={initialService}
          signedOut={account === null}
          onSignIn={openSignIn}
        />
      </AppShell>

      {message && (
        <div className="toast" role="status" aria-live="polite">
          <span>{message}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => setMessage('')}>
            <CloseIcon />
          </button>
        </div>
      )}

      <AuthDialog
        open={authOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </>
  );
}
