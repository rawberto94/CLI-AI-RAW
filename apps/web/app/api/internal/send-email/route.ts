/**
 * Internal API for sending emails
 * 
 * Used by worker processes that don't have direct access to the email service
 */

import { NextRequest, NextResponse } from 'next/server';
import EmailService from '@/lib/services/email.service';

// Internal API secret for authentication - MUST be set in production
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

if (process.env.NODE_ENV === 'production' && !INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET must be set in production environment');
}

export async function POST(request: NextRequest) {
  // Validate internal API secret
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== INTERNAL_API_SECRET) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { to, subject, html, text, template, templateData } = body;

    // Validate required fields
    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject' },
        { status: 400 }
      );
    }

    if (!html && !text && !template) {
      return NextResponse.json(
        { error: 'Must provide html, text, or template' },
        { status: 400 }
      );
    }

    let result;

    // Use template if specified
    if (template) {
      switch (template) {
        case 'contractExpiry':
          if (!templateData) {
            return NextResponse.json(
              { error: 'Template data required for contractExpiry' },
              { status: 400 }
            );
          }
          result = await EmailService.sendContractExpiryAlert({
            to: Array.isArray(to) ? to[0] : to,
            ...templateData,
          });
          break;

        case 'approvalRequest':
          if (!templateData) {
            return NextResponse.json(
              { error: 'Template data required for approvalRequest' },
              { status: 400 }
            );
          }
          result = await EmailService.sendApprovalRequest({
            to: Array.isArray(to) ? to[0] : to,
            ...templateData,
          });
          break;

        case 'weeklyDigest':
          if (!templateData) {
            return NextResponse.json(
              { error: 'Template data required for weeklyDigest' },
              { status: 400 }
            );
          }
          result = await EmailService.sendWeeklyDigest({
            to: Array.isArray(to) ? to[0] : to,
            ...templateData,
          });
          break;

        default:
          return NextResponse.json(
            { error: `Unknown template: ${template}` },
            { status: 400 }
          );
      }
    } else {
      // Send raw email
      result = await EmailService.send({
        to,
        subject,
        html,
        text,
      });
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        provider: result.provider,
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  const info = EmailService.getProviderInfo();
  
  return NextResponse.json({
    service: 'email',
    provider: info.provider,
    configured: info.configured,
    status: 'ok',
  });
}
