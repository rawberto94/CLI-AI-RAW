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

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

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
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    const enabled = await isMFAEnabled(session.user.id);
    
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
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    const body = await request.json();
    const { action, token } = body;
    
    switch (action) {
      case 'setup': {
        // Initialize MFA setup
        const result = await initializeMFASetup(session.user.id);
        
        await auditLog({
          action: AuditAction.MFA_SETUP_STARTED,
          userId: session.user.id,
          tenantId: session.user.tenantId,
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
        
        const success = await completeMFASetup(session.user.id, token);
        
        if (success) {
          await auditLog({
            action: AuditAction.MFA_ENABLED,
            userId: session.user.id,
            tenantId: session.user.tenantId,
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
        
        const success = await verifyMFAToken(session.user.id, token);
        
        if (success) {
          await auditLog({
            action: AuditAction.MFA_VERIFIED,
            userId: session.user.id,
            tenantId: session.user.tenantId,
            metadata: {},
            ...getAuditContext(request),
          });
          
          return createSuccessResponse(ctx, { success: true });
        } else {
          await auditLog({
            action: AuditAction.MFA_FAILED,
            userId: session.user.id,
            tenantId: session.user.tenantId,
            metadata: {},
            ...getAuditContext(request),
          });
          
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid token', 400);
        }
      }
      
      case 'disable': {
        // Disable MFA
        await disableMFA(session.user.id);
        
        await auditLog({
          action: AuditAction.MFA_DISABLED,
          userId: session.user.id,
          tenantId: session.user.tenantId,
          metadata: {},
          ...getAuditContext(request),
        });
        
        return createSuccessResponse(ctx, { success: true });
      }
      
      case 'regenerate-backup-codes': {
        // Regenerate backup codes
        const codes = await regenerateBackupCodes(session.user.id);
        
        await auditLog({
          action: AuditAction.MFA_BACKUP_CODES_REGENERATED,
          userId: session.user.id,
          tenantId: session.user.tenantId,
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
