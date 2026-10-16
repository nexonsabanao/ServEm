import { requireSession } from '@/lib/auth';
import { FORBIDDEN_CROSS_SITE, guarded, isSameOrigin, jsonResponse, readJsonBody } from '@/lib/http';
import { consume, tooManyResponse } from '@/lib/rate-limit';
import { REPORT_REASONS, reportContent } from '@/lib/trust';

export const dynamic = 'force-dynamic';

/** The reasons a report may cite, so the client can render the same list. */
export async function GET() {
  return guarded(async () => {
    await requireSession();
    return jsonResponse({ reasons: REPORT_REASONS }, 200);
  });
}

/**
 * POST /api/reports — report one account, job or message.
 *
 * A report changes nothing about visibility; it is a moderation record. The
 * reporter must already be entitled to see what they are reporting, so a report
 * cannot be used as a way to confirm that somebody else's job exists.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonResponse(FORBIDDEN_CROSS_SITE, 403);

  return guarded(async () => {
    const account = await requireSession();

    // Reports feed a moderation queue a human reads; a burst of them is spam
    // either way, so the account filing them is the one counted.
    const filed = consume('report', account.id);
    if (!filed.ok) return tooManyResponse(filed.retryAfterSeconds);

    const body = await readJsonBody(request);
    if (!body) return jsonResponse({ message: 'Send a JSON object as the request body.' }, 400);

    const result = await reportContent({
      reporterUserId: account.id,
      reasonCode: body.reasonCode,
      description: body.description,
      reportedUserId: body.reportedUserId,
      reportedJobId: body.reportedJobId,
      reportedMessageId: body.reportedMessageId,
    });

    if (result.ok) return jsonResponse({ reportId: result.report.id }, 201);

    if (result.error === 'invalid') {
      return jsonResponse({ message: 'Check the highlighted fields.', errors: result.errors }, 400);
    }
    if (result.error === 'already_reported') {
      return jsonResponse(
        { message: 'You have already reported this. A moderator is looking at it.' },
        409,
      );
    }
    return jsonResponse({ message: 'That could not be found.' }, 404);
  });
}
