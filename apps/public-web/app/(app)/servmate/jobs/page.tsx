import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProviderWorkActions } from '@/app/components/servmate/provider-work-actions';
import { ServmateSetup } from '@/app/components/servmate/servmate-setup';
import { WithdrawOfferButton } from '@/app/components/servmate/withdraw-offer-button';
import { getSessionAccount } from '@/lib/auth';
import { listServmateBookings } from '@/lib/bookings';
import { listCategories } from '@/lib/categories';
import { formatDayShort, formatPhp, formatTimeOfDay } from '@/lib/format';
import { listAvailableJobs, type DiscoveryFilters } from '@/lib/matching';
import { listOwnOffers } from '@/lib/offers';
import { BOOKING_STATUS_LABELS, OFFER_STATUS_LABELS } from '@/lib/presentation';
import { getOwnServmateProfile } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Jobs for you — ServEm',
};

type SearchParams = Promise<{ category?: string; city?: string; budgetMax?: string }>;

/**
 * The ServMate's private feed.
 *
 * Everything here is the answer to one question — what work could this account
 * actually take? The feed is the discovery rule itself, so a job only appears
 * when the structured categories, the coverage areas and the schedule all line
 * up and nobody has blocked anybody. Before that is true, this page is where an
 * account becomes a ServMate at all.
 */
