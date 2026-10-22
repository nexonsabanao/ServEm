# ServEm public website

Responsive Next.js public marketplace interface based on the ServEm production blueprint.

## Run locally

1. Select the repository package manager and create its lockfile after closing decision D-004 in `../../sidehustle_marketplace_blueprint_v3/docs/DECISION_REGISTER.md`.
2. Install the dependencies in this directory with the selected package manager.
3. Start the site with that manager's `dev` script.

Without `API_BASE_URL`, a development run displays clearly marked synthetic design-preview listings. In production, an unset API URL shows an unavailable-catalog state and does not show sample listings.

## Accounts and booking requests

Local development runs a self-contained account and booking flow so the interface can be
used end to end without the blueprint API:

- `POST /api/auth/signup`, `POST /api/auth/signin`, `POST /api/auth/signout`, `GET /api/auth/session`
- `GET /api/auth/providers` (which social providers are configured), `GET /api/auth/oauth/{google|apple}/start`, and the matching `callback`
- `GET /api/bookings` (the signed-in account's requests), `POST /api/bookings`

Passwords are hashed with scrypt and a per-account salt. Sessions are random tokens in an
`HttpOnly`, `SameSite=Lax` cookie; sign-out deletes the token server-side. State-changing
routes reject cross-site Origins, and every booking is scoped to the session's account id
rather than anything the browser supplies.

## Jobs, offers and discovery

A customer can post a job privately and collect competing offers on it:

- `POST /api/jobs` starts a draft, `POST /api/jobs/:id/publish` opens it for discovery
- `GET /api/jobs/mine` and `GET|PATCH /api/jobs/:id` are the owner's own view, `POST /api/jobs/:id/cancel` closes one
- `GET /api/jobs/:id/offers` is the owner's comparison list, `POST /api/jobs/:id/offers/:offerId/accept` books with one, and `.../decline` passes on one
- `POST /api/servmate/onboard`, `PUT /api/servmate/me/categories` and `PUT /api/servmate/me/coverage` turn an account into a ServMate with the structured category and coverage discovery matches on
- `GET /api/servmate/me/available-jobs` and `/available-jobs/:jobId` are the private feed and the entitled detail; `POST /api/servmate/me/available-jobs/:jobId/offers` bids, and `GET /api/servmate/me/offers` plus `.../:offerId/withdraw` are the provider's own side

A job never appears in the public catalog. It is only visible to a ServMate whose active
categories include it, whose coverage areas include its city, and whom no block hides — a
rule that lives in `lib/policy.ts` and is applied by `lib/matching.ts`. The discovery feed
carries the city but not the street address or access notes; those reach only the owner and a
ServMate already entitled to the detail, so an unauthorized id is answered exactly like an
absent one. Accepting an offer is one transaction: it writes the booking with a frozen
snapshot of the agreed amount and scope, withdraws the other live offers, and closes the job.

## Sign in with Google and Apple

The flows are implemented in full — PKCE (`S256`), a single-use `state`, an `id_token`
`nonce` check, and ID-token verification against the provider's published JWKS with both
signature and `iss`/`aud`/`exp` checks. Nothing is simulated: if a provider has no
credentials, the route reports it as unavailable and the dialog disables that button.

Set `APP_ORIGIN` to the exact origin you serve the site from (no trailing slash). It is
deliberately never taken from the request `Host` header, because a spoofed host would let
an attacker steer the post-sign-in redirect. Local runs fall back to `http://localhost:3000`
when `NODE_ENV` is not `production`.

Register these exact redirect URIs with each provider, then start the app with the
variables set:

```
<APP_ORIGIN>/api/auth/oauth/google/callback
<APP_ORIGIN>/api/auth/oauth/apple/callback
```

**Google** — create an OAuth 2.0 *Web application* client in the Google Cloud console:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**Apple** — create a Services ID and a Sign in with Apple key in the Apple Developer portal.
`APPLE_CLIENT_ID` is the Services ID (not the app bundle id), and `APPLE_PRIVATE_KEY` is the
contents of the downloaded `.p8` file:

- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`

The Apple client secret is a short-lived ES256 JWT signed with that key, generated per
token request rather than stored. Apple returns its response as a form POST, which the
callback accepts alongside a GET; Apple also only sends a person's name on the very first
authorization, so that name is captured from the POST body when present.

Sign-in matches the provider's stable `sub` claim first, so a changed or private-relay
email still resolves to the same account. Otherwise a **verified** email address links the
new identity onto the existing account instead of creating a duplicate. An unverified
email is rejected outright.

Leave the variables unset to keep social sign-in off; the dialog then explains which
variable each provider needs. Use a separate development client for localhost rather than
reusing the production one.

## The signed-in app

Every screen behind sign-in lives inside one frame (`app/components/feed/app-shell.tsx`): a rail
beside the content on a wide screen, a tab bar under the thumb on a phone, and a search field that
is a plain `GET` form to `/search` — so a query is a URL you can reload, share or go back to, and
search works before any JavaScript loads. A screen never draws its own navigation.

| Screen | What it is for |
|---|---|
| `/home` | The marketplace: the area control, the category index, sortable tickets, and a booking sheet |
| `/services/[serviceId]` | One listing as its own page — description, ServMate, reviews and similar services. Public: a card opens it before sign-in |
| `/search` | Ranked ServMates and listings from `lib/search.ts`, with recent terms kept on the device |
| `/account/messages` | Two panes — the thread list beside the open conversation (one at a time on a phone) |
| `/account/requests`, `/account/jobs` | The account's own bookings and its private job posts |
| `/account` | The live work order, plus rows that carry their own counts |
| `/account/settings` | The account card (name, email, join date) and the way into `security`, `notifications`, `privacy`, `selling` and `about` |
| `/servmate`, `/servmate/jobs` | The provider console and the private job feed, in the same frame |

Two habits are worth knowing before changing it. **A row that navigates shows where it goes**: the
label names the setting and the value states what it currently is ("Nobody blocked", "2 of 5
switched on"), so a list of settings reads as a summary rather than a menu of guesses. And **a link
names the thing it opens**: `?service=<id>` on `/home` opens that listing's booking sheet, which is
what "Book again" points at instead of the marketplace in general.

Who you are is shown in exactly one place — `/account/settings`. The frame carries an avatar and a
first name because that is app furniture; the email, the join date and the profile fields are not
repeated onto every screen.

## Store

Everything the site persists lives in `.data/servem.json` (gitignored): accounts, sessions,
ServMate profiles, their categories and coverage areas, service listings, job posts and their
media, offers, bookings with their status history, conversations and messages, media metadata,
reviews, notifications, blocks and reports. The file is a local stand-in for the blueprint's
NestJS + PostgreSQL backend — single-process, unencrypted, and unsuitable for production or
multiple instances. Do not store real credentials or personal data in it.

Three properties are worth knowing before you rely on it:

- **Demo content is seeded, not hardcoded.** On the first read of a store at an older seed
  revision, `lib/seed.ts` folds in demo ServMates, categories, coverage areas, listings and the
  completed bookings their reviews hang off. The cards on the storefront and the profiles on a
  ServMate page are those rows, which is what makes the marketplace demonstrable end to end.
  Seeding is additive and idempotent: your own rows and edits are never overwritten.
- **A read never writes.** Seeding happens in memory, so a page render cannot modify the file.
  The seeded rows are persisted the first time something real is written — a sign-up, a request,
  or a transition.
- **Production does not seed.** With `NODE_ENV=production` the demo rows are skipped and an
  unconfigured catalog shows the unavailable state rather than sample ServMates, matching the
  rule the public catalog has always applied. `SERVEM_SEED=1` forces seeding on, `SERVEM_SEED=0`
  off, and `SERVEM_DATA_DIR` points the store at another directory — the test suite uses that so
  it can never touch a development file.

Delete `.data/` to reset.

## Tests

```
npm test
```

Runs the Node test runner over `test/*.test.ts`. This needs Node 22.18+ (or 24+), which strips
TypeScript types natively — the application itself still supports the Node 20.9+ its
`engines` field declares. No test dependency is installed for it, deliberately: the project has
not chosen a package manager or committed a lockfile yet (decision D-004 in
`../../sidehustle_marketplace_blueprint_v3/docs/DECISION_REGISTER.md`).

`test/register.mjs` installs a small module-resolution hook first: Node will not resolve the
extensionless `./store` imports Next bundles happily, so the hook teaches it the same rule. It
is used only by the test run.

The store-backed tests point `SERVEM_DATA_DIR` at a temporary directory before importing anything,
so they can never read or write the `.data/` file a running site is serving.

### End to end, in one command

```
npm run test:e2e
```

`test/e2e-live.mjs` drives the real HTTP surface with real session cookies: it signs up a
customer and five ServMates, posts and publishes a job, checks the eligible, the
wrong-category and the out-of-area providers each see exactly what they should, has two
ServMates bid on the same job (including after the first offer arrives), and then compares and
accepts. It exits non-zero if any check fails.

The run is isolated by default, and that isolation is the point: the script starts its own dev
server on a free loopback port, in its own build directory (`.next-e2e`), with `SERVEM_DATA_DIR`
pointed at a fresh scratch directory, runs every check against it, then stops the server,
deletes the directory and puts `next-env.d.ts` and `tsconfig.json` back as it found them. Your
`.data/` store and your rate-limit windows are never touched, so two runs in a row both pass and
the throwaway accounts never reach the console's roster. Set `BASE` to drive a server that is
already up instead — its data directory and its limits are then whatever it was started with,
so set `SERVEM_DATA_DIR` on that server if you want the same isolation.


To connect the public catalog, copy `.env.example` to `.env.local` and replace the placeholder with the API root ending in `/api/v1`. The website only calls `GET /services`, with a 20-item limit. No API secret belongs in the browser or this file.

## Current scope and blueprint gates

- Search is its own screen (`/search`, ranked over titles, categories, areas and ServMate names, with recent terms on the device); pricing filters, sorting, refresh, service summaries, FAQ disclosures, mobile navigation, and service details are interactive.
- Sign in, sign up, sign out and booking requests are implemented against the local store described above. The listings and ServMate profiles the interface shows are seeded demo records rather than a hardcoded array, but they are still samples: no row represents a real provider, and the storefront keeps its "Design preview" label.
- The current OpenAPI starter does not define service details, categories, provider public profiles, or the rest of the account/help/policy flows. The interface does not invent those data or permissions.
- Google and Apple sign-in are implemented as described above; both require credentials that are not in this repository, so neither can be exercised without them.
- Password recovery is implemented over email: `/reset` sends a single-use, hashed link through `lib/email.ts` (Resend's REST API, `RESEND_API_KEY` in `.env.example`) and answers the same way whether or not the address has an account. Disputes are implemented too — a customer can hold a booking that is under way or awaiting confirmation, and neither side can finish or review it until they close it. Reporting has a readable end as well: filing a report from a profile, job or message records it, and `/account/reports` shows the account what it filed and where each report stands. The marketplace side of both queues lives at `/moderation`, an operator console unlocked with `SERVEM_MODERATION_TOKEN` rather than an account — reading it is disabled until that variable is set, and every action it takes is recorded in the `moderationActions` audit rows. See `docs/requirements/user-flow-conformance.md` for the row-by-row comparison with the two user-flow documents.
- Email verification, account linking from an existing password account into the dialog, age/category eligibility, booking terms, moderation *process* (evidence, appeals, second-person review), and deletion policies remain open decisions. No payment, payout, or provider-side action exists yet.
- This checkout does not include the API. Live catalog mode requires a separately running API at `API_BASE_URL`.
