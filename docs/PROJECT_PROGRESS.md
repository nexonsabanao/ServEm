# ServEm — Implementation Progress Log

The blueprint's §18 phases, recorded as they were actually completed in this repository. Each
entry names the files that carry it and the command whose output backs the claim.

---

## Phase 1 — Repository audit (complete)

- Stack confirmed: Next.js 16 App Router, React 19, TypeScript 5.9, one JSON store behind
  `lib/store.ts`, no CSS framework.
- Baseline commands: `npx tsc --noEmit`, `npm test`, `npm run build`.
- Gaps recorded in this log's later phases and summarised in `PROJECT_STATUS.md`.

## Phase 2 — Requirements and data model (complete)

- Data model written as `lib/store.ts` collections: users, sessions, servmate profiles,
  categories, coverage, listings, job posts, job media, offers, bookings, status history,
  conversations, participants, messages, media assets, portfolio, work posts, reviews,
  notifications, blocks, reports, pending auth.
- Every collection matches the target logical model in `docs/architecture/database-design.md`,
  so a move to SQL is a repository swap rather than a redesign.

## Phase 3 — Identity and capabilities (complete)

- `lib/auth.ts`: scrypt hashing, session issue/read/end, `requireSession`, `requireServMate`,
  `getSessionProfile`.
- Capability is a flag beside the customer profile, so one account can be both sides (§1).
- `POST /api/servmate/onboard` enables provider capability idempotently.

## Phase 4 — Profiles, categories and listings (complete)

- `lib/servmate-profile.ts`: category registry, coverage, listings, provider views, and the
  provider's own write surface — `updateOwnProfile`, `createListing`, `updateListing`,
  `setListingPublication`, `deleteListing`, `listOwnListings`.
- Routes: `GET|PATCH /api/servmate/me`, `GET|POST /api/servmate/me/services`,
  `PATCH|DELETE /api/servmate/me/services/[id]`, `POST .../publish`,
  `PUT /api/servmate/me/categories`, `PUT /api/servmate/me/coverage`.
- `/servmate/profile` is the console: profile facts, matching settings, listings, portfolio,
  work updates — each section writing through its own endpoint.

## Phase 5 — Customer jobs (complete)

- `lib/jobs.ts`: facts validation, draft creation, editing while live, publication with
  re-validation, cancellation that withdraws live offers in the same transaction.
- Routes: `POST /api/jobs`, `GET /api/jobs/mine`, `GET|PATCH /api/jobs/[id]`,
  `POST /api/jobs/[id]/publish`, `POST /api/jobs/[id]/cancel`.
- **Job media** added after the audit: `lib/media.ts` stores bytes outside any served path and
  releases them only through `GET /api/media/[assetId]`, which re-decides authorization per
  request. Uploads are allowlisted by MIME *and* checked against the file's leading bytes.

## Phase 6 — Private matching (complete)

- `lib/policy.ts` holds every "may this person see or do this?" answer; `lib/matching.ts` runs
  the eligibility rule over stored jobs and returns a safe projection.
- Discovery returns the city, never the barangay or the access notes. A guessed id answers
  exactly like a forbidden one, at the feed, the detail route, and the media route.
- Filters only narrow an already-authorized set; there is no filter that can widen it.

## Phase 7 — Offers and messaging (complete)

- `lib/offers.ts`: submit, withdraw, decline, and a transactional accept that books the job,
  withdraws the other live offers and closes the job.
- A category change on a live job marks pending offers `category_changed` rather than deleting
  them, so a provider sees why their offer stopped being live.
- Conversations carry a job, offer or booking reference; membership is a stored row.

## Phase 8 — Bookings and reviews (complete)

- `lib/bookings.ts`: `confirmed → in_progress → completion_pending → completed`, with
  cancellation and a `bookingStatusHistory` row per move.
- `lib/reviews.ts`: a review requires a completed booking, is written by its customer once, and
  the rating shown anywhere is computed from published reviews rather than stored.

## Phase 9 — UI/UX (complete)

- The design system is three CSS files over shared custom properties; the marketplace reads as
  one product across storefront, account area, provider feed and console.
- Loading, empty, error and refusal states exist on every asynchronous surface added here.

## Phase 10 — Verification (complete)

```
npx tsc --noEmit                 # clean
npm test                         # 76 tests, 0 failures
npm run build                    # succeeds
npm run test:e2e                 # 147 live checks, 0 failures
```

---

