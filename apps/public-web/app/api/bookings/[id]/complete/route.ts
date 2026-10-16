import { getSessionAccount } from '@/lib/auth';
import { requestCompletion } from '@/lib/bookings';
import { FORBIDDEN_CROSS_SITE, isSameOrigin, jsonResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bookings/:id/complete — the ServMate reports the work finished.
 *
 * This does not close the booking: it hands it back to the customer to confirm,
 * which is what keeps "done" a claim two parties agree on (blueprint §4.8).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) {
    return jsonResponse({ message: 'Sign in to report this work finished.' }, 401);
  }

  const { id } = await context.params;
  const result = await requestCompletion(account.id, id);

  if (!result.ok) {
    if (result.error === 'invalid_state') {
      return jsonResponse(
        {
          message: 'That work cannot be reported finished yet.',
          errors: { status: 'Start the work before finishing it.' },
        },
        409,
      );
    }
    return jsonResponse({ message: 'That booking was not found.' }, 404);
  }

  return jsonResponse({ booking: result.booking }, 200);
}
