'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChatIcon, SearchIcon } from '@/app/components/icons';
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
 *
 * The search field lives with the list because the frame's top bar is a home-
 * view affordance on a phone: this is the one search that belongs to the
 * messages screen itself, and it narrows the rows you see as you type.
 */
export function ConversationList({ conversations }: { conversations: ConversationSummary[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  /*
   * One empty state, not two. The list and the blank pane used to say the same
   * thing side by side; the frame now hides the pane when there is no thread to
   * open, so this panel is the whole screen.
   */
  if (conversations.length === 0) {
    return (
      <div className="pane-blank pane-blank-invite">
        <span className="account-empty-mark" aria-hidden="true"><ChatIcon /></span>
        <h2>No conversations yet</h2>
        <p>Send a request and the thread with your ServMate appears here.</p>
        <Link className="button button-primary" href="/home">Browse local services</Link>
      </div>
    );
  }

  const needle = query.trim().toLocaleLowerCase();
  const visible = needle
    ? conversations.filter((conversation) =>
        [conversation.providerName, conversation.serviceTitle, conversation.lastMessage].some(
          (field) => field.toLocaleLowerCase().includes(needle),
        ),
      )
    : conversations;

  return (
    <div className="conversation-pane">
      <div className="conversation-search" role="search">
        <label className="visually-hidden" htmlFor="conversation-search">Search conversations</label>
        <span className="conversation-search-icon" aria-hidden="true"><SearchIcon /></span>
        <input
          id="conversation-search"
          type="search"
          autoComplete="off"
          maxLength={60}
          placeholder="Search messages"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {visible.length === 0 ? (
        <p className="row-foot" role="status">
          No conversations match “{query.trim()}”. Try a name or a word from the thread.
        </p>
      ) : (
        <ul className="pane-list" aria-label="Conversations">
          {visible.map((conversation) => {
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
      )}
    </div>
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
