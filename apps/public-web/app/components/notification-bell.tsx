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
 * count is fetched once and refreshed on navigation. A failure leaves the badge
 * off rather than showing a wrong number: the count is a courtesy, and the
 * account page is the authority on what is actually unread.
 */
export function NotificationBell() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const active = pathname.startsWith('/account/notifications');

  return (
    <Link
      href="/account/notifications"
      className="app-top-action"
      aria-current={active ? 'page' : undefined}
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
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
