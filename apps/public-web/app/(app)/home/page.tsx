import { EcommerceHome } from '@/app/components/feed/ecommerce-home';
import { getSessionPreferences } from '@/lib/auth';
import { listFeedServices } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ServEm — Book local services',
};

type SearchParams = Promise<{ q?: string | string[]; service?: string | string[] }>;

/**
 * The signed-in marketplace home.
 *
 * The frame, the session guard and the request count belong to
 * `app/(app)/layout.tsx`, so this page answers only for its own data: which
 * listings to show and the defaults the storefront opens with.
 */
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstValue(params.q).slice(0, 80);
  const service = firstValue(params.service).slice(0, 80);
  const [preferences, listings] = await Promise.all([getSessionPreferences(), listFeedServices()]);

  return (
    <EcommerceHome
      listings={listings}
      initialQuery={q}
      initialArea={preferences.defaultArea}
      initialSort={preferences.defaultSort}
      initialService={service}
    />
  );
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