## Work added beyond the original audit (first pass)

- **Notifications** (§10.10): `lib/notifications.ts`, `/api/notifications`,
  `/api/notifications/read`, `/account/notifications`, and a shell bell with an unread badge.
- **Trust and safety** (§10.11, §14): `lib/trust.ts` with blocking (enforced in matching both
  ways) and reporting (a moderation record that changes nothing about visibility).
- **Portfolio and work posts** (§5.3, §5.7): `lib/portfolio.ts`. Work from a completed booking is
  labelled verified and the claim is checked against the booking; everything else is labelled
  self-published.
- **Job media** (§4.4 step B, §6.4).
- **Provider console** (§5.2–5.4).

## Work added beyond the original audit (second pass — user-flow conformance)

Driven by the two flow documents in `sidehustle_marketplace_blueprint_v3/`, audited row by row in
`docs/requirements/user-flow-conformance.md`:

- **Password recovery.** `lib/passwords.ts` (credential primitives, extracted from `lib/auth.ts` so
  they are testable outside the request cycle), `lib/email.ts` (Resend over `fetch`, with an
  explicit `not_configured`), `lib/password-reset.ts` (single-use, SHA-256-stored, 60-minute token;
  a reset ends every session), `POST /api/auth/password-reset`, `POST .../complete`, `/reset`, and
  "Forgot your password?" in the sign-in dialog.
- **Disputes became reachable.** The `disputed` status existed with a label and nothing that could
  enter it. `openDispute` / `resolveDispute` in `lib/bookings.ts`, `POST /api/bookings/[id]/dispute`,
  `DisputeControls` on the job page, and a held notice on the provider's work actions.
- **Docs required by §17** were written in the first pass; this pass added
  `docs/requirements/user-flow-conformance.md` and updated the status, roadmap, API surface and
  testing documents.
- **The mobile bottom nav stopped swallowing taps.** It is a five-item grid still sized for
  four (`.app-bottomnav`, `app/feed.css`), so on a phone-width screen it wrapped to two rows and
  covered the last control on the page — the "Post job" button was underneath it and taps hit
  the nav's Home item instead. Found by driving the real form in a browser during verification,
  not by a test; the grid now matches the five items it holds.

```
npx tsc --noEmit                 # clean
npm test                         # 91 tests, 0 failures
npm run build                    # succeeds
npm run test:e2e                 # 167 live checks, 0 failures
```

## Work added beyond the original audit (third pass — abuse controls)

Driven by the blueprint's §14 threat list and `TEST_STRATEGY` §2 (authentication/authorization):

- **Rate limiting** (`lib/rate-limit.ts`): fixed windows per bucket and identity. Sign-in counts
  the address+email pair first, then the address alone, so neither a single-account stuffing run
  nor a spread across accounts from one source gets unlimited attempts. Sign-up is per address
  and deliberately loose (carrier-grade NAT shares addresses across households). Recovery counts
  address+email, then address, then link redemption. Messages, reports, media uploads, job posts
  and offers each count per signed-in account.
- A refusal is `429` with `Retry-After`, `Cache-Control: no-store`, and one message that reveals
  nothing about whether the account or the credentials were close. Buckets are overridable with
  `SERVEM_RATE_LIMIT_<NAME>=count/minutes` so a test environment can loosen them without editing
  code, and the module states its two honest limits instead of hiding them: the counter lives in
  this process, and an anonymous identity is coarse.
- Proved by `test/rate-limit.test.ts` (8 cases: exact quota, window reset, bucket isolation,
  tighter-counter precedence, environment overrides and their fallback, forwarded identity, the
  429 shape) and five live checks in `test/e2e-live.mjs` — exhaustion answers 429 inside the
  shipped quota, with a `Retry-After`, never cached, and a different pair still served after the
  refusal.

```
npx tsc --noEmit                 # clean
npm test                         # 99 tests, 0 failures
npm run build                    # succeeds
npm run test:e2e                 # 172 live checks, 0 failures
```

## Work added beyond the original audit (fourth pass — the reporter's own view)

Driven by the roadmap's "small things worth doing early": reporting was write-only, so a filed
report looked exactly like giving up.

- **`GET /api/reports/mine` and `/account/reports`.** The reporter is read from the session, so
  the route cannot be aimed at somebody else's queue, and the page shows each report's reason, its
  subject, what was written, and where it stands. The status words come from
  `REPORT_STATUS_LABELS` beside the other status maps rather than a second copy in the page.
