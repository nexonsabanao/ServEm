import { requireSession } from '@/lib/auth';
import { guarded, jsonResponse } from '@/lib/http';
import { listBlockedAccounts } from '@/lib/trust';

export const dynamic = 'force-dynamic';

/**
 * GET /api/blocks — the accounts this one has blocked.
 *
 * The list is the blocker's own decision and nobody else's business: a block is
 * never disclosed to the account it names, which is why there is no endpoint that
 * answers \"who blocked me\".
 */
export async function GET() {
  return guarded(async () => {
    const account = await requireSession();
    const blocked = await listBlockedAccounts(account.id);
    return jsonResponse({ blocked }, 200);
  });
}
