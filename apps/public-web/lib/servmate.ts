import type { Booking } from './bookings';
import type { FeedService, Provider } from './feed-data';
import { SERVICE_AREAS } from './presentation';
import type { BookingStatus } from './store';

/**
 * The ServMate side of the marketplace — presentation and preview state only.
 *
 * Everything here is **pure** and safe on both the server and the client: it
 * takes providers, listings and bookings as arguments and returns view models.
 * The rows themselves come from `./servmate-profile`, which reaches the
 * datastore and stays on the server, so a client component can import this
 * module without dragging `node:fs` into the bundle.
 *
 * Two boundaries this module still respects:
 *
 * 1. It never invents a provider identity for an account. Which account is
 *    eligible to act as a ServMate is decided by `isServMate` on the account and
 *    the profile it owns, so the `?as=` parameter previews a roster entry rather
 *    than claiming the signed-in account is one of them.
 * 2. It never invents money. Payouts are gated behind the payment-provider and
 *    launch-gate decisions, so the workbench reports a status, not a balance.
 */

/* ------------------------------------------------------------------ *
 * The workbench's presentation rows.
 *
 * The workbench is a client component, so every date and money string is
 * formatted on the server and passed in as plain text. That keeps one time
 * zone in charge of the output and makes server and client render identical
 * markup.
 * ------------------------------------------------------------------ */

export type WorkbenchProvider = Pick<
  Provider,
  'id' | 'name' | 'handle' | 'verified' | 'rating' | 'reviews' | 'responseMins' | 'area' | 'headline'
>;

export type WorkbenchChoice = {
  id: string;
  name: string;
  area: string;
  verified: boolean;
};

export type WorkbenchRequest = {
  id: string;
  reference: string;
  serviceTitle: string;
  category: string;
  area?: string;
  message: string;
  /**
   * `requested` is still waiting on the ServMate; anything else is settled —
   * withdrawn by the customer, or already booked into a job.
   */
  status: BookingStatus;
  receivedLabel: string;
};

export type WorkbenchListing = {
  id: string;
  title: string;
  category: string;
  area: string;
  fromLabel: string;
  availability: string;
  repliesLabel: string;
};

export type WorkbenchStanding = {
  waitingLabel: string;
  listingsLabel: string;
  fromLabel: string;
  repliesLabel: string;
};

export type WorkbenchData = {
  provider: WorkbenchProvider;
  roster: WorkbenchChoice[];
  requests: WorkbenchRequest[];
  listings: WorkbenchListing[];
  standing: WorkbenchStanding;
};

/** The roster choices the workbench switches between, by name. */
export function providerChoices(providers: Provider[]): WorkbenchChoice[] {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    area: provider.area,
    verified: provider.verified,
  }));
}

/** Every listing that belongs to this ServMate, as the card model. */
export function listingsFor(providerId: string, listings: FeedService[]): FeedService[] {
  return listings.filter((listing) => listing.providerId === providerId);
}

/**
 * The category a listing belongs to, for a booking made against it.
 *
 * A request that predates the listing's category change still shows the
 * category the customer actually booked from, so the queue never reinterprets
 * history.
 */
export function categoryForListing(listingId: string, listings: FeedService[]): string {
  return listings.find((listing) => listing.id === listingId)?.category ?? 'Service';
}

/**
 * Requests aimed at this ServMate's listings.
 *
 * Oldest first: the customer who has been waiting longest is the next one up.
 */
