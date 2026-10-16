import { getSessionAccount } from '@/lib/auth';
import { startBooking } from '@/lib/bookings';
import { FORBIDDEN_CROSS_SITE, isSameOrigin, jsonResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bookings/:id/start — the ServMate begins the booked work.
 *
 * Only the ServMate this booking names may start it; anyone else gets the same
 * answer a booking that does not exist would give.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) {
    return jsonResponse({ message: 'Sign in to start this work.' }, 401);
  }

  const { id } = await context.params;
  const result = await startBooking(account.id, id);

  if (!result.ok) {
    if (result.error === 'invalid_state') {
      return jsonResponse(
        { message: 'That work is not waiting to be started.', errors: { status: 'Not ready to start.' } },
        409,
      );
    }
    return jsonResponse({ message: 'That booking was not found.' }, 404);
  }

  return jsonResponse({ booking: result.booking }, 200);
}
