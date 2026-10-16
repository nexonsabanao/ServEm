import { randomUUID } from 'node:crypto';
import { canViewBooking, canViewConversation, canViewJobDetail } from './policy';
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from './presentation';
import { query, transact, type Database, type UserReportRecord } from './store';

/**
 * Blocking and reporting (§3.1, §3.2, §10.11, §14).
 *
 * Two different acts, deliberately kept apart:
 *
 * - A **block** is a private decision one account makes about another, and it
 *   changes what the two of them can see of each other's work. It is stored in
 *   one direction — the blocker owns the row — but enforced in both, because a
 *   block that only hides one side would leave the other side free to keep
 *   offering on work the blocker posted.
 * - A **report** is a statement to the marketplace, not to the other account. It
 *   is a moderation record with a status, and it changes nothing about what
 *   anyone can see: the platform's response is a review, not an automatic
 *   verdict. Nothing here decides that a report is correct.
 *
 * Both refuse to confirm anything they should not: reporting a job you cannot
 * see answers as absent, and a report is only ever readable by the reporter and
 * the moderation surface, never by the account it names.
 */

export { REPORT_REASONS };
export type { ReportReason };

const DESCRIPTION_MAX = 1000;

export type BlockResult =
  | { ok: true; blocked: true }
  | { ok: false; error: 'not_found' | 'self' };

export type BlockedAccount = { userId: string; name: string; createdAt: string };

/**
 * Blocks another account.
 *
 * Idempotent: blocking somebody already blocked succeeds, because the caller's
 * intent is already satisfied. That also means a retried request cannot leave a
 * second row behind.
 */
export async function blockUser(
  blockerUserId: string,
  blockedUserId: string,
): Promise<BlockResult> {
  return transact((database) => {
    if (blockerUserId === blockedUserId) return { ok: false as const, error: 'self' as const };
    if (!database.users.some((user) => user.id === blockedUserId)) {
      return { ok: false as const, error: 'not_found' as const };
    }
    const existing = database.userBlocks.some(
      (block) => block.blockerUserId === blockerUserId && block.blockedUserId === blockedUserId,
    );
    if (!existing) {
      database.userBlocks.push({
        blockerUserId,
        blockedUserId,
        createdAt: new Date().toISOString(),
      });
    }
    return { ok: true as const, blocked: true as const };
  });
}

/** Removes a block this account placed. Absent rows are simply removed. */
export async function unblockUser(
  blockerUserId: string,
  blockedUserId: string,
): Promise<BlockResult> {
  return transact((database) => {
    if (!database.users.some((user) => user.id === blockedUserId)) {
      return { ok: false as const, error: 'not_found' as const };
    }
    database.userBlocks = database.userBlocks.filter(
      (block) => !(block.blockerUserId === blockerUserId && block.blockedUserId === blockedUserId),
    );
    return { ok: true as const, blocked: true as const };
  });
}

/**
 * Whether this account has blocked another.
 *
 * Only the caller's own row is reported. A block placed *against* this account
 * is deliberately not visible — being told you were blocked is how blocking
 * turns into a retaliation tool — which is also why the UI offers "Block"
 * rather than "Blocked" when the row belongs to somebody else.
 */
export async function hasBlocked(userId: string, otherUserId: string): Promise<boolean> {
  return query((database) =>
    database.userBlocks.some(
      (block) => block.blockerUserId === userId && block.blockedUserId === otherUserId,
    ),
  );
}

