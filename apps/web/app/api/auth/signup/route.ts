/**
 * User Registration API
 * Handles new user signup with optional organization creation
 */

import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { auditTrailService } from 'data-orchestration/services';
import { getPublicApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  organizationName: z.string().optional(),
  organizationSlug: z.string().optional(),
  inviteToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const ctx = getPublicApiContext(request);
  try {
    const body = await request.json();
    const validated = signupSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return createErrorResponse(
        ctx, 'CONFLICT',
        "An account with this email already exists",
        409
      );
    }

    if (validated.inviteToken) {
      // Joining via invite - find the invitation
      const invitation = await prisma.teamInvitation.findFirst({
        where: {
          token: validated.inviteToken,
          email: validated.email,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        include: { tenant: true },
      });

      if (!invitation) {
        return createErrorResponse(
          ctx, 'BAD_REQUEST',
          "Invalid or expired invitation",
          400
        );
      }

      const tenantId = invitation.tenantId;
      const userRole = invitation.role;

      // Wrap invite acceptance + user creation in a transaction to prevent
      // duplicate users from concurrent requests with the same invite token
      const passwordHash = await hash(validated.password, 12);

      const result = await prisma.$transaction(async (tx) => {
        // Re-check invitation status inside transaction to prevent race condition
        const freshInvitation = await tx.teamInvitation.findUnique({
          where: { id: invitation.id },
        });
        if (!freshInvitation || freshInvitation.status !== 'PENDING') {
          throw new Error('Invitation already accepted');
        }

        // Mark invitation as accepted
        await tx.teamInvitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });

        // Create user
        const user = await tx.user.create({
          data: {
            email: validated.email,
            firstName: validated.firstName,
            lastName: validated.lastName,
            passwordHash,
            tenantId,
            role: userRole,
            status: "ACTIVE",
            emailVerified: false,
          },
        });

        // Find or create the role
        let roleRecord = await tx.role.findFirst({
          where: { name: userRole },
        });
        if (!roleRecord) {
          roleRecord = await tx.role.create({
            data: {
              name: userRole,
              description: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} role`,
              isSystem: true,
            },
          });
        }

        // Assign role to user
        await tx.userRole.create({
          data: { userId: user.id, roleId: roleRecord.id },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: user.id,
            action: "USER_REGISTERED",
            entityType: "USER",
            entityId: user.id,
            metadata: {
              email: validated.email,
              role: userRole,
              method: "invitation",
            },
          },
        });

        return user;
      });

      return createSuccessResponse(ctx, {
        success: true,
        message: "Account created successfully",
        user: {
          id: result.id,
          email: result.email,
          firstName: result.firstName,
          lastName: result.lastName,
        },
      });
    } else if (validated.organizationName && validated.organizationSlug) {
      // Creating a new organization
      const existingTenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { name: validated.organizationName },
            { slug: validated.organizationSlug },
          ],
        },
      });

      if (existingTenant) {
        return createErrorResponse(
          ctx, 'CONFLICT',
          "An organization with this name or URL already exists",
          409
        );
      }

      // Hash password before transaction
      const passwordHash = await hash(validated.password, 12);

      // Wrap entire creation in a transaction to prevent orphaned records
      const result = await prisma.$transaction(async (tx) => {
        // Create new tenant
        const tenant = await tx.tenant.create({
          data: {
            name: validated.organizationName!,
            slug: validated.organizationSlug!,
            status: "ACTIVE",
            configuration: {
              create: {
                aiModels: {},
                securitySettings: {},
                integrations: {},
                workflowSettings: {},
              },
            },
            subscription: {
              create: {
                plan: "FREE",
                status: "ACTIVE",
                billingCycle: "MONTHLY",
                startDate: new Date(),
              },
            },
            usage: {
              create: {
                resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        });

        // Create user
        const user = await tx.user.create({
          data: {
            email: validated.email,
            firstName: validated.firstName,
            lastName: validated.lastName,
            passwordHash,
            tenantId: tenant.id,
            role: "owner",
            status: "ACTIVE",
            emailVerified: false,
          },
        });

        // Find or create the role
        let roleRecord = await tx.role.findFirst({
          where: { name: "owner" },
        });
        if (!roleRecord) {
          roleRecord = await tx.role.create({
            data: {
              name: "owner",
              description: "Owner role",
              isSystem: true,
            },
          });
        }

        // Assign role to user
        await tx.userRole.create({
          data: { userId: user.id, roleId: roleRecord.id },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            action: "USER_REGISTERED",
            entityType: "USER",
            entityId: user.id,
            metadata: {
              email: validated.email,
              role: "owner",
              method: "self-registration",
            },
          },
        });

        return { user, tenantId: tenant.id };
      });

      return createSuccessResponse(ctx, {
        success: true,
        message: "Account created successfully",
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
      });
    } else {
      return createErrorResponse(
        ctx, 'BAD_REQUEST',
        "Organization name and URL are required, or provide an invite token",
        400
      );
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      const zodError = error as { errors?: Array<{ message?: string }> };
      return createErrorResponse(
        ctx, 'VALIDATION_ERROR',
        zodError.errors?.[0]?.message || "Invalid input",
        400
      );
    }

    // Log the actual error for debugging
    logger.error('[Signup] Error', error);
    
    // Extract useful error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Failed to create account";
    
    return createErrorResponse(
      ctx, 'INTERNAL_ERROR',
      errorMessage,
      500
    );
  }
}
