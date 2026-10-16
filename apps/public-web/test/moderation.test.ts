import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * The moderation console (§10.11, §14).
 *
 * Two things earn tests here, and neither is the UI. The first is **the access
 * model**: this console is the one surface in the app not answered from a
 * customer session, so every failure — no token, no cookie, a cookie from a
 * rotated token — has to be the same refusal, or the surface can be probed for.
 * The second is **the audit trail**: a verdict changes who owes what and which
 * party is believed, so a booking must never carry an outcome with no record of
 * who imposed it.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-moderation-'));
process.env.SERVEM_SEED = '0';

const { transact } = await import('../lib/store.ts');
const {
  checkModerationToken,
  evaluateModeratorAccess,
  getDisputeCase,
  getReportCase,
  imposeDisputeOutcome,
  listCases,
  recordReportOutcome,
} = await import('../lib/moderation.ts');

const CUSTOMER = 'u-mod-customer';
const PROVIDER = 'u-mod-provider';
const REPORTER = 'u-mod-reporter';
const OUTSIDER = 'u-mod-outsider';
const PROFILE = 'sm-mod-provider';
const JOB = 'job-mod-1';
const BOOKING = 'booking-mod-1';
const REPORT_PERSON = 'report-mod-person';
const REPORT_JOB = 'report-mod-job';
const TOKEN = 'test-moderation-token-0123456789';

const stamp = '2026-10-10T02:00:00.000Z';

async function seed(): Promise<void> {
  await transact((database) => {
    for (const [id, name] of [
      [CUSTOMER, 'Caring Customer'],
      [PROVIDER, 'Working Provider'],
      [REPORTER, 'Reporting Neighbour'],
      [OUTSIDER, 'Uninvolved Account'],
    ] as const) {
      database.users.push({ id, name, email: `${id}@example.test`, createdAt: stamp });
    }

    database.servmateProfiles.push({
      id: PROFILE,
      userId: PROVIDER,
      providerStatus: 'active',
      verificationStatus: 'unverified',
      createdAt: stamp,
      updatedAt: stamp,
    });

    database.jobPosts.push({
      customerId: CUSTOMER,
      categoryId: 'cleaning',
      title: 'Deep clean before turnover',
      description: 'Two bedrooms, one bathroom, balcony.',
      jobStatus: 'in_progress',
      pricingModel: 'fixed',
      budgetCentavos: 250000,
      currency: 'PHP',
      locationCity: 'Bacoor',
      scheduleFlexible: true,
      createdAt: stamp,
      updatedAt: stamp,
      id: JOB,
    });

    database.bookings.push({
      id: BOOKING,
      reference: 'SE-1001',
      userId: CUSTOMER,
      jobPostId: JOB,
      servmateProfileId: PROFILE,
      // No `serviceTitle` on purpose: a booking made from an accepted offer does
      // not carry one, and the case must still name the work.
      message: 'Booked from offer.',
      status: 'disputed',
      agreedAmountCentavos: 250000,
      agreedCurrency: 'PHP',
      area: 'Bacoor',
      createdAt: stamp,
    });
    database.bookingStatusHistory.push({
      id: 'hist-1',
      bookingId: BOOKING,
      oldStatus: 'in_progress',
      newStatus: 'disputed',
      actorUserId: CUSTOMER,
      reason: 'The balcony was not touched and nobody answered my messages.',
      createdAt: stamp,
    });

    database.userReports.push({
      id: REPORT_PERSON,
      reporterUserId: REPORTER,
      reportedUserId: PROVIDER,
      reasonCode: 'harassment',
      description: 'Kept messaging after being told to stop.',
      reportStatus: 'open',
      createdAt: '2026-10-10T03:00:00.000Z',
    });
    database.userReports.push({
      id: REPORT_JOB,
      reporterUserId: PROVIDER,
      reportedJobId: JOB,
      reasonCode: 'unsafe',
      reportStatus: 'open',
      createdAt: '2026-10-10T04:00:00.000Z',
    });
  });
}

await seed();

test('no configured token means no console', () => {
  delete process.env.SERVEM_MODERATION_TOKEN;
  assert.equal(checkModerationToken('anything-well-formed-here-x'), false);
  assert.equal(evaluateModeratorAccess(null, 'some-cookie').allowed, false);
});

test('a token shorter than the floor is treated as no token, not as a weak one', () => {
  process.env.SERVEM_MODERATION_TOKEN = 'admin';
  assert.equal(checkModerationToken('admin'), false);
  assert.equal(evaluateModeratorAccess('admin', null).allowed, false);
});

test('the configured token is accepted, close variants are not', () => {
  process.env.SERVEM_MODERATION_TOKEN = TOKEN;
  assert.equal(checkModerationToken(TOKEN), true);
  assert.equal(checkModerationToken(` ${TOKEN} `), true, 'surrounding whitespace is trimmed');
  assert.equal(checkModerationToken(TOKEN.slice(0, -1)), false);
  assert.equal(checkModerationToken(`${TOKEN}x`), false);
});

