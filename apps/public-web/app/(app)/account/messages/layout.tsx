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
 * The heading is print-only on a wide screen, where the shell names the screen.
 * On a phone the top bar belongs to home, so this heading is the only thing that
 * says where you are — which is why it becomes visible there.
 */
export default async function MessagesLayout({ children }: Readonly<{ children: ReactNode }>) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const conversations = await listConversations(account.id);

  return (
    <>
      <h1 className="phone-title">Messages</h1>
      <MessagesFrame
        empty={conversations.length === 0}
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
