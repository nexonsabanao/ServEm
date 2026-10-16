import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EDITABLE_JOB_STATUSES, canViewJobMedia } from './policy';
import {
  query,
  storeDataDir,
  transact,
  type Database,
  type JobPostMediaRecord,
  type MediaAssetRecord,
} from './store';

/**
 * Private job media (§4.4 step B, §6.4, §10.8).
 *
 * Photos and videos a customer attaches to their job are **private job data**.
 * Bytes live on disk under the store's own directory — never inside a
 * statically served path — and are read back only through `readJobMedia`, which
 * asks `canViewJobMedia` first. Nothing here ever hands out a storage path: the
 * only reference a caller gets is `/api/media/<id>`, and that route asks the same
 * question again. A leaked or guessed id therefore reveals nothing, because
 * authorization is re-decided on every fetch (§6.4).
 *
 * Upload validation is deliberately more than a MIME claim. The file type is
 * checked twice: against the allowlist the client declares, and against the
 * leading bytes of the decoded file. A text file announced as `image/png` is
 * refused rather than stored and served back under an image content type.
 */

/** How many files one job may carry. */
export const MAX_JOB_MEDIA = 6;

/** Largest single file, in bytes. */
export const MAX_MEDIA_BYTES = 3 * 1024 * 1024;

const CAPTION_MAX = 200;

type AllowedType = {
  mediaType: 'image' | 'video';
  /** Verifies the decoded bytes really are this type. */
  sniff: (bytes: Buffer) => boolean;
};

/**
 * The types the marketplace accepts, each with a signature check.
 *
 * An allowlist rather than a denylist: an unknown type is refused by default, so
 * adding support for something new is a deliberate act.
 */
