/**
 * Presentation derived from data.
 *
 * Blueprint §10.2 gives a listing a title, category, price, area, availability
 * and publication status — and nothing about how it looks. So the look is
 * *computed* here from those facts rather than stored: the category picks the
 * thumbnail tone and the glyph, the theme supplies the type and rules. That
 * keeps decorative fields out of the datastore (a stored `glyph` or `sold`
 * counter is a fabricated marketplace metric) while every listing still reads
 * as distinct on the grid.
 *
 * Pure and import-safe on the server and the client: the client components
 * import the tones and gradients directly.
 */

import type { BookingStatus, JobStatus, OfferStatus } from './store';

/**
 * The reasons a report may cite, in the order they are offered.
 *
 * Declared with the other shared vocabularies rather than beside the reporting
 * rules, because the client form and the server validation both read this one
 * list: a reason the API accepts but the form never offers — or the reverse — is
 * a mismatch nobody would notice.
 */
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'misrepresentation',
  'unsafe',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam or advertising',
  harassment: 'Harassment or abuse',
  misrepresentation: 'Misleading or false',
  unsafe: 'Unsafe or illegal',
  other: 'Something else',
};

export type Gradient = {
  /** Two-stop linear gradient used as a thumbnail / avatar background. */
  from: string;
  to: string;
  /** Optional angle in degrees for the gradient. */
  angle?: number;
};

/** The glyphs a thumbnail can draw. One per category, never per listing. */
export type Glyph = 'sparkle' | 'wrench' | 'book' | 'camera' | 'scissors' | 'box';

/**
 * One slate tone per category, shared by the category tiles, the service
 * thumbnails and the provider avatars so the whole grid stays monochrome and
 * on-theme while each category remains distinguishable. All are shades of the
 * slate #6d8196 → ink #4a4a4a family.
 *
 * Keyed by category id, matching `./categories`.
 */
export const CATEGORY_TONE: Record<string, Gradient> = {
  cleaning: { from: '#8a9cad', to: '#6b8098', angle: 135 },
  'home-repair': { from: '#6d8196', to: '#4f657f', angle: 135 },
  tutoring: { from: '#5b6e83', to: '#3f5266', angle: 135 },
  events: { from: '#52667b', to: '#36485a', angle: 135 },
  errands: { from: '#7688a0', to: '#576b83', angle: 135 },
  beauty: { from: '#63758a', to: '#44576b', angle: 135 },
};

const GLYPH_BY_CATEGORY: Record<string, Glyph> = {
  cleaning: 'sparkle',
  'home-repair': 'wrench',
  tutoring: 'book',
  events: 'camera',
  errands: 'box',
  beauty: 'scissors',
};

/** Neutral tones that belong to no single category. */
export const NEUTRAL_TONE: Gradient = { from: '#4a4a4a', to: '#52667b', angle: 135 };

/** The tone for a category id, falling back to a neutral slate. */
export function toneForCategory(categoryId: string | undefined): Gradient {
  if (!categoryId) return NEUTRAL_TONE;
  return CATEGORY_TONE[categoryId] ?? NEUTRAL_TONE;
}

/** The glyph for a category id, falling back to a neutral box. */
export function glyphForCategory(categoryId: string | undefined): Glyph {
  if (!categoryId) return 'box';
  return GLYPH_BY_CATEGORY[categoryId] ?? 'box';
}

/**
 * Every area a listed ServMate covers.
 *
 * This is the marketplace's coverage list, shared by the storefront's area
 * filter, the account's default-area preference and a job post's location, so
 * the three can never offer different choices. Kept as a fixed table for the
 * same reason as the category registry: it is part of the release, and pure
 * validation needs it without a round trip.
 */
export const SERVICE_AREAS: string[] = [
  'Bacoor',
  'Imus',
  'Dasmariñas',
  'General Trias',
  'Tagaytay',
];

export function isServiceArea(value: string): boolean {
  return SERVICE_AREAS.includes(value);
}

/**
 * Every booking status the interface can show, with the words it uses.
 *
 * One map, so a status can never be rendered by one surface as "Withdrawn" and
 * by another as "Confirmed". A phrase is written from the customer's side, which
 * is whose screen this is.
 */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completion_pending: 'Awaiting your confirmation',
  completed: 'Completed',
  cancelled: 'Withdrawn',
  disputed: 'Under review',
};

/** The same rule for a job post's own status, in the customer's words. */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  offer_received: 'Offers received',
  booked: 'Booked',
  in_progress: 'In progress',
  completion_pending: 'Finishing up',
  completed: 'Completed',
  cancelled: 'Closed',
  expired: 'Expired',
};

/** And for an offer, from both sides of the table. */
export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: 'On the table',
  accepted: 'Accepted',
  rejected: 'Passed on',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
  category_changed: 'No longer eligible',
};

/**
 * Where a filed report stands, in the reporter's words.
 *
 * The reporter is told what happened to their report, not which queue row it
 * occupies: "Waiting for review" and "Being reviewed" are both true statements
 * about an open record, and neither one guesses at an outcome the moderator has
 * not reached yet.
 */
export const REPORT_STATUS_LABELS: Record<
  'open' | 'reviewing' | 'resolved' | 'dismissed',
  string
> = {
  open: 'Waiting for review',
  reviewing: 'Being reviewed',
  resolved: 'Resolved',
  dismissed: 'Closed, no action',
};

export function gradientStyle(gradient: Gradient): { backgroundImage: string } {
  return {
    backgroundImage: `linear-gradient(${gradient.angle ?? 135}deg, ${gradient.from}, ${gradient.to})`,
  };
}

export function firstLetter(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : 'S';
}
