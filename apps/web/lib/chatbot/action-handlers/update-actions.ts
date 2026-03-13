/**
 * Update Actions Handler
 * Handles contract update operations triggered via chatbot
 * 
 * This enables bi-directional data flow:
 * - User asks chatbot to update contract fields
 * - Chatbot proposes changes and requests confirmation
 * - On approval, changes are written to the database
 * - RAG is automatically re-indexed
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';
import { prisma } from '@/lib/prisma';
import { queueRAGReindex } from '@/lib/rag/reindex-helper';
import { redis } from '@/lib/redis';

const PENDING_ACTION_PREFIX = 'pending_action:';
const PENDING_ACTION_TTL = 300; // 5 minutes in seconds

export interface PendingAction {
  id: string;
  type: 'update_field' | 'update_date' | 'update_status' | 'update_value' | 'update_party';
  contractId: string;
  tenantId: string;
  userId?: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

export interface UpdateIntent extends DetectedIntent {
  action: 'update_expiration' | 'update_effective_date' | 'update_value' | 'update_status' | 
          'update_title' | 'update_supplier' | 'update_client' | 'update_category' |
          'confirm_action' | 'reject_action';
  entities: DetectedIntent['entities'] & {
    contractId?: string;
    fieldToUpdate?: string;
    newValue?: string | number | Date;
    pendingActionId?: string;
  };
}

// Field mapping from natural language to database fields
const FIELD_MAPPINGS: Record<string, { dbField: string; type: 'date' | 'string' | 'number' | 'status' }> = {
  'expiration': { dbField: 'expirationDate', type: 'date' },
  'expiration date': { dbField: 'expirationDate', type: 'date' },
  'expiry': { dbField: 'expirationDate', type: 'date' },
  'expires': { dbField: 'expirationDate', type: 'date' },
  'effective': { dbField: 'effectiveDate', type: 'date' },
  'effective date': { dbField: 'effectiveDate', type: 'date' },
  'start date': { dbField: 'effectiveDate', type: 'date' },
  'starts': { dbField: 'effectiveDate', type: 'date' },
  'value': { dbField: 'totalValue', type: 'number' },
  'contract value': { dbField: 'totalValue', type: 'number' },
  'total value': { dbField: 'totalValue', type: 'number' },
  'amount': { dbField: 'totalValue', type: 'number' },
  'title': { dbField: 'contractTitle', type: 'string' },
  'name': { dbField: 'contractTitle', type: 'string' },
  'supplier': { dbField: 'supplierName', type: 'string' },
  'vendor': { dbField: 'supplierName', type: 'string' },
  'client': { dbField: 'clientName', type: 'string' },
  'customer': { dbField: 'clientName', type: 'string' },
  'status': { dbField: 'status', type: 'status' },
  'category': { dbField: 'category', type: 'string' },
};

// Valid status values
const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'PENDING_SIGNATURE', 'PENDING_APPROVAL', 'EXPIRED', 'TERMINATED', 'ON_HOLD'];

/**
 * Parse a date from natural language
 */
function parseDate(input: string): Date | null {
  const lower = input.toLowerCase().trim();
  const now = new Date();
  
  // Handle relative dates
  if (lower.includes('next month')) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  if (lower.includes('next year')) {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  if (lower.includes('in 30 days') || lower.includes('30 days from now')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 30);
    return d;
  }
  if (lower.includes('in 90 days') || lower.includes('90 days from now')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 90);
    return d;
  }
  
  // Handle month + year formats
  const monthYearMatch = lower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})/i);
  if (monthYearMatch) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = months[monthYearMatch[1].toLowerCase().slice(0, 3)];
    const year = parseInt(monthYearMatch[2]);
    return new Date(year, month, 1);
  }
  
  // Try standard date parsing
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
}

/**
 * Parse a number from natural language
 */
function parseNumber(input: string): number | null {
  const lower = input.toLowerCase().trim();
  
  // Handle multipliers
  let multiplier = 1;
  if (lower.includes('million') || lower.includes('m')) {
    multiplier = 1000000;
  } else if (lower.includes('thousand') || lower.includes('k')) {
    multiplier = 1000;
  }
  
  // Extract number
  const numMatch = lower.match(/[\d,]+\.?\d*/);
  if (numMatch) {
    const num = parseFloat(numMatch[0].replace(/,/g, ''));
    return num * multiplier;
  }
  
  return null;
}

