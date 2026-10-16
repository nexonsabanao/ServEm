import { NoThreadOpen } from '@/app/components/feed/conversation-list';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Messages — ServEm',
};

/**
 * The messages index: on a phone it is the list of threads, on a wide screen it
 * is the list plus an empty pane waiting for a conversation to be chosen.
 */
export default function MessagesPage() {
  return <NoThreadOpen />;
}
