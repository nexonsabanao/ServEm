import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { PLATFORM_FEE_RATE, type PhilippinePaymentMethod } from './localization';
import type { BookingStatus } from './types';

/**
 * The one write path for state the platform has to police: bookings, booking
 * status changes, messages, verification, payouts and admin decisions.
 *
 * ServEm runs on the free Firebase Spark plan, so no Cloud Functions are
 * deployed and these operations write directly to Firestore. The guarantees
 * the callables used to hold moved into `firestore.rules`, which re-checks the
 * actor, the fields that may move, the listing's own rate, the 10% platform fee
 * and the total on every write. The client still computes nothing it is allowed
 * to choose: the fee and total are derived from the listing rate here only so
 * the confirmation screen can show them, and the rules reject any other value.
 *
 * Every input below still mirrors the strict zod schema in `functions/src/*` one
 * key for one key, including the lowercase enum values, so the same contract
 * can move back to callables without touching a call site.
 */

export interface BookingTotalsResult {
  bookingId: string;
  subtotal: number;
  fee: number;
  total: number;
}

/** `createBookingSchema.placeType` — mirrors `PLACE_TYPES` in lib/validate.ts. */
export const PLACE_TYPES = ['home', 'condo', 'apartment', 'office', 'retail', 'other'] as const;
export type BookingPlaceType = (typeof PLACE_TYPES)[number];

/**
 * The place types the booking wizard offers, with the human label shown next to
 * the server value. Only `value` ever leaves the device.
 */
export const placeTypeChoices: { value: BookingPlaceType; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'office', label: 'Work / office' },
  { value: 'other', label: 'Other place' },
];

/** A readable label for any server place type, including the ones the wizard does not offer. */
export const placeTypeLabels: Record<BookingPlaceType, string> = {
  home: 'Home',
  condo: 'Condominium',
  apartment: 'Apartment',
  office: 'Work / office',
  retail: 'Retail unit',
  other: 'Other place',
};

/** `createBookingSchema` — it is `.strict()`, so this list is exhaustive. */
export interface CreateBookingInput {
  serviceId: string;
  date: string;
  time: string;
  hours: number;
  address: string;
  unit?: string;
  city: string;
  province: string;
  postalCode: string;
  notes?: string;
  arrivalInstructions?: string;
  placeType: BookingPlaceType;
  paymentMethod: PhilippinePaymentMethod;
}

/** Booking lifecycle actions a member can take from the app. */
export type BookingAction = 'cancel' | 'reschedule' | 'complete' | 'accept' | 'start';

export interface UpdateBookingStatusInput {
  bookingId: string;
  action: BookingAction;
  reason?: string;
  newDate?: string;
  newTime?: string;
}

/** `sendMessageSchema` (chat.ts). */
export interface SendMessageInput {
  threadId: string;
  text: string;
}

/** `submitSchema.type` — mirrors `VERIFICATION_TYPES` in verification.ts. */
export const VERIFICATION_TYPES = [
  'government_id',
  'business_permit',
  'barangay_clearance',
  'nbi_clearance',
  'professional_certificate',
  'other',
] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

/** Labels for the document types a ServMate can submit. */
export const verificationTypeLabels: Record<VerificationType, string> = {
  government_id: 'Government ID',
  business_permit: 'Business permit',
  barangay_clearance: 'Barangay clearance',
  nbi_clearance: 'NBI clearance',
  professional_certificate: 'Professional certificate',
  other: 'Another document',
};

/** `submitSchema` (verification.ts): storage paths, never public download URLs. */
export interface SubmitVerificationInput {
  documentPaths: string[];
  type: VerificationType;
}

/** `requestPayoutSchema` (payouts.ts): whole pesos, at least PHP 1,000. */
export interface RequestPayoutInput {
  amount: number;
}

/** `adminDecisionSchema.kind`. */
export type AdminDecisionKind =
  | 'verification'
  | 'listing'
  | 'dispute'
  | 'payout'
  | 'payment'
  | 'review'
  | 'ticket'
  | 'account';

/**
 * The `DECISIONS` map in functions/src/admin.ts, mirrored so the client cannot
 * pair a kind with a decision the server would reject.
 */
export const ADMIN_DECISIONS = {
  verification: ['approved', 'rejected'],
  listing: ['live', 'paused', 'rejected'],
  dispute: ['resolved', 'rejected'],
  payout: ['approved', 'rejected'],
  payment: ['refunded', 'rejected'],
  review: ['published', 'flagged', 'removed'],
  ticket: ['resolved', 'rejected'],
  account: ['active', 'suspended'],
} as const satisfies Record<AdminDecisionKind, readonly string[]>;

