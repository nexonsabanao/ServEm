import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AccountPreferences } from './preferences';
import type { CustomerProfile } from './profile';
import { SEED_VERSION, seedDatabase } from './seed';

/**
 * Local development store.
 *
 * This stands in for the backend API described in the production blueprint
 * (NestJS + PostgreSQL). It keeps every entity in a single JSON file so the
 * site can be exercised end to end without that API. It is single-process,
 * single-machine and not a production datastore — see `docs/PROJECT_STATUS.md`.
 *
 * Two properties keep it honest for now:
 *
 * 1. **One writer.** Reads and writes funnel through one promise chain, so a
 *    read-modify-write cycle cannot interleave. That is also what makes
 *    "accept an offer exactly once" atomic here; a SQL deployment gets the same
 *    guarantee from a transaction and a row lock instead.
 * 2. **One schema.** Every collection below is the target logical model from
 *    blueprint §10, so moving to SQL later is a repository swap, not a redesign.
 *    The one deliberate simplification is location: a job carries city,
 *    barangay and access notes as fields instead of joined `locations` rows,
 *    and a ServMate's coverage lives in `servmateServiceAreas`.
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
  /** Public handle, shown as `@name`. Optional; not every account has one. */
  username?: string;
  /** Absent for accounts created purely through an OAuth provider. */
  passwordHash?: string;
  identities?: IdentityRecord[];
  /** Partial on disk: always read through `mergePreferences`. */
  preferences?: Partial<AccountPreferences>;
  /** Partial on disk: always read through `mergeProfile`. */
  profile?: Partial<CustomerProfile>;
  /**
   * Provider capability. Set when the account completes ServMate onboarding;
   * one account may be both a customer and a ServMate (blueprint §1).
   */
  isServMate?: boolean;
  /** Local-development demo account. Never true for a real registration. */
  isDemo?: boolean;
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

/* ---------------------------------------------------------------- *
 * ServMate profile, categories, coverage and listings (§10.2)
 * ---------------------------------------------------------------- */

