import { redirect } from 'next/navigation';
import { ServmateWorkbench } from '@/app/components/servmate/servmate-workbench';
import { getSessionAccount } from '@/lib/auth';
import { listBookings } from '@/lib/bookings';
import { formatDayShort, formatFromPrice, formatReplies, formatTimeOfDay } from '@/lib/format';
import { listFeedServices, listProviderCards } from '@/lib/servmate-profile';
import {
  categoryForListing,
  defaultProviderId,
  incomingFor,
  listingsFor,
  providerChoices,
  standingFor,
  waitingCount,
  type WorkbenchData,
} from '@/lib/servmate';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ServMate workbench — ServEm',
};

type SearchParams = Promise<{ as?: string | string[] }>;

/**
 * The ServMate (provider) workbench.
 *
 * It shows the other side of the same stored listings the storefront renders —
 * the listings a ServMate offers and the requests aimed at them, with the
 * decision affordances a provider needs. `?as=` previews a roster entry rather
 * than claiming the signed-in account owns one, and the queue is drawn from this
 * account's own requests rather than another customer's.
 */
export default async function ServmatePage({ searchParams }: { searchParams: SearchParams }) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const params = await searchParams;
  const requested = firstValue(params.as);
  const [bookings, listings, providers] = await Promise.all([
    listBookings(account.id),
    listFeedServices(),
    listProviderCards(),
  ]);

  const providerId = providers.some((provider) => provider.id === requested)
    ? requested
    : defaultProviderId(providers, listings, bookings);
  const provider = providers.find((candidate) => candidate.id === providerId);

  if (!provider) redirect('/home');

  const own = listingsFor(providerId, listings);
  const incoming = incomingFor(providerId, listings, bookings);
  const standing = standingFor(provider, own, waitingCount(listings, bookings));
  const repliesLabel = formatReplies(provider.responseMins);

  const data: WorkbenchData = {
    provider,
    roster: providerChoices(providers),
    requests: incoming.map((booking) => ({
      id: booking.id,
      reference: booking.reference,
      serviceTitle: booking.serviceTitle,
      category: categoryForListing(booking.serviceId, listings),
      ...(booking.area ? { area: booking.area } : {}),
      message: booking.message,
      status: booking.status,
      receivedLabel: `${formatDayShort(booking.createdAt)} · ${formatTimeOfDay(booking.createdAt)}`,
    })),
    listings: own.map((listing) => ({
      id: listing.id,
      title: listing.title,
      category: listing.category,
      area: listing.area,
      fromLabel: formatFromPrice(listing.startingPriceCentavos),
      availability: listing.availability,
      repliesLabel,
    })),
    standing: {
      waitingLabel: String(standing.waiting),
      listingsLabel: String(standing.liveListings),
      fromLabel:
        standing.fromCentavos === undefined ? '—' : formatFromPrice(standing.fromCentavos),
      repliesLabel,
    },
  };

  return <ServmateWorkbench data={data} accountName={account.name} />;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
