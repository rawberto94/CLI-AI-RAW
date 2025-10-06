import { NextRequest, NextResponse } from 'next/server';

// In-memory progress tracking (in production, use Redis or database)
const progressStore = new Map<string, ProgressData>();

interface ProgressData {
  jobId: string;
  fileName: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  bytesUploaded?: number;
  totalBytes?: number;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const progress = progressStore.get(jobId);

    if (!progress) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Progress check error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to check progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { jobId, ...progressData } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const existing = progressStore.get(jobId);
    const updated: ProgressData = {
      ...existing,
      ...progressData,
      jobId,
      updatedAt: Date.now(),
      startedAt: existing?.startedAt || Date.now(),
    };

    progressStore.set(jobId, updated);

    return NextResponse.json({ success: true, progress: updated });
  } catch (error) {
    console.error('Progress update error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to update progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Cleanup old progress entries (called periodically)
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const olderThan = searchParams.get('olderThan'); // timestamp

    if (jobId) {
      // Delete specific job
      progressStore.delete(jobId);
      return NextResponse.json({ success: true, deleted: 1 });
    }

    if (olderThan) {
      // Delete old entries
      const cutoff = parseInt(olderThan, 10);
      let deleted = 0;

      for (const [id, progress] of progressStore.entries()) {
        if (progress.updatedAt < cutoff) {
          progressStore.delete(id);
          deleted++;
        }
      }

      return NextResponse.json({ success: true, deleted });
    }

    return NextResponse.json(
      { error: 'Either jobId or olderThan parameter is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Progress cleanup error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to cleanup progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
