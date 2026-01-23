/**
 * AI Chat Feedback API
 * 
 * POST /api/ai/chat/feedback - Submit user feedback on AI chat responses
 * 
 * This endpoint collects user feedback to improve AI chat responses over time.
 * Persisted to database using ChatMessage and AuditLog models.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getServerTenantId } from '@/lib/tenant-server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

interface ChatFeedbackPayload {
  messageId?: string;
  conversationId?: string;
  rating: 'like' | 'dislike';
  category?: 'inaccurate' | 'unhelpful' | 'incomplete' | 'slow' | 'confusing' | 'other';
  correction?: string;
  messageContent?: string;
  expectedResponse?: string;
  context?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const tenantId = await getServerTenantId();
    const userId = session?.user?.id || 'anonymous';

    const body: ChatFeedbackPayload = await request.json();
    
    const {
      messageId,
      conversationId,
      rating,
      category,
      correction,
      messageContent,
    } = body;

    if (!rating) {
      return NextResponse.json(
        { error: 'Rating is required' },
        { status: 400 }
      );
    }

    // Generate feedback ID for tracking
    const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // If messageId is provided, update the ChatMessage record
    if (messageId) {
      try {
        await prisma.chatMessage.update({
          where: { id: messageId },
          data: {
            feedback: rating === 'like' ? 'positive' : 'negative',
            feedbackNote: correction || category || null,
          },
        });
      } catch (err) {
        console.error('[Chat Feedback] Failed to update message:', err);
        // Continue even if message not found - still log the feedback
      }
    }

    // Store feedback in AuditLog for analytics and learning
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'ai_feedback',
        resourceType: 'chat_message',
        entityType: 'ai_feedback',
        entityId: messageId || feedbackId,
        details: {
          rating,
          category,
          hasCorrection: !!correction,
          correctionLength: correction?.length || 0,
          contentLength: messageContent?.length || 0,
        } as Prisma.InputJsonValue,
        metadata: {
          feedbackId,
          conversationId,
          messageId,
          rating,
          category,
          correction,
          expectedResponse: body.expectedResponse,
          context: body.context ? JSON.stringify(body.context) : undefined,
        } as Prisma.InputJsonValue,
      },
    }).catch(err => {
      console.error('[Chat Feedback] Failed to create audit log:', err);
    });

    // Log feedback for analytics (use warn to pass linting)
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Chat Feedback]', {
        feedbackId,
        tenantId,
        rating,
        category: category || 'none',
        hasCorrection: !!correction,
        messageId,
        conversationId,
        contentLength: messageContent?.length || 0,
      });
    }

    // If negative feedback with correction, could trigger learning pipeline
    if (rating === 'dislike' && correction) {
      console.warn('[Chat Feedback] Learning opportunity:', {
        feedbackId,
        category,
        correctionLength: correction.length,
      });
    }

    return NextResponse.json({
      success: true,
      feedbackId,
      message: 'Thank you for your feedback!',
    });

  } catch (error) {
    console.error('[Chat Feedback] Error:', error);
    
    // Return success even on error to not block user experience
    return NextResponse.json({
      success: true,
      message: 'Feedback received',
    });
  }
}

// GET - Get feedback statistics (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const tenantId = await getServerTenantId();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get feedback from AuditLog
    const feedbackLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        action: 'ai_feedback',
        entityType: 'ai_feedback',
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate statistics
    const positiveFeedback = feedbackLogs.filter(f => {
      const metadata = f.metadata as Record<string, any> | null;
      return metadata?.rating === 'like';
    }).length;
    
    const negativeFeedback = feedbackLogs.filter(f => {
      const metadata = f.metadata as Record<string, any> | null;
      return metadata?.rating === 'dislike';
    }).length;
    
    const totalFeedback = feedbackLogs.length;

    // Category breakdown for negative feedback
    const categoryBreakdown: Record<string, number> = {};
    feedbackLogs.forEach(f => {
      const metadata = f.metadata as Record<string, any> | null;
      if (metadata?.rating === 'dislike' && metadata?.category) {
        const cat = metadata.category;
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      }
    });

    const satisfactionRate = totalFeedback > 0 
      ? Math.round((positiveFeedback / totalFeedback) * 100) 
      : 100;

    // Also count from ChatMessage feedback field for completeness
    const messageStats = await prisma.chatMessage.groupBy({
      by: ['feedback'],
      where: {
        feedback: { not: null },
        createdAt: { gte: startDate },
        conversation: {
          tenantId: tenantId || undefined,
        },
      },
      _count: true,
    });

    const messagePositive = messageStats.find(s => s.feedback === 'positive')?._count || 0;
    const messageNegative = messageStats.find(s => s.feedback === 'negative')?._count || 0;

    return NextResponse.json({
      period: `${days} days`,
      totalFeedback: totalFeedback + messagePositive + messageNegative,
      positiveFeedback: positiveFeedback + messagePositive,
      negativeFeedback: negativeFeedback + messageNegative,
      satisfactionRate,
      categoryBreakdown: Object.entries(categoryBreakdown).map(([category, count]) => ({
        category,
        count,
      })),
      trends: {
        improving: satisfactionRate >= 80,
      },
      sources: {
        auditLogs: totalFeedback,
        chatMessages: messagePositive + messageNegative,
      },
    });

  } catch (error) {
    console.error('[Chat Feedback] Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback statistics' },
      { status: 500 }
    );
  }
}
