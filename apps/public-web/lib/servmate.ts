import {
  feedServices,
  providers,
  providerById,
  SERVICE_AREAS,
  type FeedService,
  type Provider,
} from './feed-data';
import type { Booking } from './bookings';

/**
 * The ServMate (provider) side of the marketplace.
 *
 * Everything here is a *view model over sample data*: the roster in
 * `feed-data` stands in for provider records, and listings map to a provider by
 * `providerId` because the starter OpenAPI contract has no provider or booking
 * association yet. It is pure and import-safe on both the server and the
 * client — no store, no `node:` modules.
 *
 * Two boundaries this module deliberately respects:
 *
 * 1. It never invents a provider identity for an account. Which account is
 *    eligible to act as a ServMate is an open decision in the blueprint
 *    (provider verification and the customer/provider role switch), so the
 *    workbench previews the roster rather than claiming the signed-in account
 *    is one of them.
 * 2. It never invents money. Payouts are gated behind the payment-provider and
 *    launch-gate decisions, so the workbench reports a status instead of a
 *    balance.
 */

export type ServmateRosterEntry = Pick<
  Provider,
  'id' | 'name' | 'handle' | 'verified' | 'rating' | 'reviews' | 'responseMins' | 'area' | 'headline'
>;

/** The sample ServMates the workbench can preview, in roster order. */
export function servmateRoster(): ServmateRosterEntry[] {
  return providers.map(({ id, name, handle, verified, rating, reviews, responseMins, area, headline }) => ({
    id,
    name,
    handle,
    verified,
    rating,
    reviews,
    responseMins,
    area,
    headline,
  }));
}

export const SERVEMATE_IDS = providers.map((provider) => provider.id);

export function isServmateId(value: string): boolean {
  return SERVEMATE_IDS.includes(value);
}

export function getServmate(id: string): ServmateRosterEntry | undefined {
  const provider = providerById.get(id);
  if (!provider) return undefined;
  return servmateRoster().find((entry) => entry.id === provider.id);
}

/** Every listing that belongs to this ServMate, cheapest first. */
export function servicesFor(providerId: string): FeedService[] {
  return feedServices
    .filter((service) => service.providerId === providerId)
    .sort((a, b) => a.startingPriceCentavos - b.startingPriceCentavos);
}

/** The categories a ServMate currently works in, in roster order of the listings. */
export function categoriesFor(providerId: string): string[] {
  return Array.from(new Set(servicesFor(providerId).map((service) => service.category)));
}

/** The ServMate who offers a listing, if the sample catalog knows it. */
export function providerIdForService(serviceId: string): string | undefined {
  return feedServices.find((service) => service.id === serviceId)?.providerId;
}

export function categoryForService(serviceId: string): string {
  return feedServices.find((service) => service.id === serviceId)?.category ?? 'Service';
}

/**
 * Which ServMate to open the workbench on: the one with the most recent open
 * request on this account, so the queue is not empty when there is something
 * real to show. Falls back to the first roster entry.
 */
export function defaultServmateId(bookings: Booking[]): string {
  const newestOpen = [...bookings]
    .filter((booking) => booking.status === 'requested')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const owner = newestOpen ? providerIdForService(newestOpen.serviceId) : undefined;
  return owner ?? SERVEMATE_IDS[0] ?? '';
}

/**
 * Requests aimed at this ServMate's listings.
 *
 * These are the account's *own* requests, viewed from the other side of the
 * counter — the demand side of a single-account local store. A provider must
 * see every customer's request for their listings, so a real deployment scopes
 * this on the provider/booking association the contract does not define yet;
 * scoping it to the session's account keeps this design preview from exposing
 * another account's data.
 */
