import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to get user ID from session
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  return 'demo-user-id'
}

// GET /api/background-jobs - Get all background jobs for user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build query
    const where: any = { userId }
    if (status) {
      where.status = status
    }

    // Get background jobs
    const jobs = await prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: jobs
    })
  } catch (error) {
    console.error('Get background jobs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch background jobs' },
      { status: 500 }
    )
  }
}

// POST /api/background-jobs - Create a new background job
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)
    const body = await request.json()

    if (!body.type || !body.jobId) {
      return NextResponse.json(
        { error: 'Type and jobId are required' },
        { status: 400 }
      )
    }

    // Create background job
    const job = await prisma.backgroundJob.create({
      data: {
        userId,
        jobId: body.jobId,
        type: body.type,
        status: 'pending',
        progress: 0,
        metadata: body.metadata || {}
      }
    })

    return NextResponse.json({
      success: true,
      data: job
    })
  } catch (error) {
    console.error('Create background job error:', error)
    return NextResponse.json(
      { error: 'Failed to create background job' },
      { status: 500 }
    )
  }
}
