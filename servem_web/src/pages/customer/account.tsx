import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Circle, Search } from 'lucide-react';
import { SiteHeader } from '../../components/SiteHeader';
import { AccountSidebar } from '../../components/AccountSidebar';
import { Toggle } from '../../components/Toggle';
import {
  Avatar,
  Button,
  Card,
  Chip,
  FooterNote,
  LinkButton,
  MapSketch,
  PageHeader,
  Skeleton,
  StatusPill,
  TextInput,
} from '../../components/ui';
import { ProviderCard } from '../../components/cards';
import { formatPhilippinePeso } from '../../lib/localization';
import { useApp } from '../../state/AppState';
import type { Booking, ServMate } from '../../lib/types';

function cityFromAddress(address: string) {
  return address.split('·').pop()?.trim() || '';
}

/** The booking's own ServMate; unknown stats stay zero rather than borrowed. */
function mateForBooking(booking: Booking, mates: ServMate[]): ServMate {
  return (
    mates.find((m) => m.id === booking.providerId || m.uid === booking.providerId) ?? {
      id: booking.providerId,
      uid: booking.providerId,
      name: booking.provider,
      photo: booking.providerPhoto,
      rating: 0,
      reviews: 0,
      jobs: 0,
      rate: booking.rate,
      distance: '',
      area: '',
      skills: [],
      availability: '',
      verified: false,
      bio: '',
      responseTime: '',
      repeat: 0,
      cover: '',
      status: 'active',
    }
  );
}