export function incomingFor(providerId: string, bookings: Booking[]): Booking[] {
  const owned = new Set(servicesFor(providerId).map((service) => service.id));
  // Oldest first: the customer who has been waiting longest is the next one up.
  return bookings
    .filter((booking) => owned.has(booking.serviceId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type ServmateQueue = {
  /** Open requests still waiting on a decision from this ServMate. */
  waiting: Booking[];
  /** Requests the customer withdrew before a decision was made. */
  withdrawn: Booking[];
};

export function splitQueue(bookings: Booking[]): ServmateQueue {
  return {
    waiting: bookings.filter((booking) => booking.status === 'requested'),
    withdrawn: bookings.filter((booking) => booking.status === 'cancelled'),
  };
}

export type ServmateStanding = {
  /** Open requests across the whole account, so the preview shows the real total. */
  waiting: number;
  liveListings: number;
  fromCentavos?: number;
  /** Provider reply time target, straight from the roster record. */
  responseMins: number;
  rating: number;
  reviews: number;
};

export function standingFor(providerId: string, bookings: Booking[]): ServmateStanding {
  const services = servicesFor(providerId);
  const from = services[0]?.startingPriceCentavos;
  const provider = providerById.get(providerId);

  return {
    waiting: splitQueue(incomingFor(providerId, bookings)).waiting.length,
    liveListings: services.length,
    ...(from === undefined ? {} : { fromCentavos: from }),
    responseMins: provider?.responseMins ?? 0,
    rating: provider?.rating ?? 0,
    reviews: provider?.reviews ?? 0,
  };
}

/**
 * The decision a ServMate has made on a request.
 *
 * Held on the device, not in the store: there is no provider-side API, and
 * writing a booking status the contract does not define would be inventing a
 * state machine the blueprint says must be agreed first.
 */
export type ServmateDecision = 'accepted' | 'declined';

/**
 * A ServMate's own edits to their public profile.
 *
 * Held on the device rather than in the store, for the same reason as the
 * decisions below: which account may act as a ServMate is an open blueprint
 * decision, so writing profile text into a shared record would be claiming an
 * identity the platform has not granted. The draft overlays the roster entry
 * wherever this person looks, and disappears with the device's other preview
 * state.
 */
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

export const SERVEMATE_PREVIEW_KEY = 'servem:servmate-preview';

export function emptyPreviewState(): ServmatePreviewState {
  return { decisions: {}, accepting: true, profiles: {} };
}

/**
 * The public profile a customer would see for this ServMate.
 *
 * The draft is laid over the roster record field by field, so an untouched
 * draft is invisible: the sample data comes through exactly as published.
 */
export type ServmateProfileView = {
  name: string;
  handle: string;
  verified: boolean;
  area: string;
  headline: string;
  about: string;
  areas: string[];
  rating: number;
  reviews: number;
  responseMins: number;
};

export function profileViewFor(
  providerId: string,
  draft: ServmateProfileDraft | undefined,
): ServmateProfileView | undefined {
  const provider = providerById.get(providerId);
  if (!provider) return undefined;
  const services = servicesFor(providerId);
  const rosterAreas = Array.from(new Set([provider.area, ...services.map((service) => service.area)]));
  const areas = draft?.areas && draft.areas.length > 0 ? draft.areas : rosterAreas;
  return {
    name: provider.name,
    handle: provider.handle,
    verified: provider.verified,
    area: provider.area,
    headline: draft?.headline.trim() || provider.headline,
    about: draft?.about.trim() || '',
    areas,
    rating: provider.rating,
    reviews: provider.reviews,
    responseMins: provider.responseMins,
  };
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

/* ------------------------------------------------------------------ *
 * Presentation rows.
 *
 * The workbench is a client component, so every date and money string is
 * formatted on the server and passed in as plain text. That keeps one time
 * zone in charge of the output and makes server and client render identical
 * markup.
 * ------------------------------------------------------------------ */

export type WorkbenchProvider = ServmateRosterEntry;

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
  /** `requested` is still waiting on the ServMate; `cancelled` was withdrawn. */
  status: 'requested' | 'cancelled';
  receivedLabel: string;
};

export type WorkbenchListing = {
  id: string;
  title: string;
  category: string;
  area: string;
  fromLabel: string;
  turnaround: string;
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