test('every way of not being an operator is refused identically', () => {
  const held = createHash('sha256').update(TOKEN).digest('hex');

  assert.equal(evaluateModeratorAccess(TOKEN, held).allowed, true);
  assert.equal(evaluateModeratorAccess(TOKEN, undefined).allowed, false);
  assert.equal(evaluateModeratorAccess(TOKEN, '').allowed, false);
  // A cookie minted by a token that has since been rotated.
  const rotated = createHash('sha256').update('previous-token-0123456789abcd').digest('hex');
  assert.equal(evaluateModeratorAccess(TOKEN, rotated).allowed, false);
  // A customer session cookie offered in place of an operator cookie.
  assert.equal(evaluateModeratorAccess(TOKEN, 'a2f5c9a1'.repeat(8)).allowed, false);
  // A digest of the right shape but of something else entirely.
  const wrongDigest = createHash('sha256').update('not-the-token').digest('hex');
  assert.equal(evaluateModeratorAccess(TOKEN, wrongDigest).allowed, false);
});

test('the queue shows open cases and reads the job a report names', async () => {
  const queue = await listCases();
  assert.equal(queue.reports.length, 2);
  assert.equal(queue.disputes.length, 1);

  const personReport = queue.reports.find((report) => report.id === REPORT_PERSON);
  assert.equal(personReport?.reasonLabel, 'Harassment or abuse');
  assert.equal(personReport?.reporter.name, 'Reporting Neighbour');
  assert.equal(personReport?.reported?.name, 'Working Provider');
  assert.equal(personReport?.subject.kind, 'account');
  assert.equal(personReport?.subject.label, 'Working Provider');

  // A report about somebody else's private job is readable here and nowhere
  // else: judging it requires the job, which is why the operator read is not
  // filtered by eligibility.
  const jobReport = queue.reports.find((report) => report.id === REPORT_JOB);
  assert.equal(jobReport?.subject.kind, 'job');
  assert.equal(jobReport?.subject.label, 'Deep clean before turnover');
  assert.equal(jobReport?.subject.excerpt, 'Two bedrooms, one bathroom, balcony.');
});

test('the dispute case carries the parties and how the work got here', async () => {
  const dispute = await getDisputeCase(BOOKING);
  assert.equal(
    dispute?.serviceTitle,
    'Deep clean before turnover',
    'the work is named from the job when the booking has no snapshot of its own',
  );
  assert.equal(dispute?.customer.name, 'Caring Customer');
  assert.equal(dispute?.provider?.name, 'Working Provider');
  assert.equal(dispute?.agreedAmountCentavos, 250000);
  assert.equal(dispute?.reason, 'The balcony was not touched and nobody answered my messages.');
  assert.deepEqual(
    dispute?.timeline.map((entry) => `${entry.from}->${entry.to}`),
    ['in_progress->disputed'],
  );
  assert.equal(dispute?.timeline[0]?.actor, 'Caring Customer');
  assert.equal(await getDisputeCase('no-such-booking'), null);
});

test('closing a report requires a note and writes an audit row', async () => {
  const withoutNote = await recordReportOutcome({
    reportId: REPORT_PERSON,
    outcome: 'resolved',
    note: '   ',
    actorLabel: 'test-operator',
  });
  assert.equal(withoutNote.ok, false);
  if (!withoutNote.ok && withoutNote.error === 'invalid') {
    assert.ok(withoutNote.errors.note);
  } else {
    assert.fail('a closing outcome with no note must be refused');
  }

  const claimed = await recordReportOutcome({
    reportId: REPORT_PERSON,
    outcome: 'reviewing',
    note: undefined,
    actorLabel: 'test-operator',
  });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.ok && claimed.report.status, 'reviewing');

  const closed = await recordReportOutcome({
    reportId: REPORT_PERSON,
    outcome: 'resolved',
    note: 'Provider warned; the messages stopped.',
    actorLabel: 'test-operator',
  });
  assert.equal(closed.ok, true);
  assert.equal(closed.ok && closed.report.status, 'resolved');
  assert.equal(closed.ok && typeof closed.report.resolvedAt, 'string');
  assert.equal(
    closed.ok && closed.report.actions[0]?.note,
    'Provider warned; the messages stopped.',
  );
  assert.equal(closed.ok && closed.report.actions[0]?.actorLabel, 'test-operator');

  // A terminal case cannot be reopened, and a closed one leaves the queue.
  const again = await recordReportOutcome({
    reportId: REPORT_PERSON,
    outcome: 'dismissed',
    note: 'Changed my mind about it.',
    actorLabel: 'test-operator',
  });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.error, 'already_closed');

  const queue = await listCases();
  assert.equal(queue.reports.some((report) => report.id === REPORT_PERSON), false);
  assert.equal(queue.reports.some((report) => report.id === REPORT_JOB), true);

  const missing = await recordReportOutcome({
    reportId: 'no-such-report',
    outcome: 'reviewing',
    actorLabel: 'test-operator',
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, 'not_found');
});

