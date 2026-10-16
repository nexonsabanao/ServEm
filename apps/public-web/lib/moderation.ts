import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { applyModeratorOutcome } from './bookings';
import { REPORT_REASON_LABELS, type ReportReason } from './presentation';
import {
  query,
  transact,
  type BookingStatus,
  type Database,
  type ModerationActionRecord,
  type UserReportRecord,
} from './store';

/**
 * The operator surface: the reports and disputes that need a person to decide.
 *
 * Both have been reachable for a while — a customer files a report, and a
 * dispute freezes a booking — but nothing read the rows as a queue, so an outcome
 * only ever existed out of band. This module is the reading and deciding half.
 *
 * **The access model is the important part, and it is deliberately not the
 * account session.** The threat model says an operator API "introduces a new
 * trust boundary and a new class of insider risk; it must not reuse the customer
 * session model", so this console does not:
 *
 * - The credential is a server-side secret (`SERVEM_MODERATION_TOKEN`), not an
 *   account password. An operator needs no ServEm account at all, and no account
 *   can promote itself into this console.
 * - The browser holds only a SHA-256 digest of that secret, in a cookie of its
 *   own. The digest proves knowledge of the token without being one, so a stolen
 *   cookie cannot be replayed elsewhere, and rotating the environment variable
 *   ends every console session at once.
 * - **Deny is indistinguishable from absent.** No token configured, no cookie, a
 *   wrong cookie, an expired shift — every one is the same `404` with the same
 *   message, so the surface cannot be probed for and an operator who is not
 *   unlocked cannot tell a healthy deployment from one that never enabled this.
 * - A short configured token is treated as *no* token rather than as a weak one:
 *   a half-secure operator console is worse than an absent one.
 *
 * The console reads more than any customer can, because a decision needs it: a
 * report about someone else's private job is unjudgeable otherwise. What it reads
 * is still bounded — the job a report names, the single message it names (never
 * the thread around it), the booking a dispute froze. Names appear; email
 * addresses, addresses and payment details do not.
 *
 * **Two modules, one console.** This one holds the credential's primitives, the
 * decision, and the case work — none of which touches a request, so all of it is
 * directly testable. `./moderation-access` is the thin layer that reads the cookie
 * and throws the refusal, because `next/headers` only exists inside a request.
 */

/* ---------------------------------------------------------------- *
 * The operator credential
 * ---------------------------------------------------------------- */

export const MODERATION_COOKIE = 'servem_moderation';

/** Twelve hours: one operator shift, then the console asks again. */
const MODERATION_TTL_MS = 1000 * 60 * 60 * 12;

/**
 * A token shorter than this is refused even when it is configured.
 *
 * The point of a length floor is that nobody has to remember a policy: a
 * misconfigured `SERVEM_MODERATION_TOKEN=admin` does not come up as a console
 * with a guessable key, it does not come up at all.
 */
const MIN_TOKEN_LENGTH = 24;

/**
 * The configured token, or nothing.
 *
 * Read per call rather than cached, so rotating it takes effect on restart and a
 * test can decide per run.
 */
function configuredToken(): string | null {
  const token = process.env.SERVEM_MODERATION_TOKEN?.trim();
  if (!token || token.length < MIN_TOKEN_LENGTH) return null;
  return token;
}

/** Whether this deployment has an operator console at all. */
export function moderationConfigured(): boolean {
  return configuredToken() !== null;
}

/** Who to write into the audit trail. A label, never an account id. */
export function moderatorLabel(): string {
  return process.env.SERVEM_MODERATION_ACTOR?.trim() || 'operator';
}

/**
 * The digest a cookie carries.
 *
 * `sha256(token)` is not reversible into the token, and comparing digests is
 * constant-time by construction because both sides are the same length.
 */
function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Compares two hex digests in constant time. */
function equalHex(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate, 'hex');
  const right = Buffer.from(expected, 'hex');
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Whether a submitted operator token is the configured one. */
export function checkModerationToken(candidate: string): boolean {
  const token = configuredToken();
  if (!token) return false;
  const submitted = candidate.trim();
  if (!submitted) return false;
  return equalHex(tokenDigest(submitted), tokenDigest(token));
}

