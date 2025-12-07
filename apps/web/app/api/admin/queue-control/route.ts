import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

/**
 * POST /api/admin/queue-control
 * Control queue operations (pause, resume, clear, retry)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    
    if (!['admin', 'owner'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, queueName, jobId, batchId } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    // Available actions:
    // - pause: Pause a specific queue
    // - resume: Resume a paused queue
    // - clear-completed: Clear completed jobs from a queue
    // - clear-failed: Clear failed jobs from a queue
    // - retry-job: Retry a specific failed job
    // - retry-all-failed: Retry all failed jobs in a queue
    // - cancel-job: Cancel a waiting/delayed job
    // - cancel-batch: Cancel all jobs in a batch
    // - set-rate-limit: Adjust the rate limit for a queue

    console.log(`Queue control action: ${action}`, { queueName, jobId, batchId });

    // In production, these would interact with actual BullMQ queues
    // For now, simulate the actions
    let message = '';
    let success = true;

    switch (action) {
      case 'pause':
        if (!queueName) {
          return NextResponse.json(
            { success: false, error: 'Queue name is required' },
            { status: 400 }
          );
        }
        message = `Queue "${queueName}" has been paused`;
        break;

      case 'resume':
        if (!queueName) {
          return NextResponse.json(
            { success: false, error: 'Queue name is required' },
            { status: 400 }
          );
        }
        message = `Queue "${queueName}" has been resumed`;
        break;

      case 'clear-completed':
        if (!queueName) {
          return NextResponse.json(
            { success: false, error: 'Queue name is required' },
            { status: 400 }
          );
        }
        message = `Completed jobs cleared from "${queueName}"`;
        break;

      case 'clear-failed':
        if (!queueName) {
          return NextResponse.json(
            { success: false, error: 'Queue name is required' },
            { status: 400 }
          );
        }
        message = `Failed jobs cleared from "${queueName}"`;
        break;

      case 'retry-job':
        if (!jobId) {
          return NextResponse.json(
            { success: false, error: 'Job ID is required' },
            { status: 400 }
          );
        }
        message = `Job "${jobId}" has been queued for retry`;
        break;

      case 'retry-all-failed':
        if (!queueName) {
          return NextResponse.json(
            { success: false, error: 'Queue name is required' },
            { status: 400 }
          );
        }
        message = `All failed jobs in "${queueName}" queued for retry`;
        break;

      case 'cancel-job':
        if (!jobId) {
          return NextResponse.json(
            { success: false, error: 'Job ID is required' },
            { status: 400 }
          );
        }
        message = `Job "${jobId}" has been cancelled`;
        break;

      case 'cancel-batch':
        if (!batchId) {
          return NextResponse.json(
            { success: false, error: 'Batch ID is required' },
            { status: 400 }
          );
        }
        message = `Batch "${batchId}" has been cancelled`;
        break;

      case 'set-rate-limit':
        const { jobsPerInterval, interval } = body;
        if (!queueName || !jobsPerInterval || !interval) {
          return NextResponse.json(
            { success: false, error: 'Queue name, jobsPerInterval, and interval are required' },
            { status: 400 }
          );
        }
        message = `Rate limit for "${queueName}" set to ${jobsPerInterval} jobs per ${interval}ms`;
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Log the action for audit trail
    console.log(`[QUEUE CONTROL] User ${session.user.email}: ${message}`);

    return NextResponse.json({
      success,
      message,
      action,
      queueName,
      jobId,
      batchId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Queue control error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute queue control action' },
      { status: 500 }
    );
  }
}
