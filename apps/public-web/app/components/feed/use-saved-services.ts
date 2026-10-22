'use client';

import { useCallback, useEffect, useState } from 'react';
import { readSavedServices, writeSavedServices } from '@/lib/device-store';

/**
 * The saved-services list, with one owner.
 *
 * Four screens read and write the same device-local list — the feed's grid, a
 * search result, the shortlist board, and the recommendations under a service.
 * Each used to keep its own `saved` array and its own idea of when to prune, so
 * a bookmark made in one place could be counted by one screen and ignored by
 * another, and two screens open at once could overwrite each other's writes.
 * There is now one `useState` over these ids, and `lib/device-store` stays the
 * only thing that knows the storage format.
 *
 * `knownIds` is optional on purpose. Pass it when the screen already holds the
 * whole catalogue: saves for listings that no longer exist are dropped once, on
 * mount. A screen showing a subset (search results) passes nothing, because
 * pruning there would silently delete saves that simply did not match the query.
 */
export function useSavedServices(knownIds?: string[]) {
  /* Captured once: the first catalogue this screen was rendered with decides
     which stale ids to drop, and a later prop identity change cannot cause a
     second pruning pass that would delete a bookmark made since. */
  const [catalogue] = useState(knownIds);
  const [saved, setSaved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const known = catalogue ? new Set(catalogue) : null;
    setSaved(readSavedServices().filter((id) => !known || known.has(id)));
    setReady(true);
  }, [catalogue]);

  // Nothing is written until the first read has landed, or an empty initial
  // array would erase the list on a cold page load.
  useEffect(() => {
    if (!ready) return;
    writeSavedServices(saved);
  }, [saved, ready]);

  const toggle = useCallback((id: string) => {
    setSaved((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  }, []);

  const remove = useCallback((id: string) => {
    setSaved((prev) => prev.filter((entry) => entry !== id));
  }, []);

  return { saved, ready, toggle, remove };
}
