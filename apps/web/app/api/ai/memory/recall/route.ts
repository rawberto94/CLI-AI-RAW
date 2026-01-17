/**
 * Memory Recall API
 * 
 * Retrieves relevant memories from the EpisodicMemoryService
 * for personalizing AI responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getEpisodicMemoryService } from '@repo/data-orchestration';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      query, 
      tenantId, 
      userId, 
      contractId, 
      types,
      limit = 5, 
      recencyBias = 0.3,
      minImportance = 0.3,
    } = body;

    if (!query || !tenantId) {
      return NextResponse.json(
        { error: 'Query and tenantId are required' },
        { status: 400 }
      );
    }

    const memoryService = getEpisodicMemoryService();
    
    const memories = await memoryService.recall({
      query,
      tenantId,
      userId,
      contractId,
      types,
      limit,
      recencyBias,
      minImportance,
    });

    return NextResponse.json({
      success: true,
      memories,
      count: memories.length,
    });
  } catch (error) {
    console.error('Memory recall error:', error);
    return NextResponse.json(
      { error: 'Failed to recall memories' },
      { status: 500 }
    );
  }
}
