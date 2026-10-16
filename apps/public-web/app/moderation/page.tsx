import { notFound } from 'next/navigation';
import { DisputeCaseActions, ReportCaseActions } from '@/app/components/moderation/case-actions';
import {
  OperatorLockButton,
  OperatorUnlock,
} from '@/app/components/moderation/operator-access';
import { formatPhp } from '@/lib/format';
import { BOOKING_STATUS_LABELS, REPORT_STATUS_LABELS } from '@/lib/presentation';
import { hasModeratorSession } from '@/lib/moderation-access';
import {
  QUEUE_LIMIT,
  listCases,
  moderationConfigured,
  moderatorLabel,
  type DisputeCase,
  type ReportCase,
} from '@/lib/moderation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Moderation — ServEm',
  // An operator tool has no business in a search index, and saying so here is
  // cheaper than remembering it at the edge.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The moderation console: one screen, two queues, no customer chrome.
 *
 * Three states, decided on the server before the first paint:
 *
 * 1. **The deployment has no token** → `notFound()`. A console that is switched
 *    off does not exist, rather than existing and refusing.
 * 2. **Signed in as a customer, or nobody** → the unlock form. It says what the
 *    credential is and that an account will not do, and it is the only thing on
 *    the page: no counts, no case titles, not even whether any exist.
 * 3. **Unlocked** → the queue, oldest first, with the audit trail of every action
 *    already taken on each case visible beside the controls.
 *
 * The page renders every case as a document rather than a table row because a
 * decision needs context — what was said, by whom, and what happened to the work
 * so far — and a table is the wrong shape for reading a paragraph someone wrote
 * when they were angry.
 */
