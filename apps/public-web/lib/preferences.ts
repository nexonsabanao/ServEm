import { SERVICE_AREAS } from './presentation';

/**
 * Account preferences.
 *
 * Only two things belong in here: choices the signed-in app actually honours
 * (discovery defaults, motion and text size) and notification intents that are
 * stored so a delivery channel can honour them later. Nothing in this file
 * claims a channel exists — the settings page labels delivery as not connected.
 */

export const SORT_OPTIONS = [
  { value: 'fastest', label: 'Fastest reply' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price-low', label: 'Price: low to high' },
  { value: 'price-high', label: 'Price: high to low' },
] as const;

export type SortPreference = (typeof SORT_OPTIONS)[number]['value'];

export const SORT_VALUES: SortPreference[] = SORT_OPTIONS.map((option) => option.value);

/** `All` plus every area a listed ServMate covers, in catalog order. */
export const AREA_OPTIONS: string[] = ['All', ...SERVICE_AREAS];

export const ALL_AREAS = 'All';

export type AccountPreferences = {
  /** Area preselected on the storefront. */
  defaultArea: string;
  /** Sort order preselected on the storefront. */
  defaultSort: SortPreference;
  reduceMotion: boolean;
  largerText: boolean;
  /** Email when a ServMate replies. Stored intent; delivery not connected. */
  notifyReplies: boolean;
  /** Email when a request changes state. */
  notifyRequestUpdates: boolean;
  /** Occasional product announcements. */
  notifyProductNews: boolean;
};

export const DEFAULT_PREFERENCES: AccountPreferences = {
  defaultArea: ALL_AREAS,
  defaultSort: 'fastest',
  reduceMotion: false,
  largerText: false,
  notifyReplies: true,
  notifyRequestUpdates: true,
  notifyProductNews: false,
};

/**
 * Folds a stored (possibly partial or hand-edited) record onto the defaults, so
 * a missing or stale field can never reach the UI as `undefined`.
 */
export function mergePreferences(stored: Partial<AccountPreferences> | undefined): AccountPreferences {
  const merged = { ...DEFAULT_PREFERENCES, ...(stored ?? {}) };
  return {
    defaultArea: AREA_OPTIONS.includes(merged.defaultArea) ? merged.defaultArea : ALL_AREAS,
    defaultSort: SORT_VALUES.includes(merged.defaultSort) ? merged.defaultSort : 'fastest',
    reduceMotion: Boolean(merged.reduceMotion),
    largerText: Boolean(merged.largerText),
    notifyReplies: Boolean(merged.notifyReplies),
    notifyRequestUpdates: Boolean(merged.notifyRequestUpdates),
    notifyProductNews: Boolean(merged.notifyProductNews),
  };
}

/**
 * Validates a preference patch from a request body.
 * Returns the accepted patch, or the field errors to show.
 */
export function readPreferencePatch(
  body: Record<string, unknown>,
): { ok: true; patch: Partial<AccountPreferences> } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const patch: Partial<AccountPreferences> = {};

  if ('defaultArea' in body) {
    const area = typeof body.defaultArea === 'string' ? body.defaultArea : '';
    if (!AREA_OPTIONS.includes(area)) errors.defaultArea = 'Pick an area from the list.';
    else patch.defaultArea = area;
  }

  if ('defaultSort' in body) {
    const sort = typeof body.defaultSort === 'string' ? body.defaultSort : '';
    if (!SORT_VALUES.includes(sort as SortPreference)) errors.defaultSort = 'Pick a sort order from the list.';
    else patch.defaultSort = sort as SortPreference;
  }

  for (const flag of ['reduceMotion', 'largerText', 'notifyReplies', 'notifyRequestUpdates', 'notifyProductNews'] as const) {
    if (flag in body) {
      if (typeof body[flag] !== 'boolean') errors[flag] = 'That preference must be on or off.';
      else patch[flag] = body[flag];
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, patch };
}
