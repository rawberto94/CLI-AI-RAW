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
// TODO: Module './UnifiedChatbot' does not exist
// export { UnifiedChatbot, default } from './UnifiedChatbot';
// export type { 
//   ChatMessage, 
//   Conversation, 
//   ChatSettings,
// } from './UnifiedChatbot';

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
