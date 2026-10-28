import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { firebaseApp, firebaseReady } from './firebase';

/**
 * Verification document uploads.
 *
 * Files go to Firebase Storage under `verification/{uid}/…`; the storage rules
 * only allow that folder for the owner, and the database stores the object
 * paths (never public download URLs).
 */
export const VERIFICATION_MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function verificationFileProblem(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Use a JPG, PNG, WebP or PDF file.';
  if (file.size === 0) return 'That file is empty — pick another one.';
  if (file.size > VERIFICATION_MAX_BYTES) return 'That file is larger than 8 MB.';
  return null;
}

export async function uploadVerificationDocument(uid: string, file: File): Promise<string> {
  const problem = verificationFileProblem(file);
  if (problem) throw new Error(problem);
  if (!uid) throw new Error('Please sign in again before uploading.');
  if (!firebaseReady || !firebaseApp) throw new Error('ServEm is not connected to its storage yet.');

  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '-').slice(-60);
  const path = `users/${uid}/verification/${Date.now()}-${safeName}`;
  const objectRef = ref(getStorage(firebaseApp), path);
  await uploadBytes(objectRef, file, { contentType: file.type });
  // Read the URL once to prove the object exists; the request stores the path.
  await getDownloadURL(objectRef);
  return path;
}

const LISTING_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** A listing photo is public (it shows on cards), so it lives under its own folder. */
export async function uploadListingPhoto(uid: string, file: File): Promise<string> {
  if (!LISTING_TYPES.includes(file.type)) throw new Error('Use a JPG, PNG or WebP photo.');
  if (file.size === 0) throw new Error('That file is empty — pick another one.');
  if (file.size > VERIFICATION_MAX_BYTES) throw new Error('That photo is larger than 8 MB.');
  if (!firebaseReady || !firebaseApp) throw new Error('ServEm is not connected to its storage yet.');

  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '-').slice(-60);
  const objectRef = ref(getStorage(firebaseApp), `users/${uid}/listings/${Date.now()}-${safeName}`);
  await uploadBytes(objectRef, file, { contentType: file.type });
  return getDownloadURL(objectRef);
}
