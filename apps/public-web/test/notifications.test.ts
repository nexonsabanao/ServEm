import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Notifications: addressed to a recipient, never broadcast.
 *
 * Blueprint §16 names the case that matters: *notifications do not disclose jobs
 * to unrelated providers*. The rule is structural rather than defensive — a
 * record carries its recipient — so these tests check both the copy a person
 * reads and the feed an unrelated account cannot see.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-notify-'));
process.env.SERVEM_SEED = '0';

const { createJobPost, publishJobPost } = await import('../lib/jobs.ts');
const { submitOffer, acceptOffer } = await import('../lib/offers.ts');
const { confirmCompletion, requestCompletion, startBooking } = await import('../lib/bookings.ts');
const { submitReview } = await import('../lib/reviews.ts');
const { onboardServMate, setServmateCategories, setServmateCoverage } = await import(
  '../lib/servmate-profile.ts'
);
const { countUnread, listNotifications, markNotificationsRead } = await import(
  '../lib/notifications.ts'
);
const { transact } = await import('../lib/store.ts');

const CUSTOMER = 'u-notify-customer';
const PROVIDER = 'u-notify-provider';
const STRANGER = 'u-notify-stranger';

let jobId = '';
let bookingId = '';

async function createAccounts(ids: string[]): Promise<void> {
  await transact((database) => {
    for (const id of ids) {
      if (database.users.some((user) => user.id === id)) continue;
      database.users.push({
        id,
        name: id.replace(/^u-notify-/, '').replace(/^\w/, (c) => c.toUpperCase()),
        email: `${id}@example.test`,
        username: id,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

test('a new account has nothing in its feed', async () => {
  await createAccounts([CUSTOMER, PROVIDER, STRANGER]);

  const customer = await listNotifications(CUSTOMER);
  assert.deepEqual(customer.items, []);
  assert.equal(customer.unreadCount, 0);
});

test('an offer notifies the customer and nobody else', async () => {
  const created = await createJobPost(CUSTOMER, {
    title: 'Deep clean a two-storey home',
    description: 'Kitchen, bathrooms and living room.',
    categoryId: 'cleaning',
    pricingModel: 'fixed',
    budgetCentavos: 200000,
    locationCity: 'Bacoor',
    scheduleFlexible: true,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  jobId = created.job.id;
  await publishJobPost(CUSTOMER, jobId);

  const profile = await onboardServMate(PROVIDER);
  await setServmateCategories(profile.profileId!, ['cleaning']);
  await setServmateCoverage(profile.profileId!, ['Bacoor']);

  const offer = await submitOffer({
    jobPostId: jobId,
    userId: PROVIDER,
    servmateProfileId: profile.profileId!,
    body: { amountCentavos: 185000, scopeDescription: 'Supplies included.' },
  });
  assert.equal(offer.ok, true);
  if (!offer.ok) return;

  const customer = await listNotifications(CUSTOMER);
  assert.equal(customer.unreadCount, 1);
  assert.equal(customer.items[0]?.type, 'offer_received');
  // The copy names the price, so the customer can act without opening the job.
  assert.match(customer.items[0]?.title ?? '', /₱1,850/);
  assert.equal(customer.items[0]?.href, `/account/jobs/${jobId}`);

  // The provider hears nothing yet, and the stranger hears nothing ever.
  assert.equal((await countUnread(PROVIDER)), 0);
  assert.deepEqual((await listNotifications(STRANGER)).items, []);

  const booked = await acceptOffer(offer.offer.id, CUSTOMER);
  assert.equal(booked.ok, true);
  if (!booked.ok) return;
  bookingId = booked.bookingId;
});

test('accepting an offer tells the ServMate where to go', async () => {
  const provider = await listNotifications(PROVIDER);
  assert.equal(provider.unreadCount, 1);
  assert.equal(provider.items[0]?.type, 'offer_accepted');
  assert.equal(provider.items[0]?.href, `/servmate/jobs/${jobId}`);

  // The customer's own acceptance does not notify them of their own action.
  assert.ok(!(await listNotifications(CUSTOMER)).items.some((item) => item.type === 'offer_accepted'));
  assert.deepEqual((await listNotifications(STRANGER)).items, []);
});

test('every booking move notifies the other side only', async () => {
  const started = await startBooking(PROVIDER, bookingId);
  assert.equal(started.ok, true);
  let customer = await listNotifications(CUSTOMER);
  assert.ok(customer.items.some((item) => item.type === 'booking_started'));

  const finished = await requestCompletion(PROVIDER, bookingId);
  assert.equal(finished.ok, true);
  customer = await listNotifications(CUSTOMER);
  const asking = customer.items.find((item) => item.type === 'completion_requested');
  assert.ok(asking);
  assert.match(asking.detail ?? '', /Confirm/);

  const confirmed = await confirmCompletion(CUSTOMER, bookingId);
  assert.equal(confirmed.ok, true);
  const provider = await listNotifications(PROVIDER);
  assert.ok(provider.items.some((item) => item.type === 'booking_confirmed'));
  assert.deepEqual((await listNotifications(STRANGER)).items, []);
});

test('a review notifies the ServMate and links to their profile', async () => {
  const review = await submitReview({
    bookingId,
    reviewerUserId: CUSTOMER,
    rating: 5,
    comment: 'Left the place spotless.',
  });
  assert.equal(review.ok, true);

  const provider = await listNotifications(PROVIDER);
  const received = provider.items.find((item) => item.type === 'review_received');
  assert.ok(received);
  assert.ok(received.href.startsWith('/providers/'));

  // Still nothing for an account that was never party to any of it.
  assert.deepEqual((await listNotifications(STRANGER)).items, []);
});

test('the feed is newest first', async () => {
  const customer = await listNotifications(CUSTOMER);
  const times = customer.items.map((item) => item.createdAt);
  assert.deepEqual(times, [...times].sort((a, b) => b.localeCompare(a)));
  assert.ok(customer.items.length >= 3);
});

test('one notification can be marked read, and read state is per account', async () => {
  const before = await listNotifications(CUSTOMER);
  const first = before.items[0]!;
  assert.equal(first.readAt, undefined);

  const marked = await markNotificationsRead(CUSTOMER, first.id);
  assert.equal(marked.ok, true);
  if (!marked.ok) return;
  assert.equal(marked.unreadCount, before.unreadCount - 1);

  const after = await listNotifications(CUSTOMER);
  assert.ok(after.items.find((item) => item.id === first.id)?.readAt);
  assert.equal(after.unreadCount, before.unreadCount - 1);

  // The same id in another account's call is indistinguishable from absent.
  const stolen = await markNotificationsRead(PROVIDER, first.id);
  assert.equal(stolen.ok, false);
  if (stolen.ok) return;
  assert.equal(stolen.error, 'not_found');
  // And it changed nothing.
  assert.equal((await listNotifications(CUSTOMER)).unreadCount, before.unreadCount - 1);
});

test('marking everything read is idempotent', async () => {
  const first = await markNotificationsRead(CUSTOMER);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.unreadCount, 0);

  const second = await markNotificationsRead(CUSTOMER);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.unreadCount, 0);

  // Marking read is not a delete: the history is still readable.
  assert.ok((await listNotifications(CUSTOMER)).items.length > 0);
});
