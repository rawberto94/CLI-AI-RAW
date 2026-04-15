export const COPILOT_HANDOFF_STORAGE_PREFIX = 'copilot-handoff:';

export interface CopilotWorkflowSummaryItem {
  label: string;
  value: string;
}

export interface CopilotWorkflowContext {
  kind: 'renewal' | 'amendment';
  label?: string;
  sourceTitle?: string;
  returnPath?: string;
  returnLabel?: string;
  sourcePath?: string;
  sourceLabel?: string;
  notes?: string;
  summaryItems?: CopilotWorkflowSummaryItem[];
}

export interface CopilotHandoffPayload {
  title?: string;
  content: string;
  sourceContractId?: string;
  sourceMode?: string;
  workflow?: CopilotWorkflowContext;
  createdAt: string;
}

export function getCopilotHandoffStorageKey(handoffId: string): string {
  return `${COPILOT_HANDOFF_STORAGE_PREFIX}${handoffId}`;
}