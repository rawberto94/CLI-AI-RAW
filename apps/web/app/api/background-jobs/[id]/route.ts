import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to get user ID from session
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  return 'demo-user-id'
}

// GET /api/background-jobs/[id] - Get specific background job
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromSession(request)
    const { id } = params

    const job = await prisma.backgroundJob.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: job
    })
  } catch (error) {
    console.error('Get background job error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch background job' },
      { status: 500 }
    )
  }
}

// PATCH /api/background-jobs/[id] - Update background job
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromSession(request)
    const { id } = params
    const body = await request.json()

    // Verify ownership
    const existingJob = await prisma.backgroundJob.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!existingJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Update job
    const job = await prisma.backgroundJob.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.progress !== undefined && { progress: body.progress }),
        ...(body.result && { result: body.result }),
        ...(body.error && { error: body.error }),
        ...(body.metadata && { metadata: body.metadata }),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: job
    })
  } catch (error) {
    console.error('Update background job error:', error)
    return NextResponse.json(
      { error: 'Failed to update background job' },
      { status: 500 }
    )
  }
}

// DELETE /api/background-jobs/[id] - Delete/dismiss background job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromSession(request)
    const { id } = params

    // Verify ownership
    const existingJob = await prisma.backgroundJob.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!existingJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Delete job
    await prisma.backgroundJob.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully'
    })
  } catch (error) {
    console.error('Delete background job error:', error)
    return NextResponse.json(
      { error: 'Failed to delete background job' },
      { status: 500 }
    )
  }
}
