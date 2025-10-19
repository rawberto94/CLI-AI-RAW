import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to get user ID from session (placeholder - replace with actual auth)
async function getUserIdFromSession(request: NextRequest): Promise<string> {
  // TODO: Implement actual session/auth logic
  // For now, return a demo user ID
  return 'demo-user-id'
}

// POST /api/user/onboarding/skip - Mark onboarding as skipped
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession(request)

    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: {
        onboardingSkipped: true,
        updatedAt: new Date()
      },
      create: {
        userId,
        onboardingSkipped: true
      }
    })

    // Track analytics
    await prisma.onboardingAnalytics.create({
      data: {
        userId,
        stepId: 'onboarding',
        action: 'skipped',
        metadata: { timestamp: new Date().toISOString() }
      }
    })

    return NextResponse.json({
      success: true,
      data: preferences
    })
  } catch (error) {
    console.error('Skip onboarding error:', error)
    return NextResponse.json(
      { error: 'Failed to skip onboarding' },
      { status: 500 }
    )
  }
}
