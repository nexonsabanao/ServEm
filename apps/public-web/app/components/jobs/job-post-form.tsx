'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SERVICE_AREAS } from '@/lib/presentation';

/**
 * The customer's job-posting form.
 *
 * The rules that decide whether this job can exist — the category registry, the
 * coverage list, whole-peso budgets, a start before its own end — live in
 * `lib/jobs.ts` and are enforced by the API. This form repeats only the cheap
 * checks that improve typing; whatever the server answers is shown against the
 * field it names, so the two can never disagree about what is wrong.
 */
const ACCEPTED_MEDIA = 'image/jpeg,image/png,image/webp,image/gif,video/mp4';
const MAX_FILES = 6;

type PickedFile = { file: File; preview: string };

export function JobPostForm({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<PickedFile[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [pricingModel, setPricingModel] = useState<'fixed' | 'negotiable'>('fixed');
  const [budget, setBudget] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationBarangay, setLocationBarangay] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [preferredStart, setPreferredStart] = useState('');
  const [scheduleFlexible, setScheduleFlexible] = useState(true);
  const [publishNow, setPublishNow] = useState(true);

  /**
   * Keeps a local preview with the file, so the customer can see what they
   * attached and drop one before posting. Object URLs are revoked on removal and
   * on unmount, because they pin the file in memory until they are.
   */
  function pickFiles(selected: FileList | null) {
    const next = Array.from(selected ?? []).slice(0, MAX_FILES - files.length);
    if (next.length === 0) return;
    setError(null);
    setFiles((current) => [...current, ...next.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }

  function dropFile(preview: string) {
    URL.revokeObjectURL(preview);
    setFiles((current) => current.filter((entry) => entry.preview !== preview));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setErrors({});
    setProgress(null);
    try {
      const centavos = (value: string) => Math.round(Number(value) * 100);
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          title,
          description,
          categoryId,
          pricingModel,
          budgetCentavos: centavos(budget),
          ...(budgetMax ? { budgetMaxCentavos: centavos(budgetMax) } : {}),
          locationCity,
          ...(locationBarangay ? { locationBarangay } : {}),
          ...(locationNotes ? { locationNotes } : {}),
          ...(preferredStart ? { preferredStart: new Date(preferredStart).toISOString() } : {}),
          scheduleFlexible,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const body = isRecord(payload) ? payload : {};

      if (response.status === 401) {
        setError('Your session ended. Sign in again to post a job.');
        return;
      }
      if (!response.ok) {
        setErrors(isRecord(body.errors) ? (body.errors as Record<string, string>) : {});
        setError(typeof body.message === 'string' ? body.message : 'That job could not be posted.');
        return;
      }

      const job = isRecord(body.job) ? body.job : null;
      const jobId = job && typeof job.id === 'string' ? job.id : '';

      // Media is attached to the job that now exists, one file at a time so a
      // refusal names the file rather than failing the whole post. A job whose
      // photos did not all attach is deliberately *not* published: the customer
      // is taken to the job page to finish it, where the same controls live.
      let uploaded = 0;
      if (jobId && files.length > 0) {
        for (const [index, entry] of files.entries()) {
          setProgress(`Attaching ${entry.file.name} (${index + 1} of ${files.length})…`);
          try {
            const dataUrl = await readAsDataUrl(entry.file);
            const mediaResponse = await fetch(`/api/jobs/${jobId}/media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({ dataUrl }),
            });
            if (mediaResponse.ok) uploaded += 1;
          } catch {
            // Counted as a failure below; the draft keeps the description.
          }
        }
        setProgress(null);
      }

      const mediaPartial = jobId !== '' && uploaded < files.length;

      if (publishNow && jobId && !mediaPartial) {
        // A job only ever reaches ServMates by being published; if that call
        // fails the draft is still saved, and the job page can publish it.
        await fetch(`/api/jobs/${jobId}/publish`, { method: 'POST', cache: 'no-store' });
      }

      for (const entry of files) URL.revokeObjectURL(entry.preview);
      router.push(mediaPartial ? `/account/jobs/${jobId}?media=partial` : `/account/jobs/${jobId}`);
    } catch {
      setError('That job could not be posted. Check your connection and try again.');
    } finally {
      setProgress(null);
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
        <label className="job-label" htmlFor="job-title">
          What needs doing?
        </label>
        <input
          id="job-title"
          className="job-input"
          value={title}
          maxLength={160}
          placeholder="Deep clean a two-bedroom condo"
          aria-invalid={errors.title ? true : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />
        {errors.title && <p className="job-field-error">{errors.title}</p>}
      </div>

      <div className="job-field">
        <label className="job-label" htmlFor="job-description">
          Describe the work
        </label>
        <textarea
          id="job-description"
          className="job-input job-textarea"
          value={description}
          rows={5}
          maxLength={4000}
          placeholder="Which rooms, what is included, anything a ServMate should bring."
          aria-invalid={errors.description ? true : undefined}
          onChange={(event) => setDescription(event.target.value)}
        />
        {errors.description && <p className="job-field-error">{errors.description}</p>}
      </div>

      <div className="job-grid">
      <div className="job-field">
        <label className="job-label" htmlFor="job-media">
          Photos or videos
        </label>
        <input
          id="job-media"
          className="job-media-input"
          type="file"
          multiple
          accept={ACCEPTED_MEDIA}
          disabled={files.length >= MAX_FILES}
          onChange={(event) => {
            pickFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <p className="job-media-hint">
          {files.length >= MAX_FILES
            ? 'That is the maximum number of files. Remove one to add another.'
            : `Optional — up to ${MAX_FILES - files.length} files, 3 MB each (JPEG, PNG, WebP, GIF, MP4). Only you and matching ServMates can open them.`}
        </p>
        {files.length > 0 && (
          <ul className="job-media-grid" aria-label="Files you attached">
            {files.map((entry) => (
              <li key={entry.preview} className="job-media-item">
                <div className="job-media-frame">
                  {entry.file.type.startsWith('video/') ? (
                    <video src={entry.preview} controls preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.preview} alt={entry.file.name} />
                  )}
                  <button
                    type="button"
                    className="job-media-remove"
                    aria-label={`Remove ${entry.file.name}`}
                    onClick={() => dropFile(entry.preview)}
                  >
                    Remove
                  </button>
                </div>
                <p className="job-media-caption">{truncateName(entry.file.name)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="job-field">
        <label className="job-label" htmlFor="job-category">
          Category
        </label>
          <select
            id="job-category"
            className="job-input"
            value={categoryId}
            aria-invalid={errors.categoryId ? true : undefined}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Pick a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.categoryId && <p className="job-field-error">{errors.categoryId}</p>}
        </div>

        <div className="job-field">
          <label className="job-label" htmlFor="job-city">
            City or municipality
          </label>
          <select
            id="job-city"
            className="job-input"
            value={locationCity}
            aria-invalid={errors.locationCity ? true : undefined}
            onChange={(event) => setLocationCity(event.target.value)}
          >
            <option value="">Pick a city</option>
            {SERVICE_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
          {errors.locationCity && <p className="job-field-error">{errors.locationCity}</p>}
        </div>
      </div>

      <div className="job-field">
        <span className="job-label" id="job-pricing-label">
          Pricing
        </span>
        <div className="job-radio-row" role="radiogroup" aria-labelledby="job-pricing-label">
          <label className="job-radio">
            <input
              type="radio"
              name="pricingModel"
              checked={pricingModel === 'fixed'}
              onChange={() => setPricingModel('fixed')}
            />
            I know my budget
          </label>
          <label className="job-radio">
            <input
              type="radio"
              name="pricingModel"
              checked={pricingModel === 'negotiable'}
              onChange={() => setPricingModel('negotiable')}
            />
            Open to quotes
          </label>
        </div>
        {errors.pricingModel && <p className="job-field-error">{errors.pricingModel}</p>}
      </div>

      <div className="job-grid">
        <div className="job-field">
          <label className="job-label" htmlFor="job-budget">
            Budget (₱)
          </label>
          <input
            id="job-budget"
            className="job-input"
            inputMode="numeric"
            value={budget}
            placeholder="1800"
            aria-invalid={errors.budgetCentavos ? true : undefined}
            onChange={(event) => setBudget(event.target.value)}
          />
          {errors.budgetCentavos && <p className="job-field-error">{errors.budgetCentavos}</p>}
        </div>

        <div className="job-field">
          <label className="job-label" htmlFor="job-budget-max">
            Most you would pay (₱)
          </label>
          <input
            id="job-budget-max"
            className="job-input"
            inputMode="numeric"
            value={budgetMax}
            placeholder="Optional"
            onChange={(event) => setBudgetMax(event.target.value)}
          />
          {errors.budgetMaxCentavos && (
            <p className="job-field-error">{errors.budgetMaxCentavos}</p>
          )}
        </div>
      </div>

      <div className="job-grid">
        <div className="job-field">
          <label className="job-label" htmlFor="job-barangay">
            Barangay
          </label>
          <input
            id="job-barangay"
            className="job-input"
            value={locationBarangay}
            maxLength={80}
            placeholder="Molino IV"
            onChange={(event) => setLocationBarangay(event.target.value)}
          />
        </div>

        <div className="job-field">
          <label className="job-label" htmlFor="job-start">
            Preferred start
          </label>
          <input
            id="job-start"
            className="job-input"
            type="datetime-local"
            value={preferredStart}
            aria-invalid={errors.preferredStart ? true : undefined}
            onChange={(event) => setPreferredStart(event.target.value)}
          />
          {errors.preferredStart && <p className="job-field-error">{errors.preferredStart}</p>}
        </div>
      </div>

      <div className="job-field">
        <label className="job-label" htmlFor="job-notes">
          Access notes
        </label>
        <input
          id="job-notes"
          className="job-input"
          value={locationNotes}
          maxLength={500}
          placeholder="Gate code, unit number, where to park — shared only with matching ServMates."
          onChange={(event) => setLocationNotes(event.target.value)}
        />
        {errors.locationNotes && <p className="job-field-error">{errors.locationNotes}</p>}
      </div>

      <div className="job-checks">
        <label className="job-check">
          <input
            type="checkbox"
            checked={scheduleFlexible}
            onChange={(event) => setScheduleFlexible(event.target.checked)}
          />
          The timing is flexible
        </label>
        <label className="job-check">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(event) => setPublishNow(event.target.checked)}
          />
          Publish now so matching ServMates can offer
        </label>
      </div>

      <div className="job-actions">
        <button type="submit" className="button button-primary" disabled={pending}>
          {pending ? (progress ?? 'Posting…') : 'Post job'}
        </button>
      </div>

      {progress && (
        <p className="job-media-hint" role="status">
          {progress}
        </p>
      )}
    </form>
  );
}

/** A long filename is noise in a caption; the extension is what matters. */
function truncateName(name: string): string {
  return name.length <= 28 ? name : `${name.slice(0, 12)}…${name.slice(-10)}`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('unreadable'));
    reader.onerror = () => reject(new Error('unreadable'));
    reader.readAsDataURL(file);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
