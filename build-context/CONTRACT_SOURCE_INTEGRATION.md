# Contract Source Integration System v1.2.0

> **DEPRECATED:** See [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md) for current integration documentation. Retained for historical reference only.

---

## Overview

The Contract Source Integration System provides a unified way to sync contracts from external storage systems into the Contigo platform. It supports multiple cloud storage providers and on-premise systems.

## Supported Providers

| Provider | OAuth | Delta Sync | Status |
|----------|-------|------------|--------|
| SharePoint | ✅ | ✅ | Production |
| OneDrive | ✅ | ✅ | Production |
| Google Drive | ✅ | ✅ | Production |
| Dropbox | ✅ | ✅ | Production |
| Box | ✅ | ✅ | Production |
| Azure Blob Storage | ❌ | ✅ | Production |
| AWS S3 | ❌ | ✅ | Production |
| SFTP | ❌ | ✅ | Production |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend UI                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ FileBrowser  │  │ SyncStatus   │  │ SyncMetricsWidget    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ /sources/*   │  │ /batch/*     │  │ /metrics             │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Rate Limiting Middleware                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ SyncService  │  │ BatchOps     │  │ EmailNotifications   │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Connector Layer                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │SharePt │ │OneDrive│ │ GDrive │ │Dropbox │ │  Box   │        │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
│  ┌────────┐ ┌────────┐ ┌────────┐                               │
│  │ Azure  │ │   S3   │ │  SFTP  │                               │
│  └────────┘ └────────┘ └────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Environment Variables

```env
# Encryption (required)
ENCRYPTION_KEY=your-32-byte-key-for-aes-256-gcm

# Microsoft OAuth (SharePoint/OneDrive)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id

# Google Drive
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Dropbox
DROPBOX_APP_KEY=your-app-key
DROPBOX_APP_SECRET=your-app-secret

# Box
BOX_CLIENT_ID=your-client-id
BOX_CLIENT_SECRET=your-client-secret

# Email Notifications (optional)
EMAIL_PROVIDER=smtp|sendgrid|ses
EMAIL_FROM=noreply@yourcompany.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass

# Redis for rate limiting (optional, falls back to memory)
REDIS_URL=redis://localhost:6379

# Webhooks
WEBHOOK_SECRET=your-webhook-signing-secret
```

### 2. Start the Sync Worker

Add to PM2 ecosystem:

```bash
pm2 start ecosystem.config.cjs --only contigo-contract-sync
```

### 3. Add Contract Sources via UI

Navigate to **Settings > Contract Sources** to add and configure sources.

## API Reference

### Sources

```typescript
// List all sources
GET /api/contract-sources

// Create new source
POST /api/contract-sources
{
  "name": "Company SharePoint",
  "provider": "SHAREPOINT",
  "config": { "siteUrl": "https://company.sharepoint.com", "driveId": "..." },
  "syncSchedule": "0 */6 * * *"
}

// Update source
PATCH /api/contract-sources/:id
{ "isActive": false }

// Delete source
DELETE /api/contract-sources/:id

// Trigger manual sync
POST /api/contract-sources/:id/sync
{ "fullSync": false }

// Test connection
POST /api/contract-sources/:id/test
```

### Batch Operations

```typescript
// Batch download
POST /api/contract-sources/batch/download
{
  "sourceId": "uuid",
  "fileIds": ["uuid1", "uuid2"],
  "format": "zip",
  "includeMetadata": true
}

// Batch import (create contracts from files)
POST /api/contract-sources/batch/import
{
  "sourceId": "uuid",
  "fileIds": ["uuid1", "uuid2"]
}

// Batch delete
POST /api/contract-sources/batch/delete
{
  "sourceId": "uuid",
  "fileIds": ["uuid1", "uuid2"]
}
```

### Metrics

```typescript
// Get sync metrics
GET /api/contract-sources/metrics

// Response
{
  "totalSources": 5,
  "connectedSources": 4,
  "errorSources": 1,
  "totalFilesSynced": 1234,
  "filesLast24h": 45,
  "filesLast7d": 302,
  "avgSyncDuration": 5200,
  "successRate": 98.5,
  "recentSyncs": [...],
  "sourceHealth": [...]
}
```

## Components

### SyncMetricsWidget

Dashboard widget showing sync statistics:

```tsx
import { SyncMetricsWidget } from "@/components/contract-sources";

