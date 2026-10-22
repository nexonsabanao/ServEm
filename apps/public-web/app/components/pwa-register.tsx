'use client';

import { useEffect } from 'react';

/**
 * Registers the offline worker.
 *
 * Production only: in development the worker's cache-first rule would keep
 * serving the JavaScript chunk it saw first, so an edit could appear to do
 * nothing until the cache was cleared. A development build has no installed app
 * to keep alive anyway.
 *
 * Registration is best-effort. A browser without service workers, a private
 * window, or a refused registration all leave the app working exactly as it did;
 * installability is an addition, never a dependency.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    function register() {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // No worker: the app still works, it just cannot open offline.
      });
    }

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
