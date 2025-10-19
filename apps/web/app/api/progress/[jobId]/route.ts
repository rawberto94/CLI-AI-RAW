import { NextRequest, NextResponse } from 'next/server'
import { getJobProgress } from '@/lib/services/progress-tracking.service'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // Get progress events for this job
    const events = await getJobProgress(jobId)

    if (events.length === 0) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Get latest event for current status
    const latestEvent = events[events.length - 1]

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        currentStage: latestEvent.stage,
        progress: latestEvent.progress,
        message: latestEvent.message,
        timestamp: latestEvent.timestamp,
        metadata: latestEvent.metadata,
        events: events.map(e => ({
          stage: e.stage,
          progress: e.progress,
          message: e.message,
          timestamp: e.timestamp,
          metadata: e.metadata
        }))
      }
    })
  } catch (error) {
    console.error('Get job progress error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job progress' },
      { status: 500 }
    )
  }
}
