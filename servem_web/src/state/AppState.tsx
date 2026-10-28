import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '../lib/firebase';
import {
  firebaseConfigError,
  firebaseReady,
  friendlyAuthError,
  loginWithEmail,
  loginWithApple,
  loginWithGoogle,
  logout,
  registerWithEmail,
  resetPassword,
  watchAuth,
} from '../lib/firebase';
import {
  addFavorite,
  deletePlace as deletePlaceDoc,
  ensureProfile,
  pushProfile,
  putPlace as putPlaceDoc,
  removeFavorite,
  markAllRead,
  subscribeBookings,
  subscribeProviderBookings,
  subscribeReviews,
  subscribeServMates,
  subscribeServices,
  subscribeNotifications,
  subscribePlaces,
  subscribeProfile,
  subscribeThreads,
} from '../lib/db';
import {
  callableErrorMessage,
  createBooking as createBookingCallable,
  sendMessage as sendMessageCallable,
  updateBookingStatus,
  type BookingAction,
  type BookingTotalsResult,
  type CreateBookingInput,
} from '../lib/functions';
import type {
  Booking,
  Notification,
  Profile,
  Review,
  SavedPlace,
  Service,
  ServMate,
  Thread,
} from '../lib/types';

/** How far the live data connection has got. */
export type SyncStatus = 'connecting' | 'ready' | 'offline' | 'error';

/**
 * The signed-out profile. Nothing here belongs to a real person, and no page
 * renders it to a signed-out visitor because every account route is protected.
 */
const EMPTY_PROFILE: Profile = {
  id: '',
  name: '',
  email: '',
  phone: '',
  city: '',
  since: '',
  role: 'customer',
  photo: '',
  verified: false,
};

interface AppState {
  user: User | null;
  profile: Profile;
  status: SyncStatus;
  error: string | null;
  authBusy: boolean;
  authError: string | null;
  bookings: Booking[];
  providerBookings: Booking[];
  threads: Thread[];
  places: SavedPlace[];
  notifications: Notification[];
  services: Service[];
  servMates: ServMate[];
  reviews: Review[];
  favorites: Set<string>;
  refresh: () => void;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signInGoogle: () => Promise<boolean>;
  signInApple: () => Promise<boolean>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  clearAuthError: () => void;
  addBooking: (input: CreateBookingInput) => Promise<BookingTotalsResult>;
  changeBookingStatus: (
    bookingId: string,
    action: BookingAction,
    options?: { reason?: string; newDate?: string; newTime?: string },
  ) => Promise<void>;
  cancelBooking: (bookingId: string, reason: string) => Promise<void>;
  sendMessage: (threadId: string, text: string) => Promise<void>;
  addPlace: (place: Omit<SavedPlace, 'id'>) => Promise<void>;
  removePlace: (id: string) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

/** Error text for a failed Firestore read: Filipino-English, honest, actionable. */
function friendlyDataError(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'permission-denied':
      return 'Pasensya na, hindi mo pa maa-access ang data na ito. Mag-sign out then sign in again.';
    case 'unavailable':
      return 'Walang koneksyon sa server. Check your internet then try again — your data will load automatically.';
    case 'servem/firestore-unavailable':
    case 'servem/functions-unavailable':
      return 'Hindi pa nakakonekta ang ServEm sa Firestore. Subukan ulit in a moment.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Hindi namin ma-load ang iyong data ngayon. Try again in a moment.';
  }
}

