import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ConversationList } from '@/app/components/feed/conversation-list';
import { MessagesFrame } from '@/app/components/feed/messages-frame';
import { getSessionAccount } from '@/lib/auth';
import { listConversations } from '@/lib/conversations';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Messages — ServEm',
};

/**
 * Messages, laid out the way a message app is: the threads on one side, the
 * conversation you opened on the other. The list lives in this layout so it does
 * not re-mount when you move between threads, and the thread pages below only
 * have to answer for their own pane.
 *
 * The heading is invisible because the screen's name is already in the frame you
 * navigated here through — but a document still needs one, and the panes below it
 * are a list and a conversation rather than the page's own title.
 */
export default async function MessagesLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const conversations = await listConversations(account.id);

  return (
    <>
      <h1 className="visually-hidden">Messages</h1>
      <MessagesFrame
        list={
          <ConversationList
            conversations={conversations.map((conversation) => ({
              bookingId: conversation.bookingId,
              providerName: conversation.providerName,
              serviceTitle: conversation.serviceTitle,
              lastMessage: conversation.lastMessage,
              updatedAt: conversation.updatedAt,
            }))}
          />
        }
      >
        {children}
      </MessagesFrame>
    </>
  );
}
