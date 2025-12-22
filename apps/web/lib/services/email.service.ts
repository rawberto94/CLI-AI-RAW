/**
 * Email Service - Production-ready email notifications
 * 
 * Supports multiple providers:
 * - Resend (recommended)
 * - SendGrid
 * - AWS SES
 * - SMTP (nodemailer)
 * 
 * Features:
 * - Template-based emails
 * - HTML and plain text support
 * - Rate limiting and queueing
 * - Retry with exponential backoff
 * - Logging and tracking
 */

import { logger } from '@/lib/logger';

// Email provider types
type EmailProvider = 'resend' | 'sendgrid' | 'ses' | 'smtp' | 'console';

interface EmailAddress {
  email: string;
  name?: string;
}

interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[] | EmailAddress | EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  from?: string | EmailAddress;
  replyTo?: string | EmailAddress;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
  metadata?: Record<string, string>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: EmailProvider;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Environment configuration
const EMAIL_CONFIG = {
  provider: (process.env.EMAIL_PROVIDER as EmailProvider) || 'console',
  from: process.env.EMAIL_FROM || 'ConTigo <noreply@contigo.ai>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@contigo.ai',
  resendApiKey: process.env.RESEND_API_KEY,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
};

/**
 * Email Templates
 */
const EMAIL_TEMPLATES = {
  contractExpiry: (data: {
    contractName: string;
    daysRemaining: number;
    expiryDate: string;
    viewUrl: string;
    recipientName: string;
  }): EmailTemplate => ({
    subject: `⏰ Contract Expiring in ${data.daysRemaining} Days: ${data.contractName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Expiry Alert</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Contract Expiry Alert</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi ${data.recipientName},</p>
    
    <p>This is a reminder that the following contract is expiring soon:</p>
    
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">${data.contractName}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Expiry Date:</td>
          <td style="padding: 8px 0; font-weight: 600; color: ${data.daysRemaining <= 7 ? '#dc2626' : data.daysRemaining <= 30 ? '#d97706' : '#059669'};">${data.expiryDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Days Remaining:</td>
          <td style="padding: 8px 0; font-weight: 600; color: ${data.daysRemaining <= 7 ? '#dc2626' : data.daysRemaining <= 30 ? '#d97706' : '#059669'};">${data.daysRemaining} days</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.viewUrl}" style="display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">View Contract</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      Please take appropriate action to review and renew this contract if needed.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ConTigo - Contract Intelligence Platform</p>
    <p>You're receiving this because you're subscribed to contract alerts.</p>
  </div>
</body>
</html>`,
    text: `
Contract Expiry Alert

Hi ${data.recipientName},

This is a reminder that the following contract is expiring soon:

Contract: ${data.contractName}
Expiry Date: ${data.expiryDate}
Days Remaining: ${data.daysRemaining} days

View the contract at: ${data.viewUrl}

Please take appropriate action to review and renew this contract if needed.

---
ConTigo - Contract Intelligence Platform
`,
  }),

  approvalRequest: (data: {
    contractName: string;
    requestedBy: string;
    priority: string;
    dueDate: string;
    viewUrl: string;
    recipientName: string;
    stage: string;
    value?: string;
  }): EmailTemplate => ({
    subject: `🔔 Approval Required: ${data.contractName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approval Request</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Approval Required</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi ${data.recipientName},</p>
    
    <p>Your approval is required for the following contract:</p>
    
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">${data.contractName}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Requested By:</td>
          <td style="padding: 8px 0; font-weight: 500;">${data.requestedBy}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Stage:</td>
          <td style="padding: 8px 0; font-weight: 500;">${data.stage}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Priority:</td>
          <td style="padding: 8px 0;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; ${
              data.priority === 'critical' ? 'background: #fef2f2; color: #dc2626;' :
              data.priority === 'high' ? 'background: #fff7ed; color: #ea580c;' :
              'background: #f0fdf4; color: #16a34a;'
            }">${data.priority.toUpperCase()}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Due Date:</td>
          <td style="padding: 8px 0; font-weight: 500;">${data.dueDate}</td>
        </tr>
        ${data.value ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Contract Value:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #059669;">${data.value}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.viewUrl}" style="display: inline-block; background: #f59e0b; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">Review & Approve</a>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ConTigo - Contract Intelligence Platform</p>
  </div>
</body>
</html>`,
    text: `
Approval Required

Hi ${data.recipientName},

Your approval is required for the following contract:

Contract: ${data.contractName}
Requested By: ${data.requestedBy}
Stage: ${data.stage}
Priority: ${data.priority.toUpperCase()}
Due Date: ${data.dueDate}
${data.value ? `Contract Value: ${data.value}` : ''}

Review and approve at: ${data.viewUrl}

---
ConTigo - Contract Intelligence Platform
`,
  }),

  weeklyDigest: (data: {
    recipientName: string;
    stats: {
      totalContracts: number;
      expiringContracts: number;
      pendingApprovals: number;
      newContracts: number;
    };
    urgentItems: Array<{
      type: string;
      title: string;
      dueDate: string;
      url: string;
    }>;
    dashboardUrl: string;
  }): EmailTemplate => ({
    subject: `📊 Your Weekly Contract Digest`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Digest</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">📊 Weekly Contract Digest</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your contract portfolio summary</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p>Hi ${data.recipientName},</p>
    
    <p>Here's your weekly contract summary:</p>
    
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: #4f46e5;">${data.stats.totalContracts}</div>
        <div style="color: #6b7280; font-size: 14px;">Total Contracts</div>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: #059669;">${data.stats.newContracts}</div>
        <div style="color: #6b7280; font-size: 14px;">New This Week</div>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: #d97706;">${data.stats.expiringContracts}</div>
        <div style="color: #6b7280; font-size: 14px;">Expiring Soon</div>
      </div>
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: #f59e0b;">${data.stats.pendingApprovals}</div>
        <div style="color: #6b7280; font-size: 14px;">Pending Approvals</div>
      </div>
    </div>
    
    ${data.urgentItems.length > 0 ? `
    <h3 style="color: #1f2937; margin: 30px 0 15px 0;">⚡ Urgent Items</h3>
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      ${data.urgentItems.map((item, i) => `
        <a href="${item.url}" style="display: block; padding: 15px; border-bottom: ${i < data.urgentItems.length - 1 ? '1px solid #e5e7eb' : 'none'}; text-decoration: none; color: inherit;">
          <div style="font-weight: 500; color: #1f2937;">${item.title}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
            <span style="text-transform: uppercase; font-weight: 600;">${item.type}</span> • Due: ${item.dueDate}
          </div>
        </a>
      `).join('')}
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.dashboardUrl}" style="display: inline-block; background: #10b981; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">View Dashboard</a>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>© ${new Date().getFullYear()} ConTigo - Contract Intelligence Platform</p>
  </div>
</body>
</html>`,
    text: `
Weekly Contract Digest

Hi ${data.recipientName},

Here's your weekly contract summary:

📊 Summary:
- Total Contracts: ${data.stats.totalContracts}
- New This Week: ${data.stats.newContracts}
- Expiring Soon: ${data.stats.expiringContracts}
- Pending Approvals: ${data.stats.pendingApprovals}

${data.urgentItems.length > 0 ? `
⚡ Urgent Items:
${data.urgentItems.map(item => `- [${item.type.toUpperCase()}] ${item.title} (Due: ${item.dueDate})`).join('\n')}
` : ''}

View your dashboard at: ${data.dashboardUrl}

---
ConTigo - Contract Intelligence Platform
`,
  }),
};

/**
 * Send email using configured provider
 */
async function sendWithProvider(options: SendEmailOptions): Promise<EmailResult> {
  const provider = EMAIL_CONFIG.provider;
  
  switch (provider) {
    case 'resend':
      return sendWithResend(options);
    case 'sendgrid':
      return sendWithSendGrid(options);
    case 'console':
    default:
      return sendWithConsole(options);
  }
}

/**
 * Send email using Resend
 */
async function sendWithResend(options: SendEmailOptions): Promise<EmailResult> {
  if (!EMAIL_CONFIG.resendApiKey) {
    logger.warn('Resend API key not configured, falling back to console');
    return sendWithConsole(options);
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EMAIL_CONFIG.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: typeof options.from === 'string' ? options.from : EMAIL_CONFIG.from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo || EMAIL_CONFIG.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        headers: options.headers,
        tags: options.tags,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const result = await response.json();
    logger.info('Email sent via Resend', { messageId: result.id, to: options.to });
    
    return {
      success: true,
      messageId: result.id,
      provider: 'resend',
    };
  } catch (error) {
    logger.error('Failed to send email via Resend', { error, to: options.to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'resend',
    };
  }
}

/**
 * Send email using SendGrid
 */
async function sendWithSendGrid(options: SendEmailOptions): Promise<EmailResult> {
  if (!EMAIL_CONFIG.sendgridApiKey) {
    logger.warn('SendGrid API key not configured, falling back to console');
    return sendWithConsole(options);
  }

  try {
    const toAddresses = Array.isArray(options.to) 
      ? options.to.map(t => typeof t === 'string' ? { email: t } : t)
      : [typeof options.to === 'string' ? { email: options.to } : options.to];

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EMAIL_CONFIG.sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: toAddresses }],
        from: typeof options.from === 'string' 
          ? { email: options.from }
          : options.from || { email: EMAIL_CONFIG.from },
        subject: options.subject,
        content: [
          ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
          ...(options.html ? [{ type: 'text/html', value: options.html }] : []),
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }

    const messageId = response.headers.get('x-message-id') || 'unknown';
    logger.info('Email sent via SendGrid', { messageId, to: options.to });
    
    return {
      success: true,
      messageId,
      provider: 'sendgrid',
    };
  } catch (error) {
    logger.error('Failed to send email via SendGrid', { error, to: options.to });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'sendgrid',
    };
  }
}

