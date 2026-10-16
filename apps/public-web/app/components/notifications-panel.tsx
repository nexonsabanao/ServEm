'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Notification } from '@/lib/notifications';

/**
 * The account's notifications, with their read state.
 *
 * Opening one marks it read, and the button marks the whole feed; both are
 * optimistic on the server's answer only — the count shown is whatever the API
 * reported, never a number this component invented. If a call fails the row
 * stays unread, which is the honest outcome: the record really is still unread.
 */
export function NotificationsPanel({
  items,
  unreadCount,
}: {
  items: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [read, setRead] = useState<Record<string, true>>({});
  const [unread, setUnread] = useState(unreadCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markRead(id?: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(id ? { id } : {}),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};
      if (!response.ok) {
        setError(typeof body.message === 'string' ? body.message : 'That could not be marked read.');
        return;
      }
      if (typeof body.unreadCount === 'number') setUnread(body.unreadCount);
      if (id) setRead((current) => ({ ...current, [id]: true }));
      else {
        setRead(Object.fromEntries(items.map((item) => [item.id, true as const])));
      }
      router.refresh();
    } catch {
      setError('That could not be marked read. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="account-empty">
        <span className="account-empty-mark" aria-hidden="true">
          ✳
        </span>
        <h1>Alerts</h1>
        <p>Offers on your jobs, work updates and reviews land here — and on the booking itself.</p>
      </div>
    );
  }

  return (
    <>
      <div className="account-section-head">
        <div>
          <h1 id="notifications-title">Alerts</h1>
          <p className="account-section-lede">
            {unread === 0 ? 'Everything here is read.' : `${unread} unread.`}
          </p>
        </div>
        <button
          type="button"
          className="quiet-button"
          disabled={pending || unread === 0}
          onClick={() => markRead()}
        >
          {pending ? 'Marking…' : 'Mark all read'}
        </button>
      </div>

      {error && (
        <p className="job-field-error" role="alert">
          {error}
        </p>
      )}

      <ul className="order-list">
        {items.map((item) => {
          const isUnread = !item.readAt && !read[item.id];
          return (
            <li key={item.id} className={`order-row notif-row ${isUnread ? 'is-unread' : ''}`}>
              <div className="order-when">
                <strong>{when(item.createdAt)}</strong>
                <span>{isUnread ? 'Unread' : 'Read'}</span>
              </div>
              <div className="order-what">
                <span className="order-ref">{labelFor(item.type)}</span>
                <h3>
                  <Link
                    className="order-title-link"
                    href={item.href}
                    onClick={() => {
                      if (isUnread) void markRead(item.id);
                    }}
                  >
                    {item.title}
                  </Link>
                </h3>
                {item.detail && <p className="order-brief">{item.detail}</p>}
              </div>
              <div className="order-state">
                <Link className="quiet-button" href={item.href}>
                  Open
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** A short, stable tag per notification type — the grouping a person scans for. */
function labelFor(type: string): string {
  switch (type) {
    case 'offer_received':
      return 'New offer';
    case 'offer_accepted':
      return 'Offer accepted';
    case 'offer_declined':
      return 'Offer declined';
    case 'booking_started':
      return 'Work started';
    case 'completion_requested':
      return 'Awaiting your confirmation';
    case 'booking_confirmed':
      return 'Work confirmed';
    case 'booking_cancelled':
      return 'Cancelled';
    case 'review_received':
      return 'Review';
    default:
      return 'Update';
  }
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
