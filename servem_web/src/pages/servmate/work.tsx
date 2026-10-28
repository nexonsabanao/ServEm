import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Check, Inbox, MessageSquare, ShieldCheck } from 'lucide-react';
import {
  Avatar,
  Button,
  Callout,
  Card,
  Chip,
  EmptyState,
  FooterNote,
  LinkButton,
  MapSketch,
  PageHeader,
  SectionHead,
  Skeleton,
  StatusPill,
  TextArea,
} from '../../components/ui';
import { Toggle } from '../../components/Toggle';
import { useApp } from '../../state/AppState';
import { fetchOwnServmate, saveServmateProfile } from '../../lib/db';
import { formatPhilippinePeso } from '../../lib/localization';
import type { Booking, BookingStatus } from '../../lib/types';

const money = (amount: number) => formatPhilippinePeso(amount);

/** What the ServMate takes home: hourly rate × booked hours (customer fee excluded). */
const payout = (booking: Booking) => Math.round(booking.rate * booking.hours);

const firstName = (booking: Booking) => booking.customer.split(' ')[0] || 'your customer';

function useProviderJobs(statuses?: BookingStatus[]) {
  const { providerBookings } = useApp();
  return providerBookings.filter((booking) => !statuses || statuses.includes(booking.status));
}

/** The exact address is only meaningful once a booking is accepted. */
function generalArea(booking: Booking) {
  return booking.status === 'pending' ? 'Exact address shared after you accept' : booking.address;
}

function BookingSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-3 h-3 w-56" />
      <Skeleton className="mt-2 h-3 w-32" />
    </Card>
  );
}

function SyncSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="mt-4 space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <BookingSkeleton key={index} />
      ))}
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-3 rounded-[8px] bg-[#fbeceb] px-3 py-2 text-[12px] text-[var(--color-danger)]">
      {message}
    </p>
  );
}

