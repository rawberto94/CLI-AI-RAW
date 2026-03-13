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

import { NextRequest } from 'next/server';
import { executeAction, detectUpdateIntent } from '@/lib/chatbot/action-handlers';
import { getPendingAction } from '@/lib/chatbot/action-handlers/update-actions';
import type { ChatContext, DetectedIntent } from '@/lib/chatbot/types';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

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

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
    const body: ActionRequest = await request.json();
    const { message, contractId, action, entities, pendingActionId, confirm } = body;

    // Build context
    const context: ChatContext = {
      tenantId,
      userId,
      currentContractId: contractId };

    // Handle confirmation/rejection of pending actions
    if (pendingActionId !== undefined) {
      const pendingAction = await getPendingAction(pendingActionId);
      
      if (!pendingAction) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Action not found or has expired. Please try again.', 404);
      }

      const intent = {
        type: 'action' as const,
        action: (confirm ? 'confirm_action' : 'reject_action') as DetectedIntent['action'],
        entities: { pendingActionId },
        confidence: 1.0 } satisfies DetectedIntent;

      const result = await executeAction(intent, context);
      return createSuccessResponse(ctx, result);
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
        return createSuccessResponse(ctx, result);
      }

      // Not an update intent - return guidance
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'This endpoint handles contract updates. Try phrases like:\n' +
          '- "Set the expiration date to Jan 2027"\n' +
          '- "Update the contract value to 1.5 million"\n' +
          '- "Change status to ACTIVE"', 400);
    }

    // Handle direct action request
    if (action && entities) {
      const intent = {
        type: 'action' as const,
        action: action as DetectedIntent['action'],
        entities: {
          ...entities,
          contractId: (contractId || entities.contractId) as string },
        confidence: 1.0 } satisfies DetectedIntent;

      const result = await executeAction(intent, context);
      return createSuccessResponse(ctx, result);
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid request. Provide message, action/entities, or pendingActionId.', 400);

  });

/**
 * GET /api/ai/chat/actions - Get action status or available actions
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const searchParams = request.nextUrl.searchParams;
  const actionId = searchParams.get('actionId');
  
  if (actionId) {
    const pendingAction = await getPendingAction(actionId);
    
    if (!pendingAction) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Action not found or has expired', 404);
    }
    
    return createSuccessResponse(ctx, {
      action: {
        id: pendingAction.id,
        type: pendingAction.type,
        field: pendingAction.field,
        oldValue: pendingAction.oldValue,
        newValue: pendingAction.newValue,
        status: pendingAction.status,
        expiresAt: pendingAction.expiresAt.toISOString(),
        createdAt: pendingAction.createdAt.toISOString() } });
  }
  
  // Return available actions
  return createSuccessResponse(ctx, {
    availableActions: [
      {
        action: 'update_expiration',
        description: 'Update contract expiration date',
        examples: ['Set expiration to Jan 2027', 'Extend contract to next year'] },
      {
        action: 'update_effective_date',
        description: 'Update contract effective/start date',
        examples: ['Set start date to March 1, 2025'] },
      {
        action: 'update_value',
        description: 'Update contract total value',
        examples: ['Set value to 1.5 million', 'Update amount to $500,000'] },
      {
        action: 'update_status',
        description: 'Update contract status',
        examples: ['Change status to ACTIVE', 'Mark as EXPIRED'],
        validStatuses: ['DRAFT', 'ACTIVE', 'PENDING_SIGNATURE', 'PENDING_APPROVAL', 'EXPIRED', 'TERMINATED', 'ON_HOLD'] },
      {
        action: 'update_title',
        description: 'Update contract title/name',
        examples: ['Rename to "2025 MSA Agreement"'] },
      {
        action: 'update_supplier',
        description: 'Update supplier/vendor name',
        examples: ['Change supplier to Acme Corp'] },
      {
        action: 'update_client',
        description: 'Update client/customer name',
        examples: ['Set client to XYZ Industries'] },
    ],
    usage: {
      naturalLanguage: 'POST with { message: "update text", contractId: "..." }',
      directAction: 'POST with { action: "update_expiration", entities: { newValue: "..." }, contractId: "..." }',
      confirmation: 'POST with { pendingActionId: "...", confirm: true/false }' } });
});
