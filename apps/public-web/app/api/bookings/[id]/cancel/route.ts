import { getSessionAccount } from '@/lib/auth';
import { cancelBooking } from '@/lib/bookings';
import { FORBIDDEN_CROSS_SITE, isSameOrigin, jsonResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) {
    return jsonResponse({ message: 'Sign in to cancel a request.' }, 401);
  }

  const { id } = await context.params;
  const result = await cancelBooking(account.id, id);

  if (!result.ok) {
    if (result.error === 'already_cancelled') {
      return jsonResponse(
        { message: 'That request was already cancelled.', errors: { status: 'Already cancelled.' } },
        409,
      );
    }
    // A request owned by another account is reported the same as a missing one.
    return jsonResponse({ message: 'That request was not found.' }, 404);
  }

  return jsonResponse({ booking: result.booking }, 200);
}
