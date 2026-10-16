import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionAccount } from '@/lib/auth';
import { formatDay, formatDayShort, formatTimeOfDay } from '@/lib/format';
import { REPORT_STATUS_LABELS } from '@/lib/presentation';
import { listOwnReports } from '@/lib/trust';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your reports — ServEm',
};

/**
 * What this account reported, and where each report stands.
 *
 * Reporting used to end in silence: a report was written and the reporter never
 * saw it again, which makes "report" and "give up" feel the same. This is the
 * reading half of the same pair — the reasons come from the same registry the API
 * validates against, and every row is re-derived rather than stored, so the page
 * cannot claim a report says something the record does not.
 *
 * Two things are deliberately absent. There is no moderator case screen (that is
 * an operator surface with its own threat model, recorded as a deferral in
 * `docs/requirements/user-flow-conformance.md` §5), so a report stays listed as
 * waiting for review until a person acts on it out of band. And no outcome is
 * invented here: `resolved` and `dismissed` are shown as words, not as a verdict
 * about who was right.
 */
export default async function ReportsPage() {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const reports = await listOwnReports(account.id);

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="reports-title">
        <div className="account-section-head">
          <div>
            <h1 id="reports-title">Your reports</h1>
            <p className="account-section-lede">
              A moderator reads each one. The account you named is never told.
            </p>
          </div>
          {reports.length > 0 && (
            <span className="account-section-note">
              {reports.length === 1 ? '1 report' : `${reports.length} reports`}
            </span>
          )}
        </div>

        {reports.length === 0 ? (
          <div className="account-empty">
            <span className="account-empty-mark" aria-hidden="true">
              ⚑
            </span>
            <h2>Nothing reported</h2>
            <p>
              Use &ldquo;Report or block&rdquo; on the profile, job or message it happened in, and it
              lands here.
            </p>
          </div>
        ) : (
          <ul className="order-list">
            {reports.map((report) => (
              <li key={report.id} className="order-row notif-row">
                <div className="order-when">
                  <strong>{formatDayShort(report.createdAt)}</strong>
                  <span>{formatTimeOfDay(report.createdAt)}</span>
                </div>
                <div className="order-what">
                  <span className="order-ref">{report.reasonLabel}</span>
                  <h3>{report.subject}</h3>
                  {report.description && <p className="order-brief">{report.description}</p>}
                  {report.resolvedAt && (
                    <p className="order-brief">Closed {formatDay(report.resolvedAt)}.</p>
                  )}
                </div>
                <div className="order-state">
                  <span className="set-gate">{REPORT_STATUS_LABELS[report.status]}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {reports.length > 0 && (
          <p className="account-section-lede">
            Blocking is the control that takes effect at once — it is under Settings.{' '}
            <Link className="account-section-link" href="/account/settings/privacy">
              Blocked accounts
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
