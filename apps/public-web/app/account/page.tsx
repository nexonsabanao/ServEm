import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WorkDocket } from '@/app/components/work-order';
import { getSessionProfile } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';
import { getCatalog } from '@/lib/catalog-source';
import { formatDay, formatDayShort, formatRate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AccountOverview() {
  const account = await getSessionProfile();
  if (!account) redirect('/?signin=1');

  const [bookings, catalog] = await Promise.all([listBookings(account.id), getCatalog()]);
  const summary = summariseBookings(bookings);
  const open = bookings.find((booking) => booking.status === 'requested') ?? null;
  const available = new Map(catalog.items.map((item) => [item.id, item]));

  const nextToBook = catalog.items
    .filter((item) => !bookings.some((booking) => booking.serviceId === item.id))
    .slice(0, 3);

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="current-title">
        <div className="account-section-head">
          <h2 id="current-title">Current work order</h2>
          {open && <span className="account-section-note">Sent {formatDay(open.createdAt)}</span>}
          {open && (
            <Link className="account-section-link" href={`/account/messages/${open.id}`}>
              Message ServMate <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
        <WorkDocket booking={open} rateCentavos={open ? available.get(open.serviceId)?.startingPriceCentavos : undefined} />
      </section>

      <section className="ledger-strip" aria-label="Request summary">
        <dl>
          <div>
            <dt>Open</dt>
            <dd>{summary.open}</dd>
          </div>
          <div>
            <dt>Withdrawn</dt>
            <dd>{summary.cancelled}</dd>
          </div>
          <div>
            <dt>Sent</dt>
            <dd>{summary.total}</dd>
          </div>
          <div>
            <dt>Areas</dt>
            <dd className="ledger-text">
              {summary.areas.length > 0 ? summary.areas.join(' · ') : 'None yet'}
            </dd>
          </div>
        </dl>
      </section>

      {bookings.length > 0 && (
        <section className="account-section" aria-labelledby="again-title">
          <div className="account-section-head">
            <h2 id="again-title">Book again</h2>
            <Link className="account-section-link" href="/account/requests">
              All requests <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <ul className="again-list">
            {bookings.slice(0, 3).map((booking) => {
              const service = available.get(booking.serviceId);
              return (
                <li key={booking.id}>
                  <span className="again-date">{formatDayShort(booking.createdAt)}</span>
                  <span className="again-title">{booking.serviceTitle}</span>
                  {booking.area && <span className="again-area">{booking.area}</span>}
                  {service ? (
                    <Link className="quiet-button" href="/home">
                      Book again
                    </Link>
                  ) : (
                    <span className="again-unavailable">No longer listed</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {nextToBook.length > 0 && (
        <section className="account-section" aria-labelledby="next-title">
          <div className="account-section-head">
            <h2 id="next-title">Book next</h2>
            {catalog.status === 'preview' && <span className="preview-tag">Design preview</span>}
          </div>
          <p className="account-section-lede">Services you have not booked yet.</p>
          <div className="account-grid">
            {nextToBook.map((service) => (
              <article className="account-card" key={service.id}>
                <span className="account-card-category">{service.category ?? 'Service'}</span>
                <h3>{service.title}</h3>
                <p className="account-card-price">
                  {formatRate(service.startingPriceCentavos)}
                  {service.area && <span className="account-card-area">{service.area}</span>}
                </p>
                <Link className="button button-secondary" href="/home">
                  Book this
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
