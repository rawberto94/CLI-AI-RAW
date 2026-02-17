/**
 * Delegation Rules API Route
 * 
 * CRUD operations for personal delegation rules — allows users to delegate
 * their approval authority to other team members (out-of-office, backup routing).
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// =============================================================================
// SCHEMAS
// =============================================================================

const CreateDelegationRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  delegateTo: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
  }),
  triggerType: z.enum(['date_range', 'always', 'condition']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  approvalTypes: z.array(z.enum(['contract', 'amendment', 'renewal', 'termination'])),
  priority: z.enum(['low', 'medium', 'high', 'all']).default('all'),
  isActive: z.boolean().default(true),
  notifyOnDelegation: z.boolean().default(true),
});

const UpdateDelegationRuleSchema = CreateDelegationRuleSchema.partial().extend({
  id: z.string(),
});

// =============================================================================
// GET — List delegation rules for current user + team members
// =============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const { searchParams } = new URL(request.url);
  const includeTeamMembers = searchParams.get('includeTeamMembers') === 'true';

  try {
    // Fetch delegation rules for the current user
    const rules = await prisma.delegationRule.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
    });

    const formattedRules = rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      delegateTo: {
        id: rule.delegateToId,
        name: rule.delegateToName,
        email: rule.delegateToEmail,
      },
      triggerType: rule.triggerType,
      startDate: rule.startDate?.toISOString().split('T')[0],
      endDate: rule.endDate?.toISOString().split('T')[0],
      approvalTypes: rule.approvalTypes,
      priority: rule.priority,
      isActive: rule.isActive,
      notifyOnDelegation: rule.notifyOnDelegation,
      createdAt: rule.createdAt.toISOString(),
    }));

    // Optionally fetch team members from the same tenant
    let teamMembers: Array<{ id: string; name: string; email: string; role: string }> = [];
    if (includeTeamMembers) {
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          id: { not: userId }, // exclude self
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
        take: 50,
        orderBy: { firstName: 'asc' },
      });

      teamMembers = users.map(u => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        email: u.email,
        role: u.role || 'member',
      }));
    }

    return createSuccessResponse(ctx, {
      rules: formattedRules,
      ...(includeTeamMembers && { teamMembers }),
    });
  } catch (error) {
    console.error('[Delegation Rules GET]', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch delegation rules', 500);
  }
});

// =============================================================================
// POST — Create a new delegation rule
// =============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  try {
    const body = await request.json();
    const parsed = CreateDelegationRuleSchema.parse(body);

    const rule = await prisma.delegationRule.create({
      data: {
        tenantId,
        userId,
        name: parsed.name,
        delegateToId: parsed.delegateTo.id,
        delegateToName: parsed.delegateTo.name,
        delegateToEmail: parsed.delegateTo.email,
        triggerType: parsed.triggerType,
        startDate: parsed.startDate ? new Date(parsed.startDate) : null,
        endDate: parsed.endDate ? new Date(parsed.endDate) : null,
        approvalTypes: parsed.approvalTypes,
        priority: parsed.priority,
        isActive: parsed.isActive,
        notifyOnDelegation: parsed.notifyOnDelegation,
      },
    });

    return createSuccessResponse(ctx, {
      rule: {
        id: rule.id,
        name: rule.name,
        delegateTo: {
          id: rule.delegateToId,
          name: rule.delegateToName,
          email: rule.delegateToEmail,
        },
        triggerType: rule.triggerType,
        startDate: rule.startDate?.toISOString().split('T')[0],
        endDate: rule.endDate?.toISOString().split('T')[0],
        approvalTypes: rule.approvalTypes,
        priority: rule.priority,
        isActive: rule.isActive,
        notifyOnDelegation: rule.notifyOnDelegation,
        createdAt: rule.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors[0]?.message || 'Invalid input', 400);
    }
    console.error('[Delegation Rules POST]', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create delegation rule', 500);
  }
});

// =============================================================================
// PATCH — Update an existing delegation rule
// =============================================================================

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  try {
    const body = await request.json();
    const parsed = UpdateDelegationRuleSchema.parse(body);

    // Verify ownership
    const existing = await prisma.delegationRule.findFirst({
      where: { id: parsed.id, tenantId, userId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Delegation rule not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.delegateTo !== undefined) {
      updateData.delegateToId = parsed.delegateTo.id;
      updateData.delegateToName = parsed.delegateTo.name;
      updateData.delegateToEmail = parsed.delegateTo.email;
    }
    if (parsed.triggerType !== undefined) updateData.triggerType = parsed.triggerType;
    if (parsed.startDate !== undefined) updateData.startDate = new Date(parsed.startDate);
    if (parsed.endDate !== undefined) updateData.endDate = new Date(parsed.endDate);
    if (parsed.approvalTypes !== undefined) updateData.approvalTypes = parsed.approvalTypes;
    if (parsed.priority !== undefined) updateData.priority = parsed.priority;
    if (parsed.isActive !== undefined) updateData.isActive = parsed.isActive;
    if (parsed.notifyOnDelegation !== undefined) updateData.notifyOnDelegation = parsed.notifyOnDelegation;

    const rule = await prisma.delegationRule.update({
      where: { id: parsed.id },
      data: updateData,
    });

    return createSuccessResponse(ctx, {
      rule: {
        id: rule.id,
        name: rule.name,
        delegateTo: {
          id: rule.delegateToId,
          name: rule.delegateToName,
          email: rule.delegateToEmail,
        },
        triggerType: rule.triggerType,
        startDate: rule.startDate?.toISOString().split('T')[0],
        endDate: rule.endDate?.toISOString().split('T')[0],
        approvalTypes: rule.approvalTypes,
        priority: rule.priority,
        isActive: rule.isActive,
        notifyOnDelegation: rule.notifyOnDelegation,
        createdAt: rule.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors[0]?.message || 'Invalid input', 400);
    }
    console.error('[Delegation Rules PATCH]', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update delegation rule', 500);
  }
});

// =============================================================================
// DELETE — Remove a delegation rule
// =============================================================================

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const { searchParams } = new URL(request.url);
  const ruleId = searchParams.get('id');

  if (!ruleId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Rule ID is required', 400);
  }

  try {
    // Verify ownership
    const existing = await prisma.delegationRule.findFirst({
      where: { id: ruleId, tenantId, userId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Delegation rule not found', 404);
    }

    await prisma.delegationRule.delete({
      where: { id: ruleId },
    });

    return createSuccessResponse(ctx, {
      deleted: true,
      id: ruleId,
    });
  } catch (error) {
    console.error('[Delegation Rules DELETE]', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete delegation rule', 500);
  }
});
