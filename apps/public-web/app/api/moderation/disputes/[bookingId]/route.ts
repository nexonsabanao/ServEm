import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  guarded,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { requireModerator } from '@/lib/moderation-access';
import { imposeDisputeOutcome, type DisputeVerdict } from '@/lib/moderation';
import { readString } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const VERDICTS: DisputeVerdict[] = ['completed', 'cancelled'];

/**
 * POST /api/moderation/disputes/[bookingId] — impose an outcome on frozen work.
 *
 * This is the operator half of a dispute: the customer's half (`.../dispute` with
 * `withdraw` or `cancel`) ends a complaint they raised, and this ends one they
 * cannot settle. `completed` tells both sides the work stands and the agreed
 * amount is owed; `cancelled` tells the ServMate the work does not and closes the
 * job.
 *
 * Both parties are notified, the move is written to `bookingStatusHistory` with
 * the operator's label, and the audit row lands in the same transaction — so a
 * booking can never carry a verdict with no record of who imposed it.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ bookingId: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const { label } = await requireModerator();

    const body = await readJsonBody(request);
    if (!body) return jsonResponse(MALFORMED_BODY, 400);

    const verdict = readString(body.verdict);
    if (!(VERDICTS as string[]).includes(verdict)) {
      return jsonResponse({ message: 'That is not an outcome this endpoint imposes.' }, 400);
    }

    const { bookingId } = await context.params;
    const result = await imposeDisputeOutcome({
      bookingId,
      verdict: verdict as DisputeVerdict,
      note: body.note,
      actorLabel: label,
    });

    if (result.ok) {
      return jsonResponse({ booking: result.booking, dispute: result.dispute }, 200);
    }
    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    if (result.error === 'invalid_state') {
      return jsonResponse(
        { message: 'That booking is not under an open dispute, so there is nothing to decide.' },
        409,
      );
    }
    return jsonResponse({ message: 'Not found.' }, 404);
  });
}
