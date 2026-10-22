import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CancelRequestButton } from '@/app/components/cancel-request-button';
import { WorkOrderRow } from '@/app/components/work-order';
import { getSessionAccount } from '@/lib/auth';
import { OPEN_BOOKING_STATUSES, listBookings, summariseBookings, type Booking } from '@/lib/bookings';
import { isBookingCancellable } from '@/lib/policy';
import { getCatalog } from '@/lib/catalog-source';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ status?: string | string[] }>;

type Filter = 'all' | 'open' | 'cancelled';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'cancelled', label: 'Withdrawn' },
];

export default async function RequestsPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const requested = firstValue(params.status);
  const filter: Filter =
    requested === 'open' || requested === 'cancelled' ? requested : 'all';

  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const [bookings, catalog] = await Promise.all([listBookings(account.id), getCatalog()]);
  const summary = summariseBookings(bookings);
  const listed = new Set(catalog.items.map((item) => item.id));

  const visible = bookings.filter((booking) => {
    if (filter === 'open') return OPEN_BOOKING_STATUSES.includes(booking.status);
    if (filter === 'cancelled') return booking.status === 'cancelled';
    return true;
  });

  const countFor = (value: Filter) =>
    value === 'all' ? summary.total : value === 'open' ? summary.open : summary.cancelled;

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="requests-title">
        <div className="account-section-head">
          <h1 id="requests-title">My requests</h1>
        </div>
      </section>
      {summary.total > 0 && (
        <nav className="ledger-filters" aria-label="Filter requests by state">
          {FILTERS.map((option) => {
            const active = filter === option.value;
            return (
              <Link
                key={option.value}
                href={option.value === 'all' ? '/account/requests' : `/account/requests?status=${option.value}`}
                className="ledger-filter"
                aria-current={active ? 'true' : undefined}
              >
                {option.label}
                <span className="ledger-filter-count">{countFor(option.value)}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {visible.length > 0 ? (
        <ul className="order-list">
          {visible.map((booking) => (
            <WorkOrderRow
              key={booking.id}
              booking={booking}
              action={<RowAction booking={booking} listed={listed.has(booking.serviceId)} />}
            />
          ))}
        </ul>
      ) : (
        <div className="account-empty">
          <span className="account-empty-mark" aria-hidden="true">✳</span>
          {summary.total === 0 ? (
            <>
              <h2>No requests yet</h2>
              <p>Send your first request and it appears here, with a reference to quote.</p>
              <Link className="button button-primary" href="/home">Browse local services</Link>
            </>
          ) : (
            <>
              <h2>Nothing {filter === 'open' ? 'open' : 'withdrawn'}</h2>
              <p>
                {filter === 'open'
                  ? 'Every request you have sent has been withdrawn.'
                  : 'None of your requests have been withdrawn.'}
              </p>
              <Link className="button button-secondary" href="/account/requests">Show all requests</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RowAction({ booking, listed }: { booking: Booking; listed: boolean }) {
  // The service id is what makes these a destination: Home opens that exact
  // listing's booking sheet rather than dropping you in the marketplace.
  const serviceHref = `/home?service=${encodeURIComponent(booking.serviceId)}`;

  if (booking.status === 'cancelled') {
    return listed ? (
      <Link className="quiet-button" href={serviceHref}>
        Book again
      </Link>
    ) : (
      <span className="again-unavailable">No longer listed</span>
    );
  }

  return (
    <span className="order-action-group">
      {listed && (
        <Link className="quiet-button" href={serviceHref}>
          View service
        </Link>
      )}
      {/* Offered only where the server would accept it: the same table that
          decides `cancelBooking` decides whether this button exists. */}
      {isBookingCancellable(booking.status) && (
        <CancelRequestButton bookingId={booking.id} reference={booking.reference} />
      )}
    </span>
  );
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
