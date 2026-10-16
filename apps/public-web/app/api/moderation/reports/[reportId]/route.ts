import {
  FORBIDDEN_CROSS_SITE,
  MALFORMED_BODY,
  guarded,
  isSameOrigin,
  jsonResponse,
  readJsonBody,
} from '@/lib/http';
import { requireModerator } from '@/lib/moderation-access';
import { recordReportOutcome, type ReportOutcome } from '@/lib/moderation';
import { readString } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const OUTCOMES: ReportOutcome[] = ['reviewing', 'resolved', 'dismissed'];

/**
 * POST /api/moderation/reports/[reportId] — record where a report stands.
 *
 * `reviewing` claims it off the unclaimed end of the queue; `resolved` and
 * `dismissed` close it, and both of those require a note, because once a case
 * leaves the queue the note is the only thing that distinguishes "we acted" from
 * "we looked and decided nothing was warranted".
 *
 * The operator's label is taken from the deployment's configuration, not from the
 * body, and every outcome writes an audit row in the same transaction as the
 * status change.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const { label } = await requireModerator();

    const body = await readJsonBody(request);
    if (!body) return jsonResponse(MALFORMED_BODY, 400);

    const outcome = readString(body.outcome);
    if (!(OUTCOMES as string[]).includes(outcome)) {
      return jsonResponse({ message: 'That is not an outcome this endpoint records.' }, 400);
    }

    const { reportId } = await context.params;
    const result = await recordReportOutcome({
      reportId,
      outcome: outcome as ReportOutcome,
      note: body.note,
      actorLabel: label,
    });

    if (result.ok) return jsonResponse({ report: result.report }, 200);
    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    if (result.error === 'already_closed') {
      return jsonResponse(
        { message: 'That report is already closed or already being reviewed.' },
        409,
      );
    }
    return jsonResponse({ message: 'Not found.' }, 404);
  });
}
