/**
 * Notification Preferences API
 * 
 * Handles user notification preferences management.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext } from '@/lib/api-middleware';
import { notificationService } from 'data-orchestration/services';

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
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
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

  // Map flat database fields to API response
  const responsePreferences = preferences ? {
    emailEnabled: preferences.emailEnabled,
    pushEnabled: preferences.pushEnabled,
    emailDigestFrequency: preferences.emailDigest,
    contractDeadlines: preferences.contractDeadlines,
    approvalRequests: preferences.approvalRequests,
    systemUpdates: preferences.systemUpdates,
    systemAlerts: preferences.systemAlerts,
    globalQuietHours: preferences.quietHoursStart ? {
      start: preferences.quietHoursStart,
      end: preferences.quietHoursEnd,
      timezone: preferences.quietHoursTimezone ?? "UTC",
    } : null,
    // Include default channel settings
    channels: defaultPreferences.channels,
  } : defaultPreferences;

  return createSuccessResponse(ctx, {
    success: true,
    data: responsePreferences,
  });
});

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
export async function PUT(req: NextRequest) {
  const ctx = getApiContext(req);
  try {
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await req.json();
    const validated = preferencesSchema.parse(body);

    // Map API input to flat database fields
    const updateData = {
      emailEnabled: true,
      pushEnabled: true,
      emailDigest: validated.emailDigestFrequency || "daily",
      quietHoursStart: validated.globalQuietHours?.start || null,
      quietHoursEnd: validated.globalQuietHours?.end || null,
      quietHoursTimezone: validated.globalQuietHours?.timezone || "UTC",
    };

    const updated = await prisma.notificationPreferences.upsert({
      where: { userId: session.user.id },
      update: { ...updateData, updatedAt: new Date() },
      create: {
        userId: session.user.id,
        tenantId: session.user.id,
        ...updateData,
      },
    });

    return createSuccessResponse(ctx, {
      emailEnabled: updated.emailEnabled,
      pushEnabled: updated.pushEnabled,
      emailDigestFrequency: updated.emailDigest,
      globalQuietHours: updated.quietHoursStart ? {
        start: updated.quietHoursStart,
        end: updated.quietHoursEnd,
        timezone: updated.quietHoursTimezone ?? "UTC",
      } : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Validation failed', 400, { details: error.errors.map(e => e.message).join('; ') });
    }
    console.error("[Notification Preferences PUT Error]", error);
    return handleApiError(ctx, error);
  }
}
