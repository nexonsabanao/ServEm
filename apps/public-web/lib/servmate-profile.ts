import { randomUUID } from 'node:crypto';
import { getCategoryById, listCategories } from './categories';
import {
  feedServiceFrom,
  providerFrom,
  type FeedService,
  type Provider,
} from './feed-data';
import { isServiceArea, toneForCategory, type Gradient } from './presentation';
import { relatedTo } from './related';
import { reviewSummariesByProfile, type ReviewSummary } from './reviews';
import {
  query,
  transact,
  type Database,
  type ServiceListingRecord,
  type ServMateProfileRecord,
} from './store';

/**
 * ServMate profiles and service listings — the read side.
 *
 * This is where a public profile and its listings are assembled from stored
 * rows. It is **server-only**: it reaches the datastore, so a client component
 * must be handed the finished view rather than importing this module. The
 * presentation builders that turn these views into cards live in
 * `./feed-data`, which stays pure so the client can use it.
 *
 * Only published listings appear here. A draft or withdrawn listing is not part
 * of anybody's public profile (blueprint §5.4).
 */

/** A listing as a provider's own page shows it. */
export type ListingView = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  /** Display label, resolved from the category registry. */
  categoryName: string;
  area: string;
  amountCentavos?: number;
  availability: string;
  publicationStatus: ServiceListingRecord['publicationStatus'];
  publishedAt?: string;
};

/** A ServMate's public profile with its published listings. */
export type ProviderView = {
  id: string;
  userId: string;
  name: string;
  /** `@handle`, from the account's username. */
  handle: string;
  verified: boolean;
  headline: string;
  bio: string;
  experience: string;
  area: string;
  responseMins: number;
  /** Computed from published reviews, never asserted. */
  rating: number;
  reviewCount: number;
  /** Thumbnail tone, derived from the provider's primary category. */
  tone: Gradient;
  categoryIds: string[];
  /** Category display labels, in registry order. */
  categories: string[];
  areas: string[];
  listings: ListingView[];
};

function toListingView(listing: ServiceListingRecord): ListingView {
  const category = getCategoryById(listing.categoryId);
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    categoryId: listing.categoryId,
    categoryName: category?.name ?? 'Service',
    area: listing.serviceAreaLabel ?? '',
    ...(listing.amountCentavos === undefined ? {} : { amountCentavos: listing.amountCentavos }),
    availability: listing.availability ?? '',
    publicationStatus: listing.publicationStatus,
    ...(listing.publishedAt ? { publishedAt: listing.publishedAt } : {}),
  };
}

/** Every published listing for one ServMate, cheapest first. */
export function listingViewsFor(database: Database, servmateProfileId: string): ListingView[] {
  return database.serviceListings
    .filter(
      (listing) =>
        listing.servmateProfileId === servmateProfileId &&
        listing.publicationStatus === 'published',
    )
    .sort((a, b) => (a.amountCentavos ?? Infinity) - (b.amountCentavos ?? Infinity))
    .map(toListingView);
}

/** The display labels for a ServMate's eligible categories, in registry order. */
function categoryLabelsFor(database: Database, servmateProfileId: string): string[] {
  const eligible = new Set(
    database.servmateCategories
      .filter((row) => row.servmateProfileId === servmateProfileId && row.status === 'active')
      .map((row) => row.categoryId),
  );
  return listCategories()
    .filter((category) => eligible.has(category.id))
    .map((category) => category.name);
}

/**
 * The public profile for one stored ServMate record.
 *
 * `handle` and `name` come from the owning account, the professional details
 * from the profile, the ratings from the reviews and the tone from the primary
 * category — so nothing here is a decorative field that had to be stored.
 */
