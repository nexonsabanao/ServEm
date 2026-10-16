'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SERVICE_AREAS } from '@/lib/presentation';

/**
 * Becoming a ServMate, in the three facts the marketplace actually matches on.
 *
 * Enabling capability and picking categories/areas are three separate calls
 * because they are three separate decisions — a profile may exist before it has
 * any category, and a category before any coverage. All of them are recorded
 * server-side; nothing here decides eligibility, it only collects it.
 */
export function ServmateSetup({
  categories,
  initial,
}: {
  categories: { id: string; name: string }[];
  initial?: { headline?: string; bio?: string; experience?: string; categoryIds?: string[]; areas?: string[] };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headline, setHeadline] = useState(initial?.headline ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [experience, setExperience] = useState(initial?.experience ?? '');
  const [selected, setSelected] = useState<string[]>(initial?.categoryIds ?? []);
  const [areas, setAreas] = useState<string[]>(initial?.areas ?? []);

  function toggle(value: string, list: string[], set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    try {
      const onboard = await fetch('/api/servmate/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ headline, bio, experience }),
      });
      if (!onboard.ok) {
        const payload: unknown = await onboard.json().catch(() => null);
        setError(readMessage(payload, 'Your ServMate profile could not be saved.'));
        return;
      }

      const categoryResult = await fetch('/api/servmate/me/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ categoryIds: selected }),
      });
      if (!categoryResult.ok) {
        const payload: unknown = await categoryResult.json().catch(() => null);
        setError(readMessage(payload, 'Those categories could not be saved.'));
        return;
      }

      const coverageResult = await fetch('/api/servmate/me/coverage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ areas }),
      });
      if (!coverageResult.ok) {
        const payload: unknown = await coverageResult.json().catch(() => null);
        setError(readMessage(payload, 'Those areas could not be saved.'));
        return;
      }

      router.refresh();
    } catch {
      setError('Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="job-form" onSubmit={submit} noValidate>
      <div className="job-field">
        <label className="job-label" htmlFor="sm-headline">
          What you do
        </label>
        <input
          id="sm-headline"
          className="job-input"
          value={headline}
          maxLength={90}
          placeholder="Home cleaning, deep cleans, move-out tidy-ups"
          onChange={(event) => setHeadline(event.target.value)}
        />
      </div>

      <div className="job-field">
        <label className="job-label" htmlFor="sm-bio">
          About your work
        </label>
        <textarea
          id="sm-bio"
          className="job-input job-textarea"
          rows={4}
          maxLength={600}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
      </div>

      <div className="job-field">
        <label className="job-label" htmlFor="sm-experience">
          Experience
        </label>
        <textarea
          id="sm-experience"
          className="job-input job-textarea"
          rows={3}
          maxLength={600}
          value={experience}
          onChange={(event) => setExperience(event.target.value)}
        />
      </div>

      <fieldset className="job-field">
        <legend className="job-label">Which work do you take?</legend>
        <div className="job-checks">
          {categories.map((category) => (
            <label key={category.id} className="job-check">
              <input
                type="checkbox"
                checked={selected.includes(category.id)}
                onChange={() => toggle(category.id, selected, setSelected)}
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="job-field">
        <legend className="job-label">Which areas do you cover?</legend>
        <div className="job-checks">
          {SERVICE_AREAS.map((area) => (
            <label key={area} className="job-check">
              <input
                type="checkbox"
                checked={areas.includes(area)}
                onChange={() => toggle(area, areas, setAreas)}
              />
              {area}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="job-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="job-actions">
        <button type="submit" className="button button-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}

function readMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const body = payload as Record<string, unknown>;
    if (typeof body.message === 'string') return body.message;
  }
  return fallback;
}
