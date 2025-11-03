/**
 * Error Monitoring API
 * Receives and logs client-side errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitoringService } from 'data-orchestration/services';

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

export async function POST(request: NextRequest) {
  try {
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
    
    return NextResponse.json(
      {
        success: true,
        message: 'Error logged successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to log client error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to log error',
      },
      { status: 500 }
    );
  }
}