- **The subject is re-decided, not remembered.** `listOwnReports` in `lib/trust.ts` names a job
  only while the account that reported it could still open that job; once their categories change
  and the job is no longer theirs, the row says so instead. Filing is the one moment entitlement is
  certain (`reportContent` checks it), and a row outlives that moment.
- **Honest about the missing half.** The moderator case list is still not built, so the page says a
  report is a record a person reviews and never implies an outcome; `§5` of the conformance report
  keeps that deferral.
- **`"type": "module"`** in `apps/public-web/package.json`, which removes the Node test-runner's
  “reparsing as ES module” warning. No `.js`/`.cjs` config file exists to conflict with it (the one
  config is `next.config.ts`).
- Proved by two cases in `test/trust.test.ts` (own-list scoping and the job-title rule above) and
  ten live checks in `test/e2e-live.mjs` — the API scoped to the caller, the page rendering the
  filed report, and the signed-out caller refused both.

```
npx tsc --noEmit                 # clean
npm test                         # 101 tests, 0 failures
npm run build                    # succeeds
npm run test:e2e                 # 182 live checks, 0 failures
```

## Work added beyond the original audit (fifth pass — the operator console)

Reports and disputes were both reachable but had no readable end for the marketplace, so an
outcome could only ever exist out of band. This pass built the other half.

- **A credential that is not an account.** `SERVEM_MODERATION_TOKEN` is a server secret; the console
  cookie carries only `sha256(token)`; a configured token shorter than 24 characters is treated as
  unset. No account can promote itself in, and there is no session a customer could reuse. The
  threat model asked for exactly this separation, so it is stated there rather than implied here.
- **One refusal for every reason.** Unconfigured, wrong token, rotated token, signed-in customer,
  absent case: the same `404` with the same message. An unconfigured deployment has no console at
  all rather than a locked one, and a locked console renders one form and no case data.
- **`moderationActions`**, an append-only audit collection. A report's outcome records the operator
  label and the note; a dispute verdict is written in the same transaction as the booking move, so a
  booking can never carry an outcome with no record of who imposed it.
- **The verdict goes through the state machine, not around it.** `applyModeratorOutcome` reuses
  `transition` with a third actor side, so the move still has to be legal from `disputed`, still
  mirrors the job, still writes `bookingStatusHistory`, and now notifies *both* parties — because
  an operator's move interests both of them, which is the one case where the counterparty rule is
  not enough.
