# Architecture Review & Recommended Additions

**Status:** Review addendum to the original marketplace blueprint  
**Purpose:** Identify launch-blocking decisions and reliability/security work that should be made explicit before implementation and production.

This addendum supplements `README.md`; it does not replace it. The current stack is a reasonable MVP baseline. The biggest risks are not solved by adding more frameworks or microservices. They are addressed through clear product decisions, safe money handling, privacy minimization, repeatable deployment, testing, and operating procedures.

## Executive recommendation

**Keep the proposed architecture. Do not expand the stack yet.** Use one Flutter mobile app, a Next.js admin/public web layer, a NestJS modular monolith, managed PostgreSQL, private object storage, a managed identity provider, and a payment provider whose written product terms support this exact marketplace flow.

Before production, add the explicit controls below and make the release gates measurable. Treat `DECISION REQUIRED` items as unresolved until a named owner records the decision and supporting evidence.

## 1. Make these product and legal decisions before coding money flows

- Decide whether bookings use request/quote, fixed price, milestones, or a controlled combination. Keep the first release as simple as possible.
- Decide which service categories and geographic regions are enabled. Start with digital/low-risk services; require approval to add a new category.
- Define who contracts with whom, what the platform promises, cancellation/refund rules, provider eligibility, complaint handling, and what happens when work is disputed.
- Obtain written confirmation from the selected payment provider that it supports the proposed marketplace business model in the Philippines, including provider onboarding/KYC if applicable, collection, settlement or payout, refunds, chargebacks, and the intended timing of each action.
- Have Philippine counsel and an accountant review worker/recruitment classification, tax/withholding, payment flow, platform terms, and consumer/e-commerce obligations. A technical architecture cannot answer these legal questions.

## 2. Add a concrete threat model and data-flow review

Create `docs/security-threat-model.md` before sensitive features are implemented. For each data flow, record the asset, actor, trust boundary, attack, preventive control, detection signal, and owner.

At minimum, cover:

- Account takeover, credential stuffing, OTP abuse, session theft, and account recovery abuse.
- Broken object-level authorization (BOLA/IDOR) for bookings, messages, attachments, IDs, payout details, and disputes.
- Fake providers, stolen identities, abusive listings, review manipulation, spam, harassment, and off-platform scams.
- Payment spoofing, duplicate/out-of-order webhooks, refund abuse, payout redirection, chargebacks, and ledger/reconciliation mismatch.
- Malicious uploads, exposed file URLs, malware, excessive file sizes, and access to another user’s evidence.
- Insider misuse through support/admin tools, compromised vendor credentials, leaked secrets, and production-data exposure.
- Ransomware, cloud misconfiguration, accidental deletion, regional/provider outage, and failed deployment/migration.

Every important threat should have a test or operational control that proves the mitigation works.

## 3. Turn security guidance into CI/CD release checks

Use OWASP ASVS 5.0.0 as the web/API security requirements reference and OWASP MASVS/MASTG for mobile security testing. Select applicable controls, track them in a control matrix, and record evidence rather than simply claiming “OWASP compliant.” Use a secure development lifecycle aligned with NIST SSDF.

Recommended pipeline checks:

1. Formatting, lint, unit tests, integration tests, and API contract tests.
2. Secret scanning on commits and repository history; block exposed credentials.
3. Dependency/SCA scanning with an update and vulnerability-triage policy.
4. SAST for backend and web code; infrastructure-as-code scanning if IaC is adopted.
5. Container/image scanning if container images are built.
6. Migration safety checks and backup/rollback planning for schema changes.
7. Staging DAST and security regression tests for high-risk APIs.
8. Signed/reproducible release artifacts where practicable; protect signing keys and store credentials.
9. Independent mobile/API/web penetration testing before public launch and after major changes to payment, identity, or authorization.

No pipeline can prove absolute security. It can prevent common regressions and make verification repeatable.

## 4. Strengthen payment and ledger integrity

- Represent money using integer minor units (centavos) or a carefully defined fixed-precision type. Never use floating-point math for payment amounts.
- Make the ledger append-only after posting. Correct errors with linked reversal/adjustment entries, not edits to historic entries.
- Separate booking, payment, refund, and payout states. A booking completing must not itself prove a payment or payout succeeded.
- Verify provider webhook signatures, deduplicate provider event IDs, and make handlers idempotent. Assume webhooks may be repeated, delayed, or received out of order.
- Keep an internal record of every provider reference and reconcile expected versus actual provider balances/settlements on a schedule. Alert on mismatches and provide a manual finance review workflow.
- Require step-up authentication, notifications, and a cooling-off/review process for payout-account changes.
- Do not store card data or create an internal wallet/escrow model unless separately designed and approved.
- Keep real-money functionality feature-flagged off until the provider, legal, tax, accounting, security, and support owners sign off.

## 5. Add measurable reliability and recovery objectives

The blueprint already calls for isolated environments, monitoring, rollback readiness, and restore testing. Before selecting the final hosting plan, set explicit targets:

- **RPO:** maximum tolerable data loss after an incident.
- **RTO:** target time to restore service.
- **Availability target:** an MVP target that matches budget and support capacity.
- **Backup policy:** database point-in-time recovery if supported, encrypted backups, separate access controls, retention period, and documented restore procedure.
- **Restore drills:** periodically restore into an isolated environment and verify application consistency, not just that a backup file exists.
- **Queue operations:** retry policy, exponential backoff, dead-letter handling, deduplication, and alerts for stuck webhook/notification jobs.
- **Runbooks:** payment provider outage, suspected account takeover, data breach, database outage, leaked secret, malicious upload, and bad release/rollback.

