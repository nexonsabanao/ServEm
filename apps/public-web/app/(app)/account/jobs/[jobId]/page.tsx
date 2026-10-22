import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ConfirmCompletionButton } from '@/app/components/jobs/confirm-completion-button';
import { DisputeControls } from '@/app/components/jobs/dispute-controls';
import { JobActions } from '@/app/components/jobs/job-actions';
import { JobMediaManager } from '@/app/components/jobs/job-media-manager';
import { OfferActions } from '@/app/components/jobs/offer-actions';
import { ReviewForm } from '@/app/components/jobs/review-form';
import { getSessionAccount } from '@/lib/auth';
import { getBookingForJob } from '@/lib/bookings';
import { getCategoryById } from '@/lib/categories';
import { formatDay, formatPhp, formatTimeOfDay } from '@/lib/format';
import { getCustomerJob } from '@/lib/jobs';
import { MAX_JOB_MEDIA, listJobMedia } from '@/lib/media';
import { EDITABLE_JOB_STATUSES } from '@/lib/policy';
import { listOffersForJob } from '@/lib/offers';
import {
  BOOKING_STATUS_LABELS,
  JOB_STATUS_LABELS,
  OFFER_STATUS_LABELS,
} from '@/lib/presentation';
import { canReview } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

type Params = Promise<{ jobId: string }>;
type Search = Promise<{ media?: string }>;

/**
 * One of the customer's jobs, with its media and the offers on it.
 *
 * This is the comparison view the private marketplace exists for: every offer,
 * cheapest first, each with the ServMate behind it, and the one decision that
 * closes it — accept, which books at that price and withdraws the rest. The
 * media section belongs to the owner alone; a matching ServMate sees the same
 * files read-only on their own job page.
 */
