import { randomUUID } from 'node:crypto';
import { checkUpload, discardAsset, storeProfileAsset } from './media';
import { servMateProfileFor } from './policy';
import { query, transact, type Database } from './store';

/**
 * A ServMate's portfolio and work updates (§5.3 sections 3 and 4, §5.7).
 *
 * The profile is the provider's showcase, and these are the two parts of it that
 * a ServMate writes about their own work. The distinction the blueprint insists
 * on is kept here rather than in the UI: an item either came out of a **completed
 * booking** the platform watched, or it is **self-published**. The client never
 * chooses which — a request that claims a booking is checked against the booking,
 * and a claimed booking that does not belong to a completed job is refused rather
 * than downgraded, so a profile cannot accidentally present self-published work
 * as verified.
 *
 * Profile images live in the same private store as job media and are served
 * through the same authorization-checked route; nothing here hands out a storage
 * path.
 */

export const MAX_PORTFOLIO_ITEMS = 12;
export const MAX_WORK_POSTS = 20;

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 600;
const POST_MAX = 600;

export type PortfolioItem = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  source: 'self_published' | 'completed_booking';
  createdAt: string;
};

export type WorkPost = {
  id: string;
  body: string;
  imageUrl?: string;
  createdAt: string;
};

/** The image reference for a stored asset, or nothing when it is gone. */
function imageUrl(database: Database, assetId?: string): string | undefined {
  if (!assetId) return undefined;
  const asset = database.mediaAssets.find((row) => row.id === assetId && !row.deletedAt);
  return asset ? `/api/media/${asset.id}` : undefined;
}

function toPortfolioItem(
  database: Database,
  row: Database['portfolioItems'][number],
): PortfolioItem {
  const url = imageUrl(database, row.mediaAssetId);
  return {
    id: row.id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    ...(url ? { imageUrl: url } : {}),
    source: row.source,
    createdAt: row.createdAt,
  };
}

/** A ServMate's published work examples, newest first. */
export async function getPortfolio(servmateProfileId: string): Promise<PortfolioItem[]> {
  return query((database) =>
    database.portfolioItems
      .filter((row) => row.servmateProfileId === servmateProfileId)
      .sort(
        (a, b) => a.displayOrder - b.displayOrder || b.createdAt.localeCompare(a.createdAt),
      )
      .map((row) => toPortfolioItem(database, row)),
  );
}

/** A ServMate's work updates, newest first. Removed posts are not shown. */
export async function getWorkPosts(servmateProfileId: string): Promise<WorkPost[]> {
  return query((database) =>
    database.workPosts
      .filter(
        (row) => row.servmateProfileId === servmateProfileId && row.publicationStatus === 'published',
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => {
        const url = imageUrl(database, row.mediaAssetId);
        return {
          id: row.id,
          body: row.body,
          ...(url ? { imageUrl: url } : {}),
          createdAt: row.createdAt,
        };
      }),
  );
}

