# Contracts API Reference

This document provides a comprehensive overview of all contract-related API endpoints.

## Database Persistence

**All contracts are persisted in PostgreSQL via Prisma ORM.**

### How Contracts Are Stored

1. **Upload Flow**:
   - User uploads file → `POST /api/contracts/upload`
   - Contract record created in `Contract` table
   - ProcessingJob created in `ProcessingJob` table
   - File stored in object storage (S3/MinIO) with local fallback
   - Both operations happen in a single database transaction

2. **Processing Flow**:
   - BullMQ queue triggers processing workers
   - Artifacts generated and stored in `Artifact` table
   - Contract status updated: `PENDING` → `PROCESSING` → `COMPLETED`

3. **Related Tables**:
   - `Contract` - Main contract data
   - `ContractMetadata` - Extended metadata (priority, department, scores, etc.)
   - `ContractVersion` - Version history
   - `Artifact` - Generated artifacts (summaries, key terms, etc.)
   - `ProcessingJob` - Processing status tracking
   - `File` - File storage references

---

## Core Endpoints

### List & Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contracts` | List contracts with filtering/sorting |
| GET | `/api/contracts/search` | Full-text search with filters |
| GET | `/api/contracts/stats` | Aggregated statistics |
| GET | `/api/contracts/organize` | Group by criteria (status, type, etc.) |

### Single Contract

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contracts/[id]` | Get full contract details |
| PUT | `/api/contracts/[id]` | Update contract |
| DELETE | `/api/contracts/[id]` | Delete contract |
| GET | `/api/contracts/[id]/status` | Get processing status |
| GET | `/api/contracts/[id]/progress` | SSE stream for real-time updates |

### Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contracts/upload` | Single file upload |
| POST | `/api/contracts/upload/init` | Initialize chunked upload |
| POST | `/api/contracts/upload/chunk` | Upload chunk |
| POST | `/api/contracts/upload/finalize` | Complete chunked upload |
| POST | `/api/contracts/batch` | Multi-file batch upload |

### Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contracts/[id]/process` | Trigger processing |
| POST | `/api/contracts/[id]/retry` | Retry failed processing |
| POST | `/api/contracts/bulk` | Bulk operations (delete, update status) |

---

## Artifacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contracts/[id]/artifacts` | List all artifacts |
| GET | `/api/contracts/[id]/artifacts/summary` | Get summary artifact |
| GET | `/api/contracts/[id]/artifacts/keyterms` | Get key terms |
| GET | `/api/contracts/[id]/artifacts/generate` | Generate artifacts |
| GET | `/api/contracts/[id]/artifacts/export` | Export artifacts |
| GET | `/api/contracts/[id]/artifacts/compare` | Compare artifacts |
| GET | `/api/contracts/[id]/artifacts/[artifactId]` | Get specific artifact |

---

## Metadata & Versions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contracts/[id]/metadata` | Get metadata |
| PUT | `/api/contracts/[id]/metadata` | Update metadata |
| POST | `/api/contracts/[id]/metadata/refresh` | Refresh from AI |
| GET | `/api/contracts/[id]/versions` | List versions |
| POST | `/api/contracts/[id]/versions` | Create version |
| GET | `/api/contracts/[id]/versions/[versionId]` | Get specific version |

---

## Deprecated Endpoints

> ⚠️ These endpoints will be removed in a future version.

| Deprecated | Use Instead |
|------------|-------------|
| `/api/contracts/list` | `/api/contracts` |
| `/api/contracts/upload/initialize` | `/api/contracts/upload/init` |

---

## Query Parameters

### List Endpoint (`/api/contracts`)

```typescript
{
  // Pagination
  page?: number;        // Default: 1
  pageSize?: number;    // Default: 20, Max: 100
  
  // Filtering
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  contractType?: string;
  category?: string;
  search?: string;      // Text search
  
  // Date Filtering
  dateFrom?: string;    // ISO date
  dateTo?: string;      // ISO date
  expiringWithin?: number;  // Days
  
  // Sorting
  sortBy?: 'createdAt' | 'uploadedAt' | 'totalValue' | 'expirationDate' | 
           'effectiveDate' | 'contractTitle' | 'clientName' | 'supplierName' |
           'viewCount' | 'lastViewedAt';
  sortOrder?: 'asc' | 'desc';  // Default: 'desc'
}
```

### Organize Endpoint (`/api/contracts/organize`)

```typescript
{
  groupBy?: 'status' | 'contractType' | 'category' | 'clientName' | 
            'supplierName' | 'expirationMonth' | 'uploadMonth' | 'valueRange';
}
```

---

## Response Examples

### Contract Object

```json
{
  "id": "cmij5u89p002e1govxyz...",
  "tenantId": "tenant_demo_001",
  "fileName": "contract.pdf",
  "originalName": "Service_Agreement.pdf",
  "contractTitle": "Service Agreement 2024",
  "status": "COMPLETED",
  "contractType": "SERVICE_AGREEMENT",
  "category": "Technology",
  "clientName": "Acme Corp",
  "supplierName": "Tech Solutions Inc",
  "totalValue": 150000.00,
  "effectiveDate": "2024-01-01T00:00:00.000Z",
  "expirationDate": "2024-12-31T00:00:00.000Z",
  "createdAt": "2024-11-28T10:30:00.000Z",
  "updatedAt": "2024-11-28T10:35:00.000Z",
  "metadata": {
    "priority": "HIGH",
    "department": "Engineering",
    "riskScore": 0.25
  }
}
```

### Stats Response

```json
{
  "overview": {
    "total": 29,
    "byStatus": {
      "COMPLETED": 15,
      "PROCESSING": 5,
      "PENDING": 7,
      "FAILED": 2
    }
  },
  "financial": {
    "totalValue": 5250000.00,
    "averageValue": 350000.00
  },
  "timeline": {
    "expiringIn30Days": 3,
    "expiringIn90Days": 8
  }
}
```

