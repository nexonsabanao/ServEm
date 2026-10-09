# Test Strategy and Acceptance Standard

## 1. Testing layers

| Layer | Where | Main coverage | Release use |
|---|---|---|---|
| Static checks | CI | Format, lint, types, dependency/secret scan, IaC/YAML lint | Every PR |
| Unit | API/mobile/web | Business rules, validators, fee calculation, state transitions, permissions policy | Every PR |
| Database integration | Docker Compose | Real PostgreSQL constraints/transactions/migrations; Redis behavior where used | Every PR touching backend/schema |
| Contract | API/OpenAPI | Request/response schemas, error model, compatibility, generated clients | Every PR changing API |
| API authorization | Test API + synthetic users | Object ownership, role/status checks, mass assignment, tenant/account isolation | Every PR touching protected route |
| End-to-end | Test environment | Customer/provider workflows, failures, cancellations, reports | Nightly and before release |
| Payment simulation | PSP sandbox/mock | Duplicate/reordered/invalid webhooks, timeouts, refund/payout reconciliation | Every payment change; before release |
| Container | Docker-built image | Startup, non-root, probes/health, graceful shutdown, image scan | Every API image build |
| Kubernetes smoke | Disposable `kind` | Deploy, service routing, probes, resource/security context, rollout and teardown | PR/nightly for manifest changes; release candidate |
| Performance/abuse | Isolated environment | Load, concurrency, rate limiting, queue growth, search query limits | Before beta and after material changes |
| Security assessment | Staging/release candidate | Independent penetration test, mobile/API/web checks | Before public production and after major risk changes |
| Recovery/operations | Staging | Backup restore, migration, rollback, incident/tabletop exercise | Before launch and periodically |

## 2. Required properties and tests

### Authentication/authorization

- Unauthenticated requests fail consistently.
- Expired/revoked sessions fail after defined revocation timing.
- Every sensitive route has positive and negative role/ownership tests.
- Admin endpoints are unavailable to customer/provider roles.
- Rate limits are enforced for login, recovery, OTP, listing, booking, messaging, reports and uploads.

### Database and state machines

- Fresh database migrations run from empty schema.
- Upgrade path from supported prior schema runs in a test clone.
- Foreign-key, unique, check and transaction constraints protect invariants.
- Concurrent accept/cancel and duplicate completion requests result in one valid outcome.
- Deletion/retention behavior follows approved policy, including files/caches/indexes.

### Payment, refunds, ledger, payouts

- All calculations use centavos/fixed precision and explicit currency.
- Repeated client idempotency key returns safe same result; different request with reused key is rejected.
- Same webhook event processed multiple times has one business effect.
- Reordered events cannot regress a terminal status without an explicit reconciliation decision.
- Forged webhook does not change payment status.
- PSP timeout is reconciled before retry; no duplicate payout/refund.
- Ledger journal balances; reversals are compensating entries; no direct edits.
- Daily reconciliation detects mismatched customer charge, fee, tax, refund, settlement and provider payout.
- No test uses real payment credentials or funds.

### Files, messaging and privacy

- Unsupported, oversized, malicious and spoofed-MIME uploads are rejected or quarantined.
- Private object download requires authorized, unexpired, scope-bound access.
- Logs do not contain seeded sentinel secrets/PII.
- Chat access is restricted to conversation participants under current account/booking policy.
- Account deletion/export/correction and retention exceptions are tested end-to-end.

### Reliability

- Readiness fails if critical required dependencies are unusable; liveness only fails when process cannot make progress. Avoid using liveness to restart on temporary PSP/database outages.
- App handles SIGTERM/graceful shutdown, in-flight request drain and background job shutdown.
- Database connection pool/timeouts/retries are bounded; no retry storm on external-provider outage.
- Queue jobs are idempotent; dead-lettered jobs alert and can be safely replayed after inspection.
- Backup restore and version-compatible migration rehearsals meet accepted RPO/RTO.

## 3. Test data policy

- Generate synthetic accounts, profiles, IDs, messages, bookings and payment events.
- Use PSP test tokens only; do not paste production customer records into issues, logs, screenshots, AI tools or test fixtures.
- Never copy production database backups into local Compose or kind clusters unless explicitly authorized, minimized/de-identified, encrypted, access-restricted and approved by privacy/security leads.
- Keep local test data resettable. Document seed/cleanup commands.

## 4. Quality gates

Proposed initial gates, to be ratified by engineering/security owner:

- All required tests pass; flaky tests are tracked and cannot be silently ignored for release-critical flows.
- 100% of sensitive API operations have documented authorization requirements and negative tests.
- No unresolved critical security findings; no unresolved high finding without documented accepted risk and compensating control under the agreed policy.
- All financial invariant/replay/concurrency tests pass.
- Container runs as non-root and passes image/dependency policy.
- OpenAPI lint/compatibility checks pass.
- Staging restore, incident and rollback exercises have retained evidence.
- Independent penetration test completed for public production and remediations retested.

Coverage percentage is a diagnostic, not a sufficient security criterion. Prioritize risk-based branches and invariants over chasing a single global line-coverage number.

## 5. Evidence retained for release

- CI run URL and commit digest.
- Test reports, OpenAPI diff and database migration report.
- Dependency/image scan and SBOM.
- Test environment/deployment revision.
- Security finding register and approved risk exceptions.
- Penetration test report/remediation evidence.
- Backup restoration/rollback/incident drill evidence.
- Signed checklist with named owner/date for each launch gate.
