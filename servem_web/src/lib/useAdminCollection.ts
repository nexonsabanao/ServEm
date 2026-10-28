import { useEffect, useState } from 'react';
import { fetchAdminCollection } from './db';
import { useApp } from '../state/AppState';

export interface AdminCollection<T> {
  rows: T[];
  loading: boolean;
  /** True when `filterCollection` narrowed the rows with a query. */
  searched?: boolean;
  searchQuery?: string;
  error: string | null;
  reload: () => void;
}

/**
 * Admin-only Firestore read. There is no placeholder data: a visitor who is not
 * signed in, not an admin, or whose read failed gets a real loading state, an
 * explicit error, or a genuine empty list.
 */
export function useAdminCollection<T extends { id: string }>(name: string): AdminCollection<T> {
  const { user, status } = useApp();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setRows([]);
    setError(null);

    if (!user) {
      setLoading(false);
      setError('Mag-sign in first. This workspace is only for ServEm staff accounts.');
      return;
    }

    setLoading(true);
    fetchAdminCollection<T>(name)
      .then((remote) => {
        if (!active) return;
        setRows(remote);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        console.error(`[servem] admin read of ${name} failed`, reason);
        const code =
          typeof reason === 'object' && reason && 'code' in reason
            ? String((reason as { code: unknown }).code)
            : '';
        setError(
          code === 'permission-denied'
            ? 'Access denied. Your account does not have the admin claim, so this data cannot be shown.'
            : `Hindi ma-load ang ${name} list. Try again.`,
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [name, user, status, nonce]);

  return { rows, loading, error, reload: () => setNonce((n) => n + 1) };
}