The exact targets depend on launch budget and the consequences of losing a booking or financial record; decide them explicitly rather than choosing arbitrary numbers.

## 6. Tighten access management and production operations

- Keep separate cloud accounts/projects or equivalent isolated environments for development, staging, and production.
- Use least-privilege roles and a secrets manager/KMS. Do not store production secrets in source control, mobile builds, AI prompts, or ordinary chat logs.
- Restrict production database access to approved operational needs; support staff should use audited admin workflows, not direct SQL.
- Separate normal admin login from customer/provider identity if feasible. Do not permit public admin self-registration. Require phishing-resistant MFA where practical, particularly for privileged users.
- Use just-in-time/break-glass access for rare super-admin activity with reason, time limit, alerting, and audit trail.
- Require peer review for sensitive changes and two-person approval for high-value or exceptional refund/payout operations where the business size warrants it.
- Review vendor access, admin roles, tokens, and cloud permissions periodically and whenever a team member leaves.

## 7. Make file handling a distinct security subsystem

For portfolios, deliverables, identity evidence, and dispute attachments:

- Keep buckets/private objects private by default; never make ID/dispute evidence publicly addressable.
- Issue short-lived, narrowly scoped upload/download URLs only after the backend authorizes the specific object and user.
- Enforce size/type limits; do not trust the filename or client-supplied MIME type.
- Scan uploads for malware and validate/process media before it is presented to another user.
- Store files under generated object keys, not user-controlled paths.
- Log access to sensitive evidence, encrypt storage, define retention/deletion jobs, and avoid sending sensitive evidence through ordinary email/push notifications.

## 8. Add operational anti-abuse controls

- Rate-limit login, OTP/resend, search, messaging, booking creation, report submission, file uploads, and account recovery.
- Add anti-automation controls proportionate to observed abuse; do not treat device/app attestation as a substitute for authorization.
- Use idempotency for retried client operations and clear “pending/processing” states in the UI.
- Enforce quotas for new accounts, listings, messages, and reports to reduce spam and review manipulation.
- Give users report/block controls; route urgent safety reports to a defined response queue.
- Make fraud rules explainable to operators, limit false-positive harm, and include a review/appeal route for consequential account restrictions.

## 9. Data minimization and privacy operations

- Maintain a data inventory listing each field, purpose, legal basis to be validated, access roles, vendors/recipients, retention period, and deletion behavior.
- Separate public provider profile fields from private verification, tax, payout, and contact fields.
- Minimize raw government ID storage; prefer a verification vendor reference/result where suitable. If raw documents are necessary, isolate them from ordinary application data and strictly limit access.
- Keep personal data and secrets out of application logs, analytics, crash reports, and push-notification previews.
- Implement a tested deletion/export/correction workflow, with documented exceptions for records that must be retained for legal, tax, dispute, or security purposes.
- Prepare an incident/breach-response plan, including a decision tree for whether NPC/data-subject notification is legally required and who makes that determination.
- Evaluate whether NPC/DPO/processing-system registration obligations apply to the actual processing. Re-check as user numbers, sensitive data, and automated profiling change.

## 10. Define a production go/no-go checklist

Do not enable public production transactions until each applicable item is marked complete with evidence and an accountable owner:

- [ ] Product/service categories and operating model approved for initial release.
- [ ] Philippine legal/accounting/privacy review completed for the actual service, payment, tax, and platform model.
- [ ] Payment provider has confirmed the exact collection/refund/payout flow in writing; sandbox reconciliation has passed.
- [ ] Threat model and data inventory reviewed; high-risk threats have mitigations and tests.
- [ ] API authorization tests cover cross-user access and all high-risk objects.
- [ ] No unresolved critical/high security findings from independent testing.
- [ ] Secret handling, environment isolation, backup/restore, logging, alerting, rollback, and incident runbooks tested.
- [ ] Privacy notices, terms, provider/customer agreements, retention and account deletion match actual implementation.
- [ ] Complaint, moderation, refund, dispute, and prohibited-service workflows rehearsed by real operators.
- [ ] Support and security response ownership, escalation paths, and on-call coverage are documented for launch scale.
- [ ] App Store/Google Play privacy, safety, account-deletion, and review requirements are prepared.

## 11. Advice for building with another AI

- Treat the blueprint and accepted architecture decisions as project constraints; ask the AI to record deviations as Architecture Decision Records (ADRs).
- Build vertical slices, not a huge generated application. For each feature require the UI states, API contract, migrations, permissions, tests, threat review, logging/privacy review, and acceptance criteria.
- Never give the AI production credentials, real identity documents, customer data, signing keys, or payment secrets.
- Require a human to review generated database migrations, authorization logic, money calculations, authentication changes, infrastructure changes, and dependencies before merge.
- Do not allow an AI tool to deploy directly to production or enable real payments without human approval.
- Keep all work in version control with reviewed pull requests and a clear rollback path.

## Reference standards (verify current versions when implementation begins)

- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Mobile Application Security / MASVS / MASTG: https://owasp.org/projects/mobile-application-security
- NIST Secure Software Development Framework: https://csrc.nist.gov/projects/ssdf
- Philippine National Privacy Commission: https://privacy.gov.ph/
- BSP Payments and Settlements: https://www.bsp.gov.ph/SitePages/PaymentsAndSettlements/PaymentsAndSettlements.aspx

## Bottom line

The existing stack and high-level architecture are sufficient to start detailed product design and MVP implementation planning. They are not, on their own, proof that the application is secure, reliable, or legally ready to launch. Keep the architecture simple and invest effort in the decisions, tests, operations, and evidence above.
