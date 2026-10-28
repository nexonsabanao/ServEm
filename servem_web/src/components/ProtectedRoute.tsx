import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { safeInternalRedirect } from '../lib/security';

type Access = 'checking' | 'anonymous' | 'allowed' | 'denied';

/**
 * Client-side gate. It is a convenience, not the security boundary: every read
 * and write is re-checked by firestore.rules and storage.rules, so hiding a
 * screen never protects data by itself.
 */
export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const location = useLocation();
  const [access, setAccess] = useState<Access>('checking');

  useEffect(() => {
    if (!auth) {
      setAccess('denied');
      return;
    }

    return auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setAccess('anonymous');
        return;
      }

      if (!requireAdmin) {
        setAccess('allowed');
        return;
      }

      try {
        // The `admin` custom claim cannot be forged by a client; read it fresh.
        const token = await user.getIdTokenResult(true);
        setAccess(token.claims?.admin === true ? 'allowed' : 'denied');
      } catch {
        setAccess('denied');
      }
    });
  }, [requireAdmin]);

  if (access === 'checking') {
    return (
      <div className="shell-width py-16 text-[13px] text-[var(--color-muted)]" role="status" aria-live="polite">
        Checking your session…
      </div>
    );
  }

  if (access === 'anonymous') {
    return <Navigate to={`/login?next=${encodeURIComponent(safeInternalRedirect(location.pathname))}`} replace />;
  }

  if (access === 'denied') {
    return (
      <div className="shell-width py-16">
        <h1 className="page-title">Access restricted</h1>
        <p className="page-sub">
          {requireAdmin
            ? 'This area is for ServEm staff. Sign out and back in with an admin account.'
            : 'ServEm could not verify your session. Please sign in again.'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
