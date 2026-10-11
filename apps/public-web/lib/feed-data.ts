/**
 * Design-preview content for the signed-in marketplace.
 *
 * Synthetic sample data, exactly like the preview catalog in `./catalog`: it
 * gives the Shopee-style home something real to render in local development
 * without the blueprint API. Nothing here is a live ServMate, a real price, or
 * a real review. Bookings created from these cards still go through the normal
 * `POST /api/bookings` flow and persist.
 *
 * Colour: every visual is built only from the project theme — off-white,
 * ink #4a4a4a, mist #cbcbcb and slate #6d8196 (plus tints/shades of that
 * slate for depth). No off-brand hues, no placeholder image URLs.
 */

export type Gradient = {
  /** Two-stop linear gradient used as a thumbnail / avatar background. */
  from: string;
  to: string;
  /** Optional angle in degrees for the gradient. */
  angle?: number;
};

export type Provider = {
  id: string;
  name: string;
  handle: string;
  verified: boolean;
  avatar: Gradient;
  rating: number;
  reviews: number;
  responseMins: number;
  area: string;
  headline: string;
};

export type FeedService = {
  id: string;
  title: string;
  providerId: string;
  category: string;
  area: string;
  currency: 'PHP';
  startingPriceCentavos: number;
  /** Original price before discount, when the card shows a markdown. */
  compareAtCentavos?: number;
  rating: number;
  sold: number;
  turnaround: string;
  thumbnail: Gradient;
  /** A short glyph drawn on the thumbnail so it is not a bare gradient. */
  glyph: 'sparkle' | 'wrench' | 'book' | 'camera' | 'scissors' | 'box';
  badge?: 'Mall' | 'Preferred' | 'Fast reply' | 'New';
  freebies?: string;
};

const g = (from: string, to: string, angle = 135): Gradient => ({ from, to, angle });

/**
 * One slate tone per category, shared by the category tiles, the service
 * thumbnails and the provider avatars so the whole grid stays monochrome and
 * on-theme while each category remains distinguishable. All are shades of the
 * slate #6d8196 → ink #4a4a4a family.
 */
export const CATEGORY_TONE: Record<string, Gradient> = {
  Cleaning: g('#8a9cad', '#6b8098'),
  'Home Repair': g('#6d8196', '#4f657f'),
  Tutoring: g('#5b6e83', '#3f5266'),
  Events: g('#52667b', '#36485a'),
  Errands: g('#7688a0', '#576b83'),
  Beauty: g('#63758a', '#44576b'),
};

export const providers: Provider[] = [
  {
    id: 'prov-rosa',
    name: 'Rosa Cleaning Co.',
    handle: '@rosaclean',
    verified: true,
    avatar: CATEGORY_TONE.Cleaning,
    rating: 4.9,
    reviews: 1284,
    responseMins: 5,
    area: 'Bacoor',
    headline: 'Eco deep-cleaning for condos & townhouses',
  },
  {
    id: 'prov-aircon',
    name: 'CoolBreeze Aircon',
    handle: '@coolbreeze',
    verified: true,
    avatar: CATEGORY_TONE['Home Repair'],
    rating: 4.8,
    reviews: 963,
    responseMins: 8,
    area: 'Imus',
    headline: 'Same-day aircon cleaning & freon top-up',
  },
  {
    id: 'prov-tutor',
    name: 'Kuya Jules Tutorials',
    handle: '@kjules',
    verified: false,
    avatar: CATEGORY_TONE.Tutoring,
    rating: 4.9,
    reviews: 512,
    responseMins: 12,
    area: 'Dasmariñas',
    headline: 'Math & science tutor, Grades 7–12',
  },
  {
    id: 'prov-fixit',
    name: 'FixIt Handyman',
    handle: '@fixit.ph',
    verified: true,
    avatar: CATEGORY_TONE['Home Repair'],
    rating: 4.7,
    reviews: 2210,
    responseMins: 6,
    area: 'General Trias',
    headline: 'Small repairs, mounting & furniture assembly',
  },
  {
    id: 'prov-glow',
    name: 'Glow by Mika',
    handle: '@glowbymika',
    verified: true,
    avatar: CATEGORY_TONE.Beauty,
    rating: 5.0,
    reviews: 738,
    responseMins: 15,
    area: 'Tagaytay',
    headline: 'On-site hair & makeup for weddings and events',
  },
  {
    id: 'prov-errand',
    name: 'Sundo Errands',
    handle: '@sundo',
    verified: false,
    avatar: CATEGORY_TONE.Errands,
    rating: 4.6,
    reviews: 421,
    responseMins: 3,
    area: 'Imus',
    headline: 'Grocery runs, bill payments & pickups',
  },
  {
    id: 'prov-lens',
    name: 'Lens & Light Studio',
    handle: '@lenslight',
    verified: true,
    avatar: CATEGORY_TONE.Events,
    rating: 4.9,
    reviews: 355,
    responseMins: 20,
    area: 'Dasmariñas',
    headline: 'Birthday, debut & reunion photography',
  },
];

