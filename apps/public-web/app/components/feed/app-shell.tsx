'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import {
  BagIcon,
  BellIcon,
  ChatIcon,
  ChevronRightIcon,
  DocketIcon,
  GearIcon,
  HomeIcon,
  SearchIcon,
  UserIcon,
} from '@/app/components/icons';
import { firstLetter } from '@/lib/feed-data';
import { NotificationBell } from '@/app/components/notification-bell';
import { SignOutButton } from '@/app/components/sign-out-button';

/**
 * What the frame knows about you: a name to greet you by, and nothing else.
 *
 * The email deliberately never reaches the shell. Everything the shell renders is
 * in every signed-in page's payload, and the one place an address belongs is
 * Settings — passing it here would put it in the source of every screen.
 */
export type ShellAccount = { name: string };

type Destination = {
  href: string;
  label: string;
  icon: ComponentType;
  /** Whether the path this page is on belongs to this destination. */
  owns: (pathname: string) => boolean;
};

const under = (base: string) => (pathname: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/**
 * The rail's destinations, in the order a person actually uses them: find work,
 * watch your own work, then the account that owns both.
 */
const PRIMARY: Destination[] = [
  { href: '/home', label: 'Home', icon: HomeIcon, owns: under('/home') },
  { href: '/search', label: 'Search', icon: SearchIcon, owns: under('/search') },
  { href: '/account/messages', label: 'Messages', icon: ChatIcon, owns: under('/account/messages') },
  { href: '/account/requests', label: 'Requests', icon: BagIcon, owns: under('/account/requests') },
  { href: '/account/jobs', label: 'Jobs', icon: DocketIcon, owns: under('/account/jobs') },
  { href: '/account/notifications', label: 'Alerts', icon: BellIcon, owns: under('/account/notifications') },
];

const YOURS: Destination[] = [
  { href: '/account', label: 'Your account', icon: UserIcon, owns: (pathname) => pathname === '/account' },
  { href: '/account/profile', label: 'Profile', icon: UserIcon, owns: under('/account/profile') },
  { href: '/account/settings', label: 'Settings', icon: GearIcon, owns: under('/account/settings') },
];

const SELLING: Destination[] = [
  { href: '/servmate', label: 'ServMate console', icon: DocketIcon, owns: (pathname) => pathname === '/servmate' },
  { href: '/servmate/jobs', label: 'Jobs to offer on', icon: BagIcon, owns: under('/servmate/jobs') },
];

/** Tracks a CSS media query without a hydration mismatch (initial = false). */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1001px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

/**
 * The one app frame every signed-in screen lives inside.
 *
 * One set of destinations, three ways of showing it: a rail beside the content
 * on a wide screen, a tab bar under the thumb on a phone, and a search field in
 * the top bar that is the same control everywhere. A screen never invents its
 * own navigation, so moving between the marketplace, a conversation, a job and
 * the provider console always keeps the same frame around you.
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
      <div className="app-shell-body">
        <SideRail account={account} requestCount={requestCount} />
        <main className="app-shell-main">{children}</main>
      </div>
      <MobileNav requestCount={requestCount} />
    </div>
  );
}

function TopBar({
  account,
  searchQuery,
}: {
  account: ShellAccount;
  requestCount: number;
  searchQuery: string;
}) {
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

        {/* A real form, so search works before any JavaScript runs. */}
        <form key={searchQuery} className="app-topsearch" action="/search" method="get" role="search">
          <span className="app-topsearch-icon" aria-hidden="true"><SearchIcon /></span>
          <label className="visually-hidden" htmlFor="app-search">Search services and ServMates</label>
          <input
            id="app-search"
            type="search"
            name="q"
            autoComplete="off"
            maxLength={80}
            defaultValue={searchQuery}
            placeholder="Search services"
          />
        </form>

        <div className="app-topbar-actions">
          <NotificationBell />
          {isDesktop && (
            <div className="app-account">
              <button
                type="button"
                className="app-account-trigger"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Your account"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className="app-account-avatar" aria-hidden="true">{initial}</span>
              </button>

              {menuOpen && (
                <div className="app-account-menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                  <div className="app-account-id">
                    <strong>{account.name}</strong>
                    <span>Account details are in Settings</span>
                  </div>
                  <Link href="/account" role="menuitem" aria-current={pathname === '/account' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                    <UserIcon /> Your account
                  </Link>
                  <Link href="/account/profile" role="menuitem" onClick={() => setMenuOpen(false)}>
                    <UserIcon /> Profile
                  </Link>
                  <Link href="/account/settings" role="menuitem" onClick={() => setMenuOpen(false)}>
                    <GearIcon /> Settings
                  </Link>
                  <Link href="/servmate" role="menuitem" onClick={() => setMenuOpen(false)}>
                    <DocketIcon /> ServMate console
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

function SideRail({ account, requestCount }: { account: ShellAccount; requestCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar" aria-label="Sections">
      <RailGroup items={PRIMARY} pathname={pathname} badges={{ '/account/requests': requestCount }} />
      <p className="app-sidebar-label" id="rail-yours">Your account</p>
      <RailGroup items={YOURS} pathname={pathname} labelledBy="rail-yours" />
      <p className="app-sidebar-label" id="rail-selling">Selling on ServEm</p>
      <RailGroup items={SELLING} pathname={pathname} labelledBy="rail-selling" />

      <div className="app-sidebar-foot">
        <Link href="/account/settings" className="app-sidebar-me">
          <span className="app-sidebar-me-avatar" aria-hidden="true">{firstLetter(account.name)}</span>
          <span className="app-sidebar-me-name">{account.name.split(' ')[0]}</span>
          <span className="app-sidebar-me-caret" aria-hidden="true"><ChevronRightIcon /></span>
        </Link>
        <SignOutButton className="app-sidebar-signout" />
      </div>
    </nav>
  );
}

function RailGroup({
  items,
  pathname,
  badges = {},
  labelledBy,
}: {
  items: Destination[];
  pathname: string;
  badges?: Record<string, number>;
  labelledBy?: string;
}) {
  return (
    <ul className="app-sidebar-list" aria-labelledby={labelledBy}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.owns(pathname);
        const badge = badges[item.href] ?? 0;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="app-sidebar-link"
              aria-current={active ? 'page' : undefined}
            >
              <span className="app-sidebar-icon" aria-hidden="true"><Icon /></span>
              <span className="app-sidebar-name">{item.label}</span>
              {badge > 0 && <span className="app-sidebar-count">{badge}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
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
      <Link href="/account/jobs" className="app-bottomnav-item" aria-current={pathname.startsWith('/account/jobs') ? 'page' : undefined}>
        <span className="app-bottomnav-icon"><DocketIcon /></span>
        <span className="app-bottomnav-label">Jobs</span>
      </Link>
      <Link href="/account" className="app-bottomnav-item" aria-current={pathname === '/account' ? 'page' : undefined}>
        <span className="app-bottomnav-icon"><UserIcon /></span>
        <span className="app-bottomnav-label">You</span>
      </Link>
    </nav>
  );
}
