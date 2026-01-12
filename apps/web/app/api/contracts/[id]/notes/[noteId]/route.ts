import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/contracts/[id]/notes/[noteId]
 * Get a single note
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: contractId, noteId } = await params
    const tenantId = request.headers.get('x-tenant-id') || 'demo'
    
    const note = await prisma.contractComment.findFirst({
      where: {
        id: noteId,
        contractId,
        tenantId
      }
    })
    
    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
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
    })
    
  } catch (error) {
    console.error('Error fetching note:', error)
    return NextResponse.json(
      { error: 'Failed to fetch note' },
      { status: 500 }
    )
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
  try {
    const { id: contractId, noteId } = await params
    const tenantId = request.headers.get('x-tenant-id') || 'demo'
    const userId = request.headers.get('x-user-id') || 'demo-user'
    
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
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }
    
    // Build update data
    const updateData: Record<string, unknown> = {}
    
    if (content !== undefined) {
      if (!content.trim()) {
        return NextResponse.json(
          { error: 'Note content cannot be empty' },
          { status: 400 }
        )
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
    
    return NextResponse.json({
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
    })
    
  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    )
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
  try {
    const { id: contractId, noteId } = await params
    const tenantId = request.headers.get('x-tenant-id') || 'demo'
    const userId = request.headers.get('x-user-id') || 'demo-user'
    
    // Find the note
    const existingNote = await prisma.contractComment.findFirst({
      where: {
        id: noteId,
        contractId,
        tenantId
      }
    })
    
    if (!existingNote) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
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
    
    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully'
    })
    
  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    )
  }
}
