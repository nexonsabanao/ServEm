import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AdminCollectionState,
  filterCollection,
  AdminPage,
  AdminSearch,
  AdminTable,
  Checkbox,
  ContextCard,
  FilterRow,
  PaginationFooter,
  RailActions,
} from '../../components/AdminUI';
import { Button, Chip, Stars } from '../../components/ui';
import { formatPhilippineDateTime } from '../../lib/localization';
import { useAdminCollection } from '../../lib/useAdminCollection';
import { useAdminDecision } from '../../lib/useAdminDecision';
import type { AdminReview, Dispute, Ticket } from '../../lib/types';

export function AdminDisputesPage() {
  const [query, setQuery] = useState('');
  const disputes = useAdminCollection<Dispute>('disputes');
  return (
    <AdminPage title="Disputes & safety" subtitle="Safety cases from the disputes collection">
      <AdminSearch placeholder="Search dispute, booking or customer" value={query} onChange={setQuery} />
      <FilterRow items={['Priority: All', 'State: Open', 'Owner: Any']} />
      <AdminCollectionState
        collection={filterCollection(disputes, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang open disputes. Cases appear here when a customer or ServMate raises one from a booking.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['Case', 'Booking', 'Opened by', 'Priority', 'SLA', 'State']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((dispute) => (
                <tr key={dispute.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td>
                    <Link
                      to={`/admin/disputes/${dispute.id}`}
                      className="font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {dispute.id}
                    </Link>
                  </td>
                  <td>{dispute.booking}</td>
                  <td>{dispute.openedBy}</td>
                  <td>
                    <Chip small tone={dispute.priority === 'high' ? 'danger' : 'neutral'} className="capitalize">
                      {dispute.priority}
                    </Chip>
                  </td>
                  <td className="text-[var(--color-muted)]">{dispute.sla}</td>
                  <td>
                    <Chip
                      small
                      tone={dispute.status === 'resolved' ? 'brand' : dispute.status === 'open' ? 'warn' : 'neutral'}
                      className="capitalize"
                    >
                      {dispute.status}
                    </Chip>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.filter((d) => d.priority === 'high').length} high-priority{' '}
              {rows.filter((d) => d.priority === 'high').length === 1 ? 'case' : 'cases'} in this view. Safety cases
              need a written outcome before they can be closed.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

export function AdminDisputeResolutionPage() {
  const { id } = useParams();
  const disputes = useAdminCollection<Dispute>('disputes');
  const decision = useAdminDecision();

  return (
    <AdminCollectionState collection={disputes}>
      {(rows) => {
        const dispute = rows.find((d) => d.id === id);
        if (!dispute) {
          return <AdminPage title="Dispute not found" subtitle={`No document with id ${id} in the disputes collection`} />;
        }
        return (
          <AdminPage
            title="Dispute resolution workspace"
            subtitle={`${dispute.id} · ${dispute.booking}`}
            actions={
              <Chip small tone={dispute.priority === 'high' ? 'danger' : 'neutral'} className="capitalize">
                {dispute.priority} priority
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <h2 className="text-[14px] font-semibold">Case summary</h2>
                  <p className="mt-2 text-[12px] leading-[1.7] text-[var(--color-muted)]">{dispute.summary}</p>
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] max-lg:grid-cols-1">
                    {[
                      ['Opened by', dispute.openedBy],
                      ['Priority', dispute.priority],
                      ['SLA target', dispute.sla],
                      ['Status', dispute.status],
                    ].map(([label, value]) => (
                      <p key={label} className="text-[var(--color-muted)]">
                        {label} <span className="ml-2 capitalize text-[var(--color-ink-2)]">{value}</span>
                      </p>
                    ))}
                  </div>
                </section>

                <section className="card mt-4 p-5">
                  <h2 className="text-[14px] font-semibold">Written outcome</h2>
                  <label className="label mt-3" htmlFor="dispute-outcome">
                    Outcome and reason
                  </label>
                  <textarea
                    id="dispute-outcome"
                    className="field text-[12.5px]"
                    rows={4}
                    value={decision.reason}
                    onChange={(event) => decision.setReason(event.target.value)}
                    placeholder="What happened, what was offered, and why the case can close."
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
                <Button small block disabled={decision.pending} onClick={() => void decision.submit('dispute', dispute.id, 'resolved')}>
                  {decision.pending ? 'Submitting…' : 'Resolve case'}
                </Button>
                <LinkButtonToBooking booking={dispute.booking} />
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}

function LinkButtonToBooking({ booking }: { booking: string }) {
  return (
    <Link to={`/admin/bookings/${booking}`} className="btn btn-outline h-[36px] w-full text-[12px]">
      Open the booking
    </Link>
  );
}

export function AdminTicketsPage() {
  const [query, setQuery] = useState('');
  const tickets = useAdminCollection<Ticket>('tickets');
  return (
    <AdminPage title="Support tickets" subtitle="Tickets from the tickets collection">
      <AdminSearch placeholder="Search ticket, subject or customer" value={query} onChange={setQuery} />
      <FilterRow items={['State: Open', 'Priority: All', 'SLA: Approaching']} />
      <AdminCollectionState
        collection={filterCollection(tickets, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang support tickets. This queue fills when someone raises a request from the help centre.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['Ticket', 'Subject', 'From', 'Priority', 'SLA', 'State']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td>
                    <Link
                      to={`/admin/tickets/${ticket.id}`}
                      className="font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {ticket.id}
                    </Link>
                  </td>
                  <td>{ticket.subject}</td>
                  <td>{ticket.from}</td>
                  <td>
                    <Chip small tone={ticket.priority === 'high' ? 'danger' : 'neutral'} className="capitalize">
                      {ticket.priority}
                    </Chip>
                  </td>
                  <td className="text-[var(--color-muted)]">{ticket.sla}</td>
                  <td>
                    <Chip
                      small
                      tone={ticket.status === 'resolved' ? 'brand' : ticket.status === 'open' ? 'warn' : 'neutral'}
                      className="capitalize"
                    >
                      {ticket.status}
                    </Chip>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.filter((t) => t.status === 'open').length} of {rows.length} tickets still open. Ticket email
              delivery is not wired up yet, so replies are recorded on the ticket rather than mailed.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

export function AdminTicketWorkspacePage() {
  const { id } = useParams();
  const tickets = useAdminCollection<Ticket>('tickets');
  const decision = useAdminDecision();

  return (
    <AdminCollectionState collection={tickets}>
      {(rows) => {
        const ticket = rows.find((t) => t.id === id);
        if (!ticket) {
          return <AdminPage title="Ticket not found" subtitle={`No document with id ${id} in the tickets collection`} />;
        }
        return (
          <AdminPage
            title="Support ticket workspace"
            subtitle={`${ticket.id} · ${ticket.from}`}
            actions={
              <Chip small tone="warn">
                {ticket.sla} SLA
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <h2 className="text-[14px] font-semibold">Subject</h2>
                  <p className="mt-2 text-[12.5px] leading-[1.7]">{ticket.subject}</p>
                  <p className="mt-3 text-[11.5px] text-[var(--color-muted)]">
                    Raised by {ticket.from} · recorded {formatPhilippineDateTime(ticket.date)} · priority{' '}
                    {ticket.priority}
                  </p>
                </section>

                <section className="card mt-4 p-5">
                  <h2 className="text-[14px] font-semibold">Reply & outcome</h2>
                  <label className="label mt-3" htmlFor="ticket-reply">
                    What you are telling the customer
                  </label>
                  <textarea
                    id="ticket-reply"
                    className="field text-[12.5px]"
                    rows={4}
                    value={decision.reason}
                    onChange={(event) => decision.setReason(event.target.value)}
                    placeholder="Write the reply. It is stored on the ticket as the outcome note."
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
                <Button small block disabled={decision.pending} onClick={() => void decision.submit('ticket', ticket.id, 'resolved')}>
                  {decision.pending ? 'Submitting…' : 'Resolve ticket'}
                </Button>
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}

export function AdminReviewsPage() {
  const [query, setQuery] = useState('');
  const reviews = useAdminCollection<AdminReview>('reviews');
  return (
    <AdminPage title="Reviews" subtitle="Published and flagged reviews from the reviews collection">
      <AdminSearch placeholder="Search review, service or author" value={query} onChange={setQuery} />
      <FilterRow items={['State: All', 'Rating: Any', 'Date range: Last 30 days']} />
      <AdminCollectionState
        collection={filterCollection(reviews, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang reviews yet. Reviews are written when a customer rates a completed booking.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['Review', 'Service', 'From', 'To', 'Rating', 'State', 'Date']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((review) => (
                <tr key={review.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td className="font-medium text-[var(--color-ink)]">{review.id}</td>
                  <td>{review.service}</td>
                  <td>{review.from}</td>
                  <td>{review.to}</td>
                  <td>
                    <span className="flex items-center gap-1">
                      <Stars rating={review.rating} /> {review.rating}
                    </span>
                  </td>
                  <td>
                    <Chip
                      small
                      tone={
                        review.status === 'published' ? 'brand' : review.status === 'flagged' ? 'warn' : 'neutral'
                      }
                      className="capitalize"
                    >
                      {review.status}
                    </Chip>
                  </td>
                  <td className="text-[var(--color-muted)]">{review.date}</td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.filter((r) => r.status === 'flagged').length} of {rows.length} reviews are flagged. Removing a
              review needs a reason and is recorded against the review document.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}
