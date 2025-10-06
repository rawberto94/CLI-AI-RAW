import { NextResponse } from 'next/server';

/**
 * Health Check API Endpoint
 * Returns the health status of the API
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'operational',
      storage: 'operational',
      ai: 'operational',
    },
  });
}

export const dynamic = 'force-dynamic';
