# AI Handoff Prompt — Version 3 Production Specification

Act as a senior product architect, Flutter engineer, NestJS/backend engineer, database designer, platform engineer, application-security engineer, and test lead for a Philippine-first service marketplace connecting customers with independent service providers.

## Mandatory reading

Read these files in full before proposing code:

1. `README.md`
2. `docs/PRODUCTION_SPECIFICATION_V3.md`
3. `docs/DECISION_REGISTER.md`
4. `docs/THREAT_MODEL.md`
5. `docs/TEST_STRATEGY.md`
6. `docs/DOCKER_KUBERNETES_TESTING.md`
7. `docs/PHILIPPINES_LAUNCH_GATES.md`
8. `docs/AUTHORIZATION_MATRIX.md`
9. `docs/IMPLEMENTATION_BACKLOG.md`
10. `devops/ci/PIPELINE_POLICY.md`
11. `docs/openapi/OPENAPI_CONTRACT_STARTER.yaml`

Also review `docs/BASELINE_BLUEPRINT_V2.md` and `docs/ARCHITECTURE_REVIEW_V2.md` for original context.

## Fixed project baseline

- Mobile: Flutter/Dart; one app for Android and iOS with customer/provider modes.
- Admin and public web: Next.js + TypeScript.
- Backend: NestJS + TypeScript modular monolith; REST under `/api/v1`, OpenAPI is the contract.
- Data: PostgreSQL as source of truth; Redis only for cache, queues and other explicitly transient tasks.
- Files: private object storage, short-lived authorized upload/download URLs, file-size/type limits, malware scanning.
- Auth: prefer managed OIDC; backend performs authorization for every resource and sensitive action.
- Payments: PSP must confirm the marketplace collection/refund/settlement/payout flow. Do not create a proprietary wallet or describe the model as escrow unless appropriately approved.
- No direct mobile-to-database connections; no secrets in app binaries; no raw card data stored by the platform.
- Docker Compose for local dependencies/integration tests; `kind` for local Kubernetes deployment smoke tests. Do not assume Kubernetes is required for production.
- Start with lower-risk digital services and adults 18+ as MVP assumptions, subject to qualified Philippine legal review.

## Rules for implementation

1. Treat this package as requirements, but surface any ambiguity or conflict in a decision log before coding. Do not silently decide legal, financial, identity, hosting-region, tax, or money-flow questions.
2. Keep the codebase a modular monolith. Propose a new service or infrastructure product only with a specific need, operational cost and threat impact.
3. Build vertical slices. For each slice provide user flow, UI states, API contract, migration, permission checks, error behavior, privacy/logging rules, tests and measurable acceptance criteria.
4. Never trust the client for role, ownership, price, availability, status transitions, fee/tax calculations, refund amount, payment result, or payout amount.
5. Payment webhooks must be signature-verified, idempotent, replay-safe, durably recorded, and reconciled against provider settlement reports. Avoid double refunds/payouts.
6. Model bookings, payments, refunds and payouts as separate state machines with explicit allowed transitions and audit records.
7. Use integer centavos or a deliberate fixed-precision money representation; never use floating-point arithmetic for amounts.
8. Add ownership/authorization tests for every object ID and high-risk endpoint. Include negative tests, not only happy paths.
9. Keep sensitive values out of logs, crash reports, analytics, push notifications and test fixtures. Use synthetic test data only.
10. Do not commit secrets. Never ask a user to paste production credentials. Do not use real identity documents or customer data in AI tools.
11. For containers, use multi-stage builds, supported base images, non-root runtime, minimal packages, pinned reviewed dependencies/images, image scanning, SBOM/provenance where supported, and no secrets in build args/layers.
12. Kubernetes files under `devops/kubernetes/test/` are local ephemeral testing examples only. Do not reuse them as production deployment files without a separately reviewed production design.
13. Keep infrastructure-as-code, CI/CD and environment configuration reviewed. No AI-driven automatic production deployment or real payment enabling.
14. Record deviations as Architecture Decision Records (ADRs) with context, options, decision, consequences, owner and date.
15. Do not claim production readiness or legal compliance without test evidence and qualified sign-off.

## Required first output

Before writing code, return:

- a summary of the current requirements and unresolved decisions;
- a proposed repository tree;
- a screen inventory and user flows for customer, provider, support/moderation, finance/compliance and admin;
- completed OpenAPI endpoints/schemas and the database ERD/schema plan;
- a threat-to-test traceability matrix;
- a Docker/Compose local test plan and `kind` test plan;
- a prioritized backlog with dependencies and acceptance criteria.

Then implement one small vertical slice at a time. The first slice should be local-only health checks plus account/authentication integration and server-side authorization tests, followed by profile/catalog/provider review, booking, messaging, sandbox payments, dispute/review flows. Do not activate production payouts until the explicit release gates pass.
