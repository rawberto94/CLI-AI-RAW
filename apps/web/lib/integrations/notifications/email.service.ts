/**
 * Email Notification Service for Contract Sync
 * 
 * Sends email notifications for sync events (failures, completions, reports).
 * Supports multiple email providers (SMTP, SendGrid, AWS SES).
 */

// Note: nodemailer is optional - install with `npm install nodemailer @types/nodemailer` if needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nodemailer: any;
try {
  // Dynamic import to avoid build errors if not installed
  nodemailer = require("nodemailer");
} catch {
  console.warn("[EmailService] nodemailer not installed, email notifications disabled");
}

import { ContractSource } from "@prisma/client";
import { format } from "date-fns";

// Define our own SyncLog type since ContractSyncLog may not exist in schema
interface SyncLog {
  id: string;
  startedAt: Date;
  errorMessage?: string | null;
  filesProcessed?: number;
}

export interface EmailConfig {
  provider: "smtp" | "sendgrid" | "ses";
  from: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  sendgridApiKey?: string;
  sesRegion?: string;
}

export interface NotificationRecipient {
  email: string;
  name?: string;
}

export interface SyncFailureNotification {
  source: Pick<ContractSource, "id" | "name" | "provider">;
  syncLog: Pick<SyncLog, "id" | "startedAt" | "errorMessage" | "filesProcessed">;
  retryCount: number;
  maxRetries: number;
}

export interface SyncSummaryNotification {
  tenantName: string;
  period: "daily" | "weekly";
  stats: {
    totalSyncs: number;
    successful: number;
    failed: number;
    filesProcessed: number;
    newContracts: number;
    averageDuration: number;
  };
  topSources: { name: string; filesProcessed: number }[];
  failedSources: { name: string; errorCount: number; lastError?: string }[];
}

