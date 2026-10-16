# Operations — Runbook

Written for the person on call at 02:00 who did not build this. Each entry is a symptom, what it
means, and the smallest action that resolves it.

---

## First five minutes

```bash
# is the app answering, and is it the current build?
curl -sS -o /dev/null -w '%{http_code}\n' https://<origin>/home

# does it still have data? (a 200 page can render an empty feed)
curl -sS https://<origin>/api/services | head -c 200

# recent errors, without printing anything sensitive
<log tool> --since 15m | grep -v 'GET /_next'
```

Then answer three questions in order: **is it the process, the data, or the code?** A process
problem is a restart. A data problem is investigated before anything is restarted. A code problem
is a rollback.

---

## Symptom → action

### The site returns 502/503 for everyone

The process is down or not listening. Restart it and watch the first ten lines of the log. If it
exits immediately, read the first error — a missing required environment variable or a bad
`APP_ORIGIN` are the common causes. Do not remove the store check to "fix" readiness; use the
liveness probe instead.

### Pages load but every signed-in action returns 401

Sessions are not resolving. Check in this order: is the session cookie being set on the deployed
origin (`Secure` requires HTTPS); has `APP_ORIGIN` changed since the cookie was issued; did the
session store get wiped by a redeploy on a file-based setup. Users can sign in again once the cause
is fixed — do not disable the check.

### Sign-in with Google/Apple redirects back with `400`

The `state` did not match, or the redirect URI is wrong. Confirm the redirect URI registered with
the provider is **exactly** `<APP_ORIGIN>/api/auth/oauth/<provider>/callback`. A trailing slash or a
`www.` difference is enough. `pending_auth` rows are single-use: if a user retried a stale tab, a
fresh attempt succeeds.

### A customer says "my job is visible to everyone"

First, establish what they saw, without guessing:

1. Ask for the job id and the account they believe saw it.
2. Check the job's category and city against that account's claimed categories and areas.
3. Check for a block in either direction — a block *removes* eligibility; it does not add it.

If the account was NOT eligible, treat it as a privacy incident: this is the one class of bug that
stops the line. Capture the exact request (path, session, time), preserve the logs, and do not
attempt a fix under pressure. The eligibility predicate is pure and testable — reproduce it against
the real facts before changing anything.

If the account WAS eligible, it is working as designed; explain the two rules (category × area) and
offer to change the job's category or city if that widens the audience too much.

### "My ServMates can see my exact address"

Check the projection level the viewer is entitled to. A viewer with a live offer or the booking is
at the `party` level by design and sees the barangay and notes. A viewer without one seeing those
fields is a projection bug — same protocol as above.

### An offer was accepted twice, or two ServMates both think they were hired

The transaction did not hold. Find the job, and check the offers:

```bash
# which offers are still live on the job?
curl -sS --cookie "$COOKIE" https://<origin>/api/jobs/<jobId> | jq '.offers[] | {id, offerStatus}'
```

Exactly one offer may be `accepted` and the job must be `booked`. Any other live offer is the
defect. Do not delete rows: withdraw the extra offer, note the two accounts, and fix the transaction
before the next deploy.

### A booking is stuck in `completion_pending`

The customer has not confirmed. This is a user action, not an incident: the ServMate has done their
part and only the customer can close it. If the customer is unreachable, that is a support decision
(refund, cancellation) and it is deliberately not an in-product override — the product's whole
promise is that the worker cannot mark paid work done alone.

### Uploads fail with `400` or `413`

`413` is a size limit (≤ 3 MB per file, ≤ 6 per job) — expected. `400` is the declared type, the
byte check, or the job's status. If a legitimate PNG is refused, inspect the bytes' leading
signature; a screenshot re-saved by some tools carries the wrong magic bytes. Once a job is booked,
uploads are frozen by design and return `409`.

### The feed is empty for a ServMate

In this order: is their profile `active` (not `paused` or `suspended`); have they claimed at least
one category; is their area one of the coverage labels; is there an open, unexpired job in that
category and city that they neither own nor are blocked from. An empty feed is a **correct** answer
in several of those cases.

### Reviews show the wrong average

The aggregate is written in the same transaction as the review. If they disagree, the transaction
was bypassed: recompute the aggregate from the `reviews` rows, fix the writer, and only then
update the stored value.

---

## Things to never do under pressure

- Never "temporarily" relax an eligibility check, a projection level, or the `404`-for-both rule.
  These are the product's promise; an outage is recoverable and a leak is not.
- Never disable the session check to clear a 401 wave.
- Never delete rows to resolve a duplicate — withdraw, mark, or correct, and keep the history.
- Never print a token, an address, a message body or a report description into a ticket or a chat.

## Escalation

A suspected privacy leak (a viewer saw a field or entity they were not entitled to) goes to the
owner immediately, with the raw request details preserved. Everything else can wait for the next
business hour.
