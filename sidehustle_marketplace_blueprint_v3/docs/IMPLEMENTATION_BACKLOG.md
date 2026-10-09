# Prioritized Implementation Backlog

This backlog is a planning baseline. A product owner should refine estimates and split tasks once the repository, team and provider decisions are known. Every story must include UI/API/schema/security/test/operations acceptance criteria as applicable.

## Epic 0 — Close architecture decisions and set up repository (P0)

- [ ] Record decisions from `DECISION_REGISTER.md` and assign owners/deadlines.
- [ ] Choose package manager/workspace layout, lint/format/test standards, migration tool and CI platform.
- [ ] Establish branch protection, review requirements, secret scanning, dependency policies and code ownership.
- [ ] Create local onboarding guide; prove a clean developer machine can run tests.
- **Acceptance:** fresh clone can lint/typecheck/test from documented commands; no credentials required; unresolved decisions are clearly tagged.

## Epic 1 — Runtime skeleton and health (P0)

- [ ] Build NestJS skeleton, config validation, structured redacted logger, global validation/error handler and request IDs.
- [ ] Implement `/health/live` and `/health/ready` with correct dependency semantics.
- [ ] Add safe startup/shutdown, timeouts, rate limiting, security headers and basic metrics.
- [ ] Add minimal Flutter shell, typed API client setup, app config by environment, navigation and error/loading/empty states.
- [ ] Add Next.js web/admin shells; admin access must be independently protected before privileged features exist.
- **Acceptance:** local/CI tests pass; API container runs non-root; readiness/liveness differ; no config secrets in client bundles/logs.

## Epic 2 — Identity, account state and authorization (P0)

- [ ] Select and configure OIDC provider with mobile PKCE; define test tenant.
- [ ] Map external identity to local user/account status and customer/provider modes.
- [ ] Define session revocation, logout, recovery and step-up authentication requirements.
- [ ] Implement authorization policy service and the matrix in `AUTHORIZATION_MATRIX.md`.
- [ ] Test all critical endpoints with unauthenticated, wrong-role, wrong-owner, suspended and deleted accounts.
- **Acceptance:** no protected endpoint trusts client role/owner fields; BOLA/IDOR negative tests pass; admin MFA/role separation works in test environment.

## Epic 3 — Provider onboarding and catalog (P0)

- [ ] Implement safe public profiles and separate private fields.
- [ ] Implement provider onboarding/verification status, admin review reason and appeal path.
- [ ] Implement approved category taxonomy, listing draft/publish/moderation states, pricing model and availability.
- [ ] Add service search with bounded pagination/filtering and server-side publication eligibility.
- [ ] Add private file upload pipeline, signed URLs and scan/quarantine workflow if provider portfolios are enabled.
- **Acceptance:** unverified/ineligible providers cannot publish restricted offerings; customer APIs expose public-safe fields only; prohibited category and file tests pass.

## Epic 4 — Booking contract and state machine (P0)

- [ ] Finalize fixed-price vs quote model, cancellation, revisions, timeout, completion, no-show and dispute policies.
- [ ] Implement request/accept/reject/cancel/submit-work/revision/complete action endpoints.
- [ ] Add transaction/locking/version rules for conflicting actions.
- [ ] Snapshot terms/price/policy versions when the booking is created/accepted.
- [ ] Build customer/provider views for pending/accepted/in-progress/submitted/completed/cancelled/disputed states.
- **Acceptance:** state transitions match an approved table; invalid transitions fail; concurrent actions cannot create inconsistent state; every action is auditable.

## Epic 5 — Messaging, notifications and abuse controls (P1)

- [ ] Bind conversations to authorized participants and booking/policy rules.
- [ ] Add rate limits, block/report, abuse triage, retention and evidence handling.
- [ ] Configure transactional email/push with minimal notification content and opt-out/preferences where applicable.
- [ ] Add spam/review/referral abuse controls only when related product features are introduced.
- **Acceptance:** cross-user chat/file access fails; reports create trackable cases; notification/log tests show no sensitive content leakage.

## Epic 6 — Payments, ledger, refunds and payouts (P0 for any paid transaction; otherwise defer)

- [ ] Select PSP and obtain written confirmation of intended marketplace flow.
- [ ] Finalize accounting and tax examples with Philippine accountant.
- [ ] Implement payment adapter, idempotency storage, signed webhook verification and durable event inbox.
- [ ] Implement append-only balanced ledger and safe money types/currency.
- [ ] Implement refunds and payout workflows with explicit approvals, provider status inquiry and reconciliation.
- [ ] Create daily reconciliation job and mismatch alert; define ambiguous transaction manual review process.
- **Acceptance:** sandbox-only; duplicate/reordered/invalid events safe; ledger balances; retry after timeout cannot duplicate funds; all PSP scenarios reconcile. Production keys remain disabled until sign-off.

## Epic 7 — Reviews, disputes, compliance and admin (P1)

- [ ] Allow reviews only for eligible completed transactions with abuse reporting/moderation.
- [ ] Implement complaint/dispute case model, evidence access logs, timeline, owner, decision, refund linkage, response SLA and escalation.
- [ ] Implement role-scoped admin queues and audited actions.
- [ ] Add data-subject request, account deletion/retention jobs and prohibited-service takedown.
- **Acceptance:** complaints and deletions can be completed end-to-end; role matrix enforced; case and admin audit history cannot be silently rewritten.

## Epic 8 — Platform engineering and release controls (P0 before public launch)

- [ ] Finalize Dockerfile based on actual package/workspaces; pin base image versions/digests in CI, run non-root, scan, SBOM.
- [ ] Use Compose for fresh DB/cache integration tests; test from clean schema.
- [ ] Use `kind` for local Kubernetes deployment smoke, probes, resource limits, security context, restart/rollout and cleanup.
- [ ] Build protected CI pipeline; artifact digest tracing; human promotion; rollback steps.
- [ ] Establish secrets manager, environment separation, managed DB/backup plan and access review.
- [ ] Establish monitoring, alerts, runbooks and incident contacts.
- **Acceptance:** clean build/reproducible tests; no secret leaks; local cluster rebuilds from scratch; staging rollback and restore drills pass.

## Epic 9 — Independent review and controlled launch (P0)

- [ ] Philippine legal, tax, privacy and payment flow reviews completed and documented.
- [ ] PIA/data inventory and DPO/NPC obligations evaluated.
- [ ] Penetration test and remediation/retest complete.
- [ ] Load/abuse test and backup restore/incident tabletop complete.
- [ ] App Store / Google Play disclosures, UGC moderation and deletion requirements checked against actual app.
- [ ] Closed beta support, complaint, safety and refund/payout workflows rehearsed.
- **Acceptance:** all applicable gates in the production spec have evidence, owner and sign-off; no unresolved critical risk; production real-money feature flag remains off until written approval.

## Sequencing note

The first milestone is not a payment feature. Build a safe skeleton and authentication/authorization tests first. Payment-related work can be designed in parallel but must stay sandbox-only until the PSP/legal/accounting decisions are closed. Do not start regulated/high-risk service categories as an MVP shortcut.
