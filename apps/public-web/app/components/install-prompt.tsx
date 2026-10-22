'use client';

import { useEffect, useState } from 'react';
import { readInstallDismissed, writeInstallDismissed } from '@/lib/device-store';
import { isStandaloneDisplay, shouldOfferInstall } from '@/lib/install';

type InstallOffer = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * The offer the browser made, captured the moment this module loads.
 *
 * `beforeinstallprompt` fires once per page load and can arrive before React
 * hydrates; a listener attached in an effect would miss it and the affordance
 * would never appear on exactly the browsers that can install. So the listener
 * is a module-level side effect — it runs when the client bundle is evaluated —
 * and the component subscribes to the result. The event is also `preventDefault`ed
 * so the browser's own mini-infobar does not fire first and steal the offer.
 */
let offer: InstallOffer | null = null;
const watchers = new Set<() => void>();

function announce() {
  for (const watcher of watchers) watcher();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    offer = event as InstallOffer;
    announce();
  });

  // Once installed there is nothing left to offer, and the answer is remembered
  // so a later upgrade — installing from the browser menu, another profile —
  // cannot make the banner come back.
  window.addEventListener('appinstalled', () => {
    offer = null;
    writeInstallDismissed(true);
    announce();
  });
}

/**
 * The install moment, in the app's own chrome.
 *
 * The audit's finding was that installability existed but the only door to it
 * was the browser's menu. This is that door: one line, one button, in the strip
 * under the top bar — not a modal, not a redesign, and nothing at all in a
 * browser that has no install to offer (Safari, an in-app browser, or a browser
 * where the app is already installed).
 *
 * Saying "Not now" is final for the device: the answer lives in
 * `lib/device-store` beside the other things ServEm keeps in this browser, and
 * Settings lists it (and can undo it) — see `DeviceDataPanel`.
 *
 * It renders nothing on the server and on the first client render, so the
 * server-rendered HTML and hydration agree; the strip only appears once the
 * browser has actually made an offer. And it is an `<aside>` in the content
 * column: the navigation and the search field are untouched, so one nav surface
 * per width and one search field per view still hold.
 */
export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function refresh() {
      setVisible(
        shouldOfferInstall({
          offered: offer !== null,
          dismissed: readInstallDismissed(),
          standalone: isStandaloneDisplay(),
        }),
      );
    }

    watchers.add(refresh);
    refresh();
    // An install can also land from the browser's own menu while the tab is
    // open; re-reading on focus is what stops the strip outliving the offer.
    document.addEventListener('visibilitychange', refresh);
    return () => {
      watchers.delete(refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  async function install() {
    if (!offer) return;
    setBusy(true);
    try {
      await offer.prompt();
      const choice = await offer.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        offer = null;
        writeInstallDismissed(true);
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    writeInstallDismissed(true);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="app-install-wrap">
      <aside className="app-install" aria-label="Install ServEm">
        <span className="app-install-mark" aria-hidden="true">
          S
        </span>
        <p className="app-install-copy">
          <strong>Install ServEm</strong> Keep it on this device and open it in one tap, without the
          browser.
        </p>
        <div className="app-install-actions">
          <button type="button" className="app-install-go" onClick={install} disabled={busy}>
            {busy ? 'Installing…' : 'Install'}
          </button>
          <button type="button" className="app-install-later" onClick={dismiss}>
            Not now
          </button>
        </div>
      </aside>
    </div>
  );
}
