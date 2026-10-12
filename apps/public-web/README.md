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


To connect the public catalog, copy `.env.example` to `.env.local` and replace the placeholder with the API root ending in `/api/v1`. The website only calls `GET /services`, with a 20-item limit. No API secret belongs in the browser or this file.

## Current scope and blueprint gates

- Search, pricing filters, sorting, refresh, service summaries, FAQ disclosures, mobile navigation, and service details are interactive.
- Sign in, sign up, sign out and booking requests are implemented against the local store described above. The listings and ServMate profiles the interface shows are seeded demo records rather than a hardcoded array, but they are still samples: no row represents a real provider, and the storefront keeps its "Design preview" label.
- The current OpenAPI starter does not define service details, categories, provider public profiles, or the rest of the account/help/policy flows. The interface does not invent those data or permissions.
- Google and Apple sign-in are implemented as described above; both require credentials that are not in this repository, so neither can be exercised without them.
- Email verification, password reset, rate limiting, account linking from an existing password account into the dialog, age/category eligibility, booking terms, and deletion policies remain open decisions. No payment, payout, or provider-side action exists yet.
- This checkout does not include the API. Live catalog mode requires a separately running API at `API_BASE_URL`.
