import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { listJobMedia, registerJobMedia } from '@/lib/media';
import { consume, tooManyResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs/:id/media — the photos and videos on a job.
 *
 * Authorized callers only: the job's owner, or a ServMate whose category and
 * coverage already match it. Anyone else gets an empty list rather than a
 * refusal, so the response cannot be used to confirm that a private job — or a
 * file on it — exists (§6.4).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const account = await requireSession();
    const { id } = await context.params;
    const media = await listJobMedia(id, account.id);
    return jsonResponse({ media }, 200);
  });
}

/**
 * POST /api/jobs/:id/media — attach one photo or video to the account's job.
 *
 * The file arrives as a base64 data URL, is checked against the accepted types
 * by signature as well as by declared type, and is stored outside any served
 * path. The job must be the caller's own and still editable, because a booked
 * job's agreed scope is frozen.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();

    // Each upload costs storage and a signature check; thirty files an hour is
    // a generous posting session and a useless hoarding run.
    const upload = consume('mediaUpload', account.id);
    if (!upload.ok) return tooManyResponse(upload.retryAfterSeconds);

    const { id } = await context.params;
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await registerJobMedia(account.id, id, {
      dataUrl: body.dataUrl,
      caption: body.caption,
    });
    if (result.ok) return jsonResponse({ media: result.media }, 201);

    if (result.error === 'invalid') {
      return jsonResponse({ message: 'That file could not be attached.', errors: result.errors }, 400);
    }
    if (result.error === 'not_found') {
      return jsonResponse({ message: 'That job was not found.' }, 404);
    }
    if (result.error === 'frozen') {
      return jsonResponse(
        { message: 'This job is booked. Its agreed terms and photos cannot be changed.' },
        409,
      );
    }
    return jsonResponse({ message: 'This job already has the maximum number of files.' }, 409);
  });
}
