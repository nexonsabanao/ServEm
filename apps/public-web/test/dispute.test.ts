import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Disputes: the state that stops the machine instead of advancing it.
 *
 * The flow documents put the same requirement in two places — a completion must
 * not bypass a dispute hold, and a disputed booking must not be reviewable — so
 * most of these tests are refusals. They run against a scratch store like the
 * rest of the suite, and the same journey is driven over live HTTP by
 * `./e2e-live.mjs`.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-dispute-'));
process.env.SERVEM_SEED = '0';

const { createJobPost, publishJobPost } = await import('../lib/jobs.ts');
const { submitOffer, acceptOffer } = await import('../lib/offers.ts');
const {
  confirmCompletion,
  openDispute,
  requestCompletion,
  resolveDispute,
  startBooking,
} = await import('../lib/bookings.ts');
const { onboardServMate, setServmateCategories, setServmateCoverage } = await import(
  '../lib/servmate-profile.ts'
);
const { submitReview } = await import('../lib/reviews.ts');
const { query, transact } = await import('../lib/store.ts');

const CUSTOMER = 'u-dispute-customer';
const PROVIDER = 'u-dispute-provider';
const STRANGER = 'u-dispute-stranger';

async function createAccounts(ids: string[]): Promise<void> {
  await transact((database) => {
    for (const id of ids) {
      if (database.users.some((user) => user.id === id)) continue;
      database.users.push({
        id,
        name: id.replace(/^u-dispute-/, ''),
        email: `${id}@example.test`,
        username: id,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

/** The whole journey up to a booking, so a test can start from `confirmed`. */
async function bookedWork(): Promise<string> {
  await createAccounts([CUSTOMER, PROVIDER, STRANGER]);
  const profile = await onboardServMate(PROVIDER);
  await setServmateCategories(profile.profileId, ['cleaning']);
  await setServmateCoverage(profile.profileId, ['Bacoor']);

  const created = await createJobPost(CUSTOMER, {
    title: 'Deep clean before the tenants arrive',
    description: 'Two bedrooms, kitchen, and the balcony.',
    categoryId: 'cleaning',
    pricingModel: 'fixed',
    budgetCentavos: 150000,
    locationCity: 'Bacoor',
    scheduleFlexible: true,
  });
  if (!created.ok) throw new Error('setup failed');
  await publishJobPost(CUSTOMER, created.job.id);

  const offer = await submitOffer({
    jobPostId: created.job.id,
    userId: PROVIDER,
    servmateProfileId: profile.profileId,
    body: { amountCentavos: 140000, scopeDescription: 'Supplies included.' },
  });
  if (!offer.ok) throw new Error('setup failed');

  const accepted = await acceptOffer(offer.offer.id, CUSTOMER);
  if (!accepted.ok) throw new Error('setup failed');
  return accepted.bookingId;
}

test('only the customer may report a problem, and only under way', async () => {
  const bookingId = await bookedWork();

  const byStranger = await openDispute(STRANGER, bookingId, 'Nothing was done.');
  assert.equal(byStranger.ok === false && byStranger.error, 'not_yours');

  const byProvider = await openDispute(PROVIDER, bookingId, 'Nothing was done.');
  assert.equal(byProvider.ok === false && byProvider.error, 'not_yours');

  const tooEarly = await openDispute(CUSTOMER, bookingId, 'Nothing was done.');
  assert.equal(tooEarly.ok === false && tooEarly.error, 'invalid_state');

  await startBooking(PROVIDER, bookingId);
  const opened = await openDispute(CUSTOMER, bookingId, 'Two rooms were left unfinished.');
  assert.equal(opened.ok, true);
  if (opened.ok) assert.equal(opened.booking.status, 'disputed');
});

test('while a dispute stands, nothing else may move the booking', async () => {
  const bookingId = await bookedWork();
  await startBooking(PROVIDER, bookingId);
  await openDispute(CUSTOMER, bookingId, 'The balcony was not touched.');

  // The ServMate cannot re-report completion…
  const completion = await requestCompletion(PROVIDER, bookingId);
  assert.equal(completion.ok === false && completion.error, 'invalid_state');

  // …the customer cannot confirm it…
  const confirmed = await confirmCompletion(CUSTOMER, bookingId);
  assert.equal(confirmed.ok === false && confirmed.error, 'invalid_state');

  // …and neither can they review work that is still in dispute.
  const review = await submitReview({ bookingId, reviewerUserId: CUSTOMER, rating: 5 });
  assert.equal(review.ok, false);

  // A stranger still cannot open or close one either way.
  const strangerOpen = await openDispute(STRANGER, bookingId, 'Noise complaint.');
  assert.equal(strangerOpen.ok === false && strangerOpen.error, 'not_yours');
  const strangerResolve = await resolveDispute(STRANGER, bookingId, 'withdraw');
  assert.equal(strangerResolve.ok === false && strangerResolve.error, 'not_yours');
});

test('a dispute tells the other party and leaves the job where it was', async () => {
  const bookingId = await bookedWork();
  await startBooking(PROVIDER, bookingId);
  await openDispute(CUSTOMER, bookingId, 'The kitchen was skipped.');

  const notices = await query((database) => database.notifications);
  assert.equal(
    notices.some(
      (row) => row.recipientUserId === PROVIDER && row.notificationType === 'booking_disputed',
    ),
    true,
    'the ServMate is told',
  );

  const booking = await query((database) => database.bookings.find((row) => row.id === bookingId));
  assert.ok(booking);
  const job = await query((database) => database.jobPosts.find((row) => row.id === booking.jobPostId));
  assert.equal(job?.jobStatus, 'in_progress', 'the job does not change state under a dispute');

  const history = await query((database) =>
    database.bookingStatusHistory.filter((row) => row.bookingId === bookingId),
  );
  assert.equal(
    history.some((row) => row.newStatus === 'disputed' && Boolean(row.reason)),
    true,
    'the move records why it happened',
  );
});

test('withdrawing puts the booking back where it was, and it can then close', async () => {
  const bookingId = await bookedWork();
  await startBooking(PROVIDER, bookingId);
  await requestCompletion(PROVIDER, bookingId);
  await openDispute(CUSTOMER, bookingId, 'Wrong time booked by mistake.');

  const withdrawn = await resolveDispute(CUSTOMER, bookingId, 'withdraw');
  assert.equal(withdrawn.ok, true);
  if (withdrawn.ok) assert.equal(withdrawn.booking.status, 'completion_pending');

  const confirmed = await confirmCompletion(CUSTOMER, bookingId);
  assert.equal(confirmed.ok, true);

  const review = await submitReview({ bookingId, reviewerUserId: CUSTOMER, rating: 4 });
  assert.equal(review.ok, true, 'a resolved booking can be reviewed afterwards');
});

test('the customer can end the booking instead of taking the complaint back', async () => {
  const bookingId = await bookedWork();
  await startBooking(PROVIDER, bookingId);
  await openDispute(CUSTOMER, bookingId, 'Work was never started on site.');

  const cancelled = await resolveDispute(CUSTOMER, bookingId, 'cancel');
  assert.equal(cancelled.ok, true);
  if (cancelled.ok) assert.equal(cancelled.booking.status, 'cancelled');

  const booking = await query((database) => database.bookings.find((row) => row.id === bookingId));
  assert.ok(booking?.cancelledAt, 'the cancellation is dated');

  const job = await query((database) => database.jobPosts.find((row) => row.id === booking.jobPostId));
  assert.equal(job?.jobStatus, 'cancelled');
  assert.ok(job?.closedAt, 'the job is closed rather than left booked');

  const review = await submitReview({ bookingId, reviewerUserId: CUSTOMER, rating: 1 });
  assert.equal(review.ok, false, 'cancelled work is never reviewable');

  // And it stays closed: there is nothing left to resolve.
  const again = await resolveDispute(CUSTOMER, bookingId, 'withdraw');
  assert.equal(again.ok === false && again.error, 'invalid_state');
});

test('both parties still see the booking while it is disputed', async () => {
  const bookingId = await bookedWork();
  await startBooking(PROVIDER, bookingId);
  await openDispute(CUSTOMER, bookingId, 'Damage to the door frame.');

  const forCustomer = await query(
    (database) => database.bookings.find((row) => row.id === bookingId)?.status,
  );
  assert.equal(forCustomer, 'disputed');

  const { listServmateBookings } = await import('../lib/bookings.ts');
  const queue = await listServmateBookings(PROVIDER);
  const mine = queue.find((row) => row.id === bookingId);
  assert.ok(mine, 'the booking stays in the ServMate queue');
  assert.equal(mine.status, 'disputed');

  const notices = await query((database) => database.notifications);
  assert.equal(
    notices.some((row) => row.recipientUserId === CUSTOMER && row.entityId === bookingId),
    true,
    'the customer is party to it too',
  );
});
