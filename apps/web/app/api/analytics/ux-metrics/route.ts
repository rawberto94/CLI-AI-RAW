import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

/**
 * POST /api/analytics/ux-metrics
 * Receive and store UX metrics events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { events } = body

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid events data' },
        { status: 400 }
      )
    }

    // Store events in database
    // For now, we'll just log them and store in a simple analytics table
    const storedEvents = []

    for (const event of events) {
      try {
        // Store in appropriate analytics table based on event category
        switch (event.eventCategory) {
          case 'onboarding':
            await storeOnboardingAnalytics(event)
            break
          case 'dashboard':
            await storeWidgetAnalytics(event)
            break
          case 'help':
            await storeHelpAnalytics(event)
            break
          case 'progress':
          case 'interaction':
          case 'engagement':
          case 'error':
          case 'performance':
            // Store in general analytics table
            await storeGeneralAnalytics(event)
            break
        }

        storedEvents.push(event)
      } catch (error) {
        console.error('Failed to store event:', event, error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        eventsReceived: events.length,
        eventsStored: storedEvents.length
      }
    })
  } catch (error) {
    console.error('Failed to process UX metrics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process metrics' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/analytics/ux-metrics
 * Get UX metrics summary
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build query filters
    const where: any = {}
    if (startDate) {
      where.timestamp = { gte: new Date(startDate) }
    }
    if (endDate) {
      where.timestamp = { ...where.timestamp, lte: new Date(endDate) }
    }

    // Get metrics based on category
    let metrics: any = {}

    if (!category || category === 'onboarding') {
      metrics.onboarding = await getOnboardingMetrics(where)
    }

    if (!category || category === 'dashboard') {
      metrics.dashboard = await getDashboardMetrics(where)
    }

    if (!category || category === 'help') {
      metrics.help = await getHelpMetrics(where)
    }

    if (!category || category === 'engagement') {
      metrics.engagement = await getEngagementMetrics(where)
    }

    return NextResponse.json({
      success: true,
      data: metrics
    })
  } catch (error) {
    console.error('Failed to get UX metrics:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get metrics' },
      { status: 500 }
    )
  }
}

// Helper functions to store analytics

async function storeOnboardingAnalytics(event: any) {
  // TODO: Store in database once schema is updated
  console.log('Onboarding analytics:', event)
}

async function storeWidgetAnalytics(event: any) {
  // TODO: Store in database once schema is updated
  console.log('Widget analytics:', event)
}

async function storeHelpAnalytics(event: any) {
  // TODO: Store in database once schema is updated
  console.log('Help analytics:', event)
}

async function storeGeneralAnalytics(event: any) {
  // Store in a general analytics table or log
  console.log('Analytics event:', event)
}

// Helper functions to get metrics

async function getOnboardingMetrics(where: any) {
  // TODO: Get from database once schema is updated
  // Return mock data for now
  return {
    total: 100,
    completed: 87,
    skipped: 13,
    completionRate: 87
  }
}

async function getDashboardMetrics(where: any) {
  // TODO: Get from database once schema is updated
  // Return mock data for now
  return {
    totalCustomizations: 245,
    uniqueUsers: 100,
    customizationRate: 65
  }
}

async function getHelpMetrics(where: any) {
  // TODO: Get from database once schema is updated
  // Return mock data for now
  return {
    totalViews: 523,
    toursCompleted: 45,
    uniqueUsers: 100,
    usageRate: 75
  }
}

async function getEngagementMetrics(where: any) {
  // Get feature discovery metrics
  return {
    featuresDiscovered: 0,
    keyboardShortcutsUsed: 0,
    averageSessionTime: 0
  }
}
