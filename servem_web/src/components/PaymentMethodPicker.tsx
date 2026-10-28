import { Banknote, Landmark } from 'lucide-react';
import { philippinePaymentMethods, type PhilippinePaymentMethod } from '../lib/localization';

const marks: Record<PhilippinePaymentMethod, { short: string; tile: string; text: string }> = {
  gcash: { short: 'GCash', tile: 'bg-[#0f6bd7] text-white', text: 'text-white' },
  maya: { short: 'Maya', tile: 'bg-[#1f7a72] text-white', text: 'text-white' },
  bank_transfer: { short: 'Bank', tile: 'bg-[#eef3f0] text-[var(--color-brand-deep)]', text: '' },
  cash_on_completion: { short: 'Cash', tile: 'bg-[#f4efe6] text-[#7a6440]', text: '' },
};

function Mark({ method }: { method: PhilippinePaymentMethod }) {
  const mark = marks[method];
  if (method === 'bank_transfer' || method === 'cash_on_completion') {
    const Icon = method === 'bank_transfer' ? Landmark : Banknote;
    return (
      <span className={`grid h-8 w-12 shrink-0 place-items-center rounded-md ${mark.tile}`} aria-hidden="true">
        <Icon size={15} strokeWidth={1.9} />
      </span>
    );
  }
  return (
    <span className={`grid h-8 w-12 shrink-0 place-items-center rounded-md ${mark.tile}`} aria-hidden="true">
      <span className="text-[9.5px] font-bold tracking-[0.02em]">{mark.short}</span>
    </span>
  );
}

/** Radio group over the payment rails ServEm actually settles through in the Philippines. */
export function PaymentMethodPicker({
  value,
  onChange,
  name = 'payment-method',
  error,
}: {
  value: PhilippinePaymentMethod | null;
  onChange: (method: PhilippinePaymentMethod) => void;
  name?: string;
  error?: string;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="sr-only">Payment method</legend>
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {philippinePaymentMethods.map((method) => {
          const selected = method.id === value;
          return (
            <label
              key={method.id}
              className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-4 py-3 transition-colors ${
                selected
                  ? 'border-[var(--color-brand)] bg-[var(--color-soft)]'
                  : 'border-[var(--color-line)] bg-white hover:border-[#bfd6cb]'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={method.id}
                checked={selected}
                onChange={() => onChange(method.id)}
                className="sr-only"
              />
              <span aria-hidden="true" className="mt-0.5 grid place-items-center">
                <Mark method={method.id} />
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[13px] font-medium ${selected ? 'text-[var(--color-brand-deep)]' : 'text-[var(--color-ink)]'}`}
                >
                  {method.label}
                  {selected ? <span className="sr-only"> (selected)</span> : null}
                </span>
                <span className="text-[11.5px] text-[var(--color-muted)]">{method.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
