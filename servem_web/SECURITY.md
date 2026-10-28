# ServEm Backend Security (project `servem-ph`)

Defense-in-depth backend for the Philippines home-services marketplace:
strict Firestore/Storage rules, TypeScript Cloud Functions (2nd gen) as the
only write path for state-changing operations, and hardened Hosting headers.

```
servem_web/
  firebase.json          deploy config: functions + firestore + storage + hosting
  firestore.rules        client access matrix (deny-by-default)
  firestore.indexes.json composite indexes for all proposed queries
  storage.rules          profile/verification uploads, 10 MiB, image/PDF only
  functions/             Cloud Functions v2 (TypeScript, nodejs22, region asia-southeast1)
  functions/.env.example emulator/dev parameter template (never commit .env)
```

---

## 1. Architecture & trust boundaries

| Boundary | Posture |
|---|---|
| Browser ⇄ Firestore | Reads only own data (profile, bookings as customer/provider, member threads, notifications, public catalog, legal config). Client writes limited to: own profile display fields, own `places` subcollection, marking own notifications `read`. **Everything else is write-denied**; `bookings`, `threads`, `payments`, `payouts`, `disputes`, `tickets`, `services`, `servmates`, `reviews`, `auditLog`, `customers`, `rateLimits`, `webhookEvents` accept zero client writes. |
| Browser ⇄ Cloud Functions | Only callable API (below). All callables require Firebase Auth (verified ID token; custom claims cannot be forged by clients). Inputs parsed with **zod**; malformed IDs, oversized text, illegal enums rejected before any Firestore access. |
| Cloud Functions ⇄ Firestore | Admin SDK (bypasses rules) is the *only* writer for operational state. Prices, statuses, roles, and earnings are computed server-side; client-supplied price/role fields are ignored. |
| PayMongo ⇄ Webhook | `paymongoWebhook` HTTPS endpoint; HMAC-SHA256 verified, timestamp replay window 300 s, idempotent per event id. Fails closed (503) when `PAYMONGO_WEBHOOK_SECRET` is not configured. |
| Storage | Owner-scoped uploads under `/users/{uid}/…`, ≤ 10 MiB, `image/jpeg|png|webp` (profile also public-read; verification also allows `application/pdf` and is readable **only** by owner + admin). No public listing; catch-all deny. |

## 2. Callable API (exact names the frontend must use)

All callables live in region `asia-southeast1` (1st-gen auth trigger same
region). Call via `httpsCallable_functions(app, REGION)(name)` from
`firebase/functions`.

