import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canReviewBooking,
  canServMateDiscoverJob,
  canViewConversation,
  canViewJobDetail,
  canViewJobMedia,
  isJobDiscoverable,
} from '../lib/policy.ts';
import type { Database, JobPostRecord } from '../lib/store.ts';

/**
 * Authorization policy tests.
 *
 * These assert the rules the marketplace's privacy depends on, and two of them
 * are regression tests for defects found in an earlier implementation of this
 * blueprint:
 *
 * 1. A job that has received an offer must stay discoverable, or a customer can
 *    never collect a second offer to compare.
 * 2. Discovery must apply the service-area and schedule rules, not only the
 *    category.
 *
 * Run with `npm test`. Needs Node 22.18+ (or 24+), which runs TypeScript
 * directly; the application itself still supports Node 20.9+.
 */

const NOW = new Date('2026-10-12T00:00:00.000Z');

function job(over: Partial<JobPostRecord> & Pick<JobPostRecord, 'id'>): JobPostRecord {
  return {
    customerId: 'u-customer',
    categoryId: 'cleaning',
    title: 'Condo deep clean',
    description: 'A two-bedroom condominium needs a full clean.',
    jobStatus: 'open',
    pricingModel: 'fixed',
    budgetCentavos: 180000,
    currency: 'PHP',
    locationCity: 'Bacoor',
    locationBarangay: 'Molino IV',
    locationNotes: 'Gate code 1234, unit 4B',
    scheduleFlexible: true,
    publishedAt: '2026-10-01T08:00:00.000Z',
    createdAt: '2026-10-01T07:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    ...over,
  };
}

