# Testing Strategy

The tests exist to protect three properties that are easy to break and expensive to notice:
**privacy**, **money**, and **state transitions**. Everything else is a supporting detail.

---

## How the suite runs

```
npm test          node --import ./test/register.mjs --test test/*.test.ts
npm run test:e2e  node test/e2e-live.mjs          # starts its own isolated server
npm run build     next build                      # type and route validation
```

Unit and integration tests run on Node's built-in test runner. `test/register.mjs` installs
`test/ts-extension-hooks.mjs`, a resolver that lets a `.ts` module be imported by a `.ts` test
without a build step. There is no test framework, no transform and no mock library — a test asserts
against the real domain modules and the real store, which is why a passing test means the
production code path worked.

Each test file resets the store to the seed before it runs, so files are order-independent and can
run concurrently.

## The suite, and what each file protects

| File | Protects | The test that earns its place |
|---|---|---|
| `policy.test.ts` | transitions and gates | every illegal booking transition for every actor is refused, not merely unmentioned |
| `jobs-offers.test.ts` | discovery and offers | **a wider feed filter never widens the set**; a second live offer is refused; acceptance withdraws the rest in one step |
| `booking-lifecycle.test.ts` | completion and review order | the ServMate cannot skip the customer's confirmation; a second review is refused; the snapshot survives a later price edit |
| `dispute.test.ts` | the state that stops the machine | a dispute blocks completion, confirmation and review on both sides; withdrawing returns the booking exactly where it was |
| `password-reset.test.ts` | account recovery | known and unknown addresses are answered alike; only the digest is stored; a link works once; a reset ends every session |
| `media-access.test.ts` | bytes | an eligible ServMate reads an asset, an unrelated account gets `404`, a deleted asset is gone, and a declared type that disagrees with the bytes is refused |
| `trust.test.ts` | blocks and reports | the block hides the job in both directions, the other account cannot learn it was blocked, a report leaves visibility unchanged, and the reporter's own list names a job only while they can still open it |
| `notifications.test.ts` | attention | a recipient's feed contains their rows and nobody else's; read state round-trips |
| `provider-console.test.ts` | the console | a completed-booking portfolio claim is verified server-side; a provider cannot set `verificationStatus` |
| `search.test.ts` | the search ranker | a term that starts a field beats one that merely contains it; equally good answers order by rating rather than input order; an empty query searches for nothing and no match returns nothing |
| `moderation.test.ts` | the operator console | every way of not being an operator is refused identically; a verdict needs a reason, moves the booking and notifies both parties; the audit row is written in the same transaction |
| `account-deletion.test.ts` | erasure and retention | live work refuses deletion and names it; the password is checked; a finished booking keeps a title snapshot after its job row goes; the tombstone cannot be signed into and the purge detaches rather than deletes |
| `e2e-live.mjs` | the whole thing over HTTP | sign-up → job → media → feed → offer → accept → start → finish → confirm → review, plus the signed-out `401`, the foreign-origin `403`, the `429` with `Retry-After`, the header set, search suggestions, the manifest and offline document, and the moderation console's refusals on every run with its privileged path when the operator token is supplied |

## What the tests are written to assert

**Privacy is asserted as an equivalence, not a value.** The unit tests compare the eligible set for
a viewer against the set for the same viewer with a broader filter, and require the second to be a
subset. That is what makes a future refactor of the filter chain safe: it is impossible to pass by
widening.

**Refusals are asserted as codes, not messages.** A test that asserted an error string would pin
the wording; a test that asserts `404` for both "absent" and "not yours" pins the *indistinguishability*,
which is the property that matters.

**Money is asserted after the fact.** The lifecycle test edits the listing's price after a booking
was created and requires the booking's amount to be unchanged. That test is the reason the snapshot
exists.

**The e2e script drives the real server.** `test/e2e-live.mjs` starts from the running app, creates
its own account, and walks the journey through the same HTTP surface a browser uses. It checks
status codes, JSON shape and, for the launch surfaces, response headers and the presence of the
controls a person needs — not pixels, so a restyle cannot make it pass or fail.

**The destructive path is exercised on a throwaway account.** Deletion is tested by creating an
account in the run's scratch store, asserting the refusals, deleting it, and proving its session and
credentials are gone. The run's own data directory is removed afterwards, so no test can erase a
developer's account.

## Deliberately not tested

- **Rendering.** No snapshot tests of markup: they change with every copy edit, they do not detect
  the bugs that matter here, and the properties they would pin are asserted at the API instead.
- **The JSON store's file format.** It is a stand-in. Its *behaviour* is covered by the domain
  tests; its on-disk shape is expected to be replaced.
- **Third-party provider responses.** The OAuth flows are exercised manually against a configured
  provider; the tests cover `pending_auth` consumption and the state/nonce checks, which are the
  parts ServEm controls.

## How to verify a change

```bash
cd apps/public-web
npm test                       # unit and integration
npm run build                  # types and routes compile

# then — the moderation checks exercise their privileged half only when the
# command holds the operator credential; it starts its own dev server and
# passes the same value on to it:
SERVEM_MODERATION_TOKEN=$(openssl rand -hex 32) npm run test:e2e
```

A change to eligibility, transitions, money or media is not verified by the build alone — the build
proves it compiles, not that a stranger still cannot see the job. Those four areas have named test
files above; run them. A change to a projection should also be checked by hand in both consoles,
because the projection is a decision about what a person sees, and the test asserts the set, not the
feel.

## Coverage gaps, stated rather than implied

| Gap | Why | Plan |
|---|---|---|
| No browser-driven UI tests | cost/benefit at this stage; the API carries the logic. Browser checks were also less useful than they looked until `allowedDevOrigins` listed `127.0.0.1`: the preview panel served from that origin while the dev server announced `localhost`, so the page was static HTML with nothing hydrating | add a smoke journey when the UI stabilises |
| The privileged moderation path needs a token in two environments | the server reads it from its environment and the script must be given the same value; without it those checks print a `NOTE` and are skipped rather than passing silently | an operator account provisioned per environment would remove the manual step |
| A form that gates submission on typed text cannot be driven end-to-end by the automation harness used here | the preview re-mounts pages continuously, so React state resets between typing and clicking; the submit path is covered at the API instead | drive the console against a production build in a stable browser |
| No production-build service-worker check in CI | registration is production-only and the e2e script starts a dev server; the manifest and offline document are checked instead | add a `next start` smoke step to CI |
| No concurrency test for offer acceptance | the store has one writer; SQL will not | add a parallel-acceptance test with the SQL repository |
| No load or edge rate-limit tests | the limiter's shape is covered (unit + live 429 checks); throughput and a shared counter are not | pair with the edge rate-limit work |
| Moderation has no test surface | no operator API yet | test with the operator API |