export default async function ModerationPage() {
  if (!moderationConfigured()) notFound();

  if (!(await hasModeratorSession())) {
    return (
      <main className="docket docket-gate">
        <section className="docket-card" aria-labelledby="docket-locked">
          <p className="docket-kicker">Operations</p>
          <h1 id="docket-locked">Moderation console</h1>
          <p className="docket-lede">
            Reports and disputed work are reviewed here. This console is locked with the
            deployment&rsquo;s own credential.
          </p>
          <OperatorUnlock />
        </section>
      </main>
    );
  }

  const label = moderatorLabel();
  const queue = await listCases();

  return (
    <main className="docket">
      <header className="docket-head">
        <div>
          <p className="docket-kicker">Operations</p>
          <h1>Moderation queue</h1>
          <p className="docket-lede">
            Reports and disputed work that need a person. Every action is recorded against the
            operator label <strong>{label}</strong>, and an outcome on a dispute tells both of the
            people involved.
          </p>
        </div>
        <div className="docket-chips">
          <span className="set-gate">
            {queue.reports.length === 1 ? '1 open report' : `${queue.reports.length} open reports`}
          </span>
          <span className="set-gate">
            {queue.disputes.length === 1
              ? '1 open dispute'
              : `${queue.disputes.length} open disputes`}
          </span>
          <OperatorLockButton />
        </div>
      </header>

      <section className="docket-queue" aria-labelledby="docket-reports">
        <div className="docket-queue-head">
          <h2 id="docket-reports">Reports</h2>
          <p className="docket-hint">
            A report never hid anything on its own. Deciding one records why, and closes it.
          </p>
        </div>

        {queue.reports.length === 0 ? (
          <p className="docket-empty">No reports are waiting. Nothing has been filed since the last one was decided.</p>
        ) : (
          <ul className="docket-list">
            {queue.reports.map((report) => (
              <ReportCaseCard key={report.id} report={report} />
            ))}
          </ul>
        )}
        {queue.reports.length >= QUEUE_LIMIT && (
          <p className="docket-hint">
            Showing the oldest {QUEUE_LIMIT}; more are waiting. Pagination is on the roadmap.
          </p>
        )}
      </section>

      <section className="docket-queue" aria-labelledby="docket-disputes">
        <div className="docket-queue-head">
          <h2 id="docket-disputes">Disputed work</h2>
          <p className="docket-hint">
            A dispute freezes a booking: neither side can confirm, complete or review it while it
            stands. Deciding one moves the work to completed or cancelled for both of them.
          </p>
        </div>

        {queue.disputes.length === 0 ? (
          <p className="docket-empty">No booking is under an open dispute.</p>
        ) : (
          <ul className="docket-list">
            {queue.disputes.map((dispute) => (
              <DisputeCaseCard key={dispute.bookingId} dispute={dispute} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ReportCaseCard({ report }: { report: ReportCase }) {
  return (
    <li className="docket-card">
      <div className="docket-case-head">
        <div>
          <p className="docket-ref">{report.reasonLabel}</p>
          <h3>{report.subject.label}</h3>
          {report.subject.detail && <p className="docket-meta">{report.subject.detail}</p>}
        </div>
        <span className="set-gate">{REPORT_STATUS_LABELS[report.status]}</span>
      </div>

      <dl className="docket-facts">
        <div>
          <dt>Filed</dt>
          <dd>{stamp(report.createdAt)}</dd>
        </div>
        <div>
          <dt>Reported by</dt>
          <dd>{report.reporter.name}</dd>
        </div>
        {report.reported && (
          <div>
            <dt>About</dt>
            <dd>{report.reported.name}</dd>
          </div>
        )}
      </dl>

      {report.description && <blockquote className="docket-quote">{report.description}</blockquote>}
      {report.subject.excerpt && (
        <div className="docket-evidence">
          <p className="docket-ref">
            {report.subject.kind === 'message' ? 'The reported message' : 'The job as posted'}
          </p>
          <blockquote className="docket-quote">{report.subject.excerpt}</blockquote>
        </div>
      )}

      <CaseHistory actions={report.actions} />
      <ReportCaseActions reportId={report.id} status={report.status} />
    </li>
  );
}

function DisputeCaseCard({ dispute }: { dispute: DisputeCase }) {
  return (
    <li className="docket-card">
      <div className="docket-case-head">
        <div>
          <p className="docket-ref">
            {dispute.reference} · {dispute.serviceTitle}
          </p>
          <h3>
            {dispute.agreedAmountCentavos !== undefined
              ? formatPhp(dispute.agreedAmountCentavos)
              : 'No agreed amount'}
            {dispute.area ? ` · ${dispute.area}` : ''}
          </h3>
          <p className="docket-meta">Raised {stamp(dispute.raisedAt)}</p>
        </div>
        <span className="set-gate">{BOOKING_STATUS_LABELS[dispute.status]}</span>
      </div>

      <dl className="docket-facts">
        <div>
          <dt>Customer</dt>
          <dd>{dispute.customer.name}</dd>
        </div>
        <div>
          <dt>ServMate</dt>
          <dd>{dispute.provider?.name ?? 'Not attached'}</dd>
        </div>
      </dl>

      {dispute.reason && (
        <div className="docket-evidence">
          <p className="docket-ref">What the customer reported</p>
          <blockquote className="docket-quote">{dispute.reason}</blockquote>
        </div>
      )}

      <div className="docket-evidence">
        <p className="docket-ref">How the work got here</p>
        <ol className="docket-timeline">
          {dispute.timeline.map((entry) => (
            <li key={`${entry.at}-${entry.to}`}>
              <span className="docket-when">{stamp(entry.at)}</span>
              <span className="docket-what">
                {entry.from} → {entry.to} · {entry.actor}
                {entry.reason ? ` · ${entry.reason}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <CaseHistory actions={dispute.actions} />
      {dispute.status === 'disputed' ? (
        <DisputeCaseActions bookingId={dispute.bookingId} />
      ) : (
        <p className="docket-hint">
          This dispute has been decided. The outcome and who imposed it are in the history above.
        </p>
      )}
    </li>
  );
}

/**
 * What has already been done about this case.
 *
 * Shown on the case rather than kept behind an audit screen because the second
 * person to look at a case needs the first person's reasoning: a queue with no
 * visible history is how the same report gets decided twice, differently.
 */
function CaseHistory({ actions }: { actions: ReportCase['actions'] }) {
  if (actions.length === 0) return null;
  return (
    <div className="docket-evidence">
      <p className="docket-ref">What has been done</p>
      <ul className="docket-timeline">
        {actions.map((action) => (
          <li key={action.id}>
            <span className="docket-when">{stamp(action.createdAt)}</span>
            <span className="docket-what">
              {action.actorLabel} · {action.action}
              {action.outcome ? ` → ${action.outcome}` : ''}
              {action.note ? ` · ${action.note}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `15 Oct 2026, 7:35 PM`, in the app's own format, on the server clock. */
function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(date)}, ${new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date)}`;
}
