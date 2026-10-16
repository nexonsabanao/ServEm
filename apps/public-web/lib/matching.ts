import {
  canServMateDiscoverJob,
  canViewJobDetail,
  DISCOVERABLE_JOB_STATUSES,
  toJobDiscoverySummary,
  type JobDiscoverySummary,
} from './policy';
import { query, type Database, type JobPostRecord } from './store';

/**
 * Private, category-matched job discovery (blueprint §6).
 *
 * The release-critical rule lives in `./policy`; this module's job is to run it
 * over the stored jobs and hand back a **safe projection**. Two properties
 * matter:
 *
 * 1. **Filters narrow, never widen.** A filter is applied to the set that
 *    already passed eligibility, so no combination of parameters can reveal a
 *    job the caller was not entitled to. Filters are a convenience on top of
 *    authorization, never a substitute for it.
 * 2. **Discovery returns summaries, not records.** The summary carries the city,
 *    never the barangay or the access notes (§7.2); the full record is released
 *    only through `jobDetailFor`, which defers to the same policy.
 */

export type DiscoveryFilters = {
  categoryId?: string;
  /** City/municipality. */
  city?: string;
  budgetMinCentavos?: number;
  budgetMaxCentavos?: number;
  /** Include only jobs whose preferred start is on or after this instant. */
  startFrom?: string;
  /** Include only jobs that would not be finished before this instant. */
  startBefore?: string;
  /** Free-text search over the title and description. */
  query?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Everything this ServMate is entitled to see, before filters. */
export function eligibleJobs(
  database: Database,
  input: { userId: string; now?: Date },
): JobPostRecord[] {
  const now = input.now ?? new Date();
  return database.jobPosts
    .filter((job) => DISCOVERABLE_JOB_STATUSES.includes(job.jobStatus))
    .filter((job) => canServMateDiscoverJob(database, { jobId: job.id, userId: input.userId, now }).allowed)
    .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
}

/**
 * Applies the narrowing filters to an already-authorized set.
 *
 * A schedule filter matches only jobs that state a preferred start: a job with
 * no stated time is flexible by definition, so excluding it would hide work a
 * provider could actually do.
 */
export function applyFilters(
  jobs: JobPostRecord[],
  filters: DiscoveryFilters,
): JobPostRecord[] {
  const wanted = filters.query?.trim().toLowerCase();
  const from = filters.startFrom ? Date.parse(filters.startFrom) : undefined;
  const before = filters.startBefore ? Date.parse(filters.startBefore) : undefined;

  const filtered = jobs.filter((job) => {
    if (filters.categoryId && job.categoryId !== filters.categoryId) return false;
    if (filters.city && job.locationCity !== filters.city) return false;
    if (
      filters.budgetMinCentavos !== undefined &&
      job.budgetCentavos < filters.budgetMinCentavos
    ) {
      return false;
    }
    if (
      filters.budgetMaxCentavos !== undefined &&
      job.budgetCentavos > filters.budgetMaxCentavos
    ) {
      return false;
    }
    if (wanted) {
      const haystack = `${job.title} ${job.description}`.toLowerCase();
      if (!haystack.includes(wanted)) return false;
    }
    if (from !== undefined && !Number.isNaN(from) && job.preferredStart) {
      if (Date.parse(job.preferredStart) < from) return false;
    }
    if (before !== undefined && !Number.isNaN(before) && job.preferredStart) {
      if (Date.parse(job.preferredStart) > before) return false;
    }
    return true;
  });

  const limit = clampLimit(filters.limit);
  return filtered.slice(0, limit);
}

function clampLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT);
}

/** The discovery feed for one ServMate, summaries only. */
export function discoverJobs(
  database: Database,
  input: { userId: string; filters?: DiscoveryFilters; now?: Date },
): JobDiscoverySummary[] {
  const jobs = eligibleJobs(database, input);
  return applyFilters(jobs, input.filters ?? {}).map(toJobDiscoverySummary);
}

export async function listAvailableJobs(input: {
  userId: string;
  filters?: DiscoveryFilters;
}): Promise<JobDiscoverySummary[]> {
  return query((database) => discoverJobs(database, input));
}

/**
 * The full job for a caller entitled to it, or null.
 *
 * Null covers both "does not exist" and "not yours to see", so a guessed id
 * cannot be told apart from an absent one (§6.4). This is the only route to the
 * barangay, the access notes and the customer's own job record.
 */
export function jobDetail(
  database: Database,
  input: { jobId: string; userId: string; now?: Date },
): JobPostRecord | null {
  const decision = canViewJobDetail(database, input);
  return decision.allowed ? decision.value : null;
}

export async function getJobDetail(input: {
  jobId: string;
  userId: string;
}): Promise<JobPostRecord | null> {
  return query((database) => jobDetail(database, input));
}
