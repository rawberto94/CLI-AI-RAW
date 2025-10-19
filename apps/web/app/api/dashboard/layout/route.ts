import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

/**
 * GET /api/dashboard/layout
 * Get user's dashboard layout
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get actual user ID from session
    const userId = 'demo-user'

    // TODO: Get from database once schema is updated
    // Return null for now (will use default layout)
    return NextResponse.json({
      success: true,
      data: null
    })
  } catch (error) {
    console.error('Failed to get dashboard layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get dashboard layout' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dashboard/layout
 * Save user's dashboard layout
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { layout, isDefault } = body

    // TODO: Get actual user ID from session
    const userId = 'demo-user'

    // TODO: Store in database once schema is updated
    // For now, just acknowledge the save
    console.log('Dashboard layout saved:', { userId, layout })

    return NextResponse.json({
      success: true,
      data: { userId, layout, saved: true }
    })
  } catch (error) {
    console.error('Failed to save dashboard layout:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save dashboard layout' },
      { status: 500 }
    )
  }
}
