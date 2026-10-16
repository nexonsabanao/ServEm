import { requireSession } from '@/lib/auth';
import { guarded, jsonResponse } from '@/lib/http';
import { readMedia } from '@/lib/media';

export const dynamic = 'force-dynamic';

/**
 * GET /api/media/:assetId — deliver one stored file.
 *
 * This is the only way to read media bytes, and it re-decides authorization on
 * every request. A job file is released to the job's owner, its assigned
 * ServMate, or a ServMate the job is currently discoverable by; a profile image
 * is released to any signed-in account. Anything else answers 404, identically
 * to an asset that does not exist, so a guessed or leaked id reveals neither the
 * file nor the job behind it (§6.4).
 *
 * The response is explicitly uncacheable and never shared, so a private photo
 * cannot be retained by a shared proxy or handed to a later caller of the same
 * URL.
 */
export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  return guarded(async () => {
    const account = await requireSession();
    const { assetId } = await context.params;
    const delivered = await readMedia(assetId, account.id);
    if (!delivered) return jsonResponse({ message: 'That file was not found.' }, 404);

    return new Response(new Uint8Array(delivered.bytes), {
      status: 200,
      headers: {
        'Content-Type': delivered.mimeType,
        'Content-Length': String(delivered.bytes.length),
        // Private and unrevalidated: the bytes are authorized per request, so
        // they must not outlive it anywhere between here and the caller.
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  });
}