function toProviderView(
  database: Database,
  profile: ServMateProfileRecord,
  summary: ReviewSummary | undefined,
): ProviderView {
  const user = database.users.find((candidate) => candidate.id === profile.userId);
  const listings = listingViewsFor(database, profile.id);
  const categoryIds = Array.from(
    new Set(
      database.servmateCategories
        .filter((row) => row.servmateProfileId === profile.id && row.status === 'active')
        .map((row) => row.categoryId),
    ),
  );
  const areas = Array.from(
    new Set(
      database.servmateServiceAreas
        .filter((row) => row.servmateProfileId === profile.id)
        .map((row) => row.areaLabel),
    ),
  );
  const primaryCategory = listCategories().find((category) => categoryIds.includes(category.id));

  return {
    id: profile.id,
    userId: profile.userId,
    name: user?.name ?? 'ServMate',
    handle: user?.username ? `@${user.username}` : '',
    verified: profile.verificationStatus === 'verified',
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    experience: profile.experience ?? '',
    area: profile.serviceAreaLabel ?? areas[0] ?? '',
    responseMins: profile.responseMins ?? 0,
    rating: summary?.average ?? 0,
    reviewCount: summary?.count ?? 0,
    tone: toneForCategory(primaryCategory?.id),
    categoryIds,
    categories: categoryLabelsFor(database, profile.id),
    areas,
    listings,
  };
}

/**
 * Every active ServMate, in the order they joined.
 *
 * Join order rather than name order, because this is also the roster the
 * workbench offers as a selector and a roster that reshuffles itself whenever a
 * provider renames is disorienting. Profiles that joined in the same moment keep
 * their stored order, which `Array.prototype.sort` guarantees.
 */
export function providerViews(database: Database): ProviderView[] {
  const summaries = reviewSummariesByProfile(database);
  return database.servmateProfiles
    .filter((profile) => profile.providerStatus === 'active')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((profile) => toProviderView(database, profile, summaries.get(profile.id)));
}

/** A single ServMate by profile id, or null when unknown or not active. */
export function providerView(
  database: Database,
  servmateProfileId: string,
): ProviderView | null {
  const profile = database.servmateProfiles.find(
    (candidate) => candidate.id === servmateProfileId && candidate.providerStatus === 'active',
  );
  if (!profile) return null;
  const summaries = reviewSummariesByProfile(database);
  return toProviderView(database, profile, summaries.get(profile.id));
}

/* ------------------------------------------------------------------ *
 * Provider capability (blueprint §3.2, §5.2)
 *
 * One account may be both a customer and a ServMate, so enabling provider
 * capability is a change to the account plus the profile it owns — not a second
 * account. Everything here takes the session-derived user id or profile id; a
 * caller never supplies its own identity.
 * ------------------------------------------------------------------ */

export type ProviderOnboarding = {
  profileId: string;
  /** True when this call created the profile rather than finding one. */
  created: boolean;
};

/**
 * Enables ServMate capability for an account, creating its profile once.
 *
 * The profile starts `unverified` and `active`: a new provider may list and
 * offer, but nothing claims their credentials were checked until a verification
 * process says so (§5.2). Idempotent, so a retry cannot create a second profile.
 */
export async function onboardServMate(userId: string, body: Record<string, unknown> = {}): Promise<ProviderOnboarding> {
  return transact((database) => {
    const user = database.users.find((candidate) => candidate.id === userId);
    if (!user) return { profileId: '', created: false };

    const existing = database.servmateProfiles.find((profile) => profile.userId === userId);
    if (existing) {
      user.isServMate = true;
      const headline = readText(body.headline, 90);
      const bio = readText(body.bio, 600);
      const experience = readText(body.experience, 600);
      if (headline !== undefined) existing.headline = headline;
      if (bio !== undefined) existing.bio = bio;
      if (experience !== undefined) existing.experience = experience;
      existing.updatedAt = new Date().toISOString();
      return { profileId: existing.id, created: false };
    }

    const now = new Date().toISOString();
    const profile: ServMateProfileRecord = {
      id: randomUUID(),
      userId,
      providerStatus: 'active',
      verificationStatus: 'unverified',
      createdAt: now,
      updatedAt: now,
    };
    const headline = readText(body.headline, 90);
    const bio = readText(body.bio, 600);
    const experience = readText(body.experience, 600);
    if (headline !== undefined) profile.headline = headline;
    if (bio !== undefined) profile.bio = bio;
    if (experience !== undefined) profile.experience = experience;

    user.isServMate = true;
    database.servmateProfiles.push(profile);
    return { profileId: profile.id, created: true };
  });
}

