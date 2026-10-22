import type { ListingView, ProviderView } from './servmate-profile';
import {
  CATEGORY_TONE,
  SERVICE_AREAS,
  firstLetter,
  glyphForCategory,
  gradientStyle,
  toneForCategory,
  type Glyph,
  type Gradient,
} from './presentation';

/**
 * The storefront's read model.
 *
 * Two shapes, both **pure**: the builders below take finished views from
 * `./servmate-profile` and produce the objects the cards render. This module is
 * imported by client components, so it deliberately reaches no datastore and
 * imports `./servmate-profile` for types only.
 *
 * The look of a card is derived, never stored: the tone and the glyph come from
 * the listing's category, the rating from that ServMate's published reviews, and
 * the reply time from the provider's stated target. There are no sales counters,
 * struck-through prices or badges, because a marketplace that invents urgency is
 * telling the customer something nobody earned.
 */

export type { Glyph, Gradient };
export { CATEGORY_TONE, SERVICE_AREAS, firstLetter, gradientStyle, toneForCategory };

/** A ServMate as a card or a roster row shows them. */
export type Provider = {
  id: string;
  name: string;
  handle: string;
  verified: boolean;
  /** Thumbnail / avatar tone, derived from the provider's primary category. */
  avatar: Gradient;
  rating: number;
  /** Number of published reviews behind `rating`. */
  reviews: number;
  responseMins: number;
  area: string;
  headline: string;
};

/** A bookable service listing as a work-order ticket. */
export type FeedService = {
  id: string;
  title: string;
  providerId: string;
  /** The provider, resolved, so a card never looks them up from a global map. */
  provider: Provider;
  /** Category display label. */
  category: string;
  categoryId: string;
  area: string;
  currency: 'PHP';
  /** Absent for a quote-only listing; render `formatFromPrice`. */
  startingPriceCentavos?: number;
  rating: number;
  /** Human-readable availability, e.g. `Same day`. */
  availability: string;
  thumbnail: Gradient;
  glyph: Glyph;
};

/** Builds the card-facing provider from a stored profile view. */
export function providerFrom(view: ProviderView): Provider {
  return {
    id: view.id,
    name: view.name,
    handle: view.handle,
    verified: view.verified,
    avatar: view.tone,
    rating: view.rating,
    reviews: view.reviewCount,
    responseMins: view.responseMins,
    area: view.area,
    headline: view.headline,
  };
}

/** Builds the card-facing listing from a stored listing view and its provider. */
export function feedServiceFrom(view: ListingView, provider: Provider): FeedService {
  return {
    id: view.id,
    title: view.title,
    providerId: provider.id,
    provider,
    category: view.categoryName,
    categoryId: view.categoryId,
    area: view.area,
    currency: 'PHP',
    ...(view.amountCentavos === undefined ? {} : { startingPriceCentavos: view.amountCentavos }),
    rating: provider.rating,
    availability: view.availability,
    thumbnail: toneForCategory(view.categoryId),
    glyph: glyphForCategory(view.categoryId),
  };
}