- **A case list that is a case, not a table row.** Reason, who reported it, what was reported, the
  reported content itself (a job's description, or the one message named — never its thread), the
  status timeline of the frozen booking, and every action already taken on the case, beside the
  controls that act on it.
- **Two defects found and fixed while verifying in a browser:** the dispute card showed "Work order"
  because a booking made from an accepted offer carries no `serviceTitle` snapshot (the job's title
  is now read for it — otherwise an operator decides every dispute without knowing what the work
  was), and both verdict buttons rendered as primary, so the destructive one looked like the
  affirmative one (they now carry distinct visual weight).
- Proved by ten cases in `test/moderation.test.ts` — every denial path, the digest-versus-token
  distinction, the note requirement, the audit row, the booking and job move, both parties notified,
  and a decided case still readable — plus thirty-one live checks in `test/e2e-live.mjs`: the
  refusals always, and the privileged path when the script is given the same token as the server.

```
npx tsc --noEmit                 # clean
npm test                         # 111 tests, 0 failures
npm run build                    # succeeds
npm run test:e2e                 # 213 live checks, 0 failures
```

## Work added beyond the original audit (sixth pass — the app frame and its screens)

Every signed-in screen repeated the same three things — a name, an email and a join date in a dark
card, a row of pill tabs, and a paragraph explaining the system — and the controls that looked like
doors ("Book again", the search field) landed somewhere other than the thing they named. This pass
replaced the furniture with one frame and gave each screen a single job.

- **One frame: `app-shell.tsx`.** A rail beside the content on a wide screen (Home, Search,
  Messages, Requests, Jobs, Alerts, then *Your account*, then *Selling on ServEm*), a bottom tab bar
  under the thumb on a phone, and a search field that is a real `GET` form to `/search` — so search
  works before any JavaScript loads and a query is a URL. The storefront's own pill tabs and the
  account area's identity header are gone; `account-tabs.tsx` was deleted rather than left unused.
- **Who you are appears once.** The name, email and join date moved out of the account layout and
  into Settings, which is the only screen that shows them. The shell carries an avatar and a first
  name because that is app furniture, not a profile.
- **Settings is a list of states, not an essay.** `/account/settings` is a hub of rows that each
  carry their current value ("Nobody blocked", "2 of 5 switched on") and open a screen of their own:
  `security`, `notifications`, `privacy`, `selling`, `about` — one `SettingsScreen` header and one
  `SettingsRow`, so drilling in and backing out is one gesture. The walls of explanation became one
  line per control, and the controls that genuinely do nothing yet keep a short honest label.
- **Search is a screen.** `lib/search.ts` is a pure, tested ranker over the same read models the
  cards render (a listing is searchable through the provider who would do the work; a field that
  starts the term beats one that contains it; ties break on rating). `/search` renders ServMate rows
  and bookable tickets, keeps recent terms on the device, and hands a result to the storefront's own
  booking dialog — an answer can be acted on without going back to Home.
- **Messages is two panes.** The thread list lives in `app/(app)/account/messages/layout.tsx` so it does
  not re-mount between conversations; `MessagesFrame` steps it aside below 900px so a phone shows
  one conversation at a time, and the thread's back link returns to the list.
- **Every action lands somewhere.** `?service=<id>` on Home opens that listing's booking sheet, which
  is what "Book again" and "View service" now point at instead of the marketplace in general. The
  provider console (`/servmate`, `/servmate/jobs`) moved inside the same frame, so arriving on the
  selling side is no longer a place you can lose the way out of.
- **A real environment defect, found while verifying in a browser.** The preview panel serves the app
  from `127.0.0.1` while the dev server announces itself as `localhost`; Next blocks dev-only
  resources for an origin it does not recognise, which left the page as static HTML with nothing
  hydrating — every menu, rail and menu button silently dead. `allowedDevOrigins` now lists both
  loopback spellings. This was pre-existing and is the reason browser checks in earlier passes could
  only read text out of the markup.

```
npx tsc --noEmit                 # clean
npm test                         # 119 tests, 0 failures
npm run build                    # succeeds
npm run test:e2e                 # 213 live checks, 0 failures
```

## Work added beyond the original audit (seventh pass — the launch gates)

Driven by `sidehustle_marketplace_blueprint_v3/upgrades`, the twelve must-do items recorded there.
The ones with no external dependency were built; the rest are named at the end with the decision
or credential that blocks them.

- **Security headers.** `next.config.ts` now carries one `headers()` block: a fail-closed CSP
  (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin`,
  a Permissions-Policy that turns camera, microphone, location and payment off, and HSTS in
  production only. The two inline allowances are stated in the file: Next's bootstrap script and
  next/font's style. Dev adds `'unsafe-eval'` and the HMR websocket, and is asserted to omit HSTS.
- **Account deletion.** `lib/account-deletion.ts` implements the policy the settings page used to
  defer. Live work — a booking either side can still move, or an open job — refuses deletion with
  the exact rows named and linked. Otherwise the person is erased in one transaction: password,
  identities, preferences, profile, listings, portfolio, work posts, media rows (and their bytes),
  notifications, blocks, password resets and every session. Finished bookings survive as the
  counterparty's record with their title snapshotted before the job row goes, and the person shows
  as “Deleted account”. A tombstone keeps the id those bookings point at for 30 days; the purge then
  removes it and detaches the bookings. `DELETE /api/account` requires the literal word DELETE and,
  where one exists, the current password; the browser's session cookie is cleared in the response.
- **Search as a mode.** The top-bar field is now a combobox (`search-combobox.tsx`) that works on
  every screen and every width, with recent terms, live matches from `GET /api/search/suggest`, and
  arrow-key navigation. Underneath it is still a real `GET` form, so search survives without
  JavaScript. The `is-search-view` class and the ≤860px field-swapping are gone; the search screen's
  own field remains the page's focal control rather than the only way to search.
- **Saved services became a shortlist.** `/shortlist` lays the saved listings out as equal cards
  asking the same six questions in the same order — rate, rating, replies, area, availability,
  category — so four of them read across like a table and one of them reads down like a product.
  The board is one column on a phone (it used to be a 660px table you had to scroll sideways to
  compare), keeps its column width on a wide screen instead of stretching two services into two
  half-screen panels, and clamps each title to two lines so the fact rows stay level from card to
  card. It reads and writes the same device store as the bookmark buttons, through one
  `useSavedServices` hook shared with the feed, search and a listing's own page, caps the board at
  four, and says that the list is on this device rather than implying an account-synced one.
- **A listing has its own page.** `/services/[serviceId]` is the product page a card now opens: the
  picture and the one action above the fold, the listing's own description, the ServMate behind it,
  the first three reviews, and three alternatives ranked by category and area (same category and
  area first, then same category, then same area — nothing that shares neither is recommended). It
  is deliberately outside the signed-in route group: a product page has to open for the visitor who
  has not signed in, so `PublicShell` renders the same frame from its own session read and sends
  "sign in" through the storefront's existing `/?signin=1` door instead of a second auth dialog. The
  read model is `getServiceDetail` in `lib/servmate-profile.ts`, beside the card readers; the card
  projection itself stays thin, because a description is only read once someone opens the listing.
  The feed's unused `providerCards` and `fromCentavos` exports went with it.
- **The home hero stopped repeating itself.** The "20 local services · Cavite" line above the title
  is gone — the area control beside it already names where the customer is and the result line
  below states the count — and the category tabs are vertically centred instead of sitting on the
  top edge of their pills.
- **Installable app and offline shell.** `app/manifest.ts`, generated 192/512/maskable icons, a
  service worker that caches only the offline document and immutable static assets (never `/api`,
  never a rendered page), and `/offline`. Registration is production-only, so the dev server is
  never served a stale chunk by its own worker.
- **Live refresh without a socket.** `LiveRefresh` re-renders the messages frame and the alerts
  screen on a slow clock and on focus/visibility, but never while a field has focus or a dialog is
  open; the bell polls its count on the same rules. The thread syncs its local list from the fresh
  server render, so a reply that arrived while reading appears without a reload.
- **CI.** `.github/workflows/ci.yml` runs install, `tsc --noEmit`, `npm test`, `npm run build`, then
  the live e2e suite, generating a throwaway moderation token so the privileged half runs too. It
  notes the missing lockfile: until one is committed the install is `npm install`, not `npm ci`.
- **Proved by** six new cases in `test/account-deletion.test.ts` (live-work refusal, password
  requirement, erasure plus title snapshot, tombstone identity, provider-side removal, purge and
  detachment) and new live checks for the launch surfaces: the header set, the suggestion endpoint, the manifest
  and worker, the offline document, the shortlist and search screens, the card-to-listing link and
  the listing page's public read, and deletion's signed-out, wrong-word, wrong-password, blocked,
  successful and re-registration paths.

```
npx tsc --noEmit                 # clean
npm test                         # 130 tests, 0 failures
npm run build                    # succeeds
SERVEM_MODERATION_TOKEN=… npm run test:e2e   # 245 live checks, 0 failures
```

### Named blockers, not omissions

- **Payments (PayMongo).** The spec-shaped work is documented and the booking already records an
  immutable agreed amount, but no PSP account, keys or settlement agreement exist, and the directory
  itself says there must be no escrow claim. Implementing signature verification or a checkout
  without the provider's confirmed contract would be guessing at the one integration where a guess
  costs money. The blocker is a PayMongo merchant account plus a decision on the refund model.
- **Identity verification (KYC).** Needs a provider choice, a paid contract and a retention
  agreement for ID documents. `verificationStatus` stays unasserted until that pass exists.
- **Durable rate limiting.** `lib/rate-limit.ts` is explicitly process-local; the upgrade says to
  move it when the datastore does. It is blocked on the SQL migration, not forgotten.
- **Datastore migration.** The JSON store is still the largest limitation. A safe swap touches every
  domain module and needs a parallel-acceptance test; it is a dedicated pass, not a rider on this
  one. `query`/`transact` remain the seam.
- **Resend activation.** The transport is written and reports `not_configured`; turning it on needs
  `RESEND_API_KEY` and a verified `EMAIL_FROM` domain. Notification emails are not wired yet, so
  even with a key only recovery mail would send.

## Deliberate omissions, with reasons

Recorded in `PROJECT_STATUS.md` under "Partial" and "Deliberately not enabled": payments,
account deletion, two-factor authentication, email/phone verification, geocoding, availability
calendars and counteroffers. Password recovery, disputes, the moderation console and a reader for
one's own reports were on this list in earlier passes and have since been built; what remains of
the moderation story is evidence, appeals and second-person review, which `PROJECT_ROADMAP.md` §4
now records.
