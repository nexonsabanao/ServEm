import type {
  Database,
  ReviewRecord,
  ServiceListingRecord,
  ServMateCategoryRecord,
  ServMateProfileRecord,
  ServMateServiceAreaRecord,
  UserRecord,
} from './store';

/**
 * Demo content, seeded as records.
 *
 * The storefront used to render a hardcoded array of sample services. Those
 * cards now come from real rows — a ServMate profile, its categories, its
 * coverage and its listings — so the page that shows them and the rules that
 * match jobs to them read the same data. That is what makes the marketplace
 * demonstrable end to end instead of only visually populated.
 *
 * Everything here is **local-development fixture content**: the accounts have no
 * password (nobody can sign in as them), the ratings are computed from the
 * seeded reviews rather than asserted, and no real person or price is implied.
 * A deployment with `NODE_ENV=production` should point at a real backend; see
 * `docs/PROJECT_STATUS.md`.
 */

/** Bumped when the demo content changes, so existing files are topped up. */
export const SEED_VERSION = 1;

/** Fixed clock so a seeded store is byte-stable across machines. */
const BASE_TIME = Date.parse('2026-10-01T08:00:00.000Z');

function at(hours: number): string {
  return new Date(BASE_TIME + hours * 3_600_000).toISOString();
}

type DemoListing = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  amountCentavos: number;
  availability: string;
  area: string;
};

type DemoReview = {
  /** Hours after the base time. Keeps the ordering stable. */
  at: number;
  rating: number;
  comment: string;
};

type DemoProvider = {
  /** The profile id, which is also the public URL segment. */
  id: string;
  name: string;
  handle: string;
  area: string;
  headline: string;
  bio: string;
  experience: string;
  verified: boolean;
  responseMins: number;
  listings: DemoListing[];
  reviews: DemoReview[];
};

