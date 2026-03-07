/**
 * Internal API for sending emails
 * 
 * Used by worker processes that don't have direct access to the email service
 */

import { NextRequest } from 'next/server';
import EmailService from '@/lib/services/email.service';
import { withApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

// Internal API secret for authentication - MUST be set in production
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

if (process.env.NODE_ENV === 'production' && !INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET must be set in production environment');
}

export const POST = withApiHandler(async (request: NextRequest, ctx) => {
  // Validate internal API secret
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== INTERNAL_API_SECRET) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Invalid token', 401);
  }

  try {
    const body = await request.json();
    const { to, subject, html, text, template, templateData } = body;

    // Validate required fields
    if (!to || !subject) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Missing required fields: to, subject', 400);
    }

    if (!html && !text && !template) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Must provide html, text, or template', 400);
    }

    let result;

    // Use template if specified
    if (template) {
      switch (template) {
        case 'contractExpiry':
          if (!templateData) {
            return createErrorResponse(ctx, 'BAD_REQUEST', 'Template data required for contractExpiry', 400);
          }
          result = await EmailService.sendContractExpiryAlert({
            to: Array.isArray(to) ? to[0] : to,
            ...templateData,
          });
          break;

        case 'approvalRequest':
          if (!templateData) {
            return createErrorResponse(ctx, 'BAD_REQUEST', 'Template data required for approvalRequest', 400);
          }
          result = await EmailService.sendApprovalRequest({
            to: Array.isArray(to) ? to[0] : to,
            ...templateData,
          });
          break;

        case 'weeklyDigest':
          if (!templateData) {
            return createErrorResponse(ctx, 'BAD_REQUEST', 'Template data required for weeklyDigest', 400);
          }
          result = await EmailService.sendWeeklyDigest({
            to: Array.isArray(to) ? to[0] : to,
            ...templateData,
          });
          break;

        default:
          return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown template: ${template}`, 400);
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
      return createSuccessResponse(ctx, {
        success: true,
        messageId: result.messageId,
        provider: result.provider,
      });
    } else {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', result.error || 'Failed to send email', 500);
    }
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Unknown error', 500);
  }
});

// Health check
export const GET = withApiHandler(async (_request: NextRequest, ctx) => {
  const info = EmailService.getProviderInfo();
  
  return createSuccessResponse(ctx, {
    service: 'email',
    provider: info.provider,
    configured: info.configured,
    status: 'ok',
  });
});