export default async function JobPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const { jobId } = await params;
  const { media: mediaNotice } = await searchParams;
  const job = await getCustomerJob(jobId, account.id);
  // A job belonging to somebody else answers exactly like one that is absent.
  if (!job) notFound();

  const [offers, booking, media] = await Promise.all([
    listOffersForJob(jobId, account.id),
    getBookingForJob(account.id, jobId),
    listJobMedia(jobId, account.id),
  ]);
  const mediaEditable = EDITABLE_JOB_STATUSES.includes(job.jobStatus);
  const reviewable = booking ? await canReview(booking.id, account.id) : null;
  const category = getCategoryById(job.categoryId);

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="job-title">
        <div className="account-section-head">
          <div>
            <span className="status-stamp" data-status={job.jobStatus}>
              <span className="status-dot" aria-hidden="true" />
              {JOB_STATUS_LABELS[job.jobStatus]}
            </span>
            <h1 id="job-title">{job.title}</h1>
            <p className="account-section-lede">{job.description}</p>
          </div>
          <div className="job-head-actions">
            <Link className="quiet-button" href="/account/jobs">
              All my jobs
            </Link>
            <JobActions jobId={job.id} status={job.jobStatus} title={job.title} />
          </div>
        </div>

        <dl className="job-facts">
          <div>
            <dt>Category</dt>
            <dd>{category?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Budget</dt>
            <dd>
              {formatPhp(job.budgetCentavos)}
              {job.budgetMaxCentavos ? ` – ${formatPhp(job.budgetMaxCentavos)}` : ''}
              {job.pricingModel === 'negotiable' ? ' · open to quotes' : ''}
            </dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>
              {job.preferredStart
                ? `${formatDay(job.preferredStart)} ${formatTimeOfDay(job.preferredStart)}${job.scheduleFlexible ? ' · flexible' : ''}`
                : 'Flexible'}
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>
              {job.locationBarangay ? `${job.locationBarangay}, ` : ''}
              {job.locationCity}
            </dd>
          </div>
          {job.locationNotes && (
            <div>
              <dt>Access notes</dt>
              <dd>{job.locationNotes}</dd>
            </div>
          )}
        </dl>
      </section>

      {job.jobStatus === 'draft' && (
        <div className="job-notice">
          <p>
            This job is a draft, so no ServMate can see it yet. Publish it and the matching
            ones get it in their private feed.
          </p>
        </div>
      )}

      {mediaNotice === 'partial' && (
        <div className="job-notice">
          <p>
            Some files did not attach, so this job was left as a draft. Add them below, then
            publish when it is ready.
          </p>
        </div>
      )}

      <section className="account-section" aria-labelledby="job-media-title">
        <div className="account-section-head">
          <h3 id="job-media-title">Photos and videos</h3>
          {media.length > 0 && (
            <span className="account-section-note">
              {media.length} of {MAX_JOB_MEDIA}
            </span>
          )}
        </div>
        <JobMediaManager
          jobId={job.id}
          media={media}
          editable={mediaEditable}
          maxFiles={MAX_JOB_MEDIA}
        />
      </section>

      {booking && <BookingCard booking={booking} reviewable={reviewable?.allowed === true} />}

      <section className="account-section" aria-labelledby="job-offers-title">
        <div className="account-section-head">
          <h3 id="job-offers-title">Offers</h3>
          {offers && offers.length > 0 && (
            <span className="account-section-note">Cheapest first</span>
          )}
        </div>

        {offers && offers.length > 0 ? (
          <ul className="offer-list">
            {offers.map(({ offer, provider }) => (
              <li key={offer.id} className="offer-card" data-status={offer.offerStatus}>
                <div className="offer-head">
                  <div>
                    <span className="offer-provider">
                      {provider.name}
                      {provider.handle && <span className="offer-handle"> {provider.handle}</span>}
                    </span>
                    <span className="offer-standing">
                      {provider.rating > 0
                        ? `${provider.rating.toFixed(1)}★ across ${provider.reviewCount} review${provider.reviewCount === 1 ? '' : 's'}`
                        : 'No reviews yet'}
                      {provider.verified ? ' · verified' : ''}
                    </span>
                  </div>
                  <strong className="offer-amount">{formatPhp(offer.amountCentavos)}</strong>
                </div>

                {offer.scopeDescription && <p className="offer-scope">{offer.scopeDescription}</p>}
                {offer.exclusions && (
                  <p className="offer-exclusions">Not included: {offer.exclusions}</p>
                )}
                {offer.message && <p className="offer-note">“{offer.message}”</p>}

                <div className="offer-foot">
                  <span className="status-stamp" data-status={offer.offerStatus}>
                    <span className="status-dot" aria-hidden="true" />
                    {OFFER_STATUS_LABELS[offer.offerStatus]}
                  </span>
                  {offer.proposedStart && (
                    <span className="offer-when">
                      Could start {formatDay(offer.proposedStart)} {formatTimeOfDay(offer.proposedStart)}
                    </span>
                  )}
                  {offer.offerStatus === 'pending' && !booking && (
                    <OfferActions
                      jobId={job.id}
                      offerId={offer.id}
                      amountLabel={formatPhp(offer.amountCentavos)}
                      providerName={provider.name}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="account-empty">
            <span className="account-empty-mark" aria-hidden="true">
              ✳
            </span>
            <h3>No offers yet</h3>
            <p>
              {job.jobStatus === 'draft'
                ? 'Publish the job and matching ServMates will see it in their private feed.'
                : 'It is with every ServMate whose categories and areas match. You will see their prices here to compare.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function BookingCard({
  booking,
  reviewable,
}: {
  booking: NonNullable<Awaited<ReturnType<typeof getBookingForJob>>>;
  reviewable: boolean;
}) {
  return (
    <section className="account-section" aria-labelledby="job-booking-title">
      <div className="account-section-head">
        <h3 id="job-booking-title">Booked work</h3>
        <span className="status-stamp" data-status={booking.status}>
          <span className="status-dot" aria-hidden="true" />
          {BOOKING_STATUS_LABELS[booking.status]}
        </span>
      </div>

      <dl className="job-facts">
        <div>
          <dt>Reference</dt>
          <dd>{booking.reference}</dd>
        </div>
        <div>
          <dt>Agreed</dt>
          <dd>{booking.serviceTitle}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{BOOKING_STATUS_LABELS[booking.status]}</dd>
        </div>
      </dl>

      {booking.status === 'completion_pending' && (
        <div className="job-notice">
          <p>
            The ServMate has reported this work finished. Confirm it when you have had a look —
            then you can review the work.
          </p>
          <ConfirmCompletionButton bookingId={booking.id} reference={booking.reference} />
        </div>
      )}

      {booking.status === 'completed' && reviewable && (
        <ReviewForm bookingId={booking.id} reference={booking.reference} />
      )}

      <DisputeControls bookingId={booking.id} status={booking.status} />
    </section>
  );
}
