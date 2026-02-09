# External Contract Source Integrations

> **DEPRECATED:** See [docs/TECHNICAL_DOCUMENTATION.md](docs/TECHNICAL_DOCUMENTATION.md) for current integration documentation. Retained for historical reference only.

---

This document provides comprehensive guidance for configuring and using the Contract Source Integration system, which enables automatic synchronization of contracts from external storage systems.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Supported Providers](#supported-providers)
4. [Setup Guide](#setup-guide)
5. [API Reference](#api-reference)
6. [Configuration Options](#configuration-options)
7. [Security Best Practices](#security-best-practices)
8. [Webhooks](#webhooks)
9. [UI Components](#ui-components)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Contract Source Integration system implements a **Pull Model** architecture that periodically fetches contracts from external storage systems. This approach:

- **Respects client data sovereignty** - Data remains in the client's infrastructure until sync
- **Supports multiple providers** - SharePoint, OneDrive, Azure Blob, S3, SFTP
- **Provides flexible scheduling** - Configurable sync intervals per source
- **Implements delta sync** - Only fetch changed files to minimize bandwidth
- **Auto-processes contracts** - Optionally extract metadata after sync

### Key Features

| Feature | Description |
|---------|-------------|
| Multi-Provider Support | SharePoint, OneDrive, Google Drive, Azure Blob, AWS S3, SFTP |
| Delta Synchronization | Only sync new or modified files |
| Scheduled Syncs | Configurable intervals (5 minutes to 24 hours) |
| Auto-Processing | Automatic contract extraction after sync |
| Connection Testing | Verify credentials before enabling |
| File Pattern Filters | Include/exclude files by pattern |
| Sync History | Complete audit trail of all sync operations |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTIGO PLATFORM                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Contract Sources UI                      │   │
│  │    /settings/contract-sources                               │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐   │
│  │                     API Routes                               │   │
│  │    /api/contract-sources/*                                  │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐   │
│  │                  Sync Service                                │   │
│  │    ContractSourceSyncService                                │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────┐   │
│  │              Connector Factory                               │   │
│  │    Creates provider-specific connectors                      │   │
│  └──────┬───────┬───────┬───────┬───────┬──────────────────────┘   │
│         │       │       │       │       │                          │
│    ┌────▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐                      │
│    │SharePt│ │Azure│ │ S3  │ │SFTP │ │GDrv │                      │
│    │Conn.  │ │Blob │ │Conn.│ │Conn.│ │Conn.│                      │
│    └───────┘ └─────┘ └─────┘ └─────┘ └─────┘                      │
└─────────────────────────────────────────────────────────────────────┘
                             │
                     PULL    │    (Scheduled/Manual Sync)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SYSTEMS                                 │
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐        │
│   │  SharePoint  │    │  Azure Blob  │    │    AWS S3    │        │
│   │  Sites/Docs  │    │  Containers  │    │   Buckets    │        │
│   └──────────────┘    └──────────────┘    └──────────────┘        │
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐        │
│   │   OneDrive   │    │ Google Drive │    │ SFTP Server  │        │
│   │   Personal   │    │   Folders    │    │  Directories │        │
│   └──────────────┘    └──────────────┘    └──────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Configuration** - Admin configures source in UI with credentials
2. **Scheduling** - BullMQ worker schedules sync jobs based on interval
3. **Connection** - Connector factory creates appropriate provider connector
4. **Listing** - Connector lists files in configured folder
5. **Comparison** - Sync service compares with existing synced files
6. **Download** - New/modified files are downloaded
7. **Storage** - Files are stored locally and database updated
8. **Processing** - Optionally trigger contract extraction

---

## Supported Providers

### Microsoft SharePoint

Connect to SharePoint Online sites and document libraries.

**Requirements:**
- Azure AD App Registration with SharePoint permissions
- Application (client) ID and secret
- SharePoint site URL

**Permissions Required:**
- `Sites.Read.All` - Read all site collections
- `Files.Read.All` - Read files in all site collections

### Microsoft OneDrive

Connect to OneDrive for Business or personal accounts.

**Requirements:**
- Azure AD App Registration with OneDrive permissions
- OAuth 2.0 authorization flow

**Permissions Required:**
- `Files.Read.All` - Read user files
- `offline_access` - Refresh token support

### Azure Blob Storage

Connect to Azure Storage accounts and containers.

**Requirements:**
- Storage account name
- Container name
- Authentication (Account Key, SAS Token, or Connection String)

**Supported Authentication:**
- Account Key (full access)
- SAS Token (scoped access, recommended)
- Connection String

### AWS S3

Connect to Amazon S3 buckets or S3-compatible services.

**Requirements:**
- Bucket name
- AWS region
- Access Key ID and Secret Access Key

**IAM Permissions Required:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket",
        "arn:aws:s3:::your-bucket/*"
      ]
    }
  ]
}
```

### SFTP

Connect to SFTP servers for file synchronization.

**Requirements:**
- Host and port
- Username and password, OR
- Username and SSH private key

**Supported Authentication:**
- Password authentication
- SSH key authentication (RSA, ED25519)
- SSH key with passphrase

### Google Drive

Connect to Google Drive folders.

**Requirements:**
- Google Cloud Service Account
- Service account JSON key file
- Folder ID to sync

---

## Setup Guide

### 1. SharePoint/OneDrive Setup

#### Create Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory
2. Navigate to **App registrations** → **New registration**
3. Configure:
   - Name: "Contigo Contract Sync"
   - Supported account types: "Accounts in this organizational directory only"
   - Redirect URI: `https://your-domain.com/api/auth/callback/sharepoint`
4. After creation, note the **Application (client) ID**
5. Go to **Certificates & secrets** → **New client secret**
6. Note the secret value (shown only once)

#### Configure API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph**
3. Choose **Application permissions**
4. Add:
   - `Sites.Read.All`
   - `Files.Read.All`
5. Click **Grant admin consent**

#### Add to Contigo

1. Go to Settings → Contract Sources
2. Click "Add Source"
3. Select "SharePoint" as provider
4. Enter:
   - Name: Descriptive name (e.g., "Main Contracts Library")
   - Tenant ID: Your Azure AD tenant ID
   - Client ID: Application ID from app registration
   - Client Secret: Secret value created above
   - Site URL: Full SharePoint site URL
   - Sync Folder: Path within the document library (e.g., `/Shared Documents/Contracts`)
5. Click "Create Source"
6. Test the connection

### 2. Azure Blob Storage Setup

#### Create Storage Account (if needed)

1. Go to Azure Portal → Storage accounts → Create
2. Configure basics (name, region, performance)
3. Note the storage account name

#### Get Access Credentials

**Option A: Account Key (Full Access)**
1. Go to Storage account → Access keys
2. Copy Key1 or Key2

**Option B: SAS Token (Recommended)**
1. Go to Storage account → Shared access signature
2. Configure:
   - Allowed services: Blob
   - Allowed resource types: Container, Object
   - Allowed permissions: Read, List
   - Start/expiry time
3. Generate SAS and copy the token

#### Add to Contigo

1. Go to Settings → Contract Sources
2. Click "Add Source"
3. Select "Azure Blob" as provider
4. Enter:
   - Name: Descriptive name
   - Storage Account Name: Your account name
   - Container Name: Target container
   - Account Key or SAS Token
   - Sync Folder: Prefix path (e.g., `/contracts/2024/`)
5. Create and test connection

### 3. AWS S3 Setup

#### Create IAM User

1. Go to AWS Console → IAM → Users → Create user
2. Create with programmatic access
3. Attach policy with S3 read permissions (see IAM policy above)
4. Save Access Key ID and Secret Access Key

#### Add to Contigo

1. Go to Settings → Contract Sources
2. Click "Add Source"
3. Select "Amazon S3" as provider
4. Enter:
   - Name: Descriptive name
   - Bucket Name: Your S3 bucket
   - Region: Bucket region (e.g., `eu-central-1`)
   - Access Key ID
   - Secret Access Key
   - Sync Folder: Key prefix (e.g., `contracts/`)
5. Create and test connection

### 4. SFTP Setup

#### Prepare Credentials

**Password Authentication:**
- Host, port (usually 22)
- Username and password

**SSH Key Authentication:**
1. Generate SSH key pair if needed:
   ```bash
   ssh-keygen -t ed25519 -f contigo_sync_key
   ```
2. Add public key to server's `~/.ssh/authorized_keys`
3. Keep private key secure

#### Add to Contigo

1. Go to Settings → Contract Sources
2. Click "Add Source"
3. Select "SFTP" as provider
4. Enter:
   - Name: Descriptive name
   - Host: SFTP server hostname
   - Port: Usually 22
   - Username
   - Password OR Private Key
   - Sync Folder: Remote directory path
5. Create and test connection

---

## API Reference

### Endpoints

#### List Sources
```http
GET /api/contract-sources
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sources": [
      {
        "id": "source_123",
        "name": "SharePoint Contracts",
        "provider": "SHAREPOINT",
        "status": "CONNECTED",
        "syncFolder": "/Shared Documents/Contracts",
        "syncInterval": 60,
        "syncEnabled": true,
        "lastSyncAt": "2024-01-15T10:30:00Z",
        "totalFilesSynced": 150
      }
    ],
    "total": 1
  }
}
```

#### Create Source
```http
POST /api/contract-sources
Content-Type: application/json

{
  "name": "My SharePoint",
  "provider": "SHAREPOINT",
  "credentials": {
    "type": "sharepoint",
    "tenantId": "xxx",
    "clientId": "xxx",
    "clientSecret": "xxx",
    "siteUrl": "https://company.sharepoint.com/sites/contracts"
  },
  "syncFolder": "/Shared Documents/Contracts",
  "syncInterval": 60,
  "autoProcess": true
}
```

#### Update Source
```http
PUT /api/contract-sources
Content-Type: application/json

{
  "id": "source_123",
  "name": "Updated Name",
  "syncInterval": 120,
  "syncEnabled": false
}
```

#### Delete Source
```http
DELETE /api/contract-sources?id=source_123
```

#### Test Connection
```http
POST /api/contract-sources/test
Content-Type: application/json

{
  "sourceId": "source_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "accountInfo": {
      "name": "Contracts Library",
      "email": "admin@company.com"
    },
    "capabilities": {
      "deltaSync": true,
      "folderListing": true
    }
  }
}
```

#### Trigger Sync
```http
POST /api/contract-sources/sync
Content-Type: application/json

{
  "sourceId": "source_123",
  "syncMode": "INCREMENTAL"
}
```

**Sync Modes:**
- `FULL` - Sync all files regardless of previous state
- `INCREMENTAL` - Only sync new/modified files (based on hash/date)
- `DELTA` - Use provider's delta API (SharePoint/OneDrive only)

#### Get Sync History
```http
GET /api/contract-sources/sync?sourceId=source_123&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "syncs": [
      {
        "id": "sync_456",
        "status": "COMPLETED",
        "syncMode": "INCREMENTAL",
        "filesFound": 25,
        "filesProcessed": 10,
        "filesSkipped": 15,
        "filesFailed": 0,
        "startedAt": "2024-01-15T10:00:00Z",
        "completedAt": "2024-01-15T10:05:00Z",
        "duration": 300000
      }
    ]
  }
}
```

#### Browse Remote Files
```http
GET /api/contract-sources/browse?sourceId=source_123&path=/contracts
```

---

## Configuration Options

### Source Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | required | Display name for the source |
| `provider` | enum | required | Provider type (SHAREPOINT, AZURE_BLOB, etc.) |
| `syncFolder` | string | "/" | Root folder to sync from |
| `syncInterval` | number | 60 | Minutes between automatic syncs |
| `syncEnabled` | boolean | true | Enable/disable automatic sync |
| `autoProcess` | boolean | false | Auto-extract contracts after sync |
| `filePatterns` | string[] | ["*.pdf", "*.docx"] | File patterns to include |
| `excludePatterns` | string[] | [] | File patterns to exclude |

### Environment Variables

```env
# Microsoft Graph (SharePoint/OneDrive)
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret

# Azure Blob Storage (optional default credentials)
AZURE_STORAGE_ACCOUNT=account-name
AZURE_STORAGE_KEY=account-key

# AWS S3 (optional default credentials)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=eu-central-1

# Encryption key for stored credentials
CREDENTIAL_ENCRYPTION_KEY=32-byte-hex-key
```

### Sync Worker Configuration

Configure the BullMQ worker in `ecosystem.config.cjs`:

```javascript
{
  name: 'contract-source-sync',
  script: './packages/workers/dist/contract-source-sync-worker.js',
  instances: 1,
  env: {
    NODE_ENV: 'production',
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://...'
  }
}
```

---

## Security Best Practices

### Credential Storage

1. **Never store plain-text credentials** - All credentials are encrypted at rest
2. **Use environment variables** for encryption keys
3. **Rotate credentials regularly** - Especially for service accounts
4. **Use least-privilege access** - Only request necessary permissions

### Network Security

1. **Use TLS/SSL** for all connections
2. **Whitelist IPs** if possible (especially for SFTP)
3. **Use VPN/Private Link** for Azure Blob in production
4. **Enable S3 bucket policies** to restrict access

### Audit and Monitoring

1. **Enable sync logging** - All syncs are recorded with full details
2. **Monitor for errors** - Set up alerts for failed syncs
3. **Review access patterns** - Check sync history regularly
4. **Track file counts** - Unexpected changes may indicate issues

### Recommended Production Setup

```env
# Use Azure Key Vault or AWS Secrets Manager for production
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/

# Enable audit logging
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90

# Rate limiting
SYNC_RATE_LIMIT_PER_MINUTE=10
MAX_CONCURRENT_SYNCS=5
```

---

## Webhooks

The sync system can send webhook notifications for various events, enabling real-time integrations with external systems.

### Webhook Events

| Event | Description |
|-------|-------------|
| `sync.started` | Sync operation has started |
| `sync.completed` | Sync completed successfully |
| `sync.failed` | Sync failed with error |
| `sync.progress` | Progress update during sync |
| `source.connected` | Source connection established |
| `source.disconnected` | Source connection lost |
| `source.error` | Error occurred with source |
| `file.synced` | Individual file synced |
| `file.processed` | File processed and contract created |
| `file.failed` | File processing failed |

### Webhook Payload

```json
{
  "event": "sync.completed",
  "timestamp": "2025-01-18T10:30:00Z",
  "data": {
    "sourceId": "source_123",
    "sourceName": "SharePoint Contracts",
    "provider": "SHAREPOINT",
    "tenantId": "tenant_456",
    "syncId": "sync_789",
    "progress": {
      "filesFound": 100,
      "filesProcessed": 95,
      "filesFailed": 5,
      "percentComplete": 100
    }
  }
}
```

### Webhook Configuration

```env
# Webhook endpoint URL
SYNC_WEBHOOK_URL=https://your-system.com/webhooks/contigo

# HMAC secret for signature verification
SYNC_WEBHOOK_SECRET=your-secret-key
```

### Signature Verification

Webhooks include an HMAC-SHA256 signature for verification:

```typescript
const crypto = require('crypto');

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `sha256=${expected}` === signature;
}

// In your webhook handler
app.post('/webhooks/contigo', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  const { event, data } = req.body;
  console.log(`Received ${event}:`, data);
  
  res.status(200).json({ received: true });
});
```

---

## UI Components

The integration includes React components for managing contract sources.

### FileBrowser Component

Browse and select folders from connected sources:

```tsx
import { FileBrowser } from '@/components/contract-sources';

<FileBrowser
  sourceId="source_123"
  open={isOpen}
  onOpenChange={setIsOpen}
  onSelect={(path) => console.log('Selected:', path)}
  selectMode="folder"
  title="Select Sync Folder"
/>
```

### SyncStatus Component

Display real-time sync progress:

```tsx
import { SyncStatus } from '@/components/contract-sources';

<SyncStatus
  sourceId="source_123"
  sourceName="SharePoint Contracts"
  autoRefresh={true}
  refreshInterval={2000}
  onSyncComplete={() => refetchSources()}
/>
```

### SyncActivityFeed Component

Show recent sync activity:

```tsx
import { SyncActivityFeed } from '@/components/contract-sources';

<SyncActivityFeed sourceId="source_123" />
```

---

## Troubleshooting

### Common Issues

#### "Connection Failed" Error

**SharePoint/OneDrive:**
- Verify tenant ID, client ID, and client secret are correct
- Check that admin consent has been granted for API permissions
- Ensure the site URL is correct and accessible

**Azure Blob:**
- Verify storage account name and container name
- Check that the account key or SAS token is valid
- Ensure the SAS token has read and list permissions

**AWS S3:**
- Verify bucket name and region
- Check IAM user has correct permissions
- Ensure the bucket exists and is accessible

**SFTP:**
- Verify host and port are correct
- Check username and password/key
- Ensure firewall allows connection from your server

#### "Auth Expired" Status

For OAuth providers (SharePoint, OneDrive, Google Drive):
1. Go to source settings
2. Click "Reconnect" to re-authorize
3. Complete the OAuth flow

#### Sync Taking Too Long

- Reduce the number of files by narrowing `syncFolder`
- Use file patterns to filter specific file types
- Increase `syncInterval` to reduce frequency
- Check network connectivity and bandwidth

#### Files Not Appearing

- Verify `syncFolder` path is correct
- Check `filePatterns` include the file types
- Look for errors in sync history
- Ensure files aren't filtered by `excludePatterns`

### Debug Mode

Enable debug logging for detailed troubleshooting:

```env
DEBUG=contigo:sync:*
LOG_LEVEL=debug
```

### Getting Help

1. Check sync history for error messages
2. Review server logs for detailed errors
3. Test connection to verify credentials
4. Contact support with sync ID for investigation

---

## Database Schema

### ContractSource Model

```prisma
model ContractSource {
  id              String   @id @default(cuid())
  tenantId        String
  name            String
  description     String?
  provider        ContractSourceProvider
  status          ContractSourceStatus @default(DISCONNECTED)
  
  // Credentials (encrypted)
  credentials     Json
  encryptedAt     DateTime?
  
  // OAuth tokens (for Microsoft/Google)
  accessToken     String?
  refreshToken    String?
  tokenExpiresAt  DateTime?
  
  // Sync configuration
  syncFolder      String   @default("/")
  syncInterval    Int      @default(60)
  syncEnabled     Boolean  @default(true)
  syncMode        SyncMode @default(INCREMENTAL)
  autoProcess     Boolean  @default(false)
  
  // File filtering
  filePatterns    String[] @default(["*.pdf", "*.docx", "*.doc"])
  excludePatterns String[] @default([])
  
  // Sync state
  lastSyncAt      DateTime?
  lastSyncResult  String?
  lastErrorAt     DateTime?
  lastErrorMessage String?
  deltaToken      String?
  totalFilesSynced Int     @default(0)
  
  // Account info
  accountEmail    String?
  accountName     String?
  
  // Relations
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  syncedFiles     SyncedFile[]
  syncs           SourceSync[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### SyncedFile Model

```prisma
model SyncedFile {
  id            String   @id @default(cuid())
  sourceId      String
  contractId    String?
  
  // Remote file info
  remoteId      String
  remotePath    String
  remoteName    String
  remoteMimeType String?
  remoteSize    Int?
  remoteHash    String?
  remoteModifiedAt DateTime?
  
  // Local file info
  localPath     String?
  
  // Sync state
  status        SyncFileStatus @default(PENDING)
  lastSyncedAt  DateTime?
  processedAt   DateTime?
  errorMessage  String?
  
  // Relations
  source        ContractSource @relation(fields: [sourceId], references: [id])
  contract      Contract? @relation(fields: [contractId], references: [id])
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([sourceId, remoteId])
}
```

---

## Changelog

### v1.1.0 (2025-01)

- Added Google Drive connector with OAuth support
- Added credential encryption (AES-256-GCM)
- Added webhook notifications for sync events
- Added FileBrowser component for remote folder selection
- Added SyncStatus component with real-time progress
- Added SyncActivityFeed component
- Added Contract Sources link to settings navigation
- Added contract-sync worker to PM2 ecosystem config
- Improved documentation with webhook and UI component guides

### v1.0.0 (2025-01)

- Initial release
- Support for SharePoint, OneDrive, Azure Blob, AWS S3, SFTP
- Full and incremental sync modes
- Delta sync for Microsoft Graph providers
- Auto-processing integration
- Complete sync history and audit trail

---

*For additional support, contact the Contigo platform team.*
