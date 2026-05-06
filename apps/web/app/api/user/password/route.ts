/**
 * POST /api/user/password
 *
 * Lets a signed-in user change their own password. Verifies the current
 * password, hashes the new one with bcrypt (matching the cost used at
 * registration and in auth.ts), and writes an audit log entry. The UI at
 * `app/settings/profile/page.tsx` calls this endpoint.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { compare, hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Enforce a meaningful minimum. The app uses bcrypt (72-byte cap) so the
// upper bound guards against DoS via very large inputs.
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password must be at most 128 characters'),
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid JSON body', 400);
  }

  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      ctx,
      'VALIDATION_ERROR',
      parsed.error.errors[0]?.message ?? 'Invalid request',
      400,
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return createErrorResponse(
      ctx,
      'VALIDATION_ERROR',
      'New password must be different from current password',
      400,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    // Accounts provisioned via SSO have no passwordHash — surface a clear 400.
    return createErrorResponse(
      ctx,
      'BAD_REQUEST',
      'Password change is not available for this account',
      400,
    );
  }

  // Validate bcrypt hash format before comparing (defensive; matches auth.ts).
  if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(user.passwordHash)) {
    logger.error('[PasswordChange] Malformed password hash on user', { userId: ctx.userId });
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Password change failed', 500);
  }

  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) {
    await auditLog({
      action: AuditAction.PASSWORD_CHANGED,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      metadata: { outcome: 'rejected', reason: 'invalid_current_password' },
      ...getAuditContext(request),
    }).catch((err) => logger.error('[PasswordChange] audit log failed', err));
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Current password is incorrect', 400);
  }

  const newHash = await hash(newPassword, 12);

  await prisma.user.update({
    where: { id: ctx.userId },
    data: { passwordHash: newHash },
  });

  await auditLog({
    action: AuditAction.PASSWORD_CHANGED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    metadata: { outcome: 'success' },
    ...getAuditContext(request),
  }).catch((err) => logger.error('[PasswordChange] audit log failed', err));

  return createSuccessResponse(ctx, { success: true });
});
