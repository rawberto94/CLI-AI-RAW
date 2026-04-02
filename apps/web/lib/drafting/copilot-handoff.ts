export const COPILOT_HANDOFF_STORAGE_PREFIX = 'copilot-handoff:';

export interface CopilotHandoffPayload {
  title?: string;
  content: string;
  sourceContractId?: string;
  sourceMode?: string;
  createdAt: string;
}

export function getCopilotHandoffStorageKey(handoffId: string): string {
  return `${COPILOT_HANDOFF_STORAGE_PREFIX}${handoffId}`;
}