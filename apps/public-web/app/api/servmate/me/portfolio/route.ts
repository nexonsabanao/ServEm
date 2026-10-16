import { requireServMate } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { addPortfolioItem } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

/**
 * POST /api/servmate/me/portfolio — add a work example to the caller's profile.
 *
 * An optional `bookingId` marks the item as work the platform watched complete.
 * That claim is verified against the booking rather than trusted, so a profile
 * can never present self-published work as verified (§5.7).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireServMate();
    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await addPortfolioItem(account.id, {
      title: body.title,
      description: body.description,
      dataUrl: body.dataUrl,
      bookingId: body.bookingId,
    });
    if (result.ok) return jsonResponse({ item: result.item }, 201);

    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    if (result.error === 'too_many') {
      return jsonResponse({ message: 'Your portfolio is full. Remove one to add another.' }, 409);
    }
    if (result.error === 'booking_not_found') {
      return jsonResponse(
        { message: 'That completed booking is not one of your finished jobs.' },
        404,
      );
    }
    return jsonResponse({ message: 'Open the ServMate workbench first.' }, 404);
  });
}
