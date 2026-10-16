import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { deleteListing, updateListing } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/servmate/me/services/:id — edit one of the caller's own listings.
 *
 * Ownership is decided from the session, and somebody else's listing answers as
 * absent. A price change reaches future offers only: agreed bookings carry their
 * own snapshot and are not rewritten by this call.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireServMate();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await updateListing(account.id, id, body);
    if (result.ok) return jsonResponse({ listing: result.listing }, 200);
    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    return jsonResponse({ message: 'That listing was not found.' }, 404);
  });
}

/** DELETE /api/servmate/me/services/:id — remove a listing nothing live depends on. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireServMate();
    const { id } = await context.params;
    const result = await deleteListing(account.id, id);

    if (result.ok) return jsonResponse({ removed: id }, 200);
    if (result.error === 'in_use') {
      return jsonResponse(
        {
          message:
            'That listing is part of work in progress. Unpublish it instead until the booking ends.',
        },
        409,
      );
    }
    return jsonResponse({ message: 'That listing was not found.' }, 404);
  });
}
