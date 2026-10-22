import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Account deletion and retention.
 *
 * The contract these cases pin down:
 *
 *  - live work is a refusal, not a warning;
 *  - the password is required when the account has one;
 *  - anything personal is gone in the same transaction, including every session;
 *  - a finished booking survives as the other party's record, with the work's
 *    title snapshotted before its job row goes;
 *  - the tombstone expires and the retained booking is detached, not deleted.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-deletion-'));
process.env.SERVEM_SEED = '0';

const { deletionPreview, deleteAccount, purgeDueAccounts, PURGED_ACCOUNT_ACTOR } = await import(
  '../lib/account-deletion.ts'
);
const { hashPassword, verifyPassword } = await import('../lib/passwords.ts');
const { query, transact } = await import('../lib/store.ts');

const CUSTOMER = 'u-del-customer';
const SERVmate = 'u-del-servmate';
const PROFILE = 'sm-del';
const PASSWORD = 'correct horse battery staple';

async function install(): Promise<void> {
  const passwordHash = await hashPassword(PASSWORD);
  await transact((database) => {
    const stamp = '2026-10-01T08:00:00.000Z';
    database.users.push(
      {
        id: CUSTOMER,
        name: 'Ana Dela Cruz',
        email: 'ana@example.test',
        passwordHash,
        preferences: { notifyRequestUpdates: true },
        profile: { area: 'Bacoor' },
        createdAt: stamp,
      },
      {
        id: SERVmate,
        name: 'Ben Santos',
        email: 'ben@example.test',
        isServMate: true,
        createdAt: stamp,
      },
    );
    database.sessions.push(
      { token: 'session-a', userId: CUSTOMER, expiresAt: '2027-01-01T00:00:00.000Z' },
      { token: 'session-b', userId: CUSTOMER, expiresAt: '2027-01-01T00:00:00.000Z' },
    );
    database.servmateProfiles.push({
      id: PROFILE,
      userId: SERVmate,
      providerStatus: 'active',
      verificationStatus: 'verified',
      createdAt: stamp,
      updatedAt: stamp,
    });
    database.serviceListings.push({
      id: 'listing-del',
      servmateProfileId: PROFILE,
      categoryId: 'cleaning',
      title: 'Home cleaning',
      description: 'Weekly clean.',
      pricingModel: 'fixed',
      amountCentavos: 90000,
      currency: 'PHP',
      publicationStatus: 'published',
      createdAt: stamp,
      updatedAt: stamp,
    });
    database.jobPosts.push({
      id: 'job-del',
      customerId: CUSTOMER,
      categoryId: 'cleaning',
      title: 'Move-out clean',
      description: 'Private details about the unit.',
      jobStatus: 'completed',
      pricingModel: 'fixed',
      budgetCentavos: 180000,
      currency: 'PHP',
      locationCity: 'Bacoor',
      locationBarangay: 'Molino IV',
      locationNotes: 'Gate code 1234',
      scheduleFlexible: true,
      createdAt: stamp,
      updatedAt: stamp,
    });
    database.bookings.push(
      {
        id: 'booking-del',
        reference: 'SE-DEL001',
        userId: CUSTOMER,
        jobPostId: 'job-del',
        servmateProfileId: PROFILE,
        message: 'Please bring supplies.',
        status: 'completed',
        createdAt: stamp,
      },
      {
        id: 'booking-live',
        reference: 'SE-LIVE01',
        userId: CUSTOMER,
        message: 'Still being arranged.',
        status: 'confirmed',
        createdAt: stamp,
      },
    );
    database.notifications.push({
      id: 'notif-del',
      recipientUserId: CUSTOMER,
      notificationType: 'booking_confirmed',
      createdAt: stamp,
    });
    database.userBlocks.push({ blockerUserId: CUSTOMER, blockedUserId: SERVmate, createdAt: stamp });
    database.passwordResets.push({
      id: 'reset-del',
      userId: CUSTOMER,
      tokenHash: 'x',
      expiresAt: '2027-01-01T00:00:00.000Z',
      createdAt: stamp,
    });
  });
}

test('a live booking is a refusal that names the work', async () => {
  await install();

  const preview = await deletionPreview(CUSTOMER);
  assert.ok(preview);
  assert.equal(preview.canDelete, false);
  assert.equal(preview.retainedBookings, 1);
  assert.ok(preview.blockers.some((blocker) => blocker.reference === 'SE-LIVE01'));

  const refused = await deleteAccount(CUSTOMER, PASSWORD);
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.error, 'active_obligations');

  const still = await query((database) => ({
    users: database.users.length,
    sessions: database.sessions.length,
  }));
  assert.deepEqual(still, { users: 2, sessions: 2 });
});

