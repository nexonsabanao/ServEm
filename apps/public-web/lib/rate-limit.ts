

/**
 * Rate limiting (blueprint §14; TEST_STRATEGY §2 "Authentication/authorization").
 *
 * The threats this covers are credential stuffing on sign-in, reset-link
 * spam on recovery, message flooding, report abuse and upload bursts. The
 * shape is a fixed window per bucket-and-identity, counted in this process.
 *
 * Two honest limits are stated rather than hidden:
 *
 * 1. **The counter lives in memory.** The development store is one process,
 *    so one counter is the whole truth here. A second instance would keep its
 *    own count — production needs a shared counter (Redis or an edge
 *    limiter), which the roadmap records rather than this module pretending
 *    to be it.
 * 2. **Identity is coarse before sign-in.** An anonymous caller is a client
 *    address, which a determined attacker rotates; that is why the tight
 *    limits key on address *and* the submitted email together, and why the
 *    endpoints behind this limiter also answer uniformly (no enumeration).
 *
 * Limits are overridable per bucket with `SERVEM_RATE_LIMIT_<NAME>=count/minutes`
 * so a test environment can loosen them without editing code.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Prune before the map can grow without bound; ~1h windows, swept on write. */
const SWEEP_THRESHOLD = 5_000;

export const RATE_LIMITS = {
  /** Password sign-in attempts. */
  signin: { limit: 10, windowMs: 5 * 60_000 },
  /** Per client address — a second factor beside the per-email limit above. */
  signinPerAddress: { limit: 30, windowMs: 5 * 60_000 },
  /**
   * Account creation, per client address.
   *
   * Deliberately loose: whole neighbourhoods can share one address behind
   * carrier-grade NAT, so a tight cap here would lock out real people at
   * sign-up — the worst possible moment. It exists to stop a scripted run
   * minting hundreds, not to police a household.
   */
  signup: { limit: 40, windowMs: 60 * 60_000 },
  /** Password recovery requests for one address, per client address + email. */
  passwordReset: { limit: 5, windowMs: 10 * 60_000 },
  /** Password recovery, per client address across all emails. */
  passwordResetPerAddress: { limit: 60, windowMs: 10 * 60_000 },
  /** Redeeming a reset link, per client address. */
  passwordResetComplete: { limit: 20, windowMs: 10 * 60_000 },
  /** Chat sends, per signed-in account. */
  messageSend: { limit: 30, windowMs: 60_000 },
  /** Reports filed, per signed-in account. */
  report: { limit: 20, windowMs: 60 * 60_000 },
  /** Job media uploads, per signed-in account. */
  mediaUpload: { limit: 30, windowMs: 60 * 60_000 },
  /** Job posts started, per signed-in account. */
  jobCreate: { limit: 10, windowMs: 60 * 60_000 },
  /** Offers submitted, per signed-in account. */
  offerSubmit: { limit: 30, windowMs: 60 * 60_000 },
  /**
   * Attempts to unlock the moderation console, per client address.
   *
   * The operator credential is a long random secret rather than a password
   * anybody chose, so this is not the control that makes guessing hopeless —
   * token length is. It is here so a brute-force run is loud and slow instead of
   * free, and it is small on purpose: five tries per ten minutes is far more
   * than an operator typing from a password manager needs.
   */
  moderationSignin: { limit: 5, windowMs: 10 * 60_000 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

function configured(name: RateLimitName): { limit: number; windowMs: number } {
  const fallback = RATE_LIMITS[name];
  const override = process.env[`SERVEM_RATE_LIMIT_${name.toUpperCase()}`];
  if (!override) return fallback;
  const [count, minutes] = override.split('/');
  const limit = Number.parseInt(count ?? '', 10);
  const windowMinutes = Number.parseFloat(minutes ?? '');
  if (!Number.isFinite(limit) || limit < 1) return fallback;
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) return fallback;
  return { limit, windowMs: Math.round(windowMinutes * 60_000) };
}

function sweep(now: number): void {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Counts one attempt against a bucket-and-identity pair.
 *
 * The window is fixed rather than sliding: simple to reason about, and the
 * worst case for the caller is waiting out one window, never a permanent
 * lockout — there is no state here that an attacker can trip and leave set.
 */
export function consume(
  name: RateLimitName,
  identity: string,
  /** A complete replacement rule, not a patch — both fields together. */
  rule?: { limit: number; windowMs: number },
): RateLimitResult {
  const { limit: ceiling, windowMs } = rule ?? configured(name);
  const now = Date.now();
  const key = `${name}:${identity}`;
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: ceiling - 1 };
  }

  bucket.count += 1;
  if (bucket.count > ceiling) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, remaining: ceiling - bucket.count };
}

/** Drops every counter. Test suites call this between cases; nothing else should. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * The caller's identity before sign-in: the first address a proxy forwarded,
 * or a stable placeholder. Deliberately coarse — the tight limits pair this
 * with the submitted email, so rotating the address alone does not reset the
 * per-account count.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip') || 'local';
}

/**
 * The 429 every rate-limited route returns: one message, a Retry-After, no
 * detail. The refusal says nothing about whether the account exists or the
 * credentials were close — an attacker learns only that they should stop.
 */
export function tooManyResponse(retryAfterSeconds: number): Response {
  return Response.json(
    {
      message: 'Too many attempts. Wait a moment and try again.',
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(retryAfterSeconds),
      },
    },
  );
}
