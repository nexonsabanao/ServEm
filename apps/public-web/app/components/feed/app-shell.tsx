'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { type ComponentType, type MouseEvent } from 'react';
import {
  BagIcon,
  BookmarkIcon,
  ChatIcon,
  ChevronRightIcon,
  DocketIcon,
  GearIcon,
  HomeIcon,
  UserIcon,
} from '@/app/components/icons';
import { firstLetter } from '@/lib/feed-data';
import { InstallPrompt } from '@/app/components/install-prompt';
import { NotificationBell } from '@/app/components/notification-bell';
import { SignOutButton } from '@/app/components/sign-out-button';
import { SearchCombobox } from './search-combobox';

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
 * A link to the URL already open would only stack a history entry, so Back walks
 * through copies of the same screen. A link that would change the query — a rail
 * item re-pointing at the filtered page you are on — still navigates, and
 * modifier-clicks still open a tab.
 */
function skipIfCurrent(event: MouseEvent<HTMLAnchorElement>, href: string) {
  const target = new URL(href, window.location.href);
  const sameUrl =
    target.pathname === window.location.pathname &&
    target.search === window.location.search &&
    target.hash === window.location.hash;
  if (!sameUrl) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
}

/**
 * The rail's destinations, in the order a person actually uses them: home,
 * then the conversations and requests already in flight, then the work they
 * lead to. Search is deliberately not one of them — the top-bar field *is* the
 * search on every screen, and the phone tabs never carried it either, so a rail
 * entry only gave the same feature two doors. Home follows the session: a
 * signed-in account goes to `/home`, everyone else to the storefront at `/`,
 * so a signed-out click never lands in the sign-in guard.
 */
