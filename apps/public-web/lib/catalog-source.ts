import {
  previewCatalog,
  unavailableCatalog,
  type Catalog,
  type ServiceSummary,
} from './catalog';
import { listFeedServices } from './servmate-profile';

/**
 * Where the public catalog comes from.
 *
 * Two sources, in order of preference:
 *
 * 1. `API_BASE_URL` — the blueprint API (`GET /services`). Used when it is set.
 * 2. The local store's published listings — the same rows the signed-in grid
 *    and the ServMate workbench read, so the two views of the marketplace can
 *    never disagree about what is for sale.
 *
 * With neither — a production build pointed at nothing — the pages show the
 * unavailable state rather than sample listings, which is the honest answer and
 * the rule this project has always applied to the public catalog.
 *
 * Server-only: it reaches the datastore, so `./catalog` holds the pure contract
 * that client components import instead.
 */

export async function getCatalog(cursor?: string | null): Promise<Catalog> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return localCatalog();

  try {
    const url = new URL('services', ensureTrailingSlash(baseUrl));
    url.searchParams.set('limit', '20');
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return unavailableCatalog(
        'The local services catalog is temporarily unavailable. Try again shortly.',
      );
    }

    const payload: unknown = await response.json();
    const page = parseServicePage(payload);
    return { status: 'live', ...page };
  } catch {
    return {
      status: 'unavailable',
      items: [],
      nextCursor: null,
      message: 'The services catalog could not be reached. Check your connection and try again.',
    };
  }
}

/**
 * The local catalog: every published listing, in publication order.
 *
 * Wrapped in the `preview` status so the page keeps its "Design preview" label:
 * these are still sample ServMates in local development, however real the rows
 * behind them are.
 */
async function localCatalog(): Promise<Catalog> {
  const services = await listFeedServices();
  if (services.length === 0) {
    return unavailableCatalog('The local services catalog is not connected yet.');
  }

  const items: ServiceSummary[] = services.map((service) => ({
    id: service.id,
    title: service.title,
    providerId: service.providerId,
    currency: service.currency,
    ...(service.startingPriceCentavos === undefined
      ? {}
      : { startingPriceCentavos: service.startingPriceCentavos }),
    listingStatus: 'published',
    category: service.category,
    area: service.area,
  }));

  return previewCatalog(items, 'Sample listings for the design preview, not live ServMate offers.');
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function parseServicePage(value: unknown): { items: ServiceSummary[]; nextCursor?: string | null } {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length > 50) {
    throw new Error('Invalid catalog response');
  }
  const nextCursor = value.nextCursor;
  if (
    nextCursor !== undefined &&
    nextCursor !== null &&
    (typeof nextCursor !== 'string' || nextCursor.length > 512)
  ) {
    throw new Error('Invalid catalog cursor');
  }

  const items = value.items.map((item): ServiceSummary => {
    if (!isRecord(item)) throw new Error('Invalid service summary');
    const price = item.startingPriceCentavos;
    if (
      typeof item.id !== 'string' ||
      typeof item.title !== 'string' ||
      item.title.length > 160 ||
      typeof item.providerId !== 'string' ||
      item.currency !== 'PHP' ||
      item.listingStatus !== 'published' ||
      (price !== undefined &&
        (typeof price !== 'number' || !Number.isSafeInteger(price) || price < 0))
    ) {
      throw new Error('Invalid service summary');
    }

    return {
      id: item.id,
      title: item.title,
      providerId: item.providerId,
      currency: 'PHP',
      ...(typeof price === 'number' ? { startingPriceCentavos: price } : {}),
      listingStatus: 'published',
    };
  });
  return { items, nextCursor: nextCursor as string | null | undefined };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
