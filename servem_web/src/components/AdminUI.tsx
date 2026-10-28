import type { ReactNode } from 'react';
import { Search, ShieldAlert } from 'lucide-react';
import { PageHeader, Skeleton } from './ui';
import type { AdminCollection } from '../lib/useAdminCollection';

export function AdminPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle ?? 'ServEm operations · Philippines · Asia/Manila time'}
        actions={actions}
      />
      {children}
    </>
  );
}

/** Standard loading / permission-error gate for every admin list and detail page. */
export function AdminCollectionState<T>({
  collection,
  empty,
  children,
}: {
  collection: AdminCollection<T>;
  empty?: ReactNode;
  children: (rows: T[]) => ReactNode;
}) {
  if (collection.loading) {
    return (
      <div className="card px-5 py-5" role="status" aria-live="polite" aria-busy="true" aria-label="Loading from Firestore">
        <div className="space-y-3.5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="hidden h-4 w-20 md:block" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (collection.error) {
    return (
      <div className="card px-6 py-12 text-center">
        <ShieldAlert size={22} className="mx-auto text-[#b4553f]" aria-hidden />
        <p className="mt-3 text-[14px] font-semibold">Hindi ma-load ang data</p>
        <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] leading-[1.65] text-[var(--color-muted)]">
          {collection.error}
        </p>
        <button type="button" onClick={collection.reload} className="btn btn-outline mt-5 h-[38px] text-[12.5px]">
          Try again
        </button>
      </div>
    );
  }

  if (collection.rows.length === 0) {
    if (collection.searched) {
      return (
        <AdminEmpty
          title={`No rows match “${collection.searchQuery ?? ''}”`}
          body="Clear the search to see every record in this list."
        />
      );
    }
    return <>{empty ?? <AdminEmpty title="Walang records yet" body="This list is empty because no matching documents exist in Firestore yet." />}</>;
  }

  return <>{children(collection.rows)}</>;
}

