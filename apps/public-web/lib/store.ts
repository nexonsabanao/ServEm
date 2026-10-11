import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AccountPreferences } from './preferences';
import type { CustomerProfile } from './profile';

/**
 * Local development store.
 *
 * This stands in for the backend API described in the production blueprint
 * (NestJS + PostgreSQL). It keeps accounts, sessions and booking requests in a
 * single JSON file so the public site can be exercised end to end without that
 * API. It is single-process, single-machine and not a production datastore.
 */

export type OAuthProvider = 'google' | 'apple';

export type IdentityRecord = {
  provider: OAuthProvider;
  /** The provider's stable subject claim for this account. */
  subject: string;
  linkedAt: string;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  /** Absent for accounts created purely through an OAuth provider. */
  passwordHash?: string;
  identities?: IdentityRecord[];
  /** Partial on disk: always read through `mergePreferences`. */
  preferences?: Partial<AccountPreferences>;
  /** Partial on disk: always read through `mergeProfile`. */
  profile?: Partial<CustomerProfile>;
  createdAt: string;
};

/** Short-lived state carried between an OAuth redirect and its callback. */
export type PendingAuthRecord = {
  state: string;
  provider: OAuthProvider;
  codeVerifier: string;
  nonce: string;
  expiresAt: string;
};

export type SessionRecord = {
  token: string;
  userId: string;
  expiresAt: string;
};

export type BookingStatus = 'requested' | 'cancelled';

export type BookingRecord = {
  id: string;
  reference: string;
  userId: string;
  serviceId: string;
  serviceTitle: string;
  area?: string;
  message: string;
  status: BookingStatus;
  createdAt: string;
  cancelledAt?: string;
};

export type MessageRecord = {
  id: string;
  bookingId: string;
  senderUserId: string;
  senderRole: 'customer';
  body: string;
  createdAt: string;
};

export type Database = {
  users: UserRecord[];
  sessions: SessionRecord[];
  bookings: BookingRecord[];
  messages: MessageRecord[];
  pendingAuth: PendingAuthRecord[];
};

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'servem.json');

function emptyDatabase(): Database {
  return { users: [], sessions: [], bookings: [], messages: [], pendingAuth: [] };
}

/**
 * Reads and writes are funnelled through one promise chain so concurrent
 * requests cannot interleave a read-modify-write cycle on the same file.
 */
let tail: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = tail.then(work, work);
  tail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function readDatabase(): Promise<Database> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return emptyDatabase();
    // Files written by earlier revisions may not have messages or pendingAuth.
    return {
      users: Array.isArray(parsed.users) ? (parsed.users as UserRecord[]) : [],
      sessions: Array.isArray(parsed.sessions) ? (parsed.sessions as SessionRecord[]) : [],
      bookings: Array.isArray(parsed.bookings) ? (parsed.bookings as BookingRecord[]) : [],
      messages: Array.isArray(parsed.messages) ? (parsed.messages as MessageRecord[]) : [],
      pendingAuth: Array.isArray(parsed.pendingAuth)
        ? (parsed.pendingAuth as PendingAuthRecord[])
        : [],
    };
  } catch {
    return emptyDatabase();
  }
}

async function writeDatabase(database: Database): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = `${DATA_FILE}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  await rename(temporary, DATA_FILE);
}

/** Run a read-only query against a snapshot of the database. */
export function query<T>(work: (database: Database) => T): Promise<T> {
  return enqueue(async () => work(await readDatabase()));
}

/** Run a read-modify-write cycle and persist the result atomically. */
export function transact<T>(work: (database: Database) => T): Promise<T> {
  return enqueue(async () => {
    const database = await readDatabase();
    const result = work(database);
    await writeDatabase(database);
    return result;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
