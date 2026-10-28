import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { APP_LOCALE, type PhilippinePaymentMethod } from '../../lib/localization';

export interface BookingDraft {
  /** ISO date (YYYY-MM-DD) in Asia/Manila, or null until the customer picks a day. */
  day: string | null;
  /** Start time as `HH:mm` (24-hour) — exactly what `createBookingSchema.time` receives. */
  timeSlot: string;
  hours: number;
  address: string;
  unit: string;
  city: string;
  zip: string;
  province: string;
  notes: string;
  arrival: string;
  placeType: 'home' | 'condo' | 'apartment' | 'office' | 'retail' | 'other';
  paymentMethod: PhilippinePaymentMethod | null;
}

const initial: BookingDraft = {
  day: null,
  timeSlot: '09:00',
  hours: 2,
  address: '',
  unit: '',
  city: '',
  zip: '',
  province: '',
  notes: '',
  arrival: '',
  placeType: 'home',
  paymentMethod: null,
};

interface Ctx {
  draft: BookingDraft;
  set: (patch: Partial<BookingDraft>) => void;
}

const DraftContext = createContext<Ctx | null>(null);

export function BookingDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>(initial);
  const value = useMemo(
    () => ({ draft, set: (patch: Partial<BookingDraft>) => setDraft((current) => ({ ...current, ...patch })) }),
    [draft],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useBookingDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useBookingDraft must be used inside BookingDraftProvider');
  return ctx;
}

function parseIso(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatDraftDate(iso: string | null) {
  if (!iso) return 'Pick a date';
  return parseIso(iso).toLocaleDateString(APP_LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDraftDateLong(iso: string | null) {
  if (!iso) return 'No date selected yet';
  return parseIso(iso).toLocaleDateString(APP_LOCALE, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function draftStreet(draft: BookingDraft) {
  return draft.unit ? `${draft.address}, ${draft.unit}` : draft.address;
}

/** The full Philippine address line stored on the booking. */
export function draftFullAddress(draft: BookingDraft) {
  const lines = [
    draftStreet(draft),
    `${draft.city}${draft.province ? `, ${draft.province}` : ''}${draft.zip ? ` ${draft.zip}` : ''}`,
  ].filter((line) => line.trim().length > 0);
  return lines.join(' · ');
}

export function timeRange(start: string, hours: number) {
  return `${timeLabel(start)} – ${timeLabel(addHours(start, hours))}`;
}

/** `HH:mm` → the 12-hour label the wizard shows. Display only; `HH:mm` is what we send. */
export function timeLabel(time: string) {
  const [hourRaw, minuteRaw] = time.split(':').map(Number);
  const hour = hourRaw ?? 0;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minuteRaw ?? 0).padStart(2, '0')} ${suffix}`;
}

/** `HH:mm` plus whole hours, clamped to the same day (the server caps duration at 24h). */
export function addHours(start: string, hours: number) {
  const [hourRaw, minuteRaw] = start.split(':').map(Number);
  const total = Math.min((hourRaw ?? 0) + hours, 23) * 60 + (minuteRaw ?? 0);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export { APP_TIME_ZONE } from '../../lib/localization';
