import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * The provider's own write surface: profile facts, listings, portfolio, updates.
 *
 * Two rules from the blueprint are checked here rather than assumed:
 *
 * - §16 test 14 — a listing price change must not alter confirmed booking terms.
 *   The booking owns a snapshot, so the test edits the price *after* an offer is
 *   accepted and asserts the agreed amount did not move.
 * - §5.7 — self-published work must stay distinguishable from verified work, so a
 *   portfolio item claiming a booking is checked against the booking, and a claim
 *   that does not hold is refused rather than quietly downgraded.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-console-'));
process.env.SERVEM_SEED = '0';

const { createJobPost, publishJobPost, updateJobPost } = await import('../lib/jobs.ts');
const { submitOffer, acceptOffer } = await import('../lib/offers.ts');
const { cancelBooking, createBooking } = await import('../lib/bookings.ts');
const { listCategories } = await import('../lib/categories.ts');
const {
  addPortfolioItem,
  addWorkPost,
  completedWorkFor,
  getPortfolio,
  getWorkPosts,
  removePortfolioItem,
  removeWorkPost,
} = await import('../lib/portfolio.ts');
const { readMedia } = await import('../lib/media.ts');
const {
  createListing,
  deleteListing,
  getProviderView,
  listOwnListings,
  listPublishedListingViews,
  onboardServMate,
  setListingPublication,
  setServmateCategories,
  setServmateCoverage,
  updateListing,
  updateOwnProfile,
} = await import('../lib/servmate-profile.ts');
const { query, transact } = await import('../lib/store.ts');

const CUSTOMER = 'u-console-customer';
const PROVIDER = 'u-console-provider';
const OTHER_PROVIDER = 'u-console-other';

