# API Versioning Strategy

## Overview

This document outlines the API versioning strategy for the Contigo platform to ensure backward compatibility while enabling continuous improvement.

## Current Approach: Schema Versioning

The Contigo platform currently uses **internal schema versioning** for data models:

```typescript
// Example from migration schemas
interface ContractSchema {
  schemaVersion: number;  // Tracks data structure version
  // ... fields
}
```

This handles data migration and backward compatibility at the storage layer.

## API Versioning Strategy

### Recommended: Header-Based Versioning

For REST APIs, we recommend **header-based versioning** as it keeps URLs clean and follows industry best practices:

```http
GET /api/contracts
Accept: application/vnd.contigo.v1+json
```

### Implementation

#### 1. Version Header Middleware

```typescript
// lib/api-version.ts
import { NextRequest, NextResponse } from 'next/server';

export const API_VERSIONS = ['v1', 'v2'] as const;
export type APIVersion = typeof API_VERSIONS[number];
export const CURRENT_VERSION: APIVersion = 'v2';
export const MINIMUM_VERSION: APIVersion = 'v1';

export function getAPIVersion(request: NextRequest): APIVersion {
  // Check Accept header first
  const accept = request.headers.get('accept') || '';
  const versionMatch = accept.match(/vnd\.contigo\.(v\d+)/);
  if (versionMatch && API_VERSIONS.includes(versionMatch[1] as APIVersion)) {
    return versionMatch[1] as APIVersion;
  }
  
  // Check X-API-Version header
  const headerVersion = request.headers.get('x-api-version');
  if (headerVersion && API_VERSIONS.includes(headerVersion as APIVersion)) {
    return headerVersion as APIVersion;
  }
  
  // Check query parameter (least preferred)
  const queryVersion = request.nextUrl.searchParams.get('api_version');
  if (queryVersion && API_VERSIONS.includes(queryVersion as APIVersion)) {
    return queryVersion as APIVersion;
  }
  
  return CURRENT_VERSION;
}

export function addVersionHeaders(
  response: NextResponse,
  version: APIVersion
): NextResponse {
  response.headers.set('X-API-Version', version);
  response.headers.set('X-API-Supported-Versions', API_VERSIONS.join(', '));
  
  if (version !== CURRENT_VERSION) {
    response.headers.set(
      'Deprecation',
      `Version ${version} is deprecated. Please upgrade to ${CURRENT_VERSION}`
    );
  }
  
  return response;
}
```

#### 2. Version-Aware Route Handlers

```typescript
// app/api/contracts/route.ts
import { getAPIVersion, addVersionHeaders } from '@/lib/api-version';

export async function GET(request: NextRequest) {
  const version = getAPIVersion(request);
  
  let responseData;
  
  switch (version) {
    case 'v1':
      responseData = await getContractsV1(request);
      break;
    case 'v2':
    default:
      responseData = await getContractsV2(request);
  }
  
  const response = NextResponse.json(responseData);
  return addVersionHeaders(response, version);
}

// v1 response format (legacy)
async function getContractsV1(request: NextRequest) {
  const contracts = await prisma.contract.findMany();
  return {
    data: contracts,
    total: contracts.length,
  };
}

// v2 response format (current)
async function getContractsV2(request: NextRequest) {
  const contracts = await prisma.contract.findMany();
  return {
    data: contracts,
    meta: {
      total: contracts.length,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    },
    links: {
      self: '/api/contracts',
      next: null,
      prev: null,
    },
  };
}
```

## Versioning Rules

### When to Increment Version

| Change Type | Action |
|-------------|--------|
| Add new optional field | No version change |
| Add new endpoint | No version change |
| Add new query parameter | No version change |
| Remove field | **New version** |
| Rename field | **New version** |
| Change field type | **New version** |
| Change response structure | **New version** |
| Remove endpoint | **New version** |

### Deprecation Policy

1. **Announcement**: Deprecated versions are announced 6 months before removal
2. **Warning Headers**: Deprecated versions return `Deprecation` header
3. **Documentation**: Deprecation notices added to API docs
4. **Migration Guide**: Published for each major version change
5. **Sunset**: Removed after 12 months from deprecation announcement

### Version Lifecycle

```
v1 (Current) → v1 (Deprecated) → v1 (Sunset)
     ↓              ↓
   v2 (Beta)    v2 (Current)    → v2 (Deprecated) → ...
```

## Client Integration

### JavaScript/TypeScript Client

```typescript
// Using fetch
const response = await fetch('/api/contracts', {
  headers: {
    'Accept': 'application/vnd.contigo.v2+json',
    'Authorization': `Bearer ${token}`,
  },
});

// Using the SDK
import { ContigoClient } from '@contigo/sdk';

const client = new ContigoClient({
  apiVersion: 'v2',
  baseUrl: process.env.CONTIGO_API_URL,
});
```

### cURL Example

```bash
curl -X GET "https://api.contigo.app/api/contracts" \
  -H "Accept: application/vnd.contigo.v2+json" \
  -H "Authorization: Bearer $TOKEN"
```

## OpenAPI Documentation

Version-specific OpenAPI schemas are available at:

- **v1**: `/api/docs/v1/openapi.json`
- **v2**: `/api/docs/v2/openapi.json`
- **Latest**: `/api/docs/openapi.json` (always points to current)

## Breaking Change Checklist

Before releasing a breaking change:

- [ ] Document the change in CHANGELOG.md
- [ ] Update OpenAPI specification
- [ ] Create migration guide
- [ ] Update SDK with backward compatibility
- [ ] Notify customers via email
- [ ] Add deprecation headers to old version
- [ ] Update API documentation
- [ ] Monitor adoption metrics

## Version Support Matrix

| Version | Status | Release Date | Deprecation Date | Sunset Date |
|---------|--------|--------------|------------------|-------------|
| v1 | Deprecated | 2024-01-01 | 2025-01-01 | 2025-07-01 |
| v2 | Current | 2025-01-01 | - | - |

## Monitoring

Track version usage with metrics:

```typescript
// Track API version usage
metrics.increment('api.request', {
  version: getAPIVersion(request),
  endpoint: request.url,
  tenant: tenantId,
});
```

Dashboard alerts:
- Alert when >50% of requests use deprecated version
- Alert when any requests use version within 30 days of sunset
