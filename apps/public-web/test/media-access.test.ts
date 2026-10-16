import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Private job media: who may fetch a customer's photos, and what may be stored.
 *
 * Blueprint §6.4 requires the media rule to hold at the media endpoints, not just
 * at the job endpoints, and §16 names the case explicitly: *an unrelated ServMate
 * cannot retrieve job photos or thumbnails*. A guessed asset id must behave
 * exactly like an id that does not exist, and a file whose declared type does not
 * match its bytes must never reach storage.
 */

process.env.SERVEM_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'servem-media-'));
process.env.SERVEM_SEED = '0';

const { createJobPost, publishJobPost } = await import('../lib/jobs.ts');
const { submitOffer, acceptOffer } = await import('../lib/offers.ts');
const { onboardServMate, setServmateCategories, setServmateCoverage } = await import(
  '../lib/servmate-profile.ts'
);
const {
  MAX_JOB_MEDIA,
  MAX_MEDIA_BYTES,
  listJobMedia,
  readJobMedia,
  registerJobMedia,
  removeJobMedia,
} = await import('../lib/media.ts');
const { query, transact } = await import('../lib/store.ts');

const CUSTOMER = 'u-media-customer';
const OTHER_CUSTOMER = 'u-media-other';
const CLEANER = 'u-media-cleaner';
const PLUMBER = 'u-media-plumber';
const FAR = 'u-media-far';

