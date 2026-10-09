import { Marketplace } from '@/app/components/marketplace';
import { getCatalog } from '@/lib/catalog';

type SearchParams = Promise<{
  q?: string | string[];
  pricing?: string | string[];
  sort?: string | string[];
}>;

export default async function Home({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = firstValue(params.q).slice(0, 120);
  const pricing = firstValue(params.pricing);
  const catalog = await getCatalog();

  return (
    <Marketplace
      catalog={catalog}
      initialQuery={query}
      initialPricing={pricing === 'fixed' || pricing === 'quote' ? pricing : 'all'}
      initialSort={firstValue(params.sort)}
    />
  );
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
