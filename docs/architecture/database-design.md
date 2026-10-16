# Architecture — Database Design

The logical model in `docs/requirements/data-requirements.md` is implemented today by
`lib/store.ts`, a single-process JSON document store with one writer and one schema. It is not a
production datastore; it exists so the same logical model can be exercised end to end before a
database is chosen. This document is the mapping: collection → table, the types, the indexes that
make the eligibility predicate cheap, and the constraints that turn a policy into a fact.

---

## Why the store is shaped this way

Two properties make the current store honest rather than merely convenient:

1. **One writer.** Reads and writes funnel through a single promise chain, so a read-modify-write
   cycle cannot interleave. That is what makes "accept an offer exactly once" atomic here. A SQL
   deployment gets the same guarantee from a transaction plus a row lock.
2. **One schema.** Every collection matches the target logical model, so the migration is a
   repository swap, not a redesign. Migrations are versioned (`migrations` collection with
   `SEED_VERSION`), which is the same discipline a SQL migration runner needs.

The one deliberate simplification: location is stored as fields on the job (city, barangay,
notes) rather than a joined `locations` row, and coverage lives in `servmateServiceAreas`.

## Collection → table map

| `lib/store.ts` collection | Table | Key |
|---|---|---|
| `users` | `users` | `id`, unique `email_normalized` |
| `sessions` | `sessions` | `token` (or hash of it), indexed `user_id` |
| `pendingAuth` | `pending_auth` | unique `state`, TTL `expires_at` |
| `servmateProfiles` | `servmate_profiles` | unique `user_id` |
| `servmateCategories` | `servmate_categories` | PK (`profile_id`, `category_id`) |
| `servmateServiceAreas` | `servmate_service_areas` | PK (`profile_id`, `area_label`) |
| `serviceListings` | `service_listings` | `id`, indexed (`publication_status`, `category_id`) |
| `jobPosts` | `job_posts` | `id`, indexed (`customer_id`, `job_status`) |
| `jobPostMedia` / `mediaAssets` | `job_post_media` / `media_assets` | join PK, `media_assets.id` |
| `jobOffers` | `job_offers` | `id`, indexed (`job_post_id`, `offer_status`) |
| `bookings` | `bookings` | `id`, unique `reference`, `accepted_offer_id` |
| `bookingStatusHistory` | `booking_status_history` | `id`, indexed `booking_id` |
| `conversations` / participants / messages | same | indexed `conversation_id`, `created_at` |
| `portfolioItems` | `portfolio_items` | `id`, indexed `profile_id` |
| `workPosts` | `work_posts` | `id`, indexed `profile_id` |
| `reviews` | `reviews` | `id`, **unique (`booking_id`, `reviewer_user_id`)** |
| `notifications` | `notifications` | `id`, indexed (`recipient_user_id`, `read_at`) |
| `userBlocks` | `user_blocks` | PK (`blocker_id`, `blocked_id`) |
| `userReports` | `user_reports` | `id`, indexed (`status`) |
| `moderationActions` | `moderation_actions` | `id`, indexed (`entity_type`, `entity_id`); append-only, no update path |

## Types

- **Money** — `bigint` centavos (never `numeric` with a scale, never `float`). PHP only at this
  revision; the currency column is present so a second one is a data change, not a redesign.
- **Time** — `timestamptz`, UTC. Client rendering does the locale conversion.
- **Ids** — opaque text/`uuid`, generated server-side; a client never supplies one for a new row.
- **Enums** — stored as constrained text (`CHECK (status IN (...))`) so a typo cannot create an
  undefined state. This is the database half of `lib/policy.ts`.
- **Media keys** — a storage key plus metadata; bytes never live in the row.

## Indexes that carry the design

The eligibility predicate is the hottest query in the product, and it is cheap only if the right
indexes exist. In order of how precisely they must match `lib/matching.ts`:

```sql
-- 1. the candidate set: open, unexpired jobs, newest first
CREATE INDEX job_posts_open
  ON job_posts (category_id, location_city, published_at DESC)
  WHERE job_status = 'open';

-- 2. the viewer's claims: what this ServMate is allowed to see at all
CREATE UNIQUE INDEX servmate_categories_pk ON servmate_categories (profile_id, category_id);
CREATE UNIQUE INDEX servmate_areas_pk      ON servmate_service_areas (profile_id, area_label);

-- 3. blocks, checked in both directions on every read
CREATE INDEX user_blocks_blocker ON user_blocks (blocker_id);
CREATE INDEX user_blocks_blocked ON user_blocks (blocked_id);

-- 4. one live offer per provider per job, and one live offer set per job
CREATE UNIQUE INDEX job_offers_live
  ON job_offers (job_post_id, servmate_profile_id)
  WHERE offer_status = 'pending';

-- 5. trust and attention
CREATE UNIQUE INDEX reviews_once ON reviews (booking_id, reviewer_user_id);   -- policy as a constraint
CREATE INDEX notifications_unread ON notifications (recipient_user_id) WHERE read_at IS NULL;
```

Two of these are worth calling out because they are policy encoded as schema:

- `job_offers_live` means "a ServMate may hold at most one pending offer on a job" is enforced by
  the database, so two concurrent submissions cannot both succeed. The handler still checks it to
  return a clean `409`; the index is what makes the check true.
- `reviews_once` means "one review per completed booking" cannot be bypassed by a race, a retry or
  a second client. The constraint is the guarantee, the API check is the courtesy.

## Transactions

Four operations must be atomic, and each corresponds to exactly one transaction:

1. **Accept an offer.** Insert the booking with its frozen snapshot; withdraw all other live
   offers; set the job to `booked`; append history; write notifications.
2. **Cancel a job.** Mark the job cancelled and withdraw its live offers together, so an offer can
   never outlive the job it answers.
3. **Booking transitions.** Update the status, append a history row, and write the notification in
   one unit.
4. **Create a review.** Insert the review and update the provider's aggregate rating, so an
   average can never disagree with the reviews that produced it.

Concurrency control: `SELECT ... FOR UPDATE` on the job's offer set, plus the partial unique index
above. Under the JSON store, the single writer provides the same property.

## Migration path off the JSON store

1. Stand up the schema and the indexes above; keep `lib/store.ts`'s function signatures as the
   repository interface.
2. Backfill from the seed and any real rows; verify counts per collection against the tables.
3. Switch the store implementation behind the same interface; the domain modules do not change,
   because no domain module reads a file or a table directly.
4. Delete the JSON store. Keep the transaction boundaries where they are — they are the part that
   was designed for SQL in the first place.

## Retention and deletion

Not yet decided, and therefore not implemented: message history, media bytes after a job closes,
and account deletion. What is decided is the shape of the answer — a deletion must not orphan a
booking another party still needs, so it will be a tombstone plus a purge job, and settlements are
a prerequisite. That is recorded as an open decision in `docs/PROJECT_ROADMAP.md` rather than
guessed at here.
