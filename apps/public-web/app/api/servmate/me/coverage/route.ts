import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { setServmateCoverage } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/servmate/me/coverage — replace the areas this ServMate covers.
 *
 * Coverage is one of the rules discovery applies (§6.3): a job outside these
 * areas is not returned, so the list is the provider's own statement of where
 * they will travel.
 */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const servmate = await requireServMate();
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const raw = Array.isArray(body.areas) ? body.areas : null;
    if (!raw || raw.some((value) => typeof value !== 'string')) {
      return jsonResponse(
        { message: 'Check the highlighted fields.', errors: { areas: 'Send a list of area labels.' } },
        400,
      );
    }

    const result = await setServmateCoverage(servmate.servmateProfileId, raw as string[]);
    if (!result.ok) {
      return jsonResponse(
        {
          message: 'Check the highlighted fields.',
          errors: { areas: 'Pick areas from the coverage list.' },
        },
        400,
      );
    }
    return jsonResponse({ areas: result.areas }, 200);
  });
}
