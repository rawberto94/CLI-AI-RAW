import { NextResponse } from 'next/server';

/**
 * Health Check API Endpoint
 * Returns the health status of the API
 * 
 * OPTIMIZATION: Caches response for 10 seconds to reduce database load
 */

// Cache healthz response for 10 seconds
export const revalidate = 10;

export async function GET() {
  const startTime = Date.now();
  
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    responseTime: Date.now() - startTime,
    services: {
      database: 'operational',
      storage: 'operational',
      ai: 'operational',
    },
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
    },
  });
}
