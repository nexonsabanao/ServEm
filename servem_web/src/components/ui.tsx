import { Link } from 'react-router-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { MapPin, Star } from 'lucide-react';

export { Link };

/* ------------------------------------------------------------------ brand */

export function Logo({ light = false, to = '/' }: { light?: boolean; to?: string }) {
  return (
    <Link
      to={to}
      className="logo"
      style={light ? { color: '#fff' } : undefined}
      aria-label={to === '/' ? 'ServEm home' : 'ServEm dashboard'}
    >
      ServEm
    </Link>
  );
}

/* ----------------------------------------------------------------- layout */

export function PageHeader({
  title,
  subtitle,
  actions,
  className = '',
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <div className="page-sub">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function FooterNote({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="footer-note">{children}</p>;
}

export function SectionHead({
  title,
  action,
  className = '',
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <h2 className="section-title">{title}</h2>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- buttons */

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'quiet';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  outline: 'btn-outline',
  danger: 'btn-danger',
  quiet: 'btn-outline',
};

export function Button({
  variant = 'primary',
  pill = false,
  small = false,
  block = false,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  pill?: boolean;
  small?: boolean;
  block?: boolean;
}) {
  return (
    <button
      className={`btn ${variantClass[variant]} ${pill ? 'btn-pill' : ''} ${small ? 'btn-sm' : ''} ${
        block ? 'btn-block' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  to,
  variant = 'primary',
  pill = false,
  small = false,
  block = false,
  className = '',
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  pill?: boolean;
  small?: boolean;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`btn ${variantClass[variant]} ${pill ? 'btn-pill' : ''} ${small ? 'btn-sm' : ''} ${
        block ? 'btn-block' : ''
      } ${className}`}
    >
      {children}
    </Link>
  );
}

/* ----------------------------------------------------------------- fields */

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label ? <label className="label">{label}</label> : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--color-danger)]">{error}</p>
      ) : hint ? (
        <p className="mt-2 text-xs text-[var(--color-muted-2)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }) {
  return (
    <Field label={label} hint={hint} error={error}>
      <input className="field" {...rest} />
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea className={`field ${className}`} {...rest} />
    </Field>
  );
}

export function Select({
  label,
  children,
  className = '',
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <Field label={label} className={className}>
      <select className="field appearance-none pr-10 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%2364756c%22><path d=%22M2 4l4 4 4-4%22/></svg>')] bg-[length:12px] bg-[right_16px_center] bg-no-repeat" {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted-2)]"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <input
        className={`field pl-11 ${className}`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ chips */

export function Chip({
  children,
  tone = 'brand',
  small = false,
  className = '',
}: {
  children: ReactNode;
  tone?: 'brand' | 'neutral' | 'warn' | 'danger' | 'info';
  small?: boolean;
  className?: string;
}) {
  const toneClass =
    tone === 'neutral'
      ? 'chip-neutral'
      : tone === 'warn'
        ? 'chip-warn'
        : tone === 'danger'
          ? 'chip-danger'
          : tone === 'info'
            ? 'chip-info'
            : '';
  return <span className={`chip ${toneClass} ${small ? 'chip-sm' : ''} ${className}`}>{children}</span>;
}

const statusTone: Record<string, 'brand' | 'neutral' | 'warn' | 'danger' | 'info'> = {
  confirmed: 'info',
  accepted: 'info',
  in_progress: 'warn',
  blocked: 'danger',
  completed: 'brand',
  cancelled: 'neutral',
  requested: 'warn',
  rescheduled: 'warn',
  paid: 'brand',
  pending: 'warn',
  refunded: 'neutral',
  review: 'warn',
  open: 'info',
  waiting: 'warn',
  resolved: 'brand',
  active: 'brand',
  limited: 'warn',
  closed: 'neutral',
  verified: 'brand',
  suspended: 'danger',
  approved: 'brand',
  rejected: 'danger',
  published: 'brand',
  flagged: 'warn',
  removed: 'neutral',
  live: 'brand',
  paused: 'neutral',
  invited: 'warn',
  disabled: 'neutral',
  scheduled: 'info',
  high: 'danger',
  normal: 'neutral',
  low: 'neutral',
};

export function StatusPill({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Chip tone={statusTone[status] ?? 'neutral'} small>
      {label}
    </Chip>
  );
}

/* ----------------------------------------------------------------- avatar */

export function Avatar({
  src,
  name,
  size = 36,
  className = '',
}: {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase();

  // No photo yet: show initials rather than an <img src=""> the browser would
  // re-request the whole page for.
  if (!src) {
    return (
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded-full bg-[var(--color-soft)] font-medium text-[var(--color-brand-deep)] ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size / 2.6) }}
      >
        {initials || 'S'}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size, background: '#e5f5ec' }}
    />
  );
}

export function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px] text-[#1d3b2e]" aria-label={`${rating} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={1.4}
          fill={i < Math.round(rating) ? 'currentColor' : 'none'}
          aria-hidden
        />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- surface */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Callout({
  title,
  children,
  className = '',
}: {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`tip ${className}`}>
      <p className="font-medium text-[#1d4a38]">{title}</p>
      {children ? <p className="mt-1 text-[#3e5a4e]">{children}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className = '',
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card flex flex-col items-center px-8 py-16 text-center ${className}`}>
      {icon ? (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-soft)] text-[var(--color-brand-deep)]">
          {icon}
        </div>
      ) : null}
      <h3 className="card-title">{title}</h3>
      {body ? <p className="mt-2 max-w-[42ch] text-[13px] text-[var(--color-muted)]">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ProgressSteps({ steps, active }: { steps: string[]; active: number }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {steps.map((step, i) => (
        <div
          key={step}
          className={`rounded-[10px] px-4 py-2.5 text-[13px] ${
            i === active
              ? 'bg-[var(--color-soft)] font-medium text-[var(--color-brand-deep)]'
              : 'bg-[#f1f5f2] text-[var(--color-muted)]'
          }`}
        >
          {i + 1} · {step}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(23,43,34,0.42)] p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="fade-in w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(12,40,28,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-[13px] text-[var(--color-muted)]">{children}</div>
        {footer ? <div className="mt-6 flex flex-col gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- map */

export function MapSketch({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative h-[110px] overflow-hidden rounded-[10px] bg-[#edf2ef] ${className}`}
      role="img"
      aria-label="Map placeholder. ServEm does not show a live map pin yet."
    >
      {/* Streets traced from the design boards: three verticals, two horizontals stopping mid-map. */}
      <div className="absolute left-[7%] top-0 h-full w-2 bg-white" />
      <div className="absolute left-[21%] top-0 h-full w-2 bg-white" />
      <div className="absolute left-[35%] top-0 h-full w-2 bg-white" />
      <div className="absolute left-0 top-[26%] h-[7px] w-[44%] bg-white" />
      <div className="absolute left-0 top-[71%] h-[7px] w-[44%] bg-white" />
      <span className="absolute left-[21.7%] top-[45%] grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--color-brand)] text-white shadow-[0_4px_12px_rgba(11,87,61,0.35)]">
        <MapPin size={14} />
      </span>
      <span className="absolute left-[25%] top-[45%] h-[29px] w-[46px] -translate-y-1/2 rounded-[6px] bg-[#d6e8db]" />
      <span className="absolute bottom-1 left-2.5 rounded bg-white/85 px-1.5 py-0.5 text-[9px] font-medium tracking-[0.08em] text-[var(--color-muted)]">
        MAP PREVIEW · NOT LIVE
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

export function DataTable({
  columns,
  children,
  className = '',
}: {
  columns: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="table">
        <thead>
          <tr>{columns}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Pagination({ from, to, total }: { from: number; to: number; total: number }) {
  return (
    <div className="flex items-center justify-between px-1 pt-3 text-[12.5px] text-[var(--color-muted)]">
      <span>
        Showing {from}–{to} of {total} results
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- category */

export const categoryMeta = [
  { id: 'Repairs', label: 'Repairs', icon: 'wrench' },
  { id: 'Cleaning', label: 'Cleaning', icon: 'sparkles' },
  { id: 'Errands', label: 'Errands', icon: 'briefcase' },
  { id: 'Assembly', label: 'Assembly', icon: 'armchair' },
  { id: 'Tech help', label: 'Tech help', icon: 'laptop' },
  { id: 'Yard & garden', label: 'Yard & garden', icon: 'sprout' },
] as const;
