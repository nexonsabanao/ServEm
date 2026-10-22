'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AREA_CHOICES, TONE_SWATCHES, type CustomerProfile } from '@/lib/profile';
import { gradientStyle } from '@/lib/feed-data';
import { validateName } from '@/lib/validation';

/**
 * The customer's own profile: display name, area, a short line about the kind
 * of help they usually need, and an avatar tone.
 *
 * The letterhead on the left is a live preview of exactly what a ServMate sees
 * when a request arrives — the same fields, in the same order, with the same
 * avatar treatment the workbench queue uses. Editing on the right updates it
 * immediately, so nothing about the public half is a surprise.
 *
 * Saving posts the whole profile in one call and refreshes the server tree, so
 * the shell's avatar and this page move together.
 *
 * The account's address is deliberately not one of its props: an address is
 * shown in Settings, and a prop the editor never renders would still travel into
 * this page's payload.
 */
export function ProfileEditor({
  initialName,
  initialProfile,
}: {
  initialName: string;
  initialProfile: CustomerProfile;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [profile, setProfile] = useState<CustomerProfile>(initialProfile);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; message: string } | null>(null);

  const dirty =
    name.trim() !== initialName ||
    profile.area !== initialProfile.area ||
    profile.about !== initialProfile.about ||
    profile.tone !== initialProfile.tone;

  function set<K extends keyof CustomerProfile>(key: K, value: CustomerProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const nameError = validateName(name);
    if (nameError) {
      setStatus({ tone: 'error', message: nameError });
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name, ...profile }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

      if (response.status === 401) {
        setStatus({ tone: 'error', message: 'Your session ended. Sign in again to save this.' });
        return;
      }
      if (!response.ok) {
        const fields = body.errors && typeof body.errors === 'object' ? (body.errors as Record<string, unknown>) : {};
        const first = Object.values(fields).find((value): value is string => typeof value === 'string');
        setStatus({
          tone: 'error',
          message: first ?? (typeof body.message === 'string' ? body.message : 'Your profile could not be saved.'),
        });
        return;
      }

      setStatus({ tone: 'ok', message: 'Profile saved.' });
      router.refresh();
    } catch {
      setStatus({ tone: 'error', message: 'Your profile could not be saved. Check your connection and try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="prof-editor" onSubmit={submit}>
      <div className="prof-fields">
        <div className="prof-field">
          <label className="prof-label" htmlFor="prof-name">Display name</label>
          <input
            id="prof-name"
            className="prof-input"
            value={name}
            maxLength={80}
            autoComplete="name"
            aria-describedby="prof-name-note"
            onChange={(event) => {
              setName(event.target.value);
              setStatus(null);
            }}
          />
          <span className="prof-note" id="prof-name-note">
            Shown to ServMates on your requests and in messages.
          </span>
        </div>

        <div className="prof-field">
          <label className="prof-label" htmlFor="prof-area">Your area</label>
          <select
            id="prof-area"
            className="prof-select"
            value={profile.area}
            onChange={(event) => set('area', event.target.value)}
          >
            {AREA_CHOICES.map((area) => (
              <option key={area || 'unset'} value={area}>
                {area || 'Not set'}
              </option>
            ))}
          </select>
          <span className="prof-note">
            Used to check a job is within reach — your street address is never shared.
          </span>
        </div>

        <div className="prof-field">
          <label className="prof-label" htmlFor="prof-about">About you</label>
          <textarea
            id="prof-about"
            className="prof-textarea"
            value={profile.about}
            maxLength={240}
            rows={3}
            placeholder="For example: two-bedroom condo, fortnightly deep cleans."
            onChange={(event) => set('about', event.target.value)}
          />
          <span className="prof-note prof-count">
            {Array.from(profile.about).length}/240 · optional
          </span>
        </div>

        <fieldset className="prof-field prof-tones">
          <legend className="prof-label">Avatar colour</legend>
          <div className="prof-tone-row">
            {Object.entries(TONE_SWATCHES).map(([key, gradient]) => (
              <button
                key={key}
                type="button"
                className="prof-tone"
                aria-pressed={profile.tone === key}
                aria-label={`Avatar colour ${key}`}
                style={gradientStyle(gradient)}
                onClick={() => set('tone', key)}
              >
                <span aria-hidden="true">{initialFor(name)}</span>
              </button>
            ))}
          </div>
          <span className="prof-note">
            A colour rather than a photo — no profile pictures are stored yet.
          </span>
        </fieldset>
      </div>

      <div className="prof-actions">
        <button type="submit" className="set-save" disabled={pending || !dirty}>
          {pending ? 'Saving…' : 'Save profile'}
        </button>
        {status && (
          <p className="set-status" data-tone={status.tone} role={status.tone === 'error' ? 'alert' : 'status'}>
            {status.message}
          </p>
        )}
        {!status && !dirty && (
          <p className="prof-hint">This is what ServMates will see.</p>
        )}
      </div>
    </form>
  );
}

function initialFor(value: string): string {
  const first = Array.from(value.trim())[0];
  return first ? first.toLocaleUpperCase() : 'S';
}
