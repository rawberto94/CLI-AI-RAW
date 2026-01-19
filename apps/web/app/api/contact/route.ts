import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    const data: ContactFormData = await request.json();

    // Validate required fields
    if (!data.name || !data.email || !data.message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Log the submission (in production, send email/store in DB)
    console.log('📧 Contact Form Submission:');
    console.log('----------------------------');
    console.log(`Name: ${data.name}`);
    console.log(`Email: ${data.email}`);
    console.log(`Company: ${data.company || 'Not provided'}`);
    console.log(`Reason: ${REASON_LABELS[data.reason] || data.reason}`);
    console.log(`Message: ${data.message}`);
    console.log('----------------------------');

    // TODO: In production, integrate with:
    // - Email service (SendGrid, Resend, Postmark)
    // - CRM (HubSpot, Salesforce)
    // - Notification (Slack webhook)

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return NextResponse.json({
      success: true,
      message: 'Thank you for your message. We will get back to you soon!',
    });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to process your request. Please try again.' },
      { status: 500 }
    );
  }
}
