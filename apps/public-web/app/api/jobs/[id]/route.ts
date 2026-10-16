import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { getCustomerJob, updateJobPost } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs/:id — one of the account's own jobs.
 *
 * This route only ever answers for the caller's own job: a job belonging to
 * somebody else is reported as missing, so it cannot be used to confirm that
 * another customer's job exists.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return guarded(async () => {
    const account = await requireSession();
    const { id } = await context.params;
    const job = await getCustomerJob(id, account.id);
    if (!job) return jsonResponse({ message: 'That job was not found.' }, 404);
    return jsonResponse({ job }, 200);
  });
}

/**
 * PATCH /api/jobs/:id — edit a draft or a live job.
 *
 * Once work is booked the agreed terms are frozen, so the edit is refused with
 * 409 rather than quietly changing work a ServMate has already taken on.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await updateJobPost(account.id, id, body);
    if (result.ok) return jsonResponse({ job: result.job }, 200);

    if (result.error === 'not_found') {
      return jsonResponse({ message: 'That job was not found.' }, 404);
    }
    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    if (result.error === 'already_booked') {
      return jsonResponse(
        { message: 'This job is booked. Its agreed terms cannot be changed.' },
        409,
      );
    }
    return jsonResponse({ message: 'This job can no longer be edited.' }, 409);
  });
}
