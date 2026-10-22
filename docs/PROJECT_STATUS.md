# ServEm — Project Status

**Last updated:** 2026-10-18
**Branch:** `servem/domain-foundation`
**Application root:** `apps/public-web`

This document states what is implemented, what is partial, and what is deliberately not
switched on. It is written against the code, not against the blueprint's ambitions: where the
two differ, the difference is named here rather than implied.

---

## Technology

| Layer | What is in use |
|---|---|
| Framework | Next.js 16.4 (App Router, Route Handlers), React 19.3, TypeScript 5.9 |
| Styling | Plain CSS custom properties — `app/globals.css`, `app/feed.css`, `app/servmate.css`. No Tailwind, no UI kit |
| Fonts | Fraunces (display), Archivo (body), Space Mono (utility) |
| Datastore | One JSON file, `.data/servem.json`, behind `lib/store.ts` (or `SERVEM_DATA_DIR`) |
| Media bytes | Files under `<store dir>/media/`, served only through an authorization-checked route |
| Auth | scrypt password hashes with a per-account salt, Google/Apple OAuth with PKCE, 30-day session cookie |
| Money | Integer centavos, PHP only, formatted at the edge |

The JSON store is a local-development stand-in for the PostgreSQL design in
`docs/architecture/database-design.md`. It is single-process and single-machine. Its two
useful properties are that every collection already matches the target logical model, and that
reads and writes funnel through one promise chain, which is what makes offer acceptance atomic
here in the same way a row lock would in SQL.

---

## Implemented and exercised

| Area | Status | Evidence |
|---|---|---|
| Account, sign-in, sessions, OAuth | ✅ | `lib/auth.ts`, `app/api/auth/*`, `/account/settings` |
| Password recovery over email | ✅ | `lib/password-reset.ts`, `lib/email.ts`, `/reset`; needs `RESEND_API_KEY` |
| Customer profiles and preferences | ✅ | `lib/profile.ts`, `lib/preferences.ts` |
| Private job posts (draft → published → closed) | ✅ | `lib/jobs.ts`, `/account/jobs`, `/account/jobs/new` |
| Private category + area matching | ✅ | `lib/policy.ts`, `lib/matching.ts`, `/servmate/jobs` |
| Offers: submit, withdraw, decline, accept | ✅ | `lib/offers.ts`, `/servmate/jobs/[jobId]` |
| Booking lifecycle and status history | ✅ | `lib/bookings.ts`, `bookingStatusHistory` rows |
| Disputes: reported, held, withdrawn or closed | ✅ | `lib/bookings.ts` (`openDispute`/`resolveDispute`), `/api/bookings/[id]/dispute`, `test/dispute.test.ts` |
| Reviews, computed rating aggregates | ✅ | `lib/reviews.ts`, provider page reviews section |
| Private job media (photos and video) | ✅ | `lib/media.ts`, `/api/media/[assetId]`, `test/media-access.test.ts` |
| Notifications and unread counts | ✅ | `lib/notifications.ts`, `/account/notifications`, the shell bell |
| Blocking, enforced in matching both ways | ✅ | `lib/trust.ts`, `lib/policy.ts` |
| Reports: filing, and reading your own | ✅ | `lib/trust.ts`, `TrustControls`, `GET /api/reports/mine`, `/account/reports` |
| Moderation console: reports and disputes | ✅ | `lib/moderation.ts`, `lib/moderation-access.ts`, `/moderation`, `moderationActions` audit rows; needs `SERVEM_MODERATION_TOKEN` |
| Provider console: profile, matching, listings | ✅ | `lib/servmate-profile.ts`, `/servmate/profile` |
| Portfolio and work updates | ✅ | `lib/portfolio.ts`, `/servmate/profile` |
| Cross-site write protection on every mutation | ✅ | `lib/http.ts`, asserted per route family in `test/e2e-live.mjs` |
| Rate limiting on auth and mutation routes | ✅ | `lib/rate-limit.ts` — 429 + `Retry-After`, `test/rate-limit.test.ts`, live quota checks in `test/e2e-live.mjs` |
| Browser security headers | ✅ | `next.config.ts` — CSP, frame-ancestors/X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, prod-only HSTS; asserted on every e2e run |
| Account deletion and retention | ✅ | `lib/account-deletion.ts`, `DELETE /api/account`, `test/account-deletion.test.ts`, the settings confirmation flow |
| Live refresh for messages and alerts | ✅ | `app/components/live-refresh.tsx` (visibility/focus aware), the bell's own clock; no socket, no cached private page |
| Search as a mode | ✅ | `app/components/feed/search-combobox.tsx`, `GET /api/search/suggest`; the top bar field exists on every screen and width |
| Saved services as a shortlist | ✅ | `/shortlist`, `app/components/feed/shortlist.tsx` — a board of equal cards (one column on a phone, four across on a wide screen), device-local like the bookmarks it reads |
| A listing's own page, with similar services | ✅ | `/services/[serviceId]`, `getServiceDetail` in `lib/servmate-profile.ts` — public (no session needed), the description, the ServMate, reviews and three ranked alternatives |
| Installable app and offline shell | ✅ | `app/manifest.ts`, `public/sw.js`, `/offline`, `app/components/pwa-register.tsx`; worker registers in production builds only |
| CI gate | ✅ | `.github/workflows/ci.yml` — install, typecheck, unit tests, build, then the live e2e run with a disposable moderation token |