const DEMO_PROVIDERS: DemoProvider[] = [
  {
    id: 'prov-rosa',
    name: 'Rosa Cleaning Co.',
    handle: '@rosaclean',
    area: 'Bacoor',
    headline: 'Eco deep-cleaning for condos & townhouses',
    bio: 'A three-person cleaning team working across Bacoor and Imus. We bring our own supplies and use low-fume products around children and pets.',
    experience: 'Six years cleaning condominiums and townhouses.',
    verified: true,
    responseMins: 5,
    listings: [
      {
        id: 'preview-condo-deep-clean',
        categoryId: 'cleaning',
        title: 'Deep clean · 2-bedroom condo (team of 2)',
        description:
          'A full two-person deep clean for a two-bedroom condominium: kitchen, bathrooms, living room and bedrooms, including inside the refrigerator and the balcony.',
        amountCentavos: 180000,
        availability: 'Same day',
        area: 'Bacoor',
      },
    ],
    reviews: [
      { at: 12, rating: 5, comment: 'Arrived on time and the kitchen looked new.' },
      { at: 36, rating: 5, comment: 'Thorough, and they brought everything they needed.' },
      { at: 61, rating: 4, comment: 'Good clean, took a little longer than quoted.' },
    ],
  },
  {
    id: 'prov-aircon',
    name: 'CoolBreeze Aircon',
    handle: '@coolbreeze',
    area: 'Imus',
    headline: 'Same-day aircon cleaning & freon top-up',
    bio: 'Two technicians servicing window, split and cassette units. We test the unit after every service and tell you what it actually needed.',
    experience: 'Licensed refrigeration technician since 2015.',
    verified: true,
    responseMins: 8,
    listings: [
      {
        id: 'preview-aircon-service',
        categoryId: 'home-repair',
        title: 'Aircon cleaning & tune-up at home',
        description:
          'Cleaning and tune-up of one split-type aircon unit, including filter wash, coil cleaning, drain flush and a cooling check.',
        amountCentavos: 80000,
        availability: '2 hours',
        area: 'Imus',
      },
    ],
    reviews: [
      { at: 9, rating: 5, comment: 'Cooling is back to how it was when new.' },
      { at: 40, rating: 5, comment: 'Explained what was wrong without upselling.' },
      { at: 70, rating: 4, comment: 'Solid work. Scheduling took a day.' },
    ],
  },
  {
    id: 'prov-tutor',
    name: 'Kuya Jules Tutorials',
    handle: '@kjules',
    area: 'Dasmariñas',
    headline: 'Math & science tutor, Grades 7–12',
    bio: 'One-on-one tutoring for junior and senior high school students, at home or online. Lessons follow the student’s own school modules.',
    experience: 'Eight years tutoring math and science.',
    verified: false,
    responseMins: 12,
    listings: [
      {
        id: 'preview-math-tutor',
        categoryId: 'tutoring',
        title: 'Weekly math tutoring · Grades 7–10',
        description:
          'One ninety-minute session a week following the student’s current module, with a short practice set after each lesson.',
        amountCentavos: 60000,
        availability: 'Weekly',
        area: 'Dasmariñas',
      },
    ],
    reviews: [
      { at: 20, rating: 5, comment: 'My son finally understands algebra.' },
      { at: 52, rating: 4, comment: 'Patient and well prepared.' },
    ],
  },
  {
    id: 'prov-fixit',
    name: 'FixIt Handyman',
    handle: '@fixit.ph',
    area: 'General Trias',
    headline: 'Small repairs, mounting & furniture assembly',
    bio: 'General handyman work: small repairs, wall mounting, door and cabinet adjustments, and flat-pack furniture assembly.',
    experience: 'Ten years of building maintenance work.',
    verified: true,
    responseMins: 6,
    listings: [
      {
        id: 'preview-handyman',
        categoryId: 'home-repair',
        title: 'Handyman visit · small fixes around the house',
        description:
          'A single visit for a list of small fixes — loose hinges, leaking taps, shelving and other minor repairs.',
        amountCentavos: 70000,
        availability: '1 day',
        area: 'General Trias',
      },
      {
        id: 'preview-furniture-assembly',
        categoryId: 'home-repair',
        title: 'Furniture assembly and wall mounting',
        description:
          'Assembly of flat-pack furniture and mounting of shelves, mirrors and televisions, with the wall fixings included.',
        amountCentavos: 90000,
        availability: '1 day',
        area: 'Bacoor',
      },
    ],
    reviews: [
      { at: 14, rating: 5, comment: 'Fixed three things in under two hours.' },
      { at: 33, rating: 5, comment: 'Careful with the walls, no mess left behind.' },
      { at: 58, rating: 5, comment: 'Booked again for the office.' },
      { at: 88, rating: 4, comment: 'Good work, arrived a bit late.' },
    ],
  },
  {
    id: 'prov-glow',
    name: 'Glow by Mika',
    handle: '@glowbymika',
    area: 'Tagaytay',
    headline: 'On-site hair & makeup for weddings and events',
    bio: 'On-location hair and makeup for weddings, debuts and corporate events, with a trial session available before the date.',
    experience: 'Freelance bridal hair and makeup since 2018.',
    verified: true,
    responseMins: 15,
    listings: [
      {
        id: 'preview-event-hair-makeup',
        categoryId: 'beauty',
        title: 'On-site hair & makeup · bridal package',
        description:
          'Hair and makeup for the bride, including a trial session, touch-up kit and stay-through-the-ceremony coverage.',
        amountCentavos: 350000,
        availability: 'By schedule',
        area: 'Tagaytay',
      },
    ],
    reviews: [
      { at: 6, rating: 5, comment: 'My makeup lasted the whole reception.' },
      { at: 48, rating: 5, comment: 'The trial session made the day stress-free.' },
    ],
  },
  {
    id: 'prov-errand',
    name: 'Sundo Errands',
    handle: '@sundo',
    area: 'Imus',
    headline: 'Grocery runs, bill payments & pickups',
    bio: 'Errand running around Imus and Bacoor: groceries with your own list, bill payments, parcel pickups and queueing.',
    experience: 'Two years running errands for households and small shops.',
    verified: false,
    responseMins: 3,
    listings: [
      {
        id: 'preview-errand-runner',
        categoryId: 'errands',
        title: 'Errand runner · groceries, bills & pickups',
        description:
          'One errand run with up to four stops, with photos of every receipt sent as each item is completed.',
        amountCentavos: 50000,
        availability: '2 hours',
        area: 'Imus',
      },
    ],
    reviews: [
      { at: 18, rating: 5, comment: 'Sent receipts as he went. Very clear.' },
      { at: 44, rating: 4, comment: 'Reliable, quick replies.' },
    ],
  },
  {
    id: 'prov-lens',
    name: 'Lens & Light Studio',
    handle: '@lenslight',
    area: 'Dasmariñas',
    headline: 'Birthday, debut & reunion photography',
    bio: 'Event photography for birthdays, debuts and reunions, with edited photos delivered within three days.',
    experience: 'Event photographer covering Cavite and Metro Manila.',
    verified: true,
    responseMins: 20,
    listings: [
      {
        id: 'preview-event-photo',
        categoryId: 'events',
        title: 'Event photography · birthdays & reunions',
        description:
          'Four hours of event coverage with a single photographer, and a set of edited photographs delivered online.',
        amountCentavos: 120000,
        availability: '3 days',
        area: 'Dasmariñas',
      },
    ],
    reviews: [
      { at: 24, rating: 5, comment: 'Caught moments we did not even notice.' },
      { at: 55, rating: 5, comment: 'Photos ready earlier than promised.' },
    ],
  },
];

