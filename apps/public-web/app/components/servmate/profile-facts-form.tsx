'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SERVICE_AREAS } from '@/lib/presentation';

/**
 * The facts a ServMate states about themselves (§5.2).
 *
 * Everything here is self-declared, and the page says so: nothing in this form
 * can set verification status, because a provider must not be able to assert
 * that their own credentials were checked. Saving sends only the fields the form
 * owns, so an edit here can never blank a part of the profile it does not show.
 */
export function ProfileFactsForm({
  headline,
  bio,
  experience,
  serviceArea,
  responseMins,
}: {
  headline: string;
  bio: string;
  experience: string;
  serviceArea: string;
  responseMins: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    headline,
    bio,
    experience,
    serviceAreaLabel: serviceArea,
    responseMins: String(responseMins),
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setErrors({});
    setSaved(false);
    try {
      const response = await fetch('/api/servmate/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          headline: values.headline,
          bio: values.bio,
          experience: values.experience,
          serviceAreaLabel: values.serviceAreaLabel,
          responseMins: values.responseMins === '' ? undefined : Number(values.responseMins),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};
      if (!response.ok) {
        setErrors(isRecord(body.errors) ? (body.errors as Record<string, string>) : {});
        setError(typeof body.message === 'string' ? body.message : 'Those details were not saved.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Those details were not saved. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="job-form" onSubmit={submit} noValidate>
      {error && (
        <p className="job-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="job-field">
        <label className="job-label" htmlFor="sv-headline">
          Headline
        </label>
        <input
          id="sv-headline"
          className="job-input"
          maxLength={90}
          value={values.headline}
          placeholder="Eco deep-cleaning for condos & townhouses"
          aria-invalid={errors.headline ? true : undefined}
          onChange={(event) => setValues({ ...values, headline: event.target.value })}
        />
        {errors.headline && <p className="job-field-error">{errors.headline}</p>}
      </div>

      <div className="job-field">
        <label className="job-label" htmlFor="sv-bio">
          About your work
        </label>
        <textarea
          id="sv-bio"
          className="job-input job-textarea"
          rows={4}
          maxLength={600}
          value={values.bio}
          placeholder="What you do, how you work, what you bring."
          aria-invalid={errors.bio ? true : undefined}
          onChange={(event) => setValues({ ...values, bio: event.target.value })}
        />
        {errors.bio && <p className="job-field-error">{errors.bio}</p>}
      </div>

      <div className="job-field">
        <label className="job-label" htmlFor="sv-experience">
          Experience
        </label>
        <textarea
          id="sv-experience"
          className="job-input job-textarea"
          rows={3}
          maxLength={600}
          value={values.experience}
          placeholder="Years doing this, training, notable jobs."
          aria-invalid={errors.experience ? true : undefined}
          onChange={(event) => setValues({ ...values, experience: event.target.value })}
        />
        {errors.experience && <p className="job-field-error">{errors.experience}</p>}
      </div>

      <div className="job-grid">
        <div className="job-field">
          <label className="job-label" htmlFor="sv-area">
            Home area
          </label>
          <select
            id="sv-area"
            className="job-input"
            value={values.serviceAreaLabel}
            onChange={(event) => setValues({ ...values, serviceAreaLabel: event.target.value })}
          >
            <option value="">Not stated</option>
            {SERVICE_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
          {errors.serviceAreaLabel && <p className="job-field-error">{errors.serviceAreaLabel}</p>}
        </div>

        <div className="job-field">
          <label className="job-label" htmlFor="sv-response">
            Replies in (minutes)
          </label>
          <input
            id="sv-response"
            className="job-input"
            inputMode="numeric"
            value={values.responseMins}
            placeholder="15"
            aria-invalid={errors.responseMins ? true : undefined}
            onChange={(event) => setValues({ ...values, responseMins: event.target.value })}
          />
          {errors.responseMins && <p className="job-field-error">{errors.responseMins}</p>}
        </div>
      </div>

      <div className="job-actions">
        <button type="submit" className="button button-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </button>
        {saved && (
          <span className="job-media-hint" role="status">
            Saved. Your public page shows this now.
          </span>
        )}
      </div>
    </form>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
