import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { setServmateCategories } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/servmate/me/categories — replace the categories this ServMate works in.
 *
 * These are the categories job eligibility is decided by (§6.3), so they are
 * validated against the registry: a retired or unknown category cannot be
 * claimed. An empty list is allowed and simply matches no work yet.
 */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const servmate = await requireServMate();
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const raw = Array.isArray(body.categoryIds) ? body.categoryIds : null;
    if (!raw || raw.some((value) => typeof value !== 'string')) {
      return jsonResponse(
        {
          message: 'Check the highlighted fields.',
          errors: { categoryIds: 'Send a list of category ids.' },
        },
        400,
      );
    }

    const result = await setServmateCategories(servmate.servmateProfileId, raw as string[]);
    if (!result.ok) {
      return jsonResponse(
        {
          message: 'Check the highlighted fields.',
          errors: { categoryIds: 'Pick categories from the list.' },
        },
        400,
      );
    }
    return jsonResponse({ categoryIds: result.categoryIds }, 200);
  });
}