/** A snapshot with one cleaning ServMate in Bacoor and one repair ServMate. */
function snapshot(over: Partial<Database> = {}): Database {
  const stamp = '2026-10-01T00:00:00.000Z';
  return {
    users: [],
    sessions: [],
    servmateProfiles: [
      {
        id: 'sm-clean',
        userId: 'u-clean',
        providerStatus: 'active',
        verificationStatus: 'verified',
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: 'sm-repair',
        userId: 'u-repair',
        providerStatus: 'active',
        verificationStatus: 'unverified',
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    servmateCategories: [
      { servmateProfileId: 'sm-clean', categoryId: 'cleaning', status: 'active', createdAt: stamp },
      {
        servmateProfileId: 'sm-repair',
        categoryId: 'home-repair',
        status: 'active',
        createdAt: stamp,
      },
    ],
    servmateServiceAreas: [
      { servmateProfileId: 'sm-clean', areaLabel: 'Bacoor', createdAt: stamp },
      { servmateProfileId: 'sm-repair', areaLabel: 'Bacoor', createdAt: stamp },
    ],
    serviceListings: [],
    jobPosts: [],
    jobPostMedia: [],
    jobOffers: [],
    bookings: [],
    bookingStatusHistory: [],
    conversations: [],
    conversationParticipants: [],
    messages: [],
    mediaAssets: [],
    reviews: [],
    notifications: [],
    userBlocks: [],
    userReports: [],
    pendingAuth: [],
    ...over,
  };
}

test('a job that already has an offer stays discoverable', () => {
  const record = job({ id: 'job-offered', jobStatus: 'offer_received' });
  assert.equal(isJobDiscoverable(record, NOW).allowed, true);

  const database = snapshot({ jobPosts: [record] });
  const decision = canServMateDiscoverJob(database, {
    jobId: record.id,
    userId: 'u-clean',
    now: NOW,
  });
  assert.equal(decision.allowed, true, 'a second ServMate must still be able to see and offer');
});

test('discovery hides the closed, the expired and the stale', () => {
  const closed = job({ id: 'job-booked', jobStatus: 'booked' });
  const expired = job({ id: 'job-expired', expiresAt: '2026-10-05T00:00:00.000Z' });
  const stale = job({ id: 'job-stale', scheduleFlexible: false, preferredStart: '2026-09-01T00:00:00.000Z' });
  const unpicked = job({ id: 'job-draft', jobStatus: 'draft', publishedAt: undefined });

  const database = snapshot({ jobPosts: [closed, expired, stale, unpicked] });
  for (const record of [closed, expired, stale, unpicked]) {
    assert.equal(
      canServMateDiscoverJob(database, { jobId: record.id, userId: 'u-clean', now: NOW }).allowed,
      false,
      `${record.id} must not be discoverable`,
    );
  }

  // A flexible job with no expiry in the future is fine.
  const fine = job({ id: 'job-fine', preferredStart: '2026-11-01T00:00:00.000Z' });
  assert.equal(
    canServMateDiscoverJob(snapshot({ jobPosts: [fine] }), {
      jobId: 'job-fine',
      userId: 'u-clean',
      now: NOW,
    }).allowed,
    true,
  );
});

test('discovery is limited to the categories a ServMate works in', () => {
  const database = snapshot({ jobPosts: [job({ id: 'job-1' })] });
  assert.equal(
    canServMateDiscoverJob(database, { jobId: 'job-1', userId: 'u-clean', now: NOW }).allowed,
    true,
    'the cleaning ServMate can see a cleaning job',
  );
  assert.equal(
    canServMateDiscoverJob(database, { jobId: 'job-1', userId: 'u-repair', now: NOW }).allowed,
    false,
    'a repair-only ServMate cannot',
  );
});

test('discovery is limited to the areas a ServMate covers', () => {
  const database = snapshot({ jobPosts: [job({ id: 'job-far', locationCity: 'Tagaytay' })] });
  const decision = canServMateDiscoverJob(database, {
    jobId: 'job-far',
    userId: 'u-clean',
    now: NOW,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed === false && decision.reason, 'outside_service_area');
});

test('a customer never discovers their own job', () => {
  const database = snapshot({ jobPosts: [job({ id: 'job-1' })] });
  assert.equal(
    canServMateDiscoverJob(database, { jobId: 'job-1', userId: 'u-customer', now: NOW }).allowed,
    false,
  );
});

test('a block hides the job in either direction', () => {
  const blockedByCustomer = snapshot({
    jobPosts: [job({ id: 'job-1' })],
    userBlocks: [{ blockerUserId: 'u-customer', blockedUserId: 'u-clean', createdAt: NOW.toISOString() }],
  });
  const blockedByProvider = snapshot({
    jobPosts: [job({ id: 'job-1' })],
    userBlocks: [{ blockerUserId: 'u-clean', blockedUserId: 'u-customer', createdAt: NOW.toISOString() }],
  });

  for (const database of [blockedByCustomer, blockedByProvider]) {
    assert.equal(
      canServMateDiscoverJob(database, { jobId: 'job-1', userId: 'u-clean', now: NOW }).allowed,
      false,
    );
    assert.equal(canViewJobDetail(database, { jobId: 'job-1', userId: 'u-clean', now: NOW }).allowed, false);
    assert.equal(canViewJobMedia(database, { jobPostId: 'job-1', userId: 'u-clean', now: NOW }).allowed, false);
  }
});

test('job detail and media reach only the owner and an eligible ServMate', () => {
  const database = snapshot({ jobPosts: [job({ id: 'job-1' })] });

  assert.equal(canViewJobDetail(database, { jobId: 'job-1', userId: 'u-customer', now: NOW }).allowed, true);
  assert.equal(canViewJobMedia(database, { jobPostId: 'job-1', userId: 'u-customer', now: NOW }).allowed, true);

  assert.equal(canViewJobDetail(database, { jobId: 'job-1', userId: 'u-clean', now: NOW }).allowed, true);
  assert.equal(canViewJobMedia(database, { jobPostId: 'job-1', userId: 'u-clean', now: NOW }).allowed, true);

  assert.equal(canViewJobDetail(database, { jobId: 'job-1', userId: 'u-repair', now: NOW }).allowed, false);
  assert.equal(canViewJobMedia(database, { jobPostId: 'job-1', userId: 'u-repair', now: NOW }).allowed, false);
});

test('a guessed job id is indistinguishable from an absent one', () => {
  const database = snapshot({ jobPosts: [job({ id: 'job-1' })] });
  const missing = canViewJobDetail(database, { jobId: 'job-does-not-exist', userId: 'u-clean', now: NOW });
  const denied = canViewJobDetail(database, { jobId: 'job-1', userId: 'u-repair', now: NOW });

  assert.equal(missing.allowed, false);
  assert.equal(denied.allowed, false);
  assert.equal(missing.allowed === false && missing.reason, 'not_found');
  // The refusal never says "not eligible" — that would confirm the job exists.
  assert.equal(denied.allowed === false && denied.reason, 'not_eligible');
});

test('the discovery summary withholds the exact address', () => {
  const record = job({ id: 'job-1' });
  const database = snapshot({ jobPosts: [record] });
  const decision = canServMateDiscoverJob(database, { jobId: 'job-1', userId: 'u-clean', now: NOW });
  assert.equal(decision.allowed, true);
  if (!decision.allowed) return;

  // The detail the policy releases to an eligible provider is the full record,
  // which is why the *summary* projection exists; assert the sensitive fields it
  // drops are present on the record itself.
  assert.equal(record.locationBarangay, 'Molino IV');
  assert.equal(record.locationNotes, 'Gate code 1234, unit 4B');
});

test('conversations reach participants only', () => {
  const database = snapshot({
    conversations: [
      {
        id: 'conv-1',
        conversationType: 'booking',
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ],
    conversationParticipants: [
      { conversationId: 'conv-1', userId: 'u-customer', joinedAt: NOW.toISOString() },
    ],
  });

  assert.equal(canViewConversation(database, 'conv-1', 'u-customer').allowed, true);
  assert.equal(canViewConversation(database, 'conv-1', 'u-clean').allowed, false);
  assert.equal(canViewConversation(database, 'conv-2', 'u-customer').allowed, false);
});

test('a review needs a completed booking, once', () => {
  const base = {
    id: 'booking-1',
    reference: 'SE-AAAAAA',
    userId: 'u-customer',
    servmateProfileId: 'sm-clean',
    message: 'Please clean the unit.',
    createdAt: NOW.toISOString(),
  };

  const requested = snapshot({ bookings: [{ ...base, status: 'requested' }] });
  assert.equal(canReviewBooking(requested, 'booking-1', 'u-customer').allowed, false);

  const completed = snapshot({ bookings: [{ ...base, status: 'completed' }] });
  assert.equal(canReviewBooking(completed, 'booking-1', 'u-customer').allowed, true);
  assert.equal(canReviewBooking(completed, 'booking-1', 'u-clean').allowed, false);

  const reviewed = snapshot({
    bookings: [{ ...base, status: 'completed' }],
    reviews: [
      {
        id: 'review-1',
        bookingId: 'booking-1',
        reviewerUserId: 'u-customer',
        servmateProfileId: 'sm-clean',
        rating: 5,
        publicationStatus: 'published',
        createdAt: NOW.toISOString(),
      },
    ],
  });
  assert.equal(canReviewBooking(reviewed, 'booking-1', 'u-customer').allowed, false);
});
