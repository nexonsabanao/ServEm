# ServEm — Roadmap

Ordered by what unblocks the most work per unit of risk. Everything here is a gap named in
`PROJECT_STATUS.md`; nothing is listed that the code already does.

---

## 1. Move the datastore to PostgreSQL (blocks production, unblocks everything)

The JSON store is the single largest limitation: one process, one file, no migrations, no
concurrent writers. `docs/architecture/database-design.md` already describes the target schema
and `lib/store.ts` already exposes `query` / `transact`, which is the seam a SQL repository
slots into.

- Write the schema and migrations; keep the collections' shapes.
- Replace the promise-chain writer with real transactions and row locks — offer acceptance is
  the one place that must remain atomic.
- Add the indexes the access paths need: job status + city, offers by job, notifications by
  recipient and read state, reviews by profile.

**Exit test:** the whole of `npm run test:e2e` still passes against PostgreSQL, with two
concurrent accepts on one offer creating exactly one booking.

## 2. Object storage and signed uploads for media

Media currently travels as base64 through the app and lands on local disk. Replace it with:

- A signed upload intent the browser PUTs to directly, and a server-side confirm that reads the
  object's metadata before writing the asset row.
- A delivery route that still re-decides authorization per request, now streaming from the bucket.
- Thumbnails for the discovery feed.

**Exit test:** `test/media-access.test.ts` passes unchanged, and a private job photo is still a
404 for an ineligible provider when fetched directly from storage.

## 3. Transactional email — the channel now exists, verification does not

Password recovery was the first message through it: `lib/email.ts` sends over Resend's REST API
and reports `not_configured` when the key is absent, so the feature is disabled rather than broken
(`RESEND_API_KEY` in `.env.example`). What is still open is the other half of that channel:
email verification of the address at sign-up, and delivery of the notification types that exist
only as records today.

**Exit test:** an address is verified at sign-up, and a notification email arrives for a new offer.## 4. Disputes — the case list and the verdict exist; the process does not

`disputed` is reachable, the hold blocks completion, confirmation and review on both sides, the
customer can withdraw or cancel, and an operator can now decide it: `/moderation` lists open
disputes and imposes `completed` or `cancelled`, notifying both parties and writing an audit row.
What is missing is the *process* around that verdict, which is what a real dispute costs:

- **Evidence in the case**: the customer's reason and the status timeline are there; photos,
messages and receipts are not.
- **Appeal and second-person review**: one operator can decide alone today. A high-value or
narrowly-decided case should need two.
- **Telling the reporter of a report's outcome**: a decided report is readable at
  `/account/reports`, but nothing notifies the reporter that it moved.

**Exit test:** a decision needs a second operator's agreement above an amount threshold, and both
parties can attach evidence before it is made.

## 5. Verification

Profiles carry `verificationStatus` and the UI never contradicts it. A verification pass needs an
evidence upload, a reviewer role, and an audit trail — and, until it exists, the badge stays
absent rather than decorative.

## 6. Counteroffers

Offers already carry `revision`. A counteroffer should create a new revision rather than
overwrite the old one, keep the previous terms readable, and expire the revision it supersedes.

## 7. Availability calendars

A provider's availability is a string today, so no rule can honour it. A real version needs
per-day windows, a conflict check at offer time, and a rule in `lib/policy.ts` beside the
existing schedule checks.

## 8. Rate limiting and abuse controls

Per-bucket, in-process limits now guard sign-in, sign-up, recovery, message sends, reports,
uploads, job posts and offer submissions (`lib/rate-limit.ts`), answering 429 with
`Retry-After`, and the reporter reads their own list at `/account/reports`. What remains is the
counter shared across processes — an edge or Redis limiter — plus extending limits to the
remaining mutation routes once traffic shows where they bite.

## 9. Distance-aware discovery

Requires geocoding. Keep the city/barangay model as the floor, add coordinates at the precision
each object needs, and make distance a narrowing filter over an already-authorized set — never a
substitute for eligibility.

## 10. Payments

Last, and only with approved provider integration, settlement rules and compliance review.
Until then the booking records the agreed amount and says so, which is more useful than a
disabled checkout button.

---

## Small things worth doing early

- Pagination for the notification feed, the case queue, the reporter's own report list and the
  discovery results once volumes justify it (the case queue currently shows the oldest 50).
- A notification type for a report's outcome, so a reporter hears about it where they already look.
- An app-wide fix for `notFound()` answering `200` on a streamed page (see `PROJECT_STATUS.md`
  limitation 6), which currently makes an unknown id and an absent console look like successes.
