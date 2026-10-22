import {
  parsePreviewState,
  type ServmatePreviewState,
  type ServmateProfileDraft,
} from './servmate';

/**
 * Everything ServEm keeps in this browser, and the only place that knows it.
 *
 * Four items live here — bookmarked listings, recent search terms, the ServMate
 * workbench's preview (its Accept/Decline decisions plus any profile edits made
 * while previewing the roster), and whether this device already turned down the
 * install offer. Each was previously declared and JSON-guarded in two to four
 * files at once, which meant Settings' counts and its "nothing from ServEm is
 * stored here" claim were computed by re-parsing a shape another screen had
 * written: change the shape and the claim stays true in code while becoming
 * false in fact. Now every screen reads and writes through the functions below,
 * so the claim, the counts and the data are one thing.
 *
 * Two habits are deliberate:
 *
 * 1. **Client-only and best-effort.** Outside a browser, and whenever storage
 *    is unavailable (private mode, quota, a disabled cookie setting), a read
 *    answers with the empty value and a write answers "no" — never an exception.
 *    A component that already holds state in memory keeps working, and no
 *    caller needs its own `try`/`catch`.
 * 2. **The parse belongs to the owner.** Shapes are validated on read
 *    (`parsePreviewState`, the string list), so a list that grew a number or a
 *    record that grew junk is counted the same way it is displayed — by the
 *    same code, on both sides.
 *
 * The keys are private to this module on purpose: the raw storage layout is an
 * implementation detail of this file, not part of any screen's interface.
 */

const SAVED_SERVICES_KEY = 'servem:saved-services';
const RECENT_SEARCHES_KEY = 'servem:recent-searches';
const SERVMATE_PREVIEW_KEY = 'servem:servmate-preview';
const INSTALL_DISMISSED_KEY = 'servem:install-dismissed';

/** How many search terms this device keeps. */
export const MAX_RECENT_SEARCHES = 6;

/** What Settings reports about this browser. */
export type DeviceStorageCounts = {
  /** Bookmarked listings. */
  savedServices: number;
  /** Accept/Decline decisions held by the workbench preview. */
  previewDecisions: number;
  /** Profile drafts edited in the workbench preview. */
  previewProfiles: number;
  /** Whether this device asked ServEm to stop offering its install prompt. */
  installDismissed: boolean;
};

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Parses one item, answering `null` for anything absent or unreadable. */
function read(key: string): unknown {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** A stored list, keeping only the strings a list of ids or terms should hold. */
function stringList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

/* ------------------------------------------------------------------ *
 * Bookmarked listings — the storefront, the search screen and Settings
 * ------------------------------------------------------------------ */

export function readSavedServices(): string[] {
  return stringList(read(SAVED_SERVICES_KEY));
}

export function writeSavedServices(ids: string[]): boolean {
  return write(SAVED_SERVICES_KEY, ids);
}

export function clearSavedServices(): boolean {
  return remove(SAVED_SERVICES_KEY);
}

/* ------------------------------------------------------------------ *
 * Recent search terms — the search screen
 * ------------------------------------------------------------------ */

export function readRecentSearches(): string[] {
  return stringList(read(RECENT_SEARCHES_KEY)).slice(0, MAX_RECENT_SEARCHES);
}

/**
 * Keeps a term at the front of the list and persists the result, which is the
 * new list to render — one call instead of read, dedupe, slice and write.
 */
export function rememberSearch(term: string): string[] {
  const next = [term, ...readRecentSearches().filter((entry) => entry !== term)].slice(
    0,
    MAX_RECENT_SEARCHES,
  );
  write(RECENT_SEARCHES_KEY, next);
  return next;
}

export function clearRecentSearches(): boolean {
  return remove(RECENT_SEARCHES_KEY);
}

/* ------------------------------------------------------------------ *
 * The workbench preview — its own screen, the public profile and Settings
 * ------------------------------------------------------------------ */

/**
 * The preview state, parsed by the same code that will write it back. This is
 * the read Settings counts from, so a shape change moves the counts with it.
 */
export function readPreviewState(): ServmatePreviewState {
  return parsePreviewState(read(SERVMATE_PREVIEW_KEY));
}

export function writePreviewState(state: ServmatePreviewState): boolean {
  return write(SERVMATE_PREVIEW_KEY, state);
}

/* ------------------------------------------------------------------ *
 * The install offer — the shell's affordance, and the switch that silences it
 * ------------------------------------------------------------------ */

/**
 * Whether this device already answered "Not now".
 *
 * The flag is a plain `true`, not a timestamp: the promise the affordance makes
 * is that saying no is final, so it must read the same after a month.
 */
export function readInstallDismissed(): boolean {
  return read(INSTALL_DISMISSED_KEY) === true;
}

/** Records (or clears) that answer. `false` erases the key rather than storing it. */
export function writeInstallDismissed(dismissed: boolean): boolean {
  return dismissed ? write(INSTALL_DISMISSED_KEY, true) : remove(INSTALL_DISMISSED_KEY);
}

export function clearPreviewState(): boolean {
  return remove(SERVMATE_PREVIEW_KEY);
}

/** One roster entry's draft, as the public profile overlays it. */
export function readProfileDraft(providerId: string): ServmateProfileDraft | undefined {
  return readPreviewState().profiles[providerId];
}

/* ------------------------------------------------------------------ *
 * What this browser holds, for the screen that says so
 * ------------------------------------------------------------------ */

export function deviceStorageCounts(): DeviceStorageCounts {
  const preview = readPreviewState();
  return {
    savedServices: readSavedServices().length,
    previewDecisions: Object.keys(preview.decisions).length,
    previewProfiles: Object.keys(preview.profiles).length,
    installDismissed: readInstallDismissed(),
  };
}
