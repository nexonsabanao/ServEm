# Local Kubernetes manifests — test only

These manifests are for a disposable local `kind` cluster. They use ephemeral PostgreSQL data, a non-persistent Redis cache and synthetic test credentials. They are not a production deployment.

## One-time test secret creation

After creating the `kind` cluster, create the namespace and a **test-only** Kubernetes Secret. This is a local convenience; the values below must never be reused outside a disposable test cluster:

```bash
kubectl apply -f devops/kubernetes/test/namespace.yaml
kubectl create secret generic api-test-secrets \
  --namespace marketplace-test \
  --from-literal=POSTGRES_PASSWORD='local-test-only-change-me' \
  --from-literal=DATABASE_URL='postgresql://marketplace_test:local-test-only-change-me@postgres:5432/marketplace_test' \
  --from-literal=AUTH_SECRET='local-only-not-for-production' \
  --dry-run=client -o yaml | kubectl apply -f -
```

This command deliberately uses fake local-only credentials. Use a local ignored environment file or a local secrets tool if shell history is in scope; never put real credentials into command history.

Build the API container to match the manifest image name, load it into kind, and apply the Kustomize directory. Ensure database migrations have run before readiness is expected to succeed. The initial project has no migration job yet; add a separate, reviewed migration job/script once the selected ORM/migration tool and command are agreed.

```bash
kind create cluster --name sidehustle-test --config devops/kubernetes/kind-config.yaml
# Build image only after apps/api source/package scripts exist.
docker build -f devops/docker/api.Dockerfile -t sidehustle-api:test apps/api
kind load docker-image sidehustle-api:test --name sidehustle-test
kubectl apply -k devops/kubernetes/test
kubectl get pods -n marketplace-test
kubectl rollout status deployment/sidehustle-api -n marketplace-test --timeout=120s
kubectl port-forward -n marketplace-test svc/sidehustle-api 8080:80
# In another terminal: curl --fail http://127.0.0.1:8080/health/live
kind delete cluster --name sidehustle-test
```

## Notes

- `AUTH_SECRET` is a placeholder for a local test-mode configuration. If the final app uses OIDC, configure the test issuer/tenant properly rather than inventing a production token scheme.
- `DATABASE_URL` points to the in-cluster ephemeral PostgreSQL service, not Compose or production.
- Database image runtime UID assumptions and security context must be verified against the pinned image used in CI. Update manifests from test evidence rather than assuming all image tags have identical users/paths.
- Add NetworkPolicy tests only on a cluster/network plugin that enforces NetworkPolicy. `kind`'s default networking may not enforce every policy feature; do not treat manifest presence as proof of isolation.
