# ServEm — Data Requirements

The logical model, the rules each entity must obey, and the access level of each field. The
implementation lives in `lib/store.ts`; the SQL mapping is in
`docs/architecture/database-design.md`.

---

## Rules that apply to everything

1. **Money is an integer count of centavos.** Never a float; never a formatted string. Currency
   is carried beside it and is `PHP` at this revision.
2. **Timestamps are ISO-8601 UTC strings.** They are rendered in the reader's locale at the edge.
3. **The actor is always the session.** No endpoint accepts a user id as the author of anything.
4. **Identity is never inferred from a URL.** Ownership is looked up from the session and the
   record, and a mismatch answers as absence.
5. **Private fields are named as such** and are absent from projections rather than blanked.

---

## Entities

### users
`id`, `name`, `email` (unique, normalised), `username`, `passwordHash` (scrypt, salted — absent
for OAuth-only accounts), `identities[]`, `preferences`, `profile`, `isServMate`, `createdAt`.
Never stored: plaintext passwords, provider tokens.

### sessions / pending_auth
`token` (random, opaque), `userId`, `expiresAt`. `pending_auth` holds the OAuth `state`, PKCE
verifier, `nonce` and an expiry, and each row is single-use.

### servmate_profiles
`id`, `userId`, `bio`, `experience`, `headline`, `serviceAreaLabel`, `responseMins`,
`providerStatus` (active/paused/suspended), `verificationStatus`
(unverified/pending/verified), timestamps. **`verificationStatus` is never set by the provider.**

### servmate_categories / servmate_service_areas
Profile reference plus a category id or an area label, from the server's registries. These two
collections are the whole of discovery eligibility.

### service_listings
`id`, profile reference, category, `title`, `description`, `pricingModel` (fixed/quote),
`amountCentavos`, `currency`, `publicationStatus` (draft/published/unpublished),
`serviceAreaLabel`, `availability`, `terms`, `publishedAt`, timestamps. **A price edit must not
reach any existing booking**; the booking owns its snapshot.

### job_posts
`id`, `customerId`, `categoryId`, `title`, `description`, `jobStatus`, `pricingModel`,
`budgetCentavos`, `budgetMaxCentavos`, `currency`, `locationCity`, `locationBarangay`,
`locationNotes`, `preferredStart`, `preferredEnd`, `scheduleFlexible`, `publishedAt`,
`expiresAt`, `closedAt`, timestamps.

- `locationBarangay` and `locationNotes` are **restricted**: never in a discovery projection.
- `budgetCentavos` is the customer's willingness, not the agreed price.

### job_post_media / media_assets
Join row (`jobPostId`, `mediaAssetId`, `caption`, `displayOrder`) plus the asset
(`ownerUserId`, `storageKey`, `mediaType`, `mimeType`, `fileSizeBytes`, `processingStatus`,
`visibility`, `jobPostId`, `deletedAt`).

- `storageKey` **never leaves the server**; clients receive only `/api/media/<id>`.
- `visibility`: `job_private` (job rule), `public_profile` (any signed-in account),
  `message_private` (reserved).
- Bytes live outside any served path, and a deleted asset's bytes are erased.

### job_offers
`id`, `jobPostId`, `servmateProfileId`, `amountCentavos`, `currency`, `proposedStart`,
`scopeDescription`, `exclusions`, `message`, `offerStatus`
(pending/accepted/rejected/withdrawn/expired/category_changed), `revision`, `expiresAt`,
timestamps. A revision is a new row, never an overwrite of agreed terms.

### bookings / booking_status_history
`id`, `reference`, `userId`, optional `serviceId`/`serviceTitle`, optional
`jobPostId`/`acceptedOfferId`/`servmateProfileId`, `area`, `message`, `status`, and the
**immutable snapshot**: `agreedAmountCentavos`, `agreedCurrency`, `agreedScope`, `agreedStart`.
Timestamps for created/confirmed/started/completed/cancelled. History rows record old status,
new status, the actor and the time.

### conversations / conversation_participants / messages
A conversation may reference a job, an offer and a booking. Participants are stored rows with
`lastReadAt`, which is what makes membership a fact rather than an inference. Message bodies are
private to participants and are never logged.

### portfolio_items
`id`, profile reference, `title`, `description`, `mediaAssetId`, `source`
(`self_published` | `completed_booking`), `bookingId`, `displayOrder`, `createdAt`. The
`source` is decided server-side from the booking, never from the request.

### work_posts
`id`, profile reference, `body`, `mediaAssetId`, `publicationStatus` (published/removed),
`createdAt`. Withdrawn posts are marked, not erased.

### reviews
`id`, `bookingId`, `reviewerUserId`, profile reference, `rating` (integer 1–5, checked),
`comment`, `publicationStatus`, `createdAt`, and a **unique constraint on (bookingId, reviewer)**
— which is what makes "one review per completed booking" a fact of the data.

### notifications
`id`, `recipientUserId`, `notificationType`, optional entity type and id, `readAt`,
`createdAt`. No notification is ever addressed to somebody who is not party to the entity.

### user_blocks / user_reports
`user_blocks`: blocker, blocked, timestamp — one row per direction, enforced both ways.
`user_reports`: reporter, exactly one of (user, job, message), `reasonCode` from a fixed set,
optional description, status, timestamps. **Moderation records are never readable by the account
they name.**

---

## Integrity rules

- Foreign references are resolved on read and a broken one degrades to absence rather than a
  blank row.
- Statuses are constrained to their declared unions; transitions are checked by
  `lib/policy.ts` and `lib/bookings.ts`.
- Ratings are bounded 1–5 and validated at the API and again on read.
- Amounts are non-negative integers.
- A category claim must exist in the registry; an area claim must be in the coverage list.
- Offer acceptance, booking transitions, job closure with offer withdrawal, and review creation
  each run in one transaction.
- Retention: message history outlives a closed job, but the actions that are no longer valid are
  refused. Deletion policy for accounts and settlements is an open decision, so deletion is not
  offered.
