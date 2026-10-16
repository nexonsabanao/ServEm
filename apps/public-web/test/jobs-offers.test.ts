import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * The private job and offer workflow, against a scratch store.
 *
 * `SERVEM_DATA_DIR` is pointed at a fresh temporary directory before the modules
 * are imported, so these tests can never read or write the store a developer's
 * running site is serving. They are the hermetic half of the proof; the same
 * journey is exercised through a live server by `test/e2e-live.mjs`.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-test-'));
process.env.SERVEM_SEED = '0';

const { createJobPost, publishJobPost, updateJobPost, cancelJobPost, listCustomerJobs } = await import(
  '../lib/jobs.ts'
);
const { submitOffer, acceptOffer, declineOffer, listOffersForJob, withdrawOffer } = await import(
  '../lib/offers.ts'
);
const { listAvailableJobs, getJobDetail } = await import('../lib/matching.ts');
const { onboardServMate, setServmateCategories, setServmateCoverage } = await import(
  '../lib/servmate-profile.ts'
);
const { query, transact } = await import('../lib/store.ts');

const CUSTOMER = 'u-customer';
const CLEANER_A = 'u-cleaner-a';
const CLEANER_B = 'u-cleaner-b';
const PLUMBER = 'u-plumber';
const OUT_OF_AREA = 'u-far';

const jobFacts = {
  title: 'Deep clean a two-bedroom condo',
  description: 'Kitchen, bathrooms, living room and bedrooms.',
  categoryId: 'cleaning',
  pricingModel: 'fixed',
  budgetCentavos: 180000,
  locationCity: 'Bacoor',
  locationBarangay: 'Molino IV',
  locationNotes: 'Gate code 1234',
  scheduleFlexible: true,
};

let jobId = '';
let offerA = '';
let offerB = '';

test('providers with the category and coverage can be onboarded', async () => {
  await createAccounts([CUSTOMER, CLEANER_A, CLEANER_B, PLUMBER, OUT_OF_AREA]);

  const a = await onboardServMate(CLEANER_A);
  assert.ok(a.profileId);
  await setServmateCategories(a.profileId, ['cleaning']);
  await setServmateCoverage(a.profileId, ['Bacoor']);

  const b = await onboardServMate(CLEANER_B);
  await setServmateCategories(b.profileId, ['cleaning']);
  await setServmateCoverage(b.profileId, ['Bacoor']);

  const plumber = await onboardServMate(PLUMBER);
  await setServmateCategories(plumber.profileId, ['home-repair']);
  await setServmateCoverage(plumber.profileId, ['Bacoor']);

  const far = await onboardServMate(OUT_OF_AREA);
  await setServmateCategories(far.profileId, ['cleaning']);
  await setServmateCoverage(far.profileId, ['Tagaytay']);

  // An unknown category is refused rather than stored.
  const bad = await setServmateCategories(a.profileId, ['not-a-category']);
  assert.equal(bad.ok, false);
});

test('a job is created as a draft, validated, and published', async () => {
  const invalid = await createJobPost(CUSTOMER, { ...jobFacts, categoryId: 'nope' });
  assert.equal(invalid.ok, false);

  const created = await createJobPost(CUSTOMER, jobFacts);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  jobId = created.job.id;
  assert.equal(created.job.jobStatus, 'draft');
  assert.equal(created.job.locationCity, 'Bacoor');

  // A draft is not discoverable.
  const drafts = await listAvailableJobs({ userId: CLEANER_A });
  assert.equal(drafts.some((job) => job.id === jobId), false);

  const published = await publishJobPost(CUSTOMER, jobId);
  assert.equal(published.ok, true);
  if (published.ok) {
    assert.equal(published.job.jobStatus, 'open');
    assert.ok(published.job.expiresAt);
    assert.equal((await listCustomerJobs(CUSTOMER)).length, 1);
  }
});

test('discovery is limited by category and by coverage area', async () => {
  assert.equal(
    (await listAvailableJobs({ userId: CLEANER_A })).some((job) => job.id === jobId),
    true,
    'a cleaning ServMate in Bacoor sees the job',
  );
  assert.equal(
    (await listAvailableJobs({ userId: PLUMBER })).some((job) => job.id === jobId),
    false,
    'a repair-only ServMate does not',
  );
  assert.equal(
    (await listAvailableJobs({ userId: OUT_OF_AREA })).some((job) => job.id === jobId),
    false,
    'a cleaning ServMate covering only Tagaytay does not',
  );
});

