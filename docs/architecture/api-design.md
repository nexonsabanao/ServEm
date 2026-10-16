# Architecture — API Surface

Conventions, then the routes. "Session" means a valid cookie resolves to an account; anything
else is `401`. Every mutation additionally requires a same-origin request. Owners are named
because the actor is always the owner of the session and the entity — never an id in the body.

---

## Conventions

| Status | Meaning here |
|---|---|
| 200/201 | the action happened |
| 400 | the body did not validate; the reply carries field errors |
| 401 | no session, or an expired one |
| 403 | same-origin check failed, or a capability is absent |
| 404 | **either** the entity does not exist **or** the caller is not entitled to it |
| 409 | the entity exists and is visible, but the state forbids the action |
| 413 | a payload is too large |

`404` doing double duty is deliberate: it is the refusal that cannot be probed. `409` is only
reachable once entitlement is established, so it leaks nothing.

Errors are JSON: `{ "error": string, "fields"?: Record<string,string> }`. Mutating success bodies
are current server projections so a client can replace its cache rather than patch it.

---

## Authentication — `app/api/auth/**`

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/auth/signup` | POST | — | creates the account and the session |
| `/api/auth/signin` | POST | — | generic failure for bad credentials |
| `/api/auth/signout` | POST | session | deletes the session row |
| `/api/auth/password-reset` | POST | — | starts a recovery; always the same `202` whether or not the address has an account |
| `/api/auth/password-reset/complete` | POST | — | redeems a single-use token; one uniform `400` for unknown, spent or expired |
| `/api/auth/session` | GET | — | the current account or `null`; `no-store` |
| `/api/auth/providers` | GET | — | which social providers are configured |
| `/api/auth/oauth/[provider]/start` | GET | — | writes `pending_auth`, redirects with PKCE |
| `/api/auth/oauth/[provider]/callback` | GET | — | validates `state`/`nonce`, single use, creates the session |

## Jobs — customer side

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/jobs` | POST | session | create a draft |
| `/api/jobs/[id]` | GET | session | owner only; `404` otherwise |
| `/api/jobs/[id]` | PATCH | owner | editable statuses only; `409` once booked |
| `/api/jobs/[id]/publish` | POST | owner | re-validates the stored draft |
| `/api/jobs/[id]/cancel` | POST | owner | withdraws live offers in the same transaction |
| `/api/jobs/[id]/media` | POST | owner | ≤ 6, ≤ 3 MB, allowlisted type, bytes verified |
| `/api/jobs/[id]/media/[mediaId]` | DELETE | owner | `409` once booked |
| `/api/jobs/[id]/offers/[offerId]/accept` | POST | owner | one transaction: booking + withdrawals + job booked |
| `/api/jobs/[id]/offers/[offerId]/decline` | POST | owner | pending offers only |

## Offers — ServMate side

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/servmate/me/available-jobs` | GET | ServMate | the feed; see the projection levels |
| `/api/servmate/me/available-jobs/[jobId]` | GET | eligible | `404` when not eligible |
| `/api/servmate/me/available-jobs/[jobId]/offers` | POST | eligible | `409` on a second live offer |
| `/api/servmate/me/offers` | GET | ServMate | own offers and their statuses |
| `/api/servmate/me/offers/[offerId]` | PATCH/DELETE | offer owner | revise or withdraw a pending offer |

## Provider console — `app/api/servmate/me/**`

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/servmate/onboard` | POST | session | enable the ServMate capability; idempotent |
| `/api/servmate/me` | GET | session | the console projection |
| `/api/servmate/me` | PATCH | ServMate | profile facts |
| `/api/servmate/me/categories` | PUT | ServMate | registry-checked |
| `/api/servmate/me/service-areas` | PUT | ServMate | coverage-list checked |
| `/api/servmate/me/listings` | GET/POST | ServMate | new listings are drafts |
| `/api/servmate/me/listings/[id]` | PATCH/DELETE | owner | `409` while work is live |
| `/api/servmate/me/listings/[id]/publication` | POST | owner | publish or withdraw |
| `/api/servmate/me/portfolio` | GET/POST | ServMate | a completed-booking claim is verified server-side |
| `/api/servmate/me/portfolio/[id]` | DELETE | owner | — |
| `/api/servmate/me/work-posts` | GET/POST | ServMate | 1–600 characters |
| `/api/servmate/me/work-posts/[id]` | DELETE | owner | marks the post withdrawn |

## Bookings, conversations, reviews, media

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/bookings` | POST | session | from a listing, or from an offer (`jobPostId`) |
| `/api/bookings` | GET | session | own bookings only, either side |
| `/api/bookings/[id]` | GET | party | `404` otherwise |
| `/api/bookings/[id]/start` | POST | assigned ServMate | `confirmed` → `in_progress` |
| `/api/bookings/[id]/complete` | POST | assigned ServMate | `in_progress` → `completion_pending` |
| `/api/bookings/[id]/confirm` | POST | customer | `completion_pending` → `completed` |
| `/api/bookings/[id]/cancel` | POST | customer | `409` once completed |
| `/api/bookings/[id]/dispute` | POST | customer | `action: open\|withdraw\|cancel`; holds completion, confirmation and review while open |
| `/api/bookings/[id]/messages` | GET/POST | participant | the write path is only conversations a party belongs to |
| `/api/bookings/[id]/review` | POST | customer | once, `completed` only, rating 1–5 |
| `/api/services` | GET | — | published listings; public projection |
| `/api/media/[id]` | GET | read-authorized | bytes only; storage keys never leave the server |

## Trust and safety, attention, account

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/blocks` | GET/POST/DELETE | session | `400` on self; symmetric effect, private fact |
| `/api/reports` | GET/POST | session | `GET` returns the reason registry; `POST` checks entitled-to-see, and visibility is unchanged |
| `/api/reports/mine` | GET | session | the caller's own filed reports; the reporter comes from the session, never from the request |
| `/api/notifications` | GET | session | own rows |
| `/api/notifications/[id]` | POST | owner | mark read; `404` for someone else's |
| `/api/account/profile` | PATCH | session | name and identity fields |
| `/api/account/password` | POST | session | current password required |
| `/api/account/sessions` | GET/DELETE | session | list and revoke |
| `/api/account/preferences` | GET/PATCH | session | notification and app preferences |
| `/api/account/export` | GET | session | the caller's own data |
| `/api/account/servmate` | DELETE | session | withdraw the ServMate capability |

## Moderation (operator credential, never a session)

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/moderation/session` | POST/DELETE | operator token | `POST` exchanges `SERVEM_MODERATION_TOKEN` for an `HttpOnly` digest cookie; `DELETE` clears it. Every failure is `404`, including a switched-off surface |
| `/api/moderation/cases` | GET | operator cookie | open reports and open disputes, oldest first, capped at 50 |
| `/api/moderation/reports/[reportId]` | POST | operator cookie | `outcome: reviewing\|resolved\|dismissed`; a closing outcome needs a note |
| `/api/moderation/disputes/[bookingId]` | POST | operator cookie | `verdict: completed\|cancelled` + note; moves the booking, tells both parties, writes the audit row |

## What is absent on purpose

No route accepts a user id as the author of a write. No route returns another account's email,
phone or address. No route lets a provider set `verificationStatus`, `providerStatus` to
`suspended`, or a review's publication state. No admin surface is exposed in the public web app —
moderation reads the store directly at this revision, and an operator API is a roadmap item with
its own security model.
