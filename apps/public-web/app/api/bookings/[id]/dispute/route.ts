import { getSessionAccount } from '@/lib/auth';
import { openDispute, resolveDispute, type DisputeOutcome, type TransitionResult } from '@/lib/bookings';
import { FORBIDDEN_CROSS_SITE, MALFORMED_BODY, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { readString } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const OUTCOMES: DisputeOutcome[] = ['withdraw', 'cancel'];
const REASON_MAX = 4000;

/**
 * Opening and closing a dispute over one booking.
 *
 * `action: 'open'` records the customer's complaint and freezes the booking;
 * `'withdraw'` and `'cancel'` end it. The side is decided from the session and
 * the booking's own rows — the body only ever carries the *action*, so no
 * request can assert which party it is.
 *
 * A dispute halts the state machine rather than advancing it: while one is open,
 * completion and confirmation are refused by `./bookings`, which is what stops a
 * completion from finishing the work underneath a live complaint.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  const account = await getSessionAccount();
  if (!account) return jsonResponse({ message: 'Sign in to report a problem.' }, 401);

  const body = await readJsonBody(request);
  if (!body) return jsonResponse(MALFORMED_BODY, 400);

  const { id } = await context.params;
  const action = readString(body.action) || 'open';

  if (action === 'open') {
    const reason = readString(body.reason).trim();
    if (!reason || reason.length > REASON_MAX) {
      const message = !reason
        ? 'Describe what went wrong.'
        : `Keep this under ${REASON_MAX} characters.`;
      return jsonResponse({ message, errors: { reason: message } }, 400);
    }
    return respond(await openDispute(account.id, id, reason), {
      denied: 'That booking was not found.',
      invalid:
        'A problem can only be reported while the work is under way or awaiting your confirmation.',
    });
  }

  if ((OUTCOMES as string[]).includes(action)) {
    return respond(await resolveDispute(account.id, id, action as DisputeOutcome), {
      denied: 'That booking was not found.',
      invalid: 'There is no open problem on that booking.',
    });
  }

  return jsonResponse({ message: 'That is not something this endpoint does.' }, 400);
}

function respond(
  result: TransitionResult,
  messages: { denied: string; invalid: string },
): Response {
  if (result.ok) return jsonResponse({ booking: result.booking }, 200);

  // `not_found` covers both an absent booking and one belonging to somebody
  // else: the two are the same answer on purpose.
  if (result.error === 'not_found' || result.error === 'not_yours') {
    return jsonResponse({ message: messages.denied }, 404);
  }
  return jsonResponse({ message: messages.invalid }, 409);
}