---

## Partial — implemented with a stated limit

| Area | What exists | What is missing |
|---|---|---|
| Media storage | Signature-checked upload, private bytes, authorized delivery | Bytes go through the app as base64 and live on local disk. Production needs object storage plus signed upload intents |
| Notifications | Records, feed, unread counts, mark-read | No email/SMS/push channel is connected, so delivery is in-app only |
| Verification | `verificationStatus` on every profile, never asserted in the UI | No verification process or reviewer role |
| Location | City and barangay fields, coverage-area matching, exact address withheld until authorized | No geocoding, no distance search, no map picker |
| Availability | A listing's availability is a short human string | No calendar or per-day windows, so no rule pretends to check one |
| Booking disputes | Reachable by the customer, freezes the booking, and decidable by an operator at `/moderation` | No evidence upload and no appeal; one operator can decide alone |
| Counteroffers | Offers carry a `revision` field | No counteroffer command or UI |
| Report moderation | The reporter reads their own, and an operator works the queue and records an outcome with a note | No action beyond recording one — a report cannot suspend or remove anything yet |
| Profile images | Portfolio and post images are stored and served | No avatar or cover image upload |
| Account deletion | Personal data is erased at once, sessions end, finished bookings survive as the counterparty's record, and a purge removes the tombstone | The purge is a function, not a scheduler: a deployment must run `purgeDueAccounts` nightly |
| Offline shell | Manifest, icons, service worker and an offline document | Registration is production-only, so it is not exercised by the dev-server e2e run |
| Email delivery | Password recovery speaks Resend; notifications are in-app records only | Needs `RESEND_API_KEY` and a verified sending domain. Without them the channel is disabled, not broken |

---

## Deliberately not enabled

| Area | Why |
|---|---|
| Payments and payouts | §9 — money must not move before provider integration, compliance and settlement rules are approved, and no PSP account or keys exist yet. A booking records the agreed price; the two sides settle between themselves. See `PROJECT_ROADMAP.md` §1 for the blocker |
| Identity verification (KYC) | Needs a chosen provider, a paid contract and a reviewed data-retention agreement. `verificationStatus` stays unasserted until a pass exists, which is why no badge claims otherwise |
| Two-factor authentication | Waiting on the identity-provider decision. The settings page states this rather than faking it |
| Email/phone verification | Needs a delivery channel. Password recovery built the smaller half of one (`lib/email.ts`); verification itself is still an open decision |
| Public catalog | `GET /api/services` reads a configured catalog source; without one it answers 503 rather than inventing listings |

---

## Verification at this revision

```
npx tsc --noEmit                 # clean
npm test                         # 130 tests, 0 failures
npm run build                    # succeeds; every route compiled
SERVEM_MODERATION_TOKEN=… npm run test:e2e   # 245 live checks, 0 failures
```

`npm run test:e2e` drives a running server over real HTTP with real session cookies: sign-up,
provider onboarding, job publication, discovery by eligible and ineligible providers, media
authorization, competing offers, offer acceptance, the whole booking state machine, disputes,
password recovery, reviews, notifications, blocking, reporting and the reporter's own view of it,
rate-limit refusals, the moderation console's refusals and its privileged path, the provider
console's own writes, the security headers on every response, search suggestions, the installable
manifest and offline document, the shortlist and search screens, a listing's public page and its
card's link to it, and account deletion's refusals, confirmation and re-registration paths.

The conformance of both blueprints' user-flow documents with this code is recorded row by row in
[`docs/requirements/user-flow-conformance.md`](requirements/user-flow-conformance.md).

---

## Known limitations

1. The JSON store is not a production datastore. Concurrent writes across processes are not
   supported; the single-writer promise chain only protects one process.
2. Seeded demo ServMates exist only in development (`SERVEM_SEED`), and are never presented in a
   production build.
3. Rate limiting is in-process (`lib/rate-limit.ts`): fixed windows per bucket on sign-in,
   sign-up, recovery, messages, reports, uploads, job posts and offers. One process holds the
   counter, so a shared edge/Redis limiter is required before running more than one instance.
4. There is no audit log beyond `bookingStatusHistory` and the report queue.5. Media upload bodies are base64 in JSON, which caps practical file size at a few MB and costs a
   third more bandwidth than a raw body.
6. A page that calls `notFound()` answers HTTP `200` with the not-found document, because the root
   layout has already streamed by then. This is app-wide (an unknown provider or job id behaves the
   same); it means an unconfigured `/moderation` is a `404` document served with a `200`, not a
   `404` status. A `redirect()` on a streamed page behaves the same way: the guard fires, but the
   response is a `200` carrying the client redirect. Fixing it belongs at the app level.
7. The CSP allows inline scripts because the App Router emits its bootstrap inline and no nonce
   pipeline is wired yet. Inline code is still confined to this origin, so an injected tag cannot
   load a payload from elsewhere; a nonce in middleware is the next hardening step.
8. Account deletion's scheduled half is a function (`purgeDueAccounts`) invoked by the delete route
   and by no scheduler. A production deployment needs a nightly job; until then a tombstone lives
   until somebody deletes an account again.
9. The service worker is registered only in a production build. The dev-server e2e run checks the
   manifest and the offline document, not an actual install/offline reload.
