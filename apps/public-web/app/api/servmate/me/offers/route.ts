import { requireServMate } from '@/lib/auth';
import { guarded, jsonResponse } from '@/lib/http';
import { listOwnOffers } from '@/lib/offers';

export const dynamic = 'force-dynamic';

/** GET /api/servmate/me/offers — the offers this ServMate has on the table. */
export async function GET() {
  return guarded(async () => {
    const servmate = await requireServMate();
    const offers = await listOwnOffers(servmate.servmateProfileId);
    return jsonResponse({ offers }, 200);
  });
}
