import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase web config is supplied per environment through VITE_FIREBASE_*.
 *
 * The web config is public by design — it ships in every browser bundle — but
 * keeping it out of source keeps project identifiers out of the repository and
 * lets forks point at their own project. Copy `servem_web/.env.example` to
 * `servem_web/.env` and fill it from Firebase console → Project settings →
 * Your apps → Web app. Never put a service-account key, admin token or payment
 * secret in this file or anywhere in the client bundle.
 *
 * Access control lives in Firestore/Storage rules, restricted API keys and
 * (recommended) Firebase App Check.
 */
const firebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

const missingConfig = requiredConfig.filter((key) => !firebaseEnv[key]);
const envName = (key: string) => `VITE_FIREBASE_${key.split(/(?=[A-Z])/).join('_').toUpperCase()}`;

export const firebaseConfigError = missingConfig.length
  ? `Firebase is not configured. Missing: ${missingConfig.map(envName).join(', ')}. ` +
    'Copy servem_web/.env.example to servem_web/.env and fill it from the Firebase console.'
  : null;

export const firebaseConfig = {
  apiKey: firebaseEnv.apiKey ?? '',
  authDomain: firebaseEnv.authDomain ?? '',
  projectId: firebaseEnv.projectId ?? '',
  storageBucket: firebaseEnv.storageBucket ?? '',
  messagingSenderId: firebaseEnv.messagingSenderId ?? '',
  appId: firebaseEnv.appId ?? '',
  ...(firebaseEnv.measurementId ? { measurementId: firebaseEnv.measurementId } : {}),
};

let app: FirebaseApp | null = null;
if (!firebaseConfigError) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (error) {
    console.error('[firebase] initialization failed', error);
  }
} else {
  console.error(`[firebase] ${firebaseConfigError}`);
}

export const firebaseApp = app;
export const auth = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;
export const firebaseReady = Boolean(auth && db);

/**
 * Local development against the Firebase Emulator Suite:
 *   firebase emulators:start --only auth,firestore
 *   VITE_USE_FIREBASE_EMULATOR=1 npm run dev
 * Off unless the flag is set, so production always talks to the configured project.
 */
export const usingEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === '1';
if (app && usingEmulator) {
  if (auth) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  if (db) connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
export let analytics: Analytics | null = null;
if (app) {
  void isSupported().then((supported) => {
    if (supported) analytics = getAnalytics(app);
  });
}

export type { User };

export function watchAuth(cb: (user: User | null) => void) {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export async function loginWithEmail(email: string, password: string) {
  if (!auth) throw new Error('Firebase is not configured.');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function registerWithEmail(name: string, email: string, password: string) {
  if (!auth) throw new Error('Firebase is not configured.');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred.user;
}

export async function loginWithGoogle() {
  if (!auth) throw new Error('Firebase is not configured.');
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function resetPassword(email: string) {
  if (!auth) throw new Error('Firebase is not configured.');
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  if (!auth) return;
  await firebaseSignOut(auth);
}

export function friendlyAuthError(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'The sign-in window was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for ServEm and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'That email already has an account with a different sign-in method.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled in Firebase yet.';
    case 'auth/network-request-failed':
      return 'Network unavailable. Check your connection and try again.';
    default:
      return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }
}

/**
 * Sign in with Apple through Firebase Auth. Requires the Apple provider in
 * Firebase Console → Authentication → Sign-in method; until then Firebase
 * answers `auth/operation-not-allowed` and the UI shows that honestly.
 */
export async function loginWithApple() {
  if (!auth) throw new Error('Firebase is not configured.');
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

/** Sends the real Firebase email-verification link to the signed-in address. */
export async function sendVerificationEmail() {
  if (!auth?.currentUser) throw new Error('Please sign in again before continuing.');
  await sendEmailVerification(auth.currentUser, { url: `${window.location.origin}/login` });
}

/** Re-reads the user so `emailVerified` reflects the server, not a stale token. */
export async function isEmailVerifiedNow() {
  if (!auth?.currentUser) throw new Error('Please sign in again before continuing.');
  await reload(auth.currentUser);
  return auth.currentUser.emailVerified;
}
