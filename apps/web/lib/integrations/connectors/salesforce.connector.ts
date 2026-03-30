/**
 * Salesforce Connector
 * 
 * Integrates with Salesforce REST API for syncing contract-related
 * objects (Contracts, Opportunities, Accounts, Attachments).
 * Uses OAuth 2.0 Web Server Flow for authentication.
 */

import { ContractSourceProvider } from '@prisma/client';
import {
  IContractSourceConnector,
  IOAuthConnector,
  ConnectionTestResult,
  ListFilesResult,
  DownloadedFile,
  RemoteFile,
  OAuthTokens,
  SalesforceCredentials,
} from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const SALESFORCE_AUTH_BASE = 'https://login.salesforce.com';
const SALESFORCE_AUTH_URL = `${SALESFORCE_AUTH_BASE}/services/oauth2/authorize`;
const SALESFORCE_TOKEN_URL = `${SALESFORCE_AUTH_BASE}/services/oauth2/token`;
const SALESFORCE_API_VERSION = 'v59.0';

// ── Types ────────────────────────────────────────────────────────────────────

// Re-export for external use
export type { SalesforceCredentials } from './types';

interface SalesforceQueryResult {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: SalesforceRecord[];
}

interface SalesforceRecord {
  Id: string;
  Name?: string;
  Title?: string;
  ContentType?: string;
  BodyLength?: number;
  CreatedDate: string;
  LastModifiedDate: string;
  [key: string]: unknown;
}

// ── Connector ────────────────────────────────────────────────────────────────

export class SalesforceConnector implements IContractSourceConnector, IOAuthConnector {
  readonly provider = ContractSourceProvider.SALESFORCE;

  private credentials: SalesforceCredentials;
  private accessToken?: string;
  private instanceUrl?: string;
  private tokenExpiresAt?: Date;

  constructor(credentials: SalesforceCredentials) {
    this.credentials = credentials;
    this.accessToken = credentials.accessToken;
    this.instanceUrl = credentials.instanceUrl;
    this.tokenExpiresAt = credentials.tokenExpiresAt
      ? new Date(credentials.tokenExpiresAt)
      : undefined;
  }

  // ── OAuth ────────────────────────────────────────────────────────────────