/**
 * Generate a unique action ID
 */
function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a pending action for user confirmation
 */
export async function createPendingAction(
  type: PendingAction['type'],
  contractId: string,
  tenantId: string,
  field: string,
  oldValue: unknown,
  newValue: unknown,
  reason: string,
  userId?: string
): Promise<PendingAction> {
  const action: PendingAction = {
    id: generateActionId(),
    type,
    contractId,
    tenantId,
    userId,
    field,
    oldValue,
    newValue,
    reason,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + PENDING_ACTION_TTL * 1000),
    status: 'pending',
  };
  
  await redis.set(
    `${PENDING_ACTION_PREFIX}${action.id}`,
    JSON.stringify(action),
    'EX',
    PENDING_ACTION_TTL
  );
  
  return action;
}

/**
 * Get a pending action by ID
 */
export async function getPendingAction(actionId: string): Promise<PendingAction | null> {
  const raw = await redis.get(`${PENDING_ACTION_PREFIX}${actionId}`);
  if (!raw) return null;
  
  const action: PendingAction = JSON.parse(raw);
  // Re-hydrate date strings
  action.createdAt = new Date(action.createdAt);
  action.expiresAt = new Date(action.expiresAt);
  
  // Redis TTL handles expiry, but double-check in case of clock skew
  if (new Date() > action.expiresAt) {
    await redis.del(`${PENDING_ACTION_PREFIX}${actionId}`);
    return null;
  }
  
  return action;
}

/**
 * Execute a confirmed action
 */
async function executeAction(action: PendingAction): Promise<ActionResponse> {
  try {
    // Map field to database column
    const fieldMapping = FIELD_MAPPINGS[action.field.toLowerCase()];
    if (!fieldMapping) {
      return {
        success: false,
        message: `Unknown field: ${action.field}`,
        error: 'INVALID_FIELD',
      };
    }
    
    const dbField = fieldMapping.dbField;
    
    // Update the contract
    const updateData: Record<string, unknown> = {
      [dbField]: action.newValue,
      updatedAt: new Date(),
    };
    
    await prisma.contract.update({
      where: { id: action.contractId },
      data: updateData,
    });
    
    // Queue RAG re-indexing
    await queueRAGReindex({
      contractId: action.contractId,
      tenantId: action.tenantId,
      reason: `chatbot update: ${action.field}`,
    });
    
    // Mark action as approved and remove from pending
    action.status = 'approved';
    await redis.del(`${PENDING_ACTION_PREFIX}${action.id}`);
    
    return {
      success: true,
      message: `✅ Successfully updated ${action.field}. The RAG index will be refreshed automatically.`,
      data: {
        contractId: action.contractId,
        field: action.field,
        oldValue: action.oldValue,
        newValue: action.newValue,
        ragReindexQueued: true,
      },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: 'Failed to update contract',
      error: error instanceof Error ? error.message : 'EXECUTION_ERROR',
    };
  }
}

/**
 * Main handler for update actions
 */
