/**
 * Webhook Triggers
 * 
 * Helper functions to trigger webhooks from various parts of the application.
 * These should be called after relevant events occur.
 */

import { WEBHOOK_EVENTS, WebhookEvent } from '@/app/api/webhooks/route';

export { WEBHOOK_EVENTS, type WebhookEvent };

interface TriggerOptions {
  tenantId: string;
  event: WebhookEvent;
  data: Record<string, unknown>;
}

/**
 * Trigger webhooks for an event
 * 
 * @param options - The trigger options
 * @returns Promise with the trigger result
 */
export async function triggerWebhook(options: TriggerOptions): Promise<{
  success: boolean;
  delivered: number;
  failed: number;
  error?: string;
}> {
  const { tenantId, event, data } = options;
  
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/webhooks/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
        'x-internal-secret': process.env.INTERNAL_API_SECRET || 'dev-internal-secret',
      },
      body: JSON.stringify({
        event,
        data,
        tenantId,
      }),
    });
    
    const result = await response.json();
    
    return {
      success: result.success,
      delivered: result.delivered || 0,
      failed: result.failed || 0,
      error: result.error,
    };
  } catch (error: unknown) {
    return {
      success: false,
      delivered: 0,
      failed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Convenience functions for common events

/**
 * Trigger webhook when a contract is created
 */
export async function triggerContractCreated(
  tenantId: string,
  contractId: string,
  contractData: Record<string, unknown>
) {
  return triggerWebhook({
    tenantId,
    event: 'contract.created',
    data: {
      contractId,
      ...contractData,
    },
  });
}

/**
 * Trigger webhook when a contract is updated
 */
export async function triggerContractUpdated(
  tenantId: string,
  contractId: string,
  changes: Record<string, unknown>
) {
  return triggerWebhook({
    tenantId,
    event: 'contract.updated',
    data: {
      contractId,
      changes,
    },
  });
}

/**
 * Trigger webhook when a contract is processed (OCR + AI analysis complete)
 */
export async function triggerContractProcessed(
  tenantId: string,
  contractId: string,
  processingResult: Record<string, unknown>
) {
  return triggerWebhook({
    tenantId,
    event: 'contract.processed',
    data: {
      contractId,
      ...processingResult,
    },
  });
}

/**
 * Trigger webhook when an artifact is generated
 */
export async function triggerArtifactGenerated(
  tenantId: string,
  contractId: string,
  artifactType: string,
  artifactId: string
) {
  return triggerWebhook({
    tenantId,
    event: 'artifact.generated',
    data: {
      contractId,
      artifactType,
      artifactId,
    },
  });
}

/**
 * Trigger webhook when OCR is completed
 */
export async function triggerOCRCompleted(
  tenantId: string,
  contractId: string,
  textLength: number,
  confidence?: number
) {
  return triggerWebhook({
    tenantId,
    event: 'ocr.completed',
    data: {
      contractId,
      textLength,
      confidence,
    },
  });
}

/**
 * Trigger webhook when OCR fails
 */
export async function triggerOCRFailed(
  tenantId: string,
  contractId: string,
  error: string
) {
  return triggerWebhook({
    tenantId,
    event: 'ocr.failed',
    data: {
      contractId,
      error,
    },
  });
}

/**
 * Trigger webhook when approval is requested
 */
export async function triggerApprovalRequested(
  tenantId: string,
  contractId: string,
  approvalId: string,
  approvers: string[]
) {
  return triggerWebhook({
    tenantId,
    event: 'approval.requested',
    data: {
      contractId,
      approvalId,
      approvers,
    },
  });
}

/**
 * Trigger webhook when approval is completed
 */
export async function triggerApprovalCompleted(
  tenantId: string,
  contractId: string,
  approvalId: string,
  approvedBy: string
) {
  return triggerWebhook({
    tenantId,
    event: 'approval.completed',
    data: {
      contractId,
      approvalId,
      approvedBy,
    },
  });
}

/**
 * Trigger webhook when a risk is detected
 */
export async function triggerRiskDetected(
  tenantId: string,
  contractId: string,
  riskType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  description: string
) {
  return triggerWebhook({
    tenantId,
    event: 'alert.risk_detected',
    data: {
      contractId,
      riskType,
      severity,
      description,
    },
  });
}

/**
 * Trigger webhook when a deadline is approaching
 */
export async function triggerDeadlineApproaching(
  tenantId: string,
  contractId: string,
  deadlineType: string,
  deadlineDate: Date,
  daysRemaining: number
) {
  return triggerWebhook({
    tenantId,
    event: 'alert.deadline_approaching',
    data: {
      contractId,
      deadlineType,
      deadlineDate: deadlineDate.toISOString(),
      daysRemaining,
    },
  });
}

/**
 * Trigger webhook when a signature is requested
 */
export async function triggerSignatureRequested(
  tenantId: string,
  contractId: string,
  signatureRequestId: string,
  signers: string[]
) {
  return triggerWebhook({
    tenantId,
    event: 'signature.requested',
    data: {
      contractId,
      signatureRequestId,
      signers,
    },
  });
}

/**
 * Trigger webhook when a signature is completed
 */
export async function triggerSignatureCompleted(
  tenantId: string,
  contractId: string,
  signatureRequestId: string,
  signedBy: string
) {
  return triggerWebhook({
    tenantId,
    event: 'signature.completed',
    data: {
      contractId,
      signatureRequestId,
      signedBy,
    },
  });
}

/**
 * Trigger webhook when a rate card is analyzed
 */
export async function triggerRateCardAnalyzed(
  tenantId: string,
  rateCardId: string,
  analysisResult: Record<string, unknown>
) {
  return triggerWebhook({
    tenantId,
    event: 'rate_card.analyzed',
    data: {
      rateCardId,
      ...analysisResult,
    },
  });
}

// ============================================================================
// DOCUMENT CLASSIFICATION WEBHOOKS
// ============================================================================

/**
 * Trigger webhook when a document is classified
 */
export async function triggerDocumentClassified(
  tenantId: string,
  contractId: string,
  classification: {
    documentClassification: string;
    signatureStatus?: string;
    confidence?: number;
  }
) {
  return triggerWebhook({
    tenantId,
    event: 'document.classified',
    data: {
      contractId,
      ...classification,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Trigger webhook when a non-contract document is detected
 * This is useful for alerting external systems about non-contract uploads
 */
export async function triggerNonContractDetected(
  tenantId: string,
  contractId: string,
  details: {
    documentClassification: string;
    fileName?: string;
    uploadedBy?: string;
    confidence?: number;
  }
) {
  return triggerWebhook({
    tenantId,
    event: 'document.non_contract_detected',
    data: {
      contractId,
      ...details,
      timestamp: new Date().toISOString(),
      message: `Non-contract document detected: ${details.documentClassification}`,
    },
  });
}

/**
 * Trigger webhook when signature status changes
 */
export async function triggerSignatureStatusChanged(
  tenantId: string,
  contractId: string,
  details: {
    previousStatus?: string;
    newStatus: string;
    changedBy?: string;
    bulk?: boolean;
  }
) {
  return triggerWebhook({
    tenantId,
    event: 'document.signature_status_changed',
    data: {
      contractId,
      ...details,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Trigger webhook when a document is reclassified
 */
export async function triggerDocumentReclassified(
  tenantId: string,
  contractId: string,
  details: {
    previousClassification?: string;
    newClassification: string;
    signatureStatusUpdated?: boolean;
    newSignatureStatus?: string;
    changedBy?: string;
    bulk?: boolean;
  }
) {
  return triggerWebhook({
    tenantId,
    event: 'document.reclassified',
    data: {
      contractId,
      ...details,
      timestamp: new Date().toISOString(),
    },
  });
}