/** How long an operator session lasts, for the cookie layer to apply. */
export const MODERATION_TTL_SECONDS = Math.floor(MODERATION_TTL_MS / 1000);

/** The digest a console cookie holds for the configured token. */
export function moderationCookieDigest(): string | null {
  const token = configuredToken();
  return token ? tokenDigest(token) : null;
}

export type ModeratorAccess = { allowed: true; label: string } | { allowed: false };

/**
 * The access decision, separate from reading the cookie.
 *
 * Split out so every branch — no token configured, no cookie, a cookie from a
 * rotated token, a cookie that is simply wrong — can be asserted directly, since
 * "refuses the same way" is a claim worth a test rather than a comment.
 */
export function evaluateModeratorAccess(
  configured: string | null,
  heldCookie: string | null | undefined,
): ModeratorAccess {
  if (!configured) return { allowed: false };
  if (!heldCookie) return { allowed: false };
  if (!equalHex(heldCookie, tokenDigest(configured))) return { allowed: false };
  return { allowed: true, label: moderatorLabel() };
}

/** The configured token, for the request-scope layer that mints the cookie. */
export function moderatorToken(): string | null {
  return configuredToken();
}

/* ---------------------------------------------------------------- *
 * Cases
 * ---------------------------------------------------------------- */

export type Party = { userId: string; name: string };

export type ModerationActionView = {
  id: string;
  action: string;
  outcome?: string;
  note?: string;
  actorLabel: string;
  createdAt: string;
};

/** The thing a report is about, with as much of it as a decision needs. */
export type ReportSubject = {
  kind: 'account' | 'job' | 'message';
  /** What to put on the case card. */
  label: string;
  /** Where it can be opened, when the operator may see it. */
  href?: string;
  /** One more line of context: a job's city and state, an account's handle. */
  detail?: string;
  /** The reported content itself, for a message report and only that message. */
  excerpt?: string;
};

export type ReportCase = {
  id: string;
  reasonCode: ReportReason;
  reasonLabel: string;
  description?: string;
  status: UserReportRecord['reportStatus'];
  createdAt: string;
  resolvedAt?: string;
  reporter: Party;
  reported?: Party;
  subject: ReportSubject;
  actions: ModerationActionView[];
};

export type DisputeTimelineEntry = {
  from: string;
  to: string;
  at: string;
  actor: string;
  reason?: string;
};

export type DisputeCase = {
  bookingId: string;
  /** Where the booking stands now — `disputed` while it is still open. */
  status: BookingStatus;
  reference: string;
  serviceTitle: string;
  agreedAmountCentavos?: number;
  area?: string;
  customer: Party;
  provider?: Party;
  /** What the customer said when they raised it, if they said anything. */
  reason?: string;
  raisedAt: string;
  /** How the work arrived here — the state history is the evidence. */
  timeline: DisputeTimelineEntry[];
  actions: ModerationActionView[];
};

export type CaseQueue = { reports: ReportCase[]; disputes: DisputeCase[] };

/**
 * The queue a person works through: open reports, then open disputes, oldest
 * first so the queue is worked in the order it arrived.
 *
 * Cases already decided are excluded here rather than in the case builders — a
 * decided case is still a case, and the route that decided it needs to read it
 * back. Sizes are capped: the roadmap records pagination as the next step once
 * volumes justify it, and a queue that silently truncates would be worse than one
 * that says which fifty it is showing.
 */
export const QUEUE_LIMIT = 50;

export async function listCases(): Promise<CaseQueue> {
  return query((database) => ({
    reports: reportCases(database)
      .filter((report) => report.status !== 'resolved' && report.status !== 'dismissed')
      .slice(0, QUEUE_LIMIT),
    disputes: disputeCases(database)
      .filter((dispute) => dispute.status === 'disputed')
      .slice(0, QUEUE_LIMIT),
  }));
}

/** One report case, for the route that acts on it. */
export async function getReportCase(reportId: string): Promise<ReportCase | null> {
  return query((database) => reportCases(database).find((entry) => entry.id === reportId) ?? null);
}

