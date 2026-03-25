/**
 * Email Service
 * Handles all email notifications using SendGrid
 * 
 * Environment variables required:
 * - SENDGRID_API_KEY: Your SendGrid API key
 * - EMAIL_FROM: Default sender email (e.g., notifications@contigo.ch)
 * - EMAIL_FROM_NAME: Sender name (e.g., ConTigo Platform)
 */

import { logger } from './logger';

// SendGrid types
interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: 'attachment' | 'inline';
  }>;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  try {
    // Check if email is configured
    if (!process.env.SENDGRID_API_KEY) {
      logger.warn('SendGrid not configured - email would be sent:', {
        to: options.to,
        subject: options.subject,
      });
      
      return {
        success: true,
        messageId: 'simulated-' + Date.now(),
      };
    }

    // Dynamic import of SendGrid (only when configured)
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

    const fromEmail = options.from || process.env.EMAIL_FROM || 'noreply@contigo.ch';
    const fromName = options.fromName || process.env.EMAIL_FROM_NAME || 'ConTigo Platform';

    // Prepare email message
    const message: any = {
      to: options.to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: options.subject,
      html: options.html,
    };

    // Optional fields
    if (options.text) {
      message.text = options.text;
    }
    if (options.replyTo) {
      message.replyTo = options.replyTo;
    }
    if (options.cc && options.cc.length > 0) {
      message.cc = options.cc;
    }
    if (options.bcc && options.bcc.length > 0) {
      message.bcc = options.bcc;
    }
    if (options.attachments && options.attachments.length > 0) {
      message.attachments = options.attachments;
    }

    // Send email
    const [response] = await sgMail.default.send(message);

    logger.info('Email sent successfully', {
      to: options.to,
      subject: options.subject,
      messageId: response.headers['x-message-id'],
    });

    return {
      success: true,
      messageId: response.headers['x-message-id'],
    };
  } catch (error: any) {
    logger.error('Failed to send email', {
      error: error.message,
      to: options.to,
      subject: options.subject,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send bulk emails (e.g., notifications to multiple users)
 */
export async function sendBulkEmails(emails: EmailOptions[]): Promise<SendEmailResult[]> {
  const results = await Promise.allSettled(
    emails.map(email => sendEmail(email))
  );

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        error: result.reason?.message || 'Unknown error',
      };
    }
  });
}

/**
 * Email templates for common notifications
 */
