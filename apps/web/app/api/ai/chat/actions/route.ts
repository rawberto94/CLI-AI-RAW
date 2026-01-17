/**
 * Chatbot Actions API
 * 
 * POST /api/ai/chat/actions - Execute chatbot actions (bi-directional updates)
 * 
 * This endpoint handles:
 * - Contract field updates (dates, values, status, etc.)
 * - Confirmation/rejection of pending actions
 * - Action status queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerTenantId } from '@/lib/tenant-server';
import { executeAction, detectUpdateIntent } from '@/lib/chatbot/action-handlers';
import { getPendingAction } from '@/lib/chatbot/action-handlers/update-actions';
import type { ChatContext, DetectedIntent } from '@/lib/chatbot/types';

export const dynamic = 'force-dynamic';

interface ActionRequest {
  // For natural language updates
  message?: string;
  contractId?: string;
  
  // For direct action execution
  action?: string;
  entities?: Record<string, unknown>;
  
  // For confirmation/rejection
  pendingActionId?: string;
  confirm?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID required' },
        { status: 401 }
      );
    }

    const body: ActionRequest = await request.json();
    const { message, contractId, action, entities, pendingActionId, confirm } = body;

    // Build context
    const context: ChatContext = {
      tenantId,
      userId: request.headers.get('x-user-id') || undefined,
      currentContractId: contractId,
    };

    // Handle confirmation/rejection of pending actions
    if (pendingActionId !== undefined) {
      const pendingAction = getPendingAction(pendingActionId);
      
      if (!pendingAction) {
        return NextResponse.json({
          success: false,
          message: 'Action not found or has expired. Please try again.',
          error: 'ACTION_EXPIRED',
        });
      }

      const intent = {
        type: 'action' as const,
        action: (confirm ? 'confirm_action' : 'reject_action') as DetectedIntent['action'],
        entities: { pendingActionId },
        confidence: 1.0,
      } satisfies DetectedIntent;

      const result = await executeAction(intent, context);
      return NextResponse.json(result);
    }

    // Handle natural language message
    if (message) {
      // Detect if this is an update intent
      const updateIntent = detectUpdateIntent(message);
      
      if (updateIntent) {
        // Add contract ID from context if available
        if (contractId && !updateIntent.entities.contractId) {
          updateIntent.entities.contractId = contractId;
        }
        
        const result = await executeAction(updateIntent as DetectedIntent, context);
        return NextResponse.json(result);
      }

      // Not an update intent - return guidance
      return NextResponse.json({
        success: false,
        message: 'This endpoint handles contract updates. Try phrases like:\n' +
          '- "Set the expiration date to Jan 2027"\n' +
          '- "Update the contract value to 1.5 million"\n' +
          '- "Change status to ACTIVE"',
        error: 'NOT_UPDATE_INTENT',
      });
    }

    // Handle direct action request
    if (action && entities) {
      const intent = {
        type: 'action' as const,
        action: action as DetectedIntent['action'],
        entities: {
          ...entities,
          contractId: (contractId || entities.contractId) as string,
        },
        confidence: 1.0,
      } satisfies DetectedIntent;

      const result = await executeAction(intent, context);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Invalid request. Provide message, action/entities, or pendingActionId.' },
      { status: 400 }
    );

  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/chat/actions - Get action status or available actions
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const actionId = searchParams.get('actionId');
  
  if (actionId) {
    const pendingAction = getPendingAction(actionId);
    
    if (!pendingAction) {
      return NextResponse.json({
        success: false,
        message: 'Action not found or has expired',
        error: 'ACTION_NOT_FOUND',
      });
    }
    
    return NextResponse.json({
      success: true,
      action: {
        id: pendingAction.id,
        type: pendingAction.type,
        field: pendingAction.field,
        oldValue: pendingAction.oldValue,
        newValue: pendingAction.newValue,
        status: pendingAction.status,
        expiresAt: pendingAction.expiresAt.toISOString(),
        createdAt: pendingAction.createdAt.toISOString(),
      },
    });
  }
  
  // Return available actions
  return NextResponse.json({
    success: true,
    availableActions: [
      {
        action: 'update_expiration',
        description: 'Update contract expiration date',
        examples: ['Set expiration to Jan 2027', 'Extend contract to next year'],
      },
      {
        action: 'update_effective_date',
        description: 'Update contract effective/start date',
        examples: ['Set start date to March 1, 2025'],
      },
      {
        action: 'update_value',
        description: 'Update contract total value',
        examples: ['Set value to 1.5 million', 'Update amount to $500,000'],
      },
      {
        action: 'update_status',
        description: 'Update contract status',
        examples: ['Change status to ACTIVE', 'Mark as EXPIRED'],
        validStatuses: ['DRAFT', 'ACTIVE', 'PENDING_SIGNATURE', 'PENDING_APPROVAL', 'EXPIRED', 'TERMINATED', 'ON_HOLD'],
      },
      {
        action: 'update_title',
        description: 'Update contract title/name',
        examples: ['Rename to "2025 MSA Agreement"'],
      },
      {
        action: 'update_supplier',
        description: 'Update supplier/vendor name',
        examples: ['Change supplier to Acme Corp'],
      },
      {
        action: 'update_client',
        description: 'Update client/customer name',
        examples: ['Set client to XYZ Industries'],
      },
    ],
    usage: {
      naturalLanguage: 'POST with { message: "update text", contractId: "..." }',
      directAction: 'POST with { action: "update_expiration", entities: { newValue: "..." }, contractId: "..." }',
      confirmation: 'POST with { pendingActionId: "...", confirm: true/false }',
    },
  });
}
