/**
 * Slack Connector
 * 
 * Interactive Slack integration for contract notifications, approval workflows,
 * and file sync from Slack channels. Uses Slack Web API with OAuth 2.0.
 * 
 * Goes beyond simple webhooks — supports:
 * - OAuth 2.0 bot token authentication
 * - Posting interactive approval messages with action buttons
 * - Listing & downloading files shared in Slack channels
 * - Channel-based contract notifications with threads
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
  SlackCredentials,
} from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_API_BASE = 'https://slack.com/api';

const SLACK_BOT_SCOPES = [
  'channels:read',
  'channels:history',
  'chat:write',
  'files:read',
  'files:write',
  'groups:read',
  'groups:history',
  'users:read',
].join(',');

// ── Types ────────────────────────────────────────────────────────────────────

// Re-export for external use
export type { SlackCredentials } from './types';

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

interface SlackFile {
  id: string;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  size: number;
  created: number;
  timestamp: number;
  url_private_download?: string;
  url_private?: string;
  channels?: string[];
}

// ── Connector ────────────────────────────────────────────────────────────────

export class SlackConnector implements IContractSourceConnector, IOAuthConnector {
  readonly provider = ContractSourceProvider.SLACK;

  private credentials: SlackCredentials;
  private botToken?: string;
  private tokenExpiresAt?: Date;

  constructor(credentials: SlackCredentials) {
    this.credentials = credentials;
    this.botToken = credentials.botToken;
    this.tokenExpiresAt = credentials.tokenExpiresAt
      ? new Date(credentials.tokenExpiresAt)
      : undefined;
  }

  // ── OAuth ────────────────────────────────────────────────────────────────

  getAuthorizationUrl(state?: string): string {
    const clientId = this.credentials.clientId || process.env.SLACK_CLIENT_ID || '';
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/callback/slack`;

    const params = new URLSearchParams({
      client_id: clientId,
      scope: SLACK_BOT_SCOPES,
      redirect_uri: redirectUri,
      ...(state ? { state } : {}),
    });

    return `${SLACK_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const clientId = this.credentials.clientId || process.env.SLACK_CLIENT_ID || '';
    const clientSecret = this.credentials.clientSecret || process.env.SLACK_CLIENT_SECRET || '';
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/callback/slack`;

    const response = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack token exchange failed: ${response.status}`);
    }

    const data = await response.json() as SlackApiResponse;
    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    const accessToken = (data.access_token as string) || '';
    const team = data.team as { id: string; name: string } | undefined;
    this.botToken = accessToken;

    return {
      accessToken,
      refreshToken: data.refresh_token as string | undefined,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Slack tokens don't expire by default
      scope: data.scope as string | undefined,
      tokenType: data.token_type as string || 'bot',
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = this.credentials.clientId || process.env.SLACK_CLIENT_ID || '';
    const clientSecret = this.credentials.clientSecret || process.env.SLACK_CLIENT_SECRET || '';

    const response = await fetch(SLACK_TOKEN_URL, {
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
      throw new Error(`Slack token refresh failed: ${response.status}`);
    }

    const data = await response.json() as SlackApiResponse;
    if (!data.ok) {
      throw new Error(`Slack refresh error: ${data.error}`);
    }

    this.botToken = data.access_token as string;

    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) || refreshToken,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      tokenType: 'bot',
    };
  }

  isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return false; // Slack tokens generally don't expire
    return this.tokenExpiresAt.getTime() < Date.now();
  }

  // ── Connector Methods ────────────────────────────────────────────────────

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      this.ensureToken();
      const authTest = await this.apiCall('auth.test');

      return {
        connected: true,
        accountInfo: {
          email: '', // auth.test doesn't return email
          name: (authTest.user as string) || 'Slack Bot',
          id: (authTest.user_id as string) || '',
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
    channelId?: string,
    options?: { pageToken?: string; pageSize?: number; filePatterns?: string[] }
  ): Promise<ListFilesResult> {
    this.ensureToken();

    const params: Record<string, string> = {
      count: String(options?.pageSize || 50),
      types: 'pdfs,docs',
    };

    if (channelId) params.channel = channelId;
    if (options?.pageToken) params.page = options.pageToken;

    const result = await this.apiCall('files.list', params);
    const slackFiles = (result.files as SlackFile[]) || [];

    const files: RemoteFile[] = slackFiles.map((f) => ({
      id: f.id,
      name: f.name || f.title || f.id,
      mimeType: f.mimetype || 'application/octet-stream',
      size: f.size || 0,
      createdAt: new Date(f.created * 1000),
      modifiedAt: new Date(f.timestamp * 1000),
      path: channelId ? `/${channelId}/${f.id}` : `/${f.id}`,
      isFolder: false,
    }));

    const paging = result.paging as { page: number; pages: number } | undefined;
    const currentPage = paging?.page || 1;
    const totalPages = paging?.pages || 1;
    const hasMore = currentPage < totalPages;

    return {
      files,
      nextPageToken: hasMore ? String(currentPage + 1) : undefined,
      hasMore,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    this.ensureToken();

    // Get file info first
    const result = await this.apiCall('files.info', { file: fileId });
    const file = result.file as SlackFile;
    if (!file) throw new Error(`File not found: ${fileId}`);

    const downloadUrl = file.url_private_download || file.url_private;
    if (!downloadUrl) throw new Error('No download URL available');

    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${this.botToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      content: buffer,
      mimeType: file.mimetype || 'application/octet-stream',
      filename: file.name || file.title || `${fileId}.pdf`,
    };
  }

  async getFileMetadata(fileId: string): Promise<RemoteFile> {
    this.ensureToken();

    const result = await this.apiCall('files.info', { file: fileId });
    const file = result.file as SlackFile;
    if (!file) throw new Error(`File not found: ${fileId}`);

    return {
      id: file.id,
      name: file.name || file.title || file.id,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size || 0,
      createdAt: new Date(file.created * 1000),
      modifiedAt: new Date(file.timestamp * 1000),
      path: `/${file.id}`,
      isFolder: false,
    };
  }

  supportsDeltaSync(): boolean {
    return false;
  }

  async disconnect(): Promise<void> {
    // Revoke the token
    if (this.botToken) {
      try {
        await this.apiCall('auth.revoke');
      } catch {
        // Best-effort
      }
    }
    this.botToken = undefined;
  }

  // ── Messaging Methods (Slack-specific) ───────────────────────────────────

  /**
   * Post a contract notification to a Slack channel
   */
  async postContractNotification(channelId: string, notification: {
    title: string;
    contractId: string;
    action: string;
    details?: string;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<{ ts: string; channel: string }> {
    this.ensureToken();

    const urgencyEmoji: Record<string, string> = {
      low: ':large_blue_circle:',
      medium: ':large_yellow_circle:',
      high: ':large_orange_circle:',
      critical: ':red_circle:',
    };

    const emoji = urgencyEmoji[notification.urgency || 'low'];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    const result = await this.apiCall('chat.postMessage', {
      channel: channelId,
      text: `${emoji} ${notification.action}: ${notification.title}`,
      blocks: JSON.stringify([
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${emoji} *${notification.action}*\n>*Contract:* ${notification.title}${notification.details ? `\n>${notification.details}` : ''}`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Contract' },
              url: `${appUrl}/contracts/${encodeURIComponent(notification.contractId)}`,
              style: 'primary',
            },
          ],
        },
      ]),
    });

    return {
      ts: result.ts as string,
      channel: result.channel as string,
    };
  }

  /**
   * Post an approval request with interactive buttons
   */
  async postApprovalRequest(channelId: string, request: {
    contractTitle: string;
    contractId: string;
    requestedBy: string;
    description?: string;
    approvalId: string;
  }): Promise<{ ts: string; channel: string }> {
    this.ensureToken();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    const result = await this.apiCall('chat.postMessage', {
      channel: channelId,
      text: `:memo: Approval Required: ${request.contractTitle}`,
      blocks: JSON.stringify([
        {
          type: 'header',
          text: { type: 'plain_text', text: ':memo: Contract Approval Required' },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Contract:*\n${request.contractTitle}` },
            { type: 'mrkdwn', text: `*Requested by:*\n${request.requestedBy}` },
          ],
        },
        ...(request.description ? [{
          type: 'section' as const,
          text: { type: 'mrkdwn' as const, text: `*Details:*\n${request.description}` },
        }] : []),
        {
          type: 'actions',
          block_id: `approval_${request.approvalId}`,
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: ':white_check_mark: Approve' },
              style: 'primary',
              action_id: 'approve_contract',
              value: request.approvalId,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: ':x: Reject' },
              style: 'danger',
              action_id: 'reject_contract',
              value: request.approvalId,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View in ConTiGo' },
              url: `${appUrl}/contracts/${encodeURIComponent(request.contractId)}`,
              action_id: 'view_contract',
            },
          ],
        },
      ]),
    });

    return {
      ts: result.ts as string,
      channel: result.channel as string,
    };
  }

  /**
   * Reply in a thread (e.g. for contract discussion)
   */
  async postThreadReply(channelId: string, threadTs: string, message: string): Promise<void> {
    this.ensureToken();

    await this.apiCall('chat.postMessage', {
      channel: channelId,
      thread_ts: threadTs,
      text: message,
    });
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private ensureToken(): void {
    if (!this.botToken) {
      throw new Error('Not authenticated. Please connect to Slack first.');
    }
  }

  private async apiCall(method: string, params?: Record<string, string>): Promise<SlackApiResponse> {
    const url = `${SLACK_API_BASE}/${method}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params ? new URLSearchParams(params) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as SlackApiResponse;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  }
}

export function createSlackConnector(credentials: SlackCredentials): SlackConnector {
  return new SlackConnector(credentials);
}
