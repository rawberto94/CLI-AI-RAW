# Cloud Storage Integration Guide

Connect your cloud storage accounts (Google Drive, SharePoint, Dropbox, Box) to import contracts directly into Contract Intelligence.

## Supported Providers

| Provider | Status | Features |
|----------|--------|----------|
| **Google Drive** | ✅ Ready | Browse, import PDFs/Docs/Excel |
| **SharePoint / OneDrive** | 🔧 Planned | Microsoft 365 integration |
| **Dropbox** | 🔧 Planned | Business & personal accounts |
| **Box** | 🔧 Planned | Enterprise document storage |

---

## Google Drive Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Note down your **Project ID**

### Step 2: Enable Google Drive API

1. Go to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click **Enable**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (or Internal for Google Workspace)
3. Fill in required fields:
   - App name: `Contract Intelligence`
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Add test users if in testing mode

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Contract Intelligence`
5. Authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google-drive`
   - Production: `https://yourdomain.com/api/auth/callback/google-drive`
6. Click **Create**
7. Download the JSON or copy **Client ID** and **Client Secret**

### Step 5: Configure Environment Variables

Add these to your `.env` file:

```env
# Google Drive Integration
GOOGLE_DRIVE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 6: Test the Connection

1. Start your development server: `pnpm dev`
2. Navigate to **Settings** → **Integrations**
3. Click **Connect Google Drive**
4. Authorize the application
5. Browse and import documents!

---

## Using the Integration

### Importing Documents

1. Go to **Upload** page or **Integrations** → **Google Drive**
2. Click **Import from Google Drive**
3. Browse your folders
4. Select files to import (PDF, Word, Excel supported)
5. Click **Import**

### Supported File Types

| Type | Extensions | Notes |
|------|------------|-------|
| PDF | `.pdf` | Full text extraction |
| Word | `.doc`, `.docx` | Converted to text |
| Excel | `.xls`, `.xlsx` | Rate cards, data tables |
| Google Docs | Native | Auto-exported to PDF |
| Google Sheets | Native | Auto-exported to Excel |
| Images | `.jpg`, `.png`, `.tiff` | OCR processing |
| Text | `.txt`, `.csv` | Direct import |

### Auto-Sync (Coming Soon)

Configure folders to automatically sync new documents:

```typescript
// Planned feature
const syncConfig = {
  folderId: 'your-folder-id',
  schedule: 'every-hour',
  fileTypes: ['pdf', 'docx'],
  autoProcess: true,
};
```

---

## SharePoint / OneDrive Setup (Coming Soon)

### Prerequisites

1. Azure AD app registration
2. Microsoft Graph API permissions
3. Admin consent for organization

### Environment Variables

```env
# Microsoft / SharePoint Integration
MICROSOFT_CLIENT_ID=your-azure-client-id
MICROSOFT_CLIENT_SECRET=your-azure-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
```

---

## Dropbox Setup (Coming Soon)

### Prerequisites

1. Dropbox App Console account
2. App with files.content.read permission

### Environment Variables

```env
# Dropbox Integration  
DROPBOX_CLIENT_ID=your-dropbox-app-key
DROPBOX_CLIENT_SECRET=your-dropbox-app-secret
```

---

## Box Setup (Coming Soon)

### Prerequisites

1. Box Developer account
2. Custom App with OAuth 2.0

### Environment Variables

```env
# Box Integration
BOX_CLIENT_ID=your-box-client-id
BOX_CLIENT_SECRET=your-box-client-secret
```

---

## Security Considerations

### Token Storage

- OAuth tokens are stored encrypted in the database
- Tokens are automatically refreshed before expiration
- Refresh tokens are stored for offline access

### Permissions

- We only request **read access** to your files
- You control which files to import
- No files are modified or deleted
- You can revoke access at any time

### Data Handling

- Files are downloaded temporarily for processing
- Extracted text is stored in Contract database
- Original file metadata is preserved
- Source tracking shows file origin

---

## Troubleshooting

### "Access Denied" Error

- Ensure OAuth consent screen is configured
- Check that test users are added (if in testing mode)
- Verify redirect URI matches exactly

### "Token Expired" Error

- Tokens auto-refresh; if persistent, disconnect and reconnect
- Check that refresh_token is being stored

### Files Not Showing

- Verify file type is supported
- Check folder permissions in Drive
- Ensure files aren't in Trash

### Import Fails

- Check file size (max 50MB recommended)
- Ensure file isn't corrupted
- Try downloading manually first

---

## API Reference

### Check Connection Status

```bash
GET /api/integrations/google-drive
```

Response:
```json
{
  "success": true,
  "connected": true,
  "accountEmail": "user@example.com",
  "accountName": "John Doe"
}
```

### List Files

```bash
POST /api/integrations/google-drive
Content-Type: application/json

{
  "action": "list",
  "folderId": "root"  // or specific folder ID
}
```

### Import File

```bash
POST /api/integrations/google-drive
Content-Type: application/json

{
  "action": "import",
  "fileId": "1abc123..."
}
```

### Import Multiple Files

```bash
POST /api/integrations/google-drive
Content-Type: application/json

{
  "action": "import-batch",
  "fileIds": ["1abc...", "2def...", "3ghi..."]
}
```

### Disconnect

```bash
DELETE /api/integrations/google-drive
```

