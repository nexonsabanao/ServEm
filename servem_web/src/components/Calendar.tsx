import { useState } from 'react';
import { APP_LOCALE, APP_TIME_ZONE } from '../lib/localization';

const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Manila "today" as YYYY-MM-DD, independent of the browser’s time zone. */
export function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, dateStyle: 'short' }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month, 2)).toLocaleDateString(APP_LOCALE, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

interface CalendarMonth {
  label: string;
  year: number;
  month: number;
  firstWeekday: number;
  days: number;
}

/** The next three months, starting from the month that holds the earliest bookable day. */
function buildMonths(fromIso: string): CalendarMonth[] {
  const [year, month] = fromIso.split('-').map(Number);
  const months: CalendarMonth[] = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const cursor = new Date(Date.UTC(year, month - 1 + offset, 1));
    months.push({
      label: monthLabel(cursor.getUTCFullYear(), cursor.getUTCMonth()),
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      firstWeekday: cursor.getUTCDay(),
      days: new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate(),
    });
  }
  return months;
}

const toIso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/**
 * Real month grid. Days before the earliest bookable day or after the latest one
 * are shown but not selectable, so the customer cannot ask for a slot that has
 * already passed.
 */
export function MonthCalendar({
  value,
  onSelect,
  minDate = manilaToday(),
  maxDaysAhead = 60,
  gridClassName = '',
}: {
  value: string | null;
  onSelect: (iso: string) => void;
  minDate?: string;
  maxDaysAhead?: number;
  gridClassName?: string;
}) {
  const months = buildMonths(minDate);
  const [monthIndex, setMonthIndex] = useState(0);
  const maxDate = addDays(minDate, maxDaysAhead);
  const today = manilaToday();
  const month = months[monthIndex];
  const cells: (number | null)[] = [
    ...Array.from({ length: month.firstWeekday }, () => null),
    ...Array.from({ length: month.days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[15.5px] font-medium">{month.label}</p>
        <div className="flex items-center gap-1 text-[var(--color-muted)]">
          <button
            type="button"
            aria-label="Previous month"
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--color-soft)] disabled:opacity-40"
            disabled={monthIndex === 0}
            onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next month"
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--color-soft)] disabled:opacity-40"
            disabled={monthIndex === months.length - 1}
            onClick={() => setMonthIndex((i) => Math.min(months.length - 1, i + 1))}
          >
            ›
          </button>
        </div>
      </div>

      <div className={`calendar-grid mt-4 ${gridClassName}`}>
        {dayLabels.map((label, i) => (
          <div key={`${label}-${i}`} className="calendar-cell" data-day="true">
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} />;
          const iso = toIso(month.year, month.month, day);
          const bookable = iso >= minDate && iso <= maxDate;
          return (
            <button
              key={day}
              type="button"
              disabled={!bookable}
              className="calendar-cell enabled:hover:bg-[#f1f7f4] disabled:cursor-not-allowed disabled:opacity-35"
              data-selected={iso === value ? 'true' : undefined}
              data-today={iso === today ? 'true' : undefined}
              onClick={() => onSelect(iso)}
              aria-pressed={iso === value}
              aria-label={`${month.label} ${day}${bookable ? '' : ' — not available'}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
