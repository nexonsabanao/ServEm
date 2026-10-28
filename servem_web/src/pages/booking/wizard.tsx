import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Pencil } from 'lucide-react';
import { SiteHeader } from '../../components/SiteHeader';
import {
  Button,
  Callout,
  Card,
  Chip,
  FooterNote,
  MapSketch,
  PageHeader,
  ProgressSteps,
  Skeleton,
  TextArea,
} from '../../components/ui';
import { CartSummary, ProviderCard } from '../../components/cards';
import { MonthCalendar } from '../../components/Calendar';
import { PaymentMethodPicker } from '../../components/PaymentMethodPicker';
import { bookingTotals, formatPhilippinePeso, validatePhilippinePostalCode, paymentMethodLabel } from '../../lib/localization';
import { sanitizeUserText } from '../../lib/security';
import type { BookingTotalsResult } from '../../lib/functions';
import type { Booking, Service, ServMate } from '../../lib/types';
import { callableErrorMessage, placeTypeChoices, placeTypeLabels } from '../../lib/functions';
import { useApp } from '../../state/AppState';
import {
  draftFullAddress,
  draftStreet,
  formatDraftDate,
  formatDraftDateLong,
  timeLabel,
  timeRange,
  useBookingDraft,
} from './draft';

/**
 * The launch catalogue is also written to Firestore by tools/seed-catalogue.mjs;
 * a booking is only ever created against a catalogue service id, and the server
 * looks the price up from that record.
 */
function useService() {
  const { services, status } = useApp();
  const { id } = useParams();
  const service = services.find((s) => s.id === id) ?? null;
  return { service, loading: !service && status === 'connecting' };
}

function ServiceLoading() {
  return (
    <main className="shell-width pb-4 pt-9">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </main>
  );
}

