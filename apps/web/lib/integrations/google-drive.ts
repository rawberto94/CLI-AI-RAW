/**
 * Google Drive Integration Service
 * 
 * Enables importing contracts directly from Google Drive.
 * Supports folder browsing, file selection, and automatic import.
 * 
 * Setup Required:
 * 1. Create a Google Cloud project at https://console.cloud.google.com
 * 2. Enable the Google Drive API
 * 3. Create OAuth 2.0 credentials (Web application)
 * 4. Add authorized redirect URI: {APP_URL}/api/auth/callback/google-drive
 * 5. Set environment variables (see below)
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Environment variables required:
// GOOGLE_DRIVE_CLIENT_ID - OAuth client ID from Google Cloud Console
// GOOGLE_DRIVE_CLIENT_SECRET - OAuth client secret
// NEXT_PUBLIC_APP_URL - Your app's base URL

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
  path: string;
  files: GoogleDriveFile[];
  subfolders: GoogleDriveFolder[];
}

export interface GoogleDriveToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

// MIME types we support for contract import
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/tiff',
] as const;

export const MIME_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word (doc)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (docx)',
  'application/vnd.ms-excel': 'Excel (xls)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (xlsx)',
  'text/plain': 'Text',
  'text/csv': 'CSV',
  'image/jpeg': 'JPEG Image',
  'image/png': 'PNG Image',
  'image/tiff': 'TIFF Image',
};

// Google Drive API endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_DRIVE_STATE_TTL_MS = 10 * 60 * 1000;

interface GoogleDriveOAuthState {
  tenantId: string;
  userId: string;
  timestamp: number;
  nonce: string;
}

function getGoogleDriveStateSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET, AUTH_SECRET, or JWT_SECRET must be configured for Google Drive OAuth state signing');
  }
  return secret;
}

function splitSignedState(state: string): { payload: string; signature: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const separatorIndex = decoded.lastIndexOf('.');
    if (separatorIndex === -1) {
      return null;
    }
    return {
      payload: decoded.slice(0, separatorIndex),
      signature: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Create a signed OAuth state that binds the callback to the current tenant/user.
 */
