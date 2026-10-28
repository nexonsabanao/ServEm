/**
 * Authentication / authorization guards for callable functions.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { requireAllowedOrigin } from './cors';
import { db } from './firestore';

export interface AuthedRequest {
  uid: string;
  email?: string;
  token: Record<string, unknown>;
}

export function requireAuth(req: CallableRequest): AuthedRequest {
  if (!req.auth || typeof req.auth.uid !== 'string' || !req.auth.token) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }
  // Second CORS layer: browsers that bypass the framework headers (e.g. via
  // server proxies) still cannot act from an origin we did not configure.
  requireAllowedOrigin(req.rawRequest?.headers.origin);
  return {
    uid: req.auth.uid,
    email: (req.auth.token.email as string | undefined) ?? undefined,
    token: req.auth.token as Record<string, unknown>,
  };
}

export function isAdminToken(token: Record<string, unknown>): boolean {
  return token.admin === true;
}

export function requireAdmin(req: CallableRequest): AuthedRequest {
  const authed = requireAuth(req);
  if (!isAdminToken(authed.token)) {
    throw new HttpsError('permission-denied', 'Admin privileges required.');
  }
  return authed;
}

/** Loads profiles/{uid}; throws not-found when the profile doc is missing. */
export async function requireProfile(uid: string): Promise<Record<string, unknown>> {
  const snap = await db.collection('profiles').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'Profile not ready yet. Retry in a moment.');
  }
  return snap.data() ?? {};
}

export function requireRole(profile: Record<string, unknown>, role: 'servmate' | 'customer'): void {
  const isAdminProfile = profile.role === 'admin' || isAdminToken(profile);
  if (!isAdminProfile && profile.role !== role) {
    throw new HttpsError('permission-denied', `This action requires the '${role}' role.`);
  }
}