| Callable | Who | Input | Effect |
|---|---|---|---|
| `onAuthUserCreate` | *auth trigger* | — | Creates `profiles/{uid}` with `role:'customer'`, `verified:false`, `serverTimestamp`s. Idempotent; never writes privileged fields. |
| `createBooking` | signed-in customer | `serviceId, providerId?, date(YYYY-MM-DD), time(HH:mm), hours, address, notes?, paymentMethod ∈ gcash|maya|bank_transfer|cash_on_completion` | Validates service `status=='live'`, provider `status=='active'`, `hours ≥ service.minHours`, schedule window (≥15 min ahead, ≤90 days, Asia/Manila). **Rate/fee/total recomputed from `services/{id}.rate`** (fee = subtotal × `PLATFORM_FEE_RATE`, or `config/platform.feeRate` if set, clamped 0–30 %). Creates booking `status:'requested'`, chat thread `threads/{bookingId}` (members = customer+provider), provider notification, audit entry. Rate limit 10/15 min. |
| `updateBookingStatus` | participants + admin | `bookingId, status, reason?` | State machine: `requested→accepted|declined|cancelled`, `accepted→in_progress|cancelled`, `in_progress→completed`, `completed→reviewed`. Customer may cancel only from `requested/accepted` and mark `reviewed` only after their review exists; provider may accept/decline/start/complete; admin-claim holders may override outside the machine (audited). `completed` stamps `providerEarnings = total − fee`, `payoutStatus:'unpaid'`. Rate limit 30/10 min. |
| `sendBookingMessage` | thread member | `threadId, text(1–2000)` | Membership checked server-side; bidi/control chars stripped, stored as plain text; 20 msg/min. Thread capped at 500 messages. |
| `createReview` | assigned customer | `bookingId, rating(1–5), comment?` | Booking must be `completed` and `customerId == caller`. Review doc id = `bookingId` → **one review per booking, enforced by Firestore**. `providerId/serviceId` copied from booking, never from client. Booking flips to `reviewed`. 5/hour. |
| `setAdminClaim` | admin, or self + bootstrap secret | `targetUid, admin?, bootstrapToken?` | Existing admin: grant/revoke any uid. Bootstrap (`ADMIN_BOOTSTRAP_TOKEN`): only self-promotion, grant-only. Custom claims merged (read-modify-write) and `profiles/{uid}.role` synced; audited. |
| `requestPayout` | ServMate (or admin profile) | `amount, method ∈ gcash|maya|bank_transfer, accountRef` | Sums eligible earnings (bookings `completed/reviewed` with `payoutStatus=='unpaid'`, max 200/request), enforces `MIN_PAYOUT_PHP` and `amount ≤ available`; transaction creates **pending** payout and reserves the source bookings (`payoutStatus:'pending'`). No money moves. 5/hour. |
| `processRefund` | admin | `bookingId, amount?, reason` | Requires a recorded `paid` payment; sets `payments/booking_<id>.status='refund_pending'` + `bookings.refundStatus='pending'`, audits with `moneyMoved:false`. **Intents only** — see §6. |
| `resolveDispute` | admin | `disputeId, outcome ∈ refund_customer|release_provider|split|dismissed, note(10–1000)` | Requires unresolved dispute; updates `status:'resolved'` + resolution fields, notifies booking parties, audits. |
| `createSupportTicket` | any signed-in user | `subject, body, priority?, bookingId?` | Ticket always owned by caller (`uid` set server-side). 5/10 min. |
| `replySupportTicket` | admin | `ticketId, reply, setStatus?` | Appends admin reply transactionally, notifies the requester, audits. |
| `recordPayment` | admin only | `bookingId, amount, method, reference?` | `amount` must equal the server-computed booking total (±0.01). Idempotent per booking (`payments/booking_<id>`). Ordinary users cannot call it; the webhook uses the same internal helper with `source:'paymongo_webhook'`. |
| `paymongoWebhook` | PayMongo (HTTP POST) | headers `signature`, `payload_timestamp` | §3. |
| `scheduledMaintenance` | daily (scheduler) | — | Deletes expired `rateLimits` counters (≥2 days) and stale `webhookEvents` (≥180 days). `auditLog` pruning only when `ENABLE_AUDIT_RETENTION=true` (default false, ≥30-day floor, ≤2000 docs/day). **No emails are sent anywhere** — there is no verified delivery provider, and in-app notifications are the only channel. |

## 3. PayMongo webhook

1. `PAYMONGO_WEBHOOK_SECRET` unset ⇒ **503**, nothing processed.
2. Raw body read manually (≤ 64 KiB) — never through a JSON parser first, so
   the HMAC covers exactly what was signed.
3. `signature` = hex HMAC-SHA256 over `payload_timestamp + "." + rawBody`
   keyed with the webhook secret; compared with `crypto.timingSafeEqual`
   on digests; `payload_timestamp` must be within ±300 s. Any failure ⇒ 401,
   logged, not processed (fail closed).
4. Verified JSON is parsed; the event id is claimed transactionally in
   `webhookEvents` — duplicates ack `200 {duplicate:true}` and change nothing.
5. Only `checkout.session.paid|completed` with `data.attributes.metadata.bookingId`
   record a payment (centavos → PHP ÷100) through the same
   amount-matches-booking-total check as `recordPayment`.
6. Processing failures mark the event `failed` and return 500 so PayMongo
   retries safely (idempotency prevents double-credit).

