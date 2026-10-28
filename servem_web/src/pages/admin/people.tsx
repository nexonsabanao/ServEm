import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import {
  AdminCollectionState,
  filterCollection,
  AdminPage,
  AdminSearch,
  AdminStats,
  AdminTable,
  Checkbox,
  ContextCard,
  DocumentPreview,
  FilterRow,
  PaginationFooter,
  RailActions,
} from '../../components/AdminUI';
import { Button, Chip } from '../../components/ui';
import { formatPhilippinePeso } from '../../lib/localization';
import { useAdminCollection } from '../../lib/useAdminCollection';
import { useAdminDecision } from '../../lib/useAdminDecision';
import type { AdminCustomer, AdminServMate, VerificationRequest } from '../../lib/types';

export function AdminCustomersPage() {
  const [query, setQuery] = useState('');
  const customers = useAdminCollection<AdminCustomer>('customers');
  return (
    <AdminPage title="Customers" subtitle="Accounts read live from Firestore · Asia/Manila time">
      <AdminSearch placeholder="Search name, email or ID" value={query} onChange={setQuery} />
      <FilterRow items={['State: All', 'City: All', 'Sort: Newest']} />
      <AdminCollectionState
        collection={filterCollection(customers, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang customer accounts yet. Rows appear here as soon as people sign up and their profile documents are
            written.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['Customer', 'Email', 'City', 'Joined', 'Bookings', 'Spend', 'State']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td>
                    <Link
                      to={`/admin/customers/${customer.id}`}
                      className="font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {customer.name || 'Unnamed account'}
                    </Link>
                    <span className="ml-2 text-[10.5px] text-[var(--color-muted-2)]">{customer.id}</span>
                  </td>
                  <td className="text-[var(--color-muted)]">{customer.email}</td>
                  <td>{customer.city || '—'}</td>
                  <td>{customer.since}</td>
                  <td>{typeof customer.bookings === 'number' ? customer.bookings : '—'}</td>
                  <td>{typeof customer.spend === 'number' ? formatPhilippinePeso(customer.spend) : '—'}</td>
                  <td>
                    <Chip
                      small
                      tone={
                        customer.status === 'active' ? 'brand' : 'danger'
                      }
                    >
                      {customer.status}
                    </Chip>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.length} customer {rows.length === 1 ? 'account' : 'accounts'} in this view. Counts come straight from
              the `customers` collection; nothing here is generated on the client.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

export function AdminCustomerDetailPage() {
  const { id } = useParams();
  const customers = useAdminCollection<AdminCustomer>('customers');
  const decision = useAdminDecision();

  return (
    <AdminCollectionState collection={customers}>
      {(rows) => {
        const customer = rows.find((c) => c.id === id);
        if (!customer) {
          return (
            <AdminPage title="Customer not found" subtitle={`No document with id ${id} in the customers collection`} />
          );
        }
        return (
          <AdminPage
            title={customer.name || 'Customer detail'}
            subtitle={`${customer.id} · ${customer.email}`}
            actions={
              <Chip small tone={customer.status === 'active' ? 'brand' : 'warn'} className="capitalize">
                {customer.status}
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <h2 className="text-[14px] font-semibold">Customer profile</h2>
                  <div className="mt-3">
                    <p className="text-[14px] font-medium">{customer.name || 'Unnamed account'}</p>
                    <p className="text-[11.5px] text-[var(--color-muted)]">
                      {customer.email} · Joined {customer.since}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] max-lg:grid-cols-1">
                    <p className="text-[var(--color-muted)]">
                      City <span className="ml-2 text-[var(--color-ink-2)]">{customer.city || 'Not provided'}</span>
                    </p>
                    <p className="text-[var(--color-muted)]">
                      Bookings{' '}
                      <span className="ml-2 text-[var(--color-ink-2)]">
                        {typeof customer.bookings === 'number' ? customer.bookings : 'Not tracked here'}
                      </span>
                    </p>
                    <p className="text-[var(--color-muted)]">
                      Lifetime value{' '}
                      <span className="ml-2 text-[var(--color-ink-2)]">
                        {typeof customer.spend === 'number' ? formatPhilippinePeso(customer.spend) : 'Not tracked here'}
                      </span>
                    </p>
                    <p className="text-[var(--color-muted)]">
                      Account state{' '}
                      <span className="ml-2 text-[var(--color-ink-2)] capitalize">{customer.status}</span>
                    </p>
                  </div>
                </section>

                <ContextCard title="What this page does not show">
                  Support history, disputes and payment records live in their own collections. This page only reflects
                  the customer document, so counts here are what that document currently stores.
                </ContextCard>
              </div>

              <RailActions title="Next steps">
                <Link to="/admin/bookings" className="btn btn-outline h-[36px] w-full text-[12px]">
                  View bookings
                </Link>
                <div className="mt-2 w-full">
                  <label className="label" htmlFor="account-reason">
                    Written reason
                  </label>
                  <textarea
                    id="account-reason"
                    className="field text-[12px]"
                    rows={3}
                    value={decision.reason}
                    onChange={(event) => decision.setReason(event.target.value)}
                    placeholder="Hindi pa napapalitan — the reason the server records with this decision."
                  />
                  {decision.error ? (
                    <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">
                      {decision.error}
                    </p>
                  ) : null}
                  {decision.message ? (
                    <p className="mt-2 text-[12px] text-[var(--color-brand-deep)]">{decision.message}</p>
                  ) : null}
                  <Button
                    small
                    block
                    className="mt-3"
                    disabled={decision.pending}
                    onClick={() =>
                      void decision.submit(
                        'account',
                        customer.id,
                        customer.status === 'suspended' ? 'active' : 'suspended',
                      )
                    }
                  >
                    {decision.pending
                      ? 'Submitting…'
                      : customer.status === 'suspended'
                        ? 'Reinstate account'
                        : 'Suspend account'}
                  </Button>
                </div>
                <Link to="/admin/tickets" className="btn btn-outline h-[36px] w-full text-[12px]">
                  Open support queue
                </Link>
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}

export function AdminServMatesPage() {
  const [query, setQuery] = useState('');
  const mates = useAdminCollection<AdminServMate>('servmates');
  return (
    <AdminPage title="ServMates" subtitle="Provider roster read live from Firestore">
      <AdminSearch placeholder="Search name, skill or ID" value={query} onChange={setQuery} />
      <FilterRow items={['State: All', 'Skill: All', 'Rating: Any']} />
      <AdminCollectionState
        collection={filterCollection(mates, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang ServMate records yet. Providers appear here after they finish onboarding and submit verification.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['ServMate', 'Email', 'City', 'Skills', 'Rating', 'Jobs', 'State']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((mate) => (
                <tr key={mate.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td>
                    <Link
                      to={`/admin/servmates/${mate.id}`}
                      className="font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {mate.name}
                    </Link>
                    <span className="ml-2 text-[10.5px] text-[var(--color-muted-2)]">{mate.id}</span>
                  </td>
                  <td className="text-[var(--color-muted)]">{mate.email}</td>
                  <td>{mate.city || '—'}</td>
                  <td>{mate.skills}</td>
                  <td>{mate.rating.toFixed(1)}</td>
                  <td>{mate.jobs}</td>
                  <td>
                    <Chip
                      small
                      tone={mate.status === 'verified' ? 'brand' : mate.status === 'pending' ? 'warn' : 'danger'}
                      className="capitalize"
                    >
                      {mate.status}
                    </Chip>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.filter((r) => r.status === 'pending').length} of {rows.length} providers are still awaiting
              verification. Approving a provider writes to the verification queue, not this table.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

export function AdminServMateDetailPage() {
  const { id } = useParams();
  const mates = useAdminCollection<AdminServMate>('servmates');

  return (
    <AdminCollectionState collection={mates}>
      {(rows) => {
        const mate = rows.find((m) => m.id === id);
        if (!mate) {
          return (
            <AdminPage title="ServMate not found" subtitle={`No document with id ${id} in the servmates collection`} />
          );
        }
        return (
          <AdminPage
            title={mate.name}
            subtitle={`${mate.id} · ${mate.email}`}
            actions={
              <Chip small tone={mate.status === 'verified' ? 'brand' : 'warn'} className="capitalize">
                {mate.status}
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <h2 className="text-[14px] font-semibold">ServMate profile</h2>
                  <div className="mt-3">
                    <p className="text-[14px] font-medium">{mate.name}</p>
                    <p className="text-[11.5px] text-[var(--color-muted)]">
                      {mate.city || 'City not provided'} · {mate.jobs} completed jobs
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-y-2 text-[12px] max-lg:grid-cols-1">
                    <p className="text-[var(--color-muted)]">
                      Skills <span className="ml-2 text-[var(--color-ink-2)]">{mate.skills}</span>
                    </p>
                    <p className="text-[var(--color-muted)]">
                      Average rating <span className="ml-2 text-[var(--color-ink-2)]">{mate.rating.toFixed(1)}</span>
                    </p>
                    <p className="text-[var(--color-muted)]">
                      Verification{' '}
                      <span className="ml-2 text-[var(--color-ink-2)] capitalize">
                        {mate.status === 'verified' ? 'Verified' : mate.status}
                      </span>
                    </p>
                  </div>
                </section>

                <AdminStats
                  columns={3}
                  items={[
                    { label: 'Completed jobs', value: String(mate.jobs), note: 'From the provider record' },
                    { label: 'Average rating', value: mate.rating.toFixed(1), note: 'Stored on the record' },
                    { label: 'Verification state', value: mate.status, note: 'Set by the review queue' },
                  ]}
                />

                <ContextCard title="Reviews & safety">
                  Disputes, flagged reviews and payout history are separate collections. This page does not invent
                  figures for them.
                </ContextCard>
              </div>

              <RailActions title="Next steps">
                <Link to="/admin/verification" className="btn btn-outline h-[36px] w-full text-[12px]">
                  Verification queue
                </Link>
                <Link to="/admin/payouts" className="btn btn-outline h-[36px] w-full text-[12px]">
                  Payouts
                </Link>
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}

export function AdminVerificationPage() {
  const [query, setQuery] = useState('');
  const queue = useAdminCollection<VerificationRequest>('verifications');
  return (
    <AdminPage title="Verification" subtitle="Identity reviews waiting on a decision">
      <AdminSearch placeholder="Search request, name or ID" value={query} onChange={setQuery} />
      <FilterRow items={['State: Pending', 'Order: Oldest first']} />
      <AdminCollectionState
        collection={filterCollection(queue, query)}
        empty={
          <ContextCard title="Queue context & next steps">
            Walang verification requests in the queue right now. New submissions appear here as soon as a ServMate
            uploads documents.
          </ContextCard>
        }
      >
        {(rows) => (
          <>
            <AdminTable
              headers={['Review', 'ServMate', 'Submitted', 'Documents', 'State']}
              footer={<PaginationFooter total={rows.length} />}
            >
              {rows.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Checkbox />
                  </td>
                  <td>
                    <Link
                      to={`/admin/verification/${request.id}`}
                      className="font-medium text-[var(--color-ink)] hover:underline"
                    >
                      {request.id}
                    </Link>
                  </td>
                  <td>{request.name}</td>
                  <td className="text-[var(--color-muted)]">{request.submitted}</td>
                  <td>{request.docs}</td>
                  <td>
                    <Chip
                      small
                      tone={
                        request.status === 'approved' ? 'brand' : request.status === 'rejected' ? 'danger' : 'warn'
                      }
                      className="capitalize"
                    >
                      {request.status}
                    </Chip>
                  </td>
                </tr>
              ))}
            </AdminTable>
            <ContextCard title="Queue context & next steps">
              {rows.filter((r) => r.status === 'pending').length} of {rows.length} requests still need a decision. Each
              decision records the acting admin, the reason and a timestamp.
            </ContextCard>
          </>
        )}
      </AdminCollectionState>
    </AdminPage>
  );
}

const CHECKLIST = [
  'Name matches the ServMate profile',
  'Document is readable and not expired',
  'Address is inside the provider’s service area',
];

export function AdminVerificationReviewPage() {
  const { id } = useParams();
  const queue = useAdminCollection<VerificationRequest>('verifications');
  const decision = useAdminDecision();

  return (
    <AdminCollectionState collection={queue}>
      {(rows) => {
        const request = rows.find((r) => r.id === id);
        if (!request) {
          return (
            <AdminPage
              title="Verification request not found"
              subtitle={`No document with id ${id} in the verifications collection`}
            />
          );
        }
        return (
          <AdminPage
            title="Verification review workspace"
            subtitle={`${request.id} · ${request.name} · ${request.type}`}
            actions={
              <Chip
                small
                tone={request.status === 'approved' ? 'brand' : request.status === 'rejected' ? 'danger' : 'warn'}
                className="capitalize"
              >
                {request.status}
              </Chip>
            }
          >
            <div className="mt-4 flex gap-4 max-lg:flex-col">
              <div className="min-w-0 flex-1">
                <section className="card p-5">
                  <h2 className="text-[14px] font-semibold">Submitted document</h2>
                  <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                    Submitted {request.submitted} · {request.docs} file{request.docs === 1 ? '' : 's'} attached
                  </p>
                  <div className="mt-4">
                    <DocumentPreview kind={request.type || 'Identity'} />
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-[10.5px] text-[var(--color-muted-2)]">
                    <ShieldCheck size={13} /> Documents are private. Only the assigned reviewer opens the file.
                  </p>
                  <div className="mt-4 space-y-2 text-[12px]">
                    {CHECKLIST.map((item) => (
                      <label key={item} className="flex items-center gap-2">
                        <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--color-brand)]" /> {item}
                      </label>
                    ))}
                  </div>
                </section>

                <section className="card mt-4 p-5">
                  <h2 className="text-[14px] font-semibold">Reviewer decision</h2>
                  <label className="label mt-3" htmlFor="verification-reason">
                    Reason
                  </label>
                  <textarea
                    id="verification-reason"
                    className="field text-[12.5px]"
                    rows={3}
                    value={decision.reason}
                    onChange={(event) => decision.setReason(event.target.value)}
                    placeholder="Hindi pa napapalitan — the reason the server records with this decision."
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
                  onClick={() => void decision.submit('verification', request.id, 'approved')}
                >
                  {decision.pending ? 'Submitting…' : 'Approve'}
                </Button>
                <Button
                  small
                  variant="outline"
                  block
                  disabled={decision.pending}
                  onClick={() => void decision.submit('verification', request.id, 'rejected')}
                >
                  Reject
                </Button>
              </RailActions>
            </div>
          </AdminPage>
        );
      }}
    </AdminCollectionState>
  );
}
