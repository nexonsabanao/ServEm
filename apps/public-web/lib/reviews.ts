import { randomUUID } from 'node:crypto';
import { query, transact } from './store';
import { canReviewBooking, type Decision } from './policy';
import type { Database, ReviewRecord } from './store';

/**
 * Reviews and their aggregates (blueprint §10.9).
 *
 * A rating shown on a profile or a card is computed here from the published
 * reviews of that ServMate. It is never stored as a number someone typed: an
 * aggregate that can drift from the reviews behind it is how a marketplace ends
 * up advertising a score nobody gave.
 *
 * Submission lives with the booking flow, because a review may only exist
 * against a completed booking — `canReviewBooking` in `./policy` is the single
 * authority on that question.
 */

export type Review = {
  id: string;
  bookingId: string;
  reviewerUserId: string;
  servmateProfileId: string;
  rating: number;
  comment?: string;
  publicationStatus: ReviewRecord['publicationStatus'];
  createdAt: string;
};

export type ReviewSummary = {
  /** Number of published reviews behind the average. */
  count: number;
  /** Mean rating to one decimal, or 0 when there are no reviews yet. */
  average: number;
  published: Review[];
};

function toReview(record: ReviewRecord): Review {
  return {
    id: record.id,
    bookingId: record.bookingId,
    reviewerUserId: record.reviewerUserId,
    servmateProfileId: record.servmateProfileId,
    rating: record.rating,
    ...(record.comment ? { comment: record.comment } : {}),
    publicationStatus: record.publicationStatus,
    createdAt: record.createdAt,
  };
}

/** The aggregate for one ServMate, from a snapshot. */
export function reviewSummaryFor(database: Database, servmateProfileId: string): ReviewSummary {
  const published = database.reviews
    .filter(
      (review) =>
        review.servmateProfileId === servmateProfileId &&
        review.publicationStatus === 'published' &&
        review.rating >= 1 &&
        review.rating <= 5,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toReview);

  const count = published.length;
  const total = published.reduce((sum, review) => sum + review.rating, 0);
  return {
    count,
    average: count === 0 ? 0 : Math.round((total / count) * 10) / 10,
    published,
  };
}

/** The aggregate for every ServMate, keyed by profile id, in one pass. */
export function reviewSummariesByProfile(database: Database): Map<string, ReviewSummary> {
  const summaries = new Map<string, ReviewSummary>();
  for (const profile of database.servmateProfiles) {
    summaries.set(profile.id, reviewSummaryFor(database, profile.id));
  }
  return summaries;
}

/** A ServMate's published reviews, newest first. */
export async function getServmateReviews(servmateProfileId: string): Promise<ReviewSummary> {
  return query((database) => reviewSummaryFor(database, servmateProfileId));
}

/** A published review as a profile shows it, with the reviewer's name. */
export type ReviewView = Review & { reviewerName: string };

/**
 * The reviews behind a rating, newest first, each with the customer's name.
 *
 * Only published ones: a review awaiting moderation or removed afterwards is
 * not part of what the marketplace says about this ServMate.
 */
export async function getServmateReviewViews(servmateProfileId: string): Promise<ReviewView[]> {
  return query((database) =>
    database.reviews
      .filter(
        (review) =>
          review.servmateProfileId === servmateProfileId &&
          review.publicationStatus === 'published',
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((review) => ({
        ...toReview(review),
        reviewerName:
          database.users.find((user) => user.id === review.reviewerUserId)?.name ?? 'A customer',
      })),
  );
}

/** Whether this account may still review this booking. */
export async function canReview(
  bookingId: string,
  userId: string,
): Promise<Decision<{ id: string }>> {
  return query((database) => {
    const decision = canReviewBooking(database, bookingId, userId);
    return decision.allowed ? { allowed: true as const, value: { id: decision.value.id } } : decision;
  });
}

const COMMENT_MAX = 1000;

export type SubmitReviewResult =
  | { ok: true; review: Review }
  | { ok: false; error: 'not_found' | 'not_reviewable' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

/**
 * Writes the customer's review of a completed booking (§10.9).
 *
 * `canReviewBooking` is the authority on *who* may review: the booking's own
 * customer, exactly once, on a booking that actually completed. This validates
 * what they said, stores it published, and tells the ServMate.
 *
 * A booking that is not reviewable yet — because the work is not finished — is
 * reported as such; one that belongs to somebody else is reported as absent.
 */
export async function submitReview(input: {
  bookingId: string;
  reviewerUserId: string;
  rating: unknown;
  comment?: unknown;
}): Promise<SubmitReviewResult> {
  const errors: Record<string, string> = {};
  const rating =
    typeof input.rating === 'number' && Number.isInteger(input.rating)
      ? input.rating
      : undefined;
  if (rating === undefined || rating < 1 || rating > 5) {
    errors.rating = 'Choose a rating from 1 to 5.';
  }

  let comment: string | undefined;
  if (input.comment !== undefined && input.comment !== null && input.comment !== '') {
    if (typeof input.comment !== 'string' || Array.from(input.comment.trim()).length > COMMENT_MAX) {
      errors.comment = `Keep the comment under ${COMMENT_MAX} characters.`;
    } else {
      comment = input.comment.trim();
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false as const, error: 'invalid' as const, errors };

  return transact((database) => {
    const booking = database.bookings.find((candidate) => candidate.id === input.bookingId);
    if (!booking) return { ok: false as const, error: 'not_found' as const };

    const decision = canReviewBooking(database, input.bookingId, input.reviewerUserId);
    if (!decision.allowed) {
      if (booking.userId !== input.reviewerUserId) {
        return { ok: false as const, error: 'not_found' as const };
      }
      return { ok: false as const, error: 'not_reviewable' as const };
    }

    const record: ReviewRecord = {
      id: randomUUID(),
      bookingId: input.bookingId,
      reviewerUserId: input.reviewerUserId,
      servmateProfileId: booking.servmateProfileId!,
      rating: rating!,
      ...(comment ? { comment } : {}),
      // Published on the spot: there is no moderation queue in Release 1, and a
      // review nobody can see would be a rating the marketplace pretends to
      // collect. The `pending` state is kept for the moderation pass.
      publicationStatus: 'published',
      createdAt: new Date().toISOString(),
    };
    database.reviews.push(record);

    const provider = database.servmateProfiles.find(
      (candidate) => candidate.id === booking.servmateProfileId,
    );
    if (provider) {
      database.notifications.push({
        id: randomUUID(),
        recipientUserId: provider.userId,
        notificationType: 'review_received',
        entityType: 'booking',
        entityId: input.bookingId,
        createdAt: record.createdAt,
      });
    }

    return { ok: true as const, review: toReview(record) };
  });
}