export function ExportButton({ filename = 'servem-report' }: { filename?: string }) {
  const download = () => {
    const table = document.querySelector('table');
    if (!table) return;
    const csv = [...table.querySelectorAll('tr')]
      .map((row) =>
        [...row.querySelectorAll('th, td')]
          .map((cell) => `"${(cell.textContent ?? '').trim().replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" onClick={download} className="btn btn-ghost btn-pill h-[40px] px-5 text-[12.5px]">
      Export report
    </button>
  );
}

export function AdminSearch({
  placeholder,
  value = '',
  onChange,
}: {
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="relative mt-4">
      <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted-2)]" />
      <input
        className="field h-[42px] border-[#e7eeea] bg-white pl-10 text-[12.5px]"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}

/**
 * Filters an admin collection client-side. Admin lists are at most 200 rows, so
 * matching against every visible field is simpler and more forgiving than a
 * hand-written predicate per page.
 */
export function filterCollection<T>(
  collection: AdminCollection<T>,
  query: string,
): AdminCollection<T> {
  const needle = query.trim().toLowerCase();
  if (!needle) return collection;
  return {
    ...collection,
    rows: collection.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle)),
    searched: true,
    searchQuery: query.trim(),
  };
}

export function FilterRow({ items }: { items: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11.5px] text-[var(--color-muted)]">
      {items.map((item, index) => (
        <span key={item} className="flex items-center gap-4">
          {index > 0 ? <span className="h-0.5 w-0.5 rounded-full bg-[#c4d1ca]" /> : null}
          {item}
        </span>
      ))}
    </div>
  );
}

export function AdminCard({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-4 px-5 pb-1 pt-5">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

export function ContextCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-[14px] font-semibold">{title}</h2>
      <div className="mt-3 text-[12px] leading-[1.65] text-[var(--color-muted)]">{children}</div>
    </section>
  );
}

export function RailActions({
  title = 'Reviewed & next steps',
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col gap-4 max-lg:w-full">
      <section className="card p-5">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <div className="mt-3 flex flex-col gap-2">{children}</div>
      </section>
      <p className="text-[10.5px] leading-[1.6] text-[var(--color-muted-2)]">
        Decisions here are recorded against the live booking, payment or dispute record. Money movement is handled by
        the payment provider, not by this screen.
      </p>
    </aside>
  );
}

export function QuickActions({
  primary,
  secondary,
  onAction,
}: {
  primary: string[];
  secondary?: string[];
  onAction?: (label: string) => void;
}) {
  const disabled = !onAction;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {primary.map((label, index) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          title={disabled ? 'Not available on this screen yet' : undefined}
          onClick={onAction ? () => onAction(label) : undefined}
          className={`btn ${index === 0 ? 'btn-primary' : 'btn-ghost'} h-[38px] rounded-[8px] px-4 text-[12.5px] disabled:opacity-60`}
        >
          {label}
        </button>
      ))}
      {secondary?.map((label) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          title={disabled ? 'Not available on this screen yet' : undefined}
          onClick={onAction ? () => onAction(label) : undefined}
          className="btn btn-outline h-[38px] rounded-[8px] border-[var(--color-line)] px-4 text-[12.5px] text-[var(--color-muted)] disabled:opacity-60"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function AdminStats({
  items,
  columns = 4,
}: {
  items: { label: string; value: string; note?: string }[];
  columns?: number;
}) {
  return (
    <div className={`mt-4 grid gap-3 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-4'} max-lg:grid-cols-2`}>
      {items.map((item) => (
        <div key={item.label} className="stat py-4">
          <p className="text-[11px] text-[#3e5a4e]">{item.label}</p>
          <p className="mt-2 text-[23px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">{item.value}</p>
          {item.note ? <p className="mt-0.5 text-[10px] text-[#4b6a5c]">{item.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="mt-5 flex h-[205px] items-end gap-3">
      {data.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center justify-end gap-2">
          <div
            className="w-full rounded-t-[2px] bg-[var(--color-bar)]"
            style={{ height: `${Math.max(12, (item.value / max) * 175)}px` }}
          />
          <span className="whitespace-nowrap text-[10px] text-[var(--color-muted)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ points, labels }: { points: number[]; labels: string[] }) {
  if (points.length < 2) {
    return (
      <div className="mt-5 rounded-[10px] border border-dashed border-[var(--color-line)] px-5 py-10 text-center text-[12px] text-[var(--color-muted)]">
        Not enough completed bookings yet to draw a trend.
      </div>
    );
  }

  const width = 400;
  const height = 175;
  const max = Math.max(...points, 1);
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - (point / max) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="mt-5">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[205px] w-full"
        role="img"
        aria-label="Service fee revenue trend"
      >
        <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

export function AdminTable({
  headers,
  children,
  footer,
  selectable = true,
}: {
  headers: string[];
  children: ReactNode;
  footer?: ReactNode;
  selectable?: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {selectable ? <th className="w-8" /> : null}
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap py-3 text-[10px] uppercase tracking-[0.04em]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-[var(--color-line-2)] px-4 py-3">{footer}</div> : null}
    </div>
  );
}

export function Checkbox() {
  return <input type="checkbox" className="h-3.5 w-3.5 rounded border-[var(--color-line)] accent-[var(--color-brand)]" aria-label="Select row" />;
}

/**
 * Admin lists are capped at 200 rows and the search box narrows them, so there
 * is no second page to link to. The footer states that instead of showing
 * page numbers that do not exist.
 */
export function PaginationFooter({ total, from = 1, to }: { total: number; from?: number; to?: number }) {
  const shownTo = Math.min(to ?? total, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[var(--color-muted)]">
      <span>
        Showing {total === 0 ? 0 : from}–{shownTo} of {total} results
      </span>
      <span>Use the search box to narrow this list</span>
    </div>
  );
}

export function AdminEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="card px-6 py-14 text-center">
      <p className="text-[14px] font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-[380px] text-[12px] text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

export function DocumentPreview({ kind }: { kind: string }) {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-[#f1f5f2] p-3">
      <div className="rounded-[6px] bg-white p-3 shadow-sm">
        <p className="text-[9px] font-semibold tracking-[0.1em] text-[var(--color-muted)]">SUBMITTED DOCUMENT</p>
        <div className="mt-2 flex gap-3">
          <div className="grid h-12 w-10 place-items-center rounded-[3px] bg-[#e5f5ec] text-[8px] text-[var(--color-brand-deep)]">
            PHOTO
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-3/4 rounded bg-[#e7eeea]" />
            <div className="h-2 w-1/2 rounded bg-[#eef3f0]" />
            <div className="h-2 w-2/3 rounded bg-[#eef3f0]" />
            <div className="h-2 w-1/3 rounded bg-[#eef3f0]" />
          </div>
        </div>
        <p className="mt-3 text-[8px] text-[var(--color-muted-2)]">
          {kind} · fields hidden until the reviewer opens the file
        </p>
      </div>
      <span className="absolute right-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-[var(--color-muted)]">
        PRIVATE
      </span>
    </div>
  );
}
