# Editable Artifact Repository - API Documentation

## Overview

This document provides comprehensive API documentation for the Editable Artifact Repository feature. All endpoints support JSON request/response format and require authentication.

---

## Authentication

All endpoints require a valid authentication token:

```http
Authorization: Bearer <token>
```

---

## Artifact Editing Endpoints

### 1. Update Artifact

Update an entire artifact with new data.

**Endpoint**: `PUT /api/contracts/{contractId}/artifacts/{artifactId}`

**Request Body**:
```json
{
  "updates": {
    "data": {
      "rateCards": [
        {
          "role": "Senior Developer",
          "seniorityLevel": "Senior",
          "hourlyRate": 150,
          "currency": "USD"
        }
      ]
    }
  },
  "userId": "user-123",
  "tenantId": "tenant-456",
  "reason": "Correcting extraction error",
  "lastModified": "2025-10-21T10:00:00Z"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "artifact": {
    "id": "artifact-789",
    "contractId": "contract-123",
    "type": "rate_card",
    "data": { ... },
    "isEdited": true,
    "editCount": 1,
    "lastEditedBy": "user-123",
    "lastEditedAt": "2025-10-21T10:05:00Z",
    "validationStatus": "valid"
  },
  "version": 1
}
```

**Error Responses**:
- `400 Bad Request`: Validation errors
- `404 Not Found`: Artifact not found
- `409 Conflict`: Concurrent edit detected

---

### 2. Update Single Field

Update a single field in an artifact.

**Endpoint**: `PATCH /api/contracts/{contractId}/artifacts/{artifactId}/fields`

**Request Body**:
```json
{
  "fieldPath": "data.rateCards[0].hourlyRate",
  "value": 175,
  "userId": "user-123",
  "tenantId": "tenant-456"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "artifact": { ... },
  "fieldPath": "data.rateCards[0].hourlyRate",
  "oldValue": 150,
  "newValue": 175
}
```

---

### 3. Validate Artifact

Validate artifact data without saving.

**Endpoint**: `POST /api/contracts/{contractId}/artifacts/{artifactId}/validate`

**Request Body**:
```json
{
  "updates": {
    "data": {
      "rateCards": [...]
    }
  }
}
```

**Response** (200 OK):
```json
{
  "valid": true,
  "validationErrors": [],
  "warnings": []
}
```

**Response** (200 OK - with errors):
```json
{
  "valid": false,
  "validationErrors": [
    {
      "field": "data.rateCards[0].currency",
      "message": "Invalid currency code",
      "code": "INVALID_CURRENCY"
    }
  ],
  "warnings": [
    {
      "field": "data.rateCards[0].hourlyRate",
      "message": "Rate seems unusually high",
      "code": "RATE_WARNING"
    }
  ]
}
```

---

### 4. Bulk Update Artifacts

Update multiple artifacts in a single request.

**Endpoint**: `POST /api/contracts/{contractId}/artifacts/bulk-update`

**Request Body**:
```json
{
  "updates": [
    {
      "artifactId": "artifact-1",
      "updates": { "data": { ... } }
    },
    {
      "artifactId": "artifact-2",
      "updates": { "data": { ... } }
    }
  ],
  "userId": "user-123",
  "tenantId": "tenant-456"
}
```

**Response** (200 OK):
```json
{
  "results": [
    {
      "artifactId": "artifact-1",
      "success": true,
      "artifact": { ... }
    },
    {
      "artifactId": "artifact-2",
      "success": false,
      "error": "Validation failed",
      "validationErrors": [...]
    }
  ],
  "summary": {
    "total": 2,
    "successful": 1,
    "failed": 1
  }
}
```

---

## Rate Card Management Endpoints

### 5. Add Rate Card Entry

Add a new rate card entry to an artifact.

**Endpoint**: `POST /api/contracts/{contractId}/artifacts/{artifactId}/rates`

**Request Body**:
```json
{
  "rate": {
    "role": "Junior Developer",
    "seniorityLevel": "Junior",
    "hourlyRate": 75,
    "dailyRate": 600,
    "monthlyRate": 12000,
    "currency": "USD",
    "location": "US",
    "skills": ["JavaScript", "HTML", "CSS"],
    "certifications": []
  },
  "userId": "user-123",
  "tenantId": "tenant-456"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "rateId": "rate-123",
  "artifact": { ... }
}
```

---

### 6. Update Rate Card Entry

Update an existing rate card entry.

**Endpoint**: `PUT /api/contracts/{contractId}/artifacts/{artifactId}/rates/{rateId}`

**Request Body**:
```json
{
  "updates": {
    "hourlyRate": 85,
    "dailyRate": 680
  },
  "userId": "user-123",
  "tenantId": "tenant-456"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "rate": { ... },
  "artifact": { ... }
}
```

---

### 7. Delete Rate Card Entry

Delete a rate card entry.

**Endpoint**: `DELETE /api/contracts/{contractId}/artifacts/{artifactId}/rates/{rateId}`

**Query Parameters**:
- `userId`: User ID (required)
- `tenantId`: Tenant ID (required)

**Response** (200 OK):
```json
{
  "success": true,
  "deletedRateId": "rate-123",
  "artifact": { ... }
}
```

---

## Version History Endpoints

### 8. List Version History

Get all versions of an artifact.

**Endpoint**: `GET /api/contracts/{contractId}/artifacts/{artifactId}/versions`

**Response** (200 OK):
```json
{
  "versions": [
    {
      "version": 2,
      "editedBy": "user-123",
      "editedAt": "2025-10-21T10:05:00Z",
      "reason": "Updated rates",
      "changeType": "update",
      "changedFields": ["data.rateCards[0].hourlyRate"]
    },
    {
      "version": 1,
      "editedBy": "user-456",
      "editedAt": "2025-10-21T09:00:00Z",
      "reason": "Initial edit",
      "changeType": "update",
      "changedFields": ["data.rateCards"]
    }
  ],
  "currentVersion": 2,
  "totalVersions": 2
}
```

