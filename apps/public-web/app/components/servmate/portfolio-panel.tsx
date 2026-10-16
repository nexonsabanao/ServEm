'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The ServMate's portfolio and work updates (§5.3, §5.7).
 *
 * The two ways to add work are visibly different, because they mean different
 * things: an item you write about yourself is marked as self-published, and an
 * item built from a completed booking is marked as verified work. The verified
 * option only appears for bookings the platform actually saw finish, and the
 * server checks that claim again — a profile cannot promote its own work.
 */
export type PortfolioEntry = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  source: 'self_published' | 'completed_booking';
};

export type PostEntry = { id: string; body: string; imageUrl?: string };

export function PortfolioPanel({
  items,
  posts,
  completedWork,
}: {
  items: PortfolioEntry[];
  posts: PostEntry[];
  completedWork: { bookingId: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [post, setPost] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);

  async function send(path: string, method: string, body?: Record<string, unknown>) {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(path, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);
      const answer = isRecord(payload) ? payload : {};
      if (!response.ok) {
        const fieldErrors = isRecord(answer.errors) ? Object.values(answer.errors) : [];
        setError(
          typeof fieldErrors[0] === 'string'
            ? fieldErrors[0]
            : typeof answer.message === 'string'
              ? answer.message
              : 'That did not go through.',
        );
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('That did not go through. Check your connection and try again.');
      return false;
    } finally {
      setPending(false);
    }
  }

  async function readImage(file: File | undefined): Promise<string | null> {
    if (!file) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="portfolio-panel">
      {error && (
        <p className="job-form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="job-media-hint" role="status">
          {notice}
        </p>
      )}

      <h3 className="set-row-label">Work examples</h3>
      {items.length > 0 ? (
        <ul className="job-media-grid">
          {items.map((item) => (
            <li key={item.id} className="job-media-item">
              {item.imageUrl && (
                <div className="job-media-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.title} loading="lazy" />
                </div>
              )}
              <span className="order-ref">
                {item.source === 'completed_booking' ? 'Verified job' : 'Self-published'}
              </span>
              <p className="job-media-caption">{item.title}</p>
              <button
                type="button"
                className="quiet-button"
                disabled={pending}
                onClick={() => send(`/api/servmate/me/portfolio/${item.id}`, 'DELETE')}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="job-media-hint">Nothing in your portfolio yet.</p>
      )}

      <form
        className="job-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await send('/api/servmate/me/portfolio', 'POST', {
            title,
            ...(description ? { description } : {}),
            ...(image ? { dataUrl: image } : {}),
            ...(bookingId ? { bookingId } : {}),
          });
          if (ok) {
            setTitle('');
            setDescription('');
            setImage(null);
            setBookingId('');
            setNotice('Added to your portfolio.');
          }
        }}
      >
        <div className="job-field">
          <label className="job-label" htmlFor="pf-title">
            Add a work example
          </label>
          <input
            id="pf-title"
            className="job-input"
            required
            maxLength={120}
            value={title}
            placeholder="Two-bedroom deep clean, Bacoor"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="job-field">
          <label className="job-label" htmlFor="pf-description">
            What the work was
          </label>
          <textarea
            id="pf-description"
            className="job-input job-textarea"
            rows={2}
            maxLength={600}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="job-field">
          <label className="job-label" htmlFor="pf-image">
            Photo (optional)
          </label>
          <input
            id="pf-image"
            className="job-media-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={async (event) => setImage(await readImage(event.target.files?.[0]))}
          />
        </div>
        {completedWork.length > 0 && (
          <div className="job-field">
            <label className="job-label" htmlFor="pf-booking">
              Link a completed booking (optional)
            </label>
            <select
              id="pf-booking"
              className="job-input"
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
            >
              <option value="">Self-published work</option>
              {completedWork.map((entry) => (
                <option key={entry.bookingId} value={entry.bookingId}>
                  {entry.label}
                </option>
              ))}
            </select>
            <p className="job-media-hint">
              Linked work is labelled as a verified job on your profile; anything else is clearly
              marked as something you posted yourself.
            </p>
          </div>
        )}
        <div className="job-actions">
          <button type="submit" className="quiet-button" disabled={pending}>
            {pending ? 'Adding…' : 'Add to portfolio'}
          </button>
        </div>
      </form>

      <h3 className="set-row-label">Work updates</h3>
      {posts.length > 0 ? (
        <ul className="order-list">
          {posts.map((entry) => (
            <li key={entry.id} className="order-row">
              <div className="order-what">
                <p className="order-brief">{entry.body}</p>
                {entry.imageUrl && (
                  <div className="job-media-frame job-media-frame-wide">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={entry.imageUrl} alt="" loading="lazy" />
                  </div>
                )}
              </div>
              <div className="order-state">
                <button
                  type="button"
                  className="quiet-button"
                  disabled={pending}
                  onClick={() => send(`/api/servmate/me/posts/${entry.id}`, 'DELETE')}
                >
                  Withdraw
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="job-media-hint">No updates posted yet.</p>
      )}

      <form
        className="job-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await send('/api/servmate/me/posts', 'POST', {
            body: post,
            ...(postImage ? { dataUrl: postImage } : {}),
          });
          if (ok) {
            setPost('');
            setPostImage(null);
            setNotice('Update posted.');
          }
        }}
      >
        <div className="job-field">
          <label className="job-label" htmlFor="pf-post">
            Post an update
          </label>
          <textarea
            id="pf-post"
            className="job-input job-textarea"
            rows={2}
            maxLength={600}
            required
            value={post}
            placeholder="Finished a move-out clean in Molino today — three hours, one team."
            onChange={(event) => setPost(event.target.value)}
          />
        </div>
        <div className="job-field">
          <label className="job-label" htmlFor="pf-post-image">
            Photo (optional)
          </label>
          <input
            id="pf-post-image"
            className="job-media-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={async (event) => setPostImage(await readImage(event.target.files?.[0]))}
          />
        </div>
        <div className="job-actions">
          <button type="submit" className="quiet-button" disabled={pending}>
            {pending ? 'Posting…' : 'Post update'}
          </button>
        </div>
      </form>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
