# Side-Hustle Marketplace — Version 3 Production Specification

**Status:** Production-readiness planning package and test scaffolding; not a claim that an application has been built, audited, legally approved, or is safe to launch.

**Product:** Philippine-first marketplace connecting independent service providers with customers.  
**Clients:** Flutter (Android/iOS), Next.js admin portal and public website.  
**Backend:** NestJS modular monolith, REST/OpenAPI, PostgreSQL, optional Redis/background workers.  
**Container/testing:** Docker and Docker Compose for repeatable local integration tests; `kind` for local Kubernetes deployment/smoke tests; managed cloud services and production infrastructure decisions remain to be approved.

## Start here

1. Read [`docs/PRODUCTION_SPECIFICATION_V3.md`](docs/PRODUCTION_SPECIFICATION_V3.md) for the target system requirements.
2. Read [`docs/DECISION_REGISTER.md`](docs/DECISION_REGISTER.md) and close decisions marked `OPEN` before implementing affected features.
3. Read [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) and [`docs/TEST_STRATEGY.md`](docs/TEST_STRATEGY.md).
4. Follow [`docs/DOCKER_KUBERNETES_TESTING.md`](docs/DOCKER_KUBERNETES_TESTING.md) for the intended local testing workflow.
5. Read [`docs/PHILIPPINES_LAUNCH_GATES.md`](docs/PHILIPPINES_LAUNCH_GATES.md) before accepting real users, listing providers, or moving real money.
6. Give the full folder to your development AI and use [`AI_HANDOFF_PROMPT.md`](AI_HANDOFF_PROMPT.md). Ask it to inspect the package first, list assumptions and conflicts, and then implement a vertical slice at a time.

## Package contents

- `docs/PRODUCTION_SPECIFICATION_V3.md` — functional, technical, security, operational, and release requirements.
- `docs/DECISION_REGISTER.md` — architecture decision register with recommended defaults and unresolved decisions.
- `docs/THREAT_MODEL.md` — assets, trust boundaries, threat scenarios, and expected mitigations.
- `docs/TEST_STRATEGY.md` — unit, integration, contract, end-to-end, security, recovery and performance test plan.
- `docs/DOCKER_KUBERNETES_TESTING.md` — developer workflow and commands for Compose and `kind`.
- `docs/OPERATIONS_RUNBOOKS.md` — operational readiness and incident runbook outlines.
- `docs/PHILIPPINES_LAUNCH_GATES.md` — legal, tax, privacy, payments and platform review checklist; not legal advice.
- `docs/openapi/OPENAPI_CONTRACT_STARTER.yaml` — starter contract to be expanded before endpoint implementation.
- `devops/docker/` — local dependency stack and a Dockerfile template for the agreed standalone API package layout.
- `devops/kubernetes/test/` — ephemeral local test manifests; **not production Kubernetes manifests**.
- `devops/kubernetes/kind-config.yaml` — local cluster template.
- `devops/kubernetes/test/create-test-secret.sh` — guarded helper for ephemeral local-only Kubernetes test credentials.
- `.gitignore` — basic guardrails against committing local secrets and build artifacts.
- `docs/diagrams/` — Mermaid source diagrams.

## Important limits

This package is a plan and starter scaffolding. The API, mobile app, admin portal, database migrations, CI workflow, production cloud configuration, legal analysis, penetration testing, and provider/payment integrations are not implemented or verified merely because they are described here. The Dockerfile assumes a standalone `apps/api` Node/NestJS package with `package-lock.json`, `npm run build`, and `dist/main.js`; adapt it to the actual repository. Kubernetes manifests assume that the future API implements `/health/live` and `/health/ready` and that the selected DB/migration approach has been implemented.

**Do not use test credentials with real data. Do not place production secrets in Git, container images, AI chats, mobile bundles, or committed Kubernetes manifests. Do not enable real money movement until legal, provider, operational and security gates are signed off.**
- `docs/AUTHORIZATION_MATRIX.md` — role/resource permissions baseline.
- `docs/IMPLEMENTATION_BACKLOG.md` — prioritized delivery epics and acceptance criteria.
- `devops/ci/PIPELINE_POLICY.md` — required CI/CD and artifact-promotion gates.
- `docs/diagrams/05-*` through `09-*` — Version 3 production, CI/CD, testing, payment and authorization diagrams.
