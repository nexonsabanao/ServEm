import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Blocking and reporting (§10.11, §14).
 *
 * A block has to mean something where it matters: the matching rules. So the
 * tests here are mostly about discovery — a blocked account disappearing from the
 * other's feed, in both directions, without an unrelated provider being affected.
 * Reporting is checked for what it must *not* do: confirm that a job you cannot
 * see exists, change anyone's visibility, or stack duplicates.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-trust-'));
process.env.SERVEM_SEED = '0';

const { createJobPost, publishJobPost } = await import('../lib/jobs.ts');
const { listAvailableJobs, getJobDetail } = await import('../lib/matching.ts');
const { onboardServMate, setServmateCategories, setServmateCoverage } = await import(
  '../lib/servmate-profile.ts'
);
const {
  REPORT_REASONS,
  blockUser,
  hasBlocked,
  listBlockedAccounts,
  listOwnReports,
  reportContent,
  unblockUser,
} = await import('../lib/trust.ts');
const { query, transact } = await import('../lib/store.ts');

const CUSTOMER = 'u-trust-customer';
const CLEANER = 'u-trust-cleaner';
const OTHER_CLEANER = 'u-trust-other-cleaner';
const PLUMBER = 'u-trust-plumber';
const ONLOOKER = 'u-trust-onlooker';

let jobId = '';

