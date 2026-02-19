/**
 * MFA API Routes
 * 
 * POST /api/auth/mfa/setup - Initialize MFA setup
 * POST /api/auth/mfa/verify-setup - Complete MFA setup
 * POST /api/auth/mfa/verify - Verify MFA token during login
 * POST /api/auth/mfa/disable - Disable MFA
 * POST /api/auth/mfa/backup-codes - Regenerate backup codes
 * GET /api/auth/mfa/status - Check MFA status
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

import {
  initializeMFASetup,
  completeMFASetup,
  verifyMFAToken,
  disableMFA,
  isMFAEnabled,
  regenerateBackupCodes,
} from '@/lib/security/mfa';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';

/**
 * GET /api/auth/mfa/status - Check MFA status
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const enabled = await isMFAEnabled(ctx.userId);
    
    return createSuccessResponse(ctx, {
      mfaEnabled: enabled,
    });
  } catch (error) {
    console.error('[MFA Status Error]:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to get MFA status', 500);
  }
});

/**
 * POST /api/auth/mfa - Handle various MFA operations
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { action, token } = body;
    
    switch (action) {
      case 'setup': {
        // Initialize MFA setup
        const result = await initializeMFASetup(ctx.userId);
        
        await auditLog({
          action: AuditAction.MFA_SETUP_STARTED,
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          metadata: {},
          ...getAuditContext(request),
        });
        
        return createSuccessResponse(ctx, {
          qrCodeUri: result.qrCodeUri,
          secret: result.secret, // For manual entry
          backupCodes: result.backupCodes,
        });
      }
      
      case 'verify-setup': {
        // Complete MFA setup by verifying first token
        if (!token) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Token required', 400);
        }
        
        const success = await completeMFASetup(ctx.userId, token);
        
        if (success) {
          await auditLog({
            action: AuditAction.MFA_ENABLED,
            userId: ctx.userId,
            tenantId: ctx.tenantId,
            metadata: { method: 'totp' },
            ...getAuditContext(request),
          });
          
          return createSuccessResponse(ctx, { success: true });
        } else {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid token', 400);
        }
      }
      
      case 'verify': {
        // Verify MFA token during login
        if (!token) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Token required', 400);
        }
        
        const success = await verifyMFAToken(ctx.userId, token);
        
        if (success) {
          await auditLog({
            action: AuditAction.MFA_VERIFIED,
            userId: ctx.userId,
            tenantId: ctx.tenantId,
            metadata: {},
            ...getAuditContext(request),
          });
          
          return createSuccessResponse(ctx, { success: true });
        } else {
          await auditLog({
            action: AuditAction.MFA_FAILED,
            userId: ctx.userId,
            tenantId: ctx.tenantId,
            metadata: {},
            ...getAuditContext(request),
          });
          
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid token', 400);
        }
      }
      
      case 'disable': {
        // L21 FIX: Require current TOTP code or password to disable MFA
        if (!token && !body.password) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Current TOTP code or password required to disable MFA', 400);
        }

        // Verify the user can disable (via TOTP or password)
        if (token) {
          const isValid = await verifyMFAToken(ctx.userId, token);
          if (!isValid) {
            return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid verification code', 400);
          }
        } else if (body.password) {
          const { compare } = await import('bcryptjs');
          const { prisma } = await import('@/lib/prisma');
          const user = await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { passwordHash: true },
          });
          if (!user?.passwordHash) {
            return createErrorResponse(ctx, 'BAD_REQUEST', 'Password verification not available for SSO accounts', 400);
          }
          const valid = await compare(body.password, user.passwordHash);
          if (!valid) {
            return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid password', 400);
          }
        }

        await disableMFA(ctx.userId);
        
        await auditLog({
          action: AuditAction.MFA_DISABLED,
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          metadata: {},
          ...getAuditContext(request),
        });
        
        return createSuccessResponse(ctx, { success: true });
      }
      
      case 'regenerate-backup-codes': {
        // Regenerate backup codes
        const codes = await regenerateBackupCodes(ctx.userId);
        
        await auditLog({
          action: AuditAction.MFA_BACKUP_CODES_REGENERATED,
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          metadata: {},
          ...getAuditContext(request),
        });
        
        return createSuccessResponse(ctx, { backupCodes: codes });
      }
      
      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
    }
  } catch (error) {
    console.error('[MFA Error]:', error);
    return createErrorResponse(
      ctx,
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'MFA operation failed',
      500
    );
  }
});
