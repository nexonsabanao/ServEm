'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps a live screen live without a socket.
 *
 * Two surfaces need to feel current — a conversation and the alerts count — and
 * a full server refresh is already the cheapest correct way to get them: the
 * pages are server-rendered, so `router.refresh()` re-reads the store and leaves
 * the client's scroll position and pathname alone.
 *
 * Three rules keep that from becoming an annoyance:
 *
 * 1. **Only while visible and online.** A background tab has nobody reading it.
 * 2. **Never while a field has focus.** Re-rendering under someone mid-sentence
 *    is worse than a message arriving one breath later.
 * 3. **Never over an open dialog**, where a refresh could close the sheet the
 *    person is using.
 *
 * Focus and tab-visibility also trigger a refresh, so coming back to the tab is
 * the moment it is current, not up to `intervalMs` later.
 */
export function LiveRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastRefresh = 0;

    function editing(): boolean {
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        active.getAttribute('contenteditable') === 'true'
      );
    }

    function refresh() {
      if (typeof document === 'undefined') return;
      if (document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (editing() || document.querySelector('dialog[open]')) return;
      // Focus and visibility often fire together; one render is enough.
      const now = Date.now();
      if (now - lastRefresh < 4_000) return;
      lastRefresh = now;
      router.refresh();
    }

    function start() {
      if (timer) return;
      timer = setInterval(refresh, intervalMs);
    }

    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        start();
        refresh();
      } else {
        stop();
      }
    }

    start();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
