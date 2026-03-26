# Local E2E Testing Guide — Hetzner Server (No Azure Builds)

> **Purpose**: Test the full contract processing pipeline locally on the Hetzner server.
> All Docker builds happen **locally** — never push to Azure ACR for dev/test.
>
> Azure deployments (`contigoacr2026`, GitHub Actions CI/CD) are **only** for manual production releases.
> All deploy workflows require `workflow_dispatch` + typed confirmation. No push auto-deploys.

---

## Development Modes

### 🔥 Mode 1: Next.js Dev Server (PREFERRED for code changes)

Run the Next.js app **directly on the host** — instant hot-reload on code changes, no Docker rebuild.

```bash
# One-time setup (only needed once after fresh clone)
n 22                              # Node 22 required
npm install -g pnpm@8
cd /root/app && pnpm install
cd packages/clients/db && pnpm prisma generate

# Start dev server (uses .env.local with localhost DB/Redis URLs)
cd /root/app/apps/web && pnpm dev
# → http://localhost:3005 with hot-reload
```

**Infra stays in Docker** (Postgres + Redis):
```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
```

> Edit any file in `apps/web/` → save → browser auto-refreshes. No rebuild needed.

### 📦 Mode 2: Docker Container (for production-like testing)

Only use when you need to test the built production image.

```bash
docker build -f Dockerfile -t contigo-web-local:latest .   # only when code changed
docker run -d --rm --name contigo-web-local-run --network app_default \
  -p 3005:3000 --env-file /tmp/container_env.txt contigo-web-local:latest
```

---

## Build Strategy

| Scenario | What to do |
|---|---|
| **Developing / iterating on code** | Use Mode 1 (dev server) — zero rebuild |
| **E2E test, no code changes** | Use whichever mode is already running |
| **Testing production build** | Use Mode 2 (Docker) — rebuild once |
| **Schema change in Prisma** | Run migration, then `prisma generate` |
| **Production deploy** | Manual workflow_dispatch in GitHub Actions only |

> ⚠️ **Never** `docker push` to Azure just to test. Build and run locally on Hetzner (8 CPUs, 30GB RAM).
> ⚠️ All 4 deploy workflows are **manual-only** with typed confirmation. See `.github/workflows/`.

---

## Prerequisites

| Service | Container | Port | Check |
|---|---|---|---|
| Next.js App | `contigo-web-local-run` | 3005 | `curl http://localhost:3005/api/health` |
| PostgreSQL | `contract-intelligence-postgres-dev` | 5432 | `docker exec contract-intelligence-postgres-dev pg_isready` |
| Redis | `contigo-redis` / `contract-intelligence-redis-dev` | 6379 | `docker exec contigo-redis redis-cli ping` |

If containers are **not running**, start them (no rebuild):

```bash
# Start infra only (DB + Redis)
docker compose -f docker-compose.dev.yml up -d postgres redis

# Start the app container from existing image (no rebuild!)
docker run -d --rm --name contigo-web-local-run --network app_default -p 3005:3000 \
  --env-file /tmp/container_env.txt contigo-web-local:latest
```

> **Only rebuild the Docker image when code has changed and you need to test the new code.**
> For repeat testing, reuse the existing running container.

---

## Quick E2E Test (Copy-Paste)

### 1. Health Check

```bash
curl -s http://localhost:3005/api/health | python3 -m json.tool
```

### 2. Authenticate

```bash
# Get CSRF token
CSRF=$(curl -s -c /tmp/cookies.txt http://localhost:3005/api/auth/csrf \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])")

# Login (uses florian@florian.com / password123)
curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -X POST http://localhost:3005/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=${CSRF}&email=florian%40florian.com&password=password123&redirect=false" \
  -D /dev/stderr -o /dev/null 2>&1 | grep -i "session-token"
```

**Expected**: Response includes `set-cookie: authjs.session-token=...`

> **If login fails**: The seeded user passwords may have been reset. Re-hash:
> ```bash
> pip3 install bcrypt -q
> HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'password123', bcrypt.gensalt()).decode())")
> docker exec contract-intelligence-postgres-dev psql -U postgres -d contracts \
>   -c "UPDATE \"User\" SET \"passwordHash\" = '${HASH}';"
> ```

### 3. Upload Contract

```bash
curl -s -b /tmp/cookies.txt \
  -X POST http://localhost:3005/api/contracts/upload \
  -F "file=@/root/app/public/realistic_contract.pdf" \
  | python3 -m json.tool
```

