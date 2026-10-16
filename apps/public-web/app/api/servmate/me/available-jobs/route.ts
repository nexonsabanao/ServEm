import { requireServMate } from '@/lib/auth';
import { guarded, jsonResponse } from '@/lib/http';
import { listAvailableJobs, type DiscoveryFilters } from '@/lib/matching';

export const dynamic = 'force-dynamic';

/**
 * GET /api/servmate/me/available-jobs — the private, category-matched job feed.
 *
 * The response carries summaries only: the city, never the barangay or the
 * access notes (§7.2). Query parameters narrow the already-authorized set — they
 * can never widen it, so no combination of filters reveals a job this ServMate
 * is not eligible to see.
 */
export async function GET(request: Request) {
  return guarded(async () => {
    const servmate = await requireServMate();
    const params = new URL(request.url).searchParams;

    const jobs = await listAvailableJobs({
      userId: servmate.id,
      filters: readFilters(params),
    });
    return jsonResponse({ jobs }, 200);
  });
}

function readFilters(params: URLSearchParams): DiscoveryFilters {
  const filters: DiscoveryFilters = {};
  const categoryId = params.get('categoryId');
  if (categoryId) filters.categoryId = categoryId;
  const city = params.get('city');
  if (city) filters.city = city;
  const query = params.get('q');
  if (query) filters.query = query.slice(0, 120);
  const min = readWholeNumber(params.get('budgetMinCentavos'));
  if (min !== undefined) filters.budgetMinCentavos = min;
  const max = readWholeNumber(params.get('budgetMaxCentavos'));
  if (max !== undefined) filters.budgetMaxCentavos = max;
  const from = params.get('startFrom');
  if (from) filters.startFrom = from;
  const before = params.get('startBefore');
  if (before) filters.startBefore = before;
  const limit = readWholeNumber(params.get('limit'));
  if (limit !== undefined) filters.limit = limit;
  return filters;
}

function readWholeNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
