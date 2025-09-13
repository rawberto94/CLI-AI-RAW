## Normalization Admin

- POST /api/normalize/reload — Reloads canonical dictionaries and alias state.
- GET /api/normalize/state — Returns current alias state (roles, suppliers) for audit.
- GET /api/normalize/export — Exports canonical dicts + alias state as a single JSON blob.

Notes:
- Supplier canonicalization is used in analytics. When available, items include a supplierId (canonical). Otherwise, UI infers supplier names from contract parties as a fallback.

# API Documentation

This document outlines the endpoints for the Contract Intelligence API.

## Endpoints

### `POST /uploads`

*   **Description:** Uploads a file and creates a Contract record. S3 upload is best-effort; in local/demo it falls back silently.
*   **Request:** `multipart/form-data`
*   **Response:**
    ```json
    {
      "docId": "string"
    }
    ```

### `GET /api/contracts`

*   **Description:** Lists contracts (DB if available, otherwise in-memory).

### `GET /api/contracts/:docId`

*   **Description:** Gets a specific contract by id.

### `POST /contracts/:docId/process`

*   **Description:** Enqueues the ingestion job for a contract.
*   **Response:**
    ```json
    {
      "runId": "string",
      "status": "queued"
    }
    ```

### `GET /contracts/:docId/status`

*   **Description:** Returns the status of each stage in the pipeline.
*   **Response:**
    ```json
    {
      "ingestion": "complete",
      "overview": "running",
      "clauses": "queued",
      ...
    }
    ```

### `GET /contracts/:docId/artifacts/:artifact.json`

*   **Description:** Returns a specific artifact for a contract.

### `GET /contracts/:docId/report.pdf`

*   **Description:** Streams the final PDF report.

## Rate Cards

- GET /api/ratecards — list flattened rate cards (doc-derived + manual/import + overrides)
- POST /api/ratecards — create manual rate
- POST /api/ratecards/override — create override for a doc-derived row
- PUT /api/ratecards/:id — update manual/import/override
- DELETE /api/ratecards/:id — delete manual/import/override
- POST /api/ratecards/import — CSV import (supports ?dryRun=1&dedupe=1&to=pending). CSV columns: role, sourceLine, seniority, currency, uom, amount, dailyUsd, country, lineOfService

### Pending workflow (validate-before-store)

- GET /api/ratecards/pending — list pending items
- POST /api/ratecards/pending — create pending item; add `{ validateOnly: true }` to only validate and return `{ ok, errors }`
- POST /api/ratecards/pending/bulk — bulk create pending items (e.g., from import)
- PUT /api/ratecards/pending/:id — edit pending item (re-validates)
- POST /api/ratecards/pending/:id/approve — approve a valid pending item (moves to repository)
- POST /api/ratecards/pending/:id/reject — reject (delete) a pending item
- POST /api/ratecards/pending/approveAllValid — approve all currently valid pending items
  - Response:
    ```json
    { "total": 12, "approved": 9, "invalid": 3 }
    ```

#### Bulk reject selected

- POST /api/ratecards/pending/rejectSelected
  - Description: Reject multiple pending items by id in a single request.
  - Request body:
    ```json
    { "ids": ["pr-abc123", "pr-def456"] }
    ```
  - Response:
    ```json
    { "rejected": 2, "notFound": 0 }
    ```
  - Error codes:
    - 400 when `ids` is missing or empty
    - 500 on server error

## Normalization

- POST /api/normalize/role/preview — Return best canonical role matches for a raw role string.
  - Request: `{ "role": "Sr Software Eng", "hints": ["engineering"] }`
  - Response:
    ```json
    {
      "type": "role",
      "rawValue": "Sr Software Eng",
      "status": "auto|review|unmapped",
      "selectedId": "r-engineer-software-swe",
      "matches": [
        {
          "id": "r-engineer-software-swe",
          "canonicalName": "Software Engineer",
          "score": 0.93,
          "scoreBreakdown": { "jaroWinkler": 0, "tokenSet": 0.88, "phonetic": 0, "contextBoost": 0.1 },
          "evidence": []
        }
      ]
    }
    ```

- POST /api/normalize/supplier/preview — Return best canonical supplier matches.
  - Request: `{ "name": "Acme", "context": "acme.com" }`

- POST /api/normalize/role/alias — Approve and store a role alias mapping.
  - Request: `{ "raw": "Sr SW Eng", "roleId": "r-engineer-software-swe", "by": "user@corp.com", "confidence": 0.97 }`

- POST /api/normalize/supplier/alias — Approve and store a supplier alias mapping.
  - Request: `{ "raw": "Acme Ltd.", "supplierId": "s-acme", "by": "user@corp.com", "confidence": 0.98 }`

- POST /api/normalize/reload — Reload normalization dictionaries from disk.
