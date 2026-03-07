/**
 * Contract Helper Functions
 * Utilities for determining contract lifecycle and workflow requirements
 */

export type ContractLifecycle = 'NEW' | 'EXISTING' | 'AMENDMENT' | 'RENEWAL';

/**
 * Determines if a contract requires approval workflow
 * 
 * Approval workflows should ONLY be triggered for:
 * - NEW contracts being created/negotiated (status=DRAFT, documentRole=NEW_CONTRACT)
 * - AMENDMENTS to existing contracts (documentRole=AMENDMENT)
 * 
 * Approval workflows should NOT be triggered for:
 * - EXISTING contracts being uploaded for reference/storage
 * - ARCHIVED contracts
 * - COMPLETED contracts
 */
export function requiresApprovalWorkflow(contract: {
  status?: string | null;
  documentRole?: string | null;
  metadata?: any;
}): boolean {
  // Check if explicitly marked as new contract
  if (contract.status === 'DRAFT') return true;
  if (contract.documentRole === 'NEW_CONTRACT') return true;
  if (contract.documentRole === 'AMENDMENT') return true;
  if (contract.metadata?.isNewContract === true) return true;
  
  // All other cases (EXISTING, ACTIVE, COMPLETED, ARCHIVED) do not require approval
  return false;
}

/**
 * Determines the contract lifecycle stage
 */
export function getContractLifecycle(contract: {
  status?: string | null;
  documentRole?: string | null;
  metadata?: any;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
}): ContractLifecycle {
  // Check document role first
  if (contract.documentRole === 'NEW_CONTRACT') return 'NEW';
  if (contract.documentRole === 'AMENDMENT') return 'AMENDMENT';
  if (contract.documentRole === 'RENEWAL') return 'RENEWAL';
  
  // Check status
  if (contract.status === 'DRAFT') return 'NEW';
  
  // Check metadata
  if (contract.metadata?.isNewContract === true) return 'NEW';
  if (contract.metadata?.isAmendment === true) return 'AMENDMENT';
  if (contract.metadata?.isRenewal === true) return 'RENEWAL';
  
  // Check dates - if effective date is in the future, likely a new contract
  if (contract.effectiveDate) {
    const effectiveDate = new Date(contract.effectiveDate);
    const today = new Date();
    if (effectiveDate > today) return 'NEW';
  }
  
  // Default: existing contract uploaded for reference
  return 'EXISTING';
}

/**
 * Gets human-readable description of contract lifecycle
 */
export function getLifecycleDescription(lifecycle: ContractLifecycle): string {
  switch (lifecycle) {
    case 'NEW':
      return 'New contract being created - requires approval workflow';
    case 'AMENDMENT':
      return 'Amendment to existing contract - requires approval';
    case 'RENEWAL':
      return 'Contract renewal - may require approval based on changes';
    case 'EXISTING':
      return 'Existing contract uploaded for reference - no approval needed';
  }
}

/**
 * Suggests appropriate workflow based on contract properties
 */
export function suggestWorkflow(contract: {
  totalValue?: number | null;
  documentRole?: string | null;
  metadata?: any;
}): 'express' | 'standard' | 'executive' | 'legal_review' | null {
  if (!requiresApprovalWorkflow(contract)) {
    return null; // No workflow needed
  }
  
  const value = contract.totalValue || 0;
  
  // High-value contracts need executive approval
  if (value > 500000) return 'executive';
  
  // Legal amendments always go through legal review
  if (contract.documentRole === 'AMENDMENT') return 'legal_review';
  
  // Medium-value contracts get standard approval
  if (value > 50000) return 'standard';
  
  // Low-value new contracts get express approval
  return 'express';
}
