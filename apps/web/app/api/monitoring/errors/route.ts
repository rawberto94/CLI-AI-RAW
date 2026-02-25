/**
 * Error Monitoring API
 * Receives and logs client-side errors
 */

import { NextRequest } from 'next/server';
import { monitoringService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

interface ClientError {
  error: {
    message: string;
    name: string;
    stack?: string;
  };
  errorInfo?: {
    componentStack?: string;
  };
  level?: string;
  timestamp: string;
  url?: string;
  userAgent?: string;
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body: ClientError = await request.json();

  // Log the error
  monitoringService.logError(
    new Error(body.error.message),
    {
      name: body.error.name,
      stack: body.error.stack,
      componentStack: body.errorInfo?.componentStack,
      level: body.level,
      url: body.url,
      userAgent: body.userAgent,
      timestamp: body.timestamp,
    }
  );

  // Increment error counter
  monitoringService.incrementCounter('client.errors', {
    errorType: body.error.name,
    level: body.level || 'unknown',
  });

  return createSuccessResponse(ctx, {
      success: true,
      message: 'Error logged successfully',
    });
});
