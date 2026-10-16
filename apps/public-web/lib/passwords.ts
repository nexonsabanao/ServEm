import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Credential primitives: hashing, verifying, and normalising an address.
 *
 * They live apart from `lib/auth.ts` on purpose. That module reads cookies
 * through `next/headers`, so anything it touches belongs to the request cycle —
 * and the test suite runs outside one. Password hashing has nothing to do with
 * requests, so it gets its own module and can be exercised on its own.
 *
 * scrypt with a per-account salt, constant-time comparison. The format is
 * `scrypt$<salt>$<hex digest>`, which keeps room for a parameter change later
 * without guessing which accounts were hashed how.
 */

const derive = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await derive(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string | undefined,
): Promise<boolean> {
  // Accounts created through an OAuth provider have no password at all.
  if (!stored) return false;
  const [scheme, salt, digest] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  if (expected.length !== KEY_LENGTH) return false;
  const derived = await derive(password, salt, KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}
