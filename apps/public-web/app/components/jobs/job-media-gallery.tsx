import type { JobMedia } from '@/lib/media';

/**
 * The photos and videos on a job, for a caller already entitled to them.
 *
 * Every `src` points at the authorization-checked delivery route, never at a
 * storage path, so this component cannot be the reason a private file leaks:
 * the browser is told where to ask, and the route decides again (§6.4).
 */
export function JobMediaGallery({
  media,
  label = 'Job photos and videos',
}: {
  media: JobMedia[];
  label?: string;
}) {
  if (media.length === 0) return null;

  return (
    <ul className="job-media-grid" aria-label={label}>
      {media.map((item) => (
        <li key={item.id} className="job-media-item">
          <div className="job-media-frame">
            {item.mediaType === 'video' ? (
              <video src={item.url} controls preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt={item.caption ?? 'Job photo'} loading="lazy" />
            )}
          </div>
          {item.caption && <p className="job-media-caption">{item.caption}</p>}
        </li>
      ))}
    </ul>
  );
}
