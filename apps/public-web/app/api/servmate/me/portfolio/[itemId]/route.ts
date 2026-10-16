import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse } from '@/lib/http';
import { removePortfolioItem } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

/** DELETE /api/servmate/me/portfolio/:itemId — remove one of your own work examples. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireServMate();
    const { itemId } = await context.params;
    const result = await removePortfolioItem(account.id, itemId);
    if (result.ok) return jsonResponse({ removed: itemId }, 200);
    return jsonResponse({ message: 'That work example was not found.' }, 404);
  });
}
