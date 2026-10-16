import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  query,
  transact,
  type IdentityRecord,
  type OAuthProvider,
  type PendingAuthRecord,
  type SessionRecord,
  type UserRecord,
} from './store';
import { DEFAULT_PREFERENCES, mergePreferences, type AccountPreferences } from './preferences';
import { servMateProfileFor, type Decision } from './policy';
import { mergeProfile, type CustomerProfile } from './profile';

// Credential primitives live in their own module — see `./passwords` for why.
// Imported for use here and re-exported so callers that reach for an account
// concern find them.
import { hashPassword, normaliseEmail, verifyPassword } from './passwords';
export { hashPassword, normaliseEmail, verifyPassword } from './passwords';

export const SESSION_COOKIE = 'servem_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PENDING_AUTH_TTL_MS = 1000 * 60 * 10;

export type Account = {
  id: string;
  name: string;
  email: string;
};

export function toAccount(user: UserRecord): Account {
  return { id: user.id, name: user.name, email: user.email };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

function buildSession(userId: string): SessionRecord {
  return {
    token: randomBytes(32).toString('hex'),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

function purgeExpired(database: {
  sessions: SessionRecord[];
  pendingAuth: PendingAuthRecord[];
}): void {
  const now = Date.now();
  database.sessions = database.sessions.filter(
    (session) => new Date(session.expiresAt).getTime() > now,
  );
  database.pendingAuth = database.pendingAuth.filter(
    (pending) => new Date(pending.expiresAt).getTime() > now,
  );
}

export type RegisterResult =
  | { ok: true; account: Account; token: string }
  | { ok: false; error: 'email_taken' };

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const email = normaliseEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const user: UserRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  const session = buildSession(user.id);

  return transact((database) => {
    if (database.users.some((existing) => existing.email === email)) {
      return { ok: false as const, error: 'email_taken' as const };
    }
    purgeExpired(database);
    database.users.push(user);
    database.sessions.push(session);
    return { ok: true as const, account: toAccount(user), token: session.token };
  });
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ account: Account; token: string } | null> {
  const normalised = normaliseEmail(email);
  const user = await query(
    (database) => database.users.find((existing) => existing.email === normalised) ?? null,
  );
  if (!user) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  const session = buildSession(user.id);
  await transact((database) => {
    purgeExpired(database);
    database.sessions.push(session);
  });
  return { account: toAccount(user), token: session.token };
}

/**
 * Sign in through a verified OAuth identity.
 *
 * Matching prefers the provider's stable subject, so a changed or relayed email
 * still resolves to the same account. Otherwise a verified email links the new
 * identity onto the existing account rather than creating a duplicate.
 */
export async function signInWithOAuth(input: {
  provider: OAuthProvider;
  subject: string;
  email: string;
  name: string;
}): Promise<{ account: Account; token: string; created: boolean }> {
  const email = normaliseEmail(input.email);
  const token = randomBytes(32).toString('hex');

  return transact((database) => {
    purgeExpired(database);

    let user: UserRecord | undefined = database.users.find((candidate) =>
      (candidate.identities ?? []).some(
        (identity) =>
          identity.provider === input.provider && identity.subject === input.subject,
      ),
    );
    let created = false;

    if (!user) {
      user = database.users.find((candidate) => candidate.email === email);
      if (user) {
        user.identities = [
          ...(user.identities ?? []),
          {
            provider: input.provider,
            subject: input.subject,
            linkedAt: new Date().toISOString(),
          },
        ];
        if (!user.name && input.name) user.name = input.name.trim();
      }
    }

    if (!user) {
      const now = new Date().toISOString();
      user = {
        id: randomUUID(),
        name: input.name.trim() || email.split('@')[0] || 'ServEm member',
        email,
        identities: [
          { provider: input.provider, subject: input.subject, linkedAt: now },
        ],
        createdAt: now,
      };
      database.users.push(user);
      created = true;
    }

    database.sessions.push({
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });
    return { account: toAccount(user), token, created };
  });
}

export async function savePendingAuth(input: {
  state: string;
  provider: OAuthProvider;
  codeVerifier: string;
  nonce: string;
}): Promise<void> {
  await transact((database) => {
    purgeExpired(database);
    database.pendingAuth.push({
      ...input,
      expiresAt: new Date(Date.now() + PENDING_AUTH_TTL_MS).toISOString(),
    });
  });
}

/** Reads and removes a pending authorization. Single use, so a state cannot be replayed. */
export async function consumePendingAuth(state: string): Promise<PendingAuthRecord | null> {
  return transact((database) => {
    purgeExpired(database);
    const index = database.pendingAuth.findIndex((pending) => pending.state === state);
    if (index === -1) return null;
    const [record] = database.pendingAuth.splice(index, 1);
    return record ?? null;
  });
}

export async function endSession(token: string): Promise<void> {
  await transact((database) => {
    database.sessions = database.sessions.filter((session) => session.token !== token);
  });
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * The signed-in account's preferences, folded onto the defaults.
 *
 * Used by the root layout for motion and text size, and by the storefront for
 * its default area and sort, so a preference applies on the first painted frame
 * rather than after a client round trip. Signed out, the defaults apply.
 */
export async function getSessionPreferences(): Promise<AccountPreferences> {
  const token = await getSessionToken();
  if (!token) return DEFAULT_PREFERENCES;

  return query((database) => {
    const session = database.sessions.find((item) => item.token === token);
    if (!session) return DEFAULT_PREFERENCES;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return DEFAULT_PREFERENCES;
    const user = database.users.find((item) => item.id === session.userId);
    return mergePreferences(user?.preferences);
  });
}

export async function getSessionAccount(): Promise<Account | null> {
  const token = await getSessionToken();
  if (!token) return null;

  return query((database) => {
    const session = database.sessions.find((item) => item.token === token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    const user = database.users.find((item) => item.id === session.userId);
    return user ? toAccount(user) : null;
  });
}

/**
 * The signed-in person's own record for the account area.
 *
 * The password hash is never included, and this stays server-side: it is
 * rendered into a page, not returned from an API route.
 */
export type SessionProfile = Account & {
  createdAt: string;
  identities: IdentityRecord[];
  hasPassword: boolean;
  /**
   * Provider capability. One account may be both a customer and a ServMate
   * (blueprint §1), so this is a flag beside the customer profile rather than a
   * separate account type.
   */
  isServMate: boolean;
  /** The ServMate profile id when provider capability is enabled. */
  servmateProfileId?: string;
  /** The customer's own profile, folded onto the defaults. */
  profile: CustomerProfile;
};

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const token = await getSessionToken();
  if (!token) return null;

  return query((database) => {
    const session = database.sessions.find((item) => item.token === token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    const user = database.users.find((item) => item.id === session.userId);
    if (!user) return null;
    const provider = user.isServMate ? servMateProfileFor(database, user.id) : undefined;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      identities: user.identities ?? [],
      hasPassword: Boolean(user.passwordHash),
      isServMate: user.isServMate === true,
      ...(provider ? { servmateProfileId: provider.id } : {}),
      profile: mergeProfile(user.profile),
    };
  });
}

/* ------------------------------------------------------------------ *
 * Server-side authorization guards.
 *
 * Routes and server components call these instead of reading the cookie
 * themselves, so "is anyone signed in" and "is this person a provider" are
 * answered once, in one place, and a failure always arrives as a typed error
 * rather than a silently undefined value.
 * ------------------------------------------------------------------ */

/**
 * A refusal that carries the HTTP status it should become.
 *
 * 404 is used for a resource the caller may not see, so a private job or an
 * unowned booking is indistinguishable from one that does not exist.
 */
export class AuthError extends Error {
  /** The status the refusal becomes. A field rather than a parameter property:
   *  the test suite runs TypeScript in strip-only mode, which cannot parse one. */
  readonly status: 401 | 403 | 404;

  constructor(status: 401 | 403 | 404, message: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/** The signed-in account, or a 401. */
export async function requireSession(): Promise<Account & { token: string }> {
  const token = await getSessionToken();
  if (!token) throw new AuthError(401, 'Sign in to continue.');

  const account = await query((database) => {
    const session = database.sessions.find((item) => item.token === token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;
    const user = database.users.find((item) => item.id === session.userId);
    return user ? { ...toAccount(user), token } : null;
  });

  if (!account) throw new AuthError(401, 'Your session ended. Sign in again.');
  return account;
}

/**
 * The signed-in account plus its provider capability, or a 403.
 *
 * Used by every ServMate-only operation: the feed of available jobs, offer
 * submission, listing management and work progress.
 */
export async function requireServMate(): Promise<
  Account & { token: string; servmateProfileId: string }
> {
  const account = await requireSession();

  const provider = await query((database) => {
    const user = database.users.find((item) => item.id === account.id);
    if (!user?.isServMate) return null;
    return servMateProfileFor(database, account.id) ?? null;
  });

  if (!provider) throw new AuthError(403, 'ServMate capability is not enabled on this account.');
  return { ...account, servmateProfileId: provider.id };
}

/**
 * Asserts that the session account owns the resource.
 * A mismatch is a 404, so the response cannot confirm the resource exists.
 */
export function assertOwner(resourceUserId: string, sessionUserId: string): void {
  if (resourceUserId !== sessionUserId) throw new AuthError(404, 'Not found.');
}

/**
 * Turns a policy decision into a refusal.
 *
 * Every denial becomes the same 404 with the same message, so neither the text
 * nor the status tells a caller which rule stopped them — or whether there was
 * anything there to stop them from reading (blueprint §6.4).
 */
export function assertAllowed<T>(decision: Decision<T>): T {
  if (!decision.allowed) throw new AuthError(404, 'Not found.');
  return decision.value;
}