export type AdminDecisionValue = (typeof ADMIN_DECISIONS)[AdminDecisionKind][number];

/** The decision values accepted for one specific kind. */
export type AdminDecisionValueFor<K extends AdminDecisionKind> = (typeof ADMIN_DECISIONS)[K][number];

/**
 * `adminDecisionSchema` as a discriminated union: `kind` and `decision` are
 * checked together, and `reason` is mandatory (5-500 characters, and it is what
 * lands in the audit trail).
 */
export type AdminDecisionInput = {
  [K in AdminDecisionKind]: { kind: K; id: string; decision: AdminDecisionValueFor<K>; reason: string };
}[AdminDecisionKind];

/** `bootstrapSchema` (admin.ts). */
export interface AdminBootstrapInput {
  bootstrapToken: string;
  email: string;
}

export interface UpdateBookingStatusResult {
  bookingId: string;
  status: BookingStatus;
}

export interface AdminDecisionResult {
  kind: AdminDecisionKind;
  id: string;
  decision: string;
}

function requireDb() {
  if (!db) {
    throw Object.assign(
      new Error('ServEm cannot reach Firestore right now. Check your connection and try again.'),
      { code: 'servem/firestore-unavailable' },
    );
  }
  return db;
}

function currentUid() {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw Object.assign(new Error('Please sign in again before continuing.'), { code: 'unauthenticated' });
  }
  return uid;
}

/** The listing decides the rate and the provider; the client only chooses hours. */
export async function createBooking(input: CreateBookingInput): Promise<BookingTotalsResult> {
  const store = requireDb();
  const uid = currentUid();
  const listingSnap = await getDoc(doc(store, 'services', input.serviceId));
  if (!listingSnap.exists()) {
    throw Object.assign(new Error('That service is no longer available. Pick another one.'), { code: 'not-found' });
  }
  const listing = listingSnap.data() as { rate?: unknown; providerId?: unknown; title?: unknown; name?: unknown; status?: unknown; providerName?: unknown };
  if (listing.status !== 'live') {
    throw Object.assign(new Error('That service is no longer bookable.'), { code: 'failed-precondition' });
  }
  const rate = typeof listing.rate === 'number' ? listing.rate : 0;
  const providerId = typeof listing.providerId === 'string' ? listing.providerId : '';
  if (!rate || !providerId) {
    throw new Error('This listing is missing a rate or a provider, so it cannot be booked yet.');
  }
  const subtotal = rate * input.hours;
  const fee = Math.round(subtotal * PLATFORM_FEE_RATE);
  const total = subtotal + fee;
  const address = [input.address.trim(), input.unit?.trim()].filter(Boolean).join(', ');
  const profileSnap = await getDoc(doc(store, 'profiles', uid));
  const profileName = profileSnap.data()?.['name'];
  const bookingRef = doc(collection(store, 'bookings'));
  await setDoc(bookingRef, {
    customerId: uid,
    customer: typeof profileName === 'string' ? profileName : '',
    provider: typeof listing.providerName === 'string' ? listing.providerName : '',
    providerId,
    serviceId: input.serviceId,
    service: typeof listing.title === 'string' ? listing.title : typeof listing.name === 'string' ? listing.name : '',
    date: input.date,
    time: input.time,
    hours: input.hours,
    status: 'pending',
    address,
    city: input.city,
    province: input.province,
    postalCode: input.postalCode,
    notes: input.notes ?? '',
    arrivalInstructions: input.arrivalInstructions ?? '',
    placeType: input.placeType,
    paymentMethod: input.paymentMethod,
    rate,
    fee,
    total,
    createdAt: serverTimestamp(),
  });
  return { bookingId: bookingRef.id, subtotal, fee, total };
}

export async function updateBookingStatus(input: UpdateBookingStatusInput): Promise<UpdateBookingStatusResult> {
  const store = requireDb();
  const bookingRef = doc(store, 'bookings', input.bookingId);
  if (input.action === 'reschedule') {
    if (!input.newDate || !input.newTime) throw new Error('Pick a new date and time first.');
    await updateDoc(bookingRef, { date: input.newDate, time: input.newTime, updatedAt: serverTimestamp() });
    const snap = await getDoc(bookingRef);
    const status = snap.data()?.['status'] as BookingStatus | undefined;
    if (!status) throw Object.assign(new Error('That booking is no longer available.'), { code: 'not-found' });
    return { bookingId: input.bookingId, status };
  }
  const status: BookingStatus =
    input.action === 'cancel'
      ? 'cancelled'
      : input.action === 'accept'
        ? 'accepted'
        : input.action === 'start'
          ? 'in_progress'
          : 'completed';
  await updateDoc(bookingRef, {
    status,
    ...(input.action === 'cancel' ? { cancellationReason: input.reason?.trim() || 'Cancelled by the customer' } : {}),
    updatedAt: serverTimestamp(),
  });
  return { bookingId: input.bookingId, status };
}

