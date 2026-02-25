# Azure Document Intelligence Integration

> **Version**: v4.0 (API `2024-11-30`)  
> **Module**: `packages/workers/src/azure-document-intelligence.ts`  
> **Status**: Production-ready with feature flag  

---

## Architecture Overview

```
┌──────────────┐    ┌───────────────────┐    ┌──────────────────────────┐
│ Upload Modal │───▶│ OCR Artifact      │───▶│ Azure Document           │
│ (ocrMode)    │    │ Worker            │    │ Intelligence v4.0        │
└──────────────┘    │                   │    │                          │
                    │  ┌─────────────┐  │    │  prebuilt-layout         │
                    │  │ Preclassify │──┼───▶│  prebuilt-contract       │
                    │  │ (auto mode) │  │    │  prebuilt-invoice        │
                    │  └─────────────┘  │    │  prebuilt-read           │
                    │                   │    └──────────────────────────┘
                    │  ┌─────────────┐  │
                    │  │ Fallback    │  │    ┌──────────────────────────┐
                    │  │ Chain       │──┼───▶│ OpenAI / Mistral / Azure │
                    │  └─────────────┘  │    │ (legacy OCR providers)   │
                    └───────────────────┘    └──────────────────────────┘
```

### Request Flow

1. **Upload**: User uploads a document via `QuickUploadModal`, optionally selecting an OCR mode
2. **Queue**: BullMQ enqueues an OCR job with the selected `ocrMode`
3. **Auto-select**: If `ocrMode === 'auto'`, the preclassifier reads a text sample and maps the detected contract type to the optimal DI model
4. **DI Analyze**: The worker calls `analyzeLayout()`, `analyzeContract()`, or `analyzeInvoice()` through a circuit breaker + retry wrapper
5. **Fallback**: If DI fails (rate limit, circuit open, credentials missing), the legacy provider chain is used
6. **Result**: Extracted text, tables, key-value pairs, and metadata are returned

---

## Available Models

| Model | API ID | Cost/Page | Best For |
|-------|--------|-----------|----------|
| **Layout** | `prebuilt-layout` | $0.01 | General contracts, structured docs with tables |
| **Contract** | `prebuilt-contract` | $0.01 | Party extraction, jurisdiction, dates, clauses |
| **Invoice** | `prebuilt-invoice` | $0.01 | Vendor info, line items, payment terms |
| **Read** | `prebuilt-read` | $0.001 | Plain text extraction (lightweight, cheapest) |

## Public API

### Document Analysis Functions

```typescript
import {
  analyzeLayout,
  analyzeContract,
  analyzeInvoice,
  analyzeRead,
  analyzeWithQueries,
} from '@repo/workers';
```

#### `analyzeLayout(buffer: Buffer, options?)`
Full document layout analysis — text, tables, key-value pairs, paragraphs, and structure.

#### `analyzeContract(buffer: Buffer)`
Contract-specific extraction — parties, dates, jurisdiction, contract type, terms.

#### `analyzeInvoice(buffer: Buffer)`
Invoice-specific extraction — vendor/customer info, line items, totals, payment terms.

#### `analyzeRead(buffer: Buffer)`
Lightweight text extraction. 10x cheaper than layout; use when only raw text is needed.

#### `analyzeWithQueries(buffer: Buffer, queries: string[])`
Query-based extraction — asks specific questions of the document and returns field values.

### Utility Functions

```typescript
import {
  isDIConfigured,
  isDIEnabled,
  checkDIHealth,
  diMetrics,
  diCostTracker,
} from '@repo/workers';
```

#### `isDIConfigured(): boolean`
Returns `true` if both `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` and `_KEY` are set.

#### `isDIEnabled(): boolean`
Returns `true` if DI is configured AND the `AZURE_DI_ENABLED` flag is not `false`. Use as the primary gate.

#### `checkDIHealth()`
Performs a live health check against the DI endpoint. Returns `{ configured, reachable, region, latencyMs, dataResidency }`.

#### `diMetrics`
Prometheus-compatible counters: `requestsTotal`, `requestsSucceeded`, `requestsFailed`, `requestsByModel`, etc. Call `diMetrics.getSnapshot()` for current values.

