import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRightIcon, LocationIcon } from '@/app/components/icons';
import { PublicShell } from '@/app/components/feed/public-shell';
import { RelatedServices } from '@/app/components/feed/related-services';
import { ServiceRequest } from '@/app/components/feed/service-request';
import { ServiceThumb, StarRating, VerifiedMark } from '@/app/components/feed/service-card';
import { getSessionAccount } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';
import { formatDay, formatFromPrice, formatReplies } from '@/lib/format';
import { firstLetter } from '@/lib/presentation';
import { getServmateReviewViews } from '@/lib/reviews';
import { getServiceDetail } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

type Params = Promise<{ serviceId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { serviceId } = await params;
  const detail = await getServiceDetail(serviceId);
  return {
    title: detail ? `${detail.service.title} — ServEm` : 'Service — ServEm',
  };
}

/**
 * One service, as its own page.
 *
 * A card in a grid carries six facts, which is enough to decide what to look at
 * and not enough to decide what to buy. This is the rest of it: the listing's own
 * description, the ServMate behind it, what customers said, and — underneath —
 * the alternatives, ranked by category and area. It is a shop page, not a
 * checkout: the only action is still a request, and payment still happens after
 * the work.
 *
 * It sits outside `(app)` on purpose. The signed-in layout is where the session
 * guard lives, and a product page has to work for the visitor who has not signed
 * in yet — that is the exact person the storefront is for. `PublicShell` renders
 * the same frame with whatever session there is, so the page works either way
 * without a second auth dialog or a second navigation.
 */
export default async function ServicePage({ params }: { params: Params }) {
  const { serviceId } = await params;
  const [account, detail] = await Promise.all([getSessionAccount(), getServiceDetail(serviceId)]);
  if (!detail) notFound();

  const [bookings, reviews] = await Promise.all([
    account ? listBookings(account.id) : Promise.resolve([]),
    getServmateReviewViews(detail.provider.id),
  ]);

  const { service, provider, description, related } = detail;
  const signedOut = account === null;
  const shown = reviews.slice(0, 3);

  return (
    <PublicShell
      account={account ? { name: account.name } : null}
      requestCount={summariseBookings(bookings).total}
    >
      <div className="sd">
        <nav className="pv-crumb" aria-label="Breadcrumb">
          <Link href={signedOut ? '/' : '/home'}>Home</Link>
          <span aria-hidden="true"><ChevronRightIcon /></span>
          <span>{service.category}</span>
          <span aria-hidden="true"><ChevronRightIcon /></span>
          <span aria-current="page">{service.title}</span>
        </nav>

        <section className="sd-hero" aria-labelledby="sd-title">
          <div className="sd-art">
            <ServiceThumb service={service} />
            <span className="sd-cat">{service.category}</span>
          </div>

          <div className="sd-intro">
            <h1 className="sd-title" id="sd-title">{service.title}</h1>

            <p className="sd-byline">
              <Link href={`/providers/${service.providerId}`}>{provider.name}</Link>
              {provider.verified && <VerifiedMark />}
              <span className="sd-byline-note">
                Replies in {formatReplies(provider.responseMins).replace('~', '')}
              </span>
            </p>

            <p className="sd-facts">
              <StarRating rating={service.rating} count={provider.reviewCount} />
              <span className="sd-dot" aria-hidden="true" />
              <span className="sd-fact"><LocationIcon /> {service.area}</span>
              <span className="sd-dot" aria-hidden="true" />
              <span className="sd-fact">{service.availability || 'Flexible timing'}</span>
            </p>

            <ServiceRequest service={service} signedOut={signedOut} />

            <p className="sd-assurance">
              No payment until the job is done. The ServMate confirms the time with you before
              the visit.
            </p>
          </div>
        </section>

        <section className="sd-section" aria-labelledby="sd-about-title">
          <div className="sd-section-head">
            <h2 id="sd-about-title">About this service</h2>
          </div>
          <p className="sd-copy">
            {description ||
              `${provider.name} has not written a description for this listing yet. Describe what needs doing in your request and they will answer with the scope.`}
          </p>
          <dl className="sd-details">
            <div>
              <dt>Rate</dt>
              <dd>{formatFromPrice(service.startingPriceCentavos)}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{service.availability || 'Not stated'}</dd>
            </div>
            <div>
              <dt>Area</dt>
              <dd>{service.area}</dd>
            </div>
            <div>
              <dt>Replies in</dt>
              <dd>{formatReplies(provider.responseMins)}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{service.category}</dd>
            </div>
            <div>
              <dt>Listed by</dt>
              <dd>{provider.name}</dd>
            </div>
          </dl>
        </section>

        <section className="sd-section" aria-labelledby="sd-provider-title">
          <div className="sd-section-head">
            <h2 id="sd-provider-title">Your ServMate</h2>
          </div>
          <div className="sd-provider">
            <span className="pv-avatar" aria-hidden="true">{firstLetter(provider.name)}</span>
            <div className="sd-provider-copy">
              <p className="sd-provider-name">
                {provider.name}
                {provider.verified && <VerifiedMark />}
              </p>
              <p className="sd-provider-headline">
                {provider.headline || `Works across ${provider.areas.join(' and ') || provider.area}`}
              </p>
              <p className="sd-provider-meta">
                <StarRating rating={provider.rating} count={provider.reviewCount} />
                <span className="sd-dot" aria-hidden="true" />
                {provider.area}
                <span className="sd-dot" aria-hidden="true" />
                {provider.listings.length} {provider.listings.length === 1 ? 'service' : 'services'}
              </p>
            </div>
            <Link className="quiet-button" href={`/providers/${provider.id}`}>
              View ServMate
            </Link>
          </div>
        </section>

        <section className="sd-section" aria-labelledby="sd-reviews-title">
          <div className="sd-section-head">
            <h2 id="sd-reviews-title">What customers said</h2>
            {provider.reviewCount > shown.length && (
              <Link className="sd-section-link" href={`/providers/${provider.id}`}>
                All {provider.reviewCount} reviews
              </Link>
            )}
          </div>
          {shown.length > 0 ? (
            <ul className="review-list">
              {shown.map((review) => (
                <li key={review.id} className="review-row">
                  <div className="review-row-head">
                    <span className="review-row-name">{review.reviewerName}</span>
                    <span className="review-row-rating" aria-label={`${review.rating} out of 5`}>
                      {review.rating}★
                    </span>
                    <span className="review-row-date">{formatDay(review.createdAt)}</span>
                  </div>
                  {review.comment && <p className="review-row-comment">{review.comment}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="sd-empty-panel">
              <h3>No reviews yet</h3>
              <p>Reviews appear here once a customer confirms a completed job.</p>
            </div>
          )}
        </section>

        <section className="sd-section sd-section-bare" aria-labelledby="sd-related-title">
          <div className="sd-section-head">
            <h2 id="sd-related-title">Similar services</h2>
            <Link className="sd-section-link" href="/home">Browse all</Link>
          </div>
          <RelatedServices services={related} signedOut={signedOut} />
        </section>
      </div>
    </PublicShell>
  );
}
