import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseConnection, getConnectionStats } from '@/lib/prisma';

interface DatabaseHealthResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  connection: {
    connected: boolean;
    responseTime: number;
  };
  pool?: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
  };
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<DatabaseHealthResult>> {
  const startTime = Date.now();

  try {
    // Check basic connection
    const isConnected = await checkDatabaseConnection();
    const responseTime = Date.now() - startTime;

    if (!isConnected) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          connection: {
            connected: false,
            responseTime,
          },
          error: 'Database connection failed',
        },
        { status: 503 }
      );
    }

    // Get connection pool stats
    const poolStats = await getConnectionStats();

    const result: DatabaseHealthResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connection: {
        connected: true,
        responseTime,
      },
      pool: poolStats
        ? {
            totalConnections: poolStats.total_connections,
            activeConnections: poolStats.active_connections,
            idleConnections: poolStats.idle_connections,
          }
        : undefined,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        connection: {
          connected: false,
          responseTime: Date.now() - startTime,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