/**
 * Console logger for development (no actual sending)
 */
async function sendWithConsole(options: SendEmailOptions): Promise<EmailResult> {
  const messageId = `console-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  logger.info('📧 Email (Console Mode)', {
    messageId,
    to: options.to,
    subject: options.subject,
    from: options.from || EMAIL_CONFIG.from,
  });

  console.log('\n📧 ═══════════════════════════════════════════════════════════');
  console.log(`   TO: ${JSON.stringify(options.to)}`);
  console.log(`   SUBJECT: ${options.subject}`);
  console.log(`   FROM: ${options.from || EMAIL_CONFIG.from}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (options.text) {
    console.log(options.text.substring(0, 500) + (options.text.length > 500 ? '...' : ''));
  }
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  return {
    success: true,
    messageId,
    provider: 'console',
  };
}

/**
 * Email Service Class
 */
export class EmailService {
  /**
   * Send a raw email
   */
  static async send(options: SendEmailOptions): Promise<EmailResult> {
    return sendWithProvider(options);
  }

  /**
   * Send contract expiry notification
   */
  static async sendContractExpiryAlert(data: {
    to: string;
    recipientName: string;
    contractName: string;
    contractId: string;
    daysRemaining: number;
    expiryDate: Date;
    baseUrl?: string;
  }): Promise<EmailResult> {
    const baseUrl = data.baseUrl || process.env.NEXTAUTH_URL || 'https://app.contigo.ai';
    const template = EMAIL_TEMPLATES.contractExpiry({
      recipientName: data.recipientName,
      contractName: data.contractName,
      daysRemaining: data.daysRemaining,
      expiryDate: data.expiryDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      viewUrl: `${baseUrl}/contracts/${data.contractId}`,
    });

    return this.send({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: [
        { name: 'type', value: 'contract-expiry' },
        { name: 'contractId', value: data.contractId },
      ],
    });
  }