export default async function ServmateJobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const profile = await getOwnServmateProfile(account.id);
  const categories = listCategories().map((category) => ({
    id: category.id,
    name: category.name,
  }));

  if (!profile) {
    return (
      <div className="account-page">
        <section className="account-section" aria-labelledby="setup-title">
          <div className="account-section-head">
            <div>
              <h1 id="setup-title">Work as a ServMate</h1>
              <p className="account-section-lede">
                One account can be both a customer and a ServMate. Tell us what work you take
                and which areas you cover — those are the exact things job matching decides on.
              </p>
            </div>
            <Link className="quiet-button" href="/servmate">
              Back to the workbench
            </Link>
          </div>
          <ServmateSetup categories={categories} />
        </section>
      </div>
    );
  }

  const params = await searchParams;
  const filters: DiscoveryFilters = {};
  if (params.category) filters.categoryId = params.category;
  if (params.city) filters.city = params.city;
  const budgetMax = params.budgetMax ? Number(params.budgetMax) : undefined;
  if (budgetMax !== undefined && Number.isSafeInteger(budgetMax)) {
    filters.budgetMaxCentavos = budgetMax;
  }

  const [jobs, ownOffers, work] = await Promise.all([
    listAvailableJobs({ userId: account.id, filters }),
    listOwnOffers(profile.id),
    listServmateBookings(account.id),
  ]);

  const offerByJob = new Map<string, (typeof ownOffers)[number]>();
  for (const offer of ownOffers) {
    const current = offerByJob.get(offer.jobPostId);
    if (!current || offer.createdAt > current.createdAt) offerByJob.set(offer.jobPostId, offer);
  }

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="feed-title">
        <div className="account-section-head">
          <div>
            <h1 id="feed-title">Jobs for you</h1>
            <p className="account-section-lede">
              Only jobs your categories, areas and schedule already match. Their exact addresses
              stay hidden until you have been booked — or until you open one.
            </p>
          </div>
          <div className="job-head-actions">
            <Link className="quiet-button" href="/servmate/profile">
              Your profile and listings
            </Link>
            <Link className="quiet-button" href="/servmate">
              Workbench
            </Link>
          </div>
        </div>

        <nav className="ledger-filters" aria-label="Filter jobs">
          <Link
            href="/servmate/jobs"
            className="ledger-filter"
            aria-current={!filters.categoryId && !filters.city ? 'true' : undefined}
          >
            All matching
            <span className="ledger-filter-count">{jobs.length}</span>
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/servmate/jobs?category=${category.id}`}
              className="ledger-filter"
              aria-current={filters.categoryId === category.id ? 'true' : undefined}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </section>

      {jobs.length > 0 ? (
        <ul className="order-list">
          {jobs.map((job) => {
            const mine = offerByJob.get(job.id);
            const category = categories.find((entry) => entry.id === job.categoryId);
            return (
              <li key={job.id} className="order-row">
                <div className="order-when">
                  <strong>{formatDayShort(job.publishedAt)}</strong>
                  <span>{job.scheduleFlexible ? 'Flexible' : 'Fixed time'}</span>
                </div>
                <div className="order-what">
                  <span className="order-ref">{category?.name ?? 'Job'}</span>
                  <h3>
                    <Link className="order-title-link" href={`/servmate/jobs/${job.id}`}>
                      {job.title}
                    </Link>
                  </h3>
                  <p className="order-brief">{job.description}</p>
                  <span className="order-area">
                    {job.locationCity} · customer&apos;s budget {formatPhp(job.budgetCentavos)}
                  </span>
                </div>
                <div className="order-state">
                  {mine ? (
                    <span className="status-stamp" data-status={mine.offerStatus}>
                      <span className="status-dot" aria-hidden="true" />
                      {OFFER_STATUS_LABELS[mine.offerStatus]}
                    </span>
                  ) : (
                    <span className="status-stamp" data-status="open">
                      <span className="status-dot" aria-hidden="true" />
                      Open to offers
                    </span>
                  )}
                </div>
                <div className="order-actions">
                  <Link className="quiet-button" href={`/servmate/jobs/${job.id}`}>
                    {mine ? 'Your offer' : 'Look and offer'}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="account-empty">
          <span className="account-empty-mark" aria-hidden="true">
            ✳
          </span>
          <h3>Nothing matches right now</h3>
          <p>
            A job appears here the moment a customer posts one your categories and areas fit.
            Widen your coverage or add a category to see more.
          </p>
        </div>
      )}

      <section className="account-section" aria-labelledby="offers-title">
        <div className="account-section-head">
          <h3 id="offers-title">Your offers</h3>
        </div>
        {ownOffers.length > 0 ? (
          <ul className="offer-list">
            {ownOffers.slice(0, 10).map((offer) => (
              <li key={offer.id} className="offer-card" data-status={offer.offerStatus}>
                <div className="offer-head">
                  <div>
                    <span className="offer-provider">{formatPhp(offer.amountCentavos)}</span>
                    <span className="offer-standing">
                      Made {formatDayShort(offer.createdAt)} · {formatTimeOfDay(offer.createdAt)}
                    </span>
                  </div>
                  <span className="status-stamp" data-status={offer.offerStatus}>
                    <span className="status-dot" aria-hidden="true" />
                    {OFFER_STATUS_LABELS[offer.offerStatus]}
                  </span>
                </div>
                {offer.scopeDescription && <p className="offer-scope">{offer.scopeDescription}</p>}
                <div className="offer-foot">
                  <Link className="quiet-button" href={`/servmate/jobs/${offer.jobPostId}`}>
                    Open the job
                  </Link>
                  {offer.offerStatus === 'pending' && <WithdrawOfferButton offerId={offer.id} />}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="account-empty">
            <span className="account-empty-mark" aria-hidden="true">
              ✳
            </span>
            <h3>No offers on the table</h3>
            <p>Pick a job above and send your price. It stays yours to change until it is accepted.</p>
          </div>
        )}
      </section>

      <section className="account-section" aria-labelledby="work-title">
        <div className="account-section-head">
          <h3 id="work-title">Booked work</h3>
        </div>
        {work.length > 0 ? (
          <ul className="order-list">
            {work.map((booking) => (
              <li key={booking.id} className="order-row" data-status={booking.status}>
                <div className="order-when">
                  <strong>{formatDayShort(booking.createdAt)}</strong>
                  <span>{booking.reference}</span>
                </div>
                <div className="order-what">
                  <h3>{booking.serviceTitle}</h3>
                  {booking.area && <span className="order-area">{booking.area}</span>}
                </div>
                <div className="order-state">
                  <span className="status-stamp" data-status={booking.status}>
                    <span className="status-dot" aria-hidden="true" />
                    {booking.status === 'completion_pending'
                      ? 'Waiting on the customer'
                      : BOOKING_STATUS_LABELS[booking.status]}
                  </span>
                </div>
                <div className="order-actions">
                  <ProviderWorkActions
                    bookingId={booking.id}
                    status={booking.status}
                    title={booking.serviceTitle}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="account-empty">
            <span className="account-empty-mark" aria-hidden="true">
              ✳
            </span>
            <h3>Nothing booked yet</h3>
            <p>
              When a customer accepts one of your offers, the job becomes a work order here with
              its reference and the agreed price.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
