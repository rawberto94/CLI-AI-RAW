/**
 * Template Cloud Sync Service
 * 
 * Provides functionality to sync templates to/from cloud storage providers:
 * - SharePoint
 * - OneDrive
 * - Google Drive
 */

import { prisma } from '@/lib/prisma';
import {
  generateWordDocument,
  generatePDFDocument,
  parseWordDocument,
  type ContractTemplate,
} from './document-service';

// Cloud provider types
export type CloudProvider = 'sharepoint' | 'onedrive' | 'google-drive';

// Sync direction
export type SyncDirection = 'upload' | 'download' | 'bidirectional';

// Sync status
export interface SyncStatus {
  templateId: string;
  provider: CloudProvider;
  status: 'pending' | 'syncing' | 'success' | 'error';
  lastSynced?: Date;
  remoteFileId?: string;
  remoteUrl?: string;
  error?: string;
}

// Sync options
export interface SyncOptions {
  provider: CloudProvider;
  format: 'docx' | 'pdf';
  folderId?: string;
  folderPath?: string;
  overwrite?: boolean;
  createFolder?: boolean;
}

// Sync result
export interface SyncResult {
  success: boolean;
  templateId: string;
  provider: CloudProvider;
  remoteFileId?: string;
  remoteUrl?: string;
  error?: string;
}

import { ContractSourceStatus } from '@prisma/client';

/**
 * Get Microsoft Graph API access token from stored credentials
 */
