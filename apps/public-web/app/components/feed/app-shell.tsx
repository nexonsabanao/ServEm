'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BagIcon,
  ChatIcon,
  ChevronDownIcon,
  DocketIcon,
  GearIcon,
  HomeIcon,
  SearchIcon,
  UserIcon,
} from '@/app/components/icons';
import { firstLetter } from '@/lib/feed-data';
import { SignOutButton } from '@/app/components/sign-out-button';

export type ShellAccount = { name: string; email: string };

/** Tracks a CSS media query without a hydration mismatch (initial = false). */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 861px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

/**
 * The one app shell every signed-in page lives inside: Home, My requests and
 * Account all share this top bar, so navigation never drops you back on the
 * public landing page. The brand always returns to /home, search always runs
 * against /home, and the account menu reaches every account route.
 */
export function AppShell({
  account,
  requestCount,
  searchQuery = '',
  children,
}: {
  account: ShellAccount;
  requestCount: number;
  searchQuery?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <TopBar account={account} requestCount={requestCount} searchQuery={searchQuery} />
      <div className="app-shell-body">{children}</div>
      <MobileNav requestCount={requestCount} />
    </div>
  );
}

function TopBar({ account, requestCount, searchQuery }: { account: ShellAccount; requestCount: number; searchQuery: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const initial = firstLetter(account.name);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <Link href="/home" className="app-brand" aria-label="ServEm home">
          <span className="app-brand-mark" aria-hidden="true">S</span>
          <span className="app-brand-word">servem</span>
        </Link>

        <form key={searchQuery} className="app-topsearch" action="/home" method="get" role="search">
          <span className="app-topsearch-icon" aria-hidden="true"><SearchIcon /></span>
          <span className="visually-hidden">Search services</span>
          <input type="search" name="q" autoComplete="off" maxLength={80} defaultValue={searchQuery} placeholder="Search services" aria-label="Search services" />
        </form>

        <div className="app-topbar-actions">
          <Link href="/account/messages" className="app-top-action app-messages-action" aria-current={pathname.startsWith('/account/messages') ? 'page' : undefined} aria-label="Messages with ServMates">
            <ChatIcon />
            <span className="app-top-action-label">Messages</span>
          </Link>
          <Link href="/account/requests" className="app-top-action app-request-action" aria-current={pathname.startsWith('/account/requests') ? 'page' : undefined} aria-label={`My requests, ${requestCount} total`}>
            <BagIcon />
            <span className="app-top-action-label">Requests</span>
            {requestCount > 0 && <span className="app-top-badge">{requestCount}</span>}
          </Link>

          {isDesktop && (
            <div className="app-account">
              <button
                type="button"
                className="app-account-trigger"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className="app-account-avatar" aria-hidden="true">{initial}</span>
                <span className="app-account-name">{account.name.split(' ')[0]}</span>
                <span className="app-account-caret" aria-hidden="true"><ChevronDownIcon /></span>
              </button>

              {menuOpen && (
                <div className="app-account-menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                  <div className="app-account-id">
                    <strong>{account.name}</strong>
                    <span>{account.email}</span>
                  </div>
                  <Link href="/account" role="menuitem" aria-current={pathname === '/account' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                    <UserIcon /> My account
                  </Link>
                  <Link href="/account/profile" role="menuitem" aria-current={pathname.startsWith('/account/profile') ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                    <UserIcon /> Profile
                  </Link>
                  <Link href="/account/settings" role="menuitem" aria-current={pathname.startsWith('/account/settings') ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                    <GearIcon /> Settings
                  </Link>
                  <Link href="/servmate" role="menuitem" aria-current={pathname.startsWith('/servmate') ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                    <DocketIcon /> ServMate workbench
                  </Link>
                  <div className="app-account-signout">
                    <SignOutButton className="app-signout" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MobileNav({ requestCount }: { requestCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="app-bottomnav" aria-label="Primary">
      <Link href="/home" className="app-bottomnav-item" aria-current={pathname === '/home' ? 'page' : undefined}>
        <span className="app-bottomnav-icon"><HomeIcon /></span>
        <span className="app-bottomnav-label">Home</span>
      </Link>
      <Link href="/account/messages" className="app-bottomnav-item" aria-current={pathname.startsWith('/account/messages') ? 'page' : undefined}>
        <span className="app-bottomnav-icon"><ChatIcon /></span>
        <span className="app-bottomnav-label">Messages</span>
      </Link>
      <Link href="/account/requests" className="app-bottomnav-item" aria-current={pathname.startsWith('/account/requests') ? 'page' : undefined}>
        <span className="app-bottomnav-icon">
          <BagIcon />
          {requestCount > 0 && <span className="app-bottomnav-badge">{requestCount}</span>}
        </span>
        <span className="app-bottomnav-label">Requests</span>
      </Link>
      <Link href="/account" className="app-bottomnav-item" aria-current={pathname === '/account' || pathname.startsWith('/account/profile') ? 'page' : undefined}>
        <span className="app-bottomnav-icon"><UserIcon /></span>
        <span className="app-bottomnav-label">Account</span>
      </Link>
    </nav>
  );
}