export function BookingsPage() {
  const { bookings, status } = useApp();
  const loading = status === 'connecting' && bookings.length === 0;
  const [tab, setTab] = useState<'upcoming' | 'active' | 'completed' | 'cancelled'>('upcoming');
  const counts = {
    upcoming: bookings.filter((b) => ['confirmed', 'requested', 'rescheduled'].includes(b.status)).length,
    active: bookings.filter((b) => b.status === 'in_progress').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  };
  const shown = bookings.filter((b) => {
    if (tab === 'upcoming') return ['confirmed', 'requested', 'rescheduled'].includes(b.status);
    if (tab === 'active') return b.status === 'in_progress';
    if (tab === 'completed') return b.status === 'completed';
    return b.status === 'cancelled';
  });

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Your bookings" subtitle="Plans changed? Manage your booking or message your ServMate here." />
        <div className="mt-5 flex items-center gap-1 overflow-x-auto rounded-[10px] bg-[#f1f5f2] p-1.5 text-[12.5px]">
          {(['upcoming', 'active', 'completed', 'cancelled'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 capitalize ${
                tab === key ? 'bg-white font-medium text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-muted)]'
              }`}
            >
              {key === 'upcoming' ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
              ) : null}
              {key} ({counts[key]})
            </button>
          ))}
        </div>

        {loading ? (
          <div
            className="mt-5 grid grid-cols-2 gap-5 max-lg:grid-cols-1"
            role="status"
            aria-busy="true"
            aria-label="Loading your bookings"
          >
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="card p-5">
                <Skeleton className="h-4 w-2/3" />
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ) : shown.length ? (
          <div className="mt-5 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
            {shown.map((booking) => (
              <div key={booking.id} className="card p-5">
                <p className="text-[15px] font-medium">
                  {booking.service} · {formatPhilippinePeso(booking.total)}
                </p>
                <div className="mt-2 space-y-0.5 text-[12.5px] text-[var(--color-muted)]">
                  <p className="capitalize">{booking.status.replace('_', ' ')}</p>
                  <p>
                    {booking.provider} · Your ServMate
                  </p>
                  <p>
                    {booking.date} · {booking.time}
                  </p>
                  <p>
                    {booking.id} · {cityFromAddress(booking.address)}
                  </p>
                  <Link to={`/app/bookings/${booking.id}`} className="mt-1 inline-block text-[var(--color-ink-2)] hover:underline">
                    View booking →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card mt-5 flex flex-col items-center px-6 py-16 text-center">
            <h2 className="card-title">Nothing here yet</h2>
            <p className="mt-2 max-w-[380px] text-[13px] text-[var(--color-muted)]">
              When a booking is {tab}, it will appear here with its schedule and messages.
            </p>
            <LinkButton to="/app/explore" variant="ghost" className="mt-5">
              Explore help nearby
            </LinkButton>
          </div>
        )}

        <div className="mt-5 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
          <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">Everyday tasks, taken care of</p>
          <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
            Open a booking for its schedule, contact options and status updates.
          </p>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

const timeline = [
  { key: 'awaiting', label: 'Awaiting provider' },
  { key: 'confirmed', label: 'Accepted / confirmed' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

function bookingStep(booking: Booking) {
  if (booking.status === 'completed') return 4;
  if (booking.status === 'in_progress') return 3;
  if (booking.status === 'requested') return 1;
  return 2;
}

export function BookingDetailPage() {
  const { id } = useParams();
  const { bookings, threads, status, servMates } = useApp();
  const navigate = useNavigate();
  // Never fall back to another booking: a stale link must not show someone
  // else's job as if it were yours.
  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <main className="shell-width pb-4 pt-9">
          {status === 'connecting' ? (
            <div role="status" aria-busy="true" aria-label="Loading your booking">
              <Skeleton className="h-7 w-56" />
              <div className="mt-5 space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-44 w-full" />
              </div>
            </div>
          ) : (
            <div className="card mt-5 px-6 py-16 text-center">
              <h2 className="card-title">That booking could not be found</h2>
              <p className="mx-auto mt-2 max-w-[380px] text-[13px] text-[var(--color-muted)]">
                It may have been cancelled, or the link is out of date. Your other bookings are still in
                your list.
              </p>
              <LinkButton to="/app/bookings" variant="ghost" className="mt-5">
                Back to bookings
              </LinkButton>
            </div>
          )}
        </main>
      </div>
    );
  }

  const step = bookingStep(booking);
  const thread = threads.find((t) => t.name === booking.provider);

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <div className="flex items-start justify-between gap-6">
          <PageHeader
            title="Your booking"
            subtitle={`${booking.id} · ${booking.service} · ${booking.provider}`}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <StatusPill status={booking.status} />
          <span className="text-[12px] text-[var(--color-muted)]">
            {booking.date} · {booking.time}
          </span>
        </div>

        <div className="mt-5 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <div className="space-y-3">
                {timeline.map((item, index) => {
                  const done = index < step - 1;
                  const current = index === step - 1;
                  return (
                    <div key={item.key} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-2.5 text-[13px]">
                        <span
                          className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                            done || current
                              ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                              : 'border-[#cfdcd5] bg-white text-transparent'
                          }`}
                        >
                          {done ? <Check size={9} strokeWidth={3} /> : current ? <Circle size={6} fill="white" /> : null}
                        </span>
                        <span className={current ? 'font-medium' : 'text-[var(--color-ink-2)]'}>{item.label}</span>
                      </span>
                      {current ? <Chip small>Current</Chip> : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3">
                <Chip small tone="neutral">
                  Cancelled · Alternate terminal state
                </Chip>
              </div>
            </Card>

            <Card className="mt-4 p-5">
              <h2 className="card-title">Confirmed service address</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{booking.address}</p>
              <MapSketch className="mt-4" />
              <p className="mt-1.5 text-[11.5px] text-[var(--color-muted-2)]">
                Illustrative map · sample pin, not live location. Confirm the address, not the pin.
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-[24px] items-center text-[12px] text-[var(--color-ink-2)] underline decoration-[var(--color-line)] underline-offset-4"
              >
                View location
              </a>
            </Card>

            <div className="mt-4 flex gap-4">
              <Button variant="ghost" className="flex-1" onClick={() => navigate(`/app/bookings/${booking.id}/reschedule`)}>
                Reschedule
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => navigate(`/app/bookings/${booking.id}/cancel`)}>
                Cancel booking
              </Button>
            </div>
          </div>

          <aside className="flex w-[332px] shrink-0 flex-col gap-4 max-lg:w-full">
            <ProviderCard mate={mateForBooking(booking, servMates)} />
            <div className="rail-card">
              <p className="text-[14.5px] font-medium">Customer total · ₱{booking.total.toFixed(2)}</p>
              <div className="mt-2 space-y-1 text-[12.5px] text-[var(--color-muted)]">
                <p>
                  {booking.hours} hours × ₱{booking.rate} <span className="float-right">₱{(booking.hours * booking.rate).toFixed(2)}</span>
                </p>
                <p>
                  Service fee <span className="float-right">₱{booking.fee.toFixed(2)}</span>
                </p>
                <p className="pt-1">Payment is arranged with your ServMate after the job. ServEm never stores your card details.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (thread) navigate(`/app/messages/${thread.id}`);
                else navigate('/app/messages');
              }}
              className="btn btn-primary btn-block"
            >
              {booking.provider ? `Message ${booking.provider.split(' ')[0]}` : 'Open messages'}
            </button>
            <div className="space-y-2 text-[11.5px] text-[var(--color-muted)]">
              <p>
                {booking.status === 'pending'
                  ? 'Contact details are shared after the booking is accepted.'
                  : 'Keep contact and payments inside ServEm so both sides stay protected.'}
              </p>
              <Link to="/app/help" className="link text-[12px]">
                Get help with this booking
              </Link>
            </div>
          </aside>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function MessagesPage() {
  const { threads, bookings, sendMessage } = useApp();
  const { id } = useParams();
  const [activeId, setActiveId] = useState(id ?? threads[0]?.id);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const stored = threads.find((t) => t.id === activeId) ?? threads[0];
  // A booking can be messaged before anyone has written: the thread is created
  // on the first send, so the composer works from the booking itself.
  const fromRoute = stored || !id ? undefined : bookings.find((row) => row.id === id);
  const active =
    stored ??
    (fromRoute
      ? {
          id: fromRoute.id,
          name: fromRoute.provider || 'your ServMate',
          photo: fromRoute.providerPhoto,
          role: 'Your ServMate',
          updated: '',
          unread: 0,
          messages: [],
        }
      : undefined);
  const booking = active ? bookings.find((row) => row.id === active.id) : undefined;
  const filtered = threads.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const lastTime = active?.messages.at(-1)?.time;

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Messages" subtitle="Keep the details in one place." />
        <div className="mt-5 flex min-h-[470px] flex-col overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-white sm:flex-row">
          <div className="max-h-[220px] w-full shrink-0 overflow-y-auto border-b border-[var(--color-line)] p-4 sm:max-h-none sm:w-[240px] sm:border-b-0 sm:border-r lg:w-[332px]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-2)]" />
              <input
                className="field h-[38px] pl-9 text-[12px]"
                placeholder="Search messages"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="mt-3 space-y-1">
              {filtered.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveId(thread.id)}
                  className={`w-full rounded-[8px] px-3 py-2.5 text-left ${
                    thread.id === active?.id ? 'bg-[var(--color-soft)]' : 'hover:bg-[#f8fbf9]'
                  }`}
                >
                  <p className="text-[13px] font-medium">{thread.name}</p>
                  <p className="mt-0.5 truncate text-[10.5px] text-[var(--color-muted)]">
                    {thread.role.split(' · ')[1] ?? thread.role} · {thread.updated}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-muted)]">
                    {thread.messages.at(-1)?.text}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-[var(--color-line-2)] px-5 py-4">
              <Avatar src={active?.photo} name={active?.name ?? 'ServMate'} size={36} />
              <div>
                <p className="text-[13px] font-medium">{active?.name}</p>
                <p className="text-[10.5px] text-[var(--color-muted)]">
                  {active?.role}
                  {booking ? ` · ${booking.date} · ${booking.time}` : ''}
                </p>
              </div>
              {booking ? (
                <span className="ml-auto">
                  <StatusPill status={booking.status} />
                </span>
              ) : null}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <p className="text-center text-[10.5px] text-[var(--color-muted-2)]">
                {new Date().toLocaleDateString('en-PH', {
                  timeZone: 'Asia/Manila',
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              {active?.messages.map((message) => (
                <div key={message.id} className={`flex ${message.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[320px] rounded-[10px] px-3.5 py-2.5 text-[12.5px] leading-[1.55] ${
                      message.from === 'me'
                        ? 'bg-[var(--color-soft)] text-[var(--color-ink)]'
                        : 'bg-[#f1f5f2] text-[var(--color-ink-2)]'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
              {lastTime ? (
                <p className="text-[10.5px] text-[var(--color-muted-2)]">{lastTime}</p>
              ) : null}
            </div>

            <form
              className="border-t border-[var(--color-line-2)] px-5 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.trim() || !active || sending) return;
                const text = draft.trim();
                setSending(true);
                setSendError(null);
                void sendMessage(active.id, text)
                  .then(() => setDraft(''))
                  .catch((reason: unknown) =>
                    setSendError(
                      reason instanceof Error && reason.message
                        ? reason.message
                        : 'Could not send that message. Please try again.',
                    ),
                  )
                  .finally(() => setSending(false));
              }}
            >
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-2)]" />
                  <input
                    className="field h-[40px] pl-9 text-[12.5px]"
                    placeholder="Write a message…"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    aria-label="Write a message"
                  />
                </div>
                <Button type="submit" small className="h-[40px] px-6" disabled={sending || !draft.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
              {sendError ? (
                <p role="alert" className="mt-2 text-[11px] text-[var(--color-danger)]">
                  {sendError}
                </p>
              ) : null}
              <p className="mt-2 text-[10px] text-[var(--color-muted-2)]">
                Keep it in ServEm. Don’t share sensitive information.
              </p>
            </form>
          </div>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function NotificationsPage() {
  const { notifications, markNotificationsRead } = useApp();
  const [filter, setFilter] = useState<'all' | 'booking' | 'message'>('all');
  const shown = notifications.filter((n) => filter === 'all' || (filter === 'message' ? n.kind === 'message' : n.kind === 'booking'));

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Notifications" subtitle="Manage your neighborhood account." />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <AccountSidebar />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between rounded-[10px] border border-[var(--color-line)] bg-white px-3 py-2 text-[12px]">
              <div className="flex items-center gap-4">
                {[
                  ['all', 'All'],
                  ['booking', 'Bookings'],
                  ['message', 'Messages'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key as typeof filter)}
                    className={`rounded px-2 py-1 ${
                      filter === key ? 'bg-[var(--color-soft)] font-medium text-[var(--color-brand-deep)]' : 'text-[var(--color-muted)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={markNotificationsRead} className="link text-[11.5px]">
                Mark all as read
              </button>
            </div>

            <Card className="mt-4 p-5">
              <h2 className="text-[13.5px] font-semibold">Today</h2>
              <div className="mt-3 space-y-3">
                {shown.map((note) => (
                  <div key={note.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12.5px] font-medium">{note.title}</p>
                      <p className="mt-0.5 max-w-[520px] text-[12px] leading-[1.55] text-[var(--color-muted)]">{note.body}</p>
                    </div>
                    <span className="shrink-0 text-[10.5px] text-[var(--color-muted-2)]">{note.time}</span>
                  </div>
                ))}
                {shown.length === 0 ? <p className="text-[12.5px] text-[var(--color-muted)]">No notifications here yet.</p> : null}
              </div>
            </Card>
            <FooterNote />
          </div>
        </div>
      </main>
    </div>
  );
}

export function ProfilePage() {
  const { profile, bookings, favorites } = useApp();
  const next = bookings.find((b) => b.status === 'confirmed');

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Your profile" subtitle="Manage your neighborhood account." />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <AccountSidebar />
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">Your neighborhood account</h2>
              <div className="mt-4 flex items-center gap-4">
                <Avatar src={profile.photo} name={profile.name} size={52} />
                <div>
                  <p className="text-[20px] font-semibold tracking-[-0.02em]">{profile.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">Member since {profile.since}</p>
                  <Chip small className="mt-2">
                    {profile.verified ? 'Email confirmed' : 'Email confirmation pending'}
                  </Chip>
                </div>
              </div>
            </Card>
            <div className="mt-4 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
              <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">You’re in customer mode</p>
              <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
                Switch to ServMate to manage your services and jobs. Customer bookings and provider jobs stay separate.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
              <Card className="flex flex-col p-5">
                <h2 className="card-title">Your next helping hand</h2>
                <div className="mt-2 flex-1 space-y-0.5 text-[12.5px] text-[var(--color-muted)]">
                  {next ? (
                    <>
                      <p>
                        {next.service} · {next.provider}
                      </p>
                      <p>
                        {next.date} · {next.time}
                      </p>
                    </>
                  ) : (
                    <p>No upcoming booking yet.</p>
                  )}
                </div>
                <Link to={next ? `/app/bookings/${next.id}` : '/app/bookings'} className="btn btn-ghost btn-block mt-6">
                  View booking
                </Link>
              </Card>
              <Card className="flex flex-col p-5">
                <h2 className="card-title">Saved for another day</h2>
                <div className="mt-2 flex-1 space-y-0.5 text-[12.5px] text-[var(--color-muted)]">
                  <p>{favorites.size} services · 1 ServMate</p>
                  <p>Good help, ready when you need it.</p>
                </div>
                <Link to="/app/saved" className="btn btn-ghost btn-block mt-6">
                  View favorites
                </Link>
              </Card>
            </div>
            <FooterNote />
          </div>
        </div>
      </main>
    </div>
  );
}

export function PersonalInfoPage() {
  const { profile, updateProfile, user } = useApp();
  const [name, setName] = useState(profile.name);
  const [preferred, setPreferred] = useState(profile.name.split(' ')[0]);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [saved, setSaved] = useState(false);

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Personal information" subtitle="Manage your neighborhood account." />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <AccountSidebar />
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">Your information</h2>
              <div className="mt-4 flex items-center gap-3">
                <Avatar src={profile.photo} name={profile.name} size={38} />
                <span className="text-[12px] text-[var(--color-brand)]">Change photo · JPG or PNG, up to 5 MB</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                <TextInput label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                <TextInput label="Preferred name (optional)" value={preferred} onChange={(e) => setPreferred(e.target.value)} />
                <div className="col-span-2 max-lg:col-span-1">
                  <TextInput label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(user)} />
                </div>
                <div className="col-span-2 max-lg:col-span-1">
                  <TextInput label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="tip mt-4">
                <p className="font-medium">Your information stays yours</p>
                <p className="mt-1">Your phone and service address are shared only with your ServMate after a confirmed booking.</p>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <Button
                  onClick={async () => {
                    await updateProfile({ name, email, phone });
                    setSaved(true);
                  }}
                >
                  Save changes
                </Button>
                <span className="text-[11.5px] text-[var(--color-muted)]">
                  {saved ? 'Saved to Firestore' : null}
                </span>
              </div>
            </Card>
            <FooterNote />
          </div>
        </div>
      </main>
    </div>
  );
}

export function SavedPlacesPage() {
  const { places, addPlace, removePlace } = useApp();
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Your saved places" subtitle="Manage your neighborhood account." />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <AccountSidebar />
          <div className="min-w-0 flex-1">
            <div className="rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
              <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">Saved addresses</p>
              <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
                Exact addresses stay private until a booking is accepted.
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {places.map((place) => (
                <div key={place.id} className="card flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-[13.5px] font-medium">{place.label}</p>
                    <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{place.address}</p>
                    {place.isDefault ? (
                      <Chip small className="mt-2">
                        Default address
                      </Chip>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => removePlace(place.id)} className="link-quiet text-[12px]">
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <Card className="mt-4 p-5">
              <h2 className="card-title">Add a place</h2>
              <div className="mt-3 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                <TextInput label="Label" placeholder="Home, office…" value={label} onChange={(e) => setLabel(e.target.value)} />
                <TextInput label="Address" placeholder="Street, city, ZIP" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <Button
                className="mt-4"
                disabled={!label.trim() || !address.trim()}
                onClick={async () => {
                  await addPlace({ label: label.trim(), address: address.trim(), isDefault: places.length === 0 });
                  setLabel('');
                  setAddress('');
                }}
              >
                Save place
              </Button>
            </Card>
            <FooterNote />
          </div>
        </div>
      </main>
    </div>
  );
}

export function SettingsPage() {
  const { signOut, user } = useApp();
  const [prefs, setPrefs] = useState({ booking: true, messages: true, recommendations: false });

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Settings" subtitle="Manage your neighborhood account." />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <AccountSidebar />
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">Preferences</h2>
              <div className="mt-3 divide-y divide-[var(--color-line-2)]">
                {[
                  ['booking', 'Booking notifications', 'Confirmations and schedule updates'],
                  ['messages', 'Message alerts', 'New messages from your ServMate'],
                  ['recommendations', 'Helpful recommendations', 'Occasional suggestions nearby'],
                ].map(([key, title, body]) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-3.5">
                    <div>
                      <p className="text-[12.5px] font-medium">{title}</p>
                      <p className="mt-0.5 text-[11.5px] text-[var(--color-muted)]">{body}</p>
                    </div>
                    <Toggle
                      label={title}
                      checked={prefs[key as keyof typeof prefs]}
                      onChange={(value) => setPrefs({ ...prefs, [key]: value })}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="mt-4 p-5">
              <h2 className="card-title">Account</h2>
              <div className="mt-2 space-y-1.5 text-[12.5px] text-[var(--color-muted)]">
                <p>
                  Language <span className="ml-2 text-[var(--color-ink-2)]">English</span>
                </p>
                <Link to="/app/profile/info" className="flex items-center gap-2 hover:text-[var(--color-ink)]">
                  Privacy &amp; data <span aria-hidden>→</span>
                </Link>
                <Link to="/app/profile/info" className="flex items-center gap-2 hover:text-[var(--color-ink)]">
                  Account security <span aria-hidden>→</span>
                </Link>
                <Link to="/app/help" className="flex items-center gap-2 hover:text-[var(--color-ink)]">
                  Help &amp; support <span aria-hidden>→</span>
                </Link>
                {user ? (
                  <p className="text-[11px] text-[var(--color-muted-2)]">Signed in as {user.email} · data synced to Firestore</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-4 text-[12px] text-[var(--color-brand)]"
              >
                Log out
              </button>
            </Card>
            <FooterNote />
          </div>
        </div>
      </main>
    </div>
  );
}

export function HelpPage() {
  const { reviews } = useApp();
  const faqs = [
    ['How do I change or cancel a booking?', 'Open the booking from Bookings, then use Reschedule or Cancel. Changes are free until your ServMate is on the way.'],
    ['When is my address shared?', 'Only after a ServMate accepts. Until then they see the general neighborhood and approximate distance.'],
    ['How do payments work?', 'Payments are arranged with your ServMate in the app. ServEm never stores your full card details.'],
    ['Can I use ServEm as both a customer and a ServMate?', 'Yes. One account can switch between customer mode and ServMate mode from the profile menu.'],
    ['What if something goes wrong?', 'Open Help & support from the booking, or message your ServMate. Disputes are reviewed by the safety team.'],
  ];

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="A little help with ServEm" subtitle="Answers to the things neighbors ask most." />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <AccountSidebar />
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">Popular questions</h2>
              <div className="mt-3 divide-y divide-[var(--color-line-2)]">
                {faqs.map(([question, answer]) => (
                  <details key={question} className="group py-3">
                    <summary className="cursor-pointer list-none text-[12.5px] font-medium marker:hidden">
                      <span className="flex items-center justify-between">
                        {question}
                        <span className="text-[var(--color-muted-2)] transition-transform group-open:rotate-45">+</span>
                      </span>
                    </summary>
                    <p className="mt-2 max-w-[560px] text-[12px] leading-[1.7] text-[var(--color-muted)]">{answer}</p>
                  </details>
                ))}
              </div>
            </Card>

            <div className="mt-4 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
              <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">Still need help?</p>
              <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
                Send a message and a real person will pick it up. Support hours are 8 AM – 8 PM, local time.
              </p>
              <Link to="/app/messages" className="btn btn-primary btn-pill mt-4 h-[38px] px-5 text-[12.5px]">
                Contact support
              </Link>
            </div>

            <div className="mt-4 card p-5">
              <h2 className="card-title">Your recent reviews</h2>
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="mt-3 border-t border-[var(--color-line-2)] pt-3 text-[12.5px] text-[var(--color-muted)] first:border-0 first:pt-0">
                  <p className="font-medium text-[var(--color-ink-2)]">{review.target}</p>
                  <p className="mt-1">“{review.text}”</p>
                  <p className="mt-1 text-[11px]">{review.date}</p>
                </div>
              ))}
            </div>
            <FooterNote />
          </div>
        </div>
      </main>
    </div>
  );
}

export function useAccountSummary() {
  const { servMates } = useApp();
  return useMemo(() => ({ mates: servMates.length }), [servMates.length]);
}
