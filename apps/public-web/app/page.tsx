import { Marketplace } from '@/app/components/marketplace';
import { getSessionAccount } from '@/lib/auth';
import { CATEGORY_ORDER, getCatalog } from '@/lib/catalog';
import { authErrorNotice, signedInNotice } from '@/lib/oauth-messages';

type SearchParams = Promise<{
  q?: string | string[];
  pricing?: string | string[];
  sort?: string | string[];
  category?: string | string[];
  auth?: string | string[];
  auth_error?: string | string[];
  service?: string | string[];
  signin?: string | string[];
}>;

export default async function Home({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = firstValue(params.q).slice(0, 120);
  const pricing = firstValue(params.pricing);
  const requestedCategory = firstValue(params.category);
  const [catalog, account] = await Promise.all([getCatalog(), getSessionAccount()]);
  const initialNotice =
    signedInNotice(firstValue(params.auth)) || authErrorNotice(firstValue(params.auth_error));

  return (
    <Marketplace
      catalog={catalog}
      account={account}
      initialQuery={query}
      initialPricing={pricing === 'fixed' || pricing === 'quote' ? pricing : 'all'}
      initialSort={firstValue(params.sort)}
      initialCategory={
        (CATEGORY_ORDER as string[]).includes(requestedCategory) ? requestedCategory : 'all'
      }
      initialNotice={initialNotice}
      initialServiceId={firstValue(params.service)}
      signInIntent={firstValue(params.signin) === '1'}
    />
  );
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
