'use client';

import type { ReactNode } from 'react';
import { AppShell, type ShellAccount } from './app-shell';

/**
 * The frame for a page that also has to work before there is an account.
 *
 * Every product page under `(app)` sits inside the signed-in layout, which is
 * where the session guard lives — so a listing's own page cannot live there: a
 * signed-out visitor following a service from the storefront would be bounced
 * into the sign-in dialog, which is not how a shop treats a browser.
 *
 * So this page renders the same frame from its own server read, and signs in
 * through the storefront's existing door (`/?signin=1`) rather than growing a
 * second copy of the auth dialog. The placeholder role here is only the frame:
 * the page's content is still rendered on the server and passed through.
 */
export function PublicShell({
  account,
  requestCount,
  children,
}: {
  /** The signed-in account, or `null` for a visitor. */
  account: ShellAccount | null;
  requestCount: number;
  children: ReactNode;
}) {
  return (
    <AppShell
      account={account}
      requestCount={requestCount}
      onSignIn={() => window.location.assign('/?signin=1')}
    >
      {children}
    </AppShell>
  );
}