/** One dispute case, for the route that decides it. */
export async function getDisputeCase(bookingId: string): Promise<DisputeCase | null> {
  return query(
    (database) => disputeCases(database).find((entry) => entry.bookingId === bookingId) ?? null,
  );
}

function partyFor(database: Database, userId: string | undefined): Party | undefined {
  if (!userId) return undefined;
  const user = database.users.find((candidate) => candidate.id === userId);
  return { userId, name: user?.name ?? 'Closed account' };
}

function actionsFor(database: Database, entityId: string): ModerationActionView[] {
  return database.moderationActions
    .filter((action) => action.entityId === entityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((action) => ({
      id: action.id,
      action: action.action,
      ...(action.outcome ? { outcome: action.outcome } : {}),
      ...(action.note ? { note: action.note } : {}),
      actorLabel: action.actorLabel,
      createdAt: action.createdAt,
    }));
}

function reportCases(database: Database): ReportCase[] {
  return database.userReports
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((report) => ({
      id: report.id,
      reasonCode: report.reasonCode,
      reasonLabel: REPORT_REASON_LABELS[report.reasonCode],
      ...(report.description ? { description: report.description } : {}),
      status: report.reportStatus,
      createdAt: report.createdAt,
      ...(report.resolvedAt ? { resolvedAt: report.resolvedAt } : {}),
      reporter: partyFor(database, report.reporterUserId) ?? {
        userId: report.reporterUserId,
        name: 'Closed account',
      },
      ...(report.reportedUserId
        ? { reported: partyFor(database, report.reportedUserId) }
        : {}),
      subject: reportSubject(database, report),
      actions: actionsFor(database, report.id),
    }));
}

/**
 * What a report is about, from the store rather than from the report row.
 *
 * Deliberately not filtered by eligibility: the operator is the one reader who
 * must be able to judge a report about a private job. The message case shows the
 * single message that was reported and nothing around it.
 */
function reportSubject(database: Database, report: UserReportRecord): ReportSubject {
  if (report.reportedUserId) {
    const user = database.users.find((candidate) => candidate.id === report.reportedUserId);
    return {
      kind: 'account',
      label: user?.name ?? 'A closed account',
      ...(user?.username ? { detail: `@${user.username}` } : {}),
    };
  }

  if (report.reportedJobId) {
    const job = database.jobPosts.find((candidate) => candidate.id === report.reportedJobId);
    if (!job) {
      return { kind: 'job', label: 'A job that no longer exists', detail: report.reportedJobId };
    }
    return {
      kind: 'job',
      label: job.title,
      detail: `${job.locationCity} · ${job.jobStatus} · ${job.categoryId}`,
      excerpt: job.description.slice(0, MESSAGE_EXCERPT_MAX),
    };
  }

  const message = database.messages.find((candidate) => candidate.id === report.reportedMessageId);
  return {
    kind: 'message',
    label: message ? 'A reported message' : 'A message that no longer exists',
    ...(message?.body ? { excerpt: message.body.slice(0, MESSAGE_EXCERPT_MAX) } : {}),
  };
}

/** How much of reported content an operator needs. Enough to judge, no more. */
const MESSAGE_EXCERPT_MAX = 600;

function disputeCases(database: Database): DisputeCase[] {
  return database.bookings
    .filter((booking) =>
      database.bookingStatusHistory.some(
        (row) => row.bookingId === booking.id && row.newStatus === 'disputed',
      ),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((booking) => {
      const history = database.bookingStatusHistory
        .filter((row) => row.bookingId === booking.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const raised = [...history].reverse().find((row) => row.newStatus === 'disputed');
      return {
        bookingId: booking.id,
        status: booking.status,
        reference: booking.reference,
        // A job-offer booking carries no `serviceTitle` snapshot — the listing's
        // title at the time is the job's own title — so the job is read for it.
        // Otherwise every operator would be deciding under "Work order", which
        // is exactly the context they need most.
        serviceTitle: booking.serviceTitle ?? jobTitleFor(database, booking) ?? 'Work order',
        ...(booking.agreedAmountCentavos !== undefined
          ? { agreedAmountCentavos: booking.agreedAmountCentavos }
          : {}),
        ...(booking.area ? { area: booking.area } : {}),
        customer: partyFor(database, booking.userId) ?? {
          userId: booking.userId,
          name: 'Closed account',
        },
        ...(providerUserId(database, booking)
          ? { provider: partyFor(database, providerUserId(database, booking)) }
          : {}),
        ...(raised?.reason ? { reason: raised.reason } : {}),
        raisedAt: raised?.createdAt ?? booking.createdAt,
        timeline: history.map((row) => ({
          from: row.oldStatus,
          to: row.newStatus,
          at: row.createdAt,
          actor: actorName(database, row.actorUserId),
          ...(row.reason ? { reason: row.reason } : {}),
        })),
        actions: actionsFor(database, booking.id),
      };
    });
}

function jobTitleFor(database: Database, booking: Database['bookings'][number]) {
  if (!booking.jobPostId) return undefined;
  return database.jobPosts.find((job) => job.id === booking.jobPostId)?.title;
}

function providerUserId(database: Database, booking: Database['bookings'][number]) {
  if (!booking.servmateProfileId) return undefined;
  return database.servmateProfiles.find((profile) => profile.id === booking.servmateProfileId)
    ?.userId;
}

/**
 * Who made a stored move, in words.
 *
 * A moderator move is recorded with an actor id that is not an account id, so it
 * is rendered as the operator who made it rather than as a missing user.
 */
function actorName(database: Database, actorUserId: string): string {
  if (actorUserId.startsWith('moderator:')) return `Operator (${actorUserId.slice('moderator:'.length)})`;
  return database.users.find((user) => user.id === actorUserId)?.name ?? 'Unknown account';
}

/* ---------------------------------------------------------------- *
 * Outcomes
 * ---------------------------------------------------------------- */

export type ReportOutcome = 'reviewing' | 'resolved' | 'dismissed';

export type ReportOutcomeResult =
  | { ok: true; report: ReportCase }
  | { ok: false; error: 'not_found' | 'already_closed' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

/** An outcome nobody can explain later is not a decision, so a closing one needs a note. */
const OUTCOME_NOTE_MIN = 4;
const OUTCOME_NOTE_MAX = 1000;

/**
 * Records where a report stands.
 *
 * `reviewing` claims it off the queue without closing it; `resolved` and
 * `dismissed` end it. Both terminal outcomes need a note, because the note is the
 * only thing that distinguishes "we acted" from "we looked and did nothing" once
 * the case is off the queue.
 *
 * Nothing here changes what anyone can see. A report is a statement about
 * behaviour, and visibility is already governed by blocks, matching and the
 * booking state machine — as `PROJECT_PROGRESS.md` puts it, a report is a record,
 * not a verdict.
 */
export async function recordReportOutcome(input: {
  reportId: string;
  outcome: ReportOutcome;
  note?: unknown;
  actorLabel: string;
}): Promise<ReportOutcomeResult> {
  const errors: Record<string, string> = {};
  const closing = input.outcome !== 'reviewing';

  let note: string | undefined;
  if (typeof input.note === 'string' && input.note.trim() !== '') {
    const trimmed = input.note.trim();
    if (Array.from(trimmed).length > OUTCOME_NOTE_MAX) {
      errors.note = `Keep the note under ${OUTCOME_NOTE_MAX} characters.`;
    } else if (closing && Array.from(trimmed).length < OUTCOME_NOTE_MIN) {
      errors.note = 'Say what was decided, so the outcome can be understood later.';
    } else {
      note = trimmed;
    }
  } else if (closing) {
    errors.note = 'Say what was decided, so the outcome can be understood later.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, error: 'invalid', errors };

  return transact((database) => {
    const report = database.userReports.find((candidate) => candidate.id === input.reportId);
    if (!report) return { ok: false as const, error: 'not_found' as const };

    const terminal = report.reportStatus === 'resolved' || report.reportStatus === 'dismissed';
    if (terminal) return { ok: false as const, error: 'already_closed' as const };
    if (input.outcome === 'reviewing' && report.reportStatus === 'reviewing') {
      return { ok: false as const, error: 'already_closed' as const };
    }

    const now = new Date().toISOString();
    report.reportStatus = input.outcome;
    if (closing) report.resolvedAt = now;

    database.moderationActions.push(
      actionRow({
        entityType: 'report',
        entityId: report.id,
        action: input.outcome,
        actorLabel: input.actorLabel,
        ...(note ? { note } : {}),
        createdAt: now,
      }),
    );

    return { ok: true as const, report: reportCases(database).find((entry) => entry.id === report.id)! };
  });
}

/** The two ways a dispute can end, and the only two an operator may impose. */
export type DisputeVerdict = 'completed' | 'cancelled';

export type DisputeVerdictResult =
  | { ok: true; dispute: DisputeCase; booking: TransitionOutcome }
  | { ok: false; error: 'not_found' | 'invalid_state' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

type TransitionOutcome = { id: string; status: string };

/**
 * A verdict is a bigger decision than a note, so it asks for more words.
 *
 * `completed` tells the customer the work stands and they owe the agreed amount;
 * `cancelled` tells the ServMate the work does not. Ten characters is not much,
 * but it is the difference between a decision a second person can review and a
 * click nobody can explain.
 */
const VERDICT_NOTE_MIN = 10;

/**
 * Imposes an outcome on a frozen booking.
 *
 * This is the operator counterpart to `resolveDispute`: the same transition, made
 * by somebody who is neither party, moving the booking out of `disputed` to
 * `completed` or `cancelled` and mirroring the job. Both parties are notified, the
 * move lands in `bookingStatusHistory` with the operator's label, and the
 * moderation audit row is written in the same transaction — so a booking can never
 * carry a verdict with no record of who made it.
 */
export async function imposeDisputeOutcome(input: {
  bookingId: string;
  verdict: DisputeVerdict;
  note?: unknown;
  actorLabel: string;
}): Promise<DisputeVerdictResult> {
  const errors: Record<string, string> = {};
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (Array.from(note).length < VERDICT_NOTE_MIN) {
    errors.note = `Write at least ${VERDICT_NOTE_MIN} characters: the two sides are told this outcome.`;
  } else if (Array.from(note).length > OUTCOME_NOTE_MAX) {
    errors.note = `Keep the note under ${OUTCOME_NOTE_MAX} characters.`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, error: 'invalid', errors };

  return transact((database) => {
    const booking = database.bookings.find((candidate) => candidate.id === input.bookingId);
    if (!booking) return { ok: false as const, error: 'not_found' as const };
    if (booking.status !== 'disputed') return { ok: false as const, error: 'invalid_state' as const };

    const moved = applyModeratorOutcome(database, {
      bookingId: input.bookingId,
      verdict: input.verdict,
      note,
      actorLabel: input.actorLabel,
    });
    if (!moved.ok) {
      // `not_yours` cannot happen to an operator; it is folded into `not_found`
      // rather than surfaced, which is how every other refusal of an unreadable
      // booking is answered.
      return {
        ok: false as const,
        error: moved.error === 'invalid_state' ? ('invalid_state' as const) : ('not_found' as const),
      };
    }

    database.moderationActions.push(
      actionRow({
        entityType: 'dispute',
        entityId: booking.id,
        action: 'decided',
        outcome: input.verdict,
        note,
        actorLabel: input.actorLabel,
        createdAt: new Date().toISOString(),
      }),
    );

    return {
      ok: true as const,
      booking: { id: booking.id, status: booking.status },
      dispute: disputeCases(database).find((entry) => entry.bookingId === booking.id)!, 
    };
  });
}

function actionRow(input: {
  entityType: ModerationActionRecord['entityType'];
  entityId: string;
  action: string;
  outcome?: string;
  note?: string;
  actorLabel: string;
  createdAt: string;
}): ModerationActionRecord {
  return {
    id: randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.note ? { note: input.note } : {}),
    actorLabel: input.actorLabel,
    createdAt: input.createdAt,
  };
}
