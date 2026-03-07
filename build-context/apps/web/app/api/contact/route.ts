import { NextRequest } from 'next/server';
import { withApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

// Contact form submission handler
// In production, this would send to email service (SendGrid, Resend, etc.)

interface ContactFormData {
  name: string;
  email: string;
  company?: string;
  reason: string;
  message: string;
}

const REASON_LABELS: Record<string, string> = {
  demo: 'Request a Demo',
  pricing: 'Pricing Question',
  support: 'Technical Support',
  partnership: 'Partnership Inquiry',
  other: 'Other',
};

export const POST = withApiHandler(async (request: NextRequest, ctx) => {
  const data: ContactFormData = await request.json();

  // Validate required fields
  if (!data.name || !data.email || !data.message) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Name, email, and message are required', 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Please provide a valid email address', 400);
  }

  // Log the submission (in production, send email/store in DB)
  console.warn('📧 Contact Form Submission:');
  console.warn('----------------------------');
  console.warn(`Name: ${data.name}`);
  console.warn(`Email: ${data.email}`);
  console.warn(`Company: ${data.company || 'Not provided'}`);
  console.warn(`Reason: ${REASON_LABELS[data.reason] || data.reason}`);
  console.warn(`Message: ${data.message}`);
  console.warn('----------------------------');

  // Email integration
  const emailHtml = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${data.name}</p>
    <p><strong>Email:</strong> ${data.email}</p>
    <p><strong>Company:</strong> ${data.company || 'Not provided'}</p>
    <p><strong>Reason:</strong> ${REASON_LABELS[data.reason] || data.reason}</p>
    <p><strong>Message:</strong></p>
    <p>${data.message}</p>
  `;

  // Try to send email via Resend
  if (process.env.RESEND_API_KEY && process.env.CONTACT_EMAIL) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM_EMAIL || 'contact@contigo.ai',
          to: [process.env.CONTACT_EMAIL],
          reply_to: data.email,
          subject: `[Contact] ${data.reason}: ${data.name}`,
          html: emailHtml,
        }),
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
    }
  }

  // Slack notification
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `📧 New contact form submission`,
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: '📧 New Contact Form' } },
            { type: 'section', fields: [
              { type: 'mrkdwn', text: `*Name:* ${data.name}` },
              { type: 'mrkdwn', text: `*Email:* ${data.email}` },
              { type: 'mrkdwn', text: `*Company:* ${data.company || 'N/A'}` },
              { type: 'mrkdwn', text: `*Reason:* ${data.reason}` },
            ]},
            { type: 'section', text: { type: 'mrkdwn', text: `*Message:*\n${data.message}` } },
          ],
        }),
      });
    } catch (slackError) {
      console.error('Slack notification failed:', slackError);
    }
  }

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Thank you for your message. We will get back to you soon!',
  });
});
