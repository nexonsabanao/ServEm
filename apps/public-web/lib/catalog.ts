/**
 * The public catalog contract.
 *
 * This module is **pure** and safe to import from a client component: it holds
 * the shape the website renders and the display order of its category filter.
 * Fetching — from the blueprint API when one is configured, or from the local
 * store otherwise — lives in `./catalog-source`, which reaches the datastore and
 * therefore stays on the server.
 *
 * The live contract (`GET /services`) defines only id, title, provider, price
 * and status, so `category` and `area` remain optional and the interface
 * degrades quietly when they are absent.
 */

export type ServiceSummary = {
  id: string;
  title: string;
  providerId: string;
  currency: 'PHP';
  startingPriceCentavos?: number;
  listingStatus: 'published';
  category?: string;
  area?: string;
};

export type Catalog = {
  status: 'live' | 'preview' | 'unavailable';
  items: ServiceSummary[];
  nextCursor?: string | null;
  message?: string;
};

/**
 * Display order for the public landing page's category filter.
 *
 * Deliberately its own order rather than the registry's: the landing page has
 * always led with Home Repair, and reordering a visitor's filter to match an
 * internal table would be a change nobody asked for. Both lists name the same
 * categories, and a name that is not in `./categories` can never appear here.
 */
export const CATEGORY_ORDER: string[] = [
  'Home Repair',
  'Cleaning',
  'Tutoring',
  'Events',
  'Errands',
  'Beauty',
];

/** Wraps store-backed listings in the preview contract the page understands. */
export function previewCatalog(items: ServiceSummary[], message: string): Catalog {
  return { status: 'preview', items, nextCursor: null, message };
}

/** The state a production build shows when no catalog API is configured. */
export function unavailableCatalog(message: string): Catalog {
  return { status: 'unavailable', items: [], nextCursor: null, message };
}