function errorText(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

/** Availability lives on the ServMate's own directory row, so it survives reloads. */
function useAvailability() {
  const { user, profile } = useApp();
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchOwnServmate(user.uid)
      .then((row) => {
        if (!alive || !row) return;
        setAvailable(row['status'] !== 'paused');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user]);

  const update = async (next: boolean) => {
    if (!user || busy) return;
    const previous = available;
    setAvailable(next);
    setBusy(true);
    setError(null);
    try {
      const row = await fetchOwnServmate(user.uid);
      await saveServmateProfile(user.uid, {
        name: typeof row?.['name'] === 'string' && row['name'] ? row['name'] : profile.name,
        bio: typeof row?.['bio'] === 'string' ? row['bio'] : '',
        area: typeof row?.['area'] === 'string' && row['area'] ? row['area'] : profile.city,
        skills: Array.isArray(row?.['skills']) ? (row['skills'] as string[]) : [],
        available: next,
      });
    } catch (reason) {
      setAvailable(previous);
      setError(errorText(reason, 'Could not update your availability. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return { available, busy, error, update };
}

export function MateDashboardPage() {
  const { profile, status: syncStatus, reviews, changeBookingStatus, cancelBooking } = useApp();
  const pending = useProviderJobs(['pending']);
  const schedule = useProviderJobs(['accepted', 'confirmed', 'in_progress']);
  const completed = useProviderJobs(['completed']);
  const availability = useAvailability();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const navigate = useNavigate();

  const earnings = completed.reduce((sum, booking) => sum + payout(booking), 0);
  const rated = profile.name
    ? reviews.filter((review) => review.target === profile.name && review.rating > 0)
    : [];
  const rating = rated.length ? rated.reduce((sum, review) => sum + review.rating, 0) / rated.length : 0;
  const first = pending[0];
  const loading = syncStatus === 'connecting' && !pending.length && !schedule.length;

  const respond = async (booking: Booking, accept: boolean) => {
    setBusyId(booking.id);
    setDecisionError(null);
    try {
      if (accept) await changeBookingStatus(booking.id, 'accept');
      else await cancelBooking(booking.id, 'Declined by ServMate');
    } catch (reason) {
      setDecisionError(errorText(reason, 'Could not update that request. Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title={profile.name ? `Hi, ${profile.name.split(' ')[0]}` : 'Welcome back'}
        subtitle="A good day to lend a hand."
      />
      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium">Available for work</p>
          <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
            {availability.available ? 'You’re visible to nearby customers' : 'Your profile is paused in search'}
          </p>
        </div>
        <Toggle
          checked={availability.available}
          onChange={(next) => void availability.update(next)}
          disabled={availability.busy}
          label="Available for work"
        />
      </div>
      {availability.error ? <InlineError message={availability.error} /> : null}

      <div className="mt-4 grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <div className="stat">
          <p className="text-[11.5px] text-[#3e5a4e]">Completed earnings</p>
          <p className="stat-value text-[var(--color-brand-deep)]">{money(earnings)}</p>
          <p className="mt-1 text-[11px] text-[#4b6a5c]">
            {completed.length} completed job{completed.length === 1 ? '' : 's'} · customer fee excluded
          </p>
        </div>
        <div className="stat">
          <p className="text-[11.5px] text-[#3e5a4e]">New requests</p>
          <p className="stat-value text-[var(--color-brand-deep)]">
            {pending.length ? `${pending.length} new` : 'None'}
          </p>
          <p className="mt-1 text-[11px] text-[#4b6a5c]">
            {pending.length ? 'Neighbors waiting for a reply' : 'You’re all caught up'}
          </p>
        </div>
        <div className="stat">
          <p className="text-[11.5px] text-[#3e5a4e]">Customer rating</p>
          <p className="stat-value text-[var(--color-brand-deep)]">{rating ? rating.toFixed(1) : '—'}</p>
          <p className="mt-1 text-[11px] text-[#4b6a5c]">
            {rated.length ? `${rated.length} review${rated.length === 1 ? '' : 's'}` : 'No reviews yet'}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[1.05fr_1fr] gap-6 max-lg:grid-cols-1">
        <section>
          <SectionHead title={`New requests · ${pending.length} new`} />
          {loading ? (
            <SyncSkeleton rows={1} />
          ) : first ? (
            <Card className="mt-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13.5px] font-medium">{first.service}</p>
                <p className="text-[13.5px] font-medium">{money(payout(first))}</p>
              </div>
              <div className="mt-2 space-y-0.5 text-[12px] text-[var(--color-muted)]">
                <p>{first.customer} · Customer</p>
                <p>
                  {first.date} · {first.time} · {first.hours} hour{first.hours === 1 ? '' : 's'}
                </p>
                <p>{generalArea(first)}</p>
              </div>
              {decisionError ? <InlineError message={decisionError} /> : null}
              <div className="mt-4 flex gap-3">
                <Button
                  className="flex-1"
                  disabled={busyId === first.id}
                  onClick={() => void respond(first, true)}
                >
                  {busyId === first.id ? 'Saving…' : 'Accept'}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={busyId === first.id}
                  onClick={() => void respond(first, false)}
                >
                  Decline
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="mt-3 p-5">
              <p className="text-[13px] font-medium">No new requests right now</p>
              <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                New bookings in your area will appear here. Keep your services and area up to date.
              </p>
              <Link to="/mate/services" className="link mt-3 inline-flex min-h-[24px] items-center text-[12px]">
                Review your services →
              </Link>
            </Card>
          )}
          <div className="tip mt-4">
            <p className="font-medium">Address privacy</p>
            <p className="mt-1">Only general areas appear until you accept a request.</p>
          </div>
        </section>

        <section>
          <SectionHead
            title="Next on your schedule"
            action={
              <button
                type="button"
                onClick={() => navigate('/mate/jobs')}
                className="link inline-flex min-h-[24px] items-center text-[12px]"
              >
                View all
              </button>
            }
          />
          <Card className="mt-3 p-5">
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : schedule.length ? (
              <div className="space-y-3">
                {schedule.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-[12px]">
                    <div className="min-w-0">
                      <p className="truncate text-[var(--color-ink-2)]">{item.service}</p>
                      <p className="text-[var(--color-muted)]">
                        {item.date} · {item.time}
                      </p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-[var(--color-muted)]">
                Nothing scheduled yet. Accepted requests move here.
              </p>
            )}
          </Card>
          <Card className="mt-4 p-5">
            <p className="card-title">Messages</p>
            <p className="mt-2 text-[12px] text-[var(--color-muted)]">
              Open a booking to message its customer.
            </p>
            <Link to="/mate/messages" className="btn btn-ghost btn-block mt-4">
              Open messages
            </Link>
          </Card>
        </section>
      </div>
      <FooterNote />
    </>
  );
}

export function MateRequestsPage() {
  const { status: syncStatus } = useApp();
  const pending = useProviderJobs(['pending']);
  const answered = useProviderJobs(['accepted', 'confirmed', 'in_progress', 'completed']);
  const [tab, setTab] = useState<'new' | 'responded'>('new');
  const rows = tab === 'new' ? pending : answered;
  const loading = syncStatus === 'connecting' && !pending.length && !answered.length;

  return (
    <>
      <PageHeader title="New requests" subtitle="A little care, from first request to final tidy-up." />
      <div className="mt-5 flex items-center gap-1 rounded-[10px] bg-[#f1f5f2] p-1.5 text-[12.5px]">
        <button
          type="button"
          onClick={() => setTab('new')}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${
            tab === 'new' ? 'bg-white font-medium shadow-sm' : 'text-[var(--color-muted)]'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" /> New ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('responded')}
          className={`rounded-md px-3 py-1.5 ${
            tab === 'responded' ? 'bg-white font-medium shadow-sm' : 'text-[var(--color-muted)]'
          }`}
        >
          Responded ({answered.length})
        </button>
      </div>

      {loading ? (
        <SyncSkeleton rows={2} />
      ) : rows.length ? (
        <div className="mt-4 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
          {rows.map((request) => (
            <Card key={request.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] font-medium">{request.service}</p>
                <StatusPill status={request.status} />
              </div>
              <div className="mt-2 space-y-0.5 text-[12px] text-[var(--color-muted)]">
                <p>{request.customer} · Customer</p>
                <p>
                  {request.date} · {request.time} · {request.hours} hour{request.hours === 1 ? '' : 's'}
                </p>
                <p>{generalArea(request)}</p>
                {request.notes ? <p className="line-clamp-2">{request.notes}</p> : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[12px] font-medium text-[var(--color-brand-deep)]">
                  {money(payout(request))} · your earnings
                </p>
                <Link to={`/mate/requests/${request.id}`} className="link text-[12px]">
                  {tab === 'new' ? 'Review request' : 'View job'} →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          icon={<Inbox size={22} />}
          title={tab === 'new' ? 'No new requests' : 'Nothing responded to yet'}
          body={
            tab === 'new'
              ? 'New bookings in your area will appear here. Make sure your services are live and your area is current.'
              : 'Requests you accept show up here with their live booking status.'
          }
          action={
            tab === 'new' ? (
              <LinkButton to="/mate/services" variant="ghost">
                Review your services
              </LinkButton>
            ) : (
              <LinkButton to="/mate/jobs" variant="ghost">
                Open my jobs
              </LinkButton>
            )
          }
        />
      )}

      <div className="mt-4 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
        <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">A little privacy, by design</p>
        <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
          Only the general area is shown until you accept. Exact addresses unlock after an accepted request.
        </p>
      </div>
      <FooterNote />
    </>
  );
}

export function MateRequestDetailPage() {
  const { status: syncStatus, changeBookingStatus, cancelBooking } = useApp();
  const jobs = useProviderJobs();
  const { id } = useParams();
  const job = jobs.find((row) => row.id === id);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!job) {
    if (syncStatus === 'connecting') {
      return (
        <>
          <PageHeader title="Review request" subtitle="A little care, from first request to final tidy-up." />
          <SyncSkeleton rows={2} />
        </>
      );
    }
    return (
      <>
        <PageHeader title="Review request" subtitle="A little care, from first request to final tidy-up." />
        <EmptyState
          className="mt-5"
          icon={<Inbox size={22} />}
          title="Request not found"
          body="This request may have been cancelled or assigned to another ServMate."
          action={<LinkButton to="/mate/requests">Back to requests</LinkButton>}
        />
        <FooterNote />
      </>
    );
  }

  const decide = async (accept: boolean) => {
    setBusy(accept ? 'accept' : 'decline');
    setFailed(null);
    try {
      if (accept) {
        await changeBookingStatus(job.id, 'accept');
        navigate(`/mate/jobs/${job.id}`);
      } else {
        await cancelBooking(job.id, 'Declined by ServMate');
        navigate('/mate/requests');
      }
    } catch (reason) {
      setFailed(errorText(reason, 'Could not update that request. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Review request" subtitle="A little care, from first request to final tidy-up." />
      <div className="mt-4">
        <StatusPill status={job.status} />
      </div>
      <div className="mt-3 flex gap-6 max-lg:flex-col">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-medium">
            {job.service} · {job.customer}
          </h2>
          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
            {job.id} · {job.date} · {job.time} · {job.hours} hour{job.hours === 1 ? '' : 's'}
          </p>

          <Card className="mt-4 p-5">
            <h3 className="card-title">Customer notes</h3>
            <p className="mt-2 text-[12.5px] leading-[1.7] text-[var(--color-muted)]">
              {job.notes || 'The customer did not add a note to this booking.'}
            </p>
          </Card>

          <Card className="mt-4 p-5">
            <h3 className="card-title">Service area</h3>
            <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{generalArea(job)}</p>
            <MapSketch className="mt-4" />
            <p className="mt-2 text-[11px] text-[var(--color-muted-2)]">
              Illustrative map · not a live location.
            </p>
          </Card>

          {job.status === 'pending' ? (
            <div className="mt-4 rounded-[12px] bg-[var(--color-soft)] px-5 py-3.5">
              <p className="text-[12.5px] font-medium text-[var(--color-brand-deep)]">
                Exact address and contact details stay hidden
              </p>
              <p className="mt-0.5 text-[11.5px] text-[#3e5a4e]">
                These details are shared only after you accept this request.
              </p>
            </div>
          ) : null}

          {failed ? <InlineError message={failed} /> : null}

          {job.status === 'pending' ? (
            <div className="mt-4 flex gap-3">
              <Button className="flex-[1.2]" disabled={busy !== null} onClick={() => void decide(true)}>
                {busy === 'accept' ? 'Accepting…' : 'Accept request'}
              </Button>
              <Button variant="ghost" className="flex-1" disabled={busy !== null} onClick={() => void decide(false)}>
                {busy === 'decline' ? 'Declining…' : 'Decline request'}
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
              <Check size={15} className="text-[var(--color-brand)]" />
              <span>This request is {job.status.replace('_', ' ')}.</span>
              <Link to={`/mate/jobs/${job.id}`} className="link">
                Open the job →
              </Link>
            </div>
          )}
        </div>

        <aside className="flex w-[240px] shrink-0 flex-col gap-4 max-lg:w-full">
          <Card className="p-5">
            <p className="text-[13.5px] font-medium">{job.customer}</p>
            <p className="mt-1 text-[11.5px] text-[var(--color-muted)]">Customer</p>
            <p className="mt-1 text-[11.5px] text-[var(--color-muted-2)]">Contact hidden until accepted</p>
            <Link to="/mate/messages" className="btn btn-ghost btn-block mt-4">
              Open messages
            </Link>
          </Card>
          <div className="rounded-[12px] bg-[var(--color-soft)] p-5">
            <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">
              Your earnings · {money(payout(job))}
            </p>
            <p className="mt-1 text-[11.5px] text-[#3e5a4e]">
              {job.hours} hour{job.hours === 1 ? '' : 's'} × {money(job.rate)}
            </p>
            <p className="mt-0.5 text-[11.5px] text-[#3e5a4e]">Customer fee is excluded from provider earnings.</p>
          </div>
          <Callout title="Job management">
            Progress is manual. No live location, real job processing or money transfers.
          </Callout>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}

export function MyJobsPage() {
  const { status: syncStatus } = useApp();
  const jobs = useProviderJobs();
  const [tab, setTab] = useState<'all' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const shown = tab === 'all' ? jobs : jobs.filter((job) => job.status === tab);
  const loading = syncStatus === 'connecting' && !jobs.length;
  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <>
      <PageHeader title="My jobs" subtitle="A little care, from first request to final tidy-up." />
      <div className="mt-5 flex gap-2 overflow-x-auto">
        {tabs.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTab(option.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] ${
              tab === option.key
                ? 'bg-[var(--color-soft)] font-medium text-[var(--color-brand-deep)]'
                : 'text-[var(--color-muted)]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SyncSkeleton rows={3} />
      ) : shown.length ? (
        <div className="mt-4 space-y-3">
          {shown.map((job) => (
            <Card key={job.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium">
                    {job.service} · {money(payout(job))}
                  </p>
                  <div className="mt-1.5 space-y-0.5 text-[12px] text-[var(--color-muted)]">
                    <p>{job.customer} · Customer</p>
                    <p>
                      {job.date} · {job.time}
                    </p>
                    <p className="break-words">
                      {job.id} · {generalArea(job)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusPill status={job.status} />
                  <Link to={`/mate/jobs/${job.id}`} className="link text-[12px]">
                    View job →
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          icon={<CalendarDays size={22} />}
          title="No jobs here yet"
          body="Accept a new request and it will appear in this list with its live status."
          action={<LinkButton to="/mate/requests">See new requests</LinkButton>}
        />
      )}

      <div className="mt-4 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
        <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">A job well done, every time</p>
        <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
          Update the job before you arrive, and wrap up with a summary for your customer.
        </p>
      </div>
      <FooterNote />
    </>
  );
}

export function MateJobPage({ mode = 'detail' }: { mode?: 'detail' | 'en-route' | 'updates' | 'wrap-up' }) {
  const { status: syncStatus, changeBookingStatus, sendMessage } = useApp();
  const jobs = useProviderJobs();
  const { id } = useParams();
  const job = jobs.find((row) => row.id === id);
  const [note, setNote] = useState('');
  const [update, setUpdate] = useState('On my way');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  if (!job) {
    if (syncStatus === 'connecting') {
      return (
        <>
          <PageHeader title="Your job" subtitle="A little care, from first request to final tidy-up." />
          <SyncSkeleton rows={2} />
        </>
      );
    }
    return (
      <>
        <PageHeader title="Your job" subtitle="A little care, from first request to final tidy-up." />
        <EmptyState
          className="mt-5"
          icon={<Inbox size={22} />}
          title="Job not found"
          body="This booking may have been cancelled or assigned to another ServMate."
          action={<LinkButton to="/mate/jobs">Back to my jobs</LinkButton>}
        />
        <FooterNote />
      </>
    );
  }

  const titles = {
    detail: 'Your confirmed job',
    'en-route': 'On your way',
    updates: `Keep ${firstName(job)} up to date`,
    'wrap-up': 'Wrap up the job',
  };
  const steps = ['Accepted', 'In progress', 'Completed'];
  const current = job.status === 'completed' ? 3 : job.status === 'in_progress' ? 2 : 1;
  const who = firstName(job);

  const run = async (task: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setFailed(null);
    try {
      await task();
    } catch (reason) {
      setFailed(errorText(reason, fallback));
    } finally {
      setBusy(false);
    }
  };

  const startJob = () =>
    run(async () => {
      await changeBookingStatus(job.id, 'start');
      navigate(`/mate/jobs/${job.id}/wrap-up`);
    }, 'Could not update this job. Please try again.');

  const completeJob = () =>
    run(async () => {
      const summary = note.trim();
      if (summary) await sendMessage(job.id, `Work summary: ${summary}`);
      await changeBookingStatus(job.id, 'complete');
      navigate(`/mate/jobs/${job.id}`);
    }, 'Could not complete this job. Please try again.');

  const sendUpdate = () =>
    run(async () => {
      const extra = note.trim();
      await sendMessage(job.id, extra ? `${update} — ${extra}` : update);
      setSent(true);
      setNote('');
    }, 'Could not send that update. Please try again.');

  return (
    <>
      <PageHeader title={titles[mode]} subtitle={`${job.id} · ${job.service} · ${job.customer}`} />
      <div className="mt-4">
        <StatusPill status={job.status} />
      </div>

      <div className="mt-3 flex gap-6 max-lg:flex-col">
        <div className="min-w-0 flex-1">
          <Card className="p-5">
            <h2 className="card-title">{job.service}</h2>
            <div className="mt-2 space-y-0.5 text-[12px] text-[var(--color-muted)]">
              <p>
                {job.date} · {job.time}
              </p>
              <p>{job.customer} · Customer</p>
            </div>

            {mode !== 'updates' ? (
              <div className="mt-5 space-y-3">
                {steps.map((label, index) => (
                  <div key={label} className="flex items-center gap-2.5 text-[13px]">
                    <span
                      className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                        index + 1 < current
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                          : index + 1 === current
                            ? 'border-[var(--color-brand)] bg-white text-[var(--color-brand)]'
                            : 'border-[#cfdcd5] bg-white'
                      }`}
                    >
                      {index + 1 < current ? <Check size={9} strokeWidth={3} /> : null}
                    </span>
                    <span className={index + 1 === current ? 'font-medium' : 'text-[var(--color-ink-2)]'}>
                      {label}
                    </span>
                    {index + 1 === current && current < 3 ? <Chip small>Current</Chip> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          {mode === 'detail' ? (
            <Card className="mt-4 p-5">
              <h2 className="card-title">Confirmed service address</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{job.address}</p>
              <MapSketch className="mt-3" />
              <p className="mt-2 text-[11px] text-[var(--color-muted-2)]">Illustrative map · not a live location.</p>
              {failed ? <InlineError message={failed} /> : null}
              {job.status === 'accepted' || job.status === 'confirmed' ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button onClick={() => navigate(`/mate/jobs/${job.id}/en-route`)}>I’m on my way</Button>
                  <Button variant="ghost" onClick={() => navigate(`/mate/jobs/${job.id}/updates`)}>
                    Message {who}
                  </Button>
                </div>
              ) : job.status === 'in_progress' ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button onClick={() => navigate(`/mate/jobs/${job.id}/wrap-up`)}>Finish the job</Button>
                  <Button variant="ghost" onClick={() => navigate(`/mate/jobs/${job.id}/updates`)}>
                    Message {who}
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-3">
                  <LinkButton to="/mate/jobs" variant="ghost">
                    Back to my jobs
                  </LinkButton>
                </div>
              )}
            </Card>
          ) : null}

          {mode === 'en-route' ? (
            <Card className="mt-4 p-5">
              <h2 className="card-title">Your arrival</h2>
              <p className="mt-2 text-[12.5px] text-[var(--color-muted)]">
                Share a short, useful update. No live location is shared with the customer.
              </p>
              {failed ? <InlineError message={failed} /> : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button disabled={busy || job.status === 'in_progress'} onClick={() => void startJob()}>
                  {job.status === 'in_progress' ? 'Already in progress' : busy ? 'Saving…' : 'Mark as arrived'}
                </Button>
                <Button variant="ghost" onClick={() => navigate(`/mate/jobs/${job.id}/updates`)}>
                  Send an update
                </Button>
              </div>
            </Card>
          ) : null}

          {mode === 'updates' ? (
            <Card className="mt-4 p-5">
              <label className="label" htmlFor="quick-update">
                Quick update
              </label>
              <select
                id="quick-update"
                className="field"
                value={update}
                onChange={(event) => setUpdate(event.target.value)}
              >
                <option>On my way</option>
                <option>Running about 10 minutes behind</option>
                <option>Arrived, starting shortly</option>
                <option>All finished — thank you!</option>
              </select>
              <TextArea
                label="Add a note (optional)"
                rows={3}
                className="mt-3"
                placeholder="Anything helpful for your customer?"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              {failed ? <InlineError message={failed} /> : null}
              <Button block className="mt-4" disabled={busy} onClick={() => void sendUpdate()}>
                {busy ? 'Sending…' : 'Send update'}
              </Button>
              {sent ? (
                <p className="mt-3 flex items-center gap-2 text-[12px] text-[var(--color-brand)]">
                  <Check size={14} /> Update sent to {who}
                </p>
              ) : null}
            </Card>
          ) : null}

          {mode === 'wrap-up' ? (
            <Card className="mt-4 p-5">
              <h2 className="card-title">Work summary</h2>
              <TextArea
                label="What was completed?"
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-3"
                placeholder="Share a short summary — it is sent to your customer in Messages."
              />
              <p className="mt-3 text-[11.5px] text-[var(--color-muted)]">
                Photo attachments arrive with the mobile app; you can send photos in Messages today.
              </p>
              <div className="mt-4 flex items-center justify-between rounded-[10px] bg-[var(--color-soft)] px-4 py-3 text-[12.5px]">
                <span className="text-[#3e5a4e]">Your earnings</span>
                <span className="font-medium text-[var(--color-brand-deep)]">{money(payout(job))}</span>
              </div>
              {failed ? <InlineError message={failed} /> : null}
              <Button
                block
                className="mt-4"
                disabled={busy || job.status === 'completed'}
                onClick={() => void completeJob()}
              >
                {job.status === 'completed' ? 'Completed' : busy ? 'Saving…' : 'Mark job complete'}
              </Button>
            </Card>
          ) : null}
        </div>

        <aside className="flex w-[240px] shrink-0 flex-col gap-4 max-lg:w-full">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar src={job.photo} name={job.customer} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{job.customer}</p>
                <p className="mt-0.5 break-words text-[11px] text-[var(--color-muted)]">{job.address}</p>
              </div>
            </div>
            <Link to="/mate/messages" className="btn btn-ghost btn-block mt-4">
              Open messages
            </Link>
          </Card>
          <div className="rounded-[12px] bg-[var(--color-soft)] p-5">
            <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">
              Your earnings · {money(payout(job))}
            </p>
            <p className="mt-1 text-[11.5px] text-[#3e5a4e]">Customer fee is excluded from provider earnings.</p>
          </div>
          <Callout title="Job management">
            Progress is manual. No live location, real job processing or money transfers.
          </Callout>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}

export function JobCancelledPage() {
  const { status: syncStatus } = useApp();
  const jobs = useProviderJobs();
  const { id } = useParams();
  const job = jobs.find((row) => row.id === id);

  if (!job) {
    if (syncStatus === 'connecting') {
      return (
        <>
          <PageHeader title="Job cancelled" />
          <SyncSkeleton rows={1} />
        </>
      );
    }
    return (
      <>
        <PageHeader title="Job cancelled" />
        <EmptyState
          className="mt-5"
          icon={<Inbox size={22} />}
          title="Booking not found"
          body="This booking is not in your account any more."
          action={<LinkButton to="/mate/jobs">Back to my jobs</LinkButton>}
        />
        <FooterNote />
      </>
    );
  }

  const reason = (job as Booking & { cancellationReason?: string }).cancellationReason;

  return (
    <>
      <PageHeader title="Job cancelled" subtitle={`${job.id} · ${job.service}`} />
      <div className="mt-4 rounded-[12px] bg-[#fbeceb] px-5 py-4">
        <p className="text-[13px] font-medium text-[var(--color-danger)]">Cancellation reason</p>
        <p className="mt-1 text-[12.5px] text-[#8a4a45]">
          {reason || 'This booking is cancelled. No payment was taken for the cancelled service.'}
        </p>
      </div>
      <Card className="mt-4 p-5">
        <h2 className="card-title">{job.service}</h2>
        <div className="mt-2 space-y-0.5 text-[12px] text-[var(--color-muted)]">
          <p>{job.customer} · Customer</p>
          <p>
            {job.date} · {job.time}
          </p>
          <p className="break-words">{job.address}</p>
        </div>
        <Link to="/mate/requests" className="btn btn-primary btn-block mt-4">
          Return to requests
        </Link>
      </Card>
      <FooterNote />
    </>
  );
}

export function NewTimeRequestPage() {
  const { status: syncStatus } = useApp();
  const jobs = useProviderJobs();
  const { id } = useParams();
  const job = jobs.find((row) => row.id === id);

  if (!job) {
    if (syncStatus === 'connecting') {
      return (
        <>
          <PageHeader title="Schedule changes" />
          <SyncSkeleton rows={1} />
        </>
      );
    }
    return (
      <>
        <PageHeader title="Schedule changes" />
        <EmptyState
          className="mt-5"
          icon={<CalendarDays size={22} />}
          title="Booking not found"
          body="This booking is not in your account any more."
          action={<LinkButton to="/mate/jobs">Back to my jobs</LinkButton>}
        />
        <FooterNote />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Schedule changes" subtitle={`${job.id} · ${job.service}`} />
      <div className="mt-4 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
        <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">One confirmed time per booking</p>
        <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
          If your customer reschedules, the booking updates here and you will see it in Notifications. Nothing is
          waiting for your reply right now.
        </p>
      </div>
      <div className="mt-4">
        <Card className="p-5">
          <p className="text-[12.5px] font-medium">Confirmed booking</p>
          <p className="mt-2 text-[13px]">
            {job.date} · {job.time}
          </p>
          <p className="mt-1 text-[11.5px] text-[var(--color-muted)]">
            {job.customer} · {job.service}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <LinkButton to={`/mate/jobs/${job.id}`} variant="ghost">
              Open the job
            </LinkButton>
            <LinkButton to="/mate/jobs" variant="ghost">
              Back to my jobs
            </LinkButton>
          </div>
        </Card>
      </div>
      <FooterNote />
    </>
  );
}

export function MateMessagesPage() {
  const { threads, status: syncStatus, sendMessage } = useApp();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const active = threads.find((thread) => thread.id === activeId) ?? threads[0];

  const submit = async () => {
    if (!active) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setFailed(null);
    try {
      await sendMessage(active.id, text);
      setDraft('');
    } catch (reason) {
      setFailed(errorText(reason, 'Could not send that message. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Customer messages" subtitle="Keep the details in one place." />
      <div className="mt-5 flex min-h-[440px] flex-col overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-white md:flex-row">
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-[var(--color-line)] p-3 md:block md:max-h-[560px] md:w-[230px] md:gap-0 md:overflow-y-auto md:border-b-0 md:border-r">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setActiveId(thread.id)}
              className={`w-[180px] shrink-0 rounded-[8px] px-3 py-2.5 text-left md:w-full md:shrink ${
                thread.id === active?.id ? 'bg-[var(--color-soft)]' : 'hover:bg-[#f8fbf9]'
              }`}
            >
              <p className="truncate text-[12.5px] font-medium">{thread.name}</p>
              <p className="mt-0.5 truncate text-[10.5px] text-[var(--color-muted)]">{thread.updated}</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">
                {thread.messages.at(-1)?.text}
              </p>
            </button>
          ))}
          {!threads.length ? (
            <p className="px-3 py-4 text-[11.5px] text-[var(--color-muted)] md:px-0">
              {syncStatus === 'connecting' ? 'Loading conversations…' : 'No conversations yet.'}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          {active ? (
            <>
              <div className="flex items-center gap-3 border-b border-[var(--color-line-2)] px-5 py-3.5">
                <Avatar src={active.photo} name={active.name} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{active.name}</p>
                  <p className="text-[10.5px] text-[var(--color-muted)]">{active.role}</p>
                </div>
                <span className="ml-auto shrink-0 text-[10.5px] text-[var(--color-muted-2)]">{active.updated}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {active.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[300px] rounded-[10px] px-3.5 py-2.5 text-[12.5px] leading-[1.55] ${
                        message.from === 'me' ? 'bg-[var(--color-soft)]' : 'bg-[#f1f5f2]'
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                {!active.messages.length ? (
                  <p className="text-[12px] text-[var(--color-muted)]">
                    No messages yet. Say hello and confirm the details.
                  </p>
                ) : null}
              </div>
              {failed ? (
                <div className="px-5 pb-2">
                  <InlineError message={failed} />
                </div>
              ) : null}
              <form
                className="flex gap-3 border-t border-[var(--color-line-2)] px-5 py-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <input
                  className="field h-[40px] flex-1 text-[12.5px]"
                  placeholder="Write a message…"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  aria-label="Write a message"
                />
                <Button type="submit" small className="h-[40px] px-6" disabled={busy || !draft.trim()}>
                  {busy ? 'Sending…' : 'Send'}
                </Button>
              </form>
            </>
          ) : (
            <EmptyState
              icon={<MessageSquare size={22} />}
              title={syncStatus === 'connecting' ? 'Loading conversations' : 'No conversations yet'}
              body="A conversation opens with your first message on a booking. Open a job and choose Message."
              action={<LinkButton to="/mate/jobs">Open my jobs</LinkButton>}
              className="border-0"
            />
          )}
        </div>
      </div>
      <FooterNote />
    </>
  );
}

export function MateUpdatesPage() {
  const { threads, status: syncStatus } = useApp();
  const pending = useProviderJobs(['pending']);
  const activeJobs = useProviderJobs(['accepted', 'confirmed', 'in_progress']);
  const [filter, setFilter] = useState<'all' | 'requests' | 'jobs' | 'messages'>('all');
  const loading = syncStatus === 'connecting' && !pending.length && !activeJobs.length && !threads.length;
  const showRequests = filter === 'all' || filter === 'requests';
  const showJobs = filter === 'all' || filter === 'jobs';
  const showMessages = filter === 'all' || filter === 'messages';
  const empty =
    (!showRequests || !pending.length) &&
    (!showJobs || !activeJobs.length) &&
    (!showMessages || !threads.length);
  const filters: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'requests', label: 'Requests' },
    { key: 'jobs', label: 'Jobs' },
    { key: 'messages', label: 'Messages' },
  ];

  return (
    <>
      <PageHeader title="Your updates" subtitle="Your skills. Your neighborhood. Your schedule." />
      <div className="mt-4 flex items-center gap-2 overflow-x-auto rounded-[10px] border border-[var(--color-line)] bg-white px-3 py-2 text-[12px]">
        {filters.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`shrink-0 rounded px-2 py-1 ${
              filter === option.key
                ? 'bg-[var(--color-soft)] font-medium text-[var(--color-brand-deep)]'
                : 'text-[var(--color-muted)]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SyncSkeleton rows={2} />
      ) : empty ? (
        <EmptyState
          className="mt-4"
          icon={<Inbox size={22} />}
          title="Nothing new right now"
          body="New requests, job reminders and messages will show up here."
        />
      ) : (
        <div className="mt-4 space-y-3">
          {showRequests
            ? pending.map((request) => (
                <Card key={`request-${request.id}`} className="p-5">
                  <p className="text-[13px] font-medium">
                    {request.service} · {money(payout(request))}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                    {request.customer} sent a request for {request.date} · {request.time}.
                  </p>
                  <Link to={`/mate/requests/${request.id}`} className="link mt-2 inline-flex text-[12px]">
                    Review request →
                  </Link>
                </Card>
              ))
            : null}
          {showJobs
            ? activeJobs.map((job) => (
                <Card key={`job-${job.id}`} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-medium">
                      {job.service} with {job.customer}
                    </p>
                    <StatusPill status={job.status} />
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                    {job.date} · {job.time}
                  </p>
                  <Link to={`/mate/jobs/${job.id}`} className="link mt-2 inline-flex text-[12px]">
                    Open the job →
                  </Link>
                </Card>
              ))
            : null}
          {showMessages
            ? threads.map((thread) => (
                <Card key={`thread-${thread.id}`} className="p-5">
                  <p className="text-[13px] font-medium">{thread.name}</p>
                  <p className="mt-1 truncate text-[12px] text-[var(--color-muted)]">
                    {thread.messages.at(-1)?.text ?? 'No messages yet.'}
                  </p>
                  <Link to="/mate/messages" className="link mt-2 inline-flex text-[12px]">
                    Open conversation →
                  </Link>
                </Card>
              ))
            : null}
        </div>
      )}
      <FooterNote />
    </>
  );
}

export function MateAccountPage() {
  const { profile, user } = useApp();
  const availability = useAvailability();

  return (
    <>
      <PageHeader title="Your ServMate account" subtitle="Manage your profile, availability and payouts." />
      <div className="mt-5 grid grid-cols-[1fr_240px] gap-6 max-lg:grid-cols-1">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <Avatar src={profile.photo} name={profile.name} size={64} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{profile.name || 'Your name'}</p>
              <p className="text-[12px] text-[var(--color-muted)]">
                {profile.name || 'ServMate'} · {profile.city || 'Add your city'}
              </p>
              <Chip small className="mt-2">
                {profile.verified ? 'Verified' : 'Verification pending'}
              </Chip>
            </div>
          </div>
          <div className="mt-5 divide-y divide-[var(--color-line-2)] text-[12.5px]">
            {[
              ['Full name', profile.name || 'Not set'],
              ['Email address', profile.email || user?.email || 'Not set'],
              ['Phone number', profile.phone || 'Not set'],
              ['Neighborhood', profile.city || 'Not set'],
              ['Payout method', 'Requested from Earnings'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3">
                <span className="text-[var(--color-muted)]">{label}</span>
                <span className="break-words text-right">{value}</span>
              </div>
            ))}
          </div>
          <LinkButton to="/mate/profile" block className="mt-4">
            Edit public profile
          </LinkButton>
        </Card>
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[12.5px] font-medium">Available for work</p>
                <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                  {availability.available ? 'Visible to nearby customers' : 'Hidden from search'}
                </p>
              </div>
              <Toggle
                checked={availability.available}
                onChange={(next) => void availability.update(next)}
                disabled={availability.busy}
                label="Available for work"
              />
            </div>
            {availability.error ? <InlineError message={availability.error} /> : null}
          </Card>
          <div className="card p-4">
            <p className="flex items-center gap-2 text-[12.5px] font-medium">
              <ShieldCheck size={14} className="text-[var(--color-brand)]" /> Verification
            </p>
            <p className="mt-1 text-[11.5px] leading-[1.6] text-[var(--color-muted)]">
              {profile.verified
                ? 'Your identity documents are on file. Documents are stored privately.'
                : 'Your identity is not verified yet. Upload a document to finish verification.'}{' '}
              <Link to="/mate/verify" className="link">
                {profile.verified ? 'Review verification' : 'Complete verification'}
              </Link>
            </p>
          </div>
          <Link to="/app/home" className="card p-4 text-[12.5px] text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            <span className="flex items-center gap-2">
              <MessageSquare size={14} /> Switch to customer
            </span>
          </Link>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}