/** One thread per booking, created on the first message. */
export async function sendMessage(input: SendMessageInput): Promise<{ threadId: string; messageId: string }> {
  const store = requireDb();
  const uid = currentUid();
  const text = input.text.trim().slice(0, 2000);
  if (!text) throw new Error('Write a message first.');
  const threadRef = doc(store, 'threads', input.threadId);
  const bookingSnap = await getDoc(doc(store, 'bookings', input.threadId));
  if (!bookingSnap.exists()) {
    throw Object.assign(new Error('This conversation is no longer available.'), { code: 'not-found' });
  }
  const booking = bookingSnap.data() as {
    customerId?: string;
    providerId?: string;
    customer?: string;
    provider?: string;
    serviceId?: string;
    service?: string;
  };
  if (booking.customerId !== uid && booking.providerId !== uid) {
    throw Object.assign(new Error('You are not part of this conversation.'), { code: 'permission-denied' });
  }
  const serviceTitle = typeof booking.service === 'string' ? booking.service : '';
  let providerName = typeof booking.provider === 'string' ? booking.provider : '';
  if (!providerName && typeof booking.serviceId === 'string') {
    const serviceSnap = await getDoc(doc(store, 'services', booking.serviceId));
    const name = serviceSnap.data()?.['providerName'];
    if (typeof name === 'string') providerName = name;
  }
  // A missing thread cannot be read (rules only expose threads to members), so
  // merge-create instead of probing it first.
  await setDoc(
    threadRef,
    {
      members: [booking.customerId, booking.providerId],
      bookingId: input.threadId,
      customerId: booking.customerId,
      providerId: booking.providerId,
      customerName: typeof booking.customer === 'string' ? booking.customer : '',
      providerName,
      service: serviceTitle,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  const messageRef = doc(collection(store, 'threads', input.threadId, 'messages'));
  await setDoc(messageRef, {
    senderId: uid,
    text,
    time: new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }),
    createdAt: serverTimestamp(),
  });
  await updateDoc(threadRef, {
    lastMessage: text.slice(0, 140),
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    messageCount: increment(1),
  });
  return { threadId: input.threadId, messageId: messageRef.id };
}

