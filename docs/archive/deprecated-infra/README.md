# Deprecated Infrastructure Configs

These infrastructure configurations have been **archived** as part of the architecture cleanup (Feb 2026).

## Why?

The project had 3 duplicate deployment configs:
1. `k8s/deployment.yaml` — Single-file K8s manifest (551 lines)
2. `kubernetes/*.yaml` — Multi-file raw K8s manifests (2,238 lines)
3. `helm/contigo/` — Helm chart with templates and values (**CANONICAL**)

Maintaining 3 configs leads to drift and confusion. The Helm chart was chosen as the canonical config because:
- Supports multiple environments via `values.yaml` / `values-azure.yaml`
- Template-based — DRY, parameterized
- Standard K8s package manager
- Includes all resources: web, workers, websocket, HPA, ingress, secrets

## Current Canonical Config

**`helm/contigo/`** — Use this for all deployments.

```bash
# Deploy
helm install contigo helm/contigo -f helm/contigo/values.yaml

# Deploy to Azure
helm install contigo helm/contigo -f helm/contigo/values-azure.yaml
```

## Restoring (if needed)

These files are preserved here for reference. If you need to restore:
```bash
mv docs/archive/deprecated-infra/k8s-single-file k8s
mv docs/archive/deprecated-infra/kubernetes-raw kubernetes
```
