# Contigo Public API (`/api/v1`)

Contigo exposes a token-authenticated REST surface so warehouses, BI tools,
and other systems can read contract data without scraping the UI.

## Authentication

All `/api/v1/*` endpoints require a Bearer token issued from
`Settings → API Tokens` (or `POST /api/admin/api-tokens` for scripted setup).

```
Authorization: Bearer ctg_<32-char-secret>
```

Tokens are scoped to a single tenant. Possible scopes:

| Scope               | Grants                                |
|---------------------|---------------------------------------|
| `contracts:read`    | List/get contracts                    |
| `contracts:write`   | (reserved)                            |
| `obligations:read`  | List obligations                      |
| `events:read`       | (reserved — CDC stream)               |
| `*`                 | All current and future scopes         |

The raw token is shown once at creation. Only its bcrypt hash and a 12-char
non-secret prefix (`ctg_xxxxxxxx`) are stored. To rotate, create a new
token and revoke the old one.

## Endpoints

### `GET /api/v1/contracts`

Scope: `contracts:read`

Query params:

| Param           | Type     | Description                                  |
|-----------------|----------|----------------------------------------------|
| `limit`         | int      | Max 200, default 50                          |
| `cursor`        | string   | Contract id cursor (exclusive)               |
| `status`        | string   | `UPLOADED`, `PROCESSING`, `PROCESSED`, …     |
| `updatedSince`  | ISO 8601 | Filter `updatedAt >= updatedSince`           |

Response:

```json
{
  "data": [
    {
      "id": "ckxx...",
      "title": "MSA — Acme & Beta",
      "fileName": "MSA-2024.pdf",
      "contractType": "MSA",
      "status": "PROCESSED",
      "clientName": "Acme",
      "supplierName": "Beta",
      "effectiveDate": "2024-04-01T00:00:00.000Z",
      "expirationDate": "2027-04-01T00:00:00.000Z",
      "totalValue": 250000,
      "currency": "USD",
      "signatureStatus": "signed",
      "externalUrl": null,
      "storageProvider": "azure",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "nextCursor": "ckxx...",
  "hasMore": true
}
```

### `GET /api/v1/contracts/:id`

Scope: `contracts:read`

Optional `?include=` (comma-separated): `artifacts`, `rawText`.

### `POST /api/v1/contracts`

Scope: `contracts:write`

Register a contract that you store elsewhere (DMS, ERP, S3, SharePoint).
Contigo will track metadata + obligations + lifecycle events; the bytes
stay in the source system.

Body:

```json
{
  "fileName": "MSA-2024.pdf",
  "externalUrl": "https://dms.example.com/contracts/abc123",
  "contractType": "MSA",
  "contractTitle": "MSA — Acme & Beta",
  "clientName": "Acme",
  "supplierName": "Beta",
  "externalId": "abc123",
  "mimeType": "application/pdf"
}
```

Response: `201 { data: Contract }`. `status` is `UPLOADED` and Contigo
never fetches the URL automatically — it's stored as the canonical
pointer for downstream UIs and integrations.

### `GET /api/v1/obligations`

Scope: `obligations:read`

Query params: `limit` (max 500), `cursor`, `contractId`, `status`,
`dueBefore` (ISO), `updatedSince` (ISO).

### `GET /api/v1/events`

Scope: `events:read`

Durable, append-only event stream. Every contract lifecycle change
(created, processed, …) is recorded here in addition to being pushed
via webhooks. Consumers poll with a monotonic cursor (`since`) and never
miss an event, even across consumer outages.

Query params: `limit` (max 500), `since` (event id, exclusive),
`eventType`, `resourceId`.

#### Event types

| `eventType`             | Resource     | Emitted when                                                |
| ----------------------- | ------------ | ----------------------------------------------------------- |
| `contract.created`      | contract id  | Contract registered (UI upload, DB sync, or `POST /api/v1/contracts`) |
| `contract.processed`    | contract id  | OCR + artifact generation finished                          |
| `contract.expired`      | contract id  | `expirationDate` crossed (lifecycle scan)                   |
| `contract.renewed`      | contract id  | Contract renewed via `/renew` (new contract) or `/extend` (in-place)  |
| `contract.deleted`      | contract id  | Contract permanently deleted (cascades to artifacts/obligations)      |
| `artifact.generated`    | artifact id  | Artifact (overview, clauses, risk, …) created or refreshed  |
| `obligation.created`    | obligation id| Obligation created (manual / bulk / AI extraction)          |
| `obligation.completed`  | obligation id| Status transitioned to COMPLETED                            |
| `obligation.overdue`    | obligation id| `dueDate` crossed (lifecycle scan)                          |
| `signature.completed`   | contract id  | All required signers have signed the contract               |

Response:

```json
{
  "data": [
    {
      "id": "1234",
      "tenantId": "acme",
      "eventType": "contract.created",
      "resourceId": "ckxx...",
      "payload": { "contractId": "ckxx...", "fileName": "MSA.pdf" },
      "createdAt": "2026-05-07T10:21:33.456Z"
    }
  ],
  "nextSince": "1234",
  "hasMore": true
}
```

Polling pattern:

```bash
cursor=""
while :; do
  resp=$(curl -s -H "Authorization: Bearer $CTG_TOKEN" \
    "https://contigo.example.com/api/v1/events?since=$cursor&limit=500")
  echo "$resp" | jq '.data[]' | warehouse-load
  cursor=$(echo "$resp" | jq -r '.nextSince // empty')
  [[ "$(echo "$resp" | jq -r '.hasMore')" == "false" ]] && sleep 5
done
```

## Pagination

All list endpoints use forward-only cursor pagination. Loop until
`hasMore === false`:

```bash
cursor=""
while :; do
  resp=$(curl -s -H "Authorization: Bearer $CTG_TOKEN" \
    "https://contigo.example.com/api/v1/contracts?limit=200&cursor=$cursor")
  echo "$resp" | jq '.data[]'
  cursor=$(echo "$resp" | jq -r '.nextCursor // empty')
  [[ -z "$cursor" ]] && break
done
```

## Incremental sync

Pass `updatedSince=<last-run-timestamp>` plus cursor pagination to pull
only what changed since your last warehouse load. Combine with the planned
CDC event stream (`events:read`, coming in Phase 1.2) for sub-second freshness.

## Errors

| Status | Meaning                                       |
|--------|-----------------------------------------------|
| 401    | Missing/invalid token                         |
| 403    | Token lacks the required scope                |
| 404    | Resource not in caller's tenant               |
| 400    | Bad query params                              |

## Rate limits

Per-token fixed-window: **600 requests per 60 seconds** by default.
Tunable per-deployment via `API_V1_RATE_LIMIT` and
`API_V1_RATE_WINDOW_SECONDS` env vars.

Every successful response carries:

```
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 597
X-RateLimit-Reset: 42        # seconds until counter resets
```

When the limit is exceeded the API returns `429 Too Many Requests`:

```json
{
  "error": "Rate limit exceeded",
  "limit": 600,
  "retryAfterSeconds": 42
}
```

with a standard `Retry-After: 42` header. Backoff and retry — do not hammer.

The limiter uses Redis (`REDIS_URL`) when available and falls back to a
process-local counter on single-instance deployments.
