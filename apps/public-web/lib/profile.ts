import { listCategories } from './categories';
import { NEUTRAL_TONE, SERVICE_AREAS, toneForCategory, type Gradient } from './presentation';

/**
 * The signed-in customer's own profile.
 *
 * This is the half of the identity a ServMate sees when a request arrives, so
 * it is deliberately small: a display name, the area they live in, a short line
 * about the kind of help they usually need, and an avatar tone. Phone numbers,
 * street addresses and precise locations are out — the blueprint keeps those
 * out of the customer profile, and a ServMate only needs the area to judge
 * whether a job is within reach.
 *
 * Pure and import-safe on the server and the client: the same validators run in
 * the API route and in the form, so a client that skips validation still gets
 * the same rejection.
 */

export const ABOUT_MAX = 240;

export type CustomerProfile = {
  /** The area the customer lives in, from the marketplace's area list. */
  area: string;
  /** One line about the kind of help they usually book. Empty is fine. */
  about: string;
  /** Avatar tone key, resolving through `TONE_SWATCHES`. */
  tone: string;
};

export const DEFAULT_PROFILE: CustomerProfile = { area: '', about: '', tone: 'ink' };

/**
 * Avatar tones, drawn from the same slate family the catalog uses so a customer
 * avatar sits in the same palette as a ServMate's. `ink` is the default and
 * matches the letter avatars already used across the account area.
 *
 * Keyed by category display name, because a tone key is stored on the profile
 * and a person picks it by the category it looks like.
 */
function categoryTones(): Record<string, Gradient> {
  const tones: Record<string, Gradient> = {};
  for (const category of listCategories()) tones[category.name] = toneForCategory(category.id);
  return tones;
}

export const TONE_SWATCHES: Record<string, Gradient> = {
  ink: NEUTRAL_TONE,
  ...categoryTones(),
};

export const TONE_KEYS: string[] = Object.keys(TONE_SWATCHES);

export function isToneKey(value: string): boolean {
  return value in TONE_SWATCHES;
}

/**
 * Folds a stored (possibly partial or hand-edited) record onto the defaults.
 *
 * A stale area or a tone that no longer exists falls back rather than rendering
 * an empty avatar or a broken swatch, so old data on disk can never break a
 * page.
 */
export function mergeProfile(stored: Partial<CustomerProfile> | undefined): CustomerProfile {
  const merged = { ...DEFAULT_PROFILE, ...(stored ?? {}) };
  return {
    area: typeof merged.area === 'string' ? merged.area : '',
    about: typeof merged.about === 'string' ? merged.about : '',
    tone: isToneKey(merged.tone) ? merged.tone : DEFAULT_PROFILE.tone,
  };
}

/**
 * The areas a customer can live in.
 *
 * Kept in step with the storefront's area filter by reading the same list, so
 * adding a service area is a catalog change rather than a profile change.
 * `''` is the unset choice.
 */
export const AREA_CHOICES: string[] = ['', ...SERVICE_AREAS];

export type ProfilePatch = Partial<CustomerProfile>;

/**
 * Validates a profile patch from a request body.
 *
 * Unknown keys are ignored rather than stored, so a client cannot grow the
 * record with fields the blueprint has not approved. Returns the accepted
 * patch, or the field errors to show.
 */
export function readProfilePatch(
  body: Record<string, unknown>,
): { ok: true; patch: ProfilePatch } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const patch: ProfilePatch = {};

  if ('area' in body) {
    const area = typeof body.area === 'string' ? body.area.trim() : '';
    // Empty clears the area; anything else must be a listed marketplace area.
    if (area && !AREA_CHOICES.includes(area)) errors.area = 'Pick an area from the list.';
    else patch.area = area;
  }

  if ('about' in body) {
    const about = typeof body.about === 'string' ? body.about.trim() : '';
    if (Array.from(about).length > ABOUT_MAX) {
      errors.about = `Keep this under ${ABOUT_MAX} characters.`;
    } else {
      patch.about = about;
    }
  }

  if ('tone' in body) {
    const tone = typeof body.tone === 'string' ? body.tone : '';
    if (!isToneKey(tone)) errors.tone = 'Pick one of the avatar colours.';
    else patch.tone = tone;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, patch };
}