export async function submitVerification(
  input: SubmitVerificationInput,
): Promise<{ verificationRequestId: string; status: string; documentPaths: string[] }> {
  const store = requireDb();
  const uid = currentUid();
  if (!input.documentPaths.length) throw new Error('Upload at least one document first.');
  const ref = await addDoc(collection(store, 'verificationRequests'), {
    uid,
    type: input.type,
    documentPaths: input.documentPaths.slice(0, 5),
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return { verificationRequestId: ref.id, status: 'pending', documentPaths: input.documentPaths.slice(0, 5) };
}

/** A request, not a settlement: an admin still decides, and nothing moves money here. */
export async function requestPayout(
  input: RequestPayoutInput,
): Promise<{ withdrawalId: string; status: string; amount: number; available: number }> {
  const store = requireDb();
  const uid = currentUid();
  if (!Number.isInteger(input.amount) || input.amount < 1000) {
    throw new Error('The smallest payout is ₱1,000.');
  }
  const ref = await addDoc(collection(store, 'withdrawals'), {
    providerId: uid,
    amount: input.amount,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return { withdrawalId: ref.id, status: 'pending', amount: input.amount, available: 0 };
}

/**
 * Admin access is granted with the Firebase Admin SDK or the console, never
 * from the app — a client cannot set its own custom claim.
 */
export async function adminBootstrap(_input: AdminBootstrapInput): Promise<{ uid: string; email: string; admin: boolean }> {
  throw new Error(
    'Admin access is granted with the Firebase Admin SDK or the Firebase console, not from the app. See SETUP.md → Granting the first admin.',
  );
}

const ADMIN_TARGETS: Record<AdminDecisionKind, string> = {
  verification: 'verificationRequests',
  listing: 'services',
  dispute: 'disputes',
  payout: 'withdrawals',
  payment: 'payments',
  review: 'reviews',
  ticket: 'tickets',
  account: 'profiles',
};

/** Records the decision on the record and appends it to the audit trail. */
export async function adminDecision(input: AdminDecisionInput): Promise<AdminDecisionResult> {
  const store = requireDb();
  const uid = currentUid();
  const reason = input.reason.trim().slice(0, 500);
  if (reason.length < 5) throw new Error('Write a short reason (at least 5 characters) before recording this decision.');
  // Each collection only accepts statuses its own model declares: approving a
  // payout queues it, and an account decision is a status, never a role change.
  const nextStatus = input.kind === 'payout' && input.decision === 'approved' ? 'scheduled' : input.decision;
  await updateDoc(doc(store, ADMIN_TARGETS[input.kind], input.id), {
    status: nextStatus,
    decisionKind: input.kind,
    decidedBy: uid,
    decidedAt: serverTimestamp(),
    decisionReason: reason,
  });
  if (input.kind === 'verification') {
    // Approving identity documents is what makes the account verified, so the
    // badge and the directory flag move together with the queue decision.
    const requestSnap = await getDoc(doc(store, 'verificationRequests', input.id));
    const providerUid = requestSnap.data()?.['uid'];
    if (typeof providerUid === 'string' && providerUid) {
      const approved = input.decision === 'approved';
      await updateDoc(doc(store, 'profiles', providerUid), { verified: approved });
      try {
        await updateDoc(doc(store, 'servmates', providerUid), {
          verified: approved,
          status: approved ? 'active' : 'pending',
        });
      } catch {
        // A provider without a directory row yet still gets the profile flag.
      }
    }
  }
  await addDoc(collection(store, 'audit'), {
    actor: uid,
    action: `${input.kind}:${input.decision}`,
    target: input.id,
    reason,
    createdAt: serverTimestamp(),
  });
  return { kind: input.kind, id: input.id, decision: input.decision };
}

/** Human-readable, Filipino-English message for a failed callable. */
export function callableErrorMessage(error: unknown): string {
  const details =
    typeof error === 'object' && error && 'details' in error
      ? String((error as { details: unknown }).details ?? '')
      : '';
  const code =
    typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';

  if (details) return details;
  switch (code) {
    case 'unavailable':
      return 'Could not reach ServEm servers. Check your internet connection and try again.';
    case 'permission-denied':
      return "You don't have permission to do that. Sign in again if you're sure it's your account.";
    case 'not-found':
      return 'That record is no longer available.';
    case 'failed-precondition':
      return 'This action is not available yet. Please try again later.';
    case 'servem/functions-unavailable':
      return 'ServEm is not connected to its servers yet. Try again in a moment.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Something went wrong on our side. Please try again.';
  }
}

export interface ServiceDraft {
  id?: string;
  title: string;
  category: string;
  description: string;
  rate: number;
  minHours: number;
  area: string;
  image: string;
}

/**
 * Publishes one of the signed-in ServMate's own listings. The rate is whole
 * pesos; firestore.rules pins `providerId` to the caller and bounds the price.
 */
export async function saveService(draft: ServiceDraft): Promise<{ id: string }> {
  const store = requireDb();
  const uid = currentUid();
  if (draft.title.trim().length < 3) throw new Error('Give the service a name of at least 3 characters.');
  if (!Number.isInteger(draft.rate) || draft.rate < 100 || draft.rate > 100000) {
    throw new Error('Set an hourly rate between ₱100 and ₱100,000.');
  }
  const profile = await getDoc(doc(store, 'profiles', uid));
  const providerName = String(profile.data()?.['name'] ?? 'ServMate');
  const payload = {
    providerId: uid,
    providerName,
    servmateId: uid,
    title: draft.title.trim(),
    name: draft.title.trim(),
    category: draft.category,
    description: draft.description.trim(),
    blurb: draft.description.trim().slice(0, 200),
    rate: draft.rate,
    price: draft.rate,
    minHours: draft.minHours,
    area: draft.area.trim(),
    asset: draft.image,
    image: draft.image,
    status: 'live',
    updatedAt: serverTimestamp(),
  };
  if (draft.id) {
    await setDoc(doc(store, 'services', draft.id), payload, { merge: true });
    return { id: draft.id };
  }
  const ref = await addDoc(collection(store, 'services'), { ...payload, createdAt: serverTimestamp() });
  return { id: ref.id };
}