**Expected**: `201` with `contractId`, `status: "PROCESSING"`, `queueTriggered: true`

Save the contract ID:
```bash
CONTRACT_ID="<paste-id-here>"
```

### 4. Monitor Processing

```bash
# Check processing job progress (poll every 5s)
watch -n 5 "docker exec contract-intelligence-postgres-dev psql -U postgres -d contracts \
  -c \"SELECT status, progress FROM \\\"ProcessingJob\\\" WHERE \\\"contractId\\\" = '${CONTRACT_ID}';\""
```

Or one-shot:
```bash
docker exec contract-intelligence-postgres-dev psql -U postgres -d contracts \
  -c "SELECT status, progress, error FROM \"ProcessingJob\" WHERE \"contractId\" = '${CONTRACT_ID}';"
```

**Expected**: `COMPLETED` / `100` (takes ~30-40 seconds for 14 artifacts)

### 5. Verify All 14 Artifacts

```bash
docker exec contract-intelligence-postgres-dev psql -U postgres -d contracts \
  -c "SELECT type, length(data::text) as data_bytes FROM \"Artifact\" WHERE \"contractId\" = '${CONTRACT_ID}' ORDER BY \"createdAt\";"
```

**Expected 14 types**: `OVERVIEW`, `CLAUSES`, `COMPLIANCE`, `RISK`, `FINANCIAL`, `OBLIGATIONS`,
`RENEWAL`, `NEGOTIATION_POINTS`, `AMENDMENTS`, `CONTACTS`, `PARTIES`, `TIMELINE`,
`DELIVERABLES`, `EXECUTIVE_SUMMARY`

### 6. Verify Contract Metadata

```bash
curl -s -b /tmp/cookies.txt "http://localhost:3005/api/contracts/${CONTRACT_ID}" \
  | python3 -c "
import sys, json
c = json.load(sys.stdin).get('data', {})
for f in ['status','contractType','clientName','supplierName','signatureStatus','currency','startDate','endDate']:
    print(f'{f}: {c.get(f)}')
"
```

**Expected for `realistic_contract.pdf`**:
- `status`: `completed`
- `contractType`: `SERVICE`
- `clientName`: `Alpine Retail AG`
- `supplierName`: `Nordic Components GmbH`
- `signatureStatus`: `unsigned`
- `currency`: `CHF`

### 7. Test AI Chat (Optional — Requires Azure OpenAI Deployment)

```bash
# Generate HMAC CSRF token
CSRF_TOKEN=$(python3 -c "
import hmac, hashlib, json, base64, time
secret = 'supersecretkey123supersecretkey123supersecret'
payload = json.dumps({'timestamp': int(time.time()*1000)})
sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
token = base64.b64encode((payload + '.' + sig).encode()).decode()
print(token)
")

curl -s -b /tmp/cookies.txt \
  -X POST http://localhost:3005/api/ai/chat/stream \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: ${CSRF_TOKEN}" \
  -d "{\"message\":\"Summarize this contract\",\"conversationHistory\":[],\"context\":{\"contractId\":\"${CONTRACT_ID}\"}}"
```

**Expected**: SSE stream with `metadata` → `content` tokens → `done` event

---

## Available Test Users

| Email | Tenant | Role |
|---|---|---|
| `florian@florian.com` | `tenant-florian` | admin |
| `roberto@roberto.com` | `tenant-roberto` | admin |

Password for all: `password123`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `CredentialsSignin` error | Re-hash passwords (see Step 2 note above) |
| `CSRF_MISSING` on API calls | Generate HMAC token (see Step 7) — upload is exempt |
| Processing stuck at < 100% | Check container logs: `docker logs contigo-web-local-run --tail 50` |
| `DeploymentNotFound` in artifacts | Azure OpenAI not deployed — artifacts will be `basic` mode (regex-based) |
| Container not on network | `docker network connect app_default contigo-web-local-run` |

---

## Key Rule: When to Rebuild vs. Reuse

| Scenario | Action |
|---|---|
| Testing existing functionality | **Reuse** running container — no rebuild |
| Re-running the same e2e test | **Reuse** — just re-upload the PDF |
| Code change in `apps/web/` | **Rebuild**: `docker build -f Dockerfile -t contigo-web-local:latest .` then restart container |
| Schema change in Prisma | **Rebuild** + run migration first |
| Only changing test PDF | **Reuse** — mount or copy file into container |
| Env var change | **Restart** container with new `--env-file` (no rebuild) |