function readText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '' || Array.from(trimmed).length > max) return undefined;
  return trimmed;
}

export type SetCategoriesResult =
  | { ok: true; categoryIds: string[] }
  | { ok: false; error: 'not_found' | 'invalid' };

/**
 * Replaces the structured categories a ServMate works in.
 *
 * These are the categories job eligibility is decided by (§6.3), so every id is
 * checked against the registry: a retired or unknown category cannot be claimed,
 * and an empty list is allowed — it simply means no job matches yet.
 */
export async function setServmateCategories(
  servmateProfileId: string,
  categoryIds: string[],
): Promise<SetCategoriesResult> {
  const unique = Array.from(new Set(categoryIds));
  if (unique.some((id) => !getCategoryById(id))) return { ok: false, error: 'invalid' };

  return transact((database) => {
    const profile = database.servmateProfiles.find(
      (candidate) => candidate.id === servmateProfileId,
    );
    if (!profile) return { ok: false as const, error: 'not_found' as const };

    const now = new Date().toISOString();
    database.servmateCategories = database.servmateCategories.filter(
      (row) => row.servmateProfileId !== servmateProfileId,
    );
    for (const categoryId of unique) {
      database.servmateCategories.push({
        servmateProfileId,
        categoryId,
        status: 'active',
        createdAt: now,
      });
    }
    profile.updatedAt = now;
    return { ok: true as const, categoryIds: unique };
  });
}

export type SetCoverageResult =
  | { ok: true; areas: string[] }
  | { ok: false; error: 'not_found' | 'invalid' };

/** Replaces the areas a ServMate covers, from the marketplace's coverage list. */
export async function setServmateCoverage(
  servmateProfileId: string,
  areas: string[],
): Promise<SetCoverageResult> {
  const unique = Array.from(new Set(areas));
  if (unique.some((area) => !isServiceArea(area))) return { ok: false, error: 'invalid' };

  return transact((database) => {
    const profile = database.servmateProfiles.find(
      (candidate) => candidate.id === servmateProfileId,
    );
    if (!profile) return { ok: false as const, error: 'not_found' as const };

    const now = new Date().toISOString();
    database.servmateServiceAreas = database.servmateServiceAreas.filter(
      (row) => row.servmateProfileId !== servmateProfileId,
    );
    for (const areaLabel of unique) {
      database.servmateServiceAreas.push({ servmateProfileId, areaLabel, createdAt: now });
    }
    profile.updatedAt = now;
    return { ok: true as const, areas: unique };
  });
}

/** Everything the provider's own workspace needs, as one read. */
export type ProviderWorkspace = {
  profile: ProviderView;
  categoryIds: string[];
  areas: string[];
};

