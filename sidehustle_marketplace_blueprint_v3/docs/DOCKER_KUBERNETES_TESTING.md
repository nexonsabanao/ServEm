# Docker and Kubernetes Testing Plan

## 1. Recommendation in one sentence

Use **Docker Compose as the default repeatable local integration environment** and a **disposable `kind` cluster for Kubernetes/container deployment smoke tests**. Do not adopt production Kubernetes solely because it can be tested locally: managed container/application services may be simpler and safer for the first production launch if they meet availability, security, cost and recovery needs.

The starter files in `devops/` are scaffolding. The API source does not yet exist, so the Dockerfile and health paths must be aligned with the actual NestJS package/scripts before they build and pass.

## 2. Tool responsibilities

- Docker: build and run an API image consistently across developer, CI and staging environments.
- Docker Compose: start isolated Postgres/Redis dependencies, run migrations, execute integration tests and tear the stack down.
- `kind`: create Kubernetes-in-Docker nodes so test manifests, probes, services, scheduling, resource settings and rollout behavior can be tested locally.
- `kubectl`: inspect and exercise the test cluster.
- Kustomize (bundled with kubectl): compose test manifests without introducing Helm prematurely.
- Image/dependency scanners: scan the actual built artifact; select and pin a maintained scanner in implementation.

## 3. Local prerequisites

Install a supported Docker Engine/Desktop with Compose plugin. For the Kubernetes phase, also install `kubectl` and `kind`. Pin their versions in the developer onboarding guide and CI image. Use current vendor docs for OS-specific installation instructions:

- Docker Compose: https://docs.docker.com/compose/
- Docker build best practices: https://docs.docker.com/build/building/best-practices/
- kind quick start: https://kind.sigs.k8s.io/docs/user/quick-start/
- Kubernetes health probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/

## 4. Phase A — Local integration dependencies with Compose

From repository root:

```bash
# Start only local test dependencies and wait for health checks.
docker compose -f devops/docker/compose.test.yaml up -d --wait

# Inspect status and logs.
docker compose -f devops/docker/compose.test.yaml ps
docker compose -f devops/docker/compose.test.yaml logs --tail=100

# Run database migrations and integration tests once the API repo/scripts exist.
# Replace these placeholders with the actual package manager and scripts.
# npm --prefix apps/api run db:migrate:test
# npm --prefix apps/api run test:integration

# Stop services and remove test data when a clean slate is needed.
docker compose -f devops/docker/compose.test.yaml down -v --remove-orphans
```

Compose starter services are bound to loopback host addresses and use explicitly test-only credentials. Do not reuse this file for staging or production. In CI, use a fresh isolated database/volume per job or run and destroy the entire job environment. Do not use production data.

### Compose acceptance

- Services become healthy through health checks, not just container-start state.
- Integration tests can run repeatedly from a clean DB.
- Migrations work from an empty database.
- DB constraints and concurrency tests pass.
- No test calls a production PSP/IDV/email/SMS endpoint.
- `down -v` removes test volumes; document if any data must intentionally survive.

## 5. Phase B — Build and test the API container

After NestJS source and package scripts exist, adapt `devops/docker/api.Dockerfile` to the real package layout. Do not copy secrets into the image and do not pass production secrets through build arguments.

Example command **only after the assumed `apps/api` standalone package exists**:

```bash
docker build --pull \
  -f devops/docker/api.Dockerfile \
  -t sidehustle-api:test \
  apps/api

# Verify process starts and health endpoints work in the selected local runtime.
# Configure environment from an ignored local file or test secret mechanism;
# never use production credentials.
```

### Image acceptance

- Lockfile install succeeds in a clean build (`npm ci` or selected package-manager equivalent).
- Final image contains only production runtime artifacts and dependencies.
- Process runs as a non-root user.
- No secret or test fixture appears in image layers or build context.
- Image scan passes the approved vulnerability policy; exceptions are tracked and time-bound.
- The container exits gracefully on SIGTERM and respects CPU/memory boundaries.
- Image can be traced to a commit and is rebuilt by CI.

## 6. Phase C — Disposable Kubernetes smoke test with kind

Purpose: verify deployment manifests and container behavior, not prove production readiness.