export class EmailNotificationService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transporter: any = null;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    if (!nodemailer) {
      console.warn("[EmailService] nodemailer not available, skipping transporter initialization");
      return;
    }
    
    if (this.config.provider === "smtp" && this.config.smtp) {
      this.transporter = nodemailer.createTransport({
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: this.config.smtp.secure,
        auth: this.config.smtp.auth,
      });
    } else if (this.config.provider === "sendgrid" && this.config.sendgridApiKey) {
      this.transporter = nodemailer.createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        auth: {
          user: "apikey",
          pass: this.config.sendgridApiKey,
        },
      });
    } else if (this.config.provider === "ses") {
      // AWS SES transport via nodemailer-ses
      const aws = require("@aws-sdk/client-ses");
      const sesClient = new aws.SESClient({ region: this.config.sesRegion || "us-east-1" });
      this.transporter = nodemailer.createTransport({
        SES: { ses: sesClient, aws },
      });
    }
  }

  /**
   * Send sync failure notification
   */
  async sendSyncFailureAlert(
    recipients: NotificationRecipient[],
    notification: SyncFailureNotification
  ): Promise<void> {
    if (!this.transporter) {
      console.error("[Email] Transporter not configured");
      return;
    }

    const subject = `⚠️ Contract Sync Failed: ${notification.source.name}`;
    const html = this.generateFailureEmailHtml(notification);
    const text = this.generateFailureEmailText(notification);

    for (const recipient of recipients) {
      try {
        await this.transporter.sendMail({
          from: this.config.from,
          to: recipient.email,
          subject,
          text,
          html,
        });
        console.log(`[Email] Sent failure alert to ${recipient.email}`);
      } catch (error) {
        console.error(`[Email] Failed to send to ${recipient.email}:`, error);
      }
    }
  }

  /**
   * Send sync summary report
   */
  async sendSyncSummary(
    recipients: NotificationRecipient[],
    notification: SyncSummaryNotification
  ): Promise<void> {
    if (!this.transporter) {
      console.error("[Email] Transporter not configured");
      return;
    }

    const periodLabel = notification.period === "daily" ? "Daily" : "Weekly";
    const subject = `📊 ${periodLabel} Contract Sync Report - ${notification.tenantName}`;
    const html = this.generateSummaryEmailHtml(notification);
    const text = this.generateSummaryEmailText(notification);

    for (const recipient of recipients) {
      try {
        await this.transporter.sendMail({
          from: this.config.from,
          to: recipient.email,
          subject,
          text,
          html,
        });
        console.log(`[Email] Sent summary report to ${recipient.email}`);
      } catch (error) {
        console.error(`[Email] Failed to send to ${recipient.email}:`, error);
      }
    }
  }

  /**
   * Send connection restored notification
   */
  async sendConnectionRestored(
    recipients: NotificationRecipient[],
    sourceName: string,
    provider: string
  ): Promise<void> {
    if (!this.transporter) {
      return;
    }

    const subject = `✅ Connection Restored: ${sourceName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background: #22c55e; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; margin: -24px -24px 24px; }
          .success-icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h2 style="margin: 0;">Connection Restored</h2>
            </div>
            <div class="success-icon">✅</div>
            <p>Great news! The connection to <strong>${sourceName}</strong> (${provider}) has been restored and sync operations will resume normally.</p>
            <p style="color: #666; font-size: 14px;">No action is required on your part.</p>
          </div>
          <div class="footer">
            <p>Contract Source Integration System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    for (const recipient of recipients) {
      try {
        await this.transporter.sendMail({
          from: this.config.from,
          to: recipient.email,
          subject,
          html,
          text: `Connection to ${sourceName} (${provider}) has been restored. Sync operations will resume normally.`,
        });
      } catch (error) {
        console.error(`[Email] Failed to send to ${recipient.email}:`, error);
      }
    }
  }

  private generateFailureEmailHtml(notification: SyncFailureNotification): string {
    const { source, syncLog, retryCount, maxRetries } = notification;
    const startTime = format(new Date(syncLog.startedAt), "PPpp");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background: #ef4444; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; margin: -24px -24px 24px; }
          .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: 600; width: 140px; color: #666; }
          .detail-value { flex: 1; }
          .error-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 16px; margin-top: 16px; }
          .error-message { font-family: monospace; font-size: 13px; color: #991b1b; white-space: pre-wrap; }
          .retry-info { background: #fef3c7; border-radius: 4px; padding: 12px; margin-top: 16px; color: #92400e; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h2 style="margin: 0;">⚠️ Sync Failed</h2>
            </div>
            
            <p>A contract source sync operation has failed and requires attention.</p>
            
            <div class="detail-row">
              <span class="detail-label">Source</span>
              <span class="detail-value"><strong>${source.name}</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Provider</span>
              <span class="detail-value">${source.provider}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Started At</span>
              <span class="detail-value">${startTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Files Processed</span>
              <span class="detail-value">${syncLog.filesProcessed}</span>
            </div>
            
            <div class="error-box">
              <strong>Error Details:</strong>
              <div class="error-message">${syncLog.errorMessage || "Unknown error"}</div>
            </div>
            
            ${retryCount < maxRetries ? `
              <div class="retry-info">
                <strong>Automatic Retry:</strong> Attempt ${retryCount + 1} of ${maxRetries} scheduled.
              </div>
            ` : `
              <div class="retry-info" style="background: #fee2e2; color: #991b1b;">
                <strong>Max Retries Reached:</strong> Manual intervention may be required.
              </div>
            `}
            
            <a href="${process.env.NEXTAUTH_URL}/settings/contract-sources/${source.id}" class="button">
              View Source Details →
            </a>
          </div>
          
          <div class="footer">
            <p>Contract Source Integration System</p>
            <p style="font-size: 11px;">You're receiving this because you're an admin for this organization.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateFailureEmailText(notification: SyncFailureNotification): string {
    const { source, syncLog, retryCount, maxRetries } = notification;
    const startTime = format(new Date(syncLog.startedAt), "PPpp");

    return `
CONTRACT SYNC FAILED

Source: ${source.name}
Provider: ${source.provider}
Started At: ${startTime}
Files Processed: ${syncLog.filesProcessed}

Error Details:
${syncLog.errorMessage || "Unknown error"}

${retryCount < maxRetries 
  ? `Automatic retry ${retryCount + 1} of ${maxRetries} scheduled.`
  : `Max retries reached. Manual intervention may be required.`}

View source: ${process.env.NEXTAUTH_URL}/settings/contract-sources/${source.id}
    `.trim();
  }

  private generateSummaryEmailHtml(notification: SyncSummaryNotification): string {
    const { tenantName, period, stats, topSources, failedSources } = notification;
    const periodLabel = period === "daily" ? "Daily" : "Weekly";
    const successRate = stats.totalSyncs > 0 
      ? ((stats.successful / stats.totalSyncs) * 100).toFixed(1)
      : "100";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 16px; }
          .header { background: #3b82f6; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; margin: -24px -24px 24px; }
          .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
          .stat-box { text-align: center; padding: 16px; background: #f8fafc; border-radius: 8px; }
          .stat-value { font-size: 24px; font-weight: bold; color: #1e293b; }
          .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
          .success { color: #22c55e; }
          .warning { color: #f59e0b; }
          .danger { color: #ef4444; }
          .section-title { font-size: 14px; font-weight: 600; color: #64748b; margin: 24px 0 12px; text-transform: uppercase; }
          .list-item { display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid #f1f5f9; }
          .list-item:last-child { border-bottom: none; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h2 style="margin: 0;">📊 ${periodLabel} Sync Report</h2>
              <p style="margin: 8px 0 0; opacity: 0.9;">${tenantName}</p>
            </div>
            
            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-value">${stats.totalSyncs}</div>
                <div class="stat-label">Total Syncs</div>
              </div>
              <div class="stat-box">
                <div class="stat-value success">${stats.successful}</div>
                <div class="stat-label">Successful</div>
              </div>
              <div class="stat-box">
                <div class="stat-value ${stats.failed > 0 ? 'danger' : ''}">${stats.failed}</div>
                <div class="stat-label">Failed</div>
              </div>
            </div>
            
            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-value">${stats.filesProcessed.toLocaleString()}</div>
                <div class="stat-label">Files Processed</div>
              </div>
              <div class="stat-box">
                <div class="stat-value success">${stats.newContracts}</div>
                <div class="stat-label">New Contracts</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">${successRate}%</div>
                <div class="stat-label">Success Rate</div>
              </div>
            </div>
            
            ${topSources.length > 0 ? `
              <div class="section-title">Top Performing Sources</div>
              ${topSources.map(s => `
                <div class="list-item">
                  <span>${s.name}</span>
                  <span class="success">${s.filesProcessed} files</span>
                </div>
              `).join('')}
            ` : ''}
            
            ${failedSources.length > 0 ? `
              <div class="section-title">Sources with Issues</div>
              ${failedSources.map(s => `
                <div class="list-item">
                  <span>${s.name}</span>
                  <span class="danger">${s.errorCount} errors</span>
                </div>
              `).join('')}
            ` : ''}
            
            <div style="text-align: center; margin-top: 24px;">
              <a href="${process.env.NEXTAUTH_URL}/settings/contract-sources" class="button">
                View All Sources →
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>Contract Source Integration System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateSummaryEmailText(notification: SyncSummaryNotification): string {
    const { tenantName, period, stats, topSources, failedSources } = notification;
    const periodLabel = period === "daily" ? "Daily" : "Weekly";
    const successRate = stats.totalSyncs > 0 
      ? ((stats.successful / stats.totalSyncs) * 100).toFixed(1)
      : "100";

    return `
${periodLabel.toUpperCase()} SYNC REPORT - ${tenantName}

SUMMARY
Total Syncs: ${stats.totalSyncs}
Successful: ${stats.successful}
Failed: ${stats.failed}
Files Processed: ${stats.filesProcessed.toLocaleString()}
New Contracts: ${stats.newContracts}
Success Rate: ${successRate}%

${topSources.length > 0 ? `TOP SOURCES\n${topSources.map(s => `- ${s.name}: ${s.filesProcessed} files`).join('\n')}` : ''}

${failedSources.length > 0 ? `SOURCES WITH ISSUES\n${failedSources.map(s => `- ${s.name}: ${s.errorCount} errors`).join('\n')}` : ''}

View all sources: ${process.env.NEXTAUTH_URL}/settings/contract-sources
    `.trim();
  }
}

/**
 * Create email notification service from environment variables
 */
export function createEmailService(): EmailNotificationService | null {
  const provider = process.env.EMAIL_PROVIDER as "smtp" | "sendgrid" | "ses" | undefined;
  const from = process.env.EMAIL_FROM;

  if (!provider || !from) {
    console.warn("[Email] Email service not configured");
    return null;
  }

  const config: EmailConfig = {
    provider,
    from,
  };

  if (provider === "smtp") {
    config.smtp = {
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    };
  } else if (provider === "sendgrid") {
    config.sendgridApiKey = process.env.SENDGRID_API_KEY;
  } else if (provider === "ses") {
    config.sesRegion = process.env.AWS_SES_REGION || process.env.AWS_REGION;
  }

  return new EmailNotificationService(config);
}

export default EmailNotificationService;
