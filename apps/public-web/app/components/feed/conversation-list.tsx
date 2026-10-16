'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChatIcon } from '@/app/components/icons';
import { formatDayShort } from '@/lib/format';

export type ConversationSummary = {
  bookingId: string;
  providerName: string;
  serviceTitle: string;
  lastMessage: string;
  updatedAt: string;
  unread?: boolean;
};

/**
 * The conversation list — one row per booking, newest first.
 *
 * It carries only what a message list needs: who, what it is about, the last
 * line, and when. The active row is marked from the pathname rather than from
 * state, so the list and the open thread can never disagree about which one is
 * showing. Reference numbers and booking status stay in the thread itself.
 */
export function ConversationList({ conversations }: { conversations: ConversationSummary[] }) {
  const pathname = usePathname();

  if (conversations.length === 0) {
    return (
      <div className="row-list">
        <p className="row-foot">
          No conversations yet. Send a request and the thread with your ServMate appears here.
        </p>
      </div>
    );
  }

  return (
    <ul className="pane-list" aria-label="Conversations">
      {conversations.map((conversation) => {
        const href = `/account/messages/${conversation.bookingId}`;
        const active = pathname === href;
        return (
          <li key={conversation.bookingId}>
            <Link className="conversation-row" href={href} aria-current={active ? 'page' : undefined}>
              <span className="conversation-avatar" aria-hidden="true">
                {conversation.providerName.slice(0, 1).toLocaleUpperCase()}
              </span>
              <span className="conversation-copy">
                <span className="conversation-topline">
                  <strong>{conversation.providerName}</strong>
                  <time dateTime={conversation.updatedAt}>{formatDayShort(conversation.updatedAt)}</time>
                </span>
                <span className="conversation-service">{conversation.serviceTitle}</span>
                <span className="conversation-last-message">
                  You: {conversation.lastMessage}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The blank right-hand pane: an invitation to pick a conversation. */
export function NoThreadOpen() {
  return (
    <div className="pane-blank">
      <span className="account-empty-mark" aria-hidden="true"><ChatIcon /></span>
      <h2>Pick a conversation</h2>
      <p>Choose a ServMate on the left, or start a new request to begin one.</p>
      <Link className="button button-primary" href="/home">Browse local services</Link>
    </div>
  );
}
