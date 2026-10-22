import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { JobMediaGallery } from '@/app/components/jobs/job-media-gallery';
import { TrustControls } from '@/app/components/trust-controls';
import { OfferForm } from '@/app/components/servmate/offer-form';
import { WithdrawOfferButton } from '@/app/components/servmate/withdraw-offer-button';
import { getSessionAccount } from '@/lib/auth';
import { getCategoryById } from '@/lib/categories';
import { formatDay, formatPhp, formatTimeOfDay } from '@/lib/format';
import { getJobDetail } from '@/lib/matching';
import { listJobMedia } from '@/lib/media';
import { listOwnOffers } from '@/lib/offers';
import { OFFER_STATUS_LABELS } from '@/lib/presentation';
import { getOwnServmateProfile } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

type Params = Promise<{ jobId: string }>;

/**
 * One job, as a matching ServMate sees it.
 *
 * The barangay and access notes are here because this caller is already
 * entitled to them: the eligibility rule was what put the job in front of them.
 * A job this account is not eligible for answers exactly like one that does not
 * exist, so opening a guessed id confirms nothing.
 */
export default async function ServmateJobPage({ params }: { params: Params }) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const { jobId } = await params;
  const profile = await getOwnServmateProfile(account.id);
  if (!profile) redirect('/servmate/jobs');

  const job = await getJobDetail({ jobId, userId: account.id });
  if (!job) notFound();

  const [ownOffers, media] = await Promise.all([
    listOwnOffers(profile.id),
    listJobMedia(job.id, account.id),
  ]);
  const mine = ownOffers
    .filter((offer) => offer.jobPostId === job.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const category = getCategoryById(job.categoryId);
  const openForOffers =
    job.jobStatus === 'open' || job.jobStatus === 'offer_received';

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="job-title">
        <div className="account-section-head">
          <div>
            <span className="status-stamp" data-status={job.jobStatus}>
              <span className="status-dot" aria-hidden="true" />
              {category?.name ?? 'Job'}
            </span>
            <h2 id="job-title">{job.title}</h2>
            <p className="account-section-lede">{job.description}</p>
          </div>
          <Link className="quiet-button" href="/servmate/jobs">
            All matching jobs
          </Link>
        </div>

        <dl className="job-facts">
          <div>
            <dt>Budget</dt>
            <dd>
              {formatPhp(job.budgetCentavos)}
              {job.budgetMaxCentavos ? ` – ${formatPhp(job.budgetMaxCentavos)}` : ''}
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
            <dt>Area</dt>
            <dd>{job.locationCity}</dd>
          </div>
          {job.locationBarangay && (
            <div>
              <dt>Barangay</dt>
              <dd>{job.locationBarangay}</dd>
            </div>
          )}
          {job.locationNotes && (
            <div>
              <dt>Access notes</dt>
              <dd>{job.locationNotes}</dd>
            </div>
          )}
        </dl>
      </section>

      {media.length > 0 && (
        <section className="account-section" aria-labelledby="job-media-title">
          <div className="account-section-head">
            <h3 id="job-media-title">Photos from the customer</h3>
            <span className="account-section-note">Shared with you because this job matches your work</span>
          </div>
          <JobMediaGallery media={media} label="Photos and videos the customer attached" />
        </section>
      )}

      {mine && (
        <section className="account-section" aria-labelledby="your-offer-title">
          <div className="account-section-head">
            <h3 id="your-offer-title">Your offer</h3>
            <span className="status-stamp" data-status={mine.offerStatus}>
              <span className="status-dot" aria-hidden="true" />
              {OFFER_STATUS_LABELS[mine.offerStatus]}
            </span>
          </div>
          <div className="offer-card" data-status={mine.offerStatus}>
            <div className="offer-head">
              <div>
                <span className="offer-provider">{formatPhp(mine.amountCentavos)}</span>
                <span className="offer-standing">
                  Sent {formatDay(mine.createdAt)} {formatTimeOfDay(mine.createdAt)}
                </span>
              </div>
            </div>
            {mine.scopeDescription && <p className="offer-scope">{mine.scopeDescription}</p>}
            {mine.message && <p className="offer-note">“{mine.message}”</p>}
            {mine.offerStatus === 'pending' && (
              <div className="offer-foot">
                <WithdrawOfferButton offerId={mine.id} />
              </div>
            )}
          </div>
        </section>
      )}

      {mine?.offerStatus === 'pending' ? (
        <div className="job-notice">
          <p>
            Your offer is with the customer. Withdraw it above to change your price or step away —
            it stays yours until it is accepted.
          </p>
        </div>
      ) : openForOffers ? (
        <section className="account-section" aria-labelledby="offer-title">
          <div className="account-section-head">
            <h3 id="offer-title">Make an offer</h3>
            <span className="account-section-note">Your price, your terms</span>
          </div>
          <OfferForm jobId={job.id} budgetCentavos={job.budgetCentavos} />
        </section>
      ) : (
        <div className="job-notice">
          <p>This job is no longer open for offers.</p>
        </div>
      )}

      <section className="account-section" aria-labelledby="job-trust-title">
        <div className="account-section-head">
          <h3 id="job-trust-title">Something wrong with this job?</h3>
        </div>
        <TrustControls subject={`“${job.title}”`} reportedJobId={job.id} />
      </section>
    </div>
  );
}