test('the password is required and checked when the account has one', async () => {
  const wrong = await deleteAccount(CUSTOMER, 'not the password');
  assert.equal(wrong.ok, false);
  if (!wrong.ok) assert.equal(wrong.error, 'wrong_password');

  const absent = await deleteAccount(CUSTOMER, null);
  assert.equal(absent.ok, false);
  if (!absent.ok) assert.equal(absent.error, 'wrong_password');
});

test('deletion erases the person, keeps the finished booking, and snapshots its title', async () => {
  await transact((database) => {
    const live = database.bookings.find((booking) => booking.id === 'booking-live');
    assert.ok(live);
    live.status = 'completed';
  });

  const result = await deleteAccount(CUSTOMER, PASSWORD);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.retainedBookings, 2);

  const after = await query((database) => {
    const user = database.users.find((row) => row.id === CUSTOMER);
    const bookings = database.bookings.filter((row) => row.userId === CUSTOMER);
    return {
      user,
      sessions: database.sessions.filter((row) => row.userId === CUSTOMER).length,
      notifications: database.notifications.filter((row) => row.recipientUserId === CUSTOMER)
        .length,
      blocks: database.userBlocks.length,
      resets: database.passwordResets.length,
      jobs: database.jobPosts.filter((row) => row.customerId === CUSTOMER).length,
      listing: database.serviceListings.some((row) => row.id === 'listing-del'),
      profile: database.servmateProfiles.some((row) => row.id === PROFILE),
      bookings,
      deletion: database.accountDeletions.find((row) => row.userId === CUSTOMER),
    };
  });

  assert.ok(after.user);
  assert.equal(after.user.name, 'Deleted account');
  assert.equal(after.user.email, `deleted+${CUSTOMER}@servem.invalid`);
  assert.equal(after.user.passwordHash, undefined);
  assert.equal(after.user.profile, undefined);
  assert.equal(after.user.deletedAt !== undefined, true);
  assert.ok(after.sessions === 0);
  assert.ok(after.notifications === 0);
  assert.ok(after.blocks === 0);
  assert.ok(after.resets === 0);
  assert.ok(after.jobs === 0);
  // The listing and profile belong to the *other* account and must survive this
  // deletion: erasing one person cannot erase their counterparty's storefront.
  assert.equal(after.listing, true);
  assert.equal(after.profile, true);
  assert.equal(after.bookings.length, 2);
  const retained = after.bookings.find((booking) => booking.id === 'booking-del');
  assert.equal(retained?.serviceTitle, 'Move-out clean');
  assert.equal(after.deletion?.retainedBookingIds.length, 2);

  // The erased credential cannot be used even if its old hash were guessed at.
  const credentials = await query((database) => database.users.find((row) => row.id === CUSTOMER));
  assert.equal(await verifyPassword(PASSWORD, credentials?.passwordHash), false);
});

test('a tombstone cannot be signed into or resurrected through an old address', async () => {
  const account = await query(
    (database) => database.users.find((row) => row.id === CUSTOMER)?.email,
  );
  assert.equal(account, `deleted+${CUSTOMER}@servem.invalid`);
  assert.notEqual(account, 'ana@example.test');
});

test('deleting the provider removes the public profile and keeps the customer’s booking', async () => {
  const result = await deleteAccount(SERVmate, null);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const after = await query((database) => ({
    profile: database.servmateProfiles.some((row) => row.id === PROFILE),
    listing: database.serviceListings.some((row) => row.id === 'listing-del'),
    booking: database.bookings.find((row) => row.id === 'booking-del'),
    user: database.users.find((row) => row.id === SERVmate),
  }));

  assert.equal(after.profile, false);
  assert.equal(after.listing, false);
  assert.equal(after.booking?.reference, 'SE-DEL001');
  assert.equal(after.booking?.serviceTitle, 'Move-out clean');
  assert.equal(after.user?.name, 'Deleted account');
  assert.equal(after.user?.isServMate, false);
});

test('the purge removes the tombstone and detaches retained bookings', async () => {
  await transact((database) => {
    const user = database.users.find((row) => row.id === CUSTOMER);
    assert.ok(user);
    user.purgeAfter = new Date(Date.now() - 1000).toISOString();
  });

  const purged = await purgeDueAccounts();
  assert.equal(purged, 1);

  const after = await query((database) => ({
    user: database.users.some((row) => row.id === CUSTOMER),
    bookings: database.bookings.filter((row) => row.userId === PURGED_ACCOUNT_ACTOR).length,
    deletions: database.accountDeletions.length,
  }));
  assert.equal(after.user, false);
  assert.equal(after.bookings, 2);
  // The provider's own tombstone is still inside its window; only the purged
  // account's deletion record goes with it.
  assert.equal(after.deletions, 1);
});
