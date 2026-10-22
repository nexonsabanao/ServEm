import { Shortlist } from '@/app/components/feed/shortlist';
import { listFeedServices } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shortlist — ServEm',
};

/**
 * The saved-services comparison board.
 *
 * The listings are read on the server like every other marketplace surface; the
 * saved ids are the device's, so which columns appear is decided in the browser
 * from the same store the bookmark buttons write. The frame and the session
 * guard belong to `app/(app)/layout.tsx`.
 */
export default async function ShortlistPage() {
  const listings = await listFeedServices();
  return <Shortlist listings={listings} />;
}