---

### 9. Get Specific Version

Get a specific version of an artifact.

**Endpoint**: `GET /api/contracts/{contractId}/artifacts/{artifactId}/versions/{version}`

**Response** (200 OK):
```json
{
  "version": {
    "version": 1,
    "data": { ... },
    "editedBy": "user-456",
    "editedAt": "2025-10-21T09:00:00Z",
    "reason": "Initial edit"
  }
}
```

---

### 10. Revert to Version

Revert an artifact to a previous version.

**Endpoint**: `POST /api/contracts/{contractId}/artifacts/{artifactId}/revert/{version}`

**Request Body**:
```json
{
  "userId": "user-123",
  "tenantId": "tenant-456",
  "reason": "Reverting incorrect changes"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "artifact": { ... },
  "revertedToVersion": 1,
  "newVersion": 3
}
```

---

## Metadata Editing Endpoints

### 11. Update Contract Metadata

Update contract metadata including tags and custom fields.

**Endpoint**: `PUT /api/contracts/{contractId}/metadata`

**Request Body**:
```json
{
  "updates": {
    "tags": ["consulting", "it-services", "high-priority"],
    "customFields": {
      "projectCode": "PROJ-123",
      "department": "Engineering"
    },
    "dataQualityScore": 0.95
  },
  "userId": "user-123",
  "tenantId": "tenant-456"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "metadata": {
    "contractId": "contract-123",
    "tags": ["consulting", "it-services", "high-priority"],
    "customFields": { ... },
    "dataQualityScore": 0.95,
    "lastUpdatedBy": "user-123",
    "lastUpdatedAt": "2025-10-21T10:05:00Z"
  }
}
```

---

### 12. Add Tags

Add tags to a contract.

**Endpoint**: `POST /api/contracts/{contractId}/metadata/tags`

**Request Body**:
```json
{
  "tags": ["urgent", "renewal-due"],
  "userId": "user-123",
  "tenantId": "tenant-456"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "addedTags": ["urgent", "renewal-due"],
  "allTags": ["consulting", "it-services", "urgent", "renewal-due"]
}
```

---

### 13. Remove Tag

Remove a tag from a contract.

**Endpoint**: `DELETE /api/contracts/{contractId}/metadata/tags/{tagName}`

**Query Parameters**:
- `userId`: User ID (required)
- `tenantId`: Tenant ID (required)

**Response** (200 OK):
```json
{
  "success": true,
  "removedTag": "urgent",
  "remainingTags": ["consulting", "it-services", "renewal-due"]
}
```

---

### 14. Bulk Update Metadata

Update metadata for multiple contracts.

**Endpoint**: `POST /api/contracts/metadata/bulk-update`

**Request Body**:
```json
{
  "updates": [
    {
      "contractId": "contract-1",
      "tags": ["urgent"],
      "customFields": { "priority": "high" }
    },
    {
      "contractId": "contract-2",
      "tags": ["standard"],
      "customFields": { "priority": "medium" }
    }
  ],
  "userId": "user-123",
  "tenantId": "tenant-456"
}
```

**Response** (200 OK):
```json
{
  "results": [
    {
      "contractId": "contract-1",
      "success": true
    },
    {
      "contractId": "contract-2",
      "success": true
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Data validation failed |
| `CONFLICT` | Concurrent edit detected |
| `NOT_FOUND` | Resource not found |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `INVALID_CURRENCY` | Invalid currency code |
| `INVALID_RATE` | Invalid rate value |
| `MISSING_REQUIRED_FIELD` | Required field missing |
| `PROPAGATION_FAILED` | Failed to propagate changes |

---

## Rate Limiting

All endpoints are rate-limited:
- **Standard**: 100 requests per minute
- **Bulk operations**: 10 requests per minute

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634825400
```

---

## Webhooks

Subscribe to artifact change events:

**Event Types**:
- `artifact.updated`
- `artifact.validated`
- `artifact.propagated`
- `metadata.updated`

**Webhook Payload**:
```json
{
  "event": "artifact.updated",
  "timestamp": "2025-10-21T10:05:00Z",
  "data": {
    "artifactId": "artifact-123",
    "contractId": "contract-456",
    "tenantId": "tenant-789",
    "userId": "user-123",
    "changeType": "update",
    "changedFields": ["data.rateCards[0].hourlyRate"]
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { ArtifactClient } from '@procurement/sdk';

const client = new ArtifactClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.procurement.com'
});

// Update artifact
const result = await client.artifacts.update({
  contractId: 'contract-123',
  artifactId: 'artifact-456',
  updates: {
    data: { ... }
  },
  userId: 'user-789',
  tenantId: 'tenant-012'
});

// Add rate card entry
const rate = await client.rateCards.add({
  contractId: 'contract-123',
  artifactId: 'artifact-456',
  rate: {
    role: 'Developer',
    hourlyRate: 100,
    currency: 'USD'
  }
});
```

---

## Best Practices

1. **Always include `lastModified`** when updating to detect conflicts
2. **Validate before saving** using the validate endpoint
3. **Use bulk operations** for multiple updates
4. **Handle partial failures** in bulk operations
5. **Subscribe to webhooks** for real-time updates
6. **Implement retry logic** for transient failures
7. **Cache version history** to reduce API calls

---

## Support

For API support:
- **Documentation**: https://docs.procurement.com/api
- **Support Email**: api-support@procurement.com
- **Status Page**: https://status.procurement.com

---

**API Version**: 1.0.0
**Last Updated**: October 21, 2025
