# ServEm — User-flow conformance report

**Sources:** [`ServEm_Customer_User_Flow.md`](../../sidehustle_marketplace_blueprint_v3/ServEm_Customer_User_Flow.md)
and [`ServEm_ServMate_User_Flow.md`](../../sidehustle_marketplace_blueprint_v3/ServEm_ServMate_User_Flow.md)
**Against:** the code in `apps/public-web`, audited and changed on 2026-10-13.

**How to read it.** Each row is one requirement from the flow documents.

| Status | Meaning |
|---|---|
| **Implemented** | The behaviour exists and is covered by `npm test` or `npm run test:e2e` |
| **Partial** | Something exists; the gap is named in the same row |
| **Missing** | Nothing exists |
| **Deliberate** | Not built, on purpose, with a reason |
| **Contradicted** | The flow's wording differs from the domain model; the mapping is stated |

---

## 1. Customer flow — §2 Step by step

| Flow step | Status | Evidence and gap |
|---|---|---|
| 1. Register, log in, recover an account | **Implemented** | `lib/auth.ts`, `app/api/auth/*`; Google/Apple with PKCE and `nonce` (`lib/oauth`) |
| 1. Email/phone verification | **Deliberate** | No address-verification channel exists; the settings page says so instead of implying it happened |
| 1. Authentication does not grant private access | **Implemented** | Session-scoped guards (`requireSession`, `requireServMate`), tested per route family in `test/e2e-live.mjs` |
| 2. Home with search, categories, Post a Job, offers, messages, notifications | **Implemented** | `/`, `/home`, `/search`, `/account/*`, `/account/notifications`, the shell's rail and bell |
| 2. Home feed must not expose other customers' private jobs | **Implemented** | Job posts are never listed publicly; `GET /api/services` is the storefront only |
| 1/3A. Customer searches for a service or chooses a category | **Implemented** | `/search` ranks ServMates and listings over the storefront's own read models (`lib/search.ts`, `test/search.test.ts`); `/home` keeps the category index and area chips |
| 3A. Discover ServMates with filters (location, price, rating, availability) | **Partial** | Category, area, price and sort exist (`ecommerce-home.tsx`); **rating and availability filters do not** — the data for availability is a free-text string, so a filter over it would be theatre |
| 3A. ServMate profile: bio, services, price, area, portfolio, reviews, verification | **Implemented** | `/providers/[providerId]`; verification badge only when `verificationStatus === 'verified'`, never self-asserted |
| 3B. Guided job form with draft saved before publication | **Implemented** | `job-post-form.tsx` creates a draft; `POST /api/jobs/[id]/publish` re-validates the stored draft |
| 3B. Preview, edit, pause, cancel, close by state | **Implemented** | `EDITABLE_JOB_STATUSES` in `lib/policy.ts`; a booked job refuses edits with `409` |
| 3B. Private matching enforced by the backend for feeds, search, APIs, notifications, media, exports, direct URLs | **Implemented** | `lib/matching.ts` is a pure predicate; `test/jobs-offers.test.ts` asserts a wider filter never widens the set; media re-checks on every read (`test/media-access.test.ts`) |
| 4. Receive and compare offers; notification per offer | **Implemented** | `/account/jobs/[jobId]`, `lib/notifications.ts` |
| 4. An offer is never shown as a confirmed booking | **Implemented** | Offer and booking are separate rows; acceptance is one transaction |
| 5. Confirmation summary before committing | **Implemented** | Accept path renders the agreed terms from the booking snapshot |
| 5. Backend validates eligibility, prevents duplicate acceptance | **Implemented** | Partial unique index equivalent: one live offer per provider per job; `test/jobs-offers.test.ts` |
| 5. Booking state and payment state recorded separately | **Deliberate** | No payment state exists at all — see §5 |
| 6. Job-linked chat, participants only, attachments authorized | **Implemented** | Membership is a stored row (`conversationParticipants`); `test/booking-lifecycle.test.ts`, `test/e2e-live.mjs` |
| 6. Read/unread state and notifications | **Implemented** | `lastReadAt` plus the read-receipt route (cross-site checked) |
| 6. Avoid exposing contact details or exact location before needed | **Implemented** | `locationBarangay`/`locationNotes` are `party`-level only |
| 7. Status timeline with explicit cancellation, expiration, dispute states | **Implemented** | `lib/policy.ts` transitions; **disputes are now reachable** (§3 below) |
| 7. Customer can edit/withdraw, compare, confirm, message, cancel | **Implemented** | As listed |
| 8. ServMate completes → customer confirms | **Implemented** | `requestCompletion` → `confirmCompletion`; the provider cannot skip the customer |
| 8. Customer can report an issue and hold finalization | **Implemented** | `POST /api/bookings/[id]/dispute` — new in this pass |
| 8. Dispute records the case and prevents automatic finalization | **Implemented** | It holds both sides of the booking, and an operator decides it at `/moderation` when the customer does not (verdict, reason, both parties told, audit row). What is missing is evidence, appeals and second-person review — §5 |
| 9. Payment status separate from service status, receipts, idempotent retries | **Deliberate** | §5 |
| 10. One eligible review per completed booking | **Implemented** | Unique `(bookingId, reviewer)` in `lib/reviews.ts`; a disputed or cancelled booking is never reviewable |
| 10. Review published only per policy | **Implemented** | `publicationStatus` plus aggregate computed from published rows |

