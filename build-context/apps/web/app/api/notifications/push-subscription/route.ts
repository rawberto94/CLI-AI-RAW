/**
 * Push Subscription API
 * 
 * Handles Web Push subscription management.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { notificationService } from 'data-orchestration/services';

// Validation schema
const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
});

/**
 * GET /api/notifications/push-subscription
 * Get VAPID public key for push subscription
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return createSuccessResponse(ctx, {
      success: true,
      data: {
        enabled: false,
        message: "Push notifications are not configured",
      },
    });
  }

  // Check if user has existing subscription
  const subscription = await prisma.pushSubscription.findFirst({
    where: { userId: ctx.userId },
    select: { endpoint: true },
  });

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      enabled: true,
      vapidPublicKey,
      hasSubscription: !!subscription,
    },
  });
});

/**
 * POST /api/notifications/push-subscription
 * Register a new push subscription
 */
export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const body = await req.json();
    const validated = subscriptionSchema.parse(body);

    // Create or update the subscription with flat fields
    await prisma.pushSubscription.upsert({
      where: { endpoint: validated.endpoint },
      update: {
        userId: ctx.userId,
        p256dh: validated.keys.p256dh,
        auth: validated.keys.auth,
        expirationTime: validated.expirationTime ? BigInt(validated.expirationTime) : null,
        updatedAt: new Date(),
      },
      create: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        endpoint: validated.endpoint,
        p256dh: validated.keys.p256dh,
        auth: validated.keys.auth,
        expirationTime: validated.expirationTime ? BigInt(validated.expirationTime) : null,
      },
    });

    return createSuccessResponse(ctx, {
      message: "Push subscription registered",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid subscription data', 400, {
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      });
    }
    console.error("[Push Subscription POST Error]", error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to register subscription', 500);
  }
});

/**
 * DELETE /api/notifications/push-subscription
 * Remove push subscription
 */
export const DELETE = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get("endpoint");

    if (endpoint) {
      // Delete specific subscription
      await prisma.pushSubscription.deleteMany({
        where: {
          userId: ctx.userId,
          endpoint,
        },
      });
    } else {
      // Delete all subscriptions for user
      await prisma.pushSubscription.deleteMany({
        where: { userId: ctx.userId },
      });
    }

    return createSuccessResponse(ctx, {
      message: "Push subscription removed",
    });
  } catch (error) {
    console.error("[Push Subscription DELETE Error]", error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to remove subscription', 500);
  }
});
