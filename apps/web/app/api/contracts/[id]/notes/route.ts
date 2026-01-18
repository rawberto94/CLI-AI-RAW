import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth'

/**
 * GET /api/contracts/[id]/notes
 * Get all notes for a contract
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const tenantId = session.user.tenantId
    const { id: contractId } = await params
    
    // Get notes (using ContractComment model with special type)
    const notes = await prisma.contractComment.findMany({
      where: {
        contractId,
        tenantId,
        // Notes are top-level comments (no parent)
        parentId: null
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    })
    
    // Transform to Note format for frontend
    const formattedNotes = notes.map(note => ({
      id: note.id,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      author: {
        id: note.userId,
        name: note.userId, // Would be enriched with user data
        avatar: undefined
      },
      isPinned: (note.reactions as Array<{ type?: string }> || []).some(r => r.type === 'pinned'),
      mentions: note.mentions
    }))
    
    // Sort: pinned first, then by date
    formattedNotes.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    
    return NextResponse.json({ notes: formattedNotes })
    
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/contracts/[id]/notes
 * Create a new note for a contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const tenantId = session.user.tenantId
    const userId = session.user.id
    const { id: contractId } = await params
    
    const body = await request.json()
    const { content, mentions = [] } = body
    
    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      )
    }
    
    // Verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { 
        id: contractId, 
        tenantId,
        isDeleted: false 
      },
      select: { id: true, contractTitle: true }
    })
    
    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      )
    }
    
    // Create note using ContractComment model
    const note = await prisma.contractComment.create({
      data: {
        contractId,
        tenantId,
        userId,
        content: content.trim(),
        mentions,
        reactions: [],
        parentId: null
      }
    })
    
    // Log activity
    await prisma.contractActivity.create({
      data: {
        contractId,
        tenantId,
        userId,
        type: 'comment',
        action: `Added a note to "${contract.contractTitle || 'contract'}"`,
        metadata: { noteId: note.id }
      }
    })
    
    return NextResponse.json({
      success: true,
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
        isPinned: false,
        mentions: note.mentions
      }
    }, { status: 201 })
    
  } catch {
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    )
  }
}
