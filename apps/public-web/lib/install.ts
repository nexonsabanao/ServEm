/**
 * When the app may offer to install itself.
 *
 * The affordance is deliberately conservative: it exists only for a browser that
 * has actually offered an install (`beforeinstallprompt` — Chrome/Edge/Android
 * fire it; Safari and an in-app browser never do, so they simply never see it),
 * and never once the device has said no or is already running the installed app.
 *
 * Splitting the rule out of the component keeps it in one sentence a reader can
 * check, and it is the part `test/install-offer.test.ts` can exercise without a
 * browser.
 */

export type InstallFacts = {
  /** The browser fired `beforeinstallprompt`: it has an install to offer now. */
  offered: boolean;
  /** This device answered "Not now" once already. */
  dismissed: boolean;
  /** This page is already the installed app, not a browser tab. */
  standalone: boolean;
};

/** Whether the install affordance may be shown, given those three facts. */
export function shouldOfferInstall({ offered, dismissed, standalone }: InstallFacts): boolean {
  return offered && !dismissed && !standalone;
}

/**
 * Whether this page is running as the installed app.
 *
 * `display-mode: standalone` covers Android/desktop installs; iOS Safari keeps
 * its own `navigator.standalone` flag. Answering `false` outside a browser is
 * what keeps the server render and the first client render identical.
 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}
