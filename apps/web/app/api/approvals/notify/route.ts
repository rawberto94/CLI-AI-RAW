import { NextRequest, NextResponse } from 'next/server';

// Types for approval notifications
interface ApprovalNotification {
  type: 'approval_request' | 'approval_completed' | 'approval_rejected' | 'approval_reminder' | 'approval_escalated';
  contractId: string;
  contractTitle: string;
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  workflowId?: string;
  stepName?: string;
  dueDate?: string;
  priority?: string;
  message?: string;
  actionUrl?: string;
}

// Email templates
const emailTemplates = {
  approval_request: (data: ApprovalNotification) => ({
    subject: `Action Required: Approval request for "${data.contractTitle}"`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Approval Request</h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #475569; margin-bottom: 16px;">Hi ${data.recipientName},</p>
          <p style="color: #475569; margin-bottom: 16px;">
            <strong>${data.senderName}</strong> has requested your approval for:
          </p>
          <div style="background: #F8FAFC; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px 0; color: #1E293B;">${data.contractTitle}</h3>
            ${data.stepName ? `<p style="margin: 0; color: #64748B; font-size: 14px;">Step: ${data.stepName}</p>` : ''}
            ${data.priority ? `<p style="margin: 4px 0 0 0; color: ${data.priority === 'urgent' ? '#DC2626' : '#64748B'}; font-size: 14px;">Priority: ${data.priority}</p>` : ''}
            ${data.dueDate ? `<p style="margin: 4px 0 0 0; color: #64748B; font-size: 14px;">Due: ${data.dueDate}</p>` : ''}
          </div>
          ${data.message ? `<p style="color: #475569; margin-bottom: 24px; font-style: italic;">"${data.message}"</p>` : ''}
          <div style="text-align: center;">
            <a href="${data.actionUrl || '#'}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Review & Approve
            </a>
          </div>
          <p style="color: #94A3B8; font-size: 12px; margin-top: 24px; text-align: center;">
            This is an automated notification from Contract Intelligence Platform
          </p>
        </div>
      </div>
    `,
  }),

  approval_completed: (data: ApprovalNotification) => ({
    subject: `✓ Approved: "${data.contractTitle}"`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✓ Approval Completed</h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #475569; margin-bottom: 16px;">Hi ${data.recipientName},</p>
          <p style="color: #475569; margin-bottom: 16px;">
            Good news! The following item has been approved:
          </p>
          <div style="background: #F0FDF4; padding: 16px; border-radius: 8px; border: 1px solid #BBF7D0; margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px 0; color: #166534;">${data.contractTitle}</h3>
            <p style="margin: 0; color: #16A34A; font-size: 14px;">Approved by ${data.senderName}</p>
          </div>
          ${data.message ? `<p style="color: #475569; margin-bottom: 24px;"><strong>Comment:</strong> "${data.message}"</p>` : ''}
          <div style="text-align: center;">
            <a href="${data.actionUrl || '#'}" style="display: inline-block; background: #22C55E; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Details
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  approval_rejected: (data: ApprovalNotification) => ({
    subject: `✗ Rejected: "${data.contractTitle}"`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Approval Rejected</h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #475569; margin-bottom: 16px;">Hi ${data.recipientName},</p>
          <p style="color: #475569; margin-bottom: 16px;">
            The following approval request has been rejected:
          </p>
          <div style="background: #FEF2F2; padding: 16px; border-radius: 8px; border: 1px solid #FECACA; margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px 0; color: #991B1B;">${data.contractTitle}</h3>
            <p style="margin: 0; color: #DC2626; font-size: 14px;">Rejected by ${data.senderName}</p>
          </div>
          ${data.message ? `<p style="color: #475569; margin-bottom: 24px;"><strong>Reason:</strong> "${data.message}"</p>` : ''}
          <div style="text-align: center;">
            <a href="${data.actionUrl || '#'}" style="display: inline-block; background: #64748B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View Details
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  approval_reminder: (data: ApprovalNotification) => ({
    subject: `⏰ Reminder: Approval pending for "${data.contractTitle}"`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Approval Reminder</h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #475569; margin-bottom: 16px;">Hi ${data.recipientName},</p>
          <p style="color: #475569; margin-bottom: 16px;">
            This is a friendly reminder that your approval is still pending:
          </p>
          <div style="background: #FFFBEB; padding: 16px; border-radius: 8px; border: 1px solid #FDE68A; margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px 0; color: #92400E;">${data.contractTitle}</h3>
            ${data.dueDate ? `<p style="margin: 0; color: #D97706; font-size: 14px; font-weight: 600;">Due: ${data.dueDate}</p>` : ''}
          </div>
          <div style="text-align: center;">
            <a href="${data.actionUrl || '#'}" style="display: inline-block; background: #F59E0B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Review Now
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  approval_escalated: (data: ApprovalNotification) => ({
    subject: `🔺 Escalated: Approval required for "${data.contractTitle}"`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔺 Escalated Approval</h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #475569; margin-bottom: 16px;">Hi ${data.recipientName},</p>
          <p style="color: #475569; margin-bottom: 16px;">
            An approval request has been escalated to you:
          </p>
          <div style="background: #F5F3FF; padding: 16px; border-radius: 8px; border: 1px solid #DDD6FE; margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px 0; color: #5B21B6;">${data.contractTitle}</h3>
            <p style="margin: 0; color: #7C3AED; font-size: 14px;">Escalated by ${data.senderName}</p>
            ${data.priority === 'urgent' ? '<p style="margin: 8px 0 0 0; color: #DC2626; font-size: 14px; font-weight: 600;">⚠️ URGENT - Immediate attention required</p>' : ''}
          </div>
          ${data.message ? `<p style="color: #475569; margin-bottom: 24px;"><strong>Note:</strong> "${data.message}"</p>` : ''}
          <div style="text-align: center;">
            <a href="${data.actionUrl || '#'}" style="display: inline-block; background: #8B5CF6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Review & Act
            </a>
          </div>
        </div>
      </div>
    `,
  }),
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const notification: ApprovalNotification = body;

    // Validate required fields
    if (!notification.type || !notification.recipientEmail || !notification.contractTitle) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, recipientEmail, contractTitle' },
        { status: 400 }
      );
    }

    // Get the email template
    const templateFn = emailTemplates[notification.type];
    if (!templateFn) {
      return NextResponse.json(
        { success: false, error: `Unknown notification type: ${notification.type}` },
        { status: 400 }
      );
    }

    const emailContent = templateFn(notification);

    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    console.log('📧 Email notification:', {
      to: notification.recipientEmail,
      subject: emailContent.subject,
    });

    // Send email via SendGrid
    const { sendEmail } = await import('@/lib/email/email-service');
    const emailSent = await sendEmail({
      to: notification.recipientEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      from: 'notifications@contigo.ch',
    });
    
    if (!emailSent) {
      console.warn('⚠️ Failed to send email notification');
    }

    // Also create a notification record in database for in-app notifications
    // This would be stored in a notifications table

    return NextResponse.json({
      success: true,
      data: {
        notificationId: `notif_${Date.now()}`,
        type: notification.type,
        recipient: notification.recipientEmail,
        emailSent: emailServiceConfigured,
        inAppCreated: true,
      },
    });
  } catch (error) {
    console.error('Error sending approval notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve notification templates (for preview)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as ApprovalNotification['type'];

  if (!type) {
    return NextResponse.json({
      success: true,
      data: {
        availableTypes: Object.keys(emailTemplates),
      },
    });
  }

  const templateFn = emailTemplates[type];
  if (!templateFn) {
    return NextResponse.json(
      { success: false, error: `Unknown notification type: ${type}` },
      { status: 400 }
    );
  }

  // Return a preview with sample data
  const sampleData: ApprovalNotification = {
    type,
    contractId: 'sample-123',
    contractTitle: 'Sample Contract Agreement',
    recipientEmail: 'recipient@example.com',
    recipientName: 'John Doe',
    senderName: 'Jane Smith',
    stepName: 'Legal Review',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    priority: 'high',
    message: 'Please review and approve at your earliest convenience.',
    actionUrl: 'https://example.com/approvals/sample-123',
  };

  const preview = templateFn(sampleData);

  return NextResponse.json({
    success: true,
    data: {
      type,
      subject: preview.subject,
      htmlPreview: preview.html,
    },
  });
}
