import { type NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Basic health checks
    const healthData: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || 'unknown',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    }

    // Check if API is reachable (optional)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    try {
      const apiResponse = await fetch(`${apiUrl}/healthz`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      healthData.api = {
        status: apiResponse.ok ? 'healthy' : 'unhealthy',
        statusCode: apiResponse.status
      }
    } catch (error) {
      healthData.api = {
        status: 'unreachable',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return Response.json(healthData, { status: 200 })
  } catch (error) {
    return Response.json(
      { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
}