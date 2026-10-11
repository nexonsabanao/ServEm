import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChatIcon, ChevronRightIcon } from '@/app/components/icons';
import { getSessionAccount } from '@/lib/auth';
import { listConversations } from '@/lib/conversations';
import { formatDayShort } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Messages — ServEm',
};

export default async function MessagesPage() {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const conversations = await listConversations(account.id);

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="messages-title">
        <div className="account-section-head">
          <div>
            <h2 id="messages-title">Messages</h2>
            <p className="account-section-lede">Conversation history for your service requests.</p>
          </div>
          {conversations.length > 0 && <span className="preview-tag">Customer inbox preview</span>}
        </div>

        <p className="message-preview-note">
          Messages are saved to this local customer account. ServMate replies will appear when provider messaging is connected.
        </p>

        {conversations.length > 0 ? (
          <ul className="conversation-list" aria-label="Your conversations">
            {conversations.map((conversation) => (
              <li key={conversation.bookingId}>
                <Link className="conversation-row" href={`/account/messages/${conversation.bookingId}`}>
                  <span className="conversation-avatar" aria-hidden="true">
                    {conversation.providerName.slice(0, 1).toLocaleUpperCase()}
                  </span>
                  <span className="conversation-copy">
                    <span className="conversation-topline">
                      <strong>{conversation.providerName}</strong>
                      <time dateTime={conversation.updatedAt}>{formatDayShort(conversation.updatedAt)}</time>
                    </span>
                    <span className="conversation-service">{conversation.serviceTitle}</span>
                    <span className="conversation-last-message">You: {conversation.lastMessage}</span>
                    <span className="conversation-reference">
                      {conversation.reference} · {conversation.status === 'requested' ? 'Request open' : 'Withdrawn'}
                    </span>
                  </span>
                  <span className="conversation-arrow" aria-hidden="true"><ChevronRightIcon /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="account-empty">
            <span className="account-empty-mark" aria-hidden="true"><ChatIcon /></span>
            <h2>No conversations yet</h2>
            <p>Send a service request to start a conversation with a ServMate.</p>
            <Link className="button button-primary" href="/home">Browse local services</Link>
          </div>
        )}
      </section>
    </div>
  );
}
