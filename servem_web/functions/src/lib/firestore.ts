/**
 * Shared admin SDK init plus Firestore/document helpers used across functions.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp();

export const db = getFirestore();
export const auth = getAuth();

export const serverTs = () => FieldValue.serverTimestamp();
export const arrayUnion = (...values: unknown[]) => FieldValue.arrayUnion(...values);

/** Collections that only Cloud Functions (admin bypass) may ever write. */
export const SERVER_ONLY_COLLECTIONS = [
  'profiles',
  'bookings',
  'threads',
  'notifications',
  'reviews',
  'payments',
  'payouts',
  'disputes',
  'tickets',
  'auditLog',
  'services',
  'servmates',
  'config',
  'rateLimits',
  'webhookEvents',
] as const;

/**
 * Guards against pathological ids even when a caller passed zod: Firestore
 * ids containing '..' or '/' can escape collection paths.
 */
export function assertSafePathSegment(value: string): void {
  if (value.includes('/') || value.includes('..') || /[.\s]/.test(value.trim())) {
    throw new Error('Malformed identifier');
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
