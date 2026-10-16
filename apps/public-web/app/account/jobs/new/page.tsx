import Link from 'next/link';
import { redirect } from 'next/navigation';
import { JobPostForm } from '@/app/components/jobs/job-post-form';
import { getSessionAccount } from '@/lib/auth';
import { listCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Post a job — ServEm',
};

/**
 * Posting a job.
 *
 * The form is a client component, but the choice lists come from the registry
 * and the coverage table the matching rules compare against — so the options a
 * customer picks from are the exact values eligibility is decided by.
 */
export default async function NewJobPage() {
  const account = await getSessionAccount();
  if (!account) redirect('/?signin=1');

  const categories = listCategories().map((category) => ({
    id: category.id,
    name: category.name,
  }));

  return (
    <div className="account-page">
      <section className="account-section" aria-labelledby="new-job-title">
        <div className="account-section-head">
          <div>
            <h1 id="new-job-title">Post a job</h1>
            <p className="account-section-lede">
              Only ServMates whose categories and areas match can open this.
            </p>
          </div>
          <Link className="quiet-button" href="/account/jobs">
            All my jobs
          </Link>
        </div>
        <JobPostForm categories={categories} />
      </section>
    </div>
  );
}
