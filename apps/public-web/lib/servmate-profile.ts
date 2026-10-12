import { getCategoryById, listCategories } from './categories';
import {
  feedServiceFrom,
  providerFrom,
  type FeedService,
  type Provider,
} from './feed-data';
import { reviewSummariesByProfile, type ReviewSummary } from './reviews';
import { query, type Database, type ServiceListingRecord, type ServMateProfileRecord } from './store';
import { toneForCategory, type Gradient } from './presentation';

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
 * Async entry points for server components and routes.
 * ------------------------------------------------------------------ */

export async function listProviderViews(): Promise<ProviderView[]> {
  return query((database) => providerViews(database));
}

export async function getProviderView(servmateProfileId: string): Promise<ProviderView | null> {
  return query((database) => providerView(database, servmateProfileId));
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

/** The card-facing provider record for one ServMate. */
export async function getProviderCard(servmateProfileId: string): Promise<Provider | null> {
  const view = await getProviderView(servmateProfileId);
  return view ? providerFrom(view) : null;
}

/** Every active ServMate as a card-facing record, by name. */
export async function listProviderCards(): Promise<Provider[]> {
  return (await listProviderViews()).map(providerFrom);
}