/** A demo account id for a provider. Stable, so the store never duplicates. */
function demoUserId(profileId: string): string {
  return `demo-user-${profileId.replace(/^prov-/, '')}`;
}

function demoEmail(profile: DemoProvider): string {
  return `${profile.handle.replace('@', '').replace(/\./g, '-')}@demo.servem.local`;
}

/**
 * Folds the demo content into a snapshot.
 *
 * Additive and idempotent: each row is inserted only when its id is absent, so
 * a developer's own local changes to a seeded row are never overwritten and
 * calling this twice cannot duplicate anything.
 */
export function seedDatabase(source: Database): Database {
  const database: Database = {
    ...source,
    users: [...source.users],
    servmateProfiles: [...source.servmateProfiles],
    servmateCategories: [...source.servmateCategories],
    servmateServiceAreas: [...source.servmateServiceAreas],
    serviceListings: [...source.serviceListings],
    reviews: [...source.reviews],
    seedVersion: SEED_VERSION,
  };

  const hasUser = new Set(database.users.map((user) => user.id));
  const hasProfile = new Set(database.servmateProfiles.map((profile) => profile.id));
  const hasListing = new Set(database.serviceListings.map((listing) => listing.id));
  const hasReview = new Set(database.reviews.map((review) => review.id));

  /**
   * A running counter for `publishedAt`, so listing order is deterministic and
   * matches the order the providers and their listings are declared here. The
   * storefront grid uses it, which is what keeps the current page's card order
   * unchanged now that the rows come from the store.
   */
  let publishedStep = 0;

  DEMO_PROVIDERS.forEach((provider, providerIndex) => {
    const userId = demoUserId(provider.id);

    if (!hasUser.has(userId)) {
      const user: UserRecord = {
        id: userId,
        name: provider.name,
        email: demoEmail(provider),
        username: provider.handle.replace('@', ''),
        isServMate: true,
        isDemo: true,
        createdAt: at(0),
      };
      database.users.push(user);
      hasUser.add(userId);
    }

    if (!hasProfile.has(provider.id)) {
      const profile: ServMateProfileRecord = {
        id: provider.id,
        userId,
        bio: provider.bio,
        experience: provider.experience,
        providerStatus: 'active',
        verificationStatus: provider.verified ? 'verified' : 'unverified',
        headline: provider.headline,
        serviceAreaLabel: provider.area,
        responseMins: provider.responseMins,
        isDemo: true,
        createdAt: at(0),
        updatedAt: at(0),
      };
      database.servmateProfiles.push(profile);
      hasProfile.add(provider.id);
    }

    const coveredAreas = Array.from(
      new Set([provider.area, ...provider.listings.map((listing) => listing.area)]),
    );
    const hasArea = new Set(
      database.servmateServiceAreas
        .filter((area) => area.servmateProfileId === provider.id)
        .map((area) => area.areaLabel),
    );
    for (const areaLabel of coveredAreas) {
      if (hasArea.has(areaLabel)) continue;
      const area: ServMateServiceAreaRecord = {
        servmateProfileId: provider.id,
        areaLabel,
        createdAt: at(0),
      };
      database.servmateServiceAreas.push(area);
      hasArea.add(areaLabel);
    }

    const hasCategory = new Set(
      database.servmateCategories
        .filter((row) => row.servmateProfileId === provider.id)
        .map((row) => row.categoryId),
    );
    for (const categoryId of new Set(provider.listings.map((listing) => listing.categoryId))) {
      if (hasCategory.has(categoryId)) continue;
      const row: ServMateCategoryRecord = {
        servmateProfileId: provider.id,
        categoryId,
        status: 'active',
        createdAt: at(0),
      };
      database.servmateCategories.push(row);
      hasCategory.add(categoryId);
    }

    provider.listings.forEach((listing) => {
      publishedStep += 1;
      if (hasListing.has(listing.id)) return;
      const publishedAt = at(publishedStep);
      const record: ServiceListingRecord = {
        id: listing.id,
        servmateProfileId: provider.id,
        categoryId: listing.categoryId,
        title: listing.title,
        description: listing.description,
        pricingModel: 'fixed',
        amountCentavos: listing.amountCentavos,
        currency: 'PHP',
        publicationStatus: 'published',
        serviceAreaLabel: listing.area,
        availability: listing.availability,
        publishedAt,
        createdAt: at(0),
        updatedAt: at(0),
      };
      database.serviceListings.push(record);
      hasListing.add(listing.id);
    });

    /**
     * Demo bookings back the reviews.
     *
     * A review may only exist against a completed booking (§10.9), so the
     * fixture creates the completed booking first and the review hangs off it.
     * Fabricating the review without its booking would make the eligibility
     * rule untrue for the very data the interface shows.
     */
    provider.reviews.forEach((review, reviewIndex) => {
      const bookingId = `demo-booking-${provider.id}-${reviewIndex}`;
      const reviewId = `demo-review-${provider.id}-${reviewIndex}`;
      if (!hasReview.has(reviewId)) {
        const listed = provider.listings[reviewIndex % provider.listings.length]!;
        const completedAt = at(review.at);
        database.bookings.push({
          id: bookingId,
          reference: buildDemoReference(bookingId),
          userId: `demo-customer-${providerIndex}`,
          jobPostId: `demo-job-${provider.id}-${reviewIndex}`,
          servmateProfileId: provider.id,
          area: listed.area,
          message: `Demo booking behind a seeded review for ${provider.name}.`,
          status: 'completed',
          agreedAmountCentavos: listed.amountCentavos,
          agreedCurrency: 'PHP',
          agreedScope: listed.title,
          createdAt: at(review.at - 48),
          confirmedAt: at(review.at - 40),
          startedAt: at(review.at - 8),
          completedAt,
        });
        const record: ReviewRecord = {
          id: reviewId,
          bookingId,
          reviewerUserId: `demo-customer-${providerIndex}`,
          servmateProfileId: provider.id,
          rating: review.rating,
          comment: review.comment,
          publicationStatus: 'published',
          isDemo: true,
          createdAt: completedAt,
        };
        database.reviews.push(record);
        hasReview.add(reviewId);
      }
    });
  });

  return database;
}

function buildDemoReference(id: string): string {
  return `SE-${id.replace(/-/g, '').slice(-6).toUpperCase()}`;
}