export function incomingFor(
  providerId: string,
  listings: FeedService[],
  bookings: Booking[],
): Booking[] {
  const owned = new Set(listingsFor(providerId, listings).map((listing) => listing.id));
  return bookings
    .filter((booking) => owned.has(booking.serviceId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Open requests across every listing — the provider's standing total. */
export function waitingCount(listings: FeedService[], bookings: Booking[]): number {
  const owned = new Set(listings.map((listing) => listing.id));
  return bookings.filter(
    (booking) => owned.has(booking.serviceId) && booking.status === 'requested',
  ).length;
}

/**
 * Which ServMate to open the workbench on: the one whose listing carries the
 * most recent open request, so the queue is not empty when there is something
 * real to show. Falls back to the first roster entry.
 */
export function defaultProviderId(
  providers: Provider[],
  listings: FeedService[],
  bookings: Booking[],
): string {
  const newestOpen = [...bookings]
    .filter((booking) => booking.status === 'requested')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const owner = newestOpen
    ? listings.find((listing) => listing.id === newestOpen.serviceId)?.providerId
    : undefined;
  return owner ?? providers[0]?.id ?? '';
}

export type ServmateStanding = {
  /** Open requests across the whole account, so the panel shows the real total. */
  waiting: number;
  liveListings: number;
  fromCentavos?: number;
  responseMins: number;
};

export function standingFor(
  provider: Provider,
  listings: FeedService[],
  waiting: number,
): ServmateStanding {
  const prices = listings
    .map((listing) => listing.startingPriceCentavos)
    .filter((price): price is number => price !== undefined);
  return {
    waiting,
    liveListings: listings.length,
    ...(prices.length === 0 ? {} : { fromCentavos: Math.min(...prices) }),
    responseMins: provider.responseMins,
  };
}

/* ------------------------------------------------------------------ *
 * Device-held preview state.
 *
 * Accept and Decline decisions are held on the device, not in the store:
 * writing a booking status the contract does not define would be inventing a
 * state machine the blueprint says must be agreed first. A ServMate's profile
 * edits are different — those now have a real home on the account — so the
 * draft overlay is only used to preview a roster entry that is not yours.
 * ------------------------------------------------------------------ */

export type ServmateDecision = 'accepted' | 'declined';

export type ServmateProfileDraft = {
  /** The italic line under the name. Empty falls back to the roster's. */
  headline: string;
  /** A paragraph about the ServMate, shown on the public page. */
  about: string;
  /** Areas this ServMate covers, in the order chosen. */
  areas: string[];
};

export const HEADLINE_MAX = 90;
export const ABOUT_MAX = 400;

export function emptyDraft(): ServmateProfileDraft {
  return { headline: '', about: '', areas: [] };
}

/** The area list a ServMate picks from, matching the storefront's coverage areas. */
export const COVERAGE_CHOICES: string[] = SERVICE_AREAS;

export type ServmatePreviewState = {
  decisions: Record<string, ServmateDecision>;
  accepting: boolean;
  /** Keyed by ServMate id, so previewing another roster entry keeps its own draft. */
  profiles: Record<string, ServmateProfileDraft>;
};

export function emptyPreviewState(): ServmatePreviewState {
  return { decisions: {}, accepting: true, profiles: {} };
}

/** Validates a draft patch, returning the accepted fields or field errors. */
export function readDraftPatch(
  body: Record<string, unknown>,
): { ok: true; patch: Partial<ServmateProfileDraft> } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const patch: Partial<ServmateProfileDraft> = {};

  if ('headline' in body) {
    const headline = typeof body.headline === 'string' ? body.headline.trim() : '';
    if (Array.from(headline).length > HEADLINE_MAX) {
      errors.headline = `Keep this under ${HEADLINE_MAX} characters.`;
    } else {
      patch.headline = headline;
    }
  }

  if ('about' in body) {
    const about = typeof body.about === 'string' ? body.about.trim() : '';
    if (Array.from(about).length > ABOUT_MAX) {
      errors.about = `Keep this under ${ABOUT_MAX} characters.`;
    } else {
      patch.about = about;
    }
  }

  if ('areas' in body) {
    const raw = Array.isArray(body.areas) ? body.areas : [];
    const areas = raw.filter((value): value is string => typeof value === 'string');
    const unknown = areas.find((area) => !COVERAGE_CHOICES.includes(area));
    if (unknown) errors.areas = 'Pick areas from the list.';
    else if (areas.length > COVERAGE_CHOICES.length) errors.areas = 'Pick each area once.';
    else patch.areas = Array.from(new Set(areas));
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, patch };
}

/** Reads persisted preview decisions, dropping anything malformed. */
export function parsePreviewState(raw: unknown): ServmatePreviewState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyPreviewState();
  const record = raw as Record<string, unknown>;
  const decisions: Record<string, ServmateDecision> = {};
  const source = record.decisions;
  if (typeof source === 'object' && source !== null && !Array.isArray(source)) {
    for (const [bookingId, value] of Object.entries(source as Record<string, unknown>)) {
      if (value === 'accepted' || value === 'declined') decisions[bookingId] = value;
    }
  }
  const profiles: Record<string, ServmateProfileDraft> = {};
  const storedProfiles = record.profiles;
  if (typeof storedProfiles === 'object' && storedProfiles !== null && !Array.isArray(storedProfiles)) {
    for (const [providerId, value] of Object.entries(storedProfiles as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
      const entry = value as Record<string, unknown>;
      const draft = readDraftPatch({
        headline: typeof entry.headline === 'string' ? entry.headline : '',
        about: typeof entry.about === 'string' ? entry.about : '',
        areas: Array.isArray(entry.areas) ? entry.areas : [],
      });
      if (draft.ok) profiles[providerId] = { ...emptyDraft(), ...draft.patch };
    }
  }

  return {
    decisions,
    accepting: typeof record.accepting === 'boolean' ? record.accepting : true,
    profiles,
  };
}
