# Deployment

**Last verified:** 2026-07-13. How the app actually gets deployed today — Azure Container Apps, manual releases only.

## TL;DR

Pushing to `main` **never deploys anything**. CI (lint/typecheck/tests/build) runs on every push, but a release is always an explicit action, via one of two equivalent paths:

| Path | Command | When to use |
|---|---|---|
| GitHub Actions | Actions → **Azure Deploy** → Run workflow → type `deploy-production` | Normal releases; audit trail in Actions |
| Local script | `bash scripts/deploy-azure.sh` | Same steps without spending Actions minutes; needs `az login` |

Both do the same thing: build the `Dockerfile` image remotely in ACR, point the Container App at it, verify, and smoke-test `/api/health`.

## Target infrastructure

There is a **single production environment** (no staging Container App exists in the subscription — the workflows accept a `staging` input, but it requires `AZURE_RESOURCE_GROUP`/`ACR_NAME`/`CONTAINER_APP_NAME` vars that aren't provisioned):

| Thing | Value |
|---|---|
| Resource group | `contigoContainerApps` |
| Container registry (ACR) | `contigoacr2026` (`contigoacr2026.azurecr.io`) |
| Container App | `contigo` |
| Image repository | `contigo-web` |
| Image tags | `sha-<8-char-sha>` (or `--tag`/`version` override) + channel tag `latest` |
| Health check | `GET /api/health` |

The image is the multi-stage `Dockerfile` at the repo root: node:22-alpine, pnpm workspace install, Next.js standalone build, `node apps/web/server.js` on port 3000. Real secrets (DB, auth, OpenAI/Azure OpenAI, …) are injected by the Container App environment, not baked into the image.

## Path 1 — GitHub Actions (canonical)

Workflows: [azure-deploy.yml](../.github/workflows/azure-deploy.yml) is a thin compatibility entrypoint that forwards to [deploy-container-apps.yml](../.github/workflows/deploy-container-apps.yml) (the real logic, also directly dispatchable).

1. Actions tab → **Azure Deploy** (or **Deploy to Azure Container Apps**) → *Run workflow*.
2. Inputs: `environment` (use `production`), optional `version` (image tag override, e.g. `v1.0.5`), and `confirm_production` — you must type **`deploy-production`** or the job refuses to run.
3. Steps it performs:
   - `az acr build` — builds the Dockerfile **inside ACR** from the checked-out commit (no local Docker needed), tagging both `sha-<sha>` and `latest`.
   - `az containerapp update` — points the `contigo` app at the new image (Container Apps creates a new revision; traffic shifts when it's healthy).
   - Verifies deployed image + provisioning state, then smoke-tests `https://<fqdn>/api/health` with retries.
4. Auth: the `AZURE_CREDENTIALS` repo secret (service principal). Concurrency-guarded per environment so two deploys can't race.

## Path 2 — Local script

[scripts/deploy-azure.sh](../scripts/deploy-azure.sh) mirrors the workflow 1:1, runnable from a dev box:

```bash
az login                                   # once
bash scripts/deploy-azure.sh               # deploy current HEAD
bash scripts/deploy-azure.sh --tag v1.0.5  # explicit tag
bash scripts/deploy-azure.sh --skip-build  # redeploy an already-built tag
bash scripts/deploy-azure.sh --yes         # skip confirmation prompt
```

Caveat: `az acr build` uploads the **working directory**, not a commit — uncommitted changes get deployed (the script warns but doesn't block). Prefer a clean tree.

## What is *not* part of a deploy

- **Database migrations** are not run by either path. Run them explicitly (`pnpm run db:migrate`, or the `Dockerfile.migrate` image) before deploying schema-dependent code.
- **Workers** (`packages/workers`, `Dockerfile.workers`) are **not** built or deployed by these paths — the deploy ships the web image only. Workers currently run under PM2 on the dev/VM stack; `docker-compose.prod.yml`/`docker-compose.vm.yml` cover the compose-based setups.
- **CI is not a gate.** The deploy workflow doesn't wait for or require green CI — check the Actions tab before releasing.

## Rollback

Every deploy is an immutable `sha-*` tag in ACR, so rollback = redeploy the previous tag:

```bash
bash scripts/deploy-azure.sh --skip-build --tag sha-<previous-sha>
```

(or run the workflow with `version: sha-<previous-sha>`). Container Apps also keeps prior revisions — `az containerapp revision list -n contigo -g contigoContainerApps` in an emergency.

## Verifying a deploy

- The workflow/script already smoke-test `/api/health`.
- Logs: `az containerapp logs show --name contigo --resource-group contigoContainerApps --follow`
- Current image: `az containerapp show -n contigo -g contigoContainerApps --query 'properties.template.containers[0].image'`

## Related-but-different files (don't confuse with the deploy path)

- `deploy.yml` — older CI/CD workflow with build checks; not the canonical release path.
- `docker-build-only.yml` — image build validation, no deploy.
- `docker-compose.*.yml` — local/VM/compose environments, not Azure.
