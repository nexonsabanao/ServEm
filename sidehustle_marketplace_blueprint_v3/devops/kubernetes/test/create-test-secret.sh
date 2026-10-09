#!/usr/bin/env bash
set -euo pipefail

# Creates short-lived, test-only credentials in a disposable local kind cluster.
# Never adapt this script to production; use a managed secret store there.

EXPECTED_CONTEXT="kind-sidehustle-test"
CURRENT_CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
if [[ "$CURRENT_CONTEXT" != "$EXPECTED_CONTEXT" ]]; then
  echo "Refusing to create test credentials: current kubectl context is '$CURRENT_CONTEXT'." >&2
  echo "Create/select the disposable kind cluster first (expected context: $EXPECTED_CONTEXT)." >&2
  echo "If you intentionally named the local cluster differently, update EXPECTED_CONTEXT in this test-only script." >&2
  exit 2
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate ephemeral test-only values." >&2
  exit 2
fi

DB_PASSWORD="$(openssl rand -hex 24)"
AUTH_SECRET="$(openssl rand -hex 32)"

# Create namespace first because the Secret must exist before the API/DB pods start.
kubectl create namespace marketplace-test --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic api-test-secrets \
  --namespace marketplace-test \
  --from-literal="POSTGRES_PASSWORD=$DB_PASSWORD" \
  --from-literal="DATABASE_URL=postgresql://marketplace_test:${DB_PASSWORD}@postgres:5432/marketplace_test" \
  --from-literal="AUTH_SECRET=$AUTH_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

unset DB_PASSWORD AUTH_SECRET
echo "Created ephemeral test-only Kubernetes Secret in namespace marketplace-test."
echo "Apply manifests with: kubectl apply -k devops/kubernetes/test"
echo "Delete the disposable cluster after testing: kind delete cluster --name sidehustle-test"