// Full dashboard view
<SyncMetricsWidget />

// Compact card view
<SyncMetricsWidget compact />

// Custom configuration
<SyncMetricsWidget
  refreshInterval={60000}
  showRecentSyncs={true}
  showSourceHealth={true}
  maxRecentSyncs={10}
/>
```

### FileBrowser

Browse and select files from remote sources:

```tsx
import { FileBrowser } from "@/components/contract-sources";

<FileBrowser
  sourceId="source-uuid"
  onSelect={(files) => console.log("Selected:", files)}
  multiSelect={true}
/>
```

### SyncStatus

Real-time sync progress indicator:

```tsx
import { SyncStatus, SyncIndicator } from "@/components/contract-sources";

// Full status display
<SyncStatus sourceId="source-uuid" />

// Compact indicator
<SyncIndicator sourceId="source-uuid" />
```

## Rate Limiting

The API implements sliding window rate limiting:

| Endpoint Type | Requests/Minute |
|---------------|-----------------|
| Default       | 100             |
| Sync          | 10              |
| Download      | 50              |
| Metrics       | 200             |
| OAuth         | 20              |
| Webhooks      | 500             |

Response headers include:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds until retry (on 429)

## Email Notifications

Configure email notifications for sync events:

### Failure Alerts

Sent when a sync fails, includes:

- Source details
- Error message
- Retry status
- Link to source settings

### Summary Reports

Daily/weekly reports with:

- Total syncs and success rate
- Files processed
- Top performing sources
- Sources with issues

## Security

### Credential Encryption

All credentials are encrypted at rest using AES-256-GCM:

```typescript
import { encryptCredentials, decryptCredentials } from "@/lib/integrations";

// Credentials are automatically encrypted before database storage
const encrypted = encryptCredentials({ accessKey: "...", secretKey: "..." });
const decrypted = decryptCredentials(encrypted);
```

### Webhook Signatures

Webhooks are signed with HMAC-SHA256:

```typescript
// Verify incoming webhook
const signature = req.headers["x-webhook-signature"];
const isValid = verifyWebhookSignature(payload, signature, secret);
```

## Connector Development

To add a new connector:

1. Create connector class extending `BaseConnector`:

```typescript
// lib/integrations/connectors/my-provider.connector.ts
export class MyProviderConnector extends BaseConnector {
  async testConnection(): Promise<boolean> { ... }
  async listFiles(path: string, options?: ListOptions): Promise<RemoteFile[]> { ... }
  async downloadFile(path: string): Promise<Readable> { ... }
  async getDeltaChanges(since?: string): Promise<DeltaChanges> { ... }
}
```

2. Add to factory:

```typescript
// lib/integrations/connectors/factory.ts
case "MY_PROVIDER":
  return new MyProviderConnector(config);
```

3. Add provider to Prisma enum:

```prisma
enum ContractSourceProvider {
  // ...existing
  MY_PROVIDER
}
```

4. Create OAuth callback route (if OAuth):

```typescript
// app/api/auth/callback/my-provider/route.ts
export async function GET(req: NextRequest) { ... }
```

## Testing

Run connector tests:

```bash
cd apps/web
npm test lib/integrations/__tests__/connectors.test.ts
```

## Changelog

### v1.2.0 (Current)

- ✨ Added Dropbox connector with OAuth and delta sync
- ✨ Added Box connector with OAuth and events API
- ✨ Added sync metrics dashboard widget
- ✨ Added email notification service (SMTP, SendGrid, SES)
- ✨ Added rate limiting middleware with Redis support
- ✨ Added batch file operations (download, import, delete)
- ✨ Added comprehensive connector tests
- 🔧 Updated factory with all new providers
- 📚 Updated documentation

### v1.1.0

- ✨ Added Google Drive connector
- ✨ Added credential encryption (AES-256-GCM)
- ✨ Added webhook notifications
- ✨ Added FileBrowser component
- ✨ Added SyncStatus component
- ✨ Added PM2 worker configuration
- 🔗 Added settings navigation link

### v1.0.0

- 🎉 Initial release
- ✨ SharePoint connector
- ✨ OneDrive connector
- ✨ Azure Blob Storage connector
- ✨ AWS S3 connector
- ✨ SFTP connector
- ✨ Sync worker service
- ✨ API routes
