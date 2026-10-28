#!/usr/bin/env node
/**
 * Seeds the launch catalogue into Firestore with the Firebase Admin SDK.
 *
 * The clients are not allowed to create catalogue rows for someone else, so the
 * first listings are written from a trusted machine. Nothing is embedded here:
 * the credentials come from GOOGLE_APPLICATION_CREDENTIALS (a service-account
 * key held outside the repo) and the provider is a real signed-up account.
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=/secure/servem-admin.json
 *   node servem_web/tools/seed-catalogue.mjs \
 *     --project servem-ph \
 *     --provider-email provider@example.com \
 *     [--role servmate] [--dry-run]
 *
 * `--role servmate` also promotes that profile so it can open the ServMate
 * workspace. Re-running is safe: rows are written by deterministic id.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = new Map();
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  const token = argv[index];
  if (!token.startsWith('--')) continue;
  const key = token.slice(2);
  const next = argv[index + 1];
  if (next && !next.startsWith('--')) {
    args.set(key, next);
    index += 1;
  } else {
    args.set(key, true);
  }
}

const projectId = args.get('project') ?? 'servem-ph';
const providerEmail = args.get('provider-email');
const promote = args.get('role') === 'servmate';
const dryRun = args.get('dry-run') === true;

if (!providerEmail) {
  console.error('Provide --provider-email (an account that already signed up in the app).');
  process.exit(1);
}

const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!emulator && !serviceAccountPath) {
  console.error(
    'Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file held outside the repo.\n' +
      'Firebase console → Project settings → Service accounts → Generate new private key.',
  );
  process.exit(1);
}

const app =
  getApps()[0] ??
  initializeApp(
    emulator
      ? { projectId } // the emulators accept unauthenticated admin calls
      : { credential: cert(serviceAccountPath), projectId },
  );

const auth = getAuth(app);
const db = getFirestore(app);

/** The launch catalogue: prices are whole pesos per hour. */
const listings = [
  {
    key: 'furniture-assembly',
    title: 'Furniture assembly',
    category: 'Assembly',
    blurb: 'From box to built.',
    description:
      'Desks, shelves and beds assembled carefully. Tools included, packaging tidied away before I leave.',
    rate: 450,
    minHours: 2,
    tags: ['Assembly', 'Furniture'],
    area: 'Makati · Metro Manila',
    image: '/assets/photos/service_assembly_b.jpg',
  },
  {
    key: 'home-cleaning',
    title: 'Home cleaning',
    category: 'Cleaning',
    blurb: 'A fresh start, every visit.',
    description:
      'Kitchen, bathrooms and living areas cleaned with your supplies or mine. Move-out cleans welcome.',
    rate: 350,
    minHours: 2,
    tags: ['Cleaning', 'Deep clean'],
    area: 'Makati · Metro Manila',
    image: '/assets/photos/service_cleaning.jpg',
  },
  {
    key: 'handyman-repairs',
    title: 'Handyman repairs',
    category: 'Repairs',
    blurb: 'Small fixes, done right.',
    description: 'Leaky taps, loose hinges, shelves that need a firmer wall. Bring the parts, I bring the tools.',
    rate: 500,
    minHours: 1,
    tags: ['Repairs', 'Plumbing'],
    area: 'Makati · Metro Manila',
    image: '/assets/photos/service_repairs.jpg',
  },
];

const run = async () => {
  const account = await auth.getUserByEmail(providerEmail).catch(() => null);
  if (!account) {
    console.error(`No Firebase Auth account for ${providerEmail}. Sign up in the app first.`);
    process.exit(1);
  }
  const uid = account.uid;
  const name = account.displayName?.trim() || providerEmail.split('@')[0];

  console.log(`${dryRun ? '[dry run] ' : ''}Seeding for ${providerEmail} (${uid}) on ${projectId}`);

  const profileRef = db.collection('profiles').doc(uid);
  const servmateRef = db.collection('servmates').doc(`servmate-${uid}`);

  const writes = [
    [
      profileRef,
      {
        name,
        email: providerEmail,
        role: promote ? 'servmate' : 'customer',
        photo: account.photoURL ?? '',
        updatedAt: FieldValue.serverTimestamp(),
      },
    ],
    [
      servmateRef,
      {
        uid,
        name,
        photo: account.photoURL ?? '',
        area: 'Makati · Metro Manila',
        bio: 'Ten years of furniture assembly and small repairs around Metro Manila.',
        skills: ['Assembly', 'Repairs', 'Mounting'],
        status: 'active',
        verified: true,
        rating: 0,
        reviews: 0,
        jobs: 0,
        distanceKm: 1.2,
        updatedAt: FieldValue.serverTimestamp(),
      },
    ],
    ...listings.map((listing) => [
      db.collection('services').doc(`service-${uid}-${listing.key}`),
      {
        title: listing.title,
        name: listing.title,
        category: listing.category,
        blurb: listing.blurb,
        description: listing.description,
        rate: listing.rate,
        price: listing.rate,
        minHours: listing.minHours,
        tags: listing.tags,
        area: listing.area,
        asset: listing.image,
        image: listing.image,
        providerId: uid,
        providerName: name,
        servmateId: servmateRef.id,
        status: 'live',
        rating: 0,
        reviews: 0,
        distanceKm: 1.2,
        updatedAt: FieldValue.serverTimestamp(),
      },
    ]),
  ];

  for (const [ref, data] of writes) {
    if (dryRun) {
      console.log(`would write ${ref.path}`, JSON.stringify({ ...data, updatedAt: '<server timestamp>' }, null, 2));
      continue;
    }
    await ref.set(data, { merge: true });
    console.log(`wrote ${ref.path}`);
  }

  console.log(
    dryRun
      ? 'Dry run complete. Re-run without --dry-run to write.'
      : `Done: 1 ServMate and ${listings.length} live listings are now bookable.`,
  );
};

run().catch((error) => {
  console.error('Seeding failed:', error.message ?? error);
  process.exit(1);
});
