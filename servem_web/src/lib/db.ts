import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { formatDistanceKm } from './localization';
import type {
  Booking,
  Message,
  Notification,
  Profile,
  Review,
  SavedPlace,
  Service,
  ServMate,
  Thread,
} from './types';

/**
 * All Firestore access lives here.
 *
 * There is no fallback data: every function either resolves with real documents
 * or rejects with an error the caller surfaces. User-owned state is read through
 * live subscriptions so writes appear without optimistic local mutation, and
 * `firestore.rules` re-checks ownership, money and status on every write.
 */

function requireDb(): NonNullable<typeof db> {
  if (!db) {
    throw Object.assign(new Error('ServEm cannot reach Firestore right now. Check your connection and try again.'), {
      code: 'servem/firestore-unavailable',
    });
  }
  return db;
}

/** Firestore returns Timestamp objects; screens and sorting expect strings. */
function asIsoString(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const stamp = value as { toDate?: () => Date };
  if (typeof stamp.toDate === 'function') {
    try {
      return stamp.toDate().toISOString();
    } catch {
      return '';
    }
  }
  return value;
}

function mapDoc<T>(snap: { id: string; data: () => DocumentData }): T {
  const data = snap.data() as Record<string, unknown>;
  const normalised: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) normalised[key] = asIsoString(value);
  return { ...normalised, id: snap.id } as T;
}

function queryByUid(store: ReturnType<typeof requireDb>, name: string, field: string, uid: string) {
  return query(collection(store, name), where(field, '==', uid), limit(100));
}

function sortNewestFirst<T>(rows: T[], key: (row: T) => string): T[] {
  return [...rows].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === right) return 0;
    return left < right ? 1 : -1;
  });
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

/* ------------------------------------------------------------------ profile */

export async function pushProfile(uid: string, profile: Profile): Promise<void> {
  const store = requireDb();
  const { id: _id, ...rest } = profile;
  await setDoc(doc(store, 'profiles', uid), rest, { merge: true });
}

export interface ProfileSnapshot {
  profile: Profile | null;
  favorites: string[];
}

