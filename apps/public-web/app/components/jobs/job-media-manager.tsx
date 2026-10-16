'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { JobMedia } from '@/lib/media';

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif,video/mp4';

/**
 * The customer's own view of a job's media: attach, preview, remove.
 *
 * Files are read in the browser and posted one at a time, so a refusal names the
 * file that failed instead of silently dropping it, and the remaining files
 * still upload. Nothing here decides whether the file is acceptable — the server
 * checks the type by signature and the size for real; this only reports what it
 * answers.
 */
export function JobMediaManager({
  jobId,
  media,
  editable,
  maxFiles,
}: {
  jobId: string;
  media: JobMedia[];
  editable: boolean;
  maxFiles: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(maxFiles - media.length, 0);

  async function upload(files: File[]) {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    const failed: string[] = [];

    try {
      for (const [index, file] of files.entries()) {
        setStatus(`Attaching ${file.name} (${index + 1} of ${files.length})…`);
        try {
          const dataUrl = await readAsDataUrl(file);
          const response = await fetch(`/api/jobs/${jobId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ dataUrl }),
          });
          const payload: unknown = await response.json().catch(() => null);
          const body = isRecord(payload) ? payload : {};
          const fieldError = isRecord(body.errors) ? body.errors.file : undefined;
          if (!response.ok) {
            failed.push(
              `${file.name} — ${typeof fieldError === 'string' ? fieldError : typeof body.message === 'string' ? body.message : 'could not be attached'}`,
            );
          }
        } catch {
          failed.push(`${file.name} — could not be attached`);
        }
      }

      if (failed.length > 0) setError(failed.join(' · '));
      router.refresh();
    } finally {
      setStatus(null);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove(assetId: string, label: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus(`Removing ${label}…`);
    try {
      const response = await fetch(`/api/jobs/${jobId}/media/${assetId}`, {
        method: 'DELETE',
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const body = isRecord(payload) ? payload : {};
        setError(typeof body.message === 'string' ? body.message : 'That file could not be removed.');
      }
      router.refresh();
    } catch {
      setError('That file could not be removed. Check your connection and try again.');
    } finally {
      setStatus(null);
      setBusy(false);
    }
  }

  return (
    <div className="job-media">
      {media.length > 0 && (
        <ul className="job-media-grid" aria-label="Photos and videos on this job">
          {media.map((item) => (
            <li key={item.id} className="job-media-item">
              <div className="job-media-frame">
                {item.mediaType === 'video' ? (
                  <video src={item.url} controls preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.caption ?? 'Job photo'} loading="lazy" />
                )}
                {editable && (
                  <button
                    type="button"
                    className="job-media-remove"
                    disabled={busy}
                    aria-label={`Remove ${item.caption ?? item.mediaType}`}
                    onClick={() => remove(item.assetId, item.caption ?? item.mediaType)}
                  >
                    Remove
                  </button>
                )}
              </div>
              {item.caption && <p className="job-media-caption">{item.caption}</p>}
            </li>
          ))}
        </ul>
      )}

      {media.length === 0 && !editable && (
        <p className="job-media-hint">No photos or videos were attached to this job.</p>
      )}

      {editable && (
        <div className="job-media-upload">
          <label className="job-label" htmlFor="job-media-add">
            Add photos or videos
          </label>
          <input
            ref={inputRef}
            id="job-media-add"
            className="job-media-input"
            type="file"
            multiple
            accept={ACCEPTED}
            disabled={busy || remaining === 0}
            onChange={(event) => upload(Array.from(event.target.files ?? []).slice(0, remaining))}
          />
          <p className="job-media-hint">
            {remaining === 0
              ? `This job already has its maximum of ${maxFiles} files.`
              : `Up to ${remaining} more, 3 MB each. JPEG, PNG, WebP, GIF or MP4. Only you and matching ServMates can open them.`}
          </p>
        </div>
      )}

      {status && (
        <p className="job-media-hint" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="job-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
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
