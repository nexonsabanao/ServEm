export type ServiceCategory =
  | 'Home Repair'
  | 'Cleaning'
  | 'Tutoring'
  | 'Events'
  | 'Errands'
  | 'Beauty';

export type ServiceSummary = {
  id: string;
  title: string;
  providerId: string;
  currency: 'PHP';
  startingPriceCentavos?: number;
  listingStatus: 'published';
  /**
   * Design-preview only. The live catalog contract does not define categories or
   * coverage areas yet, so both stay optional and the interface degrades quietly
   * when they are missing.
   */
  category?: ServiceCategory;
  area?: string;
};

export type Catalog = {
  status: 'live' | 'preview' | 'unavailable';
  items: ServiceSummary[];
  nextCursor?: string | null;
  message?: string;
};

/** Display order for the category rail. Falls back to discovery order for unknown values. */
export const CATEGORY_ORDER: ServiceCategory[] = [
  'Home Repair',
  'Cleaning',
  'Tutoring',
  'Events',
  'Errands',
  'Beauty',
];

const previewServices: ServiceSummary[] = [
  {
    id: 'preview-condo-deep-clean',
    title: 'Deep clean for a 2-bedroom condo',
    providerId: 'preview-provider-1',
    currency: 'PHP',
    startingPriceCentavos: 180000,
    listingStatus: 'published',
    category: 'Cleaning',
    area: 'Bacoor',
  },
  {
    id: 'preview-aircon-service',
    title: 'Aircon cleaning and tune-up at home',
    providerId: 'preview-provider-2',
    currency: 'PHP',
    startingPriceCentavos: 80000,
    listingStatus: 'published',
    category: 'Home Repair',
    area: 'Imus',
  },
  {
    id: 'preview-math-tutor',
    title: 'Weekly math tutoring for Grades 7–10',
    providerId: 'preview-provider-3',
    currency: 'PHP',
    startingPriceCentavos: 60000,
    listingStatus: 'published',
    category: 'Tutoring',
    area: 'Dasmariñas',
  },
  {
    id: 'preview-handyman',
    title: 'Handyman for small fixes around the house',
    providerId: 'preview-provider-4',
    currency: 'PHP',
    listingStatus: 'published',
    category: 'Home Repair',
    area: 'General Trias',
  },
  {
    id: 'preview-event-hair-makeup',
    title: 'On-site hair and makeup for weddings',
    providerId: 'preview-provider-5',
    currency: 'PHP',
    startingPriceCentavos: 350000,
    listingStatus: 'published',
    category: 'Beauty',
    area: 'Tagaytay',
  },
  {
    id: 'preview-furniture-assembly',
    title: 'Furniture assembly and wall mounting',
    providerId: 'preview-provider-6',
    currency: 'PHP',
    startingPriceCentavos: 90000,
    listingStatus: 'published',
    category: 'Home Repair',
    area: 'Bacoor',
  },
  {
    id: 'preview-errand-runner',
    title: 'Errand runner for groceries and bills',
    providerId: 'preview-provider-7',
    currency: 'PHP',
    startingPriceCentavos: 50000,
    listingStatus: 'published',
    category: 'Errands',
    area: 'Imus',
  },
  {
    id: 'preview-event-photo',
    title: 'Event photography for birthdays and reunions',
    providerId: 'preview-provider-8',
    currency: 'PHP',
    listingStatus: 'published',
    category: 'Events',
    area: 'Dasmariñas',
  },
];

export async function getCatalog(cursor?: string | null): Promise<Catalog> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        status: 'preview',
        items: previewServices,
        nextCursor: null,
        message: 'Sample listings for the design preview, not live ServMate offers.',
      };
    }
    return {
      status: 'unavailable',
      items: [],
      nextCursor: null,
      message: 'The local services catalog is not connected yet.',
    };
  }

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
      return {
        status: 'unavailable',
        items: [],
        message: 'The local services catalog is temporarily unavailable. Try again shortly.',
      };
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