Register the endpoint URL
`https://asia-southeast1-servem-ph.cloudfunctions.net/paymongoWebhook` in the
PayMo dashboard and copy its signing secret into Secret Manager.

## 4. Deployment & secret setup

Prereqs: Node 22, `npm i -g firebase-tools`, project access to `servem-ph`.

```bash
cd servem_web/functions
npm ci                       # installs firebase-admin/functions/zod/typescript
npm run typecheck && npm run build   # (predeploy runs these automatically)

cd ..
firebase login
firebase use servem-ph

# Secrets (values come from your provider dashboards / password manager)
firebase functions:secrets:set ADMIN_BOOTSTRAP_TOKEN   # openssl rand -hex 32
firebase functions:secrets:set PAYMONGO_WEBHOOK_SECRET # only when PayMongo is live
firebase functions:secrets:set ALLOWED_DEV_ORIGINS     # optional, dev origins

firebase deploy --only functions:servem,firestore,storage,hosting
```

Local development: `firebase emulators:start` after
`cp functions/.env.example functions/.env`. The emulator reads secret
params from that `.env`; deploy ignore rules keep `.env*` out of bundles.

### Admin bootstrap (first run)

1. Deploy, then sign up in the app (creates your `profiles/{uid}` via the trigger).
2. From a browser console on the hosted app:
   `setAdminClaim({ targetUid: <your-uid>, admin: true, bootstrapToken: '<ADMIN_BOOTSTRAP_TOKEN>' })`.
   Bootstrap only allows self-grant and never revocation.
3. Immediately rotate/remove the secret: `firebase functions:secrets:destroy ADMIN_BOOTSTRAP_TOKEN`
   (or set a new secret version). All later admin changes go through an
   existing admin token, no bootstrap needed.
4. Custom claims propagate on the next ID-token refresh (up to 1 h, or force
   `signOut`/`signIn`). `profiles/{uid}.role` is synced to `admin` by the
   function, but **claims, not profile data, gate authorization**.

## 5. Threat model (summary)

| Threat | Mitigation |
|---|---|
| Forged role/admin claims | Claims are verified ID-token content, set only by `setAdminClaim` (admin or bootstrap). Rules test `request.auth.token.admin == true`. |
| Client tampering with prices | All `rate/fee/total/subtotal` computed in `createBooking` from the service doc; callables never read price fields from input; `recordPayment` requires amount == server total. |
| Illegal booking states | Server-side transition table + participant-role checks; out-of-machine transitions require the admin claim and are audited. |
| Prompt/injection/XSS via text | Text sanitized (control + bidi chars stripped), stored as plain text, length-capped; UI must render it as text, never HTML. Firestore rules never evaluate text content. |
| ID enumeration / malformed paths | `^[A-Za-z0-9_-]{6,128}$` on every id, plus path-escape guard (`..`, `/`) server-side. |
| Write spam / economic DoS | Firestore fixed-window rate limiters on every write-heavy callable; counters invisible to clients and swept daily. |
| Webhook spoofing/replay | HMAC verified before parsing, 300 s window, idempotent event claim, fail-closed 503/401. |
| Privilege creep in profile docs | Profile update allow-list; `role`, `verified`, `uid` immutable client-side (`diff().affectedKeys().hasOnly`). |
| Listing/scraping private files | Storage catch-all denies `list`; verification docs readable only owner + admin. |
| Clickjacking / MIME sniffing / downgrade | CSP `frame-ancestors 'none'` + `X-Frame-Options DENY`, `nosniff`, HSTS preload, `Referrer-Policy strict-origin-when-cross-origin`, restrictive `Permissions-Policy`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. |
| CORS exfiltration | Callables + webhook accept only the two production origins and explicitly configured localhost dev origins. |
| Malicious console/SDK writes to ops data | Admin SDK bypass applies to functions; the client SDK path is blocked by rules regardless of who holds an admin *profile* without the *claim*. |

## 6. What is NOT verified without live credentials (be honest in review)