export async function getProviderWorkspace(
  servmateProfileId: string,
): Promise<ProviderWorkspace | null> {
  return query((database) => {
    const view = providerView(database, servmateProfileId);
    if (!view) return null;
    return {
      profile: view,
      categoryIds: view.categoryIds,
      areas: view.areas,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Async entry points for server components and routes.
 * ------------------------------------------------------------------ */

export async function listProviderViews(): Promise<ProviderView[]> {
  return query((database) => providerViews(database));
}

export async function getProviderView(servmateProfileId: string): Promise<ProviderView | null> {
  return query((database) => providerView(database, servmateProfileId));
}

/**
 * The ServMate profile this account owns, or null when it has none.
 *
 * A page asks this rather than taking a profile id from the URL: the capability
 * belongs to the session, so the profile is found through the account and
 * somebody else's is simply not reachable.
 */
export async function getOwnServmateProfile(
  userId: string,
): Promise<ServMateProfileRecord | null> {
  return query(
    (database) =>
      database.servmateProfiles.find((profile) => profile.userId === userId) ?? null,
  );
}

/** Every published listing across the marketplace, newest first. */
export async function listPublishedListingViews(): Promise<ListingView[]> {
  return query((database) =>
    database.serviceListings
      .filter((listing) => listing.publicationStatus === 'published')
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
      .map(toListingView),
  );
}

/* ------------------------------------------------------------------ *
 * Storefront cards.
 *
 * The builders live in `./feed-data` (pure, and imported by client
 * components); these readers join them to stored rows so a page can be handed
 * finished cards instead of reaching for a global catalog.
 * ------------------------------------------------------------------ */

/**
 * Every published listing as a storefront card, in publication order.
 *
 * A listing whose ServMate profile is missing is skipped rather than rendered
 * with a blank provider: an orphaned row is a data problem, not a card.
 */
export function feedServices(database: Database): FeedService[] {
  const providers = new Map(
    providerViews(database).map((view) => [view.id, providerFrom(view)]),
  );
  return database.serviceListings
    .filter((listing) => listing.publicationStatus === 'published')
    .sort((a, b) => (a.publishedAt ?? a.createdAt).localeCompare(b.publishedAt ?? b.createdAt))
    .flatMap((listing) => {
      const provider = providers.get(listing.servmateProfileId);
      return provider ? [feedServiceFrom(toListingView(listing), provider)] : [];
    });
}

/** One published listing as a card, or undefined when absent or unpublished. */
export function feedService(database: Database, listingId: string): FeedService | undefined {
  return feedServices(database).find((service) => service.id === listingId);
}

export async function listFeedServices(): Promise<FeedService[]> {
  return query((database) => feedServices(database));
}

/**
 * One listing, with everything its own page needs around it.
 *
 * The card shape is deliberately thinner than this: a card carries the six
 * facts a person scans in a grid, and the description — the part that actually
 * sells the work — is only read once someone has opened the listing. So the
 * detail read returns the description beside the card, the ServMate whose
 * profile the page links to, and the alternatives the page offers underneath.
 *
 * The alternatives are chosen by `./related`, which owns that policy on its
 * own: this module reads the catalogue, that one decides which of it is worth
 * recommending.
 */
export type ServiceDetail = {
  service: FeedService;
  /** The listing's own words about the work, as published. */
  description: string;
  provider: ProviderView;
  related: FeedService[];
};

export function serviceDetail(database: Database, listingId: string): ServiceDetail | null {
  const listing = database.serviceListings.find(
    (row) => row.id === listingId && row.publicationStatus === 'published',
  );
  if (!listing) return null;

  const provider = providerView(database, listing.servmateProfileId);
  if (!provider) return null;

  const service = feedServiceFrom(toListingView(listing), providerFrom(provider));
  const related = relatedTo(feedServices(database), service);

  return { service, description: listing.description, provider, related };
}

export async function getServiceDetail(listingId: string): Promise<ServiceDetail | null> {
  return query((database) => serviceDetail(database, listingId));
}

/** Every active ServMate as a card-facing record, by name. */
export async function listProviderCards(): Promise<Provider[]> {
  return (await listProviderViews()).map(providerFrom);
}

/* ---------------------------------------------------------------- *
 * The provider's own write surface (§5.2, §5.4)
 * ---------------------------------------------------------------- */

/** Facts a ServMate can state about themselves, all optional on an edit. */
export type ProfileFacts = {
  headline?: string;
  bio?: string;
  experience?: string;
  serviceAreaLabel?: string;
  responseMins?: number;
};

export type UpdateProfileResult =
  | { ok: true; profileId: string }
  | { ok: false; error: 'not_a_provider' | 'unsupported' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

const HEADLINE_MAX = 90;
const BIO_MAX = 600;
const EXPERIENCE_MAX = 600;
const RESPONSE_MAX = 2880;

/**
 * Updates the caller's own ServMate profile.
 *
 * Every field is validated against the same limits the public page assumes, and
 * a partial edit leaves the untouched fields alone — so a form that only submits
 * the biography cannot blank the headline. The author is the session account: a
 * profile is never addressed by the id in the URL.
 */
export async function updateOwnProfile(
  userId: string,
  body: Record<string, unknown>,
): Promise<UpdateProfileResult> {
  const errors: Record<string, string> = {};
  const facts: ProfileFacts = {};

  if (body.headline !== undefined) {
    const headline = readText(body.headline, HEADLINE_MAX);
    if (body.headline !== '' && headline === undefined) {
      errors.headline = `Keep the headline under ${HEADLINE_MAX} characters.`;
    } else {
      facts.headline = headline;
    }
  }

  if (body.bio !== undefined) {
    const bio = readText(body.bio, BIO_MAX);
    if (body.bio !== '' && bio === undefined) {
      errors.bio = `Keep the description under ${BIO_MAX} characters.`;
    } else {
      facts.bio = bio;
    }
  }

  if (body.experience !== undefined) {
    const experience = readText(body.experience, EXPERIENCE_MAX);
    if (body.experience !== '' && experience === undefined) {
      errors.experience = `Keep the experience under ${EXPERIENCE_MAX} characters.`;
    } else {
      facts.experience = experience;
    }
  }

  if (body.serviceAreaLabel !== undefined) {
    const area = typeof body.serviceAreaLabel === 'string' ? body.serviceAreaLabel.trim() : '';
    if (area === '') facts.serviceAreaLabel = undefined;
    else if (!isServiceArea(area)) errors.serviceAreaLabel = 'Pick a city from the coverage list.';
    else facts.serviceAreaLabel = area;
  }

  if (body.responseMins !== undefined && body.responseMins !== null && body.responseMins !== '') {
    const mins = Number(body.responseMins);
    if (!Number.isSafeInteger(mins) || mins <= 0 || mins > RESPONSE_MAX) {
      errors.responseMins = 'Enter a reply time in whole minutes.';
    } else {
      facts.responseMins = mins;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, error: 'invalid', errors };

  return transact((database) => {
    const profile = database.servmateProfiles.find((row) => row.userId === userId);
    if (!profile) return { ok: false as const, error: 'not_a_provider' as const };

    // Only the keys that were submitted are touched, and a key submitted as an
    // empty string clears the field rather than storing one.
    if ('headline' in facts) profile.headline = facts.headline;
    if ('bio' in facts) profile.bio = facts.bio;
    if ('experience' in facts) profile.experience = facts.experience;
    if ('serviceAreaLabel' in facts) profile.serviceAreaLabel = facts.serviceAreaLabel;
    if ('responseMins' in facts) profile.responseMins = facts.responseMins;
    profile.updatedAt = new Date().toISOString();
    return { ok: true as const, profileId: profile.id };
  });
}

export type ListingFactsInput = {
  title?: unknown;
  description?: unknown;
  categoryId?: unknown;
  pricingModel?: unknown;
  amountCentavos?: unknown;
  serviceAreaLabel?: unknown;
  availability?: unknown;
  terms?: unknown;
};

export type ListingResult =
  | { ok: true; listing: ServiceListingRecord }
  | { ok: false; error: 'not_a_provider' | 'not_found' | 'in_use' }
  | { ok: false; error: 'invalid'; errors: Record<string, string> };

const LISTING_TITLE_MAX = 120;
const LISTING_DESCRIPTION_MAX = 2000;
const LISTING_TERMS_MAX = 600;
const AVAILABILITY_MAX = 60;

/** Validates a listing's facts, folding them onto the stored row on an edit. */
function readListingFacts(
  body: ListingFactsInput,
  base?: ServiceListingRecord,
): { ok: true; facts: Omit<ServiceListingRecord, 'id' | 'servmateProfileId' | 'publicationStatus' | 'currency' | 'createdAt' | 'updatedAt'> } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const title = typeof body.title === 'string' ? body.title.trim() : (base?.title ?? '');
  if (!title) errors.title = 'Give the service a title.';
  else if (Array.from(title).length > LISTING_TITLE_MAX) {
    errors.title = `Keep the title under ${LISTING_TITLE_MAX} characters.`;
  }

  const description =
    typeof body.description === 'string'
      ? body.description.trim()
      : (base?.description ?? '');
  if (!description) errors.description = 'Describe what this service includes.';
  else if (Array.from(description).length > LISTING_DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${LISTING_DESCRIPTION_MAX} characters.`;
  }

  const categoryId =
    typeof body.categoryId === 'string' ? body.categoryId : (base?.categoryId ?? '');
  if (!getCategoryById(categoryId)) errors.categoryId = 'Pick a category from the list.';

  const rawModel = typeof body.pricingModel === 'string' ? body.pricingModel : base?.pricingModel;
  const pricingModel = rawModel === 'fixed' || rawModel === 'quote' ? rawModel : undefined;
  if (!pricingModel) errors.pricingModel = 'Choose a fixed price or ask for a quote.';

  const rawAmount = body.amountCentavos ?? base?.amountCentavos;
  let amountCentavos: number | undefined;
  if (pricingModel === 'fixed') {
    if (typeof rawAmount === 'number' && Number.isSafeInteger(rawAmount) && rawAmount >= 0) {
      amountCentavos = rawAmount;
    } else {
      errors.amountCentavos = 'Enter the price in whole centavos.';
    }
  }

  const areaLabel =
    typeof body.serviceAreaLabel === 'string'
      ? body.serviceAreaLabel.trim()
      : (base?.serviceAreaLabel ?? '');
  if (areaLabel !== '' && !isServiceArea(areaLabel)) {
    errors.serviceAreaLabel = 'Pick an area from the coverage list.';
  }

  const availability =
    typeof body.availability === 'string' ? body.availability.trim() : (base?.availability ?? '');
  if (Array.from(availability).length > AVAILABILITY_MAX) {
    errors.availability = `Keep availability under ${AVAILABILITY_MAX} characters.`;
  }

  const terms = typeof body.terms === 'string' ? body.terms.trim() : (base?.terms ?? '');
  if (Array.from(terms).length > LISTING_TERMS_MAX) {
    errors.terms = `Keep the terms under ${LISTING_TERMS_MAX} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    facts: {
      title,
      description,
      categoryId,
      pricingModel: pricingModel as ServiceListingRecord['pricingModel'],
      ...(amountCentavos === undefined ? {} : { amountCentavos }),
      ...(areaLabel ? { serviceAreaLabel: areaLabel } : {}),
      ...(availability ? { availability } : {}),
      ...(terms ? { terms } : {}),
    },
  };
}

/**
 * Creates a listing for the caller's own profile.
 *
 * It starts as a draft: a listing is what the public storefront shows, so it is
 * published deliberately rather than as a side effect of saving (§5.4).
 */
export async function createListing(
  userId: string,
  body: ListingFactsInput,
): Promise<ListingResult> {
  const validation = readListingFacts(body);
  if (!validation.ok) return { ok: false, error: 'invalid', errors: validation.errors };

  return transact((database) => {
    const profile = database.servmateProfiles.find((row) => row.userId === userId);
    if (!profile) return { ok: false as const, error: 'not_a_provider' as const };

    const now = new Date().toISOString();
    const listing: ServiceListingRecord = {
      id: randomUUID(),
      servmateProfileId: profile.id,
      currency: 'PHP',
      publicationStatus: 'draft',
      createdAt: now,
      updatedAt: now,
      ...validation.facts,
    };
    database.serviceListings.push(listing);
    return { ok: true as const, listing };
  });
}

/**
 * Edits one of the caller's own listings.
 *
 * A price change here reaches future work only: the offer carries its own agreed
 * amount and the booking snapshots it, so nothing that was already agreed is
 * rewritten by this call (§5.4, §16 test 14).
 */
export async function updateListing(
  userId: string,
  listingId: string,
  body: ListingFactsInput,
): Promise<ListingResult> {
  return transact((database) => {
    const profile = database.servmateProfiles.find((row) => row.userId === userId);
    if (!profile) return { ok: false as const, error: 'not_a_provider' as const };

    const listing = database.serviceListings.find((row) => row.id === listingId);
    if (!listing) return { ok: false as const, error: 'not_found' as const };
    if (listing.servmateProfileId !== profile.id) {
      // Somebody else's listing is reported as absent, so this cannot be used to
      // confirm that a listing exists on another profile.
      return { ok: false as const, error: 'not_found' as const };
    }

    const validation = readListingFacts(body, listing);
    if (!validation.ok) {
      return { ok: false as const, error: 'invalid' as const, errors: validation.errors };
    }

    Object.assign(listing, validation.facts);
    listing.updatedAt = new Date().toISOString();
    return { ok: true as const, listing };
  });
}

/**
 * Publishes or withdraws one of the caller's own listings.
 *
 * Withdrawing is not deleting: an unpublished listing keeps its history and can
 * be published again, while disappearing from the storefront immediately.
 */
export async function setListingPublication(
  userId: string,
  listingId: string,
  publish: boolean,
): Promise<ListingResult> {
  return transact((database) => {
    const profile = database.servmateProfiles.find((row) => row.userId === userId);
    if (!profile) return { ok: false as const, error: 'not_a_provider' as const };

    const listing = database.serviceListings.find(
      (row) => row.id === listingId && row.servmateProfileId === profile.id,
    );
    if (!listing) return { ok: false as const, error: 'not_found' as const };

    const now = new Date().toISOString();
    listing.publicationStatus = publish ? 'published' : 'unpublished';
    listing.updatedAt = now;
    if (publish) listing.publishedAt = now;
    return { ok: true as const, listing };
  });
}

/**
 * Deletes one of the caller's own listings.
 *
 * Refused while a live booking still points at it, because deleting the
 * description of work somebody is in the middle of doing removes the record of
 * what was agreed. Finished and cancelled bookings do not block it.
 */
export async function deleteListing(
  userId: string,
  listingId: string,
): Promise<ListingResult> {
  return transact((database) => {
    const profile = database.servmateProfiles.find((row) => row.userId === userId);
    if (!profile) return { ok: false as const, error: 'not_a_provider' as const };

    const listing = database.serviceListings.find(
      (row) => row.id === listingId && row.servmateProfileId === profile.id,
    );
    if (!listing) return { ok: false as const, error: 'not_found' as const };

    const live = database.bookings.some(
      (booking) =>
        booking.serviceId === listingId &&
        booking.status !== 'completed' &&
        booking.status !== 'cancelled',
    );
    if (live) return { ok: false as const, error: 'in_use' as const };

    database.serviceListings = database.serviceListings.filter((row) => row.id !== listingId);
    return { ok: true as const, listing };
  });
}

/** The caller's own listings, drafts included, newest first. */
export async function listOwnListings(userId: string): Promise<ServiceListingRecord[]> {
  return query((database) => {
    const profile = database.servmateProfiles.find((row) => row.userId === userId);
    if (!profile) return [];
    return database.serviceListings
      .filter((row) => row.servmateProfileId === profile.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}