## 2. Customer flow — §3 navigation and §5 screens

| Screen | Status | Note |
|---|---|---|
| Sign up / login / verification / recovery | **Implemented** | Recovery is new: `/reset` |
| Home, categories, search results, filters | **Implemented** | Search results are their own screen (`/search`), with recent terms kept on the device |
| ServMate profile and service details | **Implemented** | |
| Job wizard, media, preview, edit | **Implemented** | |
| Job detail and offer comparison | **Implemented** | |
| Offer details and acceptance confirmation | **Implemented** | |
| Booking summary and payment selection | **Deliberate** | No payment step to select |
| Job-linked messaging | **Implemented** | |
| Completion confirmation and dispute reporting | **Implemented** | Dispute reporting is new |
| Payment status, transaction history, receipt | **Deliberate** | §5 |
| Review submission | **Implemented** | |
| Notifications | **Implemented** | |
| Profile, privacy, blocked accounts, settings | **Implemented** | |
| **Saved addresses** | **Missing** | One free-text `area` per request; no address book. Adding one would require an address privacy model first |
| **Help and support** | **Partial** | FAQ on the storefront and clauses in `/terms`; no support portal |

## 3. Customer flow — §6 acceptance criteria

| Criterion | Status |
|---|---|
| Register, browse public services, open public profiles | Implemented |
| Create, preview, publish, edit, withdraw a job within permitted states | Implemented |
| Category required and validated by the backend | Implemented (`CATEGORY_ORDER` registry) |
| Only eligible ServMates retrieve a private job or its media | Implemented, tested both ways |
| No bypass by guessing IDs or calling endpoints directly | Implemented — refusal is `404` for absent and forbidden alike |
| Offers linked to the right job and ServMate; comparable before accepting | Implemented |
| Concurrent acceptance cannot double-book | Implemented (single-writer transaction; SQL mapping in `database-design.md`) |
| Booking and payment status separate and accurate | **Deliberate** — there is no payment status to keep accurate |
| Communication only when authorized | Implemented |
| Cancellation, rescheduling, payment failure, completion, disputes have explicit outcomes | **Partial** — cancellation, completion and disputes do; rescheduling and payment failure do not exist as states |
| Only eligible completed bookings can be reviewed | Implemented |
| Critical actions validated on the backend and covered by automated tests | Implemented — 119 unit tests, 213 e2e checks |

---

## 4. ServMate flow — §2 stages

| Stage | Status | Evidence and gap |
|---|---|---|
| 1. Register, verify, role permissions from the server | **Implemented / Partial** | Server-side capability flag (`isServMate`); **verification of the address is Deliberate**; rate limiting on auth endpoints **exists** (`lib/rate-limit.ts`, per address+email and per address) |
| 2. One profile: bio, skills, categories, pricing, area, portfolio, reviews | **Implemented** | `/servmate/profile`, `lib/servmate-profile.ts`. No separate shop — the flow's rule holds |
| 2. Profile states `draft → pending_review → active` (+ rejected/suspended/deactivated) | **Contradicted** | The model is `providerStatus: active\|paused\|suspended` plus `verificationStatus: unverified\|pending\|verified`. No `pending_review`, because there is no reviewer. Pausing and suspension exist and are enforced in matching |
| 3. Dashboard: feed, profile, categories, offers, bookings, messages, earnings, reviews | **Partial** | All present **except earnings and payment history** (§5) |
| 3. Empty, loading, error and offline states; no fake data in production | **Implemented** | Empty states throughout; demo rows are seeded only when `NODE_ENV !== 'production'` |
| 4. Eligible job feed: category, publication status, service area, account restrictions | **Implemented** | `lib/matching.ts`; `test/jobs-offers.test.ts` |
| 4. Deny-by-default; test cross-category leakage | **Implemented** | Cleaning-only vs plumbing-only cases are explicit tests |
| 4. Only the location precision needed at the stage | **Implemented** | City at `feed`, barangay/notes only at `party` |
| 5. Job detail shows budget, schedule, media, approximate location, status | **Implemented** | `/servmate/jobs/[jobId]` |
| 5. Server authorizes every job and media request | **Implemented** | `test/media-access.test.ts` |
| 6. Offer submission, idempotent duplicates, explicit states | **Implemented / Partial** | `pending / accepted / rejected / withdrawn / expired / category_changed`; the flow's `viewed` and `superseded` are **Contradicted** — no open-count exists, so `viewed` would be a lie, and `category_changed` replaces `superseded` for the one case that occurs |
| 7. Transactional booking creation; location revealed to confirmed parties | **Implemented** | `acceptOffer` in one transaction; projection levels handle the reveal |
| 8. Messaging authorization, attachments, report/block, rate-limited sends | **Implemented** | Authorization, attachments and report/block exist, sends are throttled at 30/minute (`messageSend` in `lib/rate-limit.ts`), and the reporter reads what they filed at `/account/reports` |
| 9. `confirmed → in_progress → completion_pending`; timestamps and actor ids stored | **Implemented** | `bookingStatusHistory` records actor, from, to, and now reason |
| 10. Completion → customer confirms → payment → earnings | **Partial / Deliberate** | Completion and confirmation exist; **payment and earnings do not** (§5) |
| 11. Reviews tied to real bookings, no duplicates, server-derived aggregates | **Implemented** | |
| 12. Manage profile, categories, areas, availability; category changes update eligibility | **Implemented** | Category/area writes are registry-checked; a category change marks live offers `category_changed` |
| 12. Pause or deactivate the profile | **Implemented** | `providerStatus` is set from the console; a paused profile stops receiving jobs |