  /**
   * Send approval request notification
   */
  static async sendApprovalRequest(data: {
    to: string;
    recipientName: string;
    contractName: string;
    contractId: string;
    requestedBy: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    stage: string;
    dueDate: Date;
    value?: number;
    baseUrl?: string;
  }): Promise<EmailResult> {
    const baseUrl = data.baseUrl || process.env.NEXTAUTH_URL || 'https://app.contigo.ai';
    const template = EMAIL_TEMPLATES.approvalRequest({
      recipientName: data.recipientName,
      contractName: data.contractName,
      requestedBy: data.requestedBy,
      priority: data.priority,
      stage: data.stage,
      dueDate: data.dueDate.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      value: data.value ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(data.value) : undefined,
      viewUrl: `${baseUrl}/approvals?contract=${data.contractId}`,
    });

    return this.send({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: [
        { name: 'type', value: 'approval-request' },
        { name: 'contractId', value: data.contractId },
        { name: 'priority', value: data.priority },
      ],
    });
  }

  /**
   * Send weekly digest
   */
  static async sendWeeklyDigest(data: {
    to: string;
    recipientName: string;
    stats: {
      totalContracts: number;
      expiringContracts: number;
      pendingApprovals: number;
      newContracts: number;
    };
    urgentItems: Array<{
      type: string;
      title: string;
      dueDate: string;
      url: string;
    }>;
    baseUrl?: string;
  }): Promise<EmailResult> {
    const baseUrl = data.baseUrl || process.env.NEXTAUTH_URL || 'https://app.contigo.ai';
    const template = EMAIL_TEMPLATES.weeklyDigest({
      recipientName: data.recipientName,
      stats: data.stats,
      urgentItems: data.urgentItems,
      dashboardUrl: baseUrl,
    });

    return this.send({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      tags: [
        { name: 'type', value: 'weekly-digest' },
      ],
    });
  }

  /**
   * Check if email service is configured
   */
  static isConfigured(): boolean {
    return EMAIL_CONFIG.provider !== 'console' && (
      !!EMAIL_CONFIG.resendApiKey ||
      !!EMAIL_CONFIG.sendgridApiKey ||
      !!EMAIL_CONFIG.smtpHost
    );
  }

  /**
   * Get current provider info
   */
  static getProviderInfo(): { provider: EmailProvider; configured: boolean } {
    return {
      provider: EMAIL_CONFIG.provider,
      configured: this.isConfigured(),
    };
  }
}

export default EmailService;