export const feedServices: FeedService[] = [
  {
    id: 'preview-condo-deep-clean',
    title: 'Deep clean · 2-bedroom condo (team of 2)',
    providerId: 'prov-rosa',
    category: 'Cleaning',
    area: 'Bacoor',
    currency: 'PHP',
    startingPriceCentavos: 180000,
    compareAtCentavos: 240000,
    rating: 4.9,
    sold: 3120,
    turnaround: 'Same day',
    thumbnail: CATEGORY_TONE.Cleaning,
    glyph: 'sparkle',
    badge: 'Mall',
    freebies: 'Free fridge wipe-down',
  },
  {
    id: 'preview-aircon-service',
    title: 'Aircon cleaning & tune-up at home',
    providerId: 'prov-aircon',
    category: 'Home Repair',
    area: 'Imus',
    currency: 'PHP',
    startingPriceCentavos: 80000,
    compareAtCentavos: 100000,
    rating: 4.8,
    sold: 5480,
    turnaround: '2 hours',
    thumbnail: CATEGORY_TONE['Home Repair'],
    glyph: 'wrench',
    badge: 'Fast reply',
  },
  {
    id: 'preview-math-tutor',
    title: 'Weekly math tutoring · Grades 7–10',
    providerId: 'prov-tutor',
    category: 'Tutoring',
    area: 'Dasmariñas',
    currency: 'PHP',
    startingPriceCentavos: 60000,
    rating: 4.9,
    sold: 890,
    turnaround: 'Weekly',
    thumbnail: CATEGORY_TONE.Tutoring,
    glyph: 'book',
    badge: 'Preferred',
  },
  {
    id: 'preview-handyman',
    title: 'Handyman visit · small fixes around the house',
    providerId: 'prov-fixit',
    category: 'Home Repair',
    area: 'General Trias',
    currency: 'PHP',
    startingPriceCentavos: 70000,
    rating: 4.7,
    sold: 7310,
    turnaround: '1 day',
    thumbnail: CATEGORY_TONE['Home Repair'],
    glyph: 'wrench',
    freebies: 'First 30 mins free',
  },
  {
    id: 'preview-event-hair-makeup',
    title: 'On-site hair & makeup · bridal package',
    providerId: 'prov-glow',
    category: 'Beauty',
    area: 'Tagaytay',
    currency: 'PHP',
    startingPriceCentavos: 350000,
    compareAtCentavos: 450000,
    rating: 5.0,
    sold: 640,
    turnaround: 'By schedule',
    thumbnail: CATEGORY_TONE.Beauty,
    glyph: 'scissors',
    badge: 'Mall',
  },
  {
    id: 'preview-errand-runner',
    title: 'Errand runner · groceries, bills & pickups',
    providerId: 'prov-errand',
    category: 'Errands',
    area: 'Imus',
    currency: 'PHP',
    startingPriceCentavos: 50000,
    rating: 4.6,
    sold: 2050,
    turnaround: '2 hours',
    thumbnail: CATEGORY_TONE.Errands,
    glyph: 'box',
    badge: 'Fast reply',
  },
  {
    id: 'preview-event-photo',
    title: 'Event photography · birthdays & reunions',
    providerId: 'prov-lens',
    category: 'Events',
    area: 'Dasmariñas',
    currency: 'PHP',
    startingPriceCentavos: 120000,
    rating: 4.9,
    sold: 470,
    turnaround: '3 days',
    thumbnail: CATEGORY_TONE.Events,
    glyph: 'camera',
    badge: 'New',
  },
];

/**
 * Every area a listed ServMate covers, in the order they first appear. Shared
 * by the storefront's area filter and the account's default-area preference so
 * the two can never offer different choices.
 */
export const SERVICE_AREAS: string[] = Array.from(
  new Set(feedServices.map((service) => service.area)),
);

/** Quick lookup helpers used across the feed components. */
export const providerById = new Map(providers.map((p) => [p.id, p]));
export const serviceById = new Map(feedServices.map((s) => [s.id, s]));

export function gradientStyle(gradient: Gradient): { backgroundImage: string } {
  return {
    backgroundImage: `linear-gradient(${gradient.angle ?? 135}deg, ${gradient.from}, ${gradient.to})`,
  };
}

export function firstLetter(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : 'S';
}

