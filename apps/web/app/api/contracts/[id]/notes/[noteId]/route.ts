import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { contractService } from 'data-orchestration/services'
import { getServerSession } from '@/lib/auth'
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * GET /api/contracts/[id]/notes/[noteId]
 * Get a single note
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    const tenantId = session.user.tenantId
    const { id: contractId, noteId } = await params
    
    const note = await prisma.contractComment.findFirst({
      where: {
        id: noteId,
        contractId,
        tenantId
      }
    })
    
    if (!note) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Note not found', 404);
    }
    
    return createSuccessResponse(ctx, {
      note: {
        id: note.id,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        author: {
          id: note.userId,
          name: note.userId,
          avatar: undefined
        },
        isPinned: (note.reactions as Array<{ type?: string }> || []).some(r => r.type === 'pinned'),
        mentions: note.mentions
      }
    });
    
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * PATCH /api/contracts/[id]/notes/[noteId]
 * Update a note (content, pin status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    const tenantId = session.user.tenantId
    const userId = session.user.id
    const { id: contractId, noteId } = await params
    
    const body = await request.json()
    const { content, isPinned } = body
    
    // Find the note
    const existingNote = await prisma.contractComment.findFirst({
      where: {
        id: noteId,
        contractId,
        tenantId
      }
    })
    
    if (!existingNote) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Note not found', 404);
    }
    
    // Build update data
    const updateData: Record<string, unknown> = {}
    
    if (content !== undefined) {
      if (!content.trim()) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Note content cannot be empty', 400);
      }
      updateData.content = content.trim()
    }
    
    if (isPinned !== undefined) {
      // Update reactions to include/remove pinned status
      const reactions = (existingNote.reactions as Array<{ type?: string; userId?: string }>) || []
      
      if (isPinned) {
        // Add pinned reaction if not already there
        const hasPinned = reactions.some(r => r.type === 'pinned')
        if (!hasPinned) {
          updateData.reactions = [...reactions, { type: 'pinned', userId }]
        }
      } else {
        // Remove pinned reaction
        updateData.reactions = reactions.filter(r => r.type !== 'pinned')
      }
    }
    
    // Update the note
    const updatedNote = await prisma.contractComment.update({
      where: { id: noteId },
      data: updateData as any
    })
    
    // Log activity
    const activityAction = content !== undefined 
      ? 'Updated a note' 
      : isPinned ? 'Pinned a note' : 'Unpinned a note'
    
    await prisma.contractActivity.create({
      data: {
        contractId,
        tenantId,
        userId,
        type: 'comment',
        action: activityAction,
        metadata: { noteId }
      }
    })
    
    return createSuccessResponse(ctx, {
      success: true,
      note: {
        id: updatedNote.id,
        content: updatedNote.content,
        createdAt: updatedNote.createdAt,
        updatedAt: updatedNote.updatedAt,
        author: {
          id: updatedNote.userId,
          name: updatedNote.userId,
          avatar: undefined
        },
        isPinned: (updatedNote.reactions as Array<{ type?: string }> || []).some(r => r.type === 'pinned'),
        mentions: updatedNote.mentions
      }
    });
    
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * DELETE /api/contracts/[id]/notes/[noteId]
 * Delete a note
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    const tenantId = session.user.tenantId
    const userId = session.user.id
    const { id: contractId, noteId } = await params
    
    // Find the note
    const existingNote = await prisma.contractComment.findFirst({
      where: {
        id: noteId,
        contractId,
        tenantId
      }
    })
    
    if (!existingNote) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Note not found', 404);
    }
    
    // Delete the note
    await prisma.contractComment.delete({
      where: { id: noteId }
    })
    
    // Log activity
    await prisma.contractActivity.create({
      data: {
        contractId,
        tenantId,
        userId,
        type: 'comment',
        action: 'Deleted a note',
        metadata: { noteId }
      }
    })
    
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Note deleted successfully'
    });
    
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