#### `diCostTracker`
Cost accumulator with per-model pricing. `diCostTracker.getSnapshot()` returns `{ totalCostUSD, costByModel, pagesByModel }`.

---

## Configuration

### Required Environment Variables

```env
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="https://<resource>.cognitiveservices.azure.com"
AZURE_DOCUMENT_INTELLIGENCE_KEY="<key>"
```

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AZURE_DI_ENABLED` | `true` (when configured) | Feature flag kill-switch |
| `AZURE_DI_DEFAULT_MODEL` | `layout` | Default model when auto-select can't determine type |
| `AZURE_DI_FEATURES` | `keyValuePairs` | Comma-separated add-on features |
| `AZURE_DI_MAX_TPS` | `15` | Rate limit (transactions per second) |
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT_EU` | — | EU secondary endpoint |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY_EU` | — | EU secondary key |

### Data Residency

The module automatically selects the appropriate endpoint based on detected region:

- **Switzerland** (`-ch` suffix or `switzerland` in endpoint): Uses primary endpoint (FADP compliant)
- **EU clients**: Uses `_EU` endpoint if configured
- **Default**: Primary endpoint

---

## Observability

### OpenTelemetry Spans

Every public analysis function is wrapped in an OTel span:

- `di.analyzeLayout`, `di.analyzeContract`, `di.analyzeInvoice`, `di.analyzeRead`, `di.analyzeWithQueries`

Attributes: `di.model`, `di.region`, `di.pages`, `di.confidence`, `di.status`

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /healthz` | Main health check — includes DI status (degraded if unreachable) |
| `GET /di-health` | Dedicated DI health check with region/latency info |
| `GET /metrics/json` | Full metrics snapshot including DI counters and cost |

### Database Fields

The `Contract` model tracks OCR provenance:

```prisma
ocrProvider    String?    // e.g., "azure-di", "openai", "mistral"
ocrModel       String?    // e.g., "prebuilt-layout", "prebuilt-contract"
ocrProcessedAt DateTime?  // Timestamp of last OCR run
```

---

## Resilience

| Mechanism | Configuration |
|-----------|---------------|
| **Circuit Breaker** | 5 failures → OPEN (60s cooldown), shared `azureCircuitBreaker` |
| **Retry** | Exponential backoff via `retry()` utility |
| **Rate Limiter** | Token bucket, 15 TPS default (S0 tier), configurable via `AZURE_DI_MAX_TPS` |
| **Fallback Chain** | DI → OpenAI → Azure CH → Mistral (when DI fails) |
| **Feature Flag** | `AZURE_DI_ENABLED=false` disables DI instantly without removing credentials |

---

## Cost Management

Pricing (as of 2024):
- **Read model**: $0.001 / page
- **Layout / Contract / Invoice**: $0.01 / page

The `diCostTracker` accumulates costs per-model in memory. Access via:
- `diCostTracker.getSnapshot()` — programmatic
- `GET /metrics/json` — HTTP endpoint
- Reset with `diCostTracker.reset()` for billing period rollover

---

## Security

- **No credential leakage**: API keys are never included in analysis results (stripped to region-only metadata)
- **Swiss FADP compliance**: Switzerland North endpoint for Swiss data residency
- **EU GDPR compliance**: Optional EU endpoint for EU clients
- **Transport**: HTTPS only, TLS 1.2+
- **Access control**: API keys stored in environment variables, never logged

---

## Testing

```bash
cd packages/workers
npx vitest run src/__tests__/azure-document-intelligence.test.ts
```

Test suite covers:
- Configuration detection (isDIConfigured)
- Health check scenarios (reachable, unreachable, invalid key, network error)
- Layout analysis (text extraction, table parsing, KV pairs, metadata, no credential leak)
- Contract extraction (parties, dates, jurisdiction)
- Invoice extraction (vendor, line items, totals)
- Read analysis (lightweight text)
- Error handling (missing credentials, rate limits, failed status)
- Region detection (Switzerland, EU)
- Type exports verification
