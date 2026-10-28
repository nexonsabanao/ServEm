import { Link } from 'react-router-dom';
import { AlertTriangle, Check, MapPin, ShieldX, WifiOff } from 'lucide-react';
import { SiteHeader } from '../components/SiteHeader';
import { Button, Chip, FooterNote, PageHeader, Skeleton } from '../components/ui';

function StateCard({
  title,
  subtitle,
  children,
  tone = 'neutral',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'danger' | 'warn';
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium">{title}</p>
          {subtitle ? <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{subtitle}</p> : null}
        </div>
        <Chip small tone={tone}>
          State
        </Chip>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function CenteredState({
  icon,
  title,
  body,
  action,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: string;
  secondary?: string;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-6 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-soft)] text-[var(--color-brand)]">
        {icon}
      </span>
      <p className="mt-3 text-[13px] font-medium">{title}</p>
      <p className="mt-1 max-w-[280px] text-[11.5px] leading-[1.6] text-[var(--color-muted)]">{body}</p>
      {action ? <Button small className="mt-4">{action}</Button> : null}
      {secondary ? <button type="button" className="mt-2 text-[11px] text-[var(--color-muted)] underline">{secondary}</button> : null}
    </div>
  );
}

export function StatesPage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="shell-width pb-6 pt-9">
        <PageHeader
          title="UI states"
          subtitle="Loading, empty, offline, errors and outcomes from the design boards."
          actions={
            <Link to="/app/help" className="link text-[12.5px]">
              Back to help
            </Link>
          }
        />

        <h2 className="mt-8 text-[15px] font-semibold">Web · Customer &amp; ServMate</h2>
        <div className="mt-3 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-lg:grid-cols-1">
          <StateCard title="Loading / Service results skeleton" subtitle="Search results · Retrieving results">
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </StateCard>

          <StateCard title="Empty search results" subtitle="No matches just yet">
            <CenteredState
              icon={<AlertTriangle size={16} />}
              title="No matches just yet"
              body="Try a shorter phrase, a nearby neighborhood, or a broader category to see more local help."
              action="Clear filters"
            />
          </StateCard>

          <StateCard title="No bookings" subtitle="Bookings · Upcoming">
            <CenteredState
              icon={<Check size={16} />}
              title="Your next helping hand awaits"
              body="Book a service and it will appear here, along with messages and updates."
              action="Explore services"
            />
          </StateCard>

          <StateCard title="No messages" subtitle="Messages · Inbox">
            <CenteredState
              icon={<AlertTriangle size={16} />}
              title="A conversation starts with a booking"
              body="Once a ServMate accepts, you can message each other here."
              action="Book a service"
            />
          </StateCard>

          <StateCard title="Success feedback" subtitle="Welcome · Signed in" tone="brand">
            <CenteredState
              icon={<Check size={16} />}
              title="Looking good, Jamie."
              body="Your neighborhood is ready when you are. Explore trusted local help or manage your bookings."
              action="Book a service"
            />
            <div className="rounded-[8px] bg-[var(--color-soft)] px-3 py-2 text-[10.5px] text-[#3e5a4e]">
              <p className="font-medium text-[var(--color-brand-deep)]">Demo account</p>
              <p>Simulated account · No real personal data is stored.</p>
            </div>
          </StateCard>

          <StateCard title="Offline" subtitle="Connectivity" tone="warn">
            <CenteredState
              icon={<WifiOff size={16} />}
              title="You’re offline"
              body="Your saved details stay available. New requests will send once you’re back online."
              action="Try again"
            />
            <div className="rounded-[8px] bg-[var(--color-warn)] px-3 py-2 text-[10.5px] text-[#6f5a2e]">
              No live tracking · Offline is simulated in this demo.
            </div>
          </StateCard>

          <StateCard title="Error and retry" subtitle="Something didn’t load" tone="danger">
            <CenteredState
              icon={<AlertTriangle size={16} />}
              title="That didn’t go through"
              body="Your booking is still saved. Check your connection and try again."
              action="Try again"
              secondary="Contact support instead"
            />
          </StateCard>

          <StateCard title="Payment / Pending" subtitle="Payment · Checking your demo payment">
            <CenteredState
              icon={<Check size={16} />}
              title="Checking your demo payment"
              body="This usually takes a few seconds. No real payment is processed."
              action="Check status"
            />
          </StateCard>

          <StateCard title="Payment / Simulated success" subtitle="Payment · Successful" tone="brand">
            <CenteredState
              icon={<Check size={16} />}
              title="Demo payment successful"
              body="The service is confirmed. No money was charged."
              action="View booking"
            />
          </StateCard>

          <StateCard title="Payment / Simulated failure" subtitle="Payment · Declined" tone="danger">
            <CenteredState
              icon={<AlertTriangle size={16} />}
              title="Demo payment declined"
              body="Your booking is saved. Try another demo method or adjust the time."
              action="Try another method"
              secondary="Back to booking"
            />
          </StateCard>

          <StateCard title="Verification / Pending" subtitle="ServMate · Sample document submitted">
            <CenteredState
              icon={<Check size={16} />}
              title="Sample documents submitted"
              body="A reviewer will take a look. Times are simulated; no real ID is stored."
              action="Save and continue"
            />
          </StateCard>

          <StateCard title="Verification / Rejected" subtitle="ServMate · Try another sample file" tone="danger">
            <CenteredState
              icon={<ShieldX size={16} />}
              title="Try another sample file"
              body="The sample preview was unclear. Upload a different demo file to continue."
              action="Upload another"
            />
          </StateCard>

          <StateCard title="Verification / Demo approved" subtitle="ServMate · Demo setup approved" tone="brand">
            <CenteredState
              icon={<Check size={16} />}
              title="Demo setup approved"
              body="You can add services and availability now. No real verification is performed."
              action="Continue to services"
            />
          </StateCard>

          <StateCard title="Location permission denied" subtitle="Permissions" tone="warn">
            <div className="rounded-[8px] bg-[var(--color-warn)] px-3 py-2 text-[11px] text-[#6f5a2e]">
              Your address was protected. Enter it manually below, or choose a saved place.
            </div>
            <div className="mt-3 space-y-2">
              <input className="field h-[38px] text-[12px]" defaultValue="128 7th Ave, Apt 3B" aria-label="Address" />
              <div className="flex items-center gap-2 rounded-[8px] bg-[var(--color-soft)] px-3 py-2 text-[11px] text-[#3e5a4e]">
                <MapPin size={13} /> Saved place · Home
              </div>
            </div>
            <Button small block className="mt-3">Save this address</Button>
          </StateCard>

          <StateCard title="Validation errors" subtitle="Form · Check your details" tone="danger">
            <div className="space-y-3">
              <div className="rounded-[8px] bg-[var(--color-danger-soft)] px-3 py-2 text-[11px] text-[var(--color-danger)]">
                Please correct the highlighted fields.
              </div>
              <label className="block">
                <span className="label text-[11px]">Full name</span>
                <input className="field h-[36px] border-[#e5b5b1] text-[12px]" defaultValue="" aria-invalid />
                <span className="mt-1 block text-[10.5px] text-[var(--color-danger)]">Enter your full name</span>
              </label>
              <label className="block">
                <span className="label text-[11px]">Email address</span>
                <input className="field h-[36px] border-[#e5b5b1] text-[12px]" defaultValue="jamie.parker@" aria-invalid />
                <span className="mt-1 block text-[10.5px] text-[var(--color-danger)]">Use a valid email address</span>
              </label>
            </div>
          </StateCard>

          <StateCard title="Customer booking status stages" subtitle="Booking · Status timeline">
            <div className="space-y-2.5 text-[12px]">
              {['Awaiting provider', 'Accepted / confirmed', 'Active', 'Completed'].map((label, index) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${
                      index < 2 ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[#cfdcd5]'
                    }`}
                  >
                    {index < 2 ? <Check size={9} strokeWidth={3} /> : null}
                  </span>
                  {label}
                  {index === 1 ? <Chip small className="ml-auto">Current</Chip> : null}
                </div>
              ))}
              <Chip small tone="neutral">Cancelled · Alternate terminal state</Chip>
            </div>
          </StateCard>

          <StateCard title="Provider job progress stages" subtitle="Job · On the way" tone="brand">
            <div className="space-y-2 text-[12px]">
              {['Confirmed', 'On the way', 'Arrived', 'Complete'].map((label, index) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`grid h-3 w-3 place-items-center rounded-full ${index < 2 ? 'bg-[var(--color-brand)]' : 'border border-[#cfdcd5]'}`} />
                  {label}
                  {index === 1 ? <Chip small className="ml-auto">Current</Chip> : null}
                </div>
              ))}
            </div>
          </StateCard>

          <StateCard title="Provider completion success" subtitle="Nice work, Alex" tone="brand">
            <CenteredState
              icon={<Check size={16} />}
              title="Nice work, Alex."
              body="Job marked complete. Your earnings will clear after the review window."
              action="Back to jobs"
            />
          </StateCard>
        </div>

        <h2 className="mt-10 text-[15px] font-semibold">Admin · Operations states</h2>
        <div className="mt-3 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-lg:grid-cols-1">
          <StateCard title="Loading bookings" subtitle="Bookings · Retrieving bookings">
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </StateCard>
          <StateCard title="Empty filtered customers" subtitle="No customers match these filters">
            <CenteredState
              icon={<AlertTriangle size={16} />}
              title="No customers match these filters"
              body="Try another name, widen the date range, or clear the state filter."
              action="Clear filters"
            />
          </StateCard>
          <StateCard title="Ledger error & retry" subtitle="Overview · Something went wrong" tone="danger">
            <div className="rounded-[8px] bg-[var(--color-danger-soft)] px-3 py-2 text-[11px] text-[var(--color-danger)]">
              <p className="font-medium">We couldn’t load the latest numbers.</p>
              <p className="mt-1">The sample data is stale. Retry to reload the example ledger.</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button small>Retry now</Button>
              <Button small variant="outline">Contact administrator</Button>
            </div>
          </StateCard>
          <StateCard title="No permission / Finance" subtitle="Finance permission required" tone="warn">
            <CenteredState
              icon={<ShieldX size={16} />}
              title="Finance permission required"
              body="Ask an administrator for the finance role to view this report."
              action="Request access"
            />
          </StateCard>
          <StateCard title="Unsaved platform changes" subtitle="You have unsaved changes" tone="warn">
            <div className="rounded-[8px] bg-[var(--color-warn)] px-3 py-2 text-[11px] text-[#6f5a2e]">
              <p className="font-medium">You have unsaved changes</p>
              <p className="mt-1">Save or continue editing before leaving this page.</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button small>Save changes</Button>
              <Button small variant="outline">Continue editing</Button>
              <Button small variant="danger">Discard changes</Button>
            </div>
          </StateCard>
          <StateCard title="Destructive suspension confirmation" subtitle="Suspend ServMate / S-000123" tone="danger">
            <p className="text-[11.5px] leading-[1.6] text-[var(--color-muted)]">
              Suspending hides the profile and pauses new bookings. Two open bookings need resolution first.
            </p>
            <div className="mt-3 flex gap-2">
              <Button small variant="outline">Keep active</Button>
              <Button small variant="danger">Confirm suspension</Button>
            </div>
          </StateCard>
          <StateCard title="Success / Verification approved" subtitle="Demo evidence verified" tone="brand">
            <div className="rounded-[8px] bg-[var(--color-soft)] px-3 py-2 text-[11px] text-[#3e5a4e]">
              <p className="font-medium text-[var(--color-brand-deep)]">Demo evidence verified</p>
              <p className="mt-1">Reviewer approval recorded · V-003 · Marcus Gonzales</p>
            </div>
          </StateCard>
          <StateCard title="Validation / Required reason" subtitle="A reason is required" tone="danger">
            <div className="rounded-[8px] bg-[var(--color-danger-soft)] px-3 py-2 text-[11px] text-[var(--color-danger)]">
              A reason is required to record this decision.
            </div>
            <label className="label mt-3 text-[11px]">Reason</label>
            <input className="field h-[36px] border-[#e5b5b1] text-[12px]" defaultValue="" aria-invalid />
            <span className="mt-1 block text-[10.5px] text-[var(--color-danger)]">Choose a reason from the list</span>
          </StateCard>
          <StateCard title="Disabled bulk action" subtitle="2 selected · 6 notifications · example">
            <div className="flex gap-2">
              <Button small disabled>Suspend selected</Button>
              <Button small variant="outline">Export selected</Button>
            </div>
            <p className="mt-2 text-[10.5px] text-[var(--color-muted)]">Selected rows are mixed-state and cannot be bulk updated.</p>
          </StateCard>
          <StateCard title="Refund processing outcome" subtitle="RF-1015 · Refund approved" tone="brand">
            <div className="rounded-[8px] bg-[var(--color-soft)] px-3 py-2 text-[11px] text-[#3e5a4e]">
              <p className="font-medium text-[var(--color-brand-deep)]">Refund approved</p>
              <p className="mt-1">Simulated refund of ₱660 to the original method.</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button small>View transaction</Button>
            </div>
          </StateCard>
          <StateCard title="Payout processing outcome" subtitle="PO-018 · Payout approved" tone="brand">
            <div className="rounded-[8px] bg-[var(--color-soft)] px-3 py-2 text-[11px] text-[#3e5a4e]">
              <p className="font-medium text-[var(--color-brand-deep)]">Payout approved</p>
              <p className="mt-1">₱1,000 demo payout scheduled. No funds move.</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button small>Back to payout queue</Button>
            </div>
          </StateCard>
          <StateCard title="Payout failed / Safe retry" subtitle="PO-016 · Payout needs attention" tone="danger">
            <div className="rounded-[8px] bg-[var(--color-danger-soft)] px-3 py-2 text-[11px] text-[var(--color-danger)]">
              <p className="font-medium">The sample payout didn’t complete</p>
              <p className="mt-1">Nothing was sent. Retry with the sample method.</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button small>Retry demo payout</Button>
              <Button small variant="outline">Report with reason</Button>
            </div>
          </StateCard>
        </div>

        <div className="mt-6">
          <FooterNote />
        </div>
      </main>
    </div>
  );
}

export default StatesPage;
