/**
 * Structured service categories.
 *
 * Blueprint §6.3: job eligibility is decided by a structured category, never by
 * free-text keyword matching. Everything that needs to agree on "which kind of
 * work is this" — a customer's job post, a ServMate's eligible categories, a
 * listing — refers to a category by its stable `id`. The display `name` is for
 * the interface only and may change without invalidating stored data.
 *
 * The registry is a fixed, in-process table rather than a database collection:
 * the set is small, changes only with a release, and every eligibility rule can
 * then be checked without a round trip. A deployment that needs runtime-managed
 * categories moves this table into a `service_categories` collection in
 * `store.ts` and keeps the same accessor signatures.
 */

export type ServiceCategoryRecord = {
  id: string;
  /** Display label, exactly as the storefront shows it. */
  name: string;
  slug: string;
  description?: string;
  /** Set for a subcategory; the blueprint allows one level. */
  parentId?: string;
  isActive: boolean;
  sortOrder: number;
};

export const SERVICE_CATEGORIES: ServiceCategoryRecord[] = [
  {
    id: 'cleaning',
    name: 'Cleaning',
    slug: 'cleaning',
    description: 'Home, condo and office cleaning.',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'home-repair',
    name: 'Home Repair',
    slug: 'home-repair',
    description: 'Aircon, plumbing, electrical and handyman work.',
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'tutoring',
    name: 'Tutoring',
    slug: 'tutoring',
    description: 'Academic tutoring and lessons.',
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'events',
    name: 'Events',
    slug: 'events',
    description: 'Photography, hosting and event support.',
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'errands',
    name: 'Errands',
    slug: 'errands',
    description: 'Groceries, bills, pickups and queueing.',
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'beauty',
    name: 'Beauty',
    slug: 'beauty',
    description: 'Hair, makeup and personal care.',
    isActive: true,
    sortOrder: 6,
  },
];

/** Every active category, in display order. */
export function listCategories(): ServiceCategoryRecord[] {
  return SERVICE_CATEGORIES.filter((category) => category.isActive).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/** An active category by id, or undefined when unknown or retired. */
export function getCategoryById(id: string): ServiceCategoryRecord | undefined {
  return SERVICE_CATEGORIES.find((category) => category.id === id && category.isActive);
}

export function isCategoryId(value: string): boolean {
  return getCategoryById(value) !== undefined;
}

/** The display label for a category id, or undefined when unknown. */
export function categoryNameForId(id: string): string | undefined {
  return getCategoryById(id)?.name;
}

/**
 * The category id for a display label.
 *
 * The storefront predates the structured registry and renders labels, so this
 * bridge keeps a legacy or hand-written label resolving to the same category a
 * job post would store. Matching is case-insensitive and ignores surrounding
 * space; anything unrecognised returns undefined rather than guessing.
 */
export function categoryIdForName(name: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  return SERVICE_CATEGORIES.find((category) => category.name.toLowerCase() === wanted)?.id;
}
