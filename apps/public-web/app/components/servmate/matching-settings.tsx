'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SERVICE_AREAS } from '@/lib/presentation';

/**
 * The two facts job matching is actually decided on: categories and coverage.
 *
 * They are edited here rather than mixed into the profile text because they are
 * rules, not description — a change takes effect on the next discovery pass, and
 * offers already made under an old category are marked rather than silently
 * dropped. The lists come from the server's registry, so a category that no
 * longer exists cannot be selected by a stale page.
 */
export function MatchingSettings({
  categories,
  categoryIds,
  areas,
}: {
  categories: { id: string; name: string }[];
  categoryIds: string[];
  areas: string[];
}) {
  const router = useRouter();
  const [selectedCategories, setSelectedCategories] = useState(categoryIds);
  const [selectedAreas, setSelectedAreas] = useState(areas);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(value: string, list: string[], set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function save() {
    if (pending) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      for (const [path, body] of [
        ['/api/servmate/me/categories', { categoryIds: selectedCategories }],
        ['/api/servmate/me/coverage', { areas: selectedAreas }],
      ] as const) {
        const response = await fetch(path, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          const answer = isRecord(payload) ? payload : {};
          setError(
            typeof answer.message === 'string'
              ? answer.message
              : 'Those matching settings were not saved.',
          );
          return;
        }
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Those matching settings were not saved. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="job-form">
      {error && (
        <p className="job-form-error" role="alert">
          {error}
        </p>
      )}

      <fieldset className="job-field">
        <legend className="job-label">Which work do you take?</legend>
        <div className="set-checks">
          {categories.map((category) => (
            <label key={category.id} className="job-check">
              <input
                type="checkbox"
                checked={selectedCategories.includes(category.id)}
                onChange={() => toggle(category.id, selectedCategories, setSelectedCategories)}
              />
              {category.name}
            </label>
          ))}
        </div>
        {selectedCategories.length === 0 && (
          <p className="job-media-hint">
            No categories means no job matches you yet — the feed stays empty until you pick one.
          </p>
        )}
      </fieldset>

      <fieldset className="job-field">
        <legend className="job-label">Which areas do you cover?</legend>
        <div className="set-checks">
          {SERVICE_AREAS.map((area) => (
            <label key={area} className="job-check">
              <input
                type="checkbox"
                checked={selectedAreas.includes(area)}
                onChange={() => toggle(area, selectedAreas, setSelectedAreas)}
              />
              {area}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="job-actions">
        <button type="button" className="button button-primary" disabled={pending} onClick={save}>
          {pending ? 'Saving…' : 'Save matching settings'}
        </button>
        {saved && (
          <span className="job-media-hint" role="status">
            Saved. The private feed changes on the next load.
          </span>
        )}
      </div>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