test('the discovery summary withholds the exact address, the detail does not', async () => {
  const feed = await listAvailableJobs({ userId: CLEANER_A });
  const summary = feed.find((job) => job.id === jobId);
  assert.ok(summary);
  assert.equal(summary.locationCity, 'Bacoor');
  assert.equal('locationBarangay' in summary, false);
  assert.equal('locationNotes' in summary, false);

  const detail = await getJobDetail({ jobId, userId: CLEANER_A });
  assert.equal(detail?.locationBarangay, 'Molino IV');
  assert.equal(await getJobDetail({ jobId, userId: PLUMBER }), null);
  assert.equal(await getJobDetail({ jobId: 'no-such-job', userId: CLEANER_A }), null);
});

test('the schedule rules narrow discovery without widening it', async () => {
  const start = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const scheduled = await createJobPost(CUSTOMER, {
    ...jobFacts,
    title: 'Deep clean on a fixed morning',
    preferredStart: start,
    scheduleFlexible: false,
  });
  assert.equal(scheduled.ok, true);
  if (!scheduled.ok) return;
  await publishJobPost(CUSTOMER, scheduled.job.id);

  const laterStart = new Date(Date.parse(start) + 3_600_000).toISOString();
  const earlierStart = new Date(Date.parse(start) - 3_600_000).toISOString();
  const feed = (filters: Record<string, unknown>) =>
    listAvailableJobs({ userId: CLEANER_A, filters });

  assert.equal(
    (await feed({ startFrom: earlierStart })).some((job) => job.id === scheduled.job.id),
    true,
    'a startFrom before the job start admits it',
  );
  assert.equal(
    (await feed({ startFrom: laterStart })).some((job) => job.id === scheduled.job.id),
    false,
    'a startFrom after the job start hides it',
  );
  assert.equal(
    (await feed({ startBefore: laterStart })).some((job) => job.id === scheduled.job.id),
    true,
  );
  assert.equal(
    (await feed({ startBefore: earlierStart })).some((job) => job.id === scheduled.job.id),
    false,
  );
  // A flexible job states no time, so a schedule window never hides it.
  assert.equal(
    (await feed({ startFrom: laterStart })).some((job) => job.id === jobId),
    true,
    'a flexible job survives any schedule window',
  );

  // A fixed start that has already passed is stale work.
  const stale = await createJobPost(CUSTOMER, {
    ...jobFacts,
    title: 'A clean that was needed yesterday',
    preferredStart: new Date(Date.now() - 86_400_000).toISOString(),
    scheduleFlexible: false,
  });
  assert.equal(stale.ok, true);
  if (!stale.ok) return;
  await publishJobPost(CUSTOMER, stale.job.id);
  assert.equal(
    (await listAvailableJobs({ userId: CLEANER_A })).some((job) => job.id === stale.job.id),
    false,
    'a stale fixed-start job is not discoverable',
  );
  assert.equal(await getJobDetail({ jobId: stale.job.id, userId: CLEANER_A }), null);

  // A filter can only narrow the authorized set, never widen it.
  assert.equal(
    (await listAvailableJobs({ userId: PLUMBER, filters: { categoryId: 'cleaning' } })).some(
      (job) => job.categoryId === 'cleaning',
    ),
    false,
    'asking for another category does not reveal one',
  );
});

