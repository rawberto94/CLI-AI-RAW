import { NextRequest, NextResponse } from 'next/server';
import { mockDatabase } from '@/lib/mock-database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const artifacts = await mockDatabase.getArtifacts(id);

    return NextResponse.json({
      success: true,
      data: artifacts
    });
  } catch (error) {
    console.error('Error fetching artifacts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch artifacts' },
      { status: 500 }
    );
  }
}