import { query } from './store';
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
