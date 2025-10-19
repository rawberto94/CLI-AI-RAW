import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to get user ID from session (placeholder - replace with actual auth)
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  // For now, return a demo user ID
  return 'demo-user-id'
}

interface WidgetSuggestion {
  widgetType: string
  reason: string
  confidence: number
  priority: number
}

// GET /api/dashboard/suggestions - Get AI-powered widget suggestions
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)

    // Get user's current dashboard layout
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    const currentLayout = preferences?.dashboardLayout as any
    const currentWidgets = currentLayout?.widgets?.map((w: any) => w.type) || []

    // Get user's widget analytics
    const analytics = await prisma.widgetAnalytics.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 100
    })

    // Analyze usage patterns
    const suggestions = await generateWidgetSuggestions(
      userId,
      currentWidgets,
      analytics,
      preferences?.role as string
    )

    return NextResponse.json({
      success: true,
      data: suggestions
    })
  } catch (error) {
    console.error('Get widget suggestions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch widget suggestions' },
      { status: 500 }
    )
  }
}

// Generate widget suggestions based on user behavior
async function generateWidgetSuggestions(
  userId: string,
  currentWidgets: string[],
  analytics: any[],
  role: string
): Promise<WidgetSuggestion[]> {
  const suggestions: WidgetSuggestion[] = []

  // Analyze user activity patterns
  const activityCounts = analytics.reduce((acc, event) => {
    const type = event.widgetType || event.action
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Rule-based suggestions based on role and activity

  // Suggest upcoming renewals if user frequently views contracts
  if (
    !currentWidgets.includes('upcoming-renewals') &&
    (activityCounts['contract-view'] > 5 || role === 'procurement-manager')
  ) {
    suggestions.push({
      widgetType: 'upcoming-renewals',
      reason: 'You frequently view contracts. Track upcoming renewals to stay ahead.',
      confidence: 0.85,
      priority: 1
    })
  }

  // Suggest spend analysis if user views financial data
  if (
    !currentWidgets.includes('spend-analysis') &&
    (activityCounts['financial-view'] > 3 || role === 'analyst' || role === 'finance')
  ) {
    suggestions.push({
      widgetType: 'spend-analysis',
      reason: 'Analyze spending patterns across categories and time periods.',
      confidence: 0.80,
      priority: 2
    })
  }

  // Suggest supplier performance if user views supplier data
  if (
    !currentWidgets.includes('supplier-performance') &&
    activityCounts['supplier-view'] > 3
  ) {
    suggestions.push({
      widgetType: 'supplier-performance',
      reason: 'Monitor supplier performance metrics and identify top performers.',
      confidence: 0.75,
      priority: 3
    })
  }

  // Suggest rate benchmarking if user uses rate features
  if (
    !currentWidgets.includes('rate-benchmarking') &&
    (activityCounts['rate-view'] > 2 || activityCounts['benchmarking'] > 1)
  ) {
    suggestions.push({
      widgetType: 'rate-benchmarking',
      reason: 'Compare your rates against market benchmarks to identify savings.',
      confidence: 0.78,
      priority: 2
    })
  }

  // Suggest compliance dashboard for legal role
  if (
    !currentWidgets.includes('compliance-dashboard') &&
    role === 'legal'
  ) {
    suggestions.push({
      widgetType: 'compliance-dashboard',
      reason: 'Monitor compliance status and identify potential risks.',
      confidence: 0.90,
      priority: 1
    })
  }

  // Suggest ROI summary for executives
  if (
    !currentWidgets.includes('roi-summary') &&
    role === 'executive'
  ) {
    suggestions.push({
      widgetType: 'roi-summary',
      reason: 'Track return on investment and strategic metrics.',
      confidence: 0.88,
      priority: 1
    })
  }

  // Suggest data quality widget if user uploads data frequently
  if (
    !currentWidgets.includes('data-quality') &&
    activityCounts['data-upload'] > 5
  ) {
    suggestions.push({
      widgetType: 'data-quality',
      reason: 'Monitor data quality scores and address issues proactively.',
      confidence: 0.72,
      priority: 3
    })
  }

  // Suggest savings pipeline if user is procurement manager
  if (
    !currentWidgets.includes('savings-pipeline') &&
    role === 'procurement-manager'
  ) {
    suggestions.push({
      widgetType: 'savings-pipeline',
      reason: 'Track projected and realized savings across initiatives.',
      confidence: 0.82,
      priority: 2
    })
  }

  // Sort by priority and confidence
  suggestions.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    return b.confidence - a.confidence
  })

  // Return top 5 suggestions
  return suggestions.slice(0, 5)
}
