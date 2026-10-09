# Threat Model — Side-Hustle Marketplace

**Purpose:** Identify material risks and connect them to requirements and tests. Revisit this model after payment, identity, messaging, hosting, and service-category decisions and after material incidents.

## 1. Assets to protect

- User accounts, sessions, reset channels and device/authentication state.
- Provider verification outcomes and any retained ID evidence.
- Private phone/email/address/tax/payout data.
- Listings, booking details, messages, submitted work, reviews and dispute evidence.
- Payment intents, provider webhook events, ledger, refunds, settlement and payout records.
- Admin credentials, authorization policies, audit logs and moderation actions.
- Application signing/build credentials, CI tokens, cloud roles, encryption keys and PSP credentials.
- Business availability, integrity of bookings/money, reputation and trust in the platform.

## 2. Trust boundaries

1. Mobile devices and browsers are untrusted; clients may be rooted, instrumented, modified or automated.
2. API edge to application modules: every input may be hostile; authentication is not authorization.
3. Application to database/cache/storage: service identities must have least privilege; raw records/files require domain authorization.
4. Platform to PSP/IDV/email/SMS/push vendors: treat responses/webhooks as untrusted until authenticated/validated; vendors are processors with separate risk.
5. Admin/support/finance: staff accounts can be compromised or misuse access; separate duties, limit access and audit reads/writes.
6. Build/CI/registry/deployment: a compromised dependency or CI token could become a production compromise.
7. Local/test/staging/production: strict isolation; test tooling must never access production data or credentials.

## 3. Threat scenarios and required controls

| Threat | Impact | Required preventive controls | Required detection/test evidence |
|---|---|---|---|
| BOLA/IDOR: user requests another user's booking/message/payout | Privacy loss, theft, dispute abuse | Backend ownership + role + status checks; narrow DTOs; deny by default | Automated cross-account matrix tests for every ID-bearing endpoint |
| Mass assignment changes role, price, status or payout | Privilege escalation/fraud | Allowlisted DTOs; server-calculated values; explicit transition methods | Tests submit admin fields/client totals and prove ignored/rejected |
| Account takeover | Fraud, data theft, payout redirection | Managed auth, rate limits, MFA for admin/sensitive actions, session revocation, change notifications | Password reset/OTP abuse tests; suspicious login/change alerts |
| Provider impersonation / fake profiles | Customer harm | Identity/professional credential verification as applicable; moderation | Fake/duplicate onboarding abuse tests; manual-review workflows |
| Payout account takeover | Money diverted | Step-up auth, cooling-off period/risk review, out-of-band alert, manual review above thresholds | Test session theft/payout-change edge cases; payout approval audit |
| Forged/replayed/duplicated PSP webhook | Fake paid state or duplicate refund/payout | Signature + timestamp validation, durable unique event ID, idempotent handler, server-to-server reconciliation | Invalid-signature, replay, reorder, duplicate, timeout tests |
| Payment/ledger race or retry | Double charge/refund/payout, ledger imbalance | DB constraints/transactions, idempotency records, append-only balanced ledger, PSP reconciliation | Concurrency/race tests, invariant checks, daily reconciliation alert |
| Price/fee/tax manipulation in client | Financial loss | Server-side quote/fee/tax calculation, immutable price/policy snapshot, currency explicit | Tampered payload tests; compare ledger against expected totals |
| Malicious upload or exposed object URL | RCE, malware, ID evidence leak | Private bucket, signed short-lived scoped URLs, size/type checking, malware scanning, generated keys | Malicious MIME/extension/path tests; access from unauthorized accounts denied |
| Sensitive data in logs/push/crash telemetry | Privacy breach | Structured redaction, approved field allowlist, minimal notification content | Automated log/telemetry scanning with synthetic secret/PII sentinels |
| Admin credential compromise or insider misuse | Mass access, fraud, cover-up | MFA, least privilege, JIT/break-glass, dual approval for high-risk actions, audit immutability | Admin privilege and audit-read tests; alert on bulk exports/suspensions/refunds |
| Dependency/image/CI supply-chain attack | Production compromise | Lockfiles, reviewed/pinned actions/images, scanning, provenance/SBOM, protected branches, no secrets in PR | CI policy tests, image scan reports, artifact provenance record |
| Resource exhaustion/bot abuse | Outage, SMS cost, listing spam | Per-route and per-identity rate limits, quotas, payload caps, timeouts, query limits | Load/abuse tests, cost/volume alarms, 429 behavior verification |
| Database loss/ransomware/incorrect migration | Data unavailability/corruption | Encrypted isolated backups, least-privilege access, tested restore, backward-compatible migrations | Scheduled restore drills and migration rollback/forward tests |
| Unsafe or illegal service listing | User harm, regulatory exposure | Category allowlist, professional credential checks where applicable, user reporting, takedown/moderation | Moderation tabletop exercise; response-time and audit evidence |
| Off-platform fraud, harassment or abuse | User harm/trust loss | In-app block/report, policy enforcement, evidence controls, clear escalation workflow | Reporting UX tests, safety escalation drills, moderation backlog alerts |
| Privacy deletion fails across copies | Excess data retention | Data inventory, retention schedule, deletion jobs, vendor/backup expiry design | Test deletion in DB, object store, search, cache, exports and backup lifecycle |
| Kubernetes workload escape/misconfiguration | Cluster compromise | Non-root, drop capabilities, seccomp, read-only FS when supported, no privilege, minimal service account | Manifest policy scan, admission checks in staging, runtime review |
| Environment confusion/test touches production | Real data/financial incident | Separate credentials/tenants/accounts, allowlisted PSP base URLs, disabled test money features | CI tests assert prod hosts/secrets absent from test config; operator checklist |

## 4. Security design requirements

- Use threat modeling during feature design, not only before launch. Model spoofing, tampering, repudiation, information disclosure, denial of service and privilege escalation for high-risk flows.
- Threat-to-test traceability is required. A threat without a preventive/detective control and test/owner is an open risk.
- Device/app attestation is a signal only; it must never replace server-side authorization or be the sole reason for an irreversible account decision.
- Keep security-sensitive rules server-side; rate-limit and audit enforcement decisions.
- Record admin reasons and before/after values for financial/account status changes without duplicating secret/PII payloads into logs.
- Review false-positive risk and appeals for automated fraud decisions that materially restrict provider livelihood/access.

## 5. Abuse cases to include in automated tests

1. Customer A reads or modifies Customer B's booking, message, address or dispute.
2. Provider A reads Provider B's identity/tax/payout information.
3. Suspended or unverified provider accepts a booking or creates a listing.
4. Customer changes client price/fee/status and backend refuses.
5. Simultaneous accept/cancel/complete calls lead to only one legal transition.
6. A webhook with wrong signature, old timestamp, reused event ID or out-of-order status creates no duplicate effect.
7. Timeout after PSP payout call does not blindly submit a second payout.
8. Public profile API never reveals private verification/tax/payout fields.
9. Upload URL cannot be reused for another object or another account; expired URL fails.
10. Admin role cannot execute finance/security-only operations; unapproved refunds/payouts fail.
11. Account deletion redacts/deletes data according to policy while retaining only explicitly approved records.
12. A test environment cannot access production DNS endpoints, secrets or provider credentials.

## 6. Review cadence

- At initial architecture approval.
- Before enabling identity documents, in-person services, real payments, payouts or automated profiling.
- Before public beta and after penetration testing.
- After an incident, major dependency/hosting/payment change, or a material change in data collected.
