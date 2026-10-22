import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * The install affordance's rule, and the switch that silences it.
 *
 * The browser half — that the strip appears on a real `beforeinstallprompt`,
 * disappears on "Not now" and stays gone across a reload — is checked live in
 * the preview (and is what `app/components/install-prompt.tsx` exists for). What
 * this file pins down is the decision itself, because "never in a browser or
 * context that cannot install" is a claim about facts, not about markup:
 *
 *  - nothing offered by the browser (Safari, an in-app browser, an installed
 *    app) must render nothing, whatever else is true;
 *  - a device that answered "Not now" must stay answered;
 *  - a page already running as the installed app must not offer to install
 *    itself;
 *  - outside a browser the stand-alone check answers `false`, so the server
 *    render and the first client render agree.
 */

const { isStandaloneDisplay, shouldOfferInstall } = await import('../lib/install.ts');
const { readInstallDismissed, writeInstallDismissed, deviceStorageCounts } = await import(
  '../lib/device-store.ts'
);

test('the offer needs all three facts to line up', () => {
  assert.equal(shouldOfferInstall({ offered: true, dismissed: false, standalone: false }), true);
  assert.equal(shouldOfferInstall({ offered: false, dismissed: false, standalone: false }), false);
  assert.equal(shouldOfferInstall({ offered: true, dismissed: true, standalone: false }), false);
  assert.equal(shouldOfferInstall({ offered: true, dismissed: false, standalone: true }), false);
});

test('outside a browser there is no installed app and no stored answer', () => {
  assert.equal(isStandaloneDisplay(), false);
  assert.equal(readInstallDismissed(), false);
  // Best-effort by contract: a write without storage answers "no" rather than
  // throwing, and nothing is remembered.
  assert.equal(writeInstallDismissed(true), false);
  assert.equal(deviceStorageCounts().installDismissed, false);
});
