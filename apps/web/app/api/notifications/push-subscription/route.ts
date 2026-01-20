/**
 * Push Subscription API
 * 
 * Handles Web Push subscription management.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      return NextResponse.json({
        success: true,
        data: {
          enabled: false,
          message: "Push notifications are not configured",
        },
      });
    }

    // Check if user has existing subscription
    const subscription = await prisma.pushSubscription.findFirst({
      where: { userId: session.user.id },
      select: { endpoint: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        enabled: true,
        vapidPublicKey,
        hasSubscription: !!subscription,
      },
    });
  } catch (error) {
    console.error("[Push Subscription GET Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch push config" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/push-subscription
 * Register a new push subscription
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = subscriptionSchema.parse(body);

    // Create or update the subscription with flat fields
    await prisma.pushSubscription.upsert({
      where: { endpoint: validated.endpoint },
      update: {
        userId: session.user.id,
        p256dh: validated.keys.p256dh,
        auth: validated.keys.auth,
        expirationTime: validated.expirationTime ? BigInt(validated.expirationTime) : null,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        tenantId: session.user.id,
        endpoint: validated.endpoint,
        p256dh: validated.keys.p256dh,
        auth: validated.keys.auth,
        expirationTime: validated.expirationTime ? BigInt(validated.expirationTime) : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Push subscription registered",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid subscription data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("[Push Subscription POST Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to register subscription" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/push-subscription
 * Remove push subscription
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get("endpoint");

    if (endpoint) {
      // Delete specific subscription
      await prisma.pushSubscription.deleteMany({
        where: {
          userId: session.user.id,
          endpoint,
        },
      });
    } else {
      // Delete all subscriptions for user
      await prisma.pushSubscription.deleteMany({
        where: { userId: session.user.id },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Push subscription removed",
    });
  } catch (error) {
    console.error("[Push Subscription DELETE Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove subscription" },
      { status: 500 }
    );
  }
}
