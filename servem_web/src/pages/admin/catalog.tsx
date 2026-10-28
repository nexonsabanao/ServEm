import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AdminCollectionState,
  filterCollection,
  AdminPage,
  AdminSearch,
  AdminStats,
  AdminTable,
  Checkbox,
  ContextCard,
  FilterRow,
  PaginationFooter,
  RailActions,
} from '../../components/AdminUI';
import { Button, Chip, LinkButton } from '../../components/ui';
import { formatPhilippinePeso } from '../../lib/localization';
import { useAdminCollection } from '../../lib/useAdminCollection';
import { useAdminDecision } from '../../lib/useAdminDecision';
import { useApp } from '../../state/AppState';
import type { BookingAction } from '../../lib/functions';
import type { Booking, BookingStatus, Service } from '../../lib/types';

/** ServEm’s fixed browsing taxonomy. */
const categories = [
  { name: 'Repairs', slug: 'repairs' },
  { name: 'Cleaning', slug: 'cleaning' },
  { name: 'Errands', slug: 'errands' },
  { name: 'Assembly', slug: 'assembly' },
  { name: 'Tech help', slug: 'tech-help' },
  { name: 'Yard & garden', slug: 'yard-garden' },
];

export function AdminCatalogPage() {
  const [query, setQuery] = useState('');
  const services = useAdminCollection<Service>('services');
  return (
    <AdminPage title="Service catalog" subtitle="Listings read live from Firestore">
      <AdminSearch placeholder="Search service or provider" value={query} onChange={setQuery} />
      <FilterRow items={['Category: All', 'State: All', 'Sort: Recently updated']} />
      <AdminCollectionState
        collection={filterCollection(services, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang service listings yet. Listings published by ServMates appear here for moderation.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['Service', 'Provider', 'Category', 'Rate', 'State']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((service) => (
                <tr key={service.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td>
                    <Link
                      to={`/admin/catalog/${service.id}`}
                      className="font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {service.name}
                    </Link>
                  </td>
                  <td>{service.provider}</td>
                  <td>{service.category}</td>
                  <td>{formatPhilippinePeso(service.rate)}/hr</td>
                  <td>
                    <Chip
                      small
                      tone={service.status === 'live' ? 'brand' : service.status === 'paused' ? 'neutral' : 'warn'}
                      className="capitalize"
                    >
                      {service.status === 'live' ? 'Live' : service.status === 'paused' ? 'Paused' : 'In review'}
                    </Chip>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.filter((r) => r.status === 'review').length} of {rows.length} listings are waiting on moderation.
              Rates shown are what the provider set on their listing.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

export function AdminListingModerationPage() {
  const { id } = useParams();
  const services = useAdminCollection<Service>('services');
  const decision = useAdminDecision();

  return (
    <AdminCollectionState collection={services}>
      {(rows) => {
        const service = rows.find((s) => s.id === id);
        if (!service) {
          return <AdminPage title="Listing not found" subtitle={`No document with id ${id} in the services collection`} />;
        }
        return (
          <AdminPage
            title="Listing moderation detail"
            subtitle={`${service.id} · ${service.name}`}
            actions={
              <Chip small tone={service.status === 'live' ? 'brand' : 'warn'} className="capitalize">
                {service.status}
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <div className="flex items-start gap-4">
                    <img src={service.image || undefined} alt="" className="h-20 w-28 rounded-[8px] object-cover" />
                    <div>
                      <p className="text-[15px] font-medium">{service.name}</p>
                      <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                        {service.provider} · {service.category} · {formatPhilippinePeso(service.rate)}/hr ·{' '}
                        {service.minHours}-hour minimum
                      </p>
                      <p className="mt-2 text-[11.5px] text-[var(--color-muted-2)]">{service.area}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-[12.5px] font-medium">Description</h3>
                    <p className="mt-1 text-[12px] leading-[1.7] text-[var(--color-muted)]">{service.description}</p>
                  </div>
                  <div className="mt-4 text-[12px] text-[var(--color-muted)]">
                    <p>
                      Rating {service.rating.toFixed(1)} from {service.reviews} published reviews.
                    </p>
                  </div>
                </section>

                <section className="card mt-4 p-5">
                  <h2 className="text-[14px] font-semibold">Moderation decision</h2>
                  <label className="label mt-3" htmlFor="listing-reason">
                    Reason
                  </label>
                  <textarea
                    id="listing-reason"
                    className="field text-[12.5px]"
                    rows={3}
                    value={decision.reason}
                    onChange={(event) => decision.setReason(event.target.value)}
                    placeholder="Why this listing is approved, changed or paused."
                  />
                  {decision.error ? (
                    <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">
                      {decision.error}
                    </p>
                  ) : null}
                  {decision.message ? (
                    <p className="mt-2 text-[12px] text-[var(--color-brand-deep)]">{decision.message}</p>
                  ) : null}
                </section>
              </div>

              <RailActions title="Actions">
                <Button
                  small
                  block
                  disabled={decision.pending}
                  onClick={() => void decision.submit('listing', service.id, 'live')}
                >
                  {decision.pending ? 'Submitting…' : 'Approve listing'}
                </Button>
                <Button
                  small
                  variant="outline"
                  block
                  disabled={decision.pending}
                  onClick={() => void decision.submit('listing', service.id, 'paused')}
                >
                  Pause listing
                </Button>
                <LinkButton to="/admin/catalog" variant="quiet" small block>
                  Back to catalog
                </LinkButton>
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}

export function AdminCategoriesPage() {
  const services = useAdminCollection<Service>('services');
  const counts = new Map<string, number>();
  for (const service of services.rows) {
    counts.set(service.category, (counts.get(service.category) ?? 0) + 1);
  }

  return (
    <AdminPage title="Category management" subtitle="ServEm browsing taxonomy · live service counts">
      <div className="mt-4">
        <p className="text-[12px] text-[var(--color-muted)]">
          {categories.length} categories · {services.rows.length}{' '}
          {services.rows.length === 1 ? 'listing' : 'listings'} in the catalog
        </p>
      </div>
      <AdminCollectionState
        collection={services}
        empty={<ContextCard title="Queue context & next steps">Publish a service listing to see category counts.</ContextCard>}
      >
        {() => (
          <AdminTable
            headers={['Category', 'Slug', 'Live listings', 'State']}
            footer={<PaginationFooter total={categories.length} />}
          >
            {categories.map((category) => (
              <tr key={category.slug}>
                <td>
                  <Checkbox />
                </td>
                <td className="font-medium">{category.name}</td>
                <td className="text-[var(--color-muted)]">{category.slug}</td>
                <td>{counts.get(category.name) ?? 0}</td>
                <td>
                  <Chip small tone="brand">
                    Live
                  </Chip>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCollectionState>
      <ContextCard title="Queue context & next steps">
        Categories mirror the customer browsing experience. Reordering them is a deployment change to the taxonomy, not
        something this screen writes.
      </ContextCard>
    </AdminPage>
  );
}

export function AdminBookingsPage() {
  const [query, setQuery] = useState('');
  const bookings = useAdminCollection<Booking>('bookings');
  return (
    <AdminPage title="Bookings & jobs" subtitle="All bookings across the marketplace">
      <AdminSearch placeholder="Search booking, customer or ServMate" value={query} onChange={setQuery} />
      <FilterRow items={['State: All', 'Date range: Last 30 days', 'Owner: Any']} />
      <AdminCollectionState
        collection={filterCollection(bookings, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang bookings yet. Every booking created in the app shows up here.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['Booking', 'Customer', 'ServMate', 'Service', 'Scheduled', 'State']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td>
                    <Link
                      to={`/admin/bookings/${booking.id}`}
                      className="font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {booking.id}
                    </Link>
                  </td>
                  <td>{booking.customer}</td>
                  <td>{booking.provider}</td>
                  <td>{booking.service}</td>
                  <td className="text-[var(--color-muted)]">
                    {booking.date}, {booking.time}
                  </td>
                  <td>
                    <Chip
                      small
                      tone={
                        booking.status === 'completed'
                          ? 'brand'
                          : booking.status === 'cancelled'
                            ? 'neutral'
                            : booking.status === 'requested'
                              ? 'warn'
                              : 'info'
                      }
                      className="capitalize"
                    >
                      {booking.status.replace(/_/g, ' ')}
                    </Chip>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.length} bookings in this view · {rows.filter((r) => r.status === 'cancelled').length} cancelled ·{' '}
              {rows.filter((r) => r.status === 'in_progress').length} in progress. Locations are only visible to the
              assigned ServMate after acceptance.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

/** Statuses whose bookings `updateBookingStatus` lets an admin close as completed. */
const COMPLETABLE: BookingStatus[] = ['accepted', 'confirmed', 'in_progress'];
/** Statuses that can still be cancelled through the same callable. */
const CANCELLABLE: BookingStatus[] = ['requested', 'accepted', 'confirmed', 'rescheduled'];

export function AdminBookingOpsPage() {
  const { id } = useParams();
  const bookings = useAdminCollection<Booking>('bookings');
  const { changeBookingStatus } = useApp();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<BookingAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: BookingAction) {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setMessage(null);
      setError('Kailangan ng reason. Write at least 3 characters so the action is auditable.');
      return;
    }
    if (!id) return;
    setPending(action);
    setMessage(null);
    setError(null);
    try {
      await changeBookingStatus(id, action, { reason: trimmed });
      setMessage(`Naitala ang aksyon. The booking now reads “${action}” straight from the server.`);
    } catch (reason_) {
      setError(reason_ instanceof Error ? reason_.message : 'Hindi maisalin ang booking sa kasalukuyang status.');
    } finally {
      setPending(null);
    }
  }

  return (
    <AdminCollectionState collection={bookings}>
      {(rows) => {
        const booking = rows.find((b) => b.id === id);
        if (!booking) {
          return <AdminPage title="Booking not found" subtitle={`No document with id ${id} in the bookings collection`} />;
        }
        return (
          <AdminPage
            title="Booking operations workspace"
            subtitle={`${booking.id} · ${booking.service} · ${booking.customer}`}
            actions={
              <Chip small tone="info" className="capitalize">
                {booking.status.replace(/_/g, ' ')}
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <h2 className="text-[14px] font-semibold">Booking summary</h2>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] max-lg:grid-cols-1">
                    {[
                      ['Service', booking.service],
                      ['Customer', booking.customer],
                      ['ServMate', booking.provider],
                      ['Scheduled', `${booking.date} · ${booking.time}`],
                      ['Hours', `${booking.hours} hours`],
                      ['Location', booking.address],
                    ].map(([label, value]) => (
                      <p key={label} className="text-[var(--color-muted)]">
                        {label} <span className="ml-2 text-[var(--color-ink-2)]">{value}</span>
                      </p>
                    ))}
                  </div>
                </section>

                <section className="card mt-4 p-5">
                  <h2 className="text-[14px] font-semibold">Customer notes</h2>
                  <p className="mt-2 text-[12px] leading-[1.7] text-[var(--color-muted)]">
                    {booking.notes || 'The customer left no notes on this booking.'}
                  </p>
                  <div className="mt-3 rounded-[8px] bg-[#f7faf8] px-3 py-2 text-[11.5px] text-[var(--color-muted)]">
                    The exact address is shared with the assigned ServMate once the job is accepted. Support sees the
                    general area only.
                  </div>
                </section>

                <AdminStats
                  columns={3}
                  items={[
                    { label: 'Customer total', value: formatPhilippinePeso(booking.total), note: 'Stored on the booking' },
                    {
                      label: 'ServMate earnings',
                      value: formatPhilippinePeso(booking.total - booking.fee),
                      note: 'Total minus service fee',
                    },
                    { label: 'Service fee', value: formatPhilippinePeso(booking.fee), note: 'Calculated by the server' },
                  ]}
                />

                <section className="card mt-4 p-5">
                  <h2 className="text-[14px] font-semibold">Status action reason</h2>
                  <label className="label mt-3" htmlFor="booking-action-reason">
                    Reason
                  </label>
                  <textarea
                    id="booking-action-reason"
                    className="field text-[12.5px]"
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Why this booking is being completed or cancelled."
                  />
                  {error ? (
                    <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">
                      {error}
                    </p>
                  ) : null}
                  {message ? (
                    <p className="mt-2 text-[12px] text-[var(--color-brand-deep)]">{message}</p>
                  ) : null}
                </section>

                <ContextCard title="Operations notes">
                  Status changes go through the same callable the customer and ServMate apps use, so this workspace
                  cannot skip the server’s transition rules or rewrite money fields.
                </ContextCard>
              </div>

              <RailActions title="Actions">
                <Button
                  small
                  block
                  disabled={pending !== null || !COMPLETABLE.includes(booking.status)}
                  onClick={() => void run('complete')}
                >
                  {pending === 'complete' ? 'Submitting…' : 'Close as completed'}
                </Button>
                <Button
                  small
                  variant="outline"
                  block
                  disabled={pending !== null || !CANCELLABLE.includes(booking.status)}
                  onClick={() => void run('cancel')}
                >
                  {pending === 'cancel' ? 'Submitting…' : 'Cancel booking'}
                </Button>
                <p className="text-[11.5px] leading-[1.6] text-[var(--color-muted-2)]">
                  Both buttons call `updateBookingStatus`; a booking already finished or blocked stays as it is.
                </p>
                <LinkButton to="/admin/bookings" variant="quiet" small block>
                  Back to bookings
                </LinkButton>
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}

export function AdminCatalogDetailLink() {
  return <LinkButton to="/admin/catalog">Back to catalog</LinkButton>;
}