/** A real 1×1 PNG: the signature check has to accept genuine bytes. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let jobId = '';
let assetId = '';

async function createAccounts(ids: string[]): Promise<void> {
  await transact((database) => {
    for (const id of ids) {
      if (database.users.some((user) => user.id === id)) continue;
      database.users.push({
        id,
        name: id.replace(/^u-media-/, ''),
        email: `${id}@example.test`,
        username: id,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

test('a job exists with one matching and two non-matching providers', async () => {
  await createAccounts([CUSTOMER, OTHER_CUSTOMER, CLEANER, PLUMBER, FAR]);

  const cleaner = await onboardServMate(CLEANER);
  await setServmateCategories(cleaner.profileId!, ['cleaning']);
  await setServmateCoverage(cleaner.profileId!, ['Bacoor']);

  const plumber = await onboardServMate(PLUMBER);
  await setServmateCategories(plumber.profileId!, ['home-repair']);
  await setServmateCoverage(plumber.profileId!, ['Bacoor']);

  const far = await onboardServMate(FAR);
  await setServmateCategories(far.profileId!, ['cleaning']);
  await setServmateCoverage(far.profileId!, ['Tagaytay']);

  const created = await createJobPost(CUSTOMER, {
    title: 'Deep clean a two-bedroom condo',
    description: 'Kitchen, bathrooms, living room and bedrooms.',
    categoryId: 'cleaning',
    pricingModel: 'fixed',
    budgetCentavos: 180000,
    locationCity: 'Bacoor',
    locationBarangay: 'Molino IV',
    locationNotes: 'Gate code 1234',
    scheduleFlexible: true,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  jobId = created.job.id;

  const published = await publishJobPost(CUSTOMER, jobId);
  assert.equal(published.ok, true);
});

test('the owner attaches a photo and reads it back', async () => {
  const attached = await registerJobMedia(CUSTOMER, jobId, { dataUrl: PNG });
  assert.equal(attached.ok, true);
  if (!attached.ok) return;
  assetId = attached.media.assetId;

  assert.equal(attached.media.mediaType, 'image');
  assert.equal(attached.media.mimeType, 'image/png');
  // The only reference handed out is the authorization-checked route.
  assert.equal(attached.media.url, `/api/media/${assetId}`);

  const delivered = await readJobMedia(assetId, CUSTOMER);
  assert.ok(delivered);
  assert.equal(delivered.mimeType, 'image/png');
  assert.equal(delivered.bytes.subarray(0, 4).toString('hex'), '89504e47');
});

test('the stored list never exposes a storage path', async () => {
  const media = await listJobMedia(jobId, CUSTOMER);
  assert.equal(media.length, 1);
  for (const item of media) {
    assert.ok(item.url.startsWith('/api/media/'));
    assert.ok(!item.url.includes('.data'));
    assert.ok(!JSON.stringify(item).includes('storageKey'));
  }
});

test('an eligible ServMate may fetch the photo', async () => {
  const media = await listJobMedia(jobId, CLEANER);
  assert.equal(media.length, 1);
  assert.ok(await readJobMedia(assetId, CLEANER));
});

test('a category-ineligible ServMate cannot fetch it or list it', async () => {
  assert.equal(await readJobMedia(assetId, PLUMBER), null);
  assert.deepEqual(await listJobMedia(jobId, PLUMBER), []);
});

test('a ServMate outside the coverage area cannot fetch it', async () => {
  assert.equal(await readJobMedia(assetId, FAR), null);
  assert.deepEqual(await listJobMedia(jobId, FAR), []);
});

test("another customer cannot read someone else's job media", async () => {
  assert.equal(await readJobMedia(assetId, OTHER_CUSTOMER), null);
  assert.deepEqual(await listJobMedia(jobId, OTHER_CUSTOMER), []);
});

test('a guessed asset id and an absent one are indistinguishable', async () => {
  const guessed = '00000000-0000-4000-8000-000000000000';
  assert.equal(await readJobMedia(guessed, CLEANER), null);
  assert.equal(await readJobMedia(guessed, CUSTOMER), null);
});

test('a signed-out caller cannot read media', async () => {
  assert.equal(await readJobMedia(assetId, ''), null);
  assert.deepEqual(await listJobMedia(jobId, ''), []);
});

test('a file is refused when its bytes do not match its declared type', async () => {
  const smuggled = await registerJobMedia(CUSTOMER, jobId, {
    dataUrl: `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`,
  });
  assert.equal(smuggled.ok, false);
  if (smuggled.ok) return;
  assert.equal(smuggled.error, 'invalid');
});

test('an unsupported type is refused', async () => {
  const svg = await registerJobMedia(CUSTOMER, jobId, {
    dataUrl: `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`,
  });
  assert.equal(svg.ok, false);
});

test('an oversize file is refused', async () => {
  const header = Buffer.from('89504e470d0a1a0a', 'hex');
  const big = Buffer.concat([header, Buffer.alloc(MAX_MEDIA_BYTES + 1024)]);
  const oversize = await registerJobMedia(CUSTOMER, jobId, {
    dataUrl: `data:image/png;base64,${big.toString('base64')}`,
  });
  assert.equal(oversize.ok, false);
  if (oversize.ok) return;
  assert.equal(oversize.error, 'invalid');
  assert.match(oversize.errors.file ?? '', /under 3 MB/);
});

test('a job is capped at the maximum number of files', async () => {
  for (let index = 1; index < MAX_JOB_MEDIA; index += 1) {
    const attached = await registerJobMedia(CUSTOMER, jobId, { dataUrl: PNG });
    assert.equal(attached.ok, true);
  }
  assert.equal((await listJobMedia(jobId, CUSTOMER)).length, MAX_JOB_MEDIA);

  const over = await registerJobMedia(CUSTOMER, jobId, { dataUrl: PNG });
  assert.equal(over.ok, false);
  if (over.ok) return;
  assert.equal(over.error, 'too_many');
});

test('only the owner may remove a file', async () => {
  const refused = await removeJobMedia(OTHER_CUSTOMER, jobId, assetId);
  assert.equal(refused.ok, false);
  assert.equal(refused.ok === false ? refused.error : '', 'not_found');

  const removed = await removeJobMedia(CUSTOMER, jobId, assetId);
  assert.equal(removed.ok, true);

  // Both the reference and the bytes are gone, for everyone.
  assert.equal(await readJobMedia(assetId, CUSTOMER), null);
  assert.equal(await readJobMedia(assetId, CLEANER), null);
  assert.equal((await listJobMedia(jobId, CUSTOMER)).length, MAX_JOB_MEDIA - 1);

  const stored = await query((database) =>
    database.mediaAssets.find((asset) => asset.id === assetId),
  );
  assert.ok(stored?.deletedAt, 'the asset is marked deleted rather than left fetchable');
});

test('a booked job freezes its photos and its scope', async () => {
  const remaining = await listJobMedia(jobId, CUSTOMER);
  assert.ok(remaining.length > 0);
  const promised = remaining[0]!;

  const profileId = (await query(
    (database) => database.servmateProfiles.find((profile) => profile.userId === CLEANER)?.id,
  ))!;
  const offer = await submitOffer({
    jobPostId: jobId,
    userId: CLEANER,
    servmateProfileId: profileId,
    body: { amountCentavos: 190000, scopeDescription: 'Deep clean, supplies included' },
  });
  assert.equal(offer.ok, true);
  if (!offer.ok) return;

  const booked = await acceptOffer(offer.offer.id, CUSTOMER);
  assert.equal(booked.ok, true);

  // The ServMate who won the work keeps access to what they agreed to.
  assert.ok(await readJobMedia(promised.assetId, CLEANER));

  const lateUpload = await registerJobMedia(CUSTOMER, jobId, { dataUrl: PNG });
  assert.equal(lateUpload.ok, false);
  if (!lateUpload.ok && lateUpload.error !== 'invalid') assert.equal(lateUpload.error, 'frozen');

  const lateRemoval = await removeJobMedia(CUSTOMER, jobId, promised.assetId);
  assert.equal(lateRemoval.ok, false);
  if (!lateRemoval.ok) assert.equal(lateRemoval.error, 'frozen');
});