const primary = (homeHref: string): Destination[] => [
  { href: homeHref, label: 'Home', icon: HomeIcon, owns: (pathname) => pathname === '/' || pathname.startsWith('/home') },
  { href: '/shortlist', label: 'Shortlist', icon: BookmarkIcon, owns: under('/shortlist') },
  { href: '/account/messages', label: 'Messages', icon: ChatIcon, owns: under('/account/messages') },
  { href: '/account/requests', label: 'Requests', icon: BagIcon, owns: under('/account/requests') },
  { href: '/account/jobs', label: 'Jobs', icon: DocketIcon, owns: under('/account/jobs') },
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

/**
 * The one app frame every screen lives inside — signed in, and on the public
 * storefront too, where it shows a sign-in door instead of an account menu.
 *
 * One set of destinations, three ways of showing it: a rail beside the content
 * on a wide screen, a tab bar under the thumb on a phone, and a search field in
 * the top bar that is the same control everywhere. Which one a width gets is
 * decided in exactly one place — the NAVIGATION section of `app/feed.css` — and
 * not here: this component only marks home on the shell, and the CSS reads that
 * mark. A screen never invents its own navigation, so moving between the
 * marketplace, a conversation, a job and the provider console always keeps the
 * same frame around you.
 */
export function AppShell({
  account,
  requestCount,
  onSignIn,
  children,
}: {
  /** `null` on the signed-out storefront at `/`. */
  account: ShellAccount | null;
  requestCount: number;
  /** Opens the sign-in dialog; only the storefront passes this. */
  onSignIn?: () => void;
  children: React.ReactNode;
}) {
  /*
   * The field is the URL's `q`, wherever you are. The shell owns the form, so it
   * owns what the form shows, and no page has to hand its query up to the frame.
   */
  const searchQuery = useSearchParams().get('q')?.slice(0, 80) ?? '';
  const pathname = usePathname();
  /*
   * On a phone the whole top bar belongs to the home feed (`/` and `/home`).
   * Every other screen starts at its own heading and moves through the bottom
   * tabs, rather than giving the first 60px to a brand and a search field.
   * A wide screen keeps the bar everywhere: there the rail and the search are
   * the frame, not a strip competing with the page.
   */
  const isHomeView = pathname === '/' || pathname === '/home';
  /*
   * Where "home" points follows the session: `/home` has a guard that bounces
   * signed-out visitors to `/?signin=1`, and the logo or a Home link should
   * never be what triggers it — only a genuinely gated page should.
   */
  const homeHref = account ? '/home' : '/';

  return (
    <div className={`app-shell${isHomeView ? ' is-home-view' : ''}`}>
      <TopBar account={account} homeHref={homeHref} onSignIn={onSignIn} searchQuery={searchQuery} />
      {/*
       * The install moment, when the browser has one to offer. It sits in the
       * content column rather than the top bar, so it never competes with the
       * search field or the navigation for space at any width.
       */}
      <InstallPrompt />
      <div className="app-shell-body">
        <SideRail account={account} homeHref={homeHref} requestCount={requestCount} />
        <main className="app-shell-main">{children}</main>
      </div>
      <MobileNav homeHref={homeHref} requestCount={requestCount} />
    </div>
  );
}

function TopBar({
  account,
  homeHref,
  onSignIn,
  searchQuery,
}: {
  account: ShellAccount | null;
  /** Where the logo points: the guarded `/home`, or the storefront. */
  homeHref: string;
  onSignIn?: () => void;
  searchQuery: string;
}) {
  return (
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <Link
          href={homeHref}
          className="app-brand"
          aria-label="ServEm home"
          onClick={(event) => skipIfCurrent(event, homeHref)}
        >
          <span className="app-brand-mark" aria-hidden="true">S</span>
          <span className="app-brand-word">servem</span>
        </Link>

        {/* A real form underneath, so search works before any JavaScript runs.
            Signed out, it filters the storefront itself — that is the search
            the public home has always had. */}
        <SearchCombobox
          action={account ? '/search' : '/'}
          query={searchQuery}
          placeholder="Search services"
        />

        <div className="app-topbar-actions">
          {account && <NotificationBell />}
          {!account && (
            <button type="button" className="app-signin" onClick={() => onSignIn?.()}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function SideRail({
  account,
  homeHref,
  requestCount,
}: {
  account: ShellAccount | null;
  homeHref: string;
  requestCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar" aria-label="Sections">
      <RailGroup items={primary(homeHref)} pathname={pathname} badges={{ '/account/requests': requestCount }} />
      {/*
       * Every destination below this point is gated: a signed-out click would
       * only bounce back to `/?signin=1` with the sign-in dialog open. The
       * storefront rail therefore shows the sections that actually work — the
       * account a guard protects appears once there is an account to protect.
       */}
      {account && (
        <>
          <p className="app-sidebar-label" id="rail-yours">Your account</p>
          <RailGroup items={YOURS} pathname={pathname} labelledBy="rail-yours" />
          <p className="app-sidebar-label" id="rail-selling">Selling on ServEm</p>
          <RailGroup items={SELLING} pathname={pathname} labelledBy="rail-selling" />
        </>
      )}

      {account && (
        <div className="app-sidebar-foot">
          <Link href="/account/settings" className="app-sidebar-me">
            <span className="app-sidebar-me-avatar" aria-hidden="true">{firstLetter(account.name)}</span>
            <span className="app-sidebar-me-name">{account.name.split(' ')[0]}</span>
            <span className="app-sidebar-me-caret" aria-hidden="true"><ChevronRightIcon /></span>
          </Link>
          <SignOutButton className="app-sidebar-signout" />
        </div>
      )}
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
              onClick={(event) => skipIfCurrent(event, item.href)}
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

function MobileNav({ homeHref, requestCount }: { homeHref: string; requestCount: number }) {
  const pathname = usePathname();
  const guard = (href: string) => (event: MouseEvent<HTMLAnchorElement>) =>
    skipIfCurrent(event, href);

  return (
    <nav className="app-bottomnav" aria-label="Primary">
      <Link href={homeHref} className="app-bottomnav-item" aria-current={pathname === '/' || pathname === '/home' ? 'page' : undefined} onClick={guard(homeHref)}>
        <span className="app-bottomnav-icon"><HomeIcon /></span>
        <span className="app-bottomnav-label">Home</span>
      </Link>
      <Link href="/account/messages" className="app-bottomnav-item" aria-current={pathname.startsWith('/account/messages') ? 'page' : undefined} onClick={guard('/account/messages')}>
        <span className="app-bottomnav-icon"><ChatIcon /></span>
        <span className="app-bottomnav-label">Messages</span>
      </Link>
      <Link href="/account/requests" className="app-bottomnav-item" aria-current={pathname.startsWith('/account/requests') ? 'page' : undefined} onClick={guard('/account/requests')}>
        <span className="app-bottomnav-icon">
          <BagIcon />
          {requestCount > 0 && <span className="app-bottomnav-badge">{requestCount}</span>}
        </span>
        <span className="app-bottomnav-label">Requests</span>
      </Link>
      <Link href="/account/jobs" className="app-bottomnav-item" aria-current={pathname.startsWith('/account/jobs') ? 'page' : undefined} onClick={guard('/account/jobs')}>
        <span className="app-bottomnav-icon"><DocketIcon /></span>
        <span className="app-bottomnav-label">Jobs</span>
      </Link>
      <Link href="/account" className="app-bottomnav-item" aria-current={pathname === '/account' ? 'page' : undefined} onClick={guard('/account')}>
        <span className="app-bottomnav-icon"><UserIcon /></span>
        <span className="app-bottomnav-label">You</span>
      </Link>
    </nav>
  );
}