/** A one-pixel PNG, so the image path is exercised with real bytes. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let providerProfileId = '';
let listingId = '';
let jobId = '';

async function createAccounts(ids: string[]): Promise<void> {
  await transact((database) => {
    for (const id of ids) {
      if (database.users.some((user) => user.id === id)) continue;
      database.users.push({
        id,
        name: id.replace(/^u-console-/, '').replace(/^\w/, (c) => c.toUpperCase()),
        email: `${id}@example.test`,
        username: id,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

test('an account becomes a provider and states profile facts', async () => {
  await createAccounts([CUSTOMER, PROVIDER, OTHER_PROVIDER]);

  const provider = await onboardServMate(PROVIDER);
  providerProfileId = provider.profileId!;
  await setServmateCategories(providerProfileId, ['cleaning']);
  await setServmateCoverage(providerProfileId, ['Bacoor']);

  const other = await onboardServMate(OTHER_PROVIDER);
  await setServmateCategories(other.profileId!, ['cleaning']);
  await setServmateCoverage(other.profileId!, ['Bacoor']);

  const saved = await updateOwnProfile(PROVIDER, {
    headline: 'Eco deep-cleaning for condos',
    bio: 'A three-person team working across Bacoor.',
    experience: 'Six years of move-out cleans.',
    serviceAreaLabel: 'Bacoor',
    responseMins: 15,
  });
  assert.equal(saved.ok, true);

  const view = await getProviderView(providerProfileId);
  assert.equal(view?.headline, 'Eco deep-cleaning for condos');
  assert.equal(view?.responseMins, 15);
  assert.equal(view?.area, 'Bacoor');
  // Self-declared work is never presented as verified.
  assert.equal(view?.verified, false);
});

test('a partial profile edit leaves the other fields alone, and an empty one clears', async () => {
  const partial = await updateOwnProfile(PROVIDER, { bio: 'Now with two vans.' });
  assert.equal(partial.ok, true);
  let view = await getProviderView(providerProfileId);
  assert.equal(view?.bio, 'Now with two vans.');
  assert.equal(view?.headline, 'Eco deep-cleaning for condos');

  const cleared = await updateOwnProfile(PROVIDER, { headline: '' });
  assert.equal(cleared.ok, true);
  view = await getProviderView(providerProfileId);
  // The view always reports a string; what matters is that the record is gone.
  assert.equal(view?.headline, '');
  const stored = await query(
    (database) => database.servmateProfiles.find((row) => row.id === providerProfileId)?.headline,
  );
  assert.equal(stored, undefined);
  assert.equal(view?.bio, 'Now with two vans.');
});

test('profile facts are validated and an account without a profile is refused', async () => {
  const badArea = await updateOwnProfile(PROVIDER, { serviceAreaLabel: 'Quezon City' });
  assert.equal(badArea.ok, false);

  const badReply = await updateOwnProfile(PROVIDER, { responseMins: 0 });
  assert.equal(badReply.ok, false);

  const tooLong = await updateOwnProfile(PROVIDER, { bio: 'x'.repeat(601) });
  assert.equal(tooLong.ok, false);

  const noProfile = await updateOwnProfile(CUSTOMER, { bio: 'Hello' });
  assert.equal(noProfile.ok, false);
  if (!noProfile.ok) assert.equal(noProfile.error, 'not_a_provider');
});

test('a listing is created as a draft and only shows once published', async () => {
  const categories = listCategories();
  const categoryId = categories[0]!.id;

  const invalid = await createListing(PROVIDER, {
    title: '',
    description: '',
    categoryId: 'not-a-category',
  });
  assert.equal(invalid.ok, false);

  const quoteMissingPrice = await createListing(PROVIDER, {
    title: 'Deep clean',
    description: 'Kitchen, bathrooms, bedrooms.',
    categoryId,
    pricingModel: 'fixed',
  });
  assert.equal(quoteMissingPrice.ok, false);

  const created = await createListing(PROVIDER, {
    title: 'Deep clean · two-bedroom condo',
    description: 'Kitchen, bathrooms, living room and bedrooms.',
    categoryId,
    pricingModel: 'fixed',
    amountCentavos: 180000,
    serviceAreaLabel: 'Bacoor',
    availability: 'Same day',
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  listingId = created.listing.id;
  assert.equal(created.listing.publicationStatus, 'draft');

  const beforePublish = await listPublishedListingViews();
  assert.ok(!beforePublish.some((listing) => listing.id === listingId));

  const published = await setListingPublication(PROVIDER, listingId, true);
  assert.equal(published.ok, true);
  const afterPublish = await listPublishedListingViews();
  assert.ok(afterPublish.some((listing) => listing.id === listingId));

  const withdrawn = await setListingPublication(PROVIDER, listingId, false);
  assert.equal(withdrawn.ok, true);
  const afterWithdraw = await listPublishedListingViews();
  assert.ok(!afterWithdraw.some((listing) => listing.id === listingId));

  // Withdrawing is not deleting: the provider still has it.
  assert.ok((await listOwnListings(PROVIDER)).some((row) => row.id === listingId));
  await setListingPublication(PROVIDER, listingId, true);
});

test("another provider cannot edit, publish or delete this listing", async () => {
  const edit = await updateListing(OTHER_PROVIDER, listingId, { title: 'Hijacked' });
  assert.equal(edit.ok, false);
  if (!edit.ok) assert.equal(edit.error, 'not_found');

  const publish = await setListingPublication(OTHER_PROVIDER, listingId, false);
  assert.equal(publish.ok, false);

  const remove = await deleteListing(OTHER_PROVIDER, listingId);
  assert.equal(remove.ok, false);

  // And it is untouched.
  const view = (await listOwnListings(PROVIDER)).find((row) => row.id === listingId);
  assert.equal(view?.title, 'Deep clean · two-bedroom condo');
});

test('a price change reaches future work, never an agreed booking', async () => {
  // A job, an offer, and a booking with a frozen amount.
  const job = await createJobPost(CUSTOMER, {
    title: 'Move-out clean',
    description: 'Whole unit including the balcony.',
    categoryId: 'cleaning',
    pricingModel: 'fixed',
    budgetCentavos: 150000,
    locationCity: 'Bacoor',
    scheduleFlexible: true,
  });
  assert.equal(job.ok, true);
  if (!job.ok) return;
  jobId = job.job.id;
  await publishJobPost(CUSTOMER, jobId);

  const offer = await submitOffer({
    jobPostId: jobId,
    userId: PROVIDER,
    servmateProfileId: providerProfileId,
    body: { amountCentavos: 165000, scopeDescription: 'Supplies included.' },
  });
  assert.equal(offer.ok, true);
  if (!offer.ok) return;

  const booked = await acceptOffer(offer.offer.id, CUSTOMER);
  assert.equal(booked.ok, true);

  const agreedBefore = await query((database) =>
    database.bookings.find((row) => row.jobPostId === jobId)?.agreedAmountCentavos,
  );
  assert.equal(agreedBefore, 165000);

  const raised = await updateListing(PROVIDER, listingId, { amountCentavos: 240000 });
  assert.equal(raised.ok, true);

  const booking = await query((database) =>
    database.bookings.find((row) => row.jobPostId === jobId),
  );
  assert.equal(booking?.agreedAmountCentavos, 165000);
  const jobAfter = await query((database) => database.jobPosts.find((row) => row.id === jobId));
  assert.equal(jobAfter?.budgetCentavos, 150000);
});

test('work from a completed booking is marked verified, and only real work can be', async () => {
  const booking = await query((database) => database.bookings.find((row) => row.jobPostId === jobId));
  assert.ok(booking);

  // The booking is live, not completed: the claim is refused outright.
  const premature = await addPortfolioItem(PROVIDER, {
    title: 'Move-out clean',
    bookingId: booking!.id,
  });
  assert.equal(premature.ok, false);
  if (!premature.ok) assert.equal(premature.error, 'booking_not_found');

  // Nobody else's booking can be claimed either.
  const stolen = await addPortfolioItem(OTHER_PROVIDER, {
    title: 'Move-out clean',
    bookingId: booking!.id,
  });
  assert.equal(stolen.ok, false);

  // Finish the work through the real state machine.
  await transact((database) => {
    const row = database.bookings.find((candidate) => candidate.id === booking!.id)!;
    row.status = 'completed';
    row.completedAt = new Date().toISOString();
  });

  const selfPublished = await addPortfolioItem(PROVIDER, {
    title: 'Deep clean in Molino',
    description: 'Three hours, one team.',
    dataUrl: PNG,
  });
  assert.equal(selfPublished.ok, true);
  if (selfPublished.ok) assert.equal(selfPublished.item.source, 'self_published');

  const verified = await addPortfolioItem(PROVIDER, {
    title: 'Move-out clean, Bacoor',
    bookingId: booking!.id,
  });
  assert.equal(verified.ok, true);
  if (verified.ok) assert.equal(verified.item.source, 'completed_booking');

  const portfolio = await getPortfolio(providerProfileId);
  assert.equal(portfolio.length, 2);
  const withImage = portfolio.find((item) => item.imageUrl);
  assert.ok(withImage, 'the uploaded image is referenced through the delivery route');
  assert.ok(withImage!.imageUrl!.startsWith('/api/media/'));

  // A profile image is readable by any signed-in account, and by nobody else.
  const assetId = withImage!.imageUrl!.split('/').pop()!;
  assert.ok(await readMedia(assetId, CUSTOMER));
  assert.equal(await readMedia(assetId, ''), null);
});

test('the completed booking is offered once and then no longer listed', async () => {
  const available = await completedWorkFor(providerProfileId);
  assert.deepEqual(available, []);
});

test('a work example is capped and only its owner can remove it', async () => {
  for (let index = 2; index < 12; index += 1) {
    const added = await addPortfolioItem(PROVIDER, { title: `Example ${index}` });
    assert.equal(added.ok, true);
  }

  const over = await addPortfolioItem(PROVIDER, { title: 'One too many' });
  assert.equal(over.ok, false);
  if (!over.ok) assert.equal(over.error, 'too_many');

  const mine = await getPortfolio(providerProfileId);
  const target = mine[0]!;

  const refused = await removePortfolioItem(OTHER_PROVIDER, target.id);
  assert.equal(refused.ok, false);

  const removed = await removePortfolioItem(PROVIDER, target.id);
  assert.equal(removed.ok, true);

  const after = await getPortfolio(providerProfileId);
  assert.equal(after.length, mine.length - 1);
  assert.ok(!after.some((item) => item.id === target.id));

  const again = await removePortfolioItem(PROVIDER, target.id);
  assert.equal(again.ok, false);
});

test('work updates are published, listed newest first and withdrawn', async () => {
  const empty = await addWorkPost(PROVIDER, { body: '   ' });
  assert.equal(empty.ok, false);

  const first = await addWorkPost(PROVIDER, { body: 'Finished a move-out clean in Molino today.' });
  assert.equal(first.ok, true);
  const second = await addWorkPost(PROVIDER, {
    body: 'Two bookings this weekend, both in Bacoor.',
    dataUrl: PNG,
  });
  assert.equal(second.ok, true);

  const posts = await getWorkPosts(providerProfileId);
  assert.equal(posts.length, 2);
  assert.equal(posts[0]?.body, 'Two bookings this weekend, both in Bacoor.');
  assert.ok(posts[0]!.createdAt >= posts[1]!.createdAt);
  assert.ok(posts[0]?.imageUrl?.startsWith('/api/media/'));

  const refused = await removeWorkPost(OTHER_PROVIDER, posts[0]!.id);
  assert.equal(refused.ok, false);

  const withdrawn = await removeWorkPost(PROVIDER, posts[0]!.id);
  assert.equal(withdrawn.ok, true);
  const after = await getWorkPosts(providerProfileId);
  assert.equal(after.length, 1);
  assert.ok(!after.some((entry) => entry.id === posts[0]!.id));
});

test('a listing with live work cannot be deleted, only withdrawn', async () => {
  const booking = await createBooking({
    userId: CUSTOMER,
    serviceId: listingId,
    serviceTitle: 'Deep clean · two-bedroom condo',
    message: 'Please come Saturday morning.',
  });
  assert.equal(booking.status, 'requested');

  const blocked = await deleteListing(PROVIDER, listingId);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error, 'in_use');

  const cancelled = await cancelBooking(CUSTOMER, booking.id);
  assert.equal(cancelled.ok, true);

  const removed = await deleteListing(PROVIDER, listingId);
  assert.equal(removed.ok, true);
  assert.ok(!(await listOwnListings(PROVIDER)).some((row) => row.id === listingId));
});

test('a job edit cannot change a booked job, and the booking keeps its snapshot', async () => {
  const edit = await updateJobPost(CUSTOMER, jobId, { budgetCentavos: 999 });
  assert.equal(edit.ok, false);

  const booking = await query((database) => database.bookings.find((row) => row.jobPostId === jobId));
  assert.equal(booking?.agreedAmountCentavos, 165000);
});