test('a dispute verdict needs a reason and moves the work for both parties', async () => {
  const tooShort = await imposeDisputeOutcome({
    bookingId: BOOKING,
    verdict: 'completed',
    note: 'fine',
    actorLabel: 'test-operator',
  });
  assert.equal(tooShort.ok, false);
  if (!tooShort.ok && tooShort.error === 'invalid') {
    assert.ok(tooShort.errors.note);
  } else {
    assert.fail('a verdict needs a reason');
  }

  const verdict = await imposeDisputeOutcome({
    bookingId: BOOKING,
    verdict: 'completed',
    note: 'Photos show the balcony was cleaned; the work stands.',
    actorLabel: 'operator-two',
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.ok && verdict.booking.status, 'completed');

  const { query } = await import('../lib/store.ts');
  const after = await query((database) => ({
    booking: database.bookings.find((row) => row.id === BOOKING)!,
    job: database.jobPosts.find((row) => row.id === JOB)!,
    history: database.bookingStatusHistory.filter((row) => row.bookingId === BOOKING),
    actions: database.moderationActions,
    notifications: database.notifications,
  }));

  assert.equal(after.booking.status, 'completed');
  assert.equal(typeof after.booking.completedAt, 'string');
  assert.equal(after.job.jobStatus, 'completed');

  const decision = after.history.at(-1);
  assert.equal(decision?.newStatus, 'completed');
  assert.equal(decision?.actorUserId, 'moderator:operator-two');
  assert.match(decision?.reason ?? '', /operator-two/);

  // The audit row is the reason a booking can never carry a verdict alone.
  const audit = after.actions.find((row) => row.entityId === BOOKING);
  assert.equal(audit?.entityType, 'dispute');
  assert.equal(audit?.action, 'decided');
  assert.equal(audit?.outcome, 'completed');
  assert.equal(audit?.actorLabel, 'operator-two');
  assert.equal(audit?.note, 'Photos show the balcony was cleaned; the work stands.');

  // Both sides are told, because neither of them was the one who decided.
  const told = after.notifications
    .filter((row) => row.entityId === BOOKING)
    .map((row) => row.recipientUserId)
    .sort();
  assert.deepEqual(told, [CUSTOMER, PROVIDER].sort());

  // The case is off the queue, and a second verdict is refused rather than
  // overwriting the first.
  const queue = await listCases();
  assert.equal(queue.disputes.length, 0);
  const second = await imposeDisputeOutcome({
    bookingId: BOOKING,
    verdict: 'cancelled',
    note: 'Trying to change the outcome afterwards.',
    actorLabel: 'operator-two',
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error, 'invalid_state');

  const missing = await imposeDisputeOutcome({
    bookingId: 'no-such-booking',
    verdict: 'cancelled',
    note: 'A booking that does not exist at all.',
    actorLabel: 'operator-two',
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, 'not_found');
});

test('a cancelled verdict closes the job and stamps the cancellation', async () => {
  const second = 'booking-mod-2';
  await transact((database) => {
    database.bookings.push({
      id: second,
      reference: 'SE-1002',
      userId: CUSTOMER,
      jobPostId: JOB,
      servmateProfileId: PROFILE,
      serviceTitle: 'Second attempt',
      message: 'Booked from offer.',
      status: 'disputed',
      createdAt: stamp,
    });
  });

  const verdict = await imposeDisputeOutcome({
    bookingId: second,
    verdict: 'cancelled',
    note: 'Nobody turned up and the work was never done.',
    actorLabel: 'operator-three',
  });
  assert.equal(verdict.ok, true);

  const rows = await (async () => {
    const { query } = await import('../lib/store.ts');
    return query((database) => ({
      booking: database.bookings.find((row) => row.id === second)!,
      job: database.jobPosts.find((row) => row.id === JOB)!,
      audit: database.moderationActions.filter((row) => row.entityId === second),
    }));
  })();

  assert.equal(rows.booking.status, 'cancelled');
  assert.equal(typeof rows.booking.cancelledAt, 'string');
  assert.equal(rows.job.jobStatus, 'cancelled');
  assert.equal(rows.audit[0]?.outcome, 'cancelled');
});

test('a decided case stays readable, and deciding one changes nobody else', async () => {
  // Off the queue, still a case: the second person to look at it gets the first
  // person's reasoning rather than an empty screen.
  const decided = await getReportCase(REPORT_PERSON);
  assert.equal(decided?.status, 'resolved');
  assert.deepEqual(
    decided?.actions.map((action) => action.action),
    ['resolved', 'reviewing'],
  );
  assert.equal(decided?.actions[1]?.actorLabel, 'test-operator');

  const { query } = await import('../lib/store.ts');
  const after = await query((database) => ({
    profile: database.servmateProfiles.find((row) => row.id === PROFILE)!,
    user: database.users.find((row) => row.id === PROVIDER)!,
  }));

  // A report is a record, not a verdict: closing one never suspends, hides or
  // edits the account it names. Suspension is a separate decision with separate
  // consequences, and this module deliberately has no such control.
  assert.equal(after.profile.providerStatus, 'active');
  assert.equal(after.profile.verificationStatus, 'unverified');
  assert.equal(after.user.name, 'Working Provider');
  assert.notEqual(OUTSIDER, REPORTER);
});
