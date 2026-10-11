'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRightIcon } from '@/app/components/icons';
import type { Conversation } from '@/lib/conversations';

const MESSAGE_LIMIT = 4000;
const MESSAGE_TIME = new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
});

export function MessageThread({ conversation }: { conversation: Conversation }) {
  const router = useRouter();
  const [messages, setMessages] = useState(conversation.messages);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!draft.trim()) {
      setError('Write a message to your ServMate.');
      return;
    }

    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(conversation.bookingId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ message: draft }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

      if (!response.ok) {
        setError(typeof body.message === 'string' ? body.message : 'That message could not be saved. Try again.');
        return;
      }

      const message = body.message && typeof body.message === 'object'
        ? (body.message as Record<string, unknown>)
        : null;
      if (
        !message ||
        typeof message.id !== 'string' ||
        typeof message.body !== 'string' ||
        typeof message.createdAt !== 'string'
      ) {
        setError('The server returned an unexpected response. Try again.');
        return;
      }

      setMessages((previous) => [
        ...previous,
        {
          id: message.id as string,
          sender: 'customer' as const,
          body: message.body as string,
          createdAt: message.createdAt as string,
        },
      ]);
      setDraft('');
      router.refresh();
    } catch {
      setError('That message could not be saved. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="message-thread" aria-labelledby="thread-title">
      <Link className="thread-back" href="/account/messages">
        <ChevronRightIcon /> Messages
      </Link>

      <header className="thread-heading">
        <span className="conversation-avatar" aria-hidden="true">
          {conversation.providerName.slice(0, 1).toLocaleUpperCase()}
        </span>
        <div>
          <p className="thread-counterpart">{conversation.providerName}</p>
          <h2 id="thread-title">{conversation.serviceTitle}</h2>
          <p className="thread-reference">{conversation.reference}{conversation.area ? ` · ${conversation.area}` : ''}</p>
        </div>
      </header>

      <p className="message-preview-note">
        Messages are saved to this local customer account. ServMate replies will appear when provider messaging is connected.
      </p>

      <ol className="thread-history" aria-label="Conversation messages" aria-live="polite">
        {messages.map((message, index) => (
          <li className="thread-message" data-sender="customer" key={message.id}>
            <div className="thread-message-meta">
              <strong>{index === 0 ? 'Your request' : 'You'}</strong>
              <time dateTime={message.createdAt}>{MESSAGE_TIME.format(new Date(message.createdAt))}</time>
            </div>
            <p>{message.body}</p>
          </li>
        ))}
      </ol>

      {conversation.status === 'requested' ? (
        <form className="thread-composer" onSubmit={(event) => void sendMessage(event)}>
          <label htmlFor="thread-message">Message your ServMate</label>
          <textarea
            id="thread-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MESSAGE_LIMIT}
            rows={3}
            placeholder="Ask a question or share more details…"
            aria-describedby={error ? 'thread-error thread-count' : 'thread-count'}
          />
          <div className="thread-composer-foot">
            <span id="thread-count">{draft.length}/{MESSAGE_LIMIT}</span>
            <button type="submit" className="thread-send" disabled={pending}>
              {pending ? 'Saving…' : 'Send message'}
            </button>
          </div>
          {error && <p className="thread-error" id="thread-error" role="alert">{error}</p>}
        </form>
      ) : (
        <p className="thread-closed" role="status">This request was withdrawn. The conversation is read-only.</p>
      )}
    </section>
  );
}
