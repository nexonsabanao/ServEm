'use client';

import { useEffect, useState } from 'react';
import {
  clearPreviewState,
  clearSavedServices,
  deviceStorageCounts,
  writeInstallDismissed,
  type DeviceStorageCounts,
} from '@/lib/device-store';

/**
 * The things ServEm keeps in this browser rather than on the account:
 * bookmarked services, the ServMate workbench's preview decisions, and whether
 * this device already turned down the install offer. Each is listed with what it
 * holds, and can be cleared here.
 *
 * Every number here — including whether anything is stored at all — comes from
 * `lib/device-store`, the same module the screens that put those rows in
 * storage write through. This panel used to re-parse their JSON itself, so a
 * change to the shape could leave this screen's claim true while the browser
 * held something else; now the claim and the data cannot disagree.
 *
 * Counts are read after mount, so the server-rendered markup and the first
 * client render always agree.
 */
export function DeviceDataPanel() {
  const [counts, setCounts] = useState<DeviceStorageCounts | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  function read() {
    setCounts(deviceStorageCounts());
    setReady(true);
  }

  useEffect(read, []);

  function clearSaved() {
    if (!clearSavedServices()) {
      setMessage('This browser would not let ServEm clear saved services.');
      return;
    }
    read();
    setMessage('Saved services cleared from this browser.');
  }

  function clearPreview() {
    if (!clearPreviewState()) {
      setMessage('This browser would not let ServEm clear workbench preview.');
      return;
    }
    read();
    setMessage('Workbench preview cleared from this browser.');
  }

  function offerAgain() {
    if (!writeInstallDismissed(false)) {
      setMessage('This browser would not let ServEm change the install offer.');
      return;
    }
    read();
    setMessage('ServEm will offer to install again on the next page that can offer it.');
  }

  const saved = counts?.savedServices ?? 0;
  const decisions = counts?.previewDecisions ?? 0;
  const drafts = counts?.previewProfiles ?? 0;
  const dismissed = counts?.installDismissed ?? false;
  const nothingStored =
    ready && saved === 0 && decisions === 0 && drafts === 0 && !dismissed;

  return (
    <div className="set-rows">
      <div className="set-row">
        <div className="set-row-copy">
          <span className="set-row-label">Saved services</span>
          <span className="set-row-note">
            Bookmarks held in this browser — {ready ? `${saved} saved` : 'Checking…'}.
          </span>
        </div>
        <div className="set-row-control">
          <button
            type="button"
            className="set-secondary"
            disabled={!ready || saved === 0}
            onClick={clearSaved}
          >
            Clear saved services
          </button>
        </div>
      </div>

      <div className="set-row">
        <div className="set-row-copy">
          <span className="set-row-label">ServMate workbench preview</span>
          <span className="set-row-note">
            Workbench decisions and profile edits, held in this browser —{' '}
            {ready
              ? `${decisions} decided · ${drafts} profile${drafts === 1 ? '' : 's'} edited`
              : 'Checking…'}
            .
          </span>
        </div>
        <div className="set-row-control">
          <button
            type="button"
            className="set-secondary"
            disabled={!ready || (decisions === 0 && drafts === 0)}
            onClick={clearPreview}
          >
            Reset workbench preview
          </button>
        </div>
      </div>

      <div className="set-row">
        <div className="set-row-copy">
          <span className="set-row-label">Install offer</span>
          <span className="set-row-note">
            The install offer in this browser —{' '}
            {ready
              ? dismissed
                ? 'turned down here.'
                : 'not turned down here.'
              : 'Checking…'}
          </span>
        </div>
        <div className="set-row-control">
          <button
            type="button"
            className="set-secondary"
            disabled={!ready || !dismissed}
            onClick={offerAgain}
          >
            Offer again
          </button>
        </div>
      </div>

      <div className="set-row">
        <div className="set-row-copy">
          <span className="set-row-label">This browser</span>
          <span className="set-row-note">
            {nothingStored
              ? 'Nothing else is stored here beyond your sign-in cookie.'
              : 'The sign-in cookie is separate from the items above and clears on sign out.'}
          </span>
        </div>
        <div className="set-row-control">
          {message && <p className="set-status" data-tone="ok" role="status">{message}</p>}
        </div>
      </div>
    </div>
  );
}
