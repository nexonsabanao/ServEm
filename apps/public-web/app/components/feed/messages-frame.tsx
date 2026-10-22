'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LiveRefresh } from '@/app/components/live-refresh';

/**
 * The messages frame: the thread list beside the conversation that is open.
 *
 * On a wide screen both panes are always visible, which is how a message app
 * behaves — you read a conversation without losing the list. On a phone there is
 * only room for one, so the list steps aside once a conversation is open and the
 * thread's own back link brings it back. The pathname decides which of the two
 * states the page is in; nothing here holds message state.
 */
export function MessagesFrame({
  list,
  children,
  empty = false,
}: {
  list: ReactNode;
  children: ReactNode;
  /** No conversations at all: one invitation instead of a list beside a blank. */
  empty?: boolean;
}) {
  const pathname = usePathname();
  const threadOpen = pathname !== '/account/messages';

  return (
    <div className="pane" data-thread={threadOpen ? 'open' : undefined} data-empty={empty ? 'true' : undefined}>
      {/* A reply from the other side arrives without a reload; the thread and
          the list are one server render, so one refresh updates both. */}
      <LiveRefresh intervalMs={15_000} />
      {list}
      <div className="pane-main">{children}</div>
    </div>
  );
}