**ServMate §3 state flows, §4 screens, §6 tests:** the offer, booking and review states are covered
above; the 15 suggested screens map to `/servmate`, `/servmate/jobs`, `/servmate/jobs/[jobId]`,
`/servmate/profile` and the notifications shell — **except** earnings/transactions (deliberate),
dispute screens (the state exists and both sides see it; there is no moderator screen), and a
dedicated help screen (partial).

---

## 5. Deliberate deferrals

These are not oversights; each is a decision the project already recorded, restated against the
flow documents.

1. **Payments, payment status, receipts, earnings.** The register forbids money moving before a
   provider, settlement rules and compliance review. Inventing a `paymentStatus` that no truthful
   actor could set would be worse than its absence: every surface says the two sides settle
   between themselves.
2. **Email/phone verification.** Needs a delivery channel; password recovery was the smaller,
   self-contained half of that channel and is now built. Verification remains open.
3. **Rate limiting.** Same-origin checks, bounded bodies and uniform replies cover the
   enumeration risks, and fixed-window counters now throttle the auth and mutation routes
   (`lib/rate-limit.ts`). The counter shared across processes stays grouped with the other
   abuse controls in `PROJECT_ROADMAP.md` §8.
4. **Evidence, appeals and second-person review in moderation.** The console exists
   (`/moderation`, `lib/moderation.ts`) on its own credential rather than an account session, and a
   case can be claimed, closed or decided with an audit row. What is *not* built is the process a
   real dispute needs: attachments, an appeal, and a second operator's agreement before a
   consequential verdict. One operator can decide alone today, which is a process control rather
   than a code one (see `docs/security/threat-model.md`, assumption 4).
5. **Saved addresses, availability calendars, help portal.** Address book needs a privacy model;
   availability is a human string today; help is FAQ plus terms.

---

## 6. What changed after this report

Later passes, kept here so the statuses above are read against the code as it stands now:

- **Rate limiting** (`lib/rate-limit.ts`, third pass): fixed windows per bucket and identity on
  sign-in, sign-up, recovery, message sends, reports, uploads, job posts and offers, answering
  `429` with `Retry-After`. The counter is in-process; `PROJECT_ROADMAP.md` §8 keeps the shared
  limiter as a launch item.
- **The reporter's own view** (fourth pass): `GET /api/reports/mine`, `listOwnReports` and
  `/account/reports`. Reporting had no readable end, which is the same row as "filing a report is
  a black hole" — now closed for the reporter.
- **The moderation console** (fifth pass): `/moderation`, `lib/moderation.ts` and
  `lib/moderation-access.ts`. The operator half of both queues, on the deployment's own credential
  rather than a customer session, with an append-only audit trail and a verdict that runs through
  the booking state machine so both parties are told.

## 6b. The interface pass (sixth)

Not a conformance change — the rows above describe behaviour, not furniture — but the screens were
rebuilt, so the evidence column is worth reading against the app as it now stands.

- **One app frame** (`app-shell.tsx`): a rail on a wide screen, a tab bar on a phone, and a search
  field that is a real form to `/search`. The account area's repeated identity header and pill tabs
  are gone.
- **Identity facts live in Settings only**, which is now a hub of rows that carry their current value
  and open their own screen (`/account/settings/{security,notifications,privacy,selling,about}`).
- **Search is a screen** (`/search`, `lib/search.ts`), and **messages is two panes** with the thread
  list beside the open conversation.
- `?service=<id>` opens a listing's booking sheet, so "Book again" reaches the exact service rather
  than the marketplace in general.

## 7. What changed because of this report

- **Password recovery** (`/reset`, `POST /api/auth/password-reset`, `POST .../complete`,
  `lib/password-reset.ts`, `lib/email.ts`) — closes step 1's "account recovery".
- **Disputes became reachable** (`POST /api/bookings/[id]/dispute`, `openDispute` /
  `resolveDispute`, `DisputeControls`) — the `disputed` status existed with a label and nothing
  that could enter it. A dispute now blocks completion, confirmation and review on both sides.
- **Credential primitives moved to `lib/passwords.ts`** so the hashing rules can be tested
  outside the request cycle; `lib/auth.ts` re-exports them.
- Verified: `npx tsc --noEmit` clean, `npm test` 91 passing, `npm run build` succeeds,
  `npm run test:e2e` 167 checks passing.
