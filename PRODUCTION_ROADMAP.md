# ServEm PH production roadmap

This roadmap converts ServEm from a design-driven prototype into a production-ready Philippine home-services marketplace.

## Current production baseline

- TypeScript React customer web app, ServMate workspace, and admin operations suite.
- Flutter customer and ServMate app.
- Firebase Authentication, Firestore, and Analytics in project `servem-ph`.
- Philippine localization, legal pages, live authentication gates, Cloud Functions, security headers, storage rules, and payment-provider integration are being implemented.

## Verifying any claim in this document

Do not trust prose about readiness. Every statement below is checked by a command:

| Command | Proves |
| --- | --- |
| `node tools/production-audit.mjs` | Repo-wide gates: leftover demo copy, US currency/locality/timezone, foreign card-brand artwork, dead internal links, client-side money math, callables that are not deployed, Firestore collections with no rule, and client/server payload drift. Exit code 0 means clean. |
| `cd servem_web && npx tsc -b && npm run build && npm run lint` | The web and admin app compiles and lints. Use `tsc -b`, never a bare `tsc --noEmit`: the root `tsconfig.json` is a solution file with `files: []`, so a bare `--noEmit` checks nothing and reports success. |
| `cd servem_web/functions && npm ci && npm run typecheck` | The backend that both clients integrate against actually builds. |
| `cd servem_app && flutter analyze && flutter test` | The Flutter app builds and its tests pass. |
| `node servem_web/tools/seed-catalogue.mjs --project <staging>` (needs `--force`) | The Philippine catalogue is seedable without touching a live project by accident. |

Run all five in CI on every pull request. The audit script is read-only and never mutates Firebase; nothing in this repository should ever run `firebase deploy` against `servem-ph` from an automated context.

### Why the payload-drift gate exists

`tools/production-audit.mjs` rule 7 compares the strict zod schemas in `servem_web/functions/src/` against the TypeScript interfaces in `servem_web/src/lib/functions.ts` and the Dart map literals in `servem_app/lib/firebase/`. This class of defect is invisible to both `tsc` and `flutter analyze`: the callable wrapper is keyed by a string, so a client can send `action: 'start'` where the server accepts only `cancel|reschedule|complete|accept`, or omit six required address fields, and the mismatch only appears in production as `invalid-argument`. It found nine such drifts across the two clients, including a payment-rail enum spelled differently on each side and an admin decision vocabulary that no kind in the server's allow-list matched. Any future change to a schema must be landed with the matching client change in the same commit, or the gate fails the build.


## Immediate hardening checklist

1. **Market localization**
   - Use Philippine addresses, cities, ZIP codes, phone numbers, distances, and `Asia/Manila`.
   - Use PHP formatting everywhere and realistic local service pricing.
   - Support GCash, Maya, bank transfer, and cash on completion.
   - Remove US-oriented names, neighborhoods, currency, and payment examples.

2. **Legal and privacy**
   - Publish Terms and Conditions and Privacy Policy.
   - Reference the Data Privacy Act of 2012, National Privacy Commission expectations, Consumer Act, and Electronic Commerce Act.
   - Link consent from account creation and login.
   - Provide privacy, security, deletion, and complaint routes.
   - Obtain counsel review before public launch.

3. **Server-authoritative workflows**
   - Booking creation, pricing, status transitions, messaging, reviews, payouts, refunds, disputes, and tickets run through Cloud Functions.
   - Clients cannot assign privileged fields or forge participant IDs.
   - Admin actions require custom claims and write audit entries.
   - Payment state changes are accepted only from authenticated provider webhooks or an admin workflow.

4. **Defense in depth**
   - Firestore rules enforce document ownership, roles, and field validation.
   - Storage rules enforce per-user paths, file type, and file size.
   - Functions validate all input with schemas and enforce rate limits.
   - Hosting sends CSP, HSTS, referrer, permissions, and clickjacking protections.
   - Firebase secrets hold provider credentials.
   - Admin bootstrap uses a one-time secret and records the grant.

5. **Production data lifecycle**
   - Remove localStorage demo persistence and seeded fake operations.
   - Require authentication for customer, ServMate, and admin workspaces.
   - Show loading, permission, network, and empty states instead of silently falling back to fake data.
   - Back up Firestore and define retention for chat, logs, and uploaded documents.
   - Provide account export and deletion workflows.

6. **Payments and payouts**
   - Connect a Philippine payment provider with server-side checkout and signed webhooks.
   - Reconcile payments, refunds, platform fees, and provider balances in Firestore.
   - Never store full card data in ServEm systems.
   - Require payout verification, fraud thresholds, and dual approval for high-value refunds.

7. **Trust and safety**
   - Government ID verification through a certified vendor, not direct public storage.
   - Provider background checks where legally and operationally available.
   - In-app reporting, emergency guidance, moderation queue, and incident audit trail.
   - Review abuse detection and rate limiting.

8. **Reliability**
   - Add automated web unit and integration tests.
   - Add Functions emulator tests and Firestore rules tests.
   - Add staging and production Firebase projects.
   - Add error tracking, uptime monitoring, Firestore dashboards, and alerting.
   - Add load testing for booking, chat, and payment webhook paths.

9. **Accessibility and performance**
   - Maintain WCAG 2.2 AA behavior across all routes.
   - Test screen-reader flows, keyboard-only booking, focus management, and reduced motion.
   - Split the admin bundle and lazy-load route chunks.
   - Add Lighthouse CI budgets for mobile and desktop.

10. **One contract, not three**
    - The booking, chat, verification, payout, and admin schemas currently exist three times: zod on the server, a hand-written TypeScript mirror in the web client, and a hand-written Dart map in the mobile client. The drift gate detects divergence; it cannot prevent it.
    - Generate both clients from the server schemas (shared package or codegen) so an interface that no longer matches a schema becomes a compile error instead of a runtime rejection.
    - Keep the callable name registry in one place so a renamed function cannot leave a live call site behind.

## Recommended release order

1. Complete Philippine localization and legal routes.
2. Deploy Firestore rules, indexes, storage rules, and security headers.
3. Deploy Cloud Functions and run emulator contract tests.
4. Convert web and mobile to authenticated live-data mode.
5. Integrate the payment provider in sandbox and verify signed webhooks.
6. Run security review and accessibility audit.
7. Launch a closed Philippine beta in selected Metro Manila cities.
8. Expand to Cebu and Davao after support and payment reconciliation are proven.

## Launch blockers

- A registered legal entity and support contact for the published terms.
- Payment provider production credentials and webhook verification.
- Government ID verification vendor and data-processing agreements.
- Production Firestore backup and incident response procedures.
- Legal review of Philippine consumer, labor, tax, and privacy requirements.
- Verified admin bootstrap and key rotation process.
