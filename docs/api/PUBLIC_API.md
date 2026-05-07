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

### `GET /api/v1/obligations`

Scope: `obligations:read`

Query params: `limit` (max 500), `cursor`, `contractId`, `status`,
`dueBefore` (ISO), `updatedSince` (ISO).

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

Currently unenforced; will land alongside the CDC stream. Be polite — keep
sustained traffic under 50 req/s per token.
