/**
 * User Registration API
 * Handles new user signup with optional organization creation
 */

import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { auditTrailService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

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
  const ctx = getApiContext(request);
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

    let tenantId: string;
    let userRole = "member";

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

      tenantId = invitation.tenantId;
      userRole = invitation.role;

      // Mark invitation as accepted
      await prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
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

      // Create new tenant
      const tenant = await prisma.tenant.create({
        data: {
          name: validated.organizationName,
          slug: validated.organizationSlug,
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

      tenantId = tenant.id;
      userRole = "owner"; // Creator becomes owner
    } else {
      return createErrorResponse(
        ctx, 'BAD_REQUEST',
        "Organization name and URL are required, or provide an invite token",
        400
      );
    }

    // Hash password
    const passwordHash = await hash(validated.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        firstName: validated.firstName,
        lastName: validated.lastName,
        passwordHash,
        tenantId,
        role: userRole,
        status: "ACTIVE",
        emailVerified: false, // Would need email verification flow
      },
    });

    // Find or create the role
    let roleRecord = await prisma.role.findFirst({
      where: { name: userRole },
    });

    if (!roleRecord) {
      roleRecord = await prisma.role.create({
        data: {
          name: userRole,
          description: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} role`,
          isSystem: true,
        },
      });
    }

    // Assign role to user
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: roleRecord.id,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "USER_REGISTERED",
        entityType: "USER",
        entityId: user.id,
        metadata: {
          email: validated.email,
          role: userRole,
          method: validated.inviteToken ? "invitation" : "self-registration",
        },
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: "Account created successfully",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      const zodError = error as { errors?: Array<{ message?: string }> };
      return createErrorResponse(
        ctx, 'VALIDATION_ERROR',
        zodError.errors?.[0]?.message || "Invalid input",
        400
      );
    }

    return createErrorResponse(
      ctx, 'INTERNAL_ERROR',
      "Failed to create account",
      500
    );
  }
}