export type ServMateProfileRecord = {
  id: string;
  userId: string;
  /** Professional bio. */
  bio?: string;
  /** Experience description. */
  experience?: string;
  providerStatus: 'active' | 'paused' | 'suspended';
  /** Self-declared information is never shown as verified (blueprint §5.2). */
  verificationStatus: 'unverified' | 'pending' | 'verified';
  headline?: string;
  /** Home area label, one of the marketplace's coverage areas. */
  serviceAreaLabel?: string;
  /** Stated reply-time target in minutes, shown as "Replies in ~5 min". */
  responseMins?: number;
  /** Demo content seeded for local development only. */
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** A ServMate's eligibility for one structured category. */
export type ServMateCategoryRecord = {
  servmateProfileId: string;
  categoryId: string;
  status: 'active' | 'revoked';
  createdAt: string;
};

/** A ServMate's coverage area (§10.4). */
export type ServMateServiceAreaRecord = {
  servmateProfileId: string;
  /** City/municipality label, from the marketplace's coverage list. */
  areaLabel: string;
  createdAt: string;
};

/** A ServMate's category coverage with its display fields. */
export type ServiceListingRecord = {
  id: string;
  servmateProfileId: string;
  categoryId: string;
  title: string;
  description: string;
  pricingModel: 'fixed' | 'quote';
  /** Integer centavos. Absent for a quote-only listing. */
  amountCentavos?: number;
  currency: 'PHP';
  publicationStatus: 'draft' | 'published' | 'unpublished';
  /** The area this listing is offered in. */
  serviceAreaLabel?: string;
  /** Human-readable availability, e.g. `Same day`. */
  availability?: string;
  terms?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

/* ---------------------------------------------------------------- *
 * Job posts and their media (§10.3)
 * ---------------------------------------------------------------- */

export type JobStatus =
  | 'draft'
  | 'open'
  | 'offer_received'
  | 'booked'
  | 'in_progress'
  | 'completion_pending'
  | 'completed'
  | 'cancelled'
  | 'expired';

/**
 * A customer's private request for a task.
 *
 * `budgetCentavos` is what the customer is willing to spend, which is *not* the
 * agreed price — the offer carries that, and the booking snapshots it
 * (blueprint §5.6, §9). `locationBarangay` and `locationNotes` are precise job
 * data: they must never appear in a discovery response (§7.2).
 */
export type JobPostRecord = {
  id: string;
  customerId: string;
  categoryId: string;
  subcategoryId?: string;
  title: string;
  description: string;
  jobStatus: JobStatus;
  pricingModel: 'fixed' | 'negotiable';
  budgetCentavos: number;
  budgetMaxCentavos?: number;
  currency: 'PHP';
  locationCity: string;
  locationBarangay?: string;
  /** Access instructions — authorized parties only. */
  locationNotes?: string;
  preferredStart?: string;
  preferredEnd?: string;
  scheduleFlexible: boolean;
  publishedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
};

export type JobPostMediaRecord = {
  id: string;
  jobPostId: string;
  mediaAssetId: string;
  caption?: string;
  displayOrder: number;
  createdAt: string;
};

/* ---------------------------------------------------------------- *
 * Offers and counteroffers (§10.5)
 * ---------------------------------------------------------------- */

export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired'
  /** The job's category changed, so this offer's eligibility is void. */
  | 'category_changed';

export type JobOfferRecord = {
  id: string;
  jobPostId: string;
  servmateProfileId: string;
  amountCentavos: number;
  currency: 'PHP';
  proposedStart?: string;
  scopeDescription?: string;
  exclusions?: string;
  message?: string;
  offerStatus: OfferStatus;
  /** Revision number; a counteroffer is a new revision, not an overwrite. */
  revision: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

/* ---------------------------------------------------------------- *
 * Bookings (§10.6)
 * ---------------------------------------------------------------- */

export type BookingStatus =
  /** Legacy service-level request, predating job posts. Still readable. */
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completion_pending'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type BookingRecord = {
  id: string;
  reference: string;
  /** The customer. */
  userId: string;
  /** Legacy service-level booking. */
  serviceId?: string;
  serviceTitle?: string;
  /** Job-offer-based booking. */
  jobPostId?: string;
  acceptedOfferId?: string;
  servmateProfileId?: string;
  area?: string;
  message: string;
  status: BookingStatus;
  /** Immutable snapshot of the agreed commercial terms (§10.6). */
  agreedAmountCentavos?: number;
  agreedCurrency?: 'PHP';
  agreedScope?: string;
  agreedStart?: string;
  createdAt: string;
  confirmedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
};

export type BookingStatusHistoryRecord = {
  id: string;
  bookingId: string;
  oldStatus: string;
  newStatus: string;
  actorUserId: string;
  reason?: string;
  createdAt: string;
};

/* ---------------------------------------------------------------- *
 * Conversations and messages (§10.7)
 * ---------------------------------------------------------------- */

export type ConversationRecord = {
  id: string;
  conversationType: 'job_inquiry' | 'offer' | 'booking' | 'direct';
  jobPostId?: string;
  offerId?: string;
  bookingId?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
};

export type ConversationParticipantRecord = {
  conversationId: string;
  userId: string;
  joinedAt: string;
  /** Drives the unread count without a second pass over the messages. */
  lastReadAt?: string;
  muted?: boolean;
};

export type MessageRecord = {
  id: string;
  /** Every message belongs to a conversation; legacy rows use the booking id. */
  conversationId?: string;
  /** Retained for the service-level request threads. */
  bookingId?: string;
  senderUserId: string;
  senderRole: 'customer' | 'servmate';
  body: string;
  createdAt: string;
};

/* ---------------------------------------------------------------- *
 * Media assets (§10.8)
 * ---------------------------------------------------------------- */

/**
 * Media metadata only. File bytes belong in private object storage with
 * authorization-controlled delivery; that is not connected yet, so a record
 * here is a reference with a visibility class, not a fetchable URL.
 */
export type MediaAssetRecord = {
  id: string;
  ownerUserId: string;
  /** Storage key in the object store — never a public URL. */
  storageKey: string;
  mediaType: 'image' | 'video';
  mimeType: string;
  fileSizeBytes: number;
  /** Processing state of the (not yet connected) pipeline. */
  processingStatus: 'pending' | 'ready' | 'failed';
  /**
   * Who may fetch it. `job_private` is readable only by the job owner and
   * authorized eligible ServMates (§6.4).
   */
  visibility: 'public_profile' | 'job_private' | 'message_private';
  jobPostId?: string;
  createdAt: string;
  deletedAt?: string;
};

/* ---------------------------------------------------------------- *
 * Reviews (§10.9)
 * ---------------------------------------------------------------- */

export type ReviewRecord = {
  id: string;
  bookingId: string;
  reviewerUserId: string;
  servmateProfileId: string;
  rating: number;
  comment?: string;
  publicationStatus: 'pending' | 'published' | 'removed';
  isDemo?: boolean;
  createdAt: string;
};

/* ---------------------------------------------------------------- *
 * Notifications (§10.10)
 * ---------------------------------------------------------------- */

export type NotificationRecord = {
  id: string;
  recipientUserId: string;
  notificationType: string;
  entityType?: 'job' | 'offer' | 'booking' | 'conversation';
  entityId?: string;
  readAt?: string;
  createdAt: string;
};

/* ---------------------------------------------------------------- *
 * Blocks and reports (§10.11)
 * ---------------------------------------------------------------- */

export type UserBlockRecord = {
  blockerUserId: string;
  blockedUserId: string;
  createdAt: string;
};

export type UserReportRecord = {
  id: string;
  reporterUserId: string;
  /** Exactly one of these is set. */
  reportedUserId?: string;
  reportedJobId?: string;
  reportedMessageId?: string;
  reasonCode: 'spam' | 'harassment' | 'misrepresentation' | 'unsafe' | 'other';
  description?: string;
  reportStatus: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
};

/* ---------------------------------------------------------------- *
 * Database
 * ---------------------------------------------------------------- */

export type Database = {
  /**
   * Which seed revision this file was created from. A file that predates the
   * current revision is topped up on the next read; demo rows are only added,
   * never rewritten, so real local changes survive.
   */
  seedVersion?: number;
  users: UserRecord[];
  sessions: SessionRecord[];
  servmateProfiles: ServMateProfileRecord[];
  servmateCategories: ServMateCategoryRecord[];
  servmateServiceAreas: ServMateServiceAreaRecord[];
  serviceListings: ServiceListingRecord[];
  jobPosts: JobPostRecord[];
  jobPostMedia: JobPostMediaRecord[];
  jobOffers: JobOfferRecord[];
  bookings: BookingRecord[];
  bookingStatusHistory: BookingStatusHistoryRecord[];
  conversations: ConversationRecord[];
  conversationParticipants: ConversationParticipantRecord[];
  messages: MessageRecord[];
  mediaAssets: MediaAssetRecord[];
  reviews: ReviewRecord[];
  notifications: NotificationRecord[];
  userBlocks: UserBlockRecord[];
  userReports: UserReportRecord[];
  pendingAuth: PendingAuthRecord[];
};

/**
 * Where the store lives.
 *
 * `SERVEM_DATA_DIR` lets the test suite point at a scratch directory instead of
 * writing into the development file — a test must never mutate the data a
 * running site is serving.
 */
function dataDir(): string {
  const override = process.env.SERVEM_DATA_DIR;
  return override ? path.resolve(override) : path.join(process.cwd(), '.data');
}

export function emptyDatabase(): Database {
  return {
    users: [],
    sessions: [],
    servmateProfiles: [],
    servmateCategories: [],
    servmateServiceAreas: [],
    serviceListings: [],
    jobPosts: [],
    jobPostMedia: [],
    jobOffers: [],
    bookings: [],
    bookingStatusHistory: [],
    conversations: [],
    conversationParticipants: [],
    messages: [],
    mediaAssets: [],
    reviews: [],
    notifications: [],
    userBlocks: [],
    userReports: [],
    pendingAuth: [],
  };
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

/** Reads a collection, defaulting when the file predates the collection. */
function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function readDatabase(): Promise<Database> {
  let stored: Database;
  try {
    const raw = await readFile(path.join(dataDir(), 'servem.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return ensureSeeded(emptyDatabase());
    stored = {
      ...(typeof parsed.seedVersion === 'number' ? { seedVersion: parsed.seedVersion } : {}),
      users: rows<UserRecord>(parsed.users),
      sessions: rows<SessionRecord>(parsed.sessions),
      servmateProfiles: rows<ServMateProfileRecord>(parsed.servmateProfiles),
      servmateCategories: rows<ServMateCategoryRecord>(parsed.servmateCategories),
      servmateServiceAreas: rows<ServMateServiceAreaRecord>(parsed.servmateServiceAreas),
      serviceListings: rows<ServiceListingRecord>(parsed.serviceListings),
      jobPosts: rows<JobPostRecord>(parsed.jobPosts),
      jobPostMedia: rows<JobPostMediaRecord>(parsed.jobPostMedia),
      jobOffers: rows<JobOfferRecord>(parsed.jobOffers),
      bookings: rows<BookingRecord>(parsed.bookings),
      bookingStatusHistory: rows<BookingStatusHistoryRecord>(parsed.bookingStatusHistory),
      conversations: rows<ConversationRecord>(parsed.conversations),
      conversationParticipants: rows<ConversationParticipantRecord>(
        parsed.conversationParticipants,
      ),
      messages: rows<MessageRecord>(parsed.messages),
      mediaAssets: rows<MediaAssetRecord>(parsed.mediaAssets),
      reviews: rows<ReviewRecord>(parsed.reviews),
      notifications: rows<NotificationRecord>(parsed.notifications),
      userBlocks: rows<UserBlockRecord>(parsed.userBlocks),
      userReports: rows<UserReportRecord>(parsed.userReports),
      pendingAuth: rows<PendingAuthRecord>(parsed.pendingAuth),
    };
  } catch {
    stored = emptyDatabase();
  }
  return ensureSeeded(stored);
}

/**
 * The local-development seed hook.
 *
 * Demo ServMates, categories, listings and reviews are *records*, not a
 * hardcoded render-time array, so the pages that show them and the rules that
 * match jobs to them read the same rows. Seeding is idempotent and only ever
 * adds: a file already at the current revision is returned untouched.
 */
function ensureSeeded(database: Database): Database {
  if (database.seedVersion === SEED_VERSION) return database;
  if (!seedingEnabled()) return database;
  return seedDatabase(database);
}

/**
 * Whether demo content may be written.
 *
 * Off in production, so a deployed build never presents sample ServMates as if
 * they were real listings — the same rule `./catalog` applies to the public
 * catalog. Tests and local development seed; `SERVEM_SEED=0` disables it and
 * `SERVEM_SEED=1` forces it on.
 */
function seedingEnabled(): boolean {
  const setting = process.env.SERVEM_SEED;
  if (setting === '0') return false;
  if (setting === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

async function writeDatabase(database: Database): Promise<void> {
  const directory = dataDir();
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'servem.json');
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

/** Run a read-only query against a snapshot of the database. */
export function query<T>(work: (database: Database) => T): Promise<T> {
  return enqueue(async () => work(await readDatabase()));
}

/**
 * Run a read-modify-write cycle and persist the result atomically.
 *
 * Throwing inside `work` aborts the write, which is how a rejected transition
 * or a failed eligibility check leaves the store untouched.
 */
export function transact<T>(work: (database: Database) => T): Promise<T> {
  return enqueue(async () => {
    const database = await readDatabase();
    const result = work(database);
    await writeDatabase(database);
    return result;
  });
}

/** Writes a whole snapshot. Used by the test harness to install fixtures. */
export function replaceDatabase(database: Database): Promise<void> {
  return enqueue(() => writeDatabase(database));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
