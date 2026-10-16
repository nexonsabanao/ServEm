import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * The booked-work state machine and the review it unlocks.
 *
 * A booking carved out of an accepted offer is the one object in the marketplace
 * both sides can move, so this file pins down who may move it, when, and what
 * each move leaves behind. It runs against a scratch store (see
 * `./jobs-offers.test.ts` for why), and the same journey is driven over live
 * HTTP by `./e2e-live.mjs`.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-lifecycle-'));
process.env.SERVEM_SEED = '0';

const { createJobPost, publishJobPost } = await import('../lib/jobs.ts');
const { submitOffer, acceptOffer } = await import('../lib/offers.ts');
const {
  confirmCompletion,
  getBookingForJob,
  listServmateBookings,
  requestCompletion,
  startBooking,
  cancelBooking,
} = await import('../lib/bookings.ts');
const { onboardServMate, setServmateCategories, setServmateCoverage } = await import(
  '../lib/servmate-profile.ts'
);
const { submitReview, reviewSummaryFor } = await import('../lib/reviews.ts');
const { query, transact } = await import('../lib/store.ts');

const CUSTOMER = 'u-lifecycle-customer';
const PROVIDER = 'u-lifecycle-provider';
const STRANGER = 'u-lifecycle-stranger';

let bookingId = '';