```bash
# Create a disposable local cluster using the supplied template.
kind create cluster --name sidehustle-test --config devops/kubernetes/kind-config.yaml

# Build the local image (see Phase B), then load it to kind's node image cache.
kind load docker-image sidehustle-api:test --name sidehustle-test

# Create short-lived test-only credentials (guarded to the expected kind context).
./devops/kubernetes/test/create-test-secret.sh

# Apply test-only manifests. They expect an API image and test-only secret values.
kubectl apply -k devops/kubernetes/test

# Check resources and wait for API rollout.
kubectl get pods,svc -n marketplace-test
kubectl rollout status deployment/sidehustle-api -n marketplace-test --timeout=120s
kubectl logs deployment/sidehustle-api -n marketplace-test --tail=100

# Forward a local port for smoke/contract tests; local test only.
kubectl port-forward -n marketplace-test svc/sidehustle-api 8080:80
# In another terminal, once routes exist:
# curl --fail http://127.0.0.1:8080/health/live
# curl --fail http://127.0.0.1:8080/health/ready

# End the test and delete the disposable cluster/data.
kind delete cluster --name sidehustle-test
```

Before `kubectl apply -k`, create the **test-only** Secret referenced by the manifest. The helper `devops/kubernetes/test/create-test-secret.sh` creates random values, first verifies that the selected `kubectl` context is `kind-sidehustle-test`, and writes the Secret to the local test namespace. Adjust the required keys to match the implemented API. Never commit an actual Kubernetes Secret manifest or any production secret. The current scaffold deliberately does not hard-code secret values. Kubernetes Secrets are not a production secret-management solution; use your cloud secret manager and reviewed workload identity/access controls for production.

The test manifests assume the API uses `PORT=3000`, exposes `/health/live` and `/health/ready`, and has appropriate readiness semantics. Ensure the namespace and dependency services are created in the order specified by Kustomize and the final test overlay. If your first implementation does not run PostgreSQL/Redis in the cluster, point it only at dedicated test dependencies reachable from that cluster; do not assume `localhost` inside a pod means the host computer.

### Kubernetes test cases

1. Fresh cluster deploy and rollout succeeds.
2. Wrong/missing config or secret fails safely and is visible in diagnostics without logging secret values.
3. Startup probe permits normal startup; readiness removes an unhealthy pod from service; liveness only restarts an irrecoverably unhealthy process.
4. API process runs non-root, has no privilege escalation, drops Linux capabilities, uses `RuntimeDefault` seccomp and has resource requests/limits.
5. API does not need a Kubernetes service-account token unless a documented feature requires it.
6. Pod restart does not lose booking/payment source-of-truth data (those must live in the DB/PSP, not container filesystem).
7. SIGTERM drains requests and shuts down cleanly.
8. Image pull behavior works with immutable non-`latest` tags.
9. Failed deployment/rollout is detected and the previous test release can be restored.
10. Test cluster is fully deleted after run; no production endpoint or credentials were reachable.

## 7. What Compose/kind cannot prove

They do not prove cloud IAM, production network isolation, real KMS integration, actual backup restoration, multi-zone availability, load-balancer/WAF behavior, mobile-store compliance, legal compliance, PSP payout support or absence of vulnerabilities. Test these in an isolated staging account and via professional review as relevant.

## 8. CI sequence

Recommended pipeline order:

1. Lint/type/unit tests.
2. OpenAPI lint + compatibility diff.
3. Start fresh Compose dependencies and run migration/integration/authorization tests.
4. Build immutable container image.
5. Scan dependencies/image and publish SBOM/artifact metadata.
6. Create `kind` cluster, load the exact image digest/tag, apply test manifests and run smoke/contract tests.
7. Export sanitized reports; delete cluster and Compose volumes in unconditional cleanup.
8. Require human approval before promotion to staging/production; promote the same reviewed image digest.

Pin CI actions/tools. Keep the workflow least-privileged; PR builds from untrusted forks must not receive secrets. No automated workflow should enable production payments or payouts.

## 9. When to use Kubernetes in production

Only make that decision after workload and operations requirements are known. Adopt managed Kubernetes if you need its scheduling/rollout/network controls and can responsibly operate cluster upgrades, node pools, IAM, ingress, secrets integration, network policy, observability, backup, incident response and cost. Otherwise, managed app/container services plus managed Postgres/object storage can reduce operational burden for an early-stage business.
