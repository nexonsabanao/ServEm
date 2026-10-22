'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BellIcon } from '@/app/components/icons';

const MAX_SHOWN = 9;

/**
 * The unread count as a badge on the shell.
 *
 * The shell is rendered per page and does not know about notifications, so the
 * count is fetched on navigation and then on a slow clock (and whenever the tab
 * comes back into view) — an offer can arrive while somebody is reading. A
 * failure leaves the badge off rather than showing a wrong number: the count is
 * a courtesy, and the account page is the authority on what is actually unread.
 */
export function NotificationBell() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/notifications', { cache: 'no-store' });
        if (!response.ok) return;
        const payload: unknown = await response.json().catch(() => null);
        const count =
          isRecord(payload) && typeof payload.unreadCount === 'number' ? payload.unreadCount : 0;
        if (!cancelled) setUnread(count);
      } catch {
        // Offline or the session ended: the badge is simply not shown.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') void load();
    }

    void load();
    const timer = setInterval(load, 45_000);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);

  const active = pathname.startsWith('/account/notifications');

  return (
    <Link
      href="/account/notifications"
      className="app-top-action"
      aria-current={active ? 'page' : undefined}
      // The accessible name starts with the visible word "Alerts" so speech
      // control can say what the button says (WCAG 2.5.3). It is set even at
      // zero unread, because the word itself is CSS-hidden in the icon-only
      // widths (≤1080px — see the NAVIGATION section of feed.css) and would
      // otherwise leave the button unnamed.
      aria-label={
        unread > 0 ? `Alerts, ${unread > MAX_SHOWN ? `${MAX_SHOWN}+` : unread} unread` : 'Alerts'
      }
    >
      <BellIcon />
      <span className="app-top-action-label">Alerts</span>
      {unread > 0 && (
        <span className="app-top-badge">{unread > MAX_SHOWN ? `${MAX_SHOWN}+` : unread}</span>
      )}
    </Link>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