function profileFromUser(user: User): Omit<Profile, 'id'> {
  const created = user.metadata.creationTime ?? user.metadata.lastSignInTime;
  return {
    name: user.displayName ?? '',
    email: user.email ?? '',
    phone: user.phoneNumber ?? '',
    city: '',
    since: created
      ? new Date(created).toLocaleDateString('en-PH', { month: 'short', year: 'numeric', timeZone: 'Asia/Manila' })
      : '',
    role: 'customer',
    photo: user.photoURL ?? '',
    verified: user.emailVerified,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [bookings, setBookings] = useState<Booking[]>([]);
  // The same collection read from the ServMate side, for the /mate workspace.
  const [providerBookings, setProviderBookings] = useState<Booking[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // The public marketplace: services, ServMate profiles and published reviews.
  const [services, setServices] = useState<Service[]>([]);
  const [servMates, setServMates] = useState<ServMate[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<SyncStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const uid = user?.uid ?? null;

  /* Auth session. Nothing is read until Firebase has answered. */
  useEffect(() => {
    const stop = watchAuth((next) => {
      setUser(next);
      if (!next) {
        setProfile(EMPTY_PROFILE);
        setBookings([]);
        setThreads([]);
        setPlaces([]);
        setNotifications([]);
        setFavorites(new Set());
        setError(null);
        setStatus('connecting');
      }
    });
    return stop;
  }, []);

  /* Connectivity. `offline` is reported from the browser, never guessed. */
  useEffect(() => {
    const goOffline = () => setStatus((prev) => (prev === 'error' ? prev : 'offline'));
    const goOnline = () => setNonce((n) => n + 1);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  /* Live, read-only subscriptions for everything the signed-in person owns. */
  useEffect(() => {
    if (!user) {
      if (!firebaseReady) setStatus('error');
      return;
    }
    const uid = user.uid;
    if (!firebaseReady) {
      setStatus('error');
      setError(firebaseConfigError ?? 'ServEm is not connected to Firebase yet. Try again in a moment.');
      return;
    }

    let alive = true;
    let settled = 0;
    const total = 9;
    const failures: string[] = [];
    const markReady = () => {
      settled += 1;
      if (alive && settled === total) {
        setStatus('ready');
      }
    };
    const report = (label: string) => (reason: unknown) => {
      if (!alive) return;
      failures.push(`${label}: ${friendlyDataError(reason)}`);
      setStatus('error');
      setError(failures[0]);
      console.error(`[servem] ${label} read failed`, reason);
    };

    setStatus('connecting');
    setError(null);

    const unsubscribes: Array<() => void> = [];
    try {
      unsubscribes.push(
        subscribeProfile(
          uid,
          (snapshot) => {
            if (!alive) return;
            if (snapshot.profile) {
              setProfile(snapshot.profile);
            } else {
              void ensureProfile(uid, profileFromUser(user))
                .then((created) => {
                  if (alive) setProfile(created);
                })
                .catch(report('profile'));
            }
            setFavorites(new Set(snapshot.favorites));
            markReady();
          },
          report('profile'),
        ),
        subscribeBookings(
          uid,
          (rows) => {
            if (!alive) return;
            setBookings(rows);
            markReady();
          },
          report('bookings'),
        ),
        subscribeProviderBookings(
          uid,
          (rows) => {
            if (!alive) return;
            setProviderBookings(rows);
            markReady();
          },
          report('provider bookings'),
        ),
        subscribeThreads(
          uid,
          (rows) => {
            if (!alive) return;
            setThreads(rows);
            markReady();
          },
          report('messages'),
        ),
        subscribePlaces(
          uid,
          (rows) => {
            if (!alive) return;
            setPlaces(rows);
            markReady();
          },
          report('saved places'),
        ),
        subscribeNotifications(
          uid,
          (rows) => {
            if (!alive) return;
            setNotifications(rows);
            markReady();
          },
          report('notifications'),
        ),
        subscribeServices(
          (rows) => {
            if (!alive) return;
            setServices(rows);
            markReady();
          },
          report('services'),
        ),
        subscribeServMates(
          (rows) => {
            if (!alive) return;
            setServMates(rows);
            markReady();
          },
          report('ServMates'),
        ),
        subscribeReviews(
          (rows) => {
            if (!alive) return;
            setReviews(rows);
            markReady();
          },
          report('reviews'),
        ),
      );
    } catch (reason) {
      report('data')(reason);
    }

    return () => {
      alive = false;
      for (const stop of unsubscribes) stop();
    };
  }, [user, nonce]);

  const runAuth = useCallback(async (fn: () => Promise<unknown>) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await fn();
      return true;
    } catch (reason) {
      setAuthError(friendlyAuthError(reason));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signIn = useCallback((email: string, password: string) => runAuth(() => loginWithEmail(email, password)), [runAuth]);
  const signUp = useCallback(
    (name: string, email: string, password: string) => runAuth(() => registerWithEmail(name, email, password)),
    [runAuth],
  );
  const signInGoogle = useCallback(() => runAuth(() => loginWithGoogle()), [runAuth]);
  const signInApple = useCallback(() => runAuth(() => loginWithApple()), [runAuth]);
  const requestPasswordReset = useCallback((email: string) => runAuth(() => resetPassword(email)), [runAuth]);

  const signOut = useCallback(async () => {
    await logout();
    setAuthError(null);
  }, []);

  const refresh = useCallback(() => {
    setNonce((n) => n + 1);
    setStatus('connecting');
    setError(null);
  }, []);

  /* Writes: callable first, then the reactive read delivers the new state. */
  const addBooking = useCallback(async (input: CreateBookingInput) => {
    try {
      return await createBookingCallable(input);
    } catch (reason) {
      throw new Error(callableErrorMessage(reason), { cause: reason });
    }
  }, []);

  const changeBookingStatus = useCallback(
    async (
      bookingId: string,
      action: BookingAction,
      options?: { reason?: string; newDate?: string; newTime?: string },
    ) => {
      try {
        await updateBookingStatus({ bookingId, action, ...options });
      } catch (reason) {
        throw new Error(callableErrorMessage(reason), { cause: reason });
      }
    },
    [],
  );

  const cancelBooking = useCallback(
    (bookingId: string, reason: string) => changeBookingStatus(bookingId, 'cancel', { reason }),
    [changeBookingStatus],
  );

  const sendMessage = useCallback(async (threadId: string, text: string) => {
    try {
      await sendMessageCallable({ threadId, text });
    } catch (reason) {
      console.error('[servem] send message failed', reason);
      throw new Error(callableErrorMessage(reason), { cause: reason });
    }
  }, []);

  const addPlace = useCallback(
    async (place: Omit<SavedPlace, 'id'>) => {
      if (!uid) return;
      if (place.isDefault) {
        await Promise.all(
          places.filter((p) => p.isDefault).map((p) => putPlaceDoc(uid, { ...p, isDefault: false })),
        );
      }
      await putPlaceDoc(uid, { ...place, id: crypto.randomUUID() });
    },
    [uid, places],
  );

  const removePlace = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deletePlaceDoc(uid, id);
    },
    [uid],
  );

  const markNotificationsRead = useCallback(async () => {
    if (!uid) return;
    await markAllRead(uid);
  }, [uid]);

  const toggleFavorite = useCallback(
    async (id: string) => {
      if (!uid) return;
      const adding = !favorites.has(id);
      try {
        if (adding) await addFavorite(uid, id);
        else await removeFavorite(uid, id);
      } catch (reason) {
        console.error('[servem] favourite update failed', reason);
        throw new Error(friendlyDataError(reason), { cause: reason });
      }
    },
    [uid, favorites],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!uid) return;
      await pushProfile(uid, { ...profile, ...patch, id: uid });
    },
    [uid, profile],
  );

  const value: AppState = {
    user,
    profile,
    status,
    error,
    authBusy,
    authError,
    bookings,
    providerBookings,
    services,
    servMates,
    reviews,
    threads,
    places,
    notifications,
    favorites,
    refresh,
    signIn,
    signUp,
    signInGoogle,
    signInApple,
    signOut,
    requestPasswordReset,
    clearAuthError: () => setAuthError(null),
    addBooking,
    changeBookingStatus,
    cancelBooking,
    sendMessage,
    addPlace,
    removePlace,
    markNotificationsRead,
    toggleFavorite,
    updateProfile,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function useUnreadNotifications() {
  const { notifications } = useApp();
  return notifications.filter((n) => !n.read).length;
}

export function useSyncStatus() {
  const { status, error, refresh } = useApp();
  return useMemo(() => ({ status, error, refresh }), [status, error, refresh]);
}
