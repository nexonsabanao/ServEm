import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ListingManager } from '@/app/components/servmate/listing-manager';
import { MatchingSettings } from '@/app/components/servmate/matching-settings';
import { PortfolioPanel } from '@/app/components/servmate/portfolio-panel';
import { ProfileFactsForm } from '@/app/components/servmate/profile-facts-form';
import { getSessionAccount } from '@/lib/auth';
import { listCategories } from '@/lib/categories';
import { completedWorkFor, getPortfolio, getWorkPosts } from '@/lib/portfolio';
import { getOwnServmateProfile, getProviderWorkspace, listOwnListings } from '@/lib/servmate-profile';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your ServMate profile — ServEm',
};

/**
 * The provider console: everything on the provider's own side, in one place.
 *
 * The blueprint keeps a ServMate's identity in a profile rather than a separate
 * shop (§1), so profile text, matching rules, service listings, portfolio and
 * work updates are sections of one page. Each section writes through its own
 * endpoint, which is what lets a refusal be reported against the section that
 * caused it instead of failing one giant page save — and lets a listing be
 * unpublished without touching the profile it belongs to.
 */
export default async function ServmateConsolePage() {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const own = await getOwnServmateProfile(account.id);
  if (!own) redirect('/servmate/jobs');

  const [workspace, listings, portfolio, posts, completed] = await Promise.all([
    getProviderWorkspace(own.id),
    listOwnListings(account.id),
    getPortfolio(own.id),
    getWorkPosts(own.id),
    completedWorkFor(own.id),
  ]);
  const categories = listCategories().map((category) => ({
    id: category.id,
    name: category.name,
  }));

  return (
      <div className="account-page">
        <section className="account-section" aria-labelledby="sv-profile-title">
          <div className="account-section-head">
            <div>
              <h1 id="sv-profile-title">Your profile</h1>
              <p className="account-section-lede">
                This is what a customer reads before they hire you. Nothing here claims your
                credentials were checked — that is a separate process.
              </p>
            </div>
            <div className="job-head-actions">
              <Link className="quiet-button" href={`/providers/${own.id}`}>
                See your public page
              </Link>
              <Link className="quiet-button" href="/servmate/jobs">
                Jobs for you
              </Link>
            </div>
          </div>
          <ProfileFactsForm
            headline={workspace?.profile.headline ?? ''}
            bio={workspace?.profile.bio ?? ''}
            experience={workspace?.profile.experience ?? ''}
            serviceArea={workspace?.profile.area ?? ''}
            responseMins={workspace?.profile.responseMins ?? 0}
          />
        </section>

        <section className="account-section" aria-labelledby="sv-matching-title">
          <div className="account-section-head">
            <div>
              <h2 id="sv-matching-title">Matching</h2>
              <p className="account-section-lede">
                Only jobs in these categories, in these areas, reach your private feed. Nothing
                else does — not even a link.
              </p>
            </div>
          </div>
          <MatchingSettings
            categories={categories}
            categoryIds={workspace?.categoryIds ?? []}
            areas={workspace?.areas ?? []}
          />
        </section>

        <section className="account-section" aria-labelledby="sv-listings-title">
          <div className="account-section-head">
            <div>
              <h2 id="sv-listings-title">Service listings</h2>
              <p className="account-section-lede">
                What customers can find in the storefront. Job matching is decided by your
                categories and areas, not by these.
              </p>
            </div>
          </div>
          <ListingManager
            listings={listings.map((listing) => ({
              id: listing.id,
              title: listing.title,
              description: listing.description,
              categoryId: listing.categoryId,
              pricingModel: listing.pricingModel,
              ...(listing.amountCentavos === undefined
                ? {}
                : { amountCentavos: listing.amountCentavos }),
              ...(listing.serviceAreaLabel ? { serviceAreaLabel: listing.serviceAreaLabel } : {}),
              ...(listing.availability ? { availability: listing.availability } : {}),
              ...(listing.terms ? { terms: listing.terms } : {}),
              publicationStatus: listing.publicationStatus,
            }))}
            categories={categories}
          />
        </section>

        <section className="account-section" aria-labelledby="sv-portfolio-title">
          <div className="account-section-head">
            <div>
              <h2 id="sv-portfolio-title">Portfolio and updates</h2>
              <p className="account-section-lede">
                Examples of your work and short updates. Verified jobs are labelled as such and
                self-published work is labelled as yours — the distinction is made from the
                booking, not from what this page sends.
              </p>
            </div>
          </div>
          <PortfolioPanel
            items={portfolio.map((item) => ({
              id: item.id,
              title: item.title,
              ...(item.description ? { description: item.description } : {}),
              ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
              source: item.source,
            }))}
            posts={posts.map((entry) => ({
              id: entry.id,
              body: entry.body,
              ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
            }))}
            completedWork={completed}
          />
        </section>
      </div>
  );
}