test('two eligible ServMates can hold competing offers on one job', async () => {
  const first = await submitOffer({
    jobPostId: jobId,
    userId: CLEANER_A,
    servmateProfileId: (await providerProfileId(CLEANER_A))!,
    body: { amountCentavos: 175000, scopeDescription: 'Supplies included.' },
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  offerA = first.offer.id;

  const job = await query((db) => db.jobPosts.find((row) => row.id === jobId));
  assert.equal(job?.jobStatus, 'offer_received');

  /**
   * The regression this whole pass exists for: the job must stay discoverable
   * after the first offer, or a customer could never compare.
   */
  assert.equal(
    (await listAvailableJobs({ userId: CLEANER_B })).some((job) => job.id === jobId),
    true,
    'a job with an offer is still discoverable',
  );

  const second = await submitOffer({
    jobPostId: jobId,
    userId: CLEANER_B,
    servmateProfileId: (await providerProfileId(CLEANER_B))!,
    body: { amountCentavos: 165000 },
  });
  assert.equal(second.ok, true);
  if (second.ok) offerB = second.offer.id;

  const duplicate = await submitOffer({
    jobPostId: jobId,
    userId: CLEANER_A,
    servmateProfileId: (await providerProfileId(CLEANER_A))!,
    body: { amountCentavos: 1 },
  });
  assert.equal(duplicate.ok === false && duplicate.error, 'already_offered');

  const ineligible = await submitOffer({
    jobPostId: jobId,
    userId: PLUMBER,
    servmateProfileId: (await providerProfileId(PLUMBER))!,
    body: { amountCentavos: 1 },
  });
  assert.equal(ineligible.ok === false && ineligible.error, 'not_eligible');

  const offers = await listOffersForJob(jobId, CUSTOMER);
  assert.equal(offers?.length, 2);
  assert.equal(offers?.[0]?.offer.amountCentavos, 165000, 'cheapest first');
  assert.equal(await listOffersForJob(jobId, 'u-someone-else'), null);
});

test('a live job stays editable while it has offers', async () => {
  const edited = await updateJobPost(CUSTOMER, jobId, { budgetCentavos: 190000 });
  assert.equal(edited.ok, true);
  if (edited.ok) assert.equal(edited.job.budgetCentavos, 190000);

  // Editing the category re-decides eligibility, so the live offers are marked.
  const recategorised = await updateJobPost(CUSTOMER, jobId, { categoryId: 'events' });
  assert.equal(recategorised.ok, true);
  const marked = await listOffersForJob(jobId, CUSTOMER);
  assert.deepEqual(
    (marked ?? []).map((entry) => entry.offer.offerStatus),
    ['category_changed', 'category_changed'],
  );

  // Put it back so the rest of the journey runs on the original category.
  await updateJobPost(CUSTOMER, jobId, { categoryId: 'cleaning' });
  const reopened = await query((db) => db.jobPosts.find((row) => row.id === jobId));
  assert.equal(reopened?.jobStatus, 'open');
  await reOffer(CLEANER_A, 175000);
  await reOffer(CLEANER_B, 165000);
});

test('accepting an offer books the job, withdraws the rest and freezes the terms', async () => {
  const offers = await listOffersForJob(jobId, CUSTOMER);
  // The category round-trip above left superseded rows behind, so take the
  // live offer rather than the first one at that price.
  const winner = (offers ?? []).find(
    (entry) => entry.offer.amountCentavos === 165000 && entry.offer.offerStatus === 'pending',
  );
  assert.ok(winner);
  offerB = winner!.offer.id;

  const accepted = await acceptOffer(offerB, CUSTOMER);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;

  const booking = await query((db) => db.bookings.find((row) => row.id === accepted.bookingId));
  assert.ok(booking);
  assert.equal(booking!.status, 'confirmed');
  assert.equal(booking!.agreedAmountCentavos, 165000, 'the agreed amount is snapshotted');
  assert.equal(booking!.agreedCurrency, 'PHP');
  assert.equal(booking!.jobPostId, jobId);
  assert.equal(booking!.acceptedOfferId, offerB);
  assert.match(booking!.reference, /^SE-[0-9A-F]{6}$/);

  const history = await query((db) =>
    db.bookingStatusHistory.filter((row) => row.bookingId === booking!.id),
  );
  assert.equal(history.length, 1);
  assert.equal(history[0]?.newStatus, 'confirmed');

  const after = await listOffersForJob(jobId, CUSTOMER);
  const byId = new Map((after ?? []).map((entry) => [entry.offer.id, entry.offer.offerStatus]));
  assert.equal(byId.get(offerB), 'accepted');
  assert.equal(
    [...byId.entries()].some(([id, status]) => id !== offerB && status === 'withdrawn'),
    true,
    'the losing offer is withdrawn, not left pending',
  );

  const job = await query((db) => db.jobPosts.find((row) => row.id === jobId));
  assert.equal(job?.jobStatus, 'booked');

  const notifications = await query((db) => db.notifications);
  const acceptedNotice = notifications.find((row) => row.notificationType === 'offer_accepted');
  assert.ok(acceptedNotice, 'the provider is notified');
  assert.equal(acceptedNotice!.readAt, undefined, 'and it is unread');

  assert.equal(
    (await listAvailableJobs({ userId: CLEANER_A })).some((job) => job.id === jobId),
    false,
    'a booked job leaves discovery',
  );
});

test('a booked job refuses further edits, offers and acceptance', async () => {
  const edit = await updateJobPost(CUSTOMER, jobId, { budgetCentavos: 1000 });
  assert.equal(edit.ok === false && edit.error, 'already_booked');

  const secondAccept = await acceptOffer(offerB, CUSTOMER);
  assert.equal(secondAccept.ok === false && secondAccept.error, 'offer_not_pending');

  const late = await submitOffer({
    jobPostId: jobId,
    userId: CLEANER_A,
    servmateProfileId: (await providerProfileId(CLEANER_A))!,
    body: { amountCentavos: 100 },
  });
  assert.equal(late.ok === false && late.error, 'job_closed');
});

test('cancelling a job withdraws the offers on it', async () => {
  const created = await createJobPost(CUSTOMER, { ...jobFacts, title: 'Clean the garage' });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  await publishJobPost(CUSTOMER, created.job.id);
  const offer = await submitOffer({
    jobPostId: created.job.id,
    userId: CLEANER_A,
    servmateProfileId: (await providerProfileId(CLEANER_A))!,
    body: { amountCentavos: 50000 },
  });
  assert.equal(offer.ok, true);
  if (!offer.ok) return;

  const cancelled = await cancelJobPost(CUSTOMER, created.job.id);
  assert.equal(cancelled.ok, true);
  const closed = await query((db) => db.jobOffers.find((row) => row.id === offer.offer.id));
  assert.equal(closed?.offerStatus, 'withdrawn');

  const again = await cancelJobPost(CUSTOMER, created.job.id);
  assert.equal(again.ok === false && again.error, 'already_closed');
});

test('a declined offer leaves the job open for the others', async () => {
  const created = await createJobPost(CUSTOMER, { ...jobFacts, title: 'Clean the office' });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  await publishJobPost(CUSTOMER, created.job.id);

  const offer = await submitOffer({
    jobPostId: created.job.id,
    userId: CLEANER_A,
    servmateProfileId: (await providerProfileId(CLEANER_A))!,
    body: { amountCentavos: 90000 },
  });
  assert.equal(offer.ok, true);
  if (!offer.ok) return;

  const declined = await declineOffer(offer.offer.id, CUSTOMER);
  assert.equal(declined.ok, true);
  const job = await query((db) => db.jobPosts.find((row) => row.id === created.job.id));
  assert.equal(job?.jobStatus, 'open');

  const withdrawn = await withdrawOffer(offer.offer.id, (await providerProfileId(CLEANER_A))!);
  assert.equal(withdrawn.ok === false && withdrawn.error, 'not_pending');
});

/**
 * Writes bare account rows straight into the scratch store.
 *
 * Registration lives in `./auth`, which reads the session cookie through
 * `next/headers` and so cannot be imported outside a request. A test that only
 * needs an identity writes the row it would have produced.
 */
async function createAccounts(ids: string[]): Promise<void> {
  await transact((database) => {
    for (const id of ids) {
      database.users.push({
        id,
        name: id.replace(/^u-/, ''),
        email: `${id}@example.test`,
        username: id,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

/** Replaces a provider's live offer with a fresh one at a new price. */
async function reOffer(userId: string, amountCentavos: number): Promise<void> {
  const profileId = (await providerProfileId(userId))!;
  const existing = await query((db) =>
    db.jobOffers.find(
      (row) => row.jobPostId === jobId && row.servmateProfileId === profileId && row.offerStatus === 'pending',
    ),
  );
  if (existing) await withdrawOffer(existing.id, profileId);
  const result = await submitOffer({
    jobPostId: jobId,
    userId,
    servmateProfileId: profileId,
    body: { amountCentavos },
  });
  assert.equal(result.ok, true);
}

async function providerProfileId(userId: string): Promise<string | undefined> {
  return query((db) => db.servmateProfiles.find((row) => row.userId === userId)?.id);
}
