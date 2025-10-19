import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to get user ID from session
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  return 'demo-user-id'
}

// Mock what's new items (in production, these would come from a CMS or database)
const WHATS_NEW_ITEMS = [
  {
    id: 'wn-001',
    title: 'AI-Powered Widget Suggestions',
    description: 'Get personalized widget recommendations based on your usage patterns and role.',
    category: 'feature',
    icon: 'sparkles',
    date: new Date('2024-01-15'),
    link: '/docs/features/widget-suggestions'
  },
  {
    id: 'wn-002',
    title: 'Multiple Dashboard Views',
    description: 'Save and switch between different dashboard layouts for different workflows.',
    category: 'feature',
    icon: 'zap',
    date: new Date('2024-01-10'),
    link: '/docs/features/dashboard-views'
  },
  {
    id: 'wn-003',
    title: 'Enhanced Progress Tracking',
    description: 'Real-time progress updates with detailed status messages and time estimates.',
    category: 'improvement',
    icon: 'trending-up',
    date: new Date('2024-01-05'),
    link: '/docs/features/progress-tracking'
  },
  {
    id: 'wn-004',
    title: 'Improved Security',
    description: 'Enhanced authentication and data encryption for better security.',
    category: 'update',
    icon: 'shield',
    date: new Date('2023-12-28'),
    link: '/docs/security'
  },
  {
    id: 'wn-005',
    title: 'Advanced Analytics Dashboard',
    description: 'New analytics widgets with deeper insights into your procurement data.',
    category: 'feature',
    icon: 'bar-chart',
    date: new Date('2023-12-20'),
    link: '/analytics'
  }
]

// GET /api/dashboard/whats-new - Get what's new items
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)

    // Get user's dismissed items
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    })

    const dismissedItems = (preferences?.dismissedWhatsNew as string[]) || []

    // Mark items as dismissed
    const items = WHATS_NEW_ITEMS.map(item => ({
      ...item,
      dismissed: dismissedItems.includes(item.id)
    }))

    // Sort by date (newest first)
    items.sort((a, b) => b.date.getTime() - a.date.getTime())

    return NextResponse.json({
      success: true,
      data: items
    })
  } catch (error) {
    console.error('Get what\'s new error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch what\'s new items' },
      { status: 500 }
    )
  }
}