async function createAccounts(ids: string[]): Promise<void> {
  await transact((database) => {
    for (const id of ids) {
      // Idempotent: `bookedWork` is called by several tests against one store.
      if (database.users.some((user) => user.id === id)) continue;
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

/** Runs the whole journey up to a booking, so each test starts from `confirmed`. */
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
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error('setup failed');
  await publishJobPost(CUSTOMER, created.job.id);

  const offer = await submitOffer({
    jobPostId: created.job.id,
    userId: PROVIDER,
    servmateProfileId: profile.profileId,
    body: { amountCentavos: 140000, scopeDescription: 'Supplies included.' },
  });
  assert.equal(offer.ok, true);
  if (!offer.ok) throw new Error('setup failed');

  const accepted = await acceptOffer(offer.offer.id, CUSTOMER);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) throw new Error('setup failed');
  return accepted.bookingId;
}

test('only the booked ServMate may start the work', async () => {
  bookingId = await bookedWork();

  const byStranger = await startBooking(STRANGER, bookingId);
  assert.equal(byStranger.ok === false && byStranger.error, 'not_yours');

  const byCustomer = await startBooking(CUSTOMER, bookingId);
  assert.equal(byCustomer.ok === false && byCustomer.error, 'not_yours');

  const started = await startBooking(PROVIDER, bookingId);
  assert.equal(started.ok, true);
  if (started.ok) assert.equal(started.booking.status, 'in_progress');

  // The job post tells the same story as the booking.
  const booking = await query((database) =>
    database.bookings.find((row) => row.id === bookingId),
  );
  const job = await query((database) =>
    database.jobPosts.find((row) => row.id === booking!.jobPostId),
  );
  assert.equal(job?.jobStatus, 'in_progress');
  assert.equal(booking?.startedAt !== undefined, true);

  // And the customer is told.
  const notices = await query((database) => database.notifications);
  assert.equal(
    notices.some(
      (row) => row.recipientUserId === CUSTOMER && row.notificationType === 'booking_started',
    ),
    true,
  );

  const twice = await startBooking(PROVIDER, bookingId);
  assert.equal(twice.ok === false && twice.error, 'invalid_state');
});

test('finishing the work hands it back to the customer', async () => {
  const early = await confirmCompletion(CUSTOMER, bookingId);
  assert.equal(early.ok === false && early.error, 'invalid_state');

  const byCustomer = await requestCompletion(CUSTOMER, bookingId);
  assert.equal(byCustomer.ok === false && byCustomer.error, 'not_yours');

  const finished = await requestCompletion(PROVIDER, bookingId);
  assert.equal(finished.ok, true);
  if (finished.ok) assert.equal(finished.booking.status, 'completion_pending');

  const job = await query((database) =>
    database.jobPosts.find((row) =>
      database.bookings.some((booking) => booking.id === bookingId && booking.jobPostId === row.id),
    ),
  );
  assert.equal(job?.jobStatus, 'completion_pending');

  const again = await requestCompletion(PROVIDER, bookingId);
  assert.equal(again.ok === false && again.error, 'invalid_state');
});

test('the customer closes the work, and the job closes with it', async () => {
  const byProvider = await confirmCompletion(PROVIDER, bookingId);
  assert.equal(byProvider.ok === false && byProvider.error, 'not_yours');

  const confirmed = await confirmCompletion(CUSTOMER, bookingId);
  assert.equal(confirmed.ok, true);
  if (confirmed.ok) assert.equal(confirmed.booking.status, 'completed');

  const record = await query((database) => database.bookings.find((row) => row.id === bookingId));
  assert.equal(record?.completedAt !== undefined, true);

  const job = await query((database) => database.jobPosts.find((row) => row.id === record!.jobPostId));
  assert.equal(job?.jobStatus, 'completed');

  // Every move is on the record, with the user who made it.
  const history = await query((database) =>
    database.bookingStatusHistory.filter((row) => row.bookingId === bookingId),
  );
  assert.deepEqual(
    history.map((row) => row.newStatus),
    ['confirmed', 'in_progress', 'completion_pending', 'completed'],
  );
  assert.deepEqual(
    history.map((row) => row.actorUserId),
    [CUSTOMER, PROVIDER, PROVIDER, CUSTOMER],
  );

  const late = await startBooking(PROVIDER, bookingId);
  assert.equal(late.ok === false && late.error, 'invalid_state');
});

test('a completed booking is reviewable exactly once, by its customer', async () => {
  const byStranger = await submitReview({
    bookingId,
    reviewerUserId: STRANGER,
    rating: 5,
  });
  assert.equal(byStranger.ok === false && byStranger.error, 'not_found');

  const byProvider = await submitReview({
    bookingId,
    reviewerUserId: PROVIDER,
    rating: 5,
  });
  assert.equal(byProvider.ok === false && byProvider.error, 'not_found');

  const invalid = await submitReview({
    bookingId,
    reviewerUserId: CUSTOMER,
    rating: 9,
  });
  assert.equal(invalid.ok === false && invalid.error, 'invalid');

  const review = await submitReview({
    bookingId,
    reviewerUserId: CUSTOMER,
    rating: 5,
    comment: 'Careful with the balcony doors, and left the place spotless.',
  });
  assert.equal(review.ok, true);

  const twice = await submitReview({ bookingId, reviewerUserId: CUSTOMER, rating: 1 });
  assert.equal(twice.ok === false && twice.error, 'not_reviewable');

  const profileId = await query(
    (database) => database.bookings.find((row) => row.id === bookingId)!.servmateProfileId,
  );
  const summary = await query((database) => reviewSummaryFor(database, profileId!));
  assert.equal(summary.count, 1);
  assert.equal(summary.average, 5);

  // The ServMate hears about it.
  const notices = await query((database) => database.notifications);
  assert.equal(
    notices.some(
      (row) => row.recipientUserId === PROVIDER && row.notificationType === 'review_received',
    ),
    true,
  );
});

test('a booking cannot be reviewed before the work is finished', async () => {
  const fresh = await bookedWork();
  const early = await submitReview({ bookingId: fresh, reviewerUserId: CUSTOMER, rating: 5 });
  assert.equal(early.ok === false && early.error, 'not_reviewable');
});

test('withdrawing a booked job closes the booking and the job', async () => {
  const fresh = await bookedWork();
  const cancelled = await cancelBooking(CUSTOMER, fresh);
  assert.equal(cancelled.ok, true);
  if (cancelled.ok) assert.equal(cancelled.booking.status, 'cancelled');

  const job = await query((database) =>
    database.jobPosts.find((row) => database.bookings.some((b) => b.id === fresh && b.jobPostId === row.id)),
  );
  assert.equal(job?.jobStatus, 'cancelled');
  assert.equal(job?.closedAt !== undefined, true);

  const again = await cancelBooking(CUSTOMER, fresh);
  assert.equal(again.ok === false && again.error, 'already_cancelled');

  const stranger = await cancelBooking(STRANGER, fresh);
  assert.equal(stranger.ok === false && stranger.error, 'not_found');
});

test('a booking may be withdrawn while it is live, never once it is finished', async () => {
  // Still live: an accepted booking sits in `confirmed`, which the table keeps
  // cancellable — the customer has not yet lost the choice to change their mind.
  const live = await bookedWork();
  const withdrawn = await cancelBooking(CUSTOMER, live);
  assert.equal(withdrawn.ok, true);

  // A second booking, driven all the way to the end by both parties.
  const finished = await bookedWork();
  const started = await startBooking(PROVIDER, finished);
  assert.equal(started.ok, true);
  const reported = await requestCompletion(PROVIDER, finished);
  assert.equal(reported.ok, true);
  const confirmed = await confirmCompletion(CUSTOMER, finished);
  assert.equal(confirmed.ok, true);

  const refused = await cancelBooking(CUSTOMER, finished);
  assert.equal(refused.ok === false && refused.error, 'invalid_state');

  // Nothing moved: the booking and its job still say the work happened.
  const booking = await query((database) =>
    database.bookings.find((row) => row.id === finished),
  );
  assert.equal(booking?.status, 'completed');

  const job = await query((database) =>
    database.jobPosts.find((row) => database.bookings.some((b) => b.id === finished && b.jobPostId === row.id)),
  );
  assert.equal(job?.jobStatus, 'completed');

  // And the ServMate is never told that finished work was withdrawn.
  const notices = await query((database) => database.notifications);
  assert.equal(
    notices.some(
      (row) => row.entityId === finished && row.notificationType === 'booking_cancelled',
    ),
    false,
  );
});

test('the provider sees only its own booked work', async () => {
  const mine = await listServmateBookings(PROVIDER);
  assert.equal(mine.length >= 1, true);

  const owned = await query((database) => {
    const profile = database.servmateProfiles.find((row) => row.userId === PROVIDER);
    return new Set(
      database.bookings.filter((row) => row.servmateProfileId === profile!.id).map((row) => row.id),
    );
  });
  assert.equal(
    mine.every((booking) => owned.has(booking.id)),
    true,
    'the provider list holds no booking it does not own',
  );

  const customerView = await getBookingForJob(CUSTOMER, 'no-such-job');
  assert.equal(customerView, null);

  const strangerView = await listServmateBookings(STRANGER);
  assert.equal(strangerView.length, 0);
});
