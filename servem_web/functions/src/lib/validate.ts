/**
 * Reusable zod schemas and text sanitisation for every write path.
 * All callable inputs MUST be parsed by one of these schemas before touching
 * Firestore. Nothing from the client is trusted, including IDs and prices.
 */
import { z } from 'zod';

/** Firebase Auth uids and Firestore ids: alphanumeric, dash, underscore. */
export const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{6,128}$/, 'Malformed identifier');

export const shortText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max);

export const PAYMENT_METHODS = ['gcash', 'maya', 'bank_transfer', 'cash_on_completion'] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export const PAYOUT_METHODS = ['gcash', 'maya', 'bank_transfer'] as const;
export const payoutMethodSchema = z.enum(PAYOUT_METHODS);

export const BOOKING_STATUSES = [
  'requested',
  'accepted',
  'declined',
  'in_progress',
  'completed',
  'cancelled',
  'reviewed',
] as const;
export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

/** Calendar date as YYYY-MM-DD (validated further against Asia/Manila time). */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((s: string) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Invalid calendar date');

/** 24-hour clock HH:mm. */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:mm (24-hour)');

export const moneySchema = z.coerce
  .number()
  .finite()
  .positive()
  .max(10_000_000, 'Amount out of range');

export const ratingSchema = z.coerce.number().int().min(1).max(5);

export const prioritySchema = z.enum(['low', 'normal', 'high']);

/**
 * Normalises untrusted free text for storage: strips ASCII/Unicode control
 * characters (except \n and \t), collapses excessive blank lines, trims.
 * Stored as plain text only — the app must never render it as HTML.
 */
export function sanitizeText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\u202A|\u202B|\u202C|\u202D|\u202E|\u2066|\u2067|\u2068|\u2069/g, '') // bidi overrides
    .replace(/\r\n?/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

/** Zod transform that sanitises + length-checks free text. */
export const sanitizedText = (min: number, max: number) =>
  z
    .string()
    .transform((s: string) => sanitizeText(s))
    .refine((s: string) => s.length >= min && s.length <= max, `Text must be ${min}-${max} characters after sanitising`);

/**
 * Minimal structural contract satisfied by every zod schema. Typing against
 * this instead of `z.ZodTypeAny`/`z.infer` keeps the validation layer
 * independent of zod's namespace types while preserving inferred schemas.
 */
export interface Schema<T> {
  safeParse(data: unknown): {
    success: boolean;
    data?: T;
    error?: { issues: { path?: unknown; message: string }[] };
  };
}

/** Parse `raw` with a zod schema, throwing a client-safe message on failure.
 *  T is inferred from the real zod schema at build time; the `any` default is
 *  a fallback for untyped schema references. */
export function parseInput<T = any>(schema: Schema<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success || result.data === undefined) {
    const first = result.error?.issues[0];
    const pathArr = Array.isArray(first?.path) ? (first.path as unknown[]).map((p) => String(p)) : [];
    const where = pathArr.length ? ` at '${pathArr.join('.')}'` : '';
    // Never echo the raw client value back — reflect only the path + rule.
    throw new Error(`Invalid input${where}: ${first?.message ?? 'schema mismatch'}`);
  }
  return result.data;
}
