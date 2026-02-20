/**
 * Unified Chat Components
 * 
 * Consolidated chatbot combining best features from:
 * - FloatingAIBubble (streaming, persistence, contract previews)
 * - AIChatbot (workflow integration, file attachments, retry logic)
 * - EnhancedChatbot (modular architecture, rich markdown, context)
 * 
 * @version 2.0.0
 */

// Main chatbot
// Note: UnifiedChatbot module was planned but not yet implemented.
// Functionality is provided by FloatingAIBubble and useStreamingHandler.

// Streaming handler
export { useStreamingHandler } from './useStreamingHandler';
export type { 
  StreamingState, 
  RagSource, 
  StreamMetadata,
} from './useStreamingHandler';

// Contract preview
export { ContractPreviewCard, ContractPreviewList } from './ContractPreview';
export type { 
  ContractPreviewData, 
  ContractListProps,
} from './ContractPreview';

// Workflow actions
export { WorkflowActions, InlineConfirmReject } from './WorkflowActions';
export type { 
  WorkflowAction, 
  WorkflowActionType,
  WorkflowActionsProps,
  InlineActionProps,
} from './WorkflowActions';
