# CI/CD Pipeline Policy (Template)

This policy should be implemented in the chosen CI provider after repository/package scripts are finalized. It is a requirements document, not an active workflow.

## Pull request gates

- Format, lint, typecheck, unit tests.
- Build/validate OpenAPI and detect unintended breaking changes.
- Run migration/schema checks and authorization/ownership tests.
- Start fresh Compose dependencies; run integration tests and teardown even on failure.
- Scan dependencies, source for committed secrets, license policy and container image.
- Build the API image and generate an SBOM; retain the digest, commit SHA and test reports.
- Run `kind` smoke suite when API/deployment manifests change; always clean up cluster/namespace and sanitize logs.
- Require at least one code owner review; require security/platform review for auth, payment, data migration, IAM, Dockerfile and deployment changes.

## Protected branch and supply chain

- Protect the main branch; prohibit direct pushes and require CI success.
- Pin third-party actions and build tools to reviewed immutable versions/commit SHAs when practical.
- Give each CI job minimum permissions. Do not expose secrets to untrusted forked PRs.
- Prefer workload identity/OIDC and short-lived cloud credentials instead of long-lived cloud keys.
- Never place production customer data, signing secrets, PSP keys or cloud admin credentials in CI test fixtures.
- Create one immutable image per commit, scan it, attach SBOM/provenance, and promote the same artifact digest between environments.
- Use environment approval gates for staging/production; separate deploy identity from normal test identity.
- Production release requires human approval, rollout owner, monitoring window, rollback plan, compatibility review for migrations and all applicable launch gates.
- No CI job may turn on real payment/payout features or create production PSP keys automatically.

## Image findings and exceptions

Define severity thresholds with the security owner. Critical/high findings block release unless a documented exception is allowed by policy, time-bounded, scoped to the exact CVE/image, paired with compensating controls, and approved by a named risk owner. Re-scan on a scheduled cadence and after base-image or dependency advisories.

## Rollback and artifacts

- Retain commit SHA, image digest, SBOM, scan result, deployment manifest revision, migration revision and test report with each release.
- Prefer rollback to a known-good immutable image. Database migrations must follow expand/migrate/contract so the previous app revision can safely run during the rollback window, or have a documented recovery plan.
- Record who approved and executed a release and what alerts/verification were observed.
