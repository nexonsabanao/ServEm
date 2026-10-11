'use client';

import { useEffect, useState } from 'react';

const SAVED_SERVICES_KEY = 'servem:saved-services';
const SERVEMATE_PREVIEW_KEY = 'servem:servmate-preview';

/**
 * The two things ServEm keeps in this browser rather than on the account:
 * bookmarked services and the ServMate workbench's preview decisions. Both are
 * listed with what they hold, and can be cleared here.
 *
 * Counts are read after mount, so the server-rendered markup and the first
 * client render always agree.
 */
export function DeviceDataPanel() {
  const [saved, setSaved] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  function read() {
    try {
      const savedRaw: unknown = JSON.parse(window.localStorage.getItem(SAVED_SERVICES_KEY) ?? '[]');
      const previewRaw: unknown = JSON.parse(window.localStorage.getItem(SERVEMATE_PREVIEW_KEY) ?? 'null');
      setSaved(Array.isArray(savedRaw) ? savedRaw.length : 0);
      const stored =
        previewRaw && typeof previewRaw === 'object' && !Array.isArray(previewRaw)
          ? (previewRaw as Record<string, unknown>)
          : null;
      const decisionList = stored?.decisions;
      setDecisions(
        decisionList && typeof decisionList === 'object' && !Array.isArray(decisionList)
          ? Object.keys(decisionList).length
          : 0,
      );
      const profileList = stored?.profiles;
      setDrafts(
        profileList && typeof profileList === 'object' && !Array.isArray(profileList)
          ? Object.keys(profileList).length
          : 0,
      );
    } catch {
      setSaved(0);
      setDecisions(0);
      setDrafts(0);
    } finally {
      setReady(true);
    }
  }

  useEffect(read, []);

  function clear(key: string, what: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      setMessage(`This browser would not let ServEm clear ${what}.`);
      return;
    }
    read();
    setMessage(`${what[0].toLocaleUpperCase()}${what.slice(1)} cleared from this browser.`);
  }

  const nothingStored = ready && saved === 0 && decisions === 0 && drafts === 0;

  return (
    <div className="set-rows">
      <div className="set-row">
        <div className="set-row-copy">
          <span className="set-row-label">Saved services</span>
          <span className="set-row-note">
            Bookmarks kept in this browser. {ready ? `${saved ?? 0} saved` : 'Checking…'}.
          </span>
        </div>
        <div className="set-row-control">
          <button
            type="button"
            className="set-secondary"
            disabled={!ready || saved === 0}
            onClick={() => clear(SAVED_SERVICES_KEY, 'saved services')}
          >
            Clear saved services
          </button>
        </div>
      </div>

      <div className="set-row">
        <div className="set-row-copy">
          <span className="set-row-label">ServMate workbench preview</span>
          <span className="set-row-note">
            Accept and Decline decisions, plus any profile edits you made in the workbench, are
            held in this browser.{' '}
            {ready
              ? `${decisions ?? 0} decided · ${drafts ?? 0} profile${(drafts ?? 0) === 1 ? '' : 's'} edited`
              : 'Checking…'}
            .
          </span>
        </div>
        <div className="set-row-control">
          <button
            type="button"
            className="set-secondary"
            disabled={!ready || ((decisions ?? 0) === 0 && (drafts ?? 0) === 0)}
            onClick={() => clear(SERVEMATE_PREVIEW_KEY, 'workbench preview')}
          >
            Reset workbench preview
          </button>
        </div>
      </div>

      <div className="set-row">
        <div className="set-row-copy">
          <span className="set-row-label">This browser</span>
          <span className="set-row-note">
            {nothingStored
              ? 'Nothing from ServEm is stored here beyond your sign-in cookie.'
              : 'Your sign-in cookie is separate from the items above and clears when you sign out.'}
          </span>
        </div>
        <div className="set-row-control">
          {message && <p className="set-status" data-tone="ok" role="status">{message}</p>}
        </div>
      </div>
    </div>
  );
}
