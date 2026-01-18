/**
 * Notification Preferences API
 * 
 * Handles user notification preferences management.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schemas
const preferencesSchema = z.object({
  channels: z.record(
    z.object({
      enabled: z.boolean(),
      channels: z.array(z.enum(["in_app", "email", "push", "slack", "teams"])),
      quietHours: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .optional(),
      batchDigest: z.boolean().optional(),
    })
  ).optional(),
  globalQuietHours: z
    .object({
      start: z.string(),
      end: z.string(),
      timezone: z.string(),
    })
    .optional()
    .nullable(),
  emailDigestFrequency: z.enum(["instant", "hourly", "daily", "weekly"]).optional(),
});

/**
 * GET /api/notifications/preferences
 * Get user's notification preferences
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const preferences = await prisma.notificationPreferences.findUnique({
      where: { userId: session.user.id },
    });

    // Return defaults if no preferences exist
    const defaultPreferences = {
      channels: {
        contract_uploaded: { enabled: true, channels: ["in_app", "email"] },
        contract_shared: { enabled: true, channels: ["in_app", "email"] },
        contract_expiring: { enabled: true, channels: ["in_app", "email", "push"] },
        contract_expired: { enabled: true, channels: ["in_app", "email", "push"] },
        contract_approved: { enabled: true, channels: ["in_app"] },
        contract_rejected: { enabled: true, channels: ["in_app", "email"] },
        comment_added: { enabled: true, channels: ["in_app"] },
        mention: { enabled: true, channels: ["in_app", "email", "push"] },
        task_assigned: { enabled: true, channels: ["in_app", "email"] },
        task_completed: { enabled: true, channels: ["in_app"] },
        reminder: { enabled: true, channels: ["in_app", "email", "push"] },
        sync_completed: { enabled: false, channels: ["in_app"] },
        sync_failed: { enabled: true, channels: ["in_app", "email"] },
        system_update: { enabled: true, channels: ["in_app"] },
        security_alert: { enabled: true, channels: ["in_app", "email", "push"] },
      },
      globalQuietHours: null,
      emailDigestFrequency: "instant" as const,
    };

    return NextResponse.json({
      success: true,
      data: preferences?.preferences || defaultPreferences,
    });
  } catch (error) {
    console.error("[Notification Preferences GET Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = preferencesSchema.parse(body);

    const updated = await prisma.notificationPreferences.upsert({
      where: { userId: session.user.id },
      update: { preferences: validated as any, updatedAt: new Date() },
      create: {
        userId: session.user.id,
        preferences: validated as any,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated.preferences,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("[Notification Preferences PUT Error]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
