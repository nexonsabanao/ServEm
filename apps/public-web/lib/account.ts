import { bookingTitle } from './bookings';
import { mergePreferences, type AccountPreferences } from './preferences';
import { hashPassword, verifyPassword } from './passwords';
import { mergeProfile, type CustomerProfile, type ProfilePatch } from './profile';
import { query, transact } from './store';

/**
 * Account settings operations over the local development store.
 *
 * Every function takes the `userId` resolved from the session cookie, never
 * from the request body, so one account can only ever read or change its own
 * record. Reads that reach the browser are shaped here — the password hash and
 * the provider subjects never leave this module.
 */

export async function getPreferences(userId: string): Promise<AccountPreferences> {
  const stored = await query(
    (database) => database.users.find((user) => user.id === userId)?.preferences,
  );
  return mergePreferences(stored);
}

export async function updatePreferences(
  userId: string,
  patch: Partial<AccountPreferences>,
): Promise<AccountPreferences | null> {
  return transact((database) => {
    const user = database.users.find((candidate) => candidate.id === userId);
    if (!user) return null;
    user.preferences = { ...mergePreferences(user.preferences), ...patch };
    return mergePreferences(user.preferences);
  });
}

export async function getProfile(userId: string): Promise<CustomerProfile> {
  const stored = await query(
    (database) => database.users.find((user) => user.id === userId)?.profile,
  );
  return mergeProfile(stored);
}

/**
 * Applies a profile patch onto the stored record.
 *
 * The patch is folded onto the current profile rather than replacing it, so a
 * client that sends one field cannot blank the rest.
 */
export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<CustomerProfile | null> {
  return transact((database) => {
    const user = database.users.find((candidate) => candidate.id === userId);
    if (!user) return null;
    user.profile = { ...mergeProfile(user.profile), ...patch };
    return mergeProfile(user.profile);
  });
}

export type AccountNameChange =
  | { ok: true; name: string }
  | { ok: false; error: 'not_found' };

export async function updateAccountName(userId: string, name: string): Promise<AccountNameChange> {
  return transact((database) => {
    const user = database.users.find((candidate) => candidate.id === userId);
    if (!user) return { ok: false as const, error: 'not_found' as const };
    user.name = name.trim();
    return { ok: true as const, name: user.name };
  });
}

export type PasswordChange =
  | { ok: true }
  /** The account signs in through an OAuth provider and has no password yet. */
  | { ok: false; error: 'no_password' }
  | { ok: false; error: 'wrong_current' }
  | { ok: false; error: 'not_found' };

/**
 * Changes a password.
 *
 * The current password is required and verified, so a stolen session cookie
 * alone cannot lock the owner out. A successful change rotates the stored hash
 * with a fresh salt; the caller revokes the account's other sessions.
 */
export async function changePassword(
  userId: string,
  current: string,
  next: string,
): Promise<PasswordChange> {
  const user = await query((database) => database.users.find((candidate) => candidate.id === userId));
  if (!user) return { ok: false, error: 'not_found' };
  if (!user.passwordHash) return { ok: false, error: 'no_password' };

  const matches = await verifyPassword(current, user.passwordHash);
  if (!matches) return { ok: false, error: 'wrong_current' };

  const passwordHash = await hashPassword(next);
  const saved = await transact((database) => {
    const record = database.users.find((candidate) => candidate.id === userId);
    if (!record) return false;
    record.passwordHash = passwordHash;
    return true;
  });

  return saved ? { ok: true } : { ok: false, error: 'not_found' };
}

/** Ends every session for the account except the one making the request. */
export async function revokeOtherSessions(userId: string, keepToken: string): Promise<number> {
  return transact((database) => {
    const before = database.sessions.length;
    database.sessions = database.sessions.filter(
      (session) => session.userId !== userId || session.token === keepToken,
    );
    return before - database.sessions.length;
  });
}

export type ExportedAccount = {
  exportedAt: string;
  account: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    preferences: AccountPreferences;
    signInMethods: { provider: string; linkedAt: string }[];
  };
  requests: {
    reference: string;
    serviceTitle: string;
    area?: string;
    message: string;
    status: string;
    createdAt: string;
    cancelledAt?: string;
  }[];
  messages: {
    reference: string;
    body: string;
    createdAt: string;
  }[];
};

/**
 * Everything the account owns, in one object.
 *
 * The password hash and the OAuth subject claims are deliberately excluded: an
 * export should carry the person's data, not our credential material.
 */
export async function exportAccountData(userId: string): Promise<ExportedAccount | null> {
  return query((database) => {
    const user = database.users.find((candidate) => candidate.id === userId);
    if (!user) return null;

    const bookings = database.bookings
      .filter((booking) => booking.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const referenceById = new Map(bookings.map((booking) => [booking.id, booking.reference]));

    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        preferences: mergePreferences(user.preferences),
        signInMethods: (user.identities ?? []).map((identity) => ({
          provider: identity.provider,
          linkedAt: identity.linkedAt,
        })),
      },
      requests: bookings.map((booking) => ({
        reference: booking.reference,
        serviceTitle: bookingTitle(database, booking),
        ...(booking.area ? { area: booking.area } : {}),
        message: booking.message,
        status: booking.status,
        createdAt: booking.createdAt,
        ...(booking.cancelledAt ? { cancelledAt: booking.cancelledAt } : {}),
      })),
      messages: database.messages
        .filter((message) => Boolean(message.bookingId && referenceById.has(message.bookingId)))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((message) => ({
          reference: (message.bookingId && referenceById.get(message.bookingId)) || '',
          body: message.body,
          createdAt: message.createdAt,
        })),
    };
  });
}
