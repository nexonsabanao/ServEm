import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/app/components/feed/app-shell';
import { ProviderProfileDraft } from '@/app/components/feed/provider-profile-draft';
import { ProviderServiceList } from '@/app/components/feed/provider-services';
import { ChevronRightIcon, LocationIcon, StarIcon, VerifiedIcon } from '@/app/components/icons';
import { getSessionAccount } from '@/lib/auth';
import { listBookings, summariseBookings } from '@/lib/bookings';
import { providerById } from '@/lib/feed-data';
import { formatPhp, formatReplies } from '@/lib/format';
import { servicesFor } from '@/lib/servmate';

export const dynamic = 'force-dynamic';

type Params = Promise<{ providerId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { providerId } = await params;
  const provider = providerById.get(providerId);
  return {
    title: provider ? `${provider.name} — ServEm` : 'ServMate — ServEm',
  };
}

/**
 * A ServMate's public page — the customer-facing half of the provider design.
 *
 * It reads the same roster the workbench previews, so a ServMate's own view of
 * their listings and a customer's view of them cannot drift apart. Everything
 * shown is the sample catalog; there is no provider self-service API, so the
 * page presents rather than edits.
 */
export default async function ProviderProfilePage({ params }: { params: Params }) {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const { providerId } = await params;
  const provider = providerById.get(providerId);
  if (!provider) notFound();

  const [bookings] = await Promise.all([listBookings(account.id)]);
  const summary = summariseBookings(bookings);
  const services = servicesFor(providerId);
  const covers = Array.from(new Set([provider.area, ...services.map((service) => service.area)]));
  const from = services[0]?.startingPriceCentavos;
  const categories = Array.from(new Set(services.map((service) => service.category)));
  const about =
    categories.length > 0
      ? `Works in ${categories.join(', ').toLowerCase()} across ${covers.join(' and ')}. Replies in about ${formatReplies(provider.responseMins).replace('~', '')}, rated ${provider.rating.toFixed(1)} across ${provider.reviews.toLocaleString('en-PH')} reviews.`
      : '';

  return (
    <AppShell account={account} requestCount={summary.total}>
      <div className="pv">
        <nav className="pv-crumb" aria-label="Breadcrumb">
          <Link href="/home">Home</Link>
          <span aria-hidden="true"><ChevronRightIcon /></span>
          <span aria-current="page">{provider.name}</span>
        </nav>

        <section className="pv-letterhead" aria-label="ServMate">
          <div className="pv-id">
            <span className="pv-avatar" aria-hidden="true">{firstLetter(provider.name)}</span>
            <div className="pv-id-copy">
              <h1 className="pv-name">{provider.name}</h1>
              <ProviderProfileDraft
                providerId={providerId}
                headline={provider.headline}
                about={about}
                areas={covers.join(' · ')}
              />
            </div>
            {provider.verified && (
              <span className="pv-verified"><VerifiedIcon /> Verified ServMate</span>
            )}
          </div>

          <dl className="pv-facts">
            <div>
              <dt>Handle</dt>
              <span className="pv-leader" />
              <dd>{provider.handle}</dd>
            </div>
            <div>
              <dt>Home area</dt>
              <span className="pv-leader" />
              <dd><LocationIcon /> {provider.area}</dd>
            </div>
            <div>
              <dt>Replies in</dt>
              <span className="pv-leader" />
              <dd>{formatReplies(provider.responseMins)}</dd>
            </div>
            <div>
              <dt>Covers</dt>
              <span className="pv-leader" />
              <dd>{covers.join(' · ')}</dd>
            </div>
            <div>
              <dt>Rating</dt>
              <span className="pv-leader" />
              <dd><StarIcon /> {provider.rating.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Reviews</dt>
              <span className="pv-leader" />
              <dd>{provider.reviews.toLocaleString('en-PH')}</dd>
            </div>
            <div>
              <dt>Listings</dt>
              <span className="pv-leader" />
              <dd>{services.length}</dd>
            </div>
            <div className="pv-facts-from">
              <dt>Rates from</dt>
              <span className="pv-leader" />
              <dd className="pv-price">{from === undefined ? 'Ask for a quote' : formatPhp(from)}</dd>
            </div>
          </dl>
        </section>

        <section className="pv-section" aria-labelledby="pv-about-title">
          <div className="pv-section-head">
            <h2 id="pv-about-title">About</h2>
          </div>
          <div className="pv-about-block">
            <p>
              {about ||
                `${provider.name} has not written a description yet. Their listings and coverage areas are below.`}
            </p>
            <dl className="pv-about-facts">
              <div>
                <dt>Categories</dt>
                <span className="pv-leader" />
                <dd>{categories.length > 0 ? categories.join(' · ') : 'None listed'}</dd>
              </div>
              <div>
                <dt>Home area</dt>
                <span className="pv-leader" />
                <dd><LocationIcon /> {provider.area}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="pv-section" aria-labelledby="pv-services-title">
          <div className="pv-section-head">
            <h2 id="pv-services-title">Services</h2>
            <span className="pv-count">{services.length}</span>
          </div>
          {services.length > 0 ? (
            <ProviderServiceList services={services} />
          ) : (
            <div className="pv-empty">
              <h3>Nothing listed yet</h3>
              <p>This ServMate has no live listings. Their workbench is where listings appear.</p>
            </div>
          )}
        </section>

        <p className="pv-foot">
          Sample ServMate for design preview — not a real provider. Requests sent here still get a
          reference, and payment only happens after the job is done.
        </p>
      </div>
    </AppShell>
  );
}

function firstLetter(value: string): string {
  const first = Array.from(value.trim())[0];
  return first ? first.toLocaleUpperCase() : 'S';
}
