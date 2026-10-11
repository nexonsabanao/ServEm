import { redirect } from 'next/navigation';
import { ServmateWorkbench } from '@/app/components/servmate/servmate-workbench';
import { getSessionAccount } from '@/lib/auth';
import { listBookings } from '@/lib/bookings';
import { formatDayShort, formatPhp, formatReplies, formatTimeOfDay } from '@/lib/format';
import {
  categoryForService,
  defaultServmateId,
  getServmate,
  incomingFor,
  isServmateId,
  servmateRoster,
  servicesFor,
  standingFor,
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
 * It shows the other side of the same sample data the storefront uses: the
 * listings a ServMate offers and the requests aimed at them, with the decision
 * affordances a provider needs. Which account may act as a ServMate is still an
 * open blueprint decision, so `?as=` previews a roster entry instead of
 * claiming the signed-in account owns one, and the queue is drawn from this
 * account's own requests rather than another customer's.
 */
export default async function ServmatePage({ searchParams }: { searchParams: SearchParams }) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const params = await searchParams;
  const requested = firstValue(params.as);
  const bookings = await listBookings(account.id);
  const roster = servmateRoster();
  const providerId = isServmateId(requested) ? requested : defaultServmateId(bookings);
  const provider = getServmate(providerId);

  if (!provider) redirect('/home');

  const incoming = incomingFor(providerId, bookings);
  const standing = standingFor(providerId, bookings);
  const repliesLabel = formatReplies(provider.responseMins);

  const data: WorkbenchData = {
    provider,
    roster: roster.map(({ id, name, area, verified }) => ({ id, name, area, verified })),
    requests: incoming.map((booking) => ({
      id: booking.id,
      reference: booking.reference,
      serviceTitle: booking.serviceTitle,
      category: categoryForService(booking.serviceId),
      ...(booking.area ? { area: booking.area } : {}),
      message: booking.message,
      status: booking.status,
      receivedLabel: `${formatDayShort(booking.createdAt)} · ${formatTimeOfDay(booking.createdAt)}`,
    })),
    listings: servicesFor(providerId).map((service) => ({
      id: service.id,
      title: service.title,
      category: service.category,
      area: service.area,
      fromLabel: formatPhp(service.startingPriceCentavos),
      turnaround: service.turnaround,
      repliesLabel,
    })),
    standing: {
      waitingLabel: String(standing.waiting),
      listingsLabel: String(standing.liveListings),
      fromLabel: standing.fromCentavos === undefined ? '—' : formatPhp(standing.fromCentavos),
      repliesLabel,
    },
  };

  return <ServmateWorkbench data={data} accountName={account.name} />;
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
