# Decision Register — Version 3

Use statuses: `PROPOSED`, `OPEN`, `APPROVED`, `REJECTED`, `DEFERRED`. Every approved decision should have an owner, date, rationale and change impact. Do not turn an `OPEN` item into code without recording the decision.

| ID | Decision | Recommended default | Status | Owner / exit condition |
|---|---|---|---|---|
| D-001 | Mobile framework | Flutter, one Android/iOS app | PROPOSED | Founder + mobile lead; approve after prototype/build pipeline |
| D-002 | Backend topology | NestJS modular monolith | PROPOSED | Tech lead; approve module boundaries and team capability |
| D-003 | Web | Next.js public site and separate admin portal deployment/access policy | PROPOSED | Web lead; verify no public route can access admin privileges |
| D-004 | Package manager/monorepo | Choose one (recommend pnpm workspaces if unified monorepo; npm also acceptable) | OPEN | Tech lead; commit lockfile and document workspace scripts |
| D-005 | API contract | REST `/api/v1`, OpenAPI-first | PROPOSED | Backend lead; contract validation required in CI |
| D-006 | Authentication | Managed OIDC provider, mobile auth-code + PKCE | OPEN | Security lead; compare Philippines availability, pricing, recovery, MFA, exportability and data location |
| D-007 | Role model | Local server policy for customer/provider/admin; user may hold customer and provider modes | PROPOSED | Product/security; authorize every request from trusted identity + current account status |
| D-008 | Age eligibility | MVP assumes 18+ | OPEN | Philippine counsel; confirm terms, UX and verification process |
| D-009 | Service categories | Digital/lower-risk services only at MVP | OPEN | Founder + counsel/insurer; approve explicit allowed/prohibited taxonomy |
| D-010 | Booking model | Request/quote first; decide fixed-price mode separately | OPEN | Product/legal; define expiry, cancellation, revisions, completion and dispute rules |
| D-011 | Legal contracting parties | Customer/provider service arrangement with platform facilitation, subject to real-workflow review | OPEN | Philippine lawyer; review actual product UX, operations and contract terms |
| D-012 | Recruitment/placement exposure | Do not launch matching flow until DOLE/qualified counsel review | OPEN | Philippine labor counsel; written advice/guidance for actual model |
| D-013 | Payment provider | Select PSP only after written confirmation of marketplace model, refunds, settlements and provider payouts | OPEN | Finance/founder/counsel; sandbox plus settlement reconciliation passed |
| D-014 | Wallet/escrow | No platform-operated wallet or escrow in MVP | PROPOSED | Lawyer + PSP; any deviation needs fresh legal/regulatory review |
| D-015 | Money representation | Integer centavos or fixed-precision decimal; ISO currency stored explicitly | PROPOSED | Backend/finance; tests prove no floating-point money arithmetic |
| D-016 | Ledger | Append-only double-entry journal for money movement and adjustments | PROPOSED | Backend/finance; balancing and reversal invariant tests pass |
| D-017 | Tax/withholding | BIR accountant determines marketplace/operator duties per actual PSP/merchant arrangement | OPEN | Philippine tax professional; written calculation examples approved |
| D-018 | Identity verification | Vendor/approach not selected; minimize raw document retention | OPEN | Privacy/security/founder; DPIA/PIA, vendor security, cost, fallback and retention reviewed |
| D-019 | Privacy/NPC | Assign accountable privacy lead/DPO as advised; complete PIA/data map | OPEN | Privacy professional; registration, DPO and transfer questions answered |
| D-020 | Cloud provider/region | TBD after budget, latency, managed DB, object storage, key management, logging and residency review | OPEN | Tech/operations/privacy; vendor risk review complete |
| D-021 | Production deployment | Start with managed application/database/container services if adequate; do not require Kubernetes for MVP | PROPOSED | Tech/operations; compare cost, reliability, team skill and recovery |
| D-022 | Kubernetes testing | Docker Compose for integration tests; `kind` for disposable K8s smoke tests | PROPOSED | Platform lead; local reset-and-rebuild documented |
| D-023 | Queue/cache | Add Redis only for a defined cache/rate-limit/queue need | PROPOSED | Backend lead; define durability/idempotency if queue use is approved |
| D-024 | File storage/scanning | Private object store, signed scoped URLs, scan before sharing | PROPOSED | Backend/security; access-control and malicious-upload tests pass |
| D-025 | Logging/monitoring vendor | TBD; require structured, redacted logs, metrics, traces, alert ownership and retention | OPEN | Operations/privacy; vendor DPA and access model reviewed |
| D-026 | Retention/deletion | Per-data-class schedule approved by counsel/privacy pro; backups expire on documented schedule | OPEN | Privacy/legal; deletion/export/correction workflow tested |
| D-027 | Recovery objectives | Proposed initial targets: RPO <=15m, RTO <=4h, subject to cost and restore proof | OPEN | Founder/operations; restore exercise proves and business accepts targets |
| D-028 | Availability/performance SLOs | Start with proposal in spec; establish from load tests and business needs | OPEN | Operations/product; alerts and error budget process agreed |
| D-029 | Independent testing | Independent penetration test before public production and retest remediation | PROPOSED | Founder/security; report, disposition and evidence retained |
| D-030 | Launch scope | Closed beta first; feature flags and booking/payment kill switches | PROPOSED | Founder/operations; support ownership and rollback rehearsal passed |

## Decision template

```text
ID / title:
Status:
Decision owner:
Date:
Context and constraints:
Options considered:
Decision and rationale:
Security/privacy/legal impact:
Operational/cost impact:
Consequences and migration plan:
Evidence/approvals:
Review trigger/date:
```

## Must-close decisions before implementation of affected functionality

- Before auth implementation: D-004, D-006, D-007.
- Before provider onboarding/listing: D-008, D-009, D-018, D-019, D-011/D-012.
- Before pricing/booking/cancellation: D-010 and approved product policies.
- Before money movement: D-013, D-014, D-015, D-016, D-017.
- Before production infrastructure: D-020, D-025, D-026, D-027, D-028.
- Before public launch: D-009 through D-019 as applicable, D-029, and all release gates in the main spec.