export const emailTemplates = {
  /**
   * Contract expiring soon notification
   */
  contractExpiring: (data: {
    contractTitle: string;
    expirationDate: string;
    daysUntilExpiration: number;
    contractUrl: string;
  }) => ({
    subject: `⚠️ Contract Expiring Soon: ${data.contractTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Contract Expiration Alert</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #1f2937;">
            The following contract is expiring in <strong>${data.daysUntilExpiration} days</strong>:
          </p>
          
          <div style="background: white; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; color: #1f2937;">${data.contractTitle}</h2>
            <p style="color: #6b7280; margin: 5px 0;">
              <strong>Expiration Date:</strong> ${data.expirationDate}
            </p>
          </div>
          
          <p style="color: #6b7280; margin: 20px 0;">
            Please review this contract and take necessary action to avoid service disruption.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.contractUrl}" 
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Contract
            </a>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>This is an automated notification from ConTigo Platform</p>
        </div>
      </div>
    `,
  }),

  /**
   * Approval request notification
   */
  approvalRequest: (data: {
    contractTitle: string;
    requesterName: string;
    contractUrl: string;
    approvalUrl: string;
  }) => ({
    subject: `📋 Approval Required: ${data.contractTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Approval Request</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #1f2937;">
            <strong>${data.requesterName}</strong> has requested your approval for:
          </p>
          
          <div style="background: white; border-left: 4px solid #8b5cf6; padding: 20px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; color: #1f2937;">${data.contractTitle}</h2>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.approvalUrl}" 
               style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
              Approve
            </a>
            <a href="${data.contractUrl}" 
               style="background: #6b7280; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Details
            </a>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>This is an automated notification from ConTigo Platform</p>
        </div>
      </div>
    `,
  }),

  /**
   * Team invitation notification
   */
  teamInvitation: (data: {
    inviterName: string;
    tenantName: string;
    invitationUrl: string;
  }) => ({
    subject: `🎉 You've been invited to join ${data.tenantName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Team Invitation</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #1f2937;">
            <strong>${data.inviterName}</strong> has invited you to join <strong>${data.tenantName}</strong> on ConTigo Platform.
          </p>
          
          <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <p style="color: #6b7280;">
              ConTigo is an AI-powered contract intelligence platform that helps teams manage contracts efficiently.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.invitationUrl}" 
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            This invitation link will expire in 7 days.
          </p>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>This is an automated notification from ConTigo Platform</p>
        </div>
      </div>
    `,
  }),

  /**
   * Contract processing complete notification
   */
  processingComplete: (data: {
    contractTitle: string;
    contractUrl: string;
    extractedFields: number;
  }) => ({
    subject: `✅ Contract Processing Complete: ${data.contractTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Processing Complete</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #1f2937;">
            Your contract has been successfully processed:
          </p>
          
          <div style="background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; color: #1f2937;">${data.contractTitle}</h2>
            <p style="color: #6b7280; margin: 5px 0;">
              <strong>${data.extractedFields}</strong> fields extracted
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.contractUrl}" 
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Contract
            </a>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>This is an automated notification from ConTigo Platform</p>
        </div>
      </div>
    `,
  }),

  /**
   * Renewal reminder notification
   */
  renewalReminder: (data: {
    contractTitle: string;
    renewalDate: string;
    daysUntilRenewal: number;
    contractUrl: string;
  }) => ({
    subject: `🔄 Renewal Reminder: ${data.contractTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Renewal Reminder</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #1f2937;">
            Contract renewal is due in <strong>${data.daysUntilRenewal} days</strong>:
          </p>
          
          <div style="background: white; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0; color: #1f2937;">${data.contractTitle}</h2>
            <p style="color: #6b7280; margin: 5px 0;">
              <strong>Renewal Date:</strong> ${data.renewalDate}
            </p>
          </div>
          
          <p style="color: #6b7280; margin: 20px 0;">
            Please review the contract terms and initiate the renewal process.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.contractUrl}" 
               style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review Contract
            </a>
          </div>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>This is an automated notification from ConTigo Platform</p>
        </div>
      </div>
    `,
  }),

  /**
   * Signature request notification
   */
  signatureRequest: (data: {
    signerName: string;
    contractTitle: string;
    message: string;
    signingUrl: string;
  }) => ({
    subject: `✍️ Signature requested: ${data.contractTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Signature Requested</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #1f2937;">Hi ${data.signerName},</p>
          <p style="color: #4b5563;">${data.message || 'You have been asked to review and sign a document:'}</p>
          <div style="background: white; border-left: 4px solid #6366f1; padding: 20px; margin: 20px 0;">
            <h2 style="margin: 0; color: #1f2937; font-size: 18px;">${data.contractTitle}</h2>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.signingUrl}" 
               style="background: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
              Review &amp; Sign
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 13px; text-align: center;">
            This link expires in 14 days. If you have questions, please contact the sender.
          </p>
        </div>
        <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p>ConTigo CLM Platform &middot; Secure e-Signature</p>
        </div>
      </div>
    `,
  }),
};

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get email service status
 */
export function getEmailServiceStatus(): {
  configured: boolean;
  provider: string;
  fromEmail?: string;
} {
  return {
    configured: !!process.env.SENDGRID_API_KEY,
    provider: 'SendGrid',
    fromEmail: process.env.EMAIL_FROM,
  };
}
