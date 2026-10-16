import { notFound, redirect } from 'next/navigation';
import { MessageThread } from '@/app/components/feed/message-thread';
import { getSessionAccount } from '@/lib/auth';
import { getConversation } from '@/lib/conversations';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ bookingId: string }>;

/** One conversation, in the pane beside the thread list. */
export default async function MessageThreadPage({
  params,
}: Readonly<{ params: RouteParams }>) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const { bookingId } = await params;
  const conversation = await getConversation(account.id, bookingId);
  if (!conversation) notFound();

  return <MessageThread conversation={conversation} />;
}