  getAuthorizationUrl(state?: string): string {
    const clientId = this.credentials.clientId || process.env.SALESFORCE_CLIENT_ID || '';
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/callback/salesforce`;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'full refresh_token',
      ...(state ? { state } : {}),
    });

    return `${SALESFORCE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const clientId = this.credentials.clientId || process.env.SALESFORCE_CLIENT_ID || '';
    const clientSecret = this.credentials.clientSecret || process.env.SALESFORCE_CLIENT_SECRET || '';
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/callback/salesforce`;

    const response = await fetch(SALESFORCE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Salesforce token exchange failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;
    this.accessToken = data.access_token as string;
    this.instanceUrl = data.instance_url as string;

    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string | undefined,
      expiresAt: new Date(Date.now() + 7200 * 1000), // Salesforce tokens ~2h
      scope: data.scope as string | undefined,
      tokenType: (data.token_type as string) || 'Bearer',
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.credentials.clientId || process.env.SALESFORCE_CLIENT_ID || '';
    const clientSecret = this.credentials.clientSecret || process.env.SALESFORCE_CLIENT_SECRET || '';

    const response = await fetch(SALESFORCE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Salesforce token refresh failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;
    this.accessToken = data.access_token as string;
    this.instanceUrl = data.instance_url as string;

    return {
      accessToken: data.access_token as string,
      refreshToken: refreshToken, // Salesforce reuses same refresh token
      expiresAt: new Date(Date.now() + 7200 * 1000),
      tokenType: (data.token_type as string) || 'Bearer',
    };
  }

  isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    const bufferMs = 5 * 60 * 1000;
    return this.tokenExpiresAt.getTime() - bufferMs < Date.now();
  }

  // ── Connector Methods ────────────────────────────────────────────────────

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.ensureValidToken();
      const userInfo = await this.apiGet('/services/oauth2/userinfo');

      return {
        connected: true,
        accountInfo: {
          email: userInfo.email as string,
          name: (userInfo.name as string) || (userInfo.preferred_username as string) || '',
          id: (userInfo.user_id as string) || (userInfo.sub as string) || '',
        },
        capabilities: {
          deltaSync: false,
          folderListing: true,
          fileDownload: true,
          fileMetadata: true,
        },
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async listFiles(
    _folderId?: string,
    options?: { pageToken?: string; pageSize?: number; filePatterns?: string[] }
  ): Promise<ListFilesResult> {
    await this.ensureValidToken();

    const limit = options?.pageSize || 50;
    const offset = options?.pageToken ? parseInt(options.pageToken, 10) : 0;

    // Query ContentDocument (Salesforce's file system) for contract-related documents
    const soql = `SELECT Id, Title, FileType, ContentSize, CreatedDate, LastModifiedDate, FileExtension 
      FROM ContentDocument 
      WHERE FileExtension IN ('pdf', 'docx', 'doc', 'xlsx')
      ORDER BY LastModifiedDate DESC 
      LIMIT ${limit} OFFSET ${offset}`;

    const result = await this.soqlQuery(soql);

    const files: RemoteFile[] = result.records.map((record) => ({
      id: record.Id,
      name: `${record.Title || record.Id}.${record.FileExtension || 'pdf'}`,
      mimeType: this.getMimeType(record.FileExtension as string || 'pdf'),
      size: (record.ContentSize as number) || 0,
      createdAt: new Date(record.CreatedDate),
      modifiedAt: new Date(record.LastModifiedDate),
      path: `/ContentDocument/${record.Id}`,
      isFolder: false,
    }));

    const nextOffset = offset + limit;
    const hasMore = !result.done || result.records.length === limit;

    return {
      files,
      nextPageToken: hasMore ? String(nextOffset) : undefined,
      hasMore,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    await this.ensureValidToken();

    // Get the latest ContentVersion for this ContentDocument
    const versionResult = await this.soqlQuery(
      `SELECT Id, Title, FileExtension, VersionData FROM ContentVersion WHERE ContentDocumentId = '${this.sanitizeId(fileId)}' AND IsLatest = true LIMIT 1`
    );

    if (versionResult.records.length === 0) {
      throw new Error(`No content version found for document ${fileId}`);
    }

    const version = versionResult.records[0];
    const versionDataUrl = `/services/data/${SALESFORCE_API_VERSION}/sobjects/ContentVersion/${version.Id}/VersionData`;

    const response = await fetch(`${this.instanceUrl}${versionDataUrl}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = version.FileExtension as string || 'pdf';
    const filename = `${version.Title || fileId}.${ext}`;

    return {
      content: buffer,
      mimeType: this.getMimeType(ext),
      filename,
    };
  }

  async getFileMetadata(fileId: string): Promise<RemoteFile> {
    await this.ensureValidToken();

    const result = await this.soqlQuery(
      `SELECT Id, Title, FileType, ContentSize, CreatedDate, LastModifiedDate, FileExtension FROM ContentDocument WHERE Id = '${this.sanitizeId(fileId)}' LIMIT 1`
    );

    if (result.records.length === 0) {
      throw new Error(`Document not found: ${fileId}`);
    }

    const record = result.records[0];
    return {
      id: record.Id,
      name: `${record.Title || record.Id}.${record.FileExtension || 'pdf'}`,
      mimeType: this.getMimeType(record.FileExtension as string || 'pdf'),
      size: (record.ContentSize as number) || 0,
      createdAt: new Date(record.CreatedDate),
      modifiedAt: new Date(record.LastModifiedDate),
      path: `/ContentDocument/${record.Id}`,
      isFolder: false,
    };
  }

  supportsDeltaSync(): boolean {
    return false;
  }

  async disconnect(): Promise<void> {
    if (this.accessToken && this.instanceUrl) {
      try {
        await fetch(`${this.instanceUrl}/services/oauth2/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: this.accessToken }),
        });
      } catch {
        // Best-effort revocation
      }
    }
    this.accessToken = undefined;
    this.instanceUrl = undefined;
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please connect to Salesforce first.');
    }

    if (this.isTokenExpired() && this.credentials.refreshToken) {
      const tokens = await this.refreshAccessToken(this.credentials.refreshToken);
      this.accessToken = tokens.accessToken;
      this.tokenExpiresAt = tokens.expiresAt;
    }
  }

  private async apiGet(path: string): Promise<Record<string, unknown>> {
    const url = path.startsWith('http')
      ? path
      : `${this.instanceUrl}${path}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async soqlQuery(soql: string): Promise<SalesforceQueryResult> {
    const encoded = encodeURIComponent(soql);
    const result = await this.apiGet(
      `/services/data/${SALESFORCE_API_VERSION}/query?q=${encoded}`
    );
    return result as unknown as SalesforceQueryResult;
  }

  /** Sanitize a Salesforce ID to prevent SOQL injection */
  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '');
  }

  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
    };
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }
}

export function createSalesforceConnector(credentials: SalesforceCredentials): SalesforceConnector {
  return new SalesforceConnector(credentials);
}