/** The accounts this one has blocked, newest first, with their names. */
export async function listBlockedAccounts(userId: string): Promise<BlockedAccount[]> {
  return query((database) =>
    database.userBlocks
      .filter((block) => block.blockerUserId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((block) => ({
        userId: block.blockedUserId,
        name:
          database.users.find((user) => user.id === block.blockedUserId)?.name ?? 'Closed account',
        createdAt: block.createdAt,
      })),
  );
}

export type OwnReport = {
  id: string;
  reasonCode: ReportReason;
  reasonLabel: string;
  description?: string;
  status: UserReportRecord['reportStatus'];
  createdAt: string;
  resolvedAt?: string;
  /** What the report is about, in words the reporter already had. */
  subject: string;
};

/**
 * The reports this account filed, newest first.
 *
 * The reporter is the only account that reads a report's own record. The account
 * a report names never sees it — the marketplace's review is not that side's
 * business — and no other account sees it at all, because the reporter is taken
 * from the session rather than from anything the caller sent.
 *
 * What each row says about its subject is re-decided here rather than
 * remembered: a job's title is read out only while the reporter could still open
 * that job, so a report never becomes a way to keep watching something they have
 * lost the right to see (§6.4). Filing a report is the one moment the reporter is
 * certainly entitled to what they are reporting — that is why `reportContent`
 * checks it — but the row outlives that moment.
 */
export async function listOwnReports(reporterUserId: string): Promise<OwnReport[]> {
  return query((database) =>
    database.userReports
      .filter((report) => report.reporterUserId === reporterUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((report) => ({
        id: report.id,
        reasonCode: report.reasonCode,
        reasonLabel: REPORT_REASON_LABELS[report.reasonCode],
        ...(report.description ? { description: report.description } : {}),
        status: report.reportStatus,
        createdAt: report.createdAt,
        ...(report.resolvedAt ? { resolvedAt: report.resolvedAt } : {}),
        subject: subjectOfReport(database, report, reporterUserId),
      })),
  );
}

function subjectOfReport(
  database: Database,
  report: UserReportRecord,
  viewerUserId: string,
): string {
  if (report.reportedUserId) {
    const name = database.users.find((user) => user.id === report.reportedUserId)?.name;
    return name ? `Account · ${name}` : 'Account · a closed account';
  }
  if (report.reportedJobId) {
    const decision = canViewJobDetail(database, {
      jobId: report.reportedJobId,
      userId: viewerUserId,
    });
    const title = decision.allowed
      ? database.jobPosts.find((job) => job.id === report.reportedJobId)?.title
      : undefined;
    return title ? `Job · ${title}` : 'Job · no longer visible to you';
  }
  return 'Message · a chat you were part of';
}

export type ReportResult =
  | { ok: true; report: UserReportRecord }
  | { ok: false; error: 'not_found' | 'already_reported' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

export type ReportInput = {
  reporterUserId: string;
  reasonCode: unknown;
  description?: unknown;
  reportedUserId?: unknown;
  reportedJobId?: unknown;
  reportedMessageId?: unknown;
};

/**
 * Records a report against one user, job or message.
 *
 * The reporter must already be entitled to see what they are reporting — a job
 * report is refused exactly as the job detail is refused, so this cannot be used
 * to confirm that somebody else's private job exists (§6.4). A second open report
 * from the same account about the same thing is refused rather than stacked, so
 * the moderation queue counts incidents, not clicks.
 */
export async function reportContent(input: ReportInput): Promise<ReportResult> {
  const errors: Record<string, string> = {};

  const reason = REPORT_REASONS.find((candidate) => candidate === input.reasonCode);
  if (!reason) errors.reasonCode = 'Choose a reason for the report.';

  const targets = [
    typeof input.reportedUserId === 'string' && input.reportedUserId ? 'user' : null,
    typeof input.reportedJobId === 'string' && input.reportedJobId ? 'job' : null,
    typeof input.reportedMessageId === 'string' && input.reportedMessageId ? 'message' : null,
  ].filter((value): value is string => value !== null);
  if (targets.length !== 1) {
    errors.target = 'Report one thing at a time.';
  }

  let description: string | undefined;
  if (typeof input.description === 'string' && input.description.trim() !== '') {
    const trimmed = input.description.trim();
    if (Array.from(trimmed).length > DESCRIPTION_MAX) {
      errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
    } else {
      description = trimmed;
    }
  }

  if (Object.keys(errors).length > 0 || targets.length !== 1 || !reason) {
    return { ok: false, error: 'invalid', errors };
  }

  return transact((database) => {
    const target = targets[0]!;

    if (target === 'user') {
      const reportedUserId = input.reportedUserId as string;
      if (reportedUserId === input.reporterUserId) {
        return { ok: false as const, error: 'not_found' as const };
      }
      if (!database.users.some((user) => user.id === reportedUserId)) {
        return { ok: false as const, error: 'not_found' as const };
      }
      return writeReport(database, input.reporterUserId, reason, description, {
        reportedUserId,
      });
    }

    if (target === 'job') {
      const reportedJobId = input.reportedJobId as string;
      // The same question the job detail page asks: not entitled, not found.
      const decision = canViewJobDetail(database, {
        jobId: reportedJobId,
        userId: input.reporterUserId,
      });
      if (!decision.allowed) return { ok: false as const, error: 'not_found' as const };
      return writeReport(database, input.reporterUserId, reason, description, { reportedJobId });
    }

    const reportedMessageId = input.reportedMessageId as string;
    const message = database.messages.find((row) => row.id === reportedMessageId);
    if (!message) return { ok: false as const, error: 'not_found' as const };

    if (message.conversationId) {
      const decision = canViewConversation(database, message.conversationId, input.reporterUserId);
      if (!decision.allowed) return { ok: false as const, error: 'not_found' as const };
    } else if (message.bookingId) {
      // Legacy service-level threads live on the booking rather than a conversation.
      const decision = canViewBooking(database, message.bookingId, input.reporterUserId);
      if (!decision.allowed) return { ok: false as const, error: 'not_found' as const };
    } else {
      return { ok: false as const, error: 'not_found' as const };
    }

    return writeReport(database, input.reporterUserId, reason, description, { reportedMessageId });
  });
}

/**
 * Stores one open report, refusing a duplicate of the same account's own.
 *
 * The duplicate check compares the whole target tuple, so reporting the same
 * person and the same job are two different reports — which is what a moderator
 * wants to see — while clicking twice about the same thing is one.
 */
function writeReport(
  database: Database,
  reporterUserId: string,
  reasonCode: ReportReason,
  description: string | undefined,
  target: { reportedUserId?: string; reportedJobId?: string; reportedMessageId?: string },
): ReportResult {
  const duplicate = database.userReports.some(
    (report) =>
      report.reporterUserId === reporterUserId &&
      report.reportStatus === 'open' &&
      report.reportedUserId === target.reportedUserId &&
      report.reportedJobId === target.reportedJobId &&
      report.reportedMessageId === target.reportedMessageId,
  );
  if (duplicate) return { ok: false as const, error: 'already_reported' as const };

  const report: UserReportRecord = {
    id: randomUUID(),
    reporterUserId,
    ...(target.reportedUserId ? { reportedUserId: target.reportedUserId } : {}),
    ...(target.reportedJobId ? { reportedJobId: target.reportedJobId } : {}),
    ...(target.reportedMessageId ? { reportedMessageId: target.reportedMessageId } : {}),
    reasonCode,
    ...(description ? { description } : {}),
    reportStatus: 'open',
    createdAt: new Date().toISOString(),
  };
  database.userReports.push(report);
  return { ok: true as const, report };
}
