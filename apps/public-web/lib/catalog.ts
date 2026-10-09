export type ServiceSummary = {
  id: string;
  title: string;
  providerId: string;
  currency: 'PHP';
  startingPriceCentavos?: number;
  listingStatus: 'published';
};

export type Catalog = {
  status: 'live' | 'preview' | 'unavailable';
  items: ServiceSummary[];
  nextCursor?: string | null;
  message?: string;
};

const previewServices: ServiceSummary[] = [
  {
    id: 'preview-brand-kit',
    title: 'A clear brand identity for your next chapter',
    providerId: 'preview-provider-1',
    currency: 'PHP',
    startingPriceCentavos: 450000,
    listingStatus: 'published',
  },
  {
    id: 'preview-web-page',
    title: 'A thoughtful landing page built around your story',
    providerId: 'preview-provider-2',
    currency: 'PHP',
    startingPriceCentavos: 850000,
    listingStatus: 'published',
  },
  {
    id: 'preview-copywriting',
    title: 'Website copy that sounds like you',
    providerId: 'preview-provider-3',
    currency: 'PHP',
    listingStatus: 'published',
  },
  {
    id: 'preview-video-edit',
    title: 'Short-form video editing for your next campaign',
    providerId: 'preview-provider-4',
    currency: 'PHP',
    startingPriceCentavos: 250000,
    listingStatus: 'published',
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
        message: 'Sample listings for the design preview. No booking request can be sent.',
      };
    }
    return {
      status: 'unavailable',
      items: [],
      nextCursor: null,
      message: 'The services catalog is not connected yet.',
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
        message: 'The services catalog is temporarily unavailable. Try again shortly.',
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
      message: 'We could not reach the services catalog. Check your connection and try again.',
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
  if (nextCursor !== undefined && nextCursor !== null && (typeof nextCursor !== 'string' || nextCursor.length > 512)) {
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
