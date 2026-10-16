# Architecture — Security Model

The assets, the actors, the trust boundaries, and what each control actually protects. Where a
control is a convention rather than a mechanism, it says so.

---

## Assets, in order of what would hurt most

1. **Where a customer lives.** A job post implies a home. Disclosure is the primary harm.
2. **Credentials.** Password hashes, session tokens, OAuth state and PKCE verifiers.
3. **The ability to act as somebody else.** Booking, offering, or reviewing on another's behalf.
4. **The integrity of money.** The agreed amount on a booking, and who may change it.
5. **Moderation records.** Which account reported which, and why.

## Actors and trust boundaries

| Actor | May | May not | Boundary |
|---|---|---|---|
| Anonymous visitor | sign up, sign in, list published services | anything requiring a session | cookie |
| Signed-in customer | their own jobs, bookings, media, exports | another's entities | session → ownership |
| ServMate | eligible jobs under the projection levels | jobs outside categories × areas, or blocked | eligibility predicate |
| Assigned ServMate | the booking's full detail | the feed beyond eligibility | relationship |
| Moderator | reports, suspension | act as a user | out of band at this revision |
| Provider (Google/Apple) | assert an identity | see ServEm data | PKCE + state + nonce |
| The store file on disk | hold every field | be reachable over HTTP | filesystem, not a route |

## Controls

### Authentication

- Passwords: `scrypt` with a per-account salt and constant-time comparison. A failed sign-in never
  says which field was wrong, and never distinguishes an unknown account from a bad password.
- Sessions: an opaque random token in an `HttpOnly`, `SameSite=Lax`, `Secure`-in-production
  cookie. `getSessionAccount()` is the only way to learn the actor, and it returns `null` for an
  expired or unknown token, which every handler maps to `401`.
- OAuth: authorization-code with PKCE. `state`, the code verifier and the `nonce` are written to
  `pending_auth` before the redirect and consumed exactly once at the callback. A replayed
  callback finds nothing.
- Password change requires the current password, so a stolen session alone cannot lock the owner
  out. All other sessions can be revoked from settings.

### Authorization

- **The actor is always the session.** No request body names a user as the author of a write.
- **Ownership is resolved, then compared.** A mismatch returns the same `404` an unknown id
  returns — see `docs/architecture/servmate-matching.md`, which is where the ordering is
  explained and why it cannot be reordered.
- **Capabilities are checked, not inferred.** A `403` means the session is valid but the
  capability (ServMate) is absent. Setting `verificationStatus`, `suspended`, or a review's
  publication state is not reachable from any provider-facing route, even by a provider who owns
  the row.
- **Eligibility is a pure predicate** so it can be audited and unit-tested rather than trusted to
  be applied in every handler.

### Request integrity

- Every mutation checks `isSameOriginRequest`. A cross-site form post cannot ride a session cookie
  into a state change.
- Bodies are parsed and validated in `lib/validation.ts` before a domain module sees them:
  bounded lengths, allowlisted enums (category, area, reason code, rating), integer money, and
  ISO timestamps.
- Uploads: ≤ 6 files per job, ≤ 3 MB each, an allowlisted content type, and the bytes are checked
  to match the declared type, so a `text/html` payload cannot arrive labelled `image/png`.
- Caching: personalized responses are `no-store`; media is `private`. Nothing per-viewer is
  cached where another viewer could reach it.

### Data protection

- **Field-level projection, enforced per viewer, before serialization.** The three projection
  levels (`feed`, `detail`, `party`) live in the modules that own the nouns; a page that wants a
  new field must add it there, where the rule is visible.
- Media bytes are unreachable except through `/api/media/<id>`, which re-checks entitlement on
  every read. Storage keys never appear in a response, log, or client bundle.
- Nothing sensitive is logged: no passwords, tokens, message bodies, addresses, or report
  descriptions. Logging a projection is safe by construction; logging a row is not.
- Secrets live in the environment (`.env.local`, untracked) and never in the repository, a client
  bundle, or a response. `docs/PHILIPPINES_LAUNCH_GATES.md` records the pre-launch checklist.

### The moderation console

The one surface in the app that is not answered from a customer login, because the threat model
said an operator API must not reuse that model. Its rules:

- **The credential is the deployment's, not an account's.** `SERVEM_MODERATION_TOKEN` is a server
  secret; an operator needs no ServEm account, and no account can promote itself into the console.
  A configured value shorter than 24 characters is treated as unset, so a weak key fails closed.
- **The browser holds a digest, never the token.** The console cookie carries `sha256(token)`, is
  `HttpOnly` and `SameSite=Strict`, and lasts one 12-hour shift. Rotating the environment variable
  ends every open console session at once, and a stolen cookie cannot be replayed as the token.
- **Every refusal is the same `404`.** A signed-in customer, an anonymous visitor, a wrong token and
  a rotated one, plus a case that genuinely does not exist, all answer identically — the surface
  cannot be probed for. An unconfigured deployment has no console at all rather than a locked one.
- **What it may read is bounded.** The job a report names, the single message it names (never the
  thread around it), and the booking a dispute froze. Names appear; email addresses, home addresses
  and payment details do not.
- **Every action is recorded.** `moderationActions` is append-only and names the operator label, and
  a booking verdict is written in the same transaction as the status change, so a booking can never
  carry an outcome with no record of who imposed it.
- **Token attempts are rate-limited** per client address (5 per 10 minutes), so a brute-force run is
  slow and visible rather than free.

### Abuse controls

- **Blocks** are symmetric in effect, private in fact, and idempotent. Discovery loses the job in
  both directions; neither account can learn the other blocked them.
- **Reports** record and change nothing about visibility. A moderator decides. The filing account
  is the only account that can read a report — `GET /api/reports/mine` takes that account from the
  session — and the row names the job it is about only while the reporter could still open that
  job, so a report cannot become a way to watch a job whose access was later revoked.
- **Rate limits** are fixed windows in `lib/rate-limit.ts`, keyed per account or client
  address on sign-in, sign-up, recovery, message sends, reports, uploads, job posts and offers,
  answering 429 with `Retry-After`. The counter lives in this process; a shared one is a launch
  item, recorded as open rather than assumed.

## Residual risk, stated honestly

| Risk | Why it remains | Mitigation path |
|---|---|---|
| A customer puts identifying detail in free text | text is not automatically redacted | form warning; moderation; future PII lint |
| A stolen session before revocation | session theft is inherent to cookie auth | short expiry, revocable sessions, re-auth for password change |
| Small-city inference from a small job pool | coarse filtering is per-city | accepted at launch; revisit at density |
| No admin surface | moderation is out of band | operator API with its own model, on the roadmap |
| The JSON store is single-process | it is a development stand-in | repository-swap migration in `database-design.md` |
| In-process rate limiting only | one process holds the counter, so a second instance would not share it | shared edge limiter before multi-instance |

## The short version

The design assumes the most likely leak is a **projection** leak, not a token theft. So the
authority checks are ordered first, projections are built inside the module that owns the data,
policy is encoded as a database constraint wherever a race could break it, and every refusal is
the same `404` as absence.
