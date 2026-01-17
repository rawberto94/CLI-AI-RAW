/**
 * Test Email Sending
 * POST /api/test/send-email
 * 
 * Test endpoint to verify email configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/email-service';
import { emailTemplates } from '@/lib/email/templates';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = 'test', to } = body;
    
    if (!to) {
      return NextResponse.json(
        { error: 'Missing "to" email address' },
        { status: 400 }
      );
    }

    let template;
    
    switch (type) {
      case 'expiring':
        template = emailTemplates.contractExpiring({
          contractTitle: 'Test Contract - Software License Agreement',
          expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          daysUntilExpiration: 30,
          contractId: 'test-123',
          contractUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3005'}/contracts/test-123`,
        });
        break;
        
      case 'approval':
        template = emailTemplates.approvalRequest({
          contractTitle: 'Test Contract - Vendor Agreement',
          requestedBy: 'John Smith',
          urgency: 'high',
          contractUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3005'}/contracts/test-123`,
          approvalUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3005'}/approvals/test-123`,
        });
        break;
        
      case 'invitation':
        template = emailTemplates.teamInvitation({
          invitedBy: 'Admin User',
          tenantName: 'ConTigo Demo',
          inviteUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3005'}/accept-invitation?token=test123`,
          expiresIn: '7 days',
        });
        break;
        
      case 'processing':
        template = emailTemplates.processingComplete({
          contractTitle: 'Test Contract - Service Agreement',
          fileName: 'service-agreement.pdf',
          processingTime: '1m 23s',
          contractUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3005'}/contracts/test-123`,
          extractedItems: {
            parties: 3,
            obligations: 12,
            rateCards: 5,
          },
        });
        break;
        
      case 'digest':
        template = emailTemplates.dailyDigest({
          recipientName: 'Test User',
          stats: {
            newContracts: 5,
            expiringSoon: 3,
            pendingApprovals: 2,
            processingComplete: 8,
          },
          topItems: [
            {
              title: 'Vendor Agreement - Acme Corp',
              url: '#',
              priority: 'high',
            },
            {
              title: 'Software License Renewal',
              url: '#',
              priority: 'medium',
            },
          ],
          dashboardUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3005'}/dashboard`,
        });
        break;
        
      default:
        // Simple test email
        template = {
          subject: '✅ ConTigo Email Test',
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #0066CC 0%, #0052A3 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                  .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">✅ Email Test Successful</h1>
                  </div>
                  <div class="content">
                    <div class="success">
                      <strong>🎉 Congratulations!</strong>
                      <p style="margin: 10px 0 0 0;">Your ConTigo email configuration is working correctly.</p>
                    </div>
                    
                    <p>This is a test email from ConTigo Contract Intelligence Platform.</p>
                    
                    <h3>What's Next?</h3>
                    <ul>
                      <li>Contract expiration alerts will be sent automatically</li>
                      <li>Approval notifications will reach stakeholders</li>
                      <li>Team invitations will be delivered</li>
                      <li>Processing completion updates will notify users</li>
                    </ul>
                    
                    <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        };
    }

    const success = await sendEmail({
      to,
      subject: template.subject,
      html: template.html,
    });

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent to ${to}`,
        type,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to send email - check logs for details' },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email test endpoint',
    usage: {
      method: 'POST',
      body: {
        to: 'your-email@example.com (required)',
        type: 'test | expiring | approval | invitation | processing | digest (optional, default: test)',
      },
    },
    examples: {
      test: 'curl -X POST http://localhost:3005/api/test/send-email -H "Content-Type: application/json" -d \'{"to":"you@example.com"}\'',
      expiring: 'curl -X POST http://localhost:3005/api/test/send-email -H "Content-Type: application/json" -d \'{"to":"you@example.com","type":"expiring"}\'',
    },
  });
}