function favoriteIds(data: DocumentData | undefined): string[] {
  const raw = data?.['favorites'];
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

export async function fetchProfileSnapshot(uid: string): Promise<ProfileSnapshot> {
  const store = requireDb();
  const snap = await getDoc(doc(store, 'profiles', uid));
  if (!snap.exists()) return { profile: null, favorites: [] };
  const data = snap.data();
  return { profile: { id: uid, ...(data as Omit<Profile, 'id'>) }, favorites: favoriteIds(data) };
}

/** The profile is created on first sign-in; this fills any gaps. */
export async function ensureProfile(uid: string, seed: Omit<Profile, 'id'>): Promise<Profile> {
  const store = requireDb();
  const existing = await fetchProfileSnapshot(uid);
  if (existing.profile) return existing.profile;
  await setDoc(doc(store, 'profiles', uid), seed, { merge: true });
  return { id: uid, ...seed };
}

export function subscribeProfile(
  uid: string,
  next: (snapshot: ProfileSnapshot) => void,
  fail: (error: Error) => void,
): () => void {
  const store = requireDb();
  return onSnapshot(
    doc(store, 'profiles', uid),
    (snap) => {
      if (!snap.exists()) {
        next({ profile: null, favorites: [] });
        return;
      }
      const data = snap.data();
      next({
        profile: { id: uid, ...(data as Omit<Profile, 'id'>) },
        favorites: favoriteIds(data),
      });
    },
    fail,
  );
}

export async function fetchFavorites(uid: string): Promise<string[]> {
  return (await fetchProfileSnapshot(uid)).favorites;
}

export async function addFavorite(uid: string, serviceId: string): Promise<void> {
  const store = requireDb();
  await setDoc(doc(store, 'profiles', uid), { favorites: arrayUnion(serviceId) }, { merge: true });
}

export async function removeFavorite(uid: string, serviceId: string): Promise<void> {
  const store = requireDb();
  await setDoc(doc(store, 'profiles', uid), { favorites: arrayRemove(serviceId) }, { merge: true });
}

/* ----------------------------------------------------------------- bookings */

export async function fetchBookings(uid: string): Promise<Booking[]> {
  const store = requireDb();
  const snap = await getDocs(queryByUid(store, 'bookings', 'customerId', uid));
  return sortNewestFirst(snap.docs.map((row) => mapDoc<Booking>(row)), (row) => row.createdAt);
}

export function subscribeBookings(
  uid: string,
  next: (rows: Booking[]) => void,
  fail: (error: Error) => void,
): () => void {
  const store = requireDb();
  return onSnapshot(
    queryByUid(store, 'bookings', 'customerId', uid),
    (snap) => next(sortNewestFirst(snap.docs.map((row) => mapDoc<Booking>(row)), (row) => row.createdAt)),
    fail,
  );
}

/** Bookings where the signed-in user is the ServMate. */
export async function fetchProviderBookings(uid: string): Promise<Booking[]> {
  const store = requireDb();
  const snap = await getDocs(queryByUid(store, 'bookings', 'providerId', uid));
  return sortNewestFirst(snap.docs.map((row) => mapDoc<Booking>(row)), (row) => row.createdAt);
}

export function subscribeProviderBookings(
  uid: string,
  next: (rows: Booking[]) => void,
  fail: (error: Error) => void,
): () => void {
  const store = requireDb();
  return onSnapshot(
    queryByUid(store, 'bookings', 'providerId', uid),
    (snap) => next(sortNewestFirst(snap.docs.map((row) => mapDoc<Booking>(row)), (row) => row.createdAt)),
    fail,
  );
}

export async function patchBooking(id: string, patch: Partial<Booking>): Promise<void> {
  const store = requireDb();
  await updateDoc(doc(store, 'bookings', id), patch);
}

/* ------------------------------------------------------------------ threads */

async function loadThreads(uid: string): Promise<Thread[]> {
  const store = requireDb();
  const snap = await getDocs(
    query(collection(store, 'threads'), where('members', 'array-contains', uid), limit(50)),
  );
  return Promise.all(
    snap.docs.map(async (row) => {
      const data = row.data();
      const members: string[] = Array.isArray(data['members']) ? data['members'] : [];
      const otherId = members.find((member) => member !== uid) ?? '';
      const bookingId = str(data['bookingId']);
      const [messages, bookingSnap] = await Promise.all([
        getDocs(query(collection(store, 'threads', row.id, 'messages'), limit(200))),
        bookingId ? getDoc(doc(store, 'bookings', bookingId)) : Promise.resolve(null),
      ]);
      const bookingData = bookingSnap && bookingSnap.exists() ? bookingSnap.data() : null;
      const isProvider = str(bookingData?.['providerId']) === otherId || otherId === str(data['providerId']);
      const name = isProvider
        ? str(data['providerName']) || str(bookingData?.['provider'])
        : str(data['customerName']) || str(bookingData?.['customer']);
      const thread: Thread = {
        id: row.id,
        name: name || str(data['service'], str(bookingData?.['service'], 'Conversation')),
        photo: '',
        role: isProvider ? 'Your ServMate' : 'Customer',
        updated: str(data['lastMessage']),
        unread: 0,
        messages: messages.docs.map((message) => {
          const line = message.data();
          return {
            id: message.id,
            from: str(line['senderId']) === uid ? 'me' : 'them',
            text: str(line['text']),
            time: str(line['time']),
          } as Message;
        }),
      };
      return thread;
    }),
  );
}

export async function fetchThreads(uid: string): Promise<Thread[]> {
  return loadThreads(uid);
}

export function subscribeThreads(
  uid: string,
  next: (rows: Thread[]) => void,
  fail: (error: Error) => void,
): () => void {
  const store = requireDb();
  return onSnapshot(
    query(collection(store, 'threads'), where('members', 'array-contains', uid), limit(50)),
    () => {
      void loadThreads(uid).then(next).catch(fail);
    },
    fail,
  );
}

/** Appends a chat line for the signed-in sender. */
export async function pushMessage(threadId: string, message: Message): Promise<void> {
  const store = requireDb();
  const senderId = auth?.currentUser?.uid;
  if (!senderId) throw new Error('Your session expired. Please sign in again.');
  await setDoc(doc(collection(store, 'threads', threadId, 'messages')), {
    senderId,
    text: message.text,
    time: message.time,
    createdAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------- places */

export async function fetchPlaces(uid: string): Promise<SavedPlace[]> {
  const store = requireDb();
  const snap = await getDocs(query(collection(store, 'profiles', uid, 'places'), limit(50)));
  return snap.docs.map((row) => mapDoc<SavedPlace>(row));
}

export function subscribePlaces(
  uid: string,
  next: (rows: SavedPlace[]) => void,
  fail: (error: Error) => void,
): () => void {
  const store = requireDb();
  return onSnapshot(
    query(collection(store, 'profiles', uid, 'places'), limit(50)),
    (snap) => next(snap.docs.map((row) => mapDoc<SavedPlace>(row))),
    fail,
  );
}

export async function putPlace(uid: string, place: SavedPlace): Promise<void> {
  const store = requireDb();
  await setDoc(doc(store, 'profiles', uid, 'places', place.id), place, { merge: true });
}

export async function deletePlace(uid: string, placeId: string): Promise<void> {
  const store = requireDb();
  await deleteDoc(doc(store, 'profiles', uid, 'places', placeId));
}

/* ------------------------------------------------------------ notifications */

export async function fetchNotifications(uid: string): Promise<Notification[]> {
  const store = requireDb();
  const snap = await getDocs(queryByUid(store, 'notifications', 'uid', uid));
  return sortNewestFirst(snap.docs.map((row) => mapDoc<Notification>(row)), (row) => row.time);
}

export function subscribeNotifications(
  uid: string,
  next: (rows: Notification[]) => void,
  fail: (error: Error) => void,
): () => void {
  const store = requireDb();
  return onSnapshot(
    queryByUid(store, 'notifications', 'uid', uid),
    (snap) => next(sortNewestFirst(snap.docs.map((row) => mapDoc<Notification>(row)), (row) => row.time)),
    fail,
  );
}

export async function markAllRead(uid: string): Promise<void> {
  const store = requireDb();
  const snap = await getDocs(
    query(collection(store, 'notifications'), where('uid', '==', uid), where('read', '==', false)),
  );
  await Promise.all(snap.docs.map((row) => updateDoc(row.ref, { read: true })));
}

/* ---------------------------------------------------------------- catalogue */

function toService(id: string, data: DocumentData): Service {
  return {
    id,
    name: str(data['title'], str(data['name'], 'Service')),
    category: str(data['category'], 'Other services'),
    providerId: str(data['providerId']),
    provider: str(data['providerName'], str(data['provider'])),
    rate: num(data['rate'], num(data['price'])),
    minHours: num(data['minHours'], 1),
    rating: num(data['rating']),
    reviews: num(data['reviews'], num(data['reviewCount'])),
    distance: num(data['distanceKm']) > 0 ? formatDistanceKm(num(data['distanceKm'])) : '',
    image: str(data['asset'], str(data['image'])),
    blurb: str(data['blurb']),
    description: str(data['description']),
    tags: Array.isArray(data['tags']) ? (data['tags'] as string[]) : [],
    availability: str(data['availability']),
    status: (data['status'] as Service['status']) ?? 'live',
    area: str(data['area']),
  };
}

function toServMate(id: string, data: DocumentData): ServMate {
  return {
    id,
    uid: str(data['uid']),
    name: str(data['name'], 'ServMate'),
    photo: str(data['photo']),
    rating: num(data['rating']),
    reviews: num(data['reviews']),
    jobs: num(data['jobs']),
    rate: num(data['rate']),
    distance: num(data['distanceKm']) > 0 ? formatDistanceKm(num(data['distanceKm'])) : '',
    area: str(data['area']),
    skills: Array.isArray(data['skills']) ? (data['skills'] as string[]) : [],
    availability: str(data['availability']),
    verified: data['verified'] === true,
    bio: str(data['bio']),
    responseTime: str(data['responseTime']),
    repeat: num(data['repeat']),
    cover: str(data['cover'], str(data['asset'])),
    status: (data['status'] as ServMate['status']) ?? 'active',
  };
}

export function subscribeServices(next: (rows: Service[]) => void, fail: (error: Error) => void): () => void {
  const store = requireDb();
  return onSnapshot(
    query(collection(store, 'services'), where('status', '==', 'live'), limit(60)),
    (snap) => next(snap.docs.map((row) => toService(row.id, row.data()))),
    fail,
  );
}

export function subscribeServMates(next: (rows: ServMate[]) => void, fail: (error: Error) => void): () => void {
  const store = requireDb();
  return onSnapshot(
    query(collection(store, 'servmates'), where('status', '==', 'active'), limit(60)),
    (snap) => next(snap.docs.map((row) => toServMate(row.id, row.data()))),
    fail,
  );
}

export function subscribeReviews(next: (rows: Review[]) => void, fail: (error: Error) => void): () => void {
  const store = requireDb();
  return onSnapshot(
    query(collection(store, 'reviews'), where('status', '==', 'published'), limit(40)),
    (snap) =>
      next(
        snap.docs.map((row) => {
          const data = row.data();
          return {
            id: row.id,
            author: str(data['author'], 'ServEm customer'),
            photo: str(data['photo']),
            rating: num(data['rating']),
            text: str(data['text'], str(data['body'])),
            date: str(data['date']).slice(0, 10),
            service: str(data['service'], str(data['serviceTitle'])),
            target: str(data['servmateId']),
          } as Review;
        }),
      ),
    fail,
  );
}

/* -------------------------------------------------------------------- admin */

const ADMIN_COLLECTIONS: Record<string, string> = {
  customers: 'profiles',
  servmates: 'servmates',
  services: 'services',
  bookings: 'bookings',
  payments: 'payments',
  payouts: 'withdrawals',
  disputes: 'disputes',
  tickets: 'tickets',
  reviews: 'reviews',
  verifications: 'verificationRequests',
  verificationRequests: 'verificationRequests',
  audit: 'audit',
  campaigns: 'campaigns',
  team: 'team',
};

export async function fetchAdminCollection<T>(name: string): Promise<T[]> {
  const store = requireDb();
  const collectionName = ADMIN_COLLECTIONS[name] ?? name;
  const snap = await getDocs(query(collection(store, collectionName), limit(200)));
  const rows = snap.docs.map((row) => mapDoc<Record<string, unknown>>(row));

  // The queues store identifiers and timestamps; the tables show names and
  // dates, so resolve them here rather than rendering blank cells.
  if (collectionName === 'verificationRequests') {
    const uids = [...new Set(rows.map((row) => String(row['uid'] ?? '')).filter(Boolean))];
    const names = new Map<string, string>();
    // `in` queries cap at 30 values, so batch instead of one read per row.
    for (let start = 0; start < uids.length; start += 30) {
      const batch = uids.slice(start, start + 30);
      const profiles = await getDocs(
        query(collection(store, 'profiles'), where(documentId(), 'in', batch)),
      );
      for (const profile of profiles.docs) {
        names.set(profile.id, String(profile.data()?.['name'] ?? ''));
      }
    }
    for (const row of rows) {
      const paths = row['documentPaths'];
      row['name'] = names.get(String(row['uid'] ?? '')) || 'ServMate';
      row['submitted'] = String(row['createdAt'] ?? '').slice(0, 10);
      row['docs'] = Array.isArray(paths) ? paths.length : 0;
    }
  }

  if (name === 'customers') {
    // The profile document owns one flag: suspended or not.
    for (const row of rows) row['status'] = row['status'] === 'suspended' ? 'suspended' : 'active';
  }

  if (collectionName === 'withdrawals') {
    for (const row of rows) {
      row['provider'] = str(row['provider'], 'ServMate');
      row['method'] = str(row['method'], 'gcash');
      row['date'] = String(row['createdAt'] ?? '').slice(0, 10);
    }
  }

  return sortNewestFirst(
    rows as Array<T & { createdAt?: string }>,
    (row) => row.createdAt ?? '',
  );
}

/* ------------------------------------------------------------- ServMate row */

/** Deterministic id: one `servmates` row per account, the same id mobile uses. */
export function ownServmateRef(uid: string) {
  return doc(requireDb(), 'servmates', uid);
}

export async function fetchOwnServmate(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(ownServmateRef(uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeOwnServmate(
  uid: string,
  next: (row: Record<string, unknown> | null) => void,
  fail: (error: Error) => void,
): () => void {
  return onSnapshot(ownServmateRef(uid), (snap) => next(snap.exists() ? { id: snap.id, ...snap.data() } : null), fail);
}

/** The rules allow a ServMate to write their own row; `role`/`verified` stay admin-only. */
export async function saveServmateProfile(
  uid: string,
  input: {
    name: string;
    bio: string;
    area: string;
    skills: string[];
    available: boolean;
    availability?: string;
    tools?: boolean;
  },
): Promise<void> {
  await setDoc(
    ownServmateRef(uid),
    {
      uid,
      name: input.name.trim(),
      bio: input.bio.trim(),
      area: input.area.trim(),
      skills: input.skills,
      ...(input.availability !== undefined ? { availability: input.availability } : {}),
      ...(input.tools !== undefined ? { tools: input.tools } : {}),
      status: input.available ? 'active' : 'paused',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
