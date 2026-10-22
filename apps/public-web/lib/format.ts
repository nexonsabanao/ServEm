/**
 * Shared display formatting. Server components only for the date helpers: the
 * figures are rendered on the server, where the time zone is known and stable.
 */

/**
 * What a quote-only listing's rate says, in one place.
 *
 * A ServMate may publish a listing with no fixed price (`pricingModel: 'quote'`).
 * The hero, the fact list, the card's footer and the receipt all print this
 * sentence, and they used to print two different versions of it on one screen.
 * The number formatter and both price renderers read it from here, so there is
 * one owner for the words and only the typography differs per surface.
 */
export const QUOTE_PHRASE = 'Ask for a quote';

/** `180000` centavos → `₱1,800`. */
export function formatPhp(centavos: number): string {
  const pesos = Math.floor(centavos / 100);
  const remainder = centavos % 100;
  const groupedPesos = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(pesos);
  return `₱${groupedPesos}${remainder === 0 ? '' : `.${remainder.toString().padStart(2, '0')}`}`;
}

/** The rate line used on dockets and receipts. */
export function formatRate(startingPriceCentavos?: number): string {
  if (startingPriceCentavos === undefined) return QUOTE_PHRASE;
  return `From ${formatPhp(startingPriceCentavos)}`;
}

/**
 * A listing's starting amount, or the honest answer for a quote-only listing.
 *
 * Every surface that prints a price by itself goes through here rather than
 * printing `₱NaN` or implying a number that was never set. A surface that also
 * styles the words (the hero, the card footer) reads `QUOTE_PHRASE` directly and
 * keeps its own markup.
 */
export function formatFromPrice(startingPriceCentavos?: number): string {
  return startingPriceCentavos === undefined ? QUOTE_PHRASE : formatPhp(startingPriceCentavos);
}

/** `5` → `~5 min`, `90` → `~1.5 hr`. Used wherever a reply time is shown. */
export function formatReplies(mins: number): string {
  if (mins < 60) return `~${mins} min`;
  const hours = mins / 60;
  return `~${hours % 1 === 0 ? hours : hours.toFixed(1)} hr`;
}

const dayFormat = new Intl.DateTimeFormat('en-PH', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dayShortFormat = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short' });

const timeFormat = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });

const monthFormat = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' });

/** `Tue, 6 Oct 2026`. */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

/** `6 Oct`. */
export function formatDayShort(iso: string): string {
  return dayShortFormat.format(new Date(iso));
}

/** `3:42 PM`. */
export function formatTimeOfDay(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** `October 2026`. */
export function formatMonth(iso: string): string {
  return monthFormat.format(new Date(iso));
}