export async function handleUpdateActions(
  intent: UpdateIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action, entities } = intent;
  
  // Handle confirmation/rejection of pending actions
  if (action === 'confirm_action') {
    const pendingActionId = entities.pendingActionId;
    if (!pendingActionId) {
      return {
        success: false,
        message: 'No action ID provided to confirm',
        error: 'MISSING_ACTION_ID',
      };
    }
    
    const pendingAction = await getPendingAction(pendingActionId);
    if (!pendingAction) {
      return {
        success: false,
        message: 'Action not found or has expired. Please start again.',
        error: 'ACTION_NOT_FOUND',
      };
    }
    
    return executeAction(pendingAction);
  }
  
  if (action === 'reject_action') {
    const pendingActionId = entities.pendingActionId;
    if (!pendingActionId) {
      return {
        success: false,
        message: 'No action ID provided to reject',
        error: 'MISSING_ACTION_ID',
      };
    }
    
    const pendingAction = await getPendingAction(pendingActionId);
    if (pendingAction) {
      await redis.del(`${PENDING_ACTION_PREFIX}${pendingActionId}`);
    }
    
    return {
      success: true,
      message: '❌ Action cancelled. No changes were made.',
    };
  }
  
  // For update actions, we need a contract ID
  const contractId = entities.contractId;
  if (!contractId) {
    return {
      success: false,
      message: 'Please specify which contract you want to update.',
      error: 'MISSING_CONTRACT_ID',
    };
  }
  
  // Verify contract exists and belongs to tenant
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: {
      id: true,
      contractTitle: true,
      expirationDate: true,
      effectiveDate: true,
      totalValue: true,
      status: true,
      supplierName: true,
      clientName: true,
      category: true,
    },
  });
  
  if (!contract) {
    return {
      success: false,
      message: 'Contract not found or you do not have permission to modify it.',
      error: 'CONTRACT_NOT_FOUND',
    };
  }
  
  // Determine field and new value based on action
  let field: string;
  let newValue: unknown;
  let type: PendingAction['type'];
  
  switch (action) {
    case 'update_expiration':
    case 'update_effective_date': {
      field = action === 'update_expiration' ? 'expiration' : 'effective';
      const dateInput = entities.newValue as string;
      const parsedDate = parseDate(dateInput);
      
      if (!parsedDate) {
        return {
          success: false,
          message: `Could not parse date: "${dateInput}". Try formats like "Jan 2027", "next month", or "2027-01-15"`,
          error: 'INVALID_DATE',
        };
      }
      
      newValue = parsedDate;
      type = 'update_date';
      break;
    }
    
    case 'update_value': {
      field = 'value';
      const valueInput = entities.newValue as string;
      const parsedValue = parseNumber(valueInput);
      
      if (parsedValue === null) {
        return {
          success: false,
          message: `Could not parse value: "${valueInput}". Try formats like "1.5 million", "500000", or "2.5M"`,
          error: 'INVALID_VALUE',
        };
      }
      
      newValue = parsedValue;
      type = 'update_value';
      break;
    }
    
    case 'update_status': {
      field = 'status';
      const statusInput = (entities.newValue as string).toUpperCase();
      
      if (!VALID_STATUSES.includes(statusInput)) {
        return {
          success: false,
          message: `Invalid status: "${statusInput}". Valid options: ${VALID_STATUSES.join(', ')}`,
          error: 'INVALID_STATUS',
        };
      }
      
      newValue = statusInput;
      type = 'update_status';
      break;
    }
    
    case 'update_title':
    case 'update_supplier':
    case 'update_client':
    case 'update_category': {
      const fieldMap: Record<string, string> = {
        update_title: 'title',
        update_supplier: 'supplier',
        update_client: 'client',
        update_category: 'category',
      };
      field = fieldMap[action];
      newValue = entities.newValue;
      type = 'update_field';
      break;
    }
    
    default:
      return {
        success: false,
        message: `Unknown update action: ${action}`,
        error: 'UNKNOWN_ACTION',
      };
  }
  
  // Get the current value
  const fieldMapping = FIELD_MAPPINGS[field.toLowerCase()];
  const currentValue = fieldMapping ? (contract as Record<string, unknown>)[fieldMapping.dbField] : null;
  
  // Create pending action
  const pendingAction = await createPendingAction(
    type,
    contractId,
    context.tenantId,
    field,
    currentValue,
    newValue,
    `User requested update via chatbot`,
    context.userId
  );
  
  // Format values for display
  const formatValue = (val: unknown): string => {
    if (val instanceof Date) {
      return val.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (typeof val === 'number') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    if (val === null || val === undefined) {
      return '(not set)';
    }
    return String(val);
  };
  
  return {
    success: true,
    message: `📝 **Proposed Change for "${contract.contractTitle}"**

| Field | Current Value | New Value |
|-------|--------------|-----------|
| ${field.charAt(0).toUpperCase() + field.slice(1)} | ${formatValue(currentValue)} | ${formatValue(newValue)} |

⚠️ This will update the contract record and refresh the AI knowledge base.

**Do you want to proceed?**`,
    data: {
      pendingActionId: pendingAction.id,
      requiresConfirmation: true,
      contract: {
        id: contract.id,
        title: contract.contractTitle,
      },
      proposedChange: {
        field,
        oldValue: currentValue,
        newValue,
      },
      suggestedActions: [
        { label: '✅ Yes, update', action: `confirm:${pendingAction.id}` },
        { label: '❌ Cancel', action: `reject:${pendingAction.id}` },
      ],
    },
  };
}