async function createAccounts(ids: string[]): Promise<void> {
  await transact((database) => {
    for (const id of ids) {
      if (database.users.some((user) => user.id === id)) continue;
      database.users.push({
        id,
        name: id.replace(/^u-trust-/, '').replace(/^\w/, (c) => c.toUpperCase()),
        email: `${id}@example.test`,
        username: id,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

test('two eligible providers and one who is not', async () => {
  await createAccounts([CUSTOMER, CLEANER, OTHER_CLEANER, PLUMBER, ONLOOKER]);

  for (const [userId, category] of [
    [CLEANER, 'cleaning'],
    [OTHER_CLEANER, 'cleaning'],
    [PLUMBER, 'home-repair'],
  ] as const) {
    const profile = await onboardServMate(userId);
    await setServmateCategories(profile.profileId!, [category]);
    await setServmateCoverage(profile.profileId!, ['Bacoor']);
  }

  const created = await createJobPost(CUSTOMER, {
    title: 'Move-out clean',
    description: 'Whole unit, including the balcony.',
    categoryId: 'cleaning',
    pricingModel: 'fixed',
    budgetCentavos: 150000,
    locationCity: 'Bacoor',
    scheduleFlexible: true,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  jobId = created.job.id;
  await publishJobPost(CUSTOMER, jobId);

  const feed = await listAvailableJobs({ userId: CLEANER });
  assert.ok(feed.some((entry) => entry.id === jobId));
});

test('a block is refused for yourself and for an account that does not exist', async () => {
  const self = await blockUser(CUSTOMER, CUSTOMER);
  assert.equal(self.ok, false);
  if (!self.ok) assert.equal(self.error, 'self');

  const missing = await blockUser(CUSTOMER, 'u-nobody');
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, 'not_found');
});

test('blocking a provider hides the job from them, and only from them', async () => {
  const blocked = await blockUser(CUSTOMER, CLEANER);
  assert.equal(blocked.ok, true);

  assert.equal(await hasBlocked(CUSTOMER, CLEANER), true);
  assert.equal(await hasBlocked(CLEANER, CUSTOMER), false);

  const theirFeed = await listAvailableJobs({ userId: CLEANER });
  assert.ok(!theirFeed.some((entry) => entry.id === jobId));
  assert.equal(await getJobDetail({ jobId, userId: CLEANER }), null);

  // The unrelated eligible provider is untouched.
  const otherFeed = await listAvailableJobs({ userId: OTHER_CLEANER });
  assert.ok(otherFeed.some((entry) => entry.id === jobId));
});

test('a block placed the other way has the same effect', async () => {
  await unblockUser(CUSTOMER, CLEANER);
  assert.ok((await listAvailableJobs({ userId: CLEANER })).some((entry) => entry.id === jobId));

  // The provider blocks the customer: the customer's job disappears from their
  // feed just the same, which is the half a one-directional rule would miss.
  const reverse = await blockUser(CLEANER, CUSTOMER);
  assert.equal(reverse.ok, true);
  assert.ok(!(await listAvailableJobs({ userId: CLEANER })).some((entry) => entry.id === jobId));
  assert.equal(await getJobDetail({ jobId, userId: CLEANER }), null);

  await unblockUser(CLEANER, CUSTOMER);
  assert.ok((await listAvailableJobs({ userId: CLEANER })).some((entry) => entry.id === jobId));
});

test('blocking twice is one row, and unblocking empties the list', async () => {
  await blockUser(CUSTOMER, CLEANER);
  await blockUser(CUSTOMER, CLEANER);

  const rows = await query((database) =>
    database.userBlocks.filter(
      (block) => block.blockerUserId === CUSTOMER && block.blockedUserId === CLEANER,
    ),
  );
  assert.equal(rows.length, 1);

  const listed = await listBlockedAccounts(CUSTOMER);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.userId, CLEANER);
  assert.match(listed[0]?.name ?? '', /Cleaner/);

  await unblockUser(CUSTOMER, CLEANER);
  assert.deepEqual(await listBlockedAccounts(CUSTOMER), []);
  assert.equal(await hasBlocked(CUSTOMER, CLEANER), false);
});

test('a block is private to the account that placed it', async () => {
  await blockUser(CUSTOMER, CLEANER);
  // Somebody else's list is their own; this is not a \"who blocked me\".
  assert.deepEqual(await listBlockedAccounts(ONLOOKER), []);
  assert.equal(await hasBlocked(CLEANER, CUSTOMER), false);
  await unblockUser(CUSTOMER, CLEANER);
});

test('a report needs one target and a known reason', async () => {
  const noReason = await reportContent({
    reporterUserId: CUSTOMER,
    reasonCode: 'because',
    reportedUserId: CLEANER,
  });
  assert.equal(noReason.ok, false);
  if (!noReason.ok && noReason.error === 'invalid') {
    assert.ok(noReason.errors.reasonCode);
  }

  const twoTargets = await reportContent({
    reporterUserId: CUSTOMER,
    reasonCode: 'spam',
    reportedUserId: CLEANER,
    reportedJobId: jobId,
  });
  assert.equal(twoTargets.ok, false);

  const self = await reportContent({
    reporterUserId: CUSTOMER,
    reasonCode: 'spam',
    reportedUserId: CUSTOMER,
  });
  assert.equal(self.ok, false);
  if (!self.ok) assert.equal(self.error, 'not_found');

  const missing = await reportContent({
    reporterUserId: CUSTOMER,
    reasonCode: 'spam',
    reportedUserId: 'u-nobody',
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, 'not_found');
});

test('reporting an account records one open report, not a stack', async () => {
  const first = await reportContent({
    reporterUserId: CUSTOMER,
    reasonCode: 'harassment',
    description: 'Repeated unwanted messages after I declined.',
    reportedUserId: CLEANER,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.report.reportStatus, 'open');
  assert.equal(first.report.reasonCode, 'harassment');

  const second = await reportContent({
    reporterUserId: CUSTOMER,
    reasonCode: 'harassment',
    reportedUserId: CLEANER,
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error, 'already_reported');

  // A different account reporting the same person is a separate report.
  const other = await reportContent({
    reporterUserId: ONLOOKER,
    reasonCode: 'spam',
    reportedUserId: CLEANER,
  });
  assert.equal(other.ok, true);
});

test('every declared reason is accepted', async () => {
  // A distinct target per reason, so the duplicate rule cannot mask a rejection.
  const targets = REPORT_REASONS.map((_, index) => `u-trust-target-${index}`);
  await createAccounts(targets);

  for (const [index, reason] of REPORT_REASONS.entries()) {
    const result = await reportContent({
      reporterUserId: CUSTOMER,
      reasonCode: reason,
      reportedUserId: targets[index]!,
    });
    assert.equal(result.ok, true, `${reason}: ${JSON.stringify(result)}`);
    if (result.ok) assert.equal(result.report.reasonCode, reason);
  }
});

test('an eligible provider can report the job, an ineligible one cannot see it to report', async () => {
  const eligible = await reportContent({
    reporterUserId: OTHER_CLEANER,
    reasonCode: 'unsafe',
    description: 'The description asks for something outside the category.',
    reportedJobId: jobId,
  });
  assert.equal(eligible.ok, true);

  const ineligible = await reportContent({
    reporterUserId: PLUMBER,
    reasonCode: 'unsafe',
    reportedJobId: jobId,
  });
  assert.equal(ineligible.ok, false);
  if (!ineligible.ok) assert.equal(ineligible.error, 'not_found');

  const guessed = await reportContent({
    reporterUserId: CUSTOMER,
    reasonCode: 'unsafe',
    reportedJobId: 'not-a-job',
  });
  assert.equal(guessed.ok, false);
});

test('reporting changes nobody\'s visibility', async () => {
  // The customer reported the cleaner above; the cleaner still sees the job.
  const feed = await listAvailableJobs({ userId: CLEANER });
  assert.ok(feed.some((entry) => entry.id === jobId));
});

test('a message can only be reported by someone who can read it', async () => {
  const seeded = await transact((database) => {
    const conversationId = 'conv-trust-1';
    database.conversations.push({
      id: conversationId,
      conversationType: 'booking',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    database.conversationParticipants.push({
      conversationId,
      userId: CUSTOMER,
      joinedAt: new Date().toISOString(),
    });
    const messageId = 'msg-trust-1';
    database.messages.push({
      id: messageId,
      conversationId,
      senderUserId: CUSTOMER,
      senderRole: 'customer',
      body: 'Hello',
      createdAt: new Date().toISOString(),
    });
    return { conversationId, messageId };
  });

  const participant = await reportContent({
    reporterUserId: CUSTOMER,
    reasonCode: 'spam',
    reportedMessageId: seeded.messageId,
  });
  assert.equal(participant.ok, true);

  const outsider = await reportContent({
    reporterUserId: ONLOOKER,
    reasonCode: 'spam',
    reportedMessageId: seeded.messageId,
  });
  assert.equal(outsider.ok, false);
  if (!outsider.ok) assert.equal(outsider.error, 'not_found');

  const guessed = await reportContent({
    reporterUserId: CUSTOMER,
    reasonCode: 'spam',
    reportedMessageId: 'not-a-message',
  });
  assert.equal(guessed.ok, false);
});

test('an account reads its own filed reports, and another account reads its own', async () => {
  const mine = await listOwnReports(CUSTOMER);
  const theirs = await listOwnReports(ONLOOKER);

  // The customer reported a person and a message. The report about the job was
  // filed by a different provider, so it is not in either list.
  assert.ok(mine.some((report) => report.subject === 'Account · Cleaner'));
  assert.ok(mine.some((report) => report.subject === 'Message · a chat you were part of'));
  assert.equal(mine.some((report) => report.subject.startsWith('Job ·')), false);

  assert.equal(theirs.length, 1);
  assert.equal(theirs[0]?.reasonCode, 'spam');
  assert.equal(theirs[0]?.subject, 'Account · Cleaner');

  // Newest first, and every row carries the reason's words rather than its code.
  const times = mine.map((report) => report.createdAt);
  assert.deepEqual(times, [...times].sort().reverse());
  assert.ok(mine.every((report) => report.reasonLabel !== ''));
  assert.ok(mine.every((report) => report.status === 'open'));
});

test('a report names the job it is about only while the reporter can still see it', async () => {
  const watcher = 'u-trust-watcher';
  await createAccounts([watcher]);
  const profile = await onboardServMate(watcher);
  await setServmateCategories(profile.profileId!, ['cleaning']);
  await setServmateCoverage(profile.profileId!, ['Bacoor']);

  const created = await createJobPost(CUSTOMER, {
    title: 'Balcony repaint',
    description: 'Railings and ceiling, one afternoon.',
    categoryId: 'cleaning',
    pricingModel: 'negotiable',
    budgetCentavos: 200000,
    budgetMaxCentavos: 260000,
    locationCity: 'Bacoor',
    scheduleFlexible: true,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  await publishJobPost(CUSTOMER, created.job.id);

  const filed = await reportContent({
    reporterUserId: watcher,
    reasonCode: 'misrepresentation',
    description: 'The photos are of a different unit.',
    reportedJobId: created.job.id,
  });
  assert.equal(filed.ok, true);

  const whileEligible = await listOwnReports(watcher);
  assert.equal(whileEligible.length, 1);
  assert.equal(whileEligible[0]?.subject, 'Job · Balcony repaint');
  assert.equal(whileEligible[0]?.reasonLabel, 'Misleading or false');
  assert.equal(whileEligible[0]?.description, 'The photos are of a different unit.');

  // The provider stops doing cleaning, so the job is no longer theirs to read.
  // The row stops naming it rather than becoming a way to keep watching a job
  // they have lost the right to open.
  await setServmateCategories(profile.profileId!, ['home-repair']);
  const afterChange = await listOwnReports(watcher);
  assert.equal(afterChange[0]?.subject, 'Job · no longer visible to you');
  assert.equal(afterChange[0]?.id, whileEligible[0]?.id);
});
