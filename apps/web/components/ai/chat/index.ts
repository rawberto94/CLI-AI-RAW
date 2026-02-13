/**
 * AI Chat Components
 * Barrel export for all chat-related components
 */

// Message components
export { MessageBubble } from './MessageBubble';
export type { ChatMessage, MessageSource, MessageAttachment } from './MessageBubble';

// Input components
export { EnhancedChatInput } from './EnhancedChatInput';

// Typing indicators
export { TypingIndicator, StreamingIndicator, ThinkingStatus } from './TypingIndicator';

// Suggestions
export { SmartSuggestions } from './SmartSuggestions';

// Sidebar
export { ConversationSidebar } from './ConversationSidebar';

// Context
export { ChatContextProvider, useChatContext } from './ChatContext';

// Main chatbot (use FloatingAIBubble from parent directory instead)
// EnhancedChatbot is deprecated — kept for reference only

// Floating trigger
export { ChatBubbleTrigger } from './ChatBubbleTrigger';
export { default } from './ChatBubbleTrigger';