async function getMicrosoftAccessToken(tenantId: string): Promise<string | null> {
  const source = await prisma.contractSource.findFirst({
    where: {
      tenantId,
      provider: { in: ['SHAREPOINT', 'ONEDRIVE'] },
      status: ContractSourceStatus.CONNECTED,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!source?.credentials) {
    return null;
  }

  const credentials = source.credentials as Record<string, unknown>;
  return credentials.accessToken as string | null;
}

/**
 * Get Google Drive API access token from stored credentials
 */
async function getGoogleAccessToken(tenantId: string): Promise<string | null> {
  const source = await prisma.contractSource.findFirst({
    where: {
      tenantId,
      provider: 'GOOGLE_DRIVE',
      status: ContractSourceStatus.CONNECTED,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!source?.credentials) {
    return null;
  }

  const credentials = source.credentials as Record<string, unknown>;
  return credentials.accessToken as string | null;
}

/**
 * Upload template to SharePoint/OneDrive
 */
async function uploadToMicrosoft(
  template: ContractTemplate,
  accessToken: string,
  options: SyncOptions
): Promise<SyncResult> {
  const { format, folderId, folderPath } = options;

  try {
    // Generate document
    const buffer = format === 'pdf'
      ? await generatePDFDocument(template)
      : await generateWordDocument(template);

    const filename = `${template.name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '_')}.${format}`;
    const mimeType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Determine upload URL
    let uploadUrl: string;
    if (folderId) {
      uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${filename}:/content`;
    } else if (folderPath) {
      uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${filename}:/content`;
    } else {
      uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/Templates/${filename}:/content`;
    }

    // Upload file - convert Buffer to Uint8Array for fetch compatibility
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(buffer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      templateId: template.id,
      provider: options.provider,
      remoteFileId: result.id,
      remoteUrl: result.webUrl,
    };
  } catch (error) {
    return {
      success: false,
      templateId: template.id,
      provider: options.provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload template to Google Drive
 */
async function uploadToGoogleDrive(
  template: ContractTemplate,
  accessToken: string,
  options: SyncOptions
): Promise<SyncResult> {
  const { format, folderId } = options;

  try {
    // Generate document
    const buffer = format === 'pdf'
      ? await generatePDFDocument(template)
      : await generateWordDocument(template);

    const filename = `${template.name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '_')}.${format}`;
    const mimeType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Create file metadata
    const metadata = {
      name: filename,
      mimeType,
      parents: folderId ? [folderId] : undefined,
    };

    // Use multipart upload
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body = Buffer.concat([
      Buffer.from(
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n'
      ),
      Buffer.from(buffer.toString('base64')),
      Buffer.from(closeDelimiter),
    ]);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      templateId: template.id,
      provider: 'google-drive',
      remoteFileId: result.id,
      remoteUrl: `https://drive.google.com/file/d/${result.id}/view`,
    };
  } catch (error) {
    return {
      success: false,
      templateId: template.id,
      provider: 'google-drive',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download template from SharePoint/OneDrive
 */
async function downloadFromMicrosoft(
  fileId: string,
  accessToken: string
): Promise<Buffer | null> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[CloudSync] downloadFromMicrosoft failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Download template from Google Drive
 */
async function downloadFromGoogleDrive(
  fileId: string,
  accessToken: string
): Promise<Buffer | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[CloudSync] downloadFromGoogleDrive failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Sync template to cloud storage
 */
export async function syncTemplateToCloud(
  template: ContractTemplate,
  tenantId: string,
  options: SyncOptions
): Promise<SyncResult> {
  const { provider } = options;

  if (provider === 'sharepoint' || provider === 'onedrive') {
    const accessToken = await getMicrosoftAccessToken(tenantId);
    if (!accessToken) {
      return {
        success: false,
        templateId: template.id,
        provider,
        error: 'No Microsoft credentials found. Please connect SharePoint or OneDrive in Settings.',
      };
    }
    return uploadToMicrosoft(template, accessToken, options);
  } else if (provider === 'google-drive') {
    const accessToken = await getGoogleAccessToken(tenantId);
    if (!accessToken) {
      return {
        success: false,
        templateId: template.id,
        provider,
        error: 'No Google credentials found. Please connect Google Drive in Settings.',
      };
    }
    return uploadToGoogleDrive(template, accessToken, options);
  }

  return {
    success: false,
    templateId: template.id,
    provider,
    error: 'Unsupported cloud provider',
  };
}

/**
 * Import template from cloud storage
 */
export async function importTemplateFromCloud(
  fileId: string,
  filename: string,
  tenantId: string,
  provider: CloudProvider
): Promise<{ success: boolean; template?: Partial<ContractTemplate>; error?: string }> {
  let buffer: Buffer | null = null;

  if (provider === 'sharepoint' || provider === 'onedrive') {
    const accessToken = await getMicrosoftAccessToken(tenantId);
    if (!accessToken) {
      return {
        success: false,
        error: 'No Microsoft credentials found',
      };
    }
    buffer = await downloadFromMicrosoft(fileId, accessToken);
  } else if (provider === 'google-drive') {
    const accessToken = await getGoogleAccessToken(tenantId);
    if (!accessToken) {
      return {
        success: false,
        error: 'No Google credentials found',
      };
    }
    buffer = await downloadFromGoogleDrive(fileId, accessToken);
  }

  if (!buffer) {
    return {
      success: false,
      error: 'Failed to download file from cloud storage',
    };
  }

  // Parse the document
  const result = await parseWordDocument(buffer, filename);
  
  return {
    success: result.success,
    template: result.template,
    error: result.errors?.join(', '),
  };
}

/**
 * List files from cloud storage folder
 */
export async function listCloudFiles(
  tenantId: string,
  provider: CloudProvider,
  folderId?: string
): Promise<{ success: boolean; files?: Array<{ id: string; name: string; size: number; modifiedTime: string }>; error?: string }> {
  if (provider === 'sharepoint' || provider === 'onedrive') {
    const accessToken = await getMicrosoftAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No Microsoft credentials found' };
    }

    try {
      const url = folderId
        ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`
        : 'https://graph.microsoft.com/v1.0/me/drive/root/children';

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        return { success: false, error: 'Failed to list files' };
      }

      const data = await response.json();
      const files = data.value
        .filter((item: Record<string, unknown>) => item.file && (item.name as string).match(/\.(docx?|doc)$/i))
        .map((item: Record<string, unknown>) => ({
          id: item.id,
          name: item.name,
          size: item.size,
          modifiedTime: item.lastModifiedDateTime,
        }));

      return { success: true, files };
    } catch {
      return { success: false, error: 'Failed to list files' };
    }
  } else if (provider === 'google-drive') {
    const accessToken = await getGoogleAccessToken(tenantId);
    if (!accessToken) {
      return { success: false, error: 'No Google credentials found' };
    }

    try {
      const query = folderId
        ? `'${folderId}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/msword')`
        : `(mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/msword')`;

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime)`,
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        return { success: false, error: 'Failed to list files' };
      }

      const data = await response.json();
      return {
        success: true,
        files: data.files.map((f: Record<string, unknown>) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          modifiedTime: f.modifiedTime,
        })),
      };
    } catch {
      return { success: false, error: 'Failed to list files' };
    }
  }

  return { success: false, error: 'Unsupported provider' };
}

/**
 * Check if cloud provider is connected
 */
export async function isCloudProviderConnected(
  tenantId: string,
  provider: CloudProvider
): Promise<boolean> {
  if (provider === 'sharepoint' || provider === 'onedrive') {
    const token = await getMicrosoftAccessToken(tenantId);
    return !!token;
  } else if (provider === 'google-drive') {
    const token = await getGoogleAccessToken(tenantId);
    return !!token;
  }
  return false;
}

/**
 * Get available cloud providers for a tenant
 */
export async function getAvailableCloudProviders(tenantId: string): Promise<CloudProvider[]> {
  const providers: CloudProvider[] = [];

  const sources = await prisma.contractSource.findMany({
    where: {
      tenantId,
      status: ContractSourceStatus.CONNECTED,
      provider: { in: ['SHAREPOINT', 'ONEDRIVE', 'GOOGLE_DRIVE'] },
    },
    select: { provider: true },
  });

  for (const source of sources) {
    if (source.provider === 'SHAREPOINT') providers.push('sharepoint');
    if (source.provider === 'ONEDRIVE') providers.push('onedrive');
    if (source.provider === 'GOOGLE_DRIVE') providers.push('google-drive');
  }

  return [...new Set(providers)];
}
