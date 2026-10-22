export const metadata = {
  title: 'Offline — ServEm',
  robots: { index: false, follow: false },
};

/**
 * The page an installed app shows when the network is gone.
 *
 * It is cached at install (see `public/sw.js`), so it has to stand alone: no
 * session read, no data fetch, no image that is not precached. It says what
 * happened, what still works, and gives one control that retries the page the
 * person was trying to open.
 */
export default function OfflinePage() {
  return (
    <main className="offline">
      <div className="offline-card">
        <span className="offline-mark" aria-hidden="true">
          S
        </span>
        <p className="offline-kicker">No connection</p>
        <h1 className="offline-title">You’re offline.</h1>
        <p className="offline-note">
          ServEm can’t reach the marketplace right now. Anything you had already opened may still be
          readable; new searches, messages and requests will send once you’re back.
        </p>
        {/* A plain anchor: a full navigation is what the worker intercepts, and
            a client-side route change cannot succeed while the network is down. */}
        <a className="button button-primary offline-retry" href="/">
          Try again
        </a>
      </div>
    </main>
  );
}
