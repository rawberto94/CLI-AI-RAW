import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to get user ID from session
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  return 'demo-user-id'
}

// GET /api/dashboard/views - Get all dashboard views for user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    const views = (preferences?.dashboardViews as any[]) || []

    return NextResponse.json({
      success: true,
      data: views
    })
  } catch (error) {
    console.error('Get dashboard views error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard views' },
      { status: 500 }
    )
  }
}

// POST /api/dashboard/views - Create a new dashboard view
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)
    const body = await request.json()

    if (!body.name || !body.layout) {
      return NextResponse.json(
        { error: 'Name and layout are required' },
        { status: 400 }
      )
    }

    // Get existing views
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    const existingViews = (preferences?.dashboardViews as any[]) || []

    // Create new view
    const newView = {
      id: `view-${Date.now()}`,
      name: body.name,
      layout: body.layout,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const updatedViews = [...existingViews, newView]

    // Save to database
    await prisma.userPreferences.upsert({
      where: { userId },
      update: {
        dashboardViews: updatedViews,
        updatedAt: new Date()
      },
      create: {
        userId,
        dashboardViews: updatedViews
      }
    })

    return NextResponse.json({
      success: true,
      data: newView
    })
  } catch (error) {
    console.error('Create dashboard view error:', error)
    return NextResponse.json(
      { error: 'Failed to create dashboard view' },
      { status: 500 }
    )
  }
}

// PATCH /api/dashboard/views - Update a dashboard view
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)
    const body = await request.json()

    if (!body.viewId) {
      return NextResponse.json(
        { error: 'View ID is required' },
        { status: 400 }
      )
    }

    // Get existing views
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    const existingViews = (preferences?.dashboardViews as any[]) || []

    // Update the view
    const updatedViews = existingViews.map((view: any) => {
      if (view.id === body.viewId) {
        return {
          ...view,
          ...(body.name && { name: body.name }),
          ...(body.layout && { layout: body.layout }),
          updatedAt: new Date()
        }
      }
      return view
    })

    // Save to database
    await prisma.userPreferences.update({
      where: { userId },
      data: {
        dashboardViews: updatedViews,
        updatedAt: new Date()
      }
    })

    const updatedView = updatedViews.find((v: any) => v.id === body.viewId)

    return NextResponse.json({
      success: true,
      data: updatedView
    })
  } catch (error) {
    console.error('Update dashboard view error:', error)
    return NextResponse.json(
      { error: 'Failed to update dashboard view' },
      { status: 500 }
    )
  }
}

// DELETE /api/dashboard/views - Delete a dashboard view
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)
    const { searchParams } = new URL(request.url)
    const viewId = searchParams.get('viewId')

    if (!viewId) {
      return NextResponse.json(
        { error: 'View ID is required' },
        { status: 400 }
      )
    }

    // Get existing views
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    const existingViews = (preferences?.dashboardViews as any[]) || []

    // Check if view is default
    const viewToDelete = existingViews.find((v: any) => v.id === viewId)
    if (viewToDelete?.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default view' },
        { status: 400 }
      )
    }

    // Remove the view
    const updatedViews = existingViews.filter((view: any) => view.id !== viewId)

    // Save to database
    await prisma.userPreferences.update({
      where: { userId },
      data: {
        dashboardViews: updatedViews,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'View deleted successfully'
    })
  } catch (error) {
    console.error('Delete dashboard view error:', error)
    return NextResponse.json(
      { error: 'Failed to delete dashboard view' },
      { status: 500 }
    )
  }
}