/** A listing whose directory row is missing still reviews honestly, with zero stats. */
function mateFromService(service: Service): ServMate {
  return {
    id: service.id,
    uid: service.providerId,
    name: service.provider,
    photo: '',
    rating: service.rating,
    reviews: service.reviews,
    jobs: 0,
    rate: service.rate,
    distance: service.distance,
    area: service.area,
    skills: [service.category],
    availability: service.availability,
    verified: false,
    bio: service.description,
    responseTime: '',
    repeat: 0,
    cover: service.image,
    status: 'active',
  };
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

function ServiceMissing() {
  return (
    <main className="shell-width pb-4 pt-9">
      <PageHeader title="Service not found" subtitle="This listing is no longer in the catalogue" />
      <Card className="mt-6 p-6 text-center">
        <p className="text-[13px] text-[var(--color-muted)]">
          Nasalitan ang listing. It may have been paused or removed by the ServMate who published it.
        </p>
        <Link to="/app/explore" className="btn btn-primary mt-5">
          Browse other services
        </Link>
      </Card>
    </main>
  );
}

function WizardHeader({ step, title }: { step: 1 | 2 | 3; title: string }) {
  const subtitles = ['Date, time & task', 'Confirm your address', 'Review price'];
  return (
    <>
      <PageHeader title={title} subtitle={`Step ${step} of 3 · ${subtitles[step - 1]}`} />
      <div className="mt-5">
        <ProgressSteps steps={['Date & task', 'Service address', 'Review price']} active={step - 1} />
      </div>
    </>
  );
}

/**
 * The start windows the wizard offers. `value` is the `HH:mm` string the
 * `createBooking` / `updateBookingStatus` callables require; `label` is the
 * 12-hour text a customer reads. Only `value` is ever sent.
 */
const START_TIMES = [
  { value: '09:00', label: '9:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '14:00', label: '2:00 PM' },
];

export function DateTimePage() {
  const { service, loading } = useService();
  const { draft, set } = useBookingDraft();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceLoading />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceMissing />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <WizardHeader step={1} title="Book your service" />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">Choose a day</h2>
              <MonthCalendar
                value={draft.day}
                onSelect={(iso) => set({ day: iso })}
                gridClassName="ml-auto w-[315px]"
              />
              <p className="mt-5 text-[12px] text-[var(--color-muted)]">
                Selected · {formatDraftDate(draft.day)} · Available start times
              </p>
              <div className="mt-2 flex items-center gap-1 rounded-[10px] border border-[var(--color-line)] px-1.5 py-1">
                {START_TIMES.map((slot, index) => (
                  <span key={slot.value} className="flex items-center">
                    {index > 0 ? <span className="px-1 text-[var(--color-line)]">·</span> : null}
                    <button
                      type="button"
                      onClick={() => set({ timeSlot: slot.value })}
                      aria-pressed={draft.timeSlot === slot.value}
                      className={`rounded-md px-3 py-1.5 text-[12px] ${
                        draft.timeSlot === slot.value
                          ? 'border border-[var(--color-line)] bg-white font-medium text-[var(--color-ink)]'
                          : 'text-[var(--color-muted)]'
                      }`}
                    >
                      {slot.label}
                    </button>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-muted-2)]">
                Start times shown are ServEm’s standard windows. Your ServMate confirms the exact arrival after
                accepting.
              </p>
            </Card>

            <div className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <label className="block">
                <span className="label">Duration</span>
                <select
                  className="field"
                  value={draft.hours}
                  onChange={(event) => set({ hours: Number(event.target.value) })}
                >
                  <option value={2}>2 hours</option>
                  <option value={3}>3 hours</option>
                  <option value={4}>4 hours</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Selected date</span>
                <input className="field" value={formatDraftDateLong(draft.day)} readOnly />
              </label>
            </div>

            <div className="mt-4">
              <TextArea
                label="Task details (optional)"
                rows={4}
                value={draft.notes}
                onChange={(event) => set({ notes: event.target.value })}
                placeholder="What needs doing? Tools, access, parking — anything that helps."
              />
            </div>

            <Button block className="mt-4" disabled={!draft.day} onClick={() => navigate(`/app/book/${service.id}/address`)}>
              Continue to Address
            </Button>
            {!draft.day ? (
              <p className="mt-2 text-[11.5px] text-[var(--color-muted-2)]">Pick a day to continue.</p>
            ) : null}
          </div>
          <CartSummary service={service} hours={draft.hours} date={formatDraftDate(draft.day)} time={timeRange(draft.timeSlot, draft.hours)} />
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function AddressPage() {
  const { service, loading } = useService();
  const { draft, set } = useBookingDraft();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceLoading />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceMissing />
      </div>
    );
  }

  const addressReady =
    draft.address.trim().length >= 4 &&
    draft.city.trim().length >= 1 &&
    draft.province.trim().length >= 1 &&
    validatePhilippinePostalCode(draft.zip);
  const zipValid = draft.zip === '' || validatePhilippinePostalCode(draft.zip);

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <WizardHeader step={2} title="Enter service address" />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">No location permission needed</h2>
              <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                Type the address. ServEm does not read your device location for booking.
              </p>
              <label className="mt-4 block">
                <span className="label">Street / purok / barangay address</span>
                <input
                  className="field"
                  value={draft.address}
                  autoComplete="street-address"
                  placeholder="128 Rufino Street, Brgy. Poblacion"
                  onChange={(e) => set({ address: e.target.value })}
                />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <label className="block">
                  <span className="label">Unit / Floor</span>
                  <input
                    className="field"
                    value={draft.unit}
                    placeholder="Unit 3B, Floor 3"
                    onChange={(e) => set({ unit: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="label">City or Municipality</span>
                  <input
                    className="field"
                    value={draft.city}
                    autoComplete="address-level2"
                    placeholder="Makati City"
                    onChange={(e) => set({ city: e.target.value })}
                  />
                </label>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <label className="block">
                  <span className="label">Province</span>
                  <input
                    className="field"
                    value={draft.province}
                    autoComplete="address-level1"
                    placeholder="Metro Manila"
                    onChange={(e) => set({ province: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="label">Postal code</span>
                  <input
                    className="field"
                    value={draft.zip}
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="postal-code"
                    aria-invalid={!zipValid}
                    placeholder="1226"
                    onChange={(e) => set({ zip: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  />
                  {!zipValid ? (
                    <span className="mt-1 block text-[11.5px] text-[var(--color-danger)]">
                      A Philippine postal code is 4 digits.
                    </span>
                  ) : null}
                </label>
              </div>
              <div className="mt-4">
                <TextArea
                  label="Arrival instructions (optional)"
                  rows={4}
                  value={draft.arrival}
                  placeholder="Gate code, who to ask for, where to park."
                  onChange={(event) => set({ arrival: event.target.value })}
                />
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-[var(--color-line)] px-4 py-2.5 text-[12.5px]">
                {placeTypeChoices.map((choice, index) => (
                  <span key={choice.value} className="flex items-center gap-2">
                    {index > 0 ? <span className="text-[var(--color-line)]">·</span> : null}
                    <button
                      type="button"
                      onClick={() => set({ placeType: choice.value })}
                      aria-pressed={draft.placeType === choice.value}
                      className={
                        draft.placeType === choice.value
                          ? 'font-medium text-[var(--color-brand-deep)]'
                          : 'text-[var(--color-muted)]'
                      }
                    >
                      {choice.label}
                    </button>
                  </span>
                ))}
              </div>
              <Button
                block
                className="mt-4"
                disabled={!addressReady || !zipValid}
                onClick={() => navigate(`/app/book/${service.id}/location`)}
              >
                Continue to address confirmation
              </Button>
              {!addressReady ? (
                <p className="mt-2 text-[11.5px] text-[var(--color-muted-2)]">
                  Add the street address and your city or municipality to continue.
                </p>
              ) : null}
            </Card>
          </div>
          <CartSummary
            service={service}
            hours={draft.hours}
            date={formatDraftDate(draft.day)}
            time={timeRange(draft.timeSlot, draft.hours)}
          />
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function ConfirmLocationPage() {
  const { service, loading } = useService();
  const { draft } = useBookingDraft();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceLoading />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceMissing />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <WizardHeader step={2} title="Confirm service location" />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">Check the address, not a map pin</h2>
              <MapSketch className="mt-4" />
              <p className="mt-3 text-[11.5px] text-[var(--color-muted-2)]">
                ServEm does not show a live map yet. Read the address below and correct it if anything is wrong.
              </p>
              <p className="mt-4 text-[17px] font-semibold text-[var(--color-brand-deep)]">{draftStreet(draft)}</p>
              <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
                {draft.city}, {draft.province} {draft.zip}
              </p>
              {draft.arrival ? (
                <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">{draft.arrival}</p>
              ) : null}
              <Callout title="Address confirmation">
                Your ServMate sees this address only after accepting the job. Nothing is shared with anyone else.
              </Callout>
              <div className="mt-4 flex gap-2">
                <Button block onClick={() => navigate(`/app/book/${service.id}/review`)}>
                  Confirm address
                </Button>
                <Link to={`/app/book/${service.id}/address`} className="btn btn-outline h-[46px] shrink-0 px-5">
                  Edit
                </Link>
              </div>
            </Card>
          </div>
          <CartSummary
            service={service}
            hours={draft.hours}
            date={formatDraftDate(draft.day)}
            time={timeRange(draft.timeSlot, draft.hours)}
          />
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function ReviewPricePage() {
  const { service, loading } = useService();
  const { draft, set } = useBookingDraft();
  const navigate = useNavigate();
  const { addBooking } = useApp();
  const [placing, setPlacing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const estimate = bookingTotals(service?.rate ?? 0, draft.hours);
  const { servMates } = useApp();
  const mate = service
    ? servMates.find((m) => m.id === service.providerId || m.uid === service.providerId) ??
      mateFromService(service)
    : null;

  if (loading) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceLoading />
      </div>
    );
  }

  if (!service || !mate) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceMissing />
      </div>
    );
  }

  const addressMissing =
    draft.address.trim().length < 4 ||
    draft.city.trim().length < 1 ||
    draft.province.trim().length < 1 ||
    !validatePhilippinePostalCode(draft.zip);

  const blocking = !draft.day
    ? 'Pick a date first.'
    : addressMissing
      ? 'Complete the address — street, city, province and a 4-digit postal code.'
      : draft.paymentMethod === null
        ? 'Choose how you want to pay.'
        : null;

  async function placeBooking() {
    if (!service || !mate || !draft.day || !draft.paymentMethod) {
      if (!draft.paymentMethod) setPaymentError('Pumili ng paraan ng pagbabayad — choose how you want to pay.');
      return;
    }
    setPaymentError(null);
    setPlacing(true);
    setSubmitError(null);
    try {
      // The full Philippine address goes to the callable; the server re-derives
      // subtotal, fee and total, so nothing price-related is sent from here.
      const result = await addBooking({
        serviceId: service.id,
        date: draft.day,
        time: draft.timeSlot,
        hours: draft.hours,
        address: sanitizeUserText(draftFullAddress(draft), 200),
        unit: sanitizeUserText(draft.unit, 100),
        city: sanitizeUserText(draft.city, 100),
        province: sanitizeUserText(draft.province, 100),
        postalCode: draft.zip,
        notes: sanitizeUserText(draft.notes, 1000),
        arrivalInstructions: sanitizeUserText(draft.arrival, 500),
        placeType: draft.placeType,
        paymentMethod: draft.paymentMethod,
      });
      navigate(`/app/book/sent/${result.bookingId}`, { state: result });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : callableErrorMessage(error));
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <WizardHeader step={3} title="Review price & confirm" />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">
                {service.name} · {mate.name}
              </h2>
              <div className="mt-2 space-y-0.5 text-[12.5px] text-[var(--color-muted)]">
                <p className="flex items-center justify-between gap-3">
                  <span>
                    {formatDraftDate(draft.day)} · {timeRange(draft.timeSlot, draft.hours)}
                  </span>
                  <Link to={`/app/book/${service.id}/date`} className="link text-[12px]">
                    Edit
                  </Link>
                </p>
                <p>
                  {draft.hours} hours · {formatPhilippinePeso(service.rate)} / hr
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span>
                    {placeTypeLabels[draft.placeType]} · {draftFullAddress(draft) || 'No address yet'}
                  </span>
                  <Link to={`/app/book/${service.id}/address`} className="link text-[12px]">
                    Edit
                  </Link>
                </p>
                <p>Your ServMate sees the full address only after accepting.</p>
              </div>
            </Card>

            <Card className="mt-4 p-5">
              <h2 className="card-title">Payment method</h2>
              <PaymentMethodPicker
                value={draft.paymentMethod}
                error={paymentError ?? undefined}
                onChange={(method) => {
                  setPaymentError(null);
                  set({ paymentMethod: method });
                }}
              />
              <p className="mt-3 text-[12px] leading-[1.6] text-[var(--color-muted)]">
                {draft.paymentMethod === 'cash_on_completion'
                  ? 'Pay your ServMate in cash once the visit is marked complete. Nothing is charged to you now.'
                  : draft.paymentMethod
                    ? `You will be asked to pay with ${paymentMethodLabel(draft.paymentMethod)} after your ServMate accepts. ServEm releases the funds to the ServMate when the job is marked complete.`
                    : 'Choose how you want to pay. Payment is collected after your ServMate accepts the job.'}
              </p>
            </Card>

            <Button
              block
              className="mt-4"
              disabled={placing || Boolean(blocking)}
              onClick={() => void placeBooking()}
            >
              {placing
                ? 'Placing your booking…'
                : `Place booking · est. ${formatPhilippinePeso(estimate.total)}`}
            </Button>
            {blocking ? <p className="mt-2 text-[11.5px] text-[var(--color-muted-2)]">{blocking}</p> : null}
            {submitError ? (
              <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">
                {submitError}
              </p>
            ) : null}
          </div>

          <aside className="flex w-[332px] shrink-0 flex-col gap-4 max-lg:w-full">
            <ProviderCard mate={mate} />
            <div className="rail-card">
              <p className="text-[14.5px] font-medium">Estimated total · {formatPhilippinePeso(estimate.total)}</p>
              <div className="mt-2 space-y-1 text-[12.5px] text-[var(--color-muted)]">
                <p>
                  {draft.hours} hours × {formatPhilippinePeso(service.rate)}{' '}
                  <span className="float-right">{formatPhilippinePeso(estimate.subtotal)}</span>
                </p>
                <p>
                  ServEm service fee <span className="float-right">{formatPhilippinePeso(estimate.fee)}</span>
                </p>
                <p className="pt-1 leading-[1.6]">
                  The final figures are calculated by ServEm when the booking is placed and shown on the next screen.
                </p>
              </div>
            </div>
            <Callout title="A little privacy, by design">
              Only the general area appears until your ServMate accepts. ServEm does not track anyone’s live location.
            </Callout>
          </aside>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function BookingSentPage() {
  const { id } = useParams();
  const location = useLocation();
  const { bookings } = useApp();
  const booking = bookings.find((b) => b.id === id) ?? null;
  const placed = (location.state as BookingTotalsResult | null)?.bookingId === id
    ? (location.state as BookingTotalsResult)
    : null;
  const [params] = useSearchParams();
  const cancelled = params.get('cancelled') === '1';
  const totals: BookingTotalsResult | null =
    placed ??
    (booking
      ? { bookingId: booking.id, subtotal: booking.total - booking.fee, fee: booking.fee, total: booking.total }
      : null);

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader
          title={cancelled ? 'Booking cancelled' : 'Booking sent'}
          subtitle={booking ? `${booking.id} · ${booking.service} · ${booking.provider}` : `${id ?? 'Unknown'}`}
        />
        <div className="mt-8 flex flex-col items-center rounded-[16px] border border-[var(--color-line)] bg-white px-8 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-soft)] text-[var(--color-brand)]">
            <Check size={26} />
          </span>
          <h2 className="mt-5 text-[22px] font-semibold">You’re one step closer.</h2>
          <p className="mt-2 max-w-[400px] text-[13px] leading-[1.65] text-[var(--color-muted)]">
            Your ServMate will confirm the details shortly. You’ll get an update in Bookings and by notification.
          </p>
          {totals ? (
            <div className="mt-6 w-full max-w-[320px] rounded-[12px] bg-[#f7faf8] px-5 py-4 text-left text-[12.5px]">
              <p className="flex justify-between">
                <span className="text-[var(--color-muted)]">Subtotal</span>
                <span>{formatPhilippinePeso(totals.subtotal)}</span>
              </p>
              <p className="mt-1 flex justify-between">
                <span className="text-[var(--color-muted)]">ServEm service fee</span>
                <span>{formatPhilippinePeso(totals.fee)}</span>
              </p>
              <p className="mt-2 flex justify-between border-t border-[var(--color-line-2)] pt-2 font-medium">
                <span>Total</span>
                <span>{formatPhilippinePeso(totals.total)}</span>
              </p>
            </div>
          ) : null}
          {booking ? (
            <Link to={`/app/bookings/${booking.id}`} className="btn btn-primary mt-6 px-10">
              View booking
            </Link>
          ) : (
            <p className="mt-6 text-[12px] text-[var(--color-muted-2)]">
              Waiting for Firestore to return the booking record…
            </p>
          )}
        </div>
        <div className="mt-4 rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
          <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">Keep it in one place</p>
          <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
            Message your ServMate, reschedule or cancel from the booking page. Address details stay private until
            accepted.
          </p>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function ReschedulePage() {
  const { id } = useParams();
  const { bookings, changeBookingStatus, servMates } = useApp();
  const booking = bookings.find((b) => b.id === id) ?? null;
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!booking) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceMissing />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Find another time" subtitle={`${booking.id} · ${booking.service}`} />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">Pick a new day</h2>
              <MonthCalendar value={day} onSelect={setDay} gridClassName="ml-auto w-[315px]" />
              <p className="mt-5 text-[12px] text-[var(--color-muted)]">
                Selected · {formatDraftDate(day)} · Available start times
              </p>
              <div className="mt-2 flex items-center gap-1 rounded-[10px] border border-[var(--color-line)] px-1.5 py-1">
                {START_TIMES.map((option, index) => (
                  <span key={option.value} className="flex items-center">
                    {index > 0 ? <span className="px-1 text-[var(--color-line)]">·</span> : null}
                    <button
                      type="button"
                      onClick={() => setSlot(option.value)}
                      aria-pressed={slot === option.value}
                      className={`rounded-md px-3 py-1.5 text-[12px] ${
                        slot === option.value
                          ? 'border border-[var(--color-line)] bg-white font-medium'
                          : 'text-[var(--color-muted)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[12px] text-[var(--color-muted)]">
                Requested · {formatDraftDate(day)} · {timeLabel(slot)}
              </p>
              {error ? (
                <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">
                  {error}
                </p>
              ) : null}
              <Button
                block
                className="mt-4"
                disabled={!day || busy}
                onClick={async () => {
                  if (!day) return;
                  setBusy(true);
                  setError(null);
                  try {
                    await changeBookingStatus(booking.id, 'reschedule', { newDate: day, newTime: slot });
                    navigate(`/app/bookings/${booking.id}`);
                  } catch (reason) {
                    setError(reason instanceof Error ? reason.message : 'Hindi ma-reschedule ang booking.');
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Sending request…' : 'Request new time'}
              </Button>
              <p className="mt-2 text-[11.5px] text-[var(--color-muted-2)]">
                Your ServMate has to accept the new time. The booking stays as it is until they do.
              </p>
            </Card>
          </div>
          <aside className="flex w-[332px] shrink-0 flex-col gap-4 max-lg:w-full">
            <ProviderCard mate={mateForBooking(booking, servMates)} />
            <div className="rail-card">
              <p className="text-[14.5px] font-medium">Customer total · {formatPhilippinePeso(booking.total)}</p>
              <p className="mt-2 text-[12.5px] text-[var(--color-muted)]">
                {booking.hours} hours · service fee {formatPhilippinePeso(booking.fee)}
              </p>
            </div>
            <Callout title="A little privacy, by design">
              Only the general area appears until your ServMate accepts. ServEm does not track live location.
            </Callout>
          </aside>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function CancelPage() {
  const { id } = useParams();
  const { bookings, cancelBooking, servMates } = useApp();
  const booking = bookings.find((b) => b.id === id) ?? null;
  const [reason, setReason] = useState('A better time came up');
  const [detail, setDetail] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!booking) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceMissing />
      </div>
    );
  }

  const reasons = [
    'A better time came up',
    'I no longer need the service',
    'I found another ServMate',
    'The service was arranged elsewhere',
  ];

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Cancel booking" subtitle={`${booking.id} · ${booking.service}`} />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <div className="space-y-0.5 text-[13px] text-[var(--color-muted)]">
                <p>
                  {booking.service} · {booking.provider}
                </p>
                <p>
                  {booking.date} · {booking.time}
                </p>
                <p className="pt-1 text-[11.5px]">
                  {booking.status === 'requested'
                    ? 'Nothing has been charged yet — payment is only collected after your ServMate accepts.'
                    : `You paid ${formatPhilippinePeso(booking.total)}. A refund is raised for the ServMate to review.`}
                </p>
              </div>
            </Card>

            <h2 className="mt-6 text-[15px] font-semibold">Why are you cancelling?</h2>
            <div className="mt-3 space-y-2">
              {reasons.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 text-[13px] ${
                    reason === option
                      ? 'border-[var(--color-brand)] bg-[var(--color-soft)]'
                      : 'border-[var(--color-line)] bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    checked={reason === option}
                    onChange={() => setReason(option)}
                    className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                  />
                  {option}
                </label>
              ))}
            </div>
            <textarea
              className="field mt-4"
              rows={3}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Anything else your ServMate should know? (optional)"
            />
            {error ? (
              <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">
                {error}
              </p>
            ) : null}
            <Button block variant="danger" className="mt-4" onClick={() => setOpen(true)}>
              Cancel this booking
            </Button>
          </div>
          <aside className="flex w-[332px] shrink-0 flex-col gap-4 max-lg:w-full">
            <ProviderCard mate={mateForBooking(booking, servMates)} />
            <div className="rail-card">
              <p className="text-[14.5px] font-medium">Customer total · {formatPhilippinePeso(booking.total)}</p>
              <p className="mt-2 text-[12.5px] text-[var(--color-muted)]">
                {booking.hours} hours · service fee {formatPhilippinePeso(booking.fee)}
              </p>
            </div>
            <Callout title="A little privacy, by design">
              Only the general area appears until your ServMate accepts. ServEm does not track live location.
            </Callout>
          </aside>
        </div>
        <FooterNote />
      </main>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,43,34,0.5)] p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Cancel this booking?"
        >
          <div className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(12,40,28,0.22)]">
            <h2 className="text-[16px] font-semibold">Cancel this booking?</h2>
            <p className="mt-2 text-[12.5px] leading-[1.6] text-[var(--color-muted)]">
              This frees the time for someone else and tells your ServMate. The cancellation and your reason are stored
              on the booking.
            </p>
            <div className="mt-5 space-y-2">
              <Button
                block
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await cancelBooking(booking.id, sanitizeUserText(`${reason}${detail ? ` — ${detail}` : ''}`, 500));
                    navigate(`/app/bookings/${booking.id}`);
                  } catch (reason_) {
                    setError(
                      reason_ instanceof Error ? reason_.message : 'Hindi ma-cancel ang booking. Try again.',
                    );
                    setBusy(false);
                    setOpen(false);
                  }
                }}
              >
                {busy ? 'Cancelling…' : 'Yes, cancel booking'}
              </Button>
              <Button block variant="ghost" onClick={() => setOpen(false)}>
                Keep booking
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CompletionPage() {
  const { id } = useParams();
  const { bookings, servMates } = useApp();
  const booking = bookings.find((b) => b.id === id) ?? null;

  if (!booking) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceMissing />
      </div>
    );
  }

  const money = (
    <div className="mt-2 space-y-1 text-[12.5px] text-[var(--color-muted)]">
      <p>
        {booking.hours} hours <span className="float-right">{formatPhilippinePeso(booking.total - booking.fee)}</span>
      </p>
      <p>
        ServEm service fee <span className="float-right">{formatPhilippinePeso(booking.fee)}</span>
      </p>
      <p className="pt-1">
        {booking.status === 'completed'
          ? 'Payment was released to your ServMate when the job was marked complete.'
          : 'Payment is collected after your ServMate accepts, and released when the job is complete.'}
      </p>
    </div>
  );

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader
          title="All taken care of"
          subtitle={`${booking.id} · ${booking.service} · ${booking.provider}`}
        />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <div className="rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
              <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">A job well done.</p>
              <p className="mt-0.5 text-[12.5px] text-[#3e5a4e]">
                {booking.provider.split(' ')[0]} marked your {booking.service.toLowerCase()} complete. How did it go?
              </p>
            </div>

            <Card className="mt-4 p-5">
              <h2 className="card-title">Work summary</h2>
              <p className="mt-2 text-[12px] text-[var(--color-muted)]">
                {booking.notes || 'No task notes were recorded on this booking.'}
              </p>
              <p className="mt-2 text-[12px] text-[var(--color-muted)]">
                {booking.date} · {booking.time} · {booking.status.replace(/_/g, ' ')}
              </p>
              <Link to={`/app/bookings/${booking.id}/review`} className="btn btn-primary btn-block mt-6">
                Leave a review
              </Link>
            </Card>

            <Card className="mt-4 p-5">
              <h2 className="card-title">Customer total · {formatPhilippinePeso(booking.total)}</h2>
              {money}
            </Card>
          </div>

          <aside className="flex w-[332px] shrink-0 flex-col gap-4 max-lg:w-full">
            <ProviderCard mate={mateForBooking(booking, servMates)} />
            <div className="rail-card">
              <p className="text-[14.5px] font-medium">Customer total · {formatPhilippinePeso(booking.total)}</p>
              {money}
            </div>
            <div className="space-y-2 text-[11.5px] text-[var(--color-muted)]">
              <p>
                Contact is available after acceptance. In-app messaging stays on the{' '}
                <Link to={`/app/bookings/${booking.id}`} className="link">
                  booking page
                </Link>
                .
              </p>
              <Link to="/app/help" className="link text-[12px]">
                Get help with this booking
              </Link>
            </div>
          </aside>
          <div className="hidden">
            <Chip tone="neutral">{booking.status}</Chip>
          </div>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function ReviewFormPage() {
  const { id } = useParams();
  const { bookings, servMates } = useApp();
  const booking = bookings.find((b) => b.id === id) ?? null;
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!booking) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceMissing />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader
          title={`How did ${booking.provider.split(' ')[0]} do?`}
          subtitle={`${booking.service} · ${booking.date}`}
        />
        <div className="mt-6 flex gap-6 max-lg:flex-col">
          <div className="min-w-0 flex-1">
            <Card className="p-5">
              <h2 className="card-title">Share your experience</h2>
              <div className="mt-3 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    aria-label={`${value} star${value > 1 ? 's' : ''}`}
                    aria-pressed={rating === value}
                    className={`text-[26px] leading-none ${value <= rating ? 'text-[#1d3b2e]' : 'text-[#c8d5ce]'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[13px] font-medium">
                {rating === 0 ? 'Tap a star to rate the visit' : `${rating} out of 5`}
              </p>
              <textarea
                className="field mt-3"
                rows={5}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="What went well? What could be better?"
              />
              <div className="mt-3 flex items-start gap-2 text-[11.5px] text-[var(--color-muted)]">
                <Pencil size={13} className="mt-0.5" />
                <span>Reviews help neighbors choose with confidence. Keep it specific and kind.</span>
              </div>
              {error ? (
                <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">
                  {error}
                </p>
              ) : null}
              <Button
                block
                className="mt-5"
                onClick={() => {
                  if (rating === 0) {
                    setError('Pumili ng rating — choose a star rating before submitting.');
                    return;
                  }
                  navigate(`/app/bookings/${booking.id}/review/sent`, {
                    state: { rating, text: sanitizeUserText(text, 800) },
                  });
                }}
              >
                Submit review
              </Button>
              <p className="mt-2 text-[11.5px] leading-[1.6] text-[var(--color-muted-2)]">
                Review publishing is not connected to ServEm’s servers yet, so this stays on your device.
              </p>
            </Card>

            <div className="tip mt-4">
              <p className="font-medium">A little honesty goes a long way</p>
              <p className="mt-1">Your review is shared with the ServMate and future customers. No public personal details.</p>
            </div>
          </div>
          <aside className="flex w-[332px] shrink-0 flex-col gap-4 max-lg:w-full">
            <ProviderCard mate={mateForBooking(booking, servMates)} />
            <div className="rail-card">
              <p className="text-[14.5px] font-medium">Customer total · {formatPhilippinePeso(booking.total)}</p>
              <p className="mt-2 text-[12.5px] text-[var(--color-muted)]">
                {booking.service} · {booking.date}
              </p>
              <Link to={`/app/bookings/${booking.id}`} className="mt-3 block text-[12px] text-[var(--color-brand)]">
                Back to booking
              </Link>
            </div>
            <Callout title="A little privacy, by design">
              Reviews show your first name and neighborhood only.
            </Callout>
          </aside>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}

export function ReviewSubmittedPage() {
  const { id } = useParams();
  const location = useLocation();
  const { bookings } = useApp();
  const booking = bookings.find((b) => b.id === id) ?? null;
  const draft = (location.state as { rating: number; text: string } | null) ?? null;

  if (!booking) {
    return (
      <div className="min-h-[100dvh]">
        <SiteHeader />
        <ServiceMissing />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-4 pt-9">
        <PageHeader title="Review not published yet" subtitle={`${booking.service} · ${booking.provider}`} />
        <div className="mt-6 max-w-[640px]">
          <div className="rounded-[12px] bg-[var(--color-soft)] px-5 py-4">
            <p className="text-[13px] font-medium text-[var(--color-brand-deep)]">
              Salamat — your review is written, but nothing was sent.
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-[#3e5a4e]">
              ServEm has no review publishing path yet, so this draft stays on your device and your ServMate is not
              notified. It will be submitted for real once that is connected.
            </p>
          </div>
          <Card className="mt-4 p-5">
            <p className="text-[13px] font-medium">
              {booking.service} · {booking.date}
            </p>
            {draft ? (
              <>
                <p className="mt-2 flex items-center gap-2 text-[13px]">
                  <span className="text-[#1d3b2e]">{'★'.repeat(draft.rating)}</span> {draft.rating.toFixed(1)}
                </p>
                {draft.text ? (
                  <p className="mt-2 text-[13px] leading-[1.7] text-[var(--color-muted)]">“{draft.text}”</p>
                ) : (
                  <p className="mt-2 text-[13px] text-[var(--color-muted)]">No written comment was added.</p>
                )}
              </>
            ) : null}
            <div className="mt-4 flex gap-3">
              <Link to={`/app/bookings/${booking.id}/review`} className="btn btn-outline">
                Edit review
              </Link>
              <Link to="/app/bookings" className="btn btn-ghost">
                Back to bookings
              </Link>
            </div>
          </Card>
          <div className="mt-4">
            <Chip tone="neutral">Draft only · not published</Chip>
          </div>
        </div>
        <FooterNote />
      </main>
    </div>
  );
}
