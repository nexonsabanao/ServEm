import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ShieldAlert } from 'lucide-react';
import { Button, Callout, Card, FooterNote, PageHeader, TextInput } from '../../components/ui';
import { useApp } from '../../state/AppState';
import { callableErrorMessage, requestPayout } from '../../lib/functions';

function payoutAmount(input: string): number | null {
  const cleaned = input.replace(/[,\s₱]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

export function EarningsPage() {
  return (
    <>
      <PageHeader title="Your earnings" subtitle="A little clarity, every step of the way." />

      <Card className="mt-5 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="mt-0.5 text-[var(--color-brand-deep)]" aria-hidden />
          <div>
            <h2 className="card-title">No earnings recorded yet</h2>
            <p className="mt-1 text-[13px] leading-[1.7] text-[var(--color-muted)]">
              ServEm has not linked your ServMate job history to this device yet. Once accepted jobs are
              connected, completed work and the payout for each will appear here automatically.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-[var(--color-muted)]">
        <Link to="/mate/earnings/withdraw" className="link text-[12px]">
          Request a payout →
        </Link>
        <Link to="/mate/jobs" className="link-quiet">
          View your jobs
        </Link>
      </div>

      <Callout title="Weekly payout cycle">
        Payouts are released after a job is marked complete and the customer’s review window has passed.
        Moving money is handled by our payment provider, not by this screen.
      </Callout>
      <FooterNote />
    </>
  );
}

export function WithdrawPage() {
  const { user } = useApp();
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const value = payoutAmount(amount);
  const invalid = amount.trim() !== '' && value === null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);
    if (!user) {
      setError('Mag-sign in muna. Sign in to request a payout.');
      return;
    }
    if (value === null) {
      setError('Enter a payout amount in pesos, for example 1500.');
      return;
    }
    setPending(true);
    try {
      const result = await requestPayout({ amount: value });
      setDone(result.withdrawalId);
      setAmount('');
    } catch (reason) {
      setError(callableErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader title="Request a payout" subtitle="A little clarity, every step of the way." />
      <div className="mt-5 grid grid-cols-[1fr_240px] gap-6 max-lg:grid-cols-1">
        <div>
          <Card className="p-5">
            <form onSubmit={submit}>
              <TextInput
                label="Amount to withdraw"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="numeric"
                placeholder="1500"
                error={invalid ? 'Enter a whole peso amount, such as 1500.' : undefined}
                hint="Your available balance is checked by ServEm when you submit."
              />

              <div className="mt-4">
                <p className="label">Destination</p>
                <div className="rounded-[10px] border border-[var(--color-line)] bg-white px-4 py-3">
                  <p className="text-[12.5px] font-medium">Your verified payout account</p>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Set up in Settings. ServEm uses the bank or GCash account on your verified profile.
                  </p>
                </div>
              </div>

              <Button block type="submit" className="mt-4" disabled={pending}>
                {pending ? 'Submitting…' : 'Request payout'}
              </Button>

              {done ? (
                <p className="mt-3 flex items-center gap-2 text-[12px] text-[var(--color-brand)]">
                  <Check size={14} aria-hidden /> Payout request received · ref {done}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="mt-3 text-[12px] text-[var(--color-danger)]">
                  {error}
                </p>
              ) : null}
            </form>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Callout title="A little clarity">
            A request is queued for review. Our payment provider — not this screen — moves the money once it
            is approved. You will get a notification either way.
          </Callout>
          <div className="card p-4">
            <p className="text-[12.5px] font-medium">Need a hand with a payout?</p>
            <p className="mt-1 text-[11.5px] leading-[1.6] text-[var(--color-muted)]">
              Message support with the payout reference and we’ll take a look.
            </p>
            <Link to="/mate/messages" className="link mt-3 inline-block text-[12px]">
              Contact support
            </Link>
          </div>
        </aside>
      </div>
      <FooterNote />
    </>
  );
}

export function MateReviewsPage() {
  return (
    <>
      <PageHeader title="Your reviews" subtitle="A little clarity, every step of the way." />

      <Card className="mt-5 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="mt-0.5 text-[var(--color-brand-deep)]" aria-hidden />
          <div>
            <h2 className="card-title">No reviews yet</h2>
            <p className="mt-1 text-[13px] leading-[1.7] text-[var(--color-muted)]">
              Reviews from customers will appear here once a job is completed and the customer leaves one.
              There is nothing to show yet.
            </p>
          </div>
        </div>
      </Card>

      <p className="mt-4 text-[11px] text-[var(--color-muted-2)]">
        Ratings and reviews are written by customers after a completed booking. Publishing is connected to
        ServEm’s servers as each review is submitted.
      </p>
      <FooterNote />
    </>
  );
}