- **PayMongo**: the HMAC scheme (`sha256 hex over "ts.body"`, headers
  `signature`/`payload_timestamp`) is implemented from published docs but has
  not been exercised against a real delivery. Replay window, event-type names
  and `metadata.bookingId` echoing depend on the checkout-session creation
  side, which does not exist yet (no Payment Intent API integration).
- **Money movement**: `processRefund` and `requestPayout` record intents for
  admin review. No GCash/Maya/bank disbursement or PayMongo refund API is
  called — nothing marks funds as actually moved. Admin runbooks complete the
  loop off-platform until a provider is integrated.
- **Booking eligibility for payout** assumes cash jobs count once admin
  records their payment via `recordPayment` (bookings remain
  `status:'completed'` until paid-out). If finance wants `paymentStatus=='paid'`
  as the payout gate, tighten the query in `payouts.ts`.
- **Email/SMS notifications**: deliberately absent (no provider). Only
  in-app `notifications` docs are written.
- Rules/indexes/functions were not deployed to the live `servem-ph` project
  in this environment; run the emulator suite + `firebase deploy --dry-run`
  before shipping, and add rules unit tests (`@firebase/rules-unit-testing`)
  as the next hardening step.

## 7. CSP notes (why the policy is shaped like this)

- `script-src 'self' https://www.googletagmanager.com` — the Vite bundle
  statically imports the Firebase SDKs; no `unsafe-inline`/`unsafe-eval` is
  required for scripts. `googletagmanager.com` is needed because Firebase
  Analytics (GA4, `measurementId` present) injects `gtag.js` at runtime.
- `style-src 'self' 'unsafe-inline'` — the one concession. Firebase UI and
  Google Identity Services inject inline `<style>`/`style="…"` attributes
  into same-origin DOM (sign-in button wrappers), and Tailwind/vite runtime
  class injection uses inline style attributes. `'unsafe-inline'` on
  **styles only** does not permit inline script execution; this is the least
  permissive policy that keeps Auth + Google sign-in functional. Removing it
  requires hashing at build time, which third-party injected styles cannot
  use.
- `frame-src https://accounts.google.com https://*.firebaseapp.com` — Google
  One Tap/popup documents and the Firebase Auth iframe bridge.
- `connect-src` — Identity Toolkit + Secure Token (Auth), Firestore +
  Firebase Installations/Logging (Analytics), Storage bucket host, GA4
  endpoints, the `asia-southeast1` functions domain, and the two hosting
  origins.
- PayMongo checkout is a **top-level redirect**, not a frame; no CSP frame
  allowance is required and none was granted.
- Hosting header ordering: `/assets/**` (immutable) and
  `/assets/fonts/**` (7 days, unhashed filenames) override the `/**`
  `no-cache` default because later matching rules win per header name.

## 8. Schema assumptions (frontend integration contract)

- `services/{id}` must contain `name, rate(number>0), minHours(number≥0),
  providerId, status:'live'|…` — catalog rows already match.
- `servmates/{id}` keyed by provider uid with `name, photo, status:'active'|'pending'|'suspended'`;
  only `active` providers are bookable.
- `config/platform` (optional): `{ feeRate: number 0..0.3 }`;
  `config/legal`: public terms/fee disclosure documents.
- `bookings/{id}` written by functions: `serviceId, providerId, customerId,
  date, time, scheduledAt, hours, status, paymentMethod, paymentStatus,
  address, notes, rate, fee, total, providerEarnings?, payoutStatus?,
  statusHistory[], createdAt/updatedAt (serverTimestamp)`.
- `reviews/{id == bookingId}`: `authorId, providerId, serviceId, rating,
  comment, flagged, status:'published'`.
- `threads/{id == bookingId}`: `members[uid,uid]`, `messages[{senderId,text,readBy,sentAt}]`.
- Payout eligibility requires `updateBookingStatus` to have run
  `in_progress→completed` (earnings are only stamped there).
- Clients read `payouts`/`tickets`/`disputes` only where they are the owner or
  a booking party; `payments` and `auditLog` are admin-claim reads only.