export function createGoogleDriveOAuthState(tenantId: string, userId: string): string {
  const secret = getGoogleDriveStateSecret();
  const payload = JSON.stringify({
    tenantId,
    userId,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
  } satisfies GoogleDriveOAuthState);
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

/**
 * Validate a signed OAuth state for the expected tenant/user and freshness.
 */
export function validateGoogleDriveOAuthState(
  state: string,
  expectedTenantId: string,
  expectedUserId: string,
): boolean {
  const secret = getGoogleDriveStateSecret();
  const signed = splitSignedState(state);
  if (!signed) {
    return false;
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(signed.payload).digest('hex');
  if (signed.signature.length !== expectedSignature.length) {
    return false;
  }
  if (!crypto.timingSafeEqual(Buffer.from(signed.signature), Buffer.from(expectedSignature))) {
    return false;
  }

  try {
    const parsed = JSON.parse(signed.payload) as Partial<GoogleDriveOAuthState>;
    if (parsed.tenantId !== expectedTenantId || parsed.userId !== expectedUserId) {
      return false;
    }
    if (typeof parsed.timestamp !== 'number' || Date.now() - parsed.timestamp > GOOGLE_DRIVE_STATE_TTL_MS) {
      return false;
    }
    return typeof parsed.nonce === 'string' && parsed.nonce.length > 0;
  } catch {
    return false;
  }
}

// Scopes required for Drive access
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Generate OAuth authorization URL for Google Drive
 */
export function getGoogleDriveAuthUrl(state?: string): string {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google-drive`;
  
  if (!clientId) {
    throw new Error('GOOGLE_DRIVE_CLIENT_ID is not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  if (state) {
    params.set('state', state);
  }

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleDriveToken> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google-drive`;

  if (!clientId || !clientSecret) {
    throw new Error('Google Drive OAuth credentials not configured');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshGoogleDriveToken(refreshToken: string): Promise<GoogleDriveToken> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google Drive OAuth credentials not configured');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  };
}

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
}> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json();
}

/**
 * List files in a Google Drive folder
 */
export async function listDriveFiles(
  accessToken: string,
  folderId: string = 'root',
  options: {
    pageToken?: string;
    pageSize?: number;
    includeSubfolders?: boolean;
    mimeTypes?: string[];
  } = {}
): Promise<{
  files: GoogleDriveFile[];
  nextPageToken?: string;
}> {
  const { pageToken, pageSize = 100, includeSubfolders = true, mimeTypes } = options;

  // Build query
  const queryParts: string[] = [];
  
  // Filter by parent folder
  if (folderId !== 'root') {
    queryParts.push(`'${folderId}' in parents`);
  } else {
    queryParts.push("'root' in parents");
  }
  
  // Exclude trashed files
  queryParts.push('trashed = false');
  
  // Filter by MIME types if specified
  if (mimeTypes && mimeTypes.length > 0) {
    const mimeQuery = mimeTypes.map(m => `mimeType = '${m}'`).join(' or ');
    if (includeSubfolders) {
      queryParts.push(`(mimeType = 'application/vnd.google-apps.folder' or ${mimeQuery})`);
    } else {
      queryParts.push(`(${mimeQuery})`);
    }
  }

  const params = new URLSearchParams({
    q: queryParts.join(' and '),
    fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, iconLink, thumbnailLink)',
    pageSize: String(pageSize),
    orderBy: 'folder,name',
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list files: ${error}`);
  }

  const data = await response.json();
  
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Download a file from Google Drive
 */
export async function downloadDriveFile(
  accessToken: string,
  fileId: string
): Promise<{ content: Buffer; mimeType: string; name: string }> {
  // First, get file metadata
  const metaResponse = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?fields=name,mimeType,size`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!metaResponse.ok) {
    throw new Error('Failed to get file metadata');
  }

  const metadata = await metaResponse.json();

  // Check if it's a Google Docs file that needs export
  const googleDocsTypes: Record<string, string> = {
    'application/vnd.google-apps.document': 'application/pdf',
    'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.google-apps.presentation': 'application/pdf',
  };

  let downloadUrl: string;
  let exportMimeType: string = metadata.mimeType;

  const googleExportType = googleDocsTypes[metadata.mimeType];
  if (googleExportType) {
    // Export Google Docs format to standard format
    exportMimeType = googleExportType;
    downloadUrl = `${GOOGLE_DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`;
  } else {
    // Direct download
    downloadUrl = `${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`;
  }

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  
  return {
    content: Buffer.from(arrayBuffer),
    mimeType: exportMimeType,
    name: metadata.name,
  };
}

/**
 * Import a file from Google Drive into the contract system
 */
export async function importFileFromDrive(
  accessToken: string,
  fileId: string,
  tenantId: string,
  userId: string
): Promise<{ contractId: string; fileName: string }> {
  // Download the file
  const { content, mimeType, name } = await downloadDriveFile(accessToken, fileId);
  
  // Create a unique filename
  const timestamp = Date.now();
  const sanitizedName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `uploads/${tenantId}/${timestamp}-${sanitizedName}`;
  
  // In production, upload to S3/Azure/GCS
  // For now, we'll store locally or use the configured storage
  
  // Create contract record
  const contract = await prisma.contract.create({
    data: {
      tenantId,
      fileName: name,
      originalName: name,
      mimeType: mimeType,
      fileSize: content.length,
      status: 'PENDING',
      uploadedBy: userId,
      uploadedAt: new Date(),
      storagePath,
      storageProvider: 'google-drive',
      contractMetadata: {
        create: {
          tenantId,
          updatedBy: userId,
          customFields: {
            importSource: 'google-drive',
            importFileId: fileId,
            importedAt: new Date().toISOString(),
          },
        },
      },
    },
  });

  return {
    contractId: contract.id,
    fileName: name,
  };
}

/**
 * Store Google Drive connection in database
 */
export async function storeGoogleDriveConnection(
  tenantId: string,
  userId: string,
  tokens: GoogleDriveToken,
  userInfo: { email: string; name: string }
): Promise<string> {
  const integration = await prisma.integration.upsert({
    where: {
      tenantId_provider: {
        tenantId,
        provider: 'google-drive',
      },
    },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
      status: 'connected',
      connectedAt: new Date(),
      connectedBy: userId,
      accountEmail: userInfo.email,
      accountName: userInfo.name,
      updatedAt: new Date(),
    },
    create: {
      tenantId,
      name: 'Google Drive',
      provider: 'google-drive',
      type: 'storage',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scope: tokens.scope,
      status: 'connected',
      connectedAt: new Date(),
      connectedBy: userId,
      accountEmail: userInfo.email,
      accountName: userInfo.name,
      isActive: true,
    },
  });

  return integration.id;
}

/**
 * Get stored Google Drive connection
 */
export async function getGoogleDriveConnection(tenantId: string): Promise<{
  id: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  accountEmail: string | null;
  accountName: string | null;
} | null> {
  const integration = await prisma.integration.findFirst({
    where: {
      tenantId,
      provider: 'google-drive',
      status: 'connected',
    },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true,
      accountEmail: true,
      accountName: true,
    },
  });

  return integration as any;
}

/**
 * Get valid access token (refreshing if needed)
 */
export async function getValidAccessToken(tenantId: string): Promise<string> {
  const connection = await getGoogleDriveConnection(tenantId);
  
  if (!connection) {
    throw new Error('Google Drive not connected');
  }

  // Check if token is expired or expiring soon (within 5 minutes)
  const expiresIn = connection.tokenExpiresAt.getTime() - Date.now();
  
  if (expiresIn < 5 * 60 * 1000 && connection.refreshToken) {
    // Refresh the token
    const newTokens = await refreshGoogleDriveToken(connection.refreshToken);
    
    // Update in database
    await prisma.integration.update({
      where: { id: connection.id },
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        tokenExpiresAt: newTokens.expiresAt,
        updatedAt: new Date(),
      },
    });

    return newTokens.accessToken;
  }

  return connection.accessToken!;
}

/**
 * Disconnect Google Drive
 */
export async function disconnectGoogleDrive(tenantId: string): Promise<void> {
  await prisma.integration.updateMany({
    where: {
      tenantId,
      provider: 'google-drive',
    },
    data: {
      status: 'disconnected',
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      updatedAt: new Date(),
    },
  });
}
