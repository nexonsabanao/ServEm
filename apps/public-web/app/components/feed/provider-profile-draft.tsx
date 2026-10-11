'use client';

import { useEffect, useState } from 'react';
import { parsePreviewState, SERVEMATE_PREVIEW_KEY } from '@/lib/servmate';

/**
 * The public profile text for one ServMate, overlaid with this device's draft.
 *
 * The roster data arrives from the server and renders first, so the markup is
 * identical on both sides of the first paint. The draft is read from local
 * storage after mount — the same treatment the settings page gives saved
 * services — so a customer who has never edited a profile sees exactly the
 * published sample, and a ServMate previewing their own page sees their edits
 * with a note saying they are not published yet.
 */
export function ProviderProfileDraft({
  providerId,
  headline,
  about,
  areas,
}: {
  providerId: string;
  headline: string;
  about: string;
  areas: string;
}) {
  const [draft, setDraft] = useState<{ headline: string; about: string; areas: string[] } | null>(null);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(SERVEMATE_PREVIEW_KEY) ?? 'null');
      const entry = parsePreviewState(stored).profiles[providerId];
      if (entry && (entry.headline || entry.about || entry.areas.length > 0)) {
        setDraft({ headline: entry.headline, about: entry.about, areas: entry.areas });
      }
    } catch {
      // The published roster stays in place when storage is unavailable.
    }
  }, [providerId]);

  const shownHeadline = draft?.headline.trim() || headline;
  const shownAbout = draft?.about.trim() || about;
  const shownAreas = draft && draft.areas.length > 0 ? draft.areas.join(' · ') : areas;

  return (
    <>
      <p className="pv-headline">{shownHeadline}</p>
      {shownAbout ? <p className="pv-about">{shownAbout}</p> : null}
      {draft && (
        <p className="pv-draft-note">
          Editing your profile here shows it on this device only. Publishing to other customers
          needs a provider API.
        </p>
      )}
      <span className="visually-hidden">{shownAreas}</span>
    </>
  );
}