const ALLOWED_TYPES: Record<string, AllowedType> = {
  'image/jpeg': {
    mediaType: 'image',
    sniff: (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  'image/png': {
    mediaType: 'image',
    sniff: (bytes) =>
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  'image/webp': {
    mediaType: 'image',
    sniff: (bytes) =>
      bytes.length > 12 &&
      bytes.toString('latin1', 0, 4) === 'RIFF' &&
      bytes.toString('latin1', 8, 12) === 'WEBP',
  },
  'image/gif': {
    mediaType: 'image',
    sniff: (bytes) => {
      const header = bytes.toString('latin1', 0, 6);
      return header === 'GIF87a' || header === 'GIF89a';
    },
  },
  'video/mp4': {
    mediaType: 'video',
    sniff: (bytes) => bytes.length > 12 && bytes.toString('latin1', 4, 8) === 'ftyp',
  },
};

/**
 * A job photo or video as an authorized caller sees it.
 *
 * `url` is a same-origin, authorization-checked path. It is deliberately not the
 * storage key: the key never leaves the server.
 */
export type JobMedia = {
  id: string;
  assetId: string;
  caption?: string;
  displayOrder: number;
  mediaType: 'image' | 'video';
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  url: string;
};

export type RegisterJobMediaResult =
  | { ok: true; media: JobMedia }
  | { ok: false; error: 'not_found' | 'frozen' | 'too_many' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

/* ---------------------------------------------------------------- *
 * Storage
 * ---------------------------------------------------------------- */

/** The private directory media bytes live in. Never a served path. */
function mediaDir(): string {
  return path.join(storeDataDir(), 'media');
}

/** Absolute path for a storage key. */
function fileFor(storageKey: string): string {
  return path.join(mediaDir(), storageKey);
}

/** Writes bytes atomically, so a half-written file is never served. */
async function storeBytes(storageKey: string, bytes: Buffer): Promise<void> {
  await mkdir(mediaDir(), { recursive: true });
  const target = fileFor(storageKey);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, target);
}

/** Best-effort removal of stored bytes; a missing file is not an error. */
async function discardBytes(storageKey: string): Promise<void> {
  await rm(fileFor(storageKey), { force: true });
}

/* ---------------------------------------------------------------- *
 * Payload reading and validation
 * ---------------------------------------------------------------- */

const DATA_URL = /^data:([a-z0-9.+/-]+);base64,([a-z0-9+/=\s]+)$/i;

/**
 * Reads a base64 data URL into bytes plus its declared type.
 *
 * A data URL keeps the upload a single JSON request, which is what lets the
 * posting form send the file with the same same-origin, session-checked path as
 * everything else. The trade-off is that the browser holds the whole file in
 * memory; production would move this to direct-to-object-storage uploads with a
 * signed intent, which is recorded in `docs/PROJECT_STATUS.md`.
 */
function readDataUrl(value: string): { mimeType: string; bytes: Buffer } | null {
  const match = DATA_URL.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (bytes.length === 0) return null;
  return { mimeType: match[1].toLowerCase(), bytes };
}

function toJobMedia(record: JobPostMediaRecord, asset: MediaAssetRecord): JobMedia {
  return {
    id: record.id,
    assetId: asset.id,
    ...(record.caption ? { caption: record.caption } : {}),
    displayOrder: record.displayOrder,
    mediaType: asset.mediaType,
    mimeType: asset.mimeType,
    fileSizeBytes: asset.fileSizeBytes,
    createdAt: record.createdAt,
    url: `/api/media/${asset.id}`,
  };
}

/** The live media on one job, in display order. */
function liveJobMedia(database: { jobPostMedia: JobPostMediaRecord[]; mediaAssets: MediaAssetRecord[] }, jobPostId: string): JobMedia[] {
  return database.jobPostMedia
    .filter((row) => row.jobPostId === jobPostId)
    .map((row) => ({ row, asset: database.mediaAssets.find((asset) => asset.id === row.mediaAssetId) }))
    .filter(
      (pair): pair is { row: JobPostMediaRecord; asset: MediaAssetRecord } =>
        pair.asset !== undefined && pair.asset.deletedAt === undefined,
    )
    .sort((a, b) => a.row.displayOrder - b.row.displayOrder)
    .map((pair) => toJobMedia(pair.row, pair.asset));
}

/* ---------------------------------------------------------------- *
 * Commands
 * ---------------------------------------------------------------- */

/**
 * Attaches one file to the customer's own job.
 *
 * The author is the session account and the job must be theirs; the job must
 * still be editable, because once work is booked the agreed scope — photos
 * included — is frozen (§4.7). The decoded bytes are checked against the
 * allowlist *and* against the declared type before anything is stored.
 */
export async function registerJobMedia(
  userId: string,
  jobId: string,
  input: { dataUrl?: unknown; caption?: unknown },
): Promise<RegisterJobMediaResult> {
  const job = await query((database) =>
    database.jobPosts.find((row) => row.id === jobId && row.customerId === userId) ?? null,
  );
  if (!job) return { ok: false, error: 'not_found' };
  if (!EDITABLE_JOB_STATUSES.includes(job.jobStatus)) return { ok: false, error: 'frozen' };

  const errors: Record<string, string> = {};

  // The declared type and the actual bytes must agree, or the file is refused
  // rather than stored and later served under a type it is not.
  const checked = checkUpload(input.dataUrl);
  const decoded = checked.ok ? checked.upload : null;
  if (!checked.ok) Object.assign(errors, checked.errors);

  let caption: string | undefined;
  if (typeof input.caption === 'string' && input.caption.trim() !== '') {
    const trimmed = input.caption.trim();
    if (Array.from(trimmed).length > CAPTION_MAX) {
      errors.caption = `Keep the caption under ${CAPTION_MAX} characters.`;
    } else {
      caption = trimmed;
    }
  }

  if (Object.keys(errors).length > 0 || !decoded) {
    return { ok: false, error: 'invalid', errors };
  }

  const assetId = randomUUID();
  const storageKey = assetId;
  await storeBytes(storageKey, decoded.bytes);

  const result = await transact((database) => {
    const live = database.jobPostMedia.filter(
      (row) =>
        row.jobPostId === jobId &&
        database.mediaAssets.some((asset) => asset.id === row.mediaAssetId && !asset.deletedAt),
    );
    if (live.length >= MAX_JOB_MEDIA) return { ok: false as const, error: 'too_many' as const };

    const now = new Date().toISOString();
    const asset: MediaAssetRecord = {
      id: assetId,
      ownerUserId: userId,
      storageKey,
      mediaType: decoded.mediaType,
      mimeType: decoded.mimeType,
      fileSizeBytes: decoded.bytes.length,
      // Bytes are written and verified before the record exists, so the asset is
      // ready the moment it is referenced.
      processingStatus: 'ready',
      visibility: 'job_private',
      jobPostId: jobId,
      createdAt: now,
    };
    const row: JobPostMediaRecord = {
      id: randomUUID(),
      jobPostId: jobId,
      mediaAssetId: assetId,
      ...(caption ? { caption } : {}),
      displayOrder: live.length,
      createdAt: now,
    };
    database.mediaAssets.push(asset);
    database.jobPostMedia.push(row);

    return { ok: true as const, media: toJobMedia(row, asset) };
  });

  // A refused write must not leave bytes behind that nothing references.
  if (!result.ok) await discardBytes(storageKey);
  return result;
}

export type RemoveJobMediaResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'frozen' };

/**
 * Detaches one file from the customer's own job.
 *
 * The metadata is what is erased; the bytes are removed too, because a private
 * file with no record behind it is exactly the kind of orphan that later gets
 * served by a bug. Removal is refused once the job is booked, so a customer
 * cannot quietly withdraw the evidence of what was agreed.
 */
export async function removeJobMedia(
  userId: string,
  jobId: string,
  assetId: string,
): Promise<RemoveJobMediaResult> {
  const result = await transact((database) => {
    const job = database.jobPosts.find((row) => row.id === jobId && row.customerId === userId);
    if (!job) return { ok: false as const, error: 'not_found' as const };
    if (!EDITABLE_JOB_STATUSES.includes(job.jobStatus)) {
      return { ok: false as const, error: 'frozen' as const };
    }

    const asset = database.mediaAssets.find(
      (row) => row.id === assetId && row.jobPostId === jobId && !row.deletedAt,
    );
    if (!asset) return { ok: false as const, error: 'not_found' as const };

    asset.deletedAt = new Date().toISOString();
    database.jobPostMedia = database.jobPostMedia.filter(
      (row) => !(row.jobPostId === jobId && row.mediaAssetId === assetId),
    );

    return { ok: true as const, storageKey: asset.storageKey };
  });

  if (result.ok) await discardBytes(result.storageKey);
  return result.ok ? { ok: true } : result;
}

/* ---------------------------------------------------------------- *
 * Queries
 * ---------------------------------------------------------------- */

/**
 * The media on a job for a caller entitled to it.
 *
 * An unauthorized caller — a visitor, another customer, a ServMate whose
 * category or area does not match — gets an empty list and no hint that anything
 * is there, exactly like the job detail itself (§6.4).
 */
export async function listJobMedia(jobId: string, userId: string): Promise<JobMedia[]> {
  return query((database) => {
    const decision = canViewJobMedia(database, { jobPostId: jobId, userId });
    if (!decision.allowed) return [];
    return liveJobMedia(database, jobId);
  });
}

/** Whether this caller may see *any* media on the job, for empty-state wording. */
export async function canSeeJobMedia(jobId: string, userId: string): Promise<boolean> {
  return query((database) => canViewJobMedia(database, { jobPostId: jobId, userId }).allowed);
}

export type DeliveredMedia = { bytes: Buffer; mimeType: string };

type Deliverable = { storageKey: string; mimeType: string };

/**
 * Whether this caller may read a stored asset.
 *
 * `job_private` defers entirely to the job rule, so media can never be softer
 * than the job it belongs to (§6.4). `public_profile` means "shown on a ServMate
 * profile", which every signed-in account may see — it is still only served
 * through this route, never from a static path. Anything else is refused.
 */
function authorizeAsset(
  database: Database,
  asset: MediaAssetRecord,
  userId: string,
): boolean {
  if (asset.visibility === 'job_private') {
    if (!asset.jobPostId) return false;
    return canViewJobMedia(database, { jobPostId: asset.jobPostId, userId }).allowed;
  }
  if (asset.visibility === 'public_profile') return userId !== '';
  return false;
}

async function deliver(assetId: string, userId: string): Promise<DeliveredMedia | null> {
  const asset = await query((database) => {
    const found = database.mediaAssets.find((row) => row.id === assetId && !row.deletedAt);
    if (!found || !authorizeAsset(database, found, userId)) return null;
    return { storageKey: found.storageKey, mimeType: found.mimeType } satisfies Deliverable;
  });
  if (!asset) return null;

  try {
    const bytes = await readFile(fileFor(asset.storageKey));
    return { bytes, mimeType: asset.mimeType };
  } catch {
    // The metadata outlived the file: report absence rather than a broken image.
    return null;
  }
}

/**
 * The bytes of one job asset, if this caller may read them.
 *
 * Null covers both "no such asset" and "not yours", so the delivery route
 * cannot be used to confirm that a private file exists.
 */
export async function readJobMedia(
  assetId: string,
  userId: string,
): Promise<DeliveredMedia | null> {
  const visibility = await query(
    (database) => database.mediaAssets.find((row) => row.id === assetId && !row.deletedAt)?.visibility,
  );
  if (visibility !== 'job_private') return null;
  return deliver(assetId, userId);
}

/** The bytes of any asset this caller is entitled to, job or profile. */
export async function readMedia(assetId: string, userId: string): Promise<DeliveredMedia | null> {
  return deliver(assetId, userId);
}

/* ---------------------------------------------------------------- *
 * Profile media (§5.3)
 * ---------------------------------------------------------------- */

/** A validated, decoded upload waiting to be stored. */
export type DecodedUpload = {
  bytes: Buffer;
  mimeType: string;
  mediaType: 'image' | 'video';
};

export type UploadCheck =
  | { ok: true; upload: DecodedUpload }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates a base64 data URL without storing anything.
 *
 * Shared by job media and profile media so a portfolio image passes exactly the
 * same checks as a job photo: allowlisted type, size cap, and a signature match
 * against the bytes rather than the claim. An upload that fails here is never
 * written anywhere.
 */
export function checkUpload(dataUrl: unknown): UploadCheck {
  const errors: Record<string, string> = {};
  const decoded =
    typeof dataUrl === 'string' && dataUrl.length > 0 ? readDataUrl(dataUrl) : null;

  if (!decoded) {
    errors.file = 'Choose a photo or video to attach.';
  } else if (decoded.bytes.length > MAX_MEDIA_BYTES) {
    errors.file = `Keep each file under ${Math.floor(MAX_MEDIA_BYTES / (1024 * 1024))} MB.`;
  } else {
    const allowed = ALLOWED_TYPES[decoded.mimeType];
    if (!allowed) errors.file = 'Attach a JPEG, PNG, WebP, GIF or MP4 file.';
    else if (!allowed.sniff(decoded.bytes)) {
      errors.file = 'That file is not really the type it claims to be.';
    } else {
      return {
        ok: true,
        upload: {
          bytes: decoded.bytes,
          mimeType: decoded.mimeType,
          mediaType: allowed.mediaType,
        },
      };
    }
  }
  return { ok: false, errors };
}

/**
 * Writes a profile image and records it as a `public_profile` asset.
 *
 * Returns the asset id for the portfolio item or post that references it. The
 * bytes are on disk before the record exists, so a referenced asset is always
 * readable; a caller that fails afterwards discards both with `discardAsset`.
 */
export async function storeProfileAsset(
  ownerUserId: string,
  upload: DecodedUpload,
): Promise<string> {
  const assetId = randomUUID();
  await storeBytes(assetId, upload.bytes);

  await transact((database) => {
    database.mediaAssets.push({
      id: assetId,
      ownerUserId,
      storageKey: assetId,
      mediaType: upload.mediaType,
      mimeType: upload.mimeType,
      fileSizeBytes: upload.bytes.length,
      processingStatus: 'ready',
      visibility: 'public_profile',
      createdAt: new Date().toISOString(),
    });
  });

  return assetId;
}

/** Erases an asset's bytes and marks its record deleted. */
export async function discardAsset(assetId: string): Promise<void> {
  const storageKey = await transact((database) => {
    const asset = database.mediaAssets.find((row) => row.id === assetId);
    if (!asset) return null;
    asset.deletedAt = new Date().toISOString();
    return asset.storageKey;
  });
  if (storageKey) await discardBytes(storageKey);
}