export type PortfolioResult =
  | { ok: true; item: PortfolioItem }
  | { ok: false; error: 'not_a_provider' | 'too_many' | 'booking_not_found' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

export type AddPortfolioInput = {
  title?: unknown;
  description?: unknown;
  dataUrl?: unknown;
  /** When present, the item is claimed as work from this booking. */
  bookingId?: unknown;
};

/**
 * Adds one work example to the caller's own portfolio.
 *
 * A claimed booking is verified: it must exist, be completed, and be assigned to
 * this ServMate. Anything else is refused, because the one thing a portfolio must
 * not do is let a provider label their own work as platform-verified.
 */
export async function addPortfolioItem(
  userId: string,
  input: AddPortfolioInput,
): Promise<PortfolioResult> {
  const profile = await query((database) => servMateProfileFor(database, userId));
  if (!profile) return { ok: false, error: 'not_a_provider' };

  const errors: Record<string, string> = {};

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) errors.title = 'Give this piece of work a title.';
  else if (Array.from(title).length > TITLE_MAX) {
    errors.title = `Keep the title under ${TITLE_MAX} characters.`;
  }

  let description: string | undefined;
  if (typeof input.description === 'string' && input.description.trim() !== '') {
    const trimmed = input.description.trim();
    if (Array.from(trimmed).length > DESCRIPTION_MAX) {
      errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
    } else {
      description = trimmed;
    }
  }

  let upload: Awaited<ReturnType<typeof checkUpload>> | null = null;
  if (input.dataUrl !== undefined && input.dataUrl !== null && input.dataUrl !== '') {
    upload = checkUpload(input.dataUrl);
    if (!upload.ok) Object.assign(errors, upload.errors);
  }

  const bookingId = typeof input.bookingId === 'string' && input.bookingId ? input.bookingId : undefined;
  if (bookingId) {
    const booking = await query((database) =>
      database.bookings.find((row) => row.id === bookingId),
    );
    if (!booking || booking.status !== 'completed' || booking.servmateProfileId !== profile.id) {
      return { ok: false, error: 'booking_not_found' };
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, error: 'invalid', errors };

  const existing = await query(
    (database) =>
      database.portfolioItems.filter((row) => row.servmateProfileId === profile.id).length,
  );
  if (existing >= MAX_PORTFOLIO_ITEMS) return { ok: false, error: 'too_many' };

  const mediaAssetId = upload?.ok ? await storeProfileAsset(userId, upload.upload) : undefined;

  const item = await transact((database) => {
    const row = {
      id: randomUUID(),
      servmateProfileId: profile.id,
      title,
      ...(description ? { description } : {}),
      ...(mediaAssetId ? { mediaAssetId } : {}),
      source: bookingId ? ('completed_booking' as const) : ('self_published' as const),
      ...(bookingId ? { bookingId } : {}),
      displayOrder: database.portfolioItems.filter(
        (candidate) => candidate.servmateProfileId === profile.id,
      ).length,
      createdAt: new Date().toISOString(),
    };
    database.portfolioItems.push(row);
    return toPortfolioItem(database, row);
  });

  return { ok: true, item };
}

export type RemoveResult = { ok: true } | { ok: false; error: 'not_found' };

/** Removes one of the caller's own work examples, and its image with it. */
export async function removePortfolioItem(
  userId: string,
  itemId: string,
): Promise<RemoveResult> {
  const profile = await query((database) => servMateProfileFor(database, userId));
  if (!profile) return { ok: false, error: 'not_found' };

  const outcome = await transact((database) => {
    const row = database.portfolioItems.find(
      (candidate) => candidate.id === itemId && candidate.servmateProfileId === profile.id,
    );
    if (!row) return { found: false as const };
    database.portfolioItems = database.portfolioItems.filter((candidate) => candidate.id !== itemId);
    return { found: true as const, assetId: row.mediaAssetId };
  });

  if (!outcome.found) return { ok: false, error: 'not_found' };
  if (outcome.assetId) await discardAsset(outcome.assetId);
  return { ok: true };
}

export type WorkPostResult =
  | { ok: true; post: WorkPost }
  | { ok: false; error: 'not_a_provider' | 'too_many' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

/** Publishes a short work update to the caller's own profile. */
export async function addWorkPost(
  userId: string,
  input: { body?: unknown; dataUrl?: unknown },
): Promise<WorkPostResult> {
  const profile = await query((database) => servMateProfileFor(database, userId));
  if (!profile) return { ok: false, error: 'not_a_provider' };

  const errors: Record<string, string> = {};
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!body) errors.body = 'Write the update before posting it.';
  else if (Array.from(body).length > POST_MAX) {
    errors.body = `Keep the update under ${POST_MAX} characters.`;
  }

  let upload: Awaited<ReturnType<typeof checkUpload>> | null = null;
  if (input.dataUrl !== undefined && input.dataUrl !== null && input.dataUrl !== '') {
    upload = checkUpload(input.dataUrl);
    if (!upload.ok) Object.assign(errors, upload.errors);
  }

  if (Object.keys(errors).length > 0) return { ok: false, error: 'invalid', errors };

  const existing = await query(
    (database) =>
      database.workPosts.filter(
        (row) => row.servmateProfileId === profile.id && row.publicationStatus === 'published',
      ).length,
  );
  if (existing >= MAX_WORK_POSTS) return { ok: false, error: 'too_many' };

  const mediaAssetId = upload?.ok ? await storeProfileAsset(userId, upload.upload) : undefined;

  const post = await transact((database) => {
    const row = {
      id: randomUUID(),
      servmateProfileId: profile.id,
      body,
      ...(mediaAssetId ? { mediaAssetId } : {}),
      publicationStatus: 'published' as const,
      createdAt: new Date().toISOString(),
    };
    database.workPosts.push(row);
    const url = imageUrl(database, row.mediaAssetId);
    return {
      id: row.id,
      body: row.body,
      ...(url ? { imageUrl: url } : {}),
      createdAt: row.createdAt,
    };
  });

  return { ok: true, post };
}

/** Withdraws one of the caller's own updates. */
export async function removeWorkPost(userId: string, postId: string): Promise<RemoveResult> {
  const profile = await query((database) => servMateProfileFor(database, userId));
  if (!profile) return { ok: false, error: 'not_found' };

  const outcome = await transact((database) => {
    const row = database.workPosts.find(
      (candidate) =>
        candidate.id === postId &&
        candidate.servmateProfileId === profile.id &&
        candidate.publicationStatus === 'published',
    );
    if (!row) return { found: false as const };
    // Removed rather than deleted: the record of what was posted stays.
    row.publicationStatus = 'removed';
    return { found: true as const, assetId: row.mediaAssetId };
  });

  if (!outcome.found) return { ok: false, error: 'not_found' };
  if (outcome.assetId) await discardAsset(outcome.assetId);
  return { ok: true };
}

/** Whether a completed booking of this ServMate can still be added as work. */
export async function completedWorkFor(
  servmateProfileId: string,
): Promise<{ bookingId: string; label: string }[]> {
  return query((database) =>
    database.bookings
      .filter(
        (booking) =>
          booking.servmateProfileId === servmateProfileId &&
          booking.status === 'completed' &&
          !database.portfolioItems.some((item) => item.bookingId === booking.id),
      )
      .map((booking) => {
        const job = booking.jobPostId
          ? database.jobPosts.find((row) => row.id === booking.jobPostId)
          : undefined;
        return { bookingId: booking.id, label: job?.title ?? booking.serviceTitle ?? 'Completed work' };
      }),
  );
}