/**
 * Detect update intent from natural language
 */
export function detectUpdateIntent(query: string): UpdateIntent | null {
  const lower = query.toLowerCase();
  
  // Patterns for update actions
  const updatePatterns = [
    // "set the expiration date to Jan 2027"
    /(?:set|change|update|modify)\s+(?:the\s+)?(expiration|expiry|effective|start)\s*(?:date)?\s+(?:to|as|=)\s+(.+)/i,
    // "extend the contract to Jan 2027"
    /extend\s+(?:the\s+)?(?:contract\s+)?(?:expiration\s+)?(?:to|until|by)\s+(.+)/i,
    // "change status to active"
    /(?:set|change|update|mark)\s+(?:the\s+)?status\s+(?:to|as)\s+(\w+)/i,
    // "update the contract value to 1.5 million"
    /(?:set|change|update)\s+(?:the\s+)?(?:contract\s+)?(?:value|amount|total)\s+(?:to|as|=)\s+(.+)/i,
    // "rename the contract to..."
    /(?:rename|change\s+the\s+title|update\s+the\s+name)\s+(?:to|as)\s+(.+)/i,
    // Confirmation patterns
    /^(?:yes|confirm|approve|proceed|do\s+it|go\s+ahead)/i,
    /^(?:no|cancel|reject|stop|don'?t|nevermind)/i,
  ];
  
  // Check for confirmation/rejection
  if (/^(?:yes|confirm|approve|proceed|do\s+it|go\s+ahead)/i.test(lower)) {
    // Look for action ID in the message
    const actionIdMatch = query.match(/confirm[:\s]+(\w+)/i);
    return {
      type: 'action',
      action: 'confirm_action',
      entities: {
        pendingActionId: actionIdMatch?.[1],
      },
      confidence: 0.95,
    };
  }
  
  if (/^(?:no|cancel|reject|stop|don'?t|nevermind)/i.test(lower)) {
    const actionIdMatch = query.match(/reject[:\s]+(\w+)/i);
    return {
      type: 'action',
      action: 'reject_action',
      entities: {
        pendingActionId: actionIdMatch?.[1],
      },
      confidence: 0.95,
    };
  }
  
  // Check for date updates
  const dateMatch = lower.match(/(?:set|change|update|modify)\s+(?:the\s+)?(expiration|expiry|effective|start)\s*(?:date)?\s+(?:to|as|=)\s+(.+)/i);
  if (dateMatch) {
    const field = dateMatch[1].toLowerCase();
    const action = field.includes('expir') ? 'update_expiration' : 'update_effective_date';
    return {
      type: 'action',
      action,
      entities: {
        fieldToUpdate: field,
        newValue: dateMatch[2].trim(),
      },
      confidence: 0.9,
    };
  }
  
  // Check for extend pattern
  const extendMatch = lower.match(/extend\s+(?:the\s+)?(?:contract\s+)?(?:expiration\s+)?(?:to|until|by)\s+(.+)/i);
  if (extendMatch) {
    return {
      type: 'action',
      action: 'update_expiration',
      entities: {
        fieldToUpdate: 'expiration',
        newValue: extendMatch[1].trim(),
      },
      confidence: 0.85,
    };
  }
  
  // Check for status updates
  const statusMatch = lower.match(/(?:set|change|update|mark)\s+(?:the\s+)?status\s+(?:to|as)\s+(\w+)/i);
  if (statusMatch) {
    return {
      type: 'action',
      action: 'update_status',
      entities: {
        fieldToUpdate: 'status',
        newValue: statusMatch[1].trim(),
      },
      confidence: 0.9,
    };
  }
  
  // Check for value updates
  const valueMatch = lower.match(/(?:set|change|update)\s+(?:the\s+)?(?:contract\s+)?(?:value|amount|total)\s+(?:to|as|=)\s+(.+)/i);
  if (valueMatch) {
    return {
      type: 'action',
      action: 'update_value',
      entities: {
        fieldToUpdate: 'value',
        newValue: valueMatch[1].trim(),
      },
      confidence: 0.9,
    };
  }
  
  return null;
}
