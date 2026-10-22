import Link from 'next/link';
import { redirect } from 'next/navigation';
import { JobActions } from '@/app/components/jobs/job-actions';
import { getSessionAccount } from '@/lib/auth';
import { formatDayShort, formatPhp, formatTimeOfDay } from '@/lib/format';
import { listCustomerJobs } from '@/lib/jobs';
import { offerCountsForJobs } from '@/lib/offers';
import { JOB_STATUS_LABELS } from '@/lib/presentation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My jobs — ServEm',
};

/**
 * The customer's job posts.
 *
 * A job is a private request, so this list is the only place its owner sees it;
 * it never appears in the storefront. Each row carries the two facts that decide
 * what to do next — where the job stands, and how many ServMates have answered.
 */
export default async function JobsPage() {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const [jobs, counts] = await Promise.all([
    listCustomerJobs(account.id),
    offerCountsForJobs(account.id),
  ]);

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="jobs-title">
        <div className="account-section-head">
          <div>
            <h1 id="jobs-title">My jobs</h1>
            <p className="account-section-lede">Private to the ServMates who match them.</p>
          </div>
          <Link className="button button-primary" href="/account/jobs/new">
            Post a job
          </Link>
        </div>
      </section>

      {jobs.length > 0 ? (
        <ul className="order-list">
          {jobs.map((job) => {
            const offers = counts.get(job.id) ?? { total: 0, pending: 0 };
            const offerWord =
              offers.total === 0
                ? 'No offers yet'
                : offers.total === 1
                  ? '1 offer'
                  : `${offers.total} offers`;
            return (
              <li key={job.id} className="order-row" data-status={job.jobStatus}>
                <div className="order-when">
                  <strong>{formatDayShort(job.createdAt)}</strong>
                  <span>{formatTimeOfDay(job.createdAt)}</span>
                </div>
                <div className="order-what">
                  <span className="order-ref">{JOB_STATUS_LABELS[job.jobStatus]}</span>
                  <h3>
                    <Link className="order-title-link" href={`/account/jobs/${job.id}`}>
                      {job.title}
                    </Link>
                  </h3>
                  <p className="order-brief">{job.description}</p>
                  <span className="order-area">
                    {job.locationCity} · {formatPhp(job.budgetCentavos)} · {offerWord}
                    {offers.pending > 0 && offers.total > offers.pending
                      ? ` (${offers.pending} live)`
                      : ''}
                  </span>
                </div>
                <div className="order-state">
                  <Link className="quiet-button" href={`/account/jobs/${job.id}`}>
                    {offers.total > 0 ? 'Compare offers' : 'Open job'}
                  </Link>
                </div>
                <div className="order-actions">
                  <JobActions jobId={job.id} status={job.jobStatus} title={job.title} />
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
          <h2>No jobs posted yet</h2>
          <p>
            Describe the work, set what you are willing to pay, and only the ServMates whose
            categories and areas match will see it — each one offering their own price.
          </p>
        </div>
      )}
    </div>
  );
}
