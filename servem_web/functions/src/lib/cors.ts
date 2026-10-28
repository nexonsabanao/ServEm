/**
 * CORS allow-list, in two layers:
 *
 *  1. Framework layer (the `cors` option of onCall): firebase-functions v2
 *     types accept only string | RegExp | boolean | Array<string|RegExp>, so
 *     we pass an anchored RegExp that emits Access-Control headers for the
 *     production origins and localhost dev origins. Requests without an
 *     Origin header (native Flutter/iOS/Android clients) simply get no CORS
 *     headers and work normally.
 *  2. Handler layer (requireAllowedOrigin): when an Origin header IS present,
 *     it must exactly match the production origins or the explicit
 *     comma-separated ALLOWED_DEV_ORIGINS parameter. The permissive RegExp
 *     above only opens the browser-read gate; this rejects forged origins
 *     with any localhost port that the operator did not configure.
 */
import type { RequestHandler } from 'express';
import { HttpsError } from 'firebase-functions/v2/https';
import { ALLOWED_DEV_ORIGINS, PROD_ORIGINS } from './params';

const PROD_SET = new Set<string>(PROD_ORIGINS);

/** Anchored RegExp for the framework `cors` option of onCall functions. */
export const CORS_REGEX = /^https?:\/\/(servem-ph\.web\.app|servem-ph\.firebaseapp\.com|localhost(:\d{2,5})?|127\.0\.0\.1(:\d{2,5})?)$/;

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (PROD_SET.has(origin)) return true;
  // Resolved at request time so deploys can change dev origins without code.
  const raw = ALLOWED_DEV_ORIGINS.value();
  const dev = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return dev.includes(origin);
}

/**
 * Handler-level origin assertion. Absent Origin (native app / server-to-
 * server) is allowed through — authentication and role checks still apply.
 */
export function requireAllowedOrigin(origin: string | string[] | undefined): void {
  const value = Array.isArray(origin) ? origin[0] : origin;
  if (value && !isAllowedOrigin(value)) {
    throw new HttpsError('permission-denied', 'Origin is not in the CORS allow-list.');
  }
}

/**
 * Manual CORS middleware for onRequest endpoints. Origins that are not on the
 * allow-list never receive Access-Control headers; pre-flight from them is 403.
 */
export const restrictCors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  const allowed = isAllowedOrigin(Array.isArray(origin) ? origin[0] : origin);
  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', Array.isArray(origin) ? origin[0] : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,signature,payload_timestamp');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.status(allowed ? 204 : 403).end();
    return;
  }
  next();
};
