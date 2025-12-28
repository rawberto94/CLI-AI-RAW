/**
 * Email Service - SendGrid Integration
 * 
 * Handles all outbound email notifications for the platform
 */

import sgMail from '@sendgrid/mail';

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('⚠️ SENDGRID_API_KEY not configured - emails will be logged only');
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
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

/**
 * Send an email via SendGrid
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const from = options.from || process.env.EMAIL_FROM || 'notifications@contigo.ch';
  
  // If no API key, log and return (dev mode)
  if (!process.env.SENDGRID_API_KEY) {
    console.log('📧 [DEV MODE] Email would be sent:', {
      from,
      to: options.to,
      subject: options.subject,
      html: options.html.substring(0, 200) + '...',
    });
    return true;
  }

  try {
    const msg: any = {
      to: options.to,
      from,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    if (options.replyTo) msg.replyTo = options.replyTo;
    if (options.cc) msg.cc = options.cc;
    if (options.bcc) msg.bcc = options.bcc;
    if (options.attachments) msg.attachments = options.attachments;

    await sgMail.send(msg);
    
    console.log('✅ Email sent successfully:', {
      to: options.to,
      subject: options.subject,
    });
    
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send email:', {
      error: error.message,
      to: options.to,
      subject: options.subject,
    });
    
    // Log SendGrid specific errors
    if (error.response) {
      console.error('SendGrid error:', error.response.body);
    }
    
    return false;
  }
}

/**
 * Send multiple emails in batch
 */
export async function sendBatchEmails(emails: EmailOptions[]): Promise<{
  sent: number;
  failed: number;
}> {
  const results = await Promise.allSettled(
    emails.map(email => sendEmail(email))
  );
  
  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.length - sent;
  
  console.log(`📧 Batch email results: ${sent} sent, ${failed} failed`);
  
  return { sent, failed };
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Build email from template with variables
 */
export function buildEmailFromTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let html = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, value);
  });
  
  return html;
}
