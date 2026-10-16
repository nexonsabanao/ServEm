import { requireServMate } from '@/lib/auth';
import { guarded, jsonResponse } from '@/lib/http';
import { getJobDetail } from '@/lib/matching';

export const dynamic = 'force-dynamic';

/**
 * GET /api/servmate/me/available-jobs/:jobId — the full job, when entitled.
 *
 * A provider who is not eligible gets 404, exactly as they would for a job id
 * that does not exist, so a guessed id cannot confirm that somebody else's job
 * is there (§6.4). Only an eligible provider reaches the barangay and the
 * access notes.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  return guarded(async () => {
    const servmate = await requireServMate();
    const { jobId } = await context.params;
    const job = await getJobDetail({ jobId, userId: servmate.id });

    if (!job) return jsonResponse({ message: 'That job was not found.' }, 404);
    return jsonResponse({ job }, 200);
  });
}
