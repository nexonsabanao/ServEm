# ServEm

ServEm is a neighbourhood-services marketplace for the Philippines. Customers book independent
local helpers ("ServMates") for cleaning, repairs, furniture assembly, errands and similar work;
ServMates manage their listings, availability, requests, jobs and earnings. Pricing is in Philippine
pesos and scheduling uses `Asia/Manila`.

The repository contains two clients and one Firebase backend:

- a React + TypeScript web application for customers, ServMates and staff;
- a Flutter application for Android (the iOS project exists, but no iOS build is produced);
- shared Firebase Auth, Firestore and Storage configuration, security rules and Cloud Functions
  source.

> **Status: prototype.** Payments, payouts, identity verification and messaging delivery are not
> production-ready. The Android APK is debug-signed, and no iOS build exists. See
> [PRODUCTION_ROADMAP.md](PRODUCTION_ROADMAP.md) for launch blockers.

## Repository layout

| Path | What it contains |
| --- | --- |
| `servem_web/` | React 19 + Vite + TypeScript app: landing page, customer workspace, ServMate workspace, staff console and legal pages. |
| `servem_web/functions/` | Cloud Functions v2 source (bookings, chat, payouts, admin, payment webhook) and zod schemas. Source only; not deployed. |
| `servem_web/firestore.rules`, `servem_web/storage.rules` | Access control for all client reads and writes. |
| `servem_app/` | Flutter app for Android: authentication, customer booking flow, ServMate workspace and a staff console screen. |
| `tools/production-audit.mjs` | Static repository gate for demo copy, locale leftovers, dead links, client-side money writes, undeployed callables, unruled collections and client/server schema drift. |
| `servem_web/tools/seed-catalogue.mjs` | Seeds services and ServMate profiles with an Admin SDK key held outside the repository. |
| `.github/workflows/ci.yml` | Web type-check/lint/build, Flutter analyze/test, production audit and rules compilation. |
| `SETUP.md` | Firebase console steps, rules deployment, emulators, seeding, admin claim and data model. |
| `PRODUCTION_ROADMAP.md` | Production requirements and launch blockers. |
| `CHANGELOG.md` | Release notes for shipped artifacts. |
| `servem_web/SECURITY.md` | Threat model, callable contracts and security notes. |

## How the pieces fit

Both clients use one Firebase project:

- **Auth:** email/password and Google. Email verification is available; Apple sign-in is present in
  the UI but requires the provider to be enabled in Firebase.
- **Firestore:** profiles, services, servmates, bookings, threads and messages, notifications,
  reviews, and staff operations collections (payments, payouts, disputes, tickets, verification,
  audit).
- **Storage:** private identity documents and user uploads.
- **Hosting:** the web build is deployed with Firebase Hosting.
- **Functions:** the source exists, but no functions are deployed. Clients write Firestore directly
  and the rules enforce the booking, fee, status and admin invariants. The Functions source mirrors
  those rules as zod schemas.

Web roles are `/app/*` for customers, `/mate/*` for ServMates and `/admin/*` for staff. `/admin`
requires the `admin` custom claim. The mobile app covers the customer and ServMate journeys plus a
staff console screen and reads the role from the ID token.

## Features

- **Customers:** catalogue browsing, service and ServMate profiles, the booking wizard, booking
  status updates, saved places, messages, notifications and reviews.
- **ServMates:** dashboard, listing editor, requests, job updates, earnings and payout requests.
- **Staff:** verification, payments and payouts, disputes, tickets, catalogue, reviews, analytics
  and audit decisions.
- **Both clients:** suspended-account handling and explicit loading, empty, offline and error
  states.
- **Legal:** published terms and privacy pages linked from authentication.

## What is not live

- No payment provider is integrated. Payment method labels on a booking do not move money; the
  PayMongo webhook helper is source only.
- Payouts and refunds are records and staff decisions; nothing settles to a bank account or wallet.
- Identity verification is manual; there is no vendor or background check.
- No push, email or SMS delivery; no maps, geocoding or live tracking.
- No deployed Cloud Functions; rate limits, notification fan-out and payment webhooks do not run.
- No iOS build. The Android APK is debug-signed for sideloading.
- There are no web unit tests; coverage is Flutter tests, type checks, the production audit and
  rules compilation.

## Documentation

Setup, environment variables, Firebase rules, emulators, seeding and the first admin claim are in
[SETUP.md](SETUP.md). Client-specific commands are in [servem_web/README.md](servem_web/README.md)
and [servem_app/README.md](servem_app/README.md). Launch blockers are in
[PRODUCTION_ROADMAP.md](PRODUCTION_ROADMAP.md), release notes are in [CHANGELOG.md](CHANGELOG.md),
and the security model is in [servem_web/SECURITY.md](servem_web/SECURITY.md).
