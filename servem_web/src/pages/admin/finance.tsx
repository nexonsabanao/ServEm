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
import { Button, Chip } from '../../components/ui';
import { formatPhilippinePeso, paymentMethodLabel } from '../../lib/localization';
import { useAdminCollection } from '../../lib/useAdminCollection';
import { useAdminDecision } from '../../lib/useAdminDecision';
import type { Payment, Payout } from '../../lib/types';

const statusTone = (status: string) =>
  status === 'paid' ? 'brand' : status === 'refunded' ? 'neutral' : status === 'review' ? 'warn' : 'info';

export function AdminPaymentsPage() {
  const [query, setQuery] = useState('');
  const payments = useAdminCollection<Payment>('payments');
  return (
    <AdminPage title="Payments & refunds" subtitle="Payment records read live from Firestore">
      <AdminSearch placeholder="Search payment, customer or ServMate" value={query} onChange={setQuery} />
      <FilterRow items={['State: All', 'Method: All', 'Date range: Last 30 days']} />
      <AdminCollectionState
        collection={filterCollection(payments, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang payment records yet. A payment row is written once a booking is paid through the connected provider.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['Payment', 'Customer', 'ServMate', 'Amount', 'Fee', 'State', 'Date']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td>
                    <Link
                      to={`/admin/payments/${payment.id}`}
                      className="font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {payment.id}
                    </Link>
                  </td>
                  <td>{payment.customer}</td>
                  <td>{payment.provider}</td>
                  <td>{formatPhilippinePeso(payment.amount)}</td>
                  <td>{formatPhilippinePeso(payment.fee)}</td>
                  <td>
                    <Chip small tone={statusTone(payment.status)} className="capitalize">
                      {payment.status}
                    </Chip>
                  </td>
                  <td className="text-[var(--color-muted)]">{payment.date}</td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.filter((r) => r.status === 'review').length} payment records are waiting on a refund decision.
              Approval is recorded on the payment document; the actual transfer of funds is done by the payment
              provider, not by this screen.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

export function AdminTransactionPage() {
  const { id } = useParams();
  const payments = useAdminCollection<Payment>('payments');

  return (
    <AdminCollectionState collection={payments}>
      {(rows) => {
        const payment = rows.find((p) => p.id === id);
        if (!payment) {
          return <AdminPage title="Payment not found" subtitle={`No document with id ${id} in the payments collection`} />;
        }
        return (
          <AdminPage
            title="Transaction detail"
            subtitle={`${payment.id} · ${payment.customer}`}
            actions={
              <Chip small tone={statusTone(payment.status)} className="capitalize">
                {payment.status}
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <h2 className="text-[14px] font-semibold">Transaction summary</h2>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] max-lg:grid-cols-1">
                    {[
                      ['Payment', payment.id],
                      ['Customer', payment.customer],
                      ['ServMate', payment.provider],
                      ['Service', payment.service],
                      ['Method', paymentMethodLabel(payment.method)],
                      ['Date', payment.date],
                    ].map(([label, value]) => (
                      <p key={label} className="text-[var(--color-muted)]">
                        {label} <span className="ml-2 text-[var(--color-ink-2)]">{value}</span>
                      </p>
                    ))}
                  </div>
                  <div className="mt-4 space-y-1 border-t border-[var(--color-line-2)] pt-3 text-[12px]">
                    <p className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Customer paid</span>
                      <span>{formatPhilippinePeso(payment.amount)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-[var(--color-muted)]">ServMate earnings</span>
                      <span>{formatPhilippinePeso(payment.amount - payment.fee)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Service fee</span>
                      <span>{formatPhilippinePeso(payment.fee)}</span>
                    </p>
                  </div>
                </section>

                <AdminStats
                  columns={3}
                  items={[
                    { label: 'Amount', value: formatPhilippinePeso(payment.amount), note: 'Total charged to the customer' },
                    { label: 'Service fee', value: formatPhilippinePeso(payment.fee), note: 'Stored on the payment record' },
                    {
                      label: 'ServMate earnings',
                      value: formatPhilippinePeso(payment.amount - payment.fee),
                      note: 'Amount minus fee',
                    },
                  ]}
                />

                <ContextCard title="Payment notes">
                  These figures come from the payment document itself. A refund writes the decision and reason to that
                  document; the funds themselves move through the payment provider.
                </ContextCard>
              </div>

              <RailActions title="Next steps">
                <Link to={`/admin/payments/${payment.id}/refund`} className="btn btn-ghost h-[36px] w-full text-[12px]">
                  Start refund
                </Link>
                <Link to="/admin/disputes" className="btn btn-outline h-[36px] w-full text-[12px]">
                  Open disputes
                </Link>
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}

export function AdminRefundReviewPage() {
  const { id } = useParams();
  const payments = useAdminCollection<Payment>('payments');
  const decision = useAdminDecision();

  return (
    <AdminCollectionState collection={payments}>
      {(rows) => {
        const payment = rows.find((p) => p.id === id);
        if (!payment) {
          return <AdminPage title="Payment not found" subtitle={`No document with id ${id} in the payments collection`} />;
        }
        return (
          <AdminPage
            title="Refund review & confirmation"
            subtitle={`${payment.id} · ${payment.customer}`}
            actions={
              <Chip small tone={payment.status === 'refunded' ? 'neutral' : 'warn'}>
                {payment.status === 'refunded' ? 'Refunded' : 'Awaiting approval'}
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <h2 className="text-[14px] font-semibold">Refund summary</h2>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] max-lg:grid-cols-1">
                    {[
                      ['Original payment', payment.id],
                      ['Customer', payment.customer],
                      ['Amount', formatPhilippinePeso(payment.amount)],
                      ['Method', paymentMethodLabel(payment.method)],
                      ['Recorded on', payment.date],
                    ].map(([label, value]) => (
                      <p key={label} className="text-[var(--color-muted)]">
                        {label} <span className="ml-2 text-[var(--color-ink-2)]">{value}</span>
                      </p>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[8px] bg-[var(--color-soft)] px-4 py-3 text-[11.5px] text-[#3e5a4e]">
                    Approving records the refund against this payment. The money is returned by the payment provider —
                    ServEm does not move funds from this screen.
                  </div>
                  <div className="mt-4">
                    <label className="label" htmlFor="refund-reason">
                      Approval note
                    </label>
                    <textarea
                      id="refund-reason"
                      className="field text-[12.5px]"
                      rows={3}
                      value={decision.reason}
                      onChange={(event) => decision.setReason(event.target.value)}
                      placeholder="Why this refund is approved or declined."
                    />
                  </div>
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
                  onClick={() => void decision.submit('payment', payment.id, 'refunded')}
                >
                  {decision.pending ? 'Submitting…' : 'Approve refund'}
                </Button>
                <Button
                  small
                  variant="outline"
                  block
                  disabled={decision.pending}
                  onClick={() => void decision.submit('payment', payment.id, 'rejected')}
                >
                  Decline
                </Button>
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}

export function AdminPayoutsPage() {
  const [query, setQuery] = useState('');
  const payouts = useAdminCollection<Payout>('payouts');
  return (
    <AdminPage title="Payouts" subtitle="Withdrawal requests and scheduled payouts">
      <AdminSearch placeholder="Search payout, ServMate or ID" value={query} onChange={setQuery} />
      <FilterRow items={['State: All', 'Method: All']} />
      <AdminCollectionState
        collection={filterCollection(payouts, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang payout records yet. Requests show up here after a ServMate asks for a withdrawal from their earnings.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['Payout', 'ServMate', 'Amount', 'Method', 'State', 'Date']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((payout) => (
                <tr key={payout.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td>
                    <Link
                      to={`/admin/payouts/${payout.id}`}
                      className="font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {payout.id}
                    </Link>
                  </td>
                  <td>{payout.provider}</td>
                  <td>{formatPhilippinePeso(payout.amount)}</td>
                  <td className="text-[var(--color-muted)]">{paymentMethodLabel(payout.method)}</td>
                  <td>
                    <Chip small tone={statusTone(payout.status === 'scheduled' ? 'pending' : payout.status)}>
                      {payout.status}
                    </Chip>
                  </td>
                  <td className="text-[var(--color-muted)]">{payout.date}</td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.filter((r) => r.status === 'review').length} of {rows.length} payouts need a decision. Bank or
              GCash details stay on the payout record and are not displayed in this table.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

export function AdminWithdrawalReviewPage() {
  const { id } = useParams();
  const payouts = useAdminCollection<Payout>('payouts');
  const decision = useAdminDecision();

  return (
    <AdminCollectionState collection={payouts}>
      {(rows) => {
        const payout = rows.find((p) => p.id === id);
        if (!payout) {
          return <AdminPage title="Payout not found" subtitle={`No document with id ${id} in the payouts collection`} />;
        }
        return (
          <AdminPage
            title="Withdrawal review"
            subtitle={`${payout.id} · ${payout.provider}`}
            actions={
              <Chip small tone={payout.status === 'paid' ? 'brand' : 'warn'} className="capitalize">
                {payout.status}
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <h2 className="text-[14px] font-semibold">Withdrawal summary</h2>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] max-lg:grid-cols-1">
                    {[
                      ['ServMate', payout.provider],
                      ['Amount', formatPhilippinePeso(payout.amount)],
                      ['Method', paymentMethodLabel(payout.method)],
                      ['Requested', payout.date],
                    ].map(([label, value]) => (
                      <p key={label} className="text-[var(--color-muted)]">
                        {label} <span className="ml-2 text-[var(--color-ink-2)]">{value}</span>
                      </p>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[8px] bg-[var(--color-warn)] px-4 py-3 text-[11.5px] text-[#6f5a2e]">
                    Approving marks this payout approved on the record. The transfer is executed by the payout provider
                    on its own schedule.
                  </div>
                  <div className="mt-4">
                    <label className="label" htmlFor="payout-note">
                      Reviewer note
                    </label>
                    <textarea
                      id="payout-note"
                      className="field text-[12.5px]"
                      rows={3}
                      value={decision.reason}
                      onChange={(event) => decision.setReason(event.target.value)}
                      placeholder="What you checked before approving or holding this payout."
                    />
                  </div>
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
                <Button small block disabled={decision.pending} onClick={() => void decision.submit('payout', payout.id, 'approved')}>
                  {decision.pending ? 'Submitting…' : 'Approve payout'}
                </Button>
                <Button
                  small
                  variant="outline"
                  block
                  disabled={decision.pending}
                  onClick={() => void decision.submit('payout', payout.id, 'rejected')}
                >
                  Decline
                </Button>
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}
