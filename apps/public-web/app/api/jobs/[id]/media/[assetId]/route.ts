import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse } from '@/lib/http';
import { removeJobMedia } from '@/lib/media';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/jobs/:id/media/:assetId — detach one file from the account's job.
 *
 * Removal deletes the bytes as well as the reference, and is refused once the
 * job is booked, so the record of what was agreed cannot be withdrawn quietly.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; assetId: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();
    const { id, assetId } = await context.params;
    const result = await removeJobMedia(account.id, id, assetId);

    if (result.ok) return jsonResponse({ removed: assetId }, 200);
    if (result.error === 'frozen') {
      return jsonResponse({ message: 'This job is booked. Its photos cannot be changed.' }, 409);
    }
    return jsonResponse({ message: 'That file was not found.' }, 404);
  });
}
