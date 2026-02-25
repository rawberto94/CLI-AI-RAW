# Enhanced AI Chatbot Components

## Overview

This document summarizes the comprehensive AI chatbot improvements implemented for the Contigo application. The enhancements focus on creating a modern, feature-rich chat experience with conversation memory, rich message rendering, and smart suggestions.

## New Components Created

### 1. MessageBubble (`components/ai/chat/MessageBubble.tsx`)

**Purpose**: Rich message rendering with full feature set

**Features**:

- **Markdown Parsing**: Bold, italic, inline code, links, bulleted/numbered lists
- **Code Blocks**: Syntax-aware rendering with copy functionality
- **Tables**: Structured data display with proper styling
- **Source References**: Show relevant document sources with relevance scores
- **Attachment Previews**: Display file attachments (PDF, images, documents)
- **Confidence Indicators**: Visual confidence level display (high/medium/low)
- **Feedback System**: Thumbs up/down for message quality feedback
- **Actions**: Copy, bookmark, share, regenerate message capabilities

**Types Exported**:

- `ChatMessage` - Core message type
- `MessageSource` - Source document reference
- `MessageAttachment` - File attachment type

---

### 2. EnhancedChatInput (`components/ai/chat/EnhancedChatInput.tsx`)

**Purpose**: Feature-rich chat input with modern UX

**Features**:

- **File Attachments**: Support for PDF, DOC, DOCX, TXT, and images
- **Voice Input**: Web Speech API integration for voice commands
- **Slash Commands**: Quick actions via `/` prefix
  - `/summarize` - Summarize selected content
  - `/compare` - Compare contracts
  - `/analyze` - Analyze terms
  - `/search` - Search documents
  - `/help` - Show help
- **Auto-Resize Textarea**: Dynamically grows with content
- **Character Counter**: Shows remaining characters
- **Keyboard Hints**: Visual Cmd+Enter hint
- **Contract Context**: Shows current contract context indicator
- **Suggestion Chips**: Quick-select common queries

---

### 3. TypingIndicator (`components/ai/chat/TypingIndicator.tsx`)

**Purpose**: Visual feedback during AI processing

**Components**:

- **TypingIndicator**: Animated dots with variants (dots/pulse/wave)
- **StreamingIndicator**: Text display with animated cursor
- **ThinkingStatus**: Multi-stage processing indicator with checkmarks

**Stages**:

1. "Understanding your query..."
2. "Searching contracts..."
3. "Analyzing results..."
4. "Generating response..."

---

### 4. ChatContext (`components/ai/chat/ChatContext.tsx`)

**Purpose**: Conversation history and memory management

**Features**:

- **Multi-Conversation Support**: Create, load, switch between conversations
- **localStorage Persistence**: Conversations persist across sessions
- **Message CRUD**: Add, update, delete messages
- **Contract Context Tracking**: Associate conversations with contracts
- **Mentioned Contracts**: Track which contracts are referenced
- **Streaming Support**: Handle streaming message updates
- **Context Storage**: Key-value context for additional data

**Limits**:

- `MAX_CONVERSATIONS`: 50
- `MAX_MESSAGES_PER_CONVERSATION`: 100

---

### 5. SmartSuggestions (`components/ai/chat/SmartSuggestions.tsx`)

**Purpose**: Context-aware AI-powered suggestions

**Features**:

- **Context-Based**: Different suggestions based on current page
- **Time-Aware**: Smart suggestions based on day/time (Monday reviews, month-end, Q4)
- **Usage Tracking**: Learn from user's frequently used queries
- **Multiple Variants**: Pills, cards, or list display modes
- **Priority System**: Suggestions ranked by relevance

**Page Contexts**:

- `contracts-list` - List-specific actions
- `contract-detail` - Detail page actions
- `analytics` - Analytics-focused queries
- `dashboard` - General overview queries

---

### 6. ConversationSidebar (`components/ai/chat/ConversationSidebar.tsx`)

**Purpose**: Conversation history navigation

**Features**:

- **Date Grouping**: Today, Yesterday, This Week, This Month, Older
- **Search**: Filter conversations by title/content
- **Star/Favorite**: Mark important conversations
- **Rename**: Edit conversation titles inline
- **Delete**: Remove conversations with confirmation
- **Collapsible**: Minimize to icon-only view
- **Context Indicators**: Show contract-associated conversations

---

### 7. EnhancedChatbot (`components/ai/chat/EnhancedChatbot.tsx`)

**Purpose**: Main chatbot orchestration component

**Features**:

- **Maximize/Minimize**: Full-screen or compact mode
- **Settings Panel**: Sound, theme, suggestions, compact mode
- **Welcome Screen**: First-time user onboarding
- **Streaming Responses**: Real-time AI response display
- **Error Handling**: Graceful error messages
- **Sidebar Integration**: Optional conversation history sidebar

---

### 8. ChatBubbleTrigger (`components/ai/chat/ChatBubbleTrigger.tsx`)

**Purpose**: Floating action button to open chatbot

**Features**:

- **Pulse Animation**: Attention-grabbing animation
- **Proactive Messages**: Timed prompts to engage users
- **Unread Badge**: Notification count display
- **Keyboard Shortcuts**: Cmd+K hint on hover
- **Position Options**: Bottom-right or bottom-left
- **Interaction Tracking**: Remember if user has interacted

---

## Integration Guide

### Basic Usage

```tsx
import { ChatBubbleTrigger } from '@/components/ai/chat';

// In your layout or page component
export default function Layout({ children }) {
  return (
    <>
      {children}
      <ChatBubbleTrigger />
    </>
  );
}
```

### With Contract Context

```tsx
import { ChatBubbleTrigger } from '@/components/ai/chat';

export default function ContractPage({ contract }) {
  return (
    <>
      <ContractDetails contract={contract} />
      <ChatBubbleTrigger
        contractContext={{ id: contract.id, name: contract.name }}
      />
    </>
  );
}
```

### Using Individual Components

```tsx
import {
  MessageBubble,
  EnhancedChatInput,
  SmartSuggestions,
  ChatContextProvider,
  useChatContext,
} from '@/components/ai/chat';

function CustomChat() {
  return (
    <ChatContextProvider>
      <CustomChatContent />
    </ChatContextProvider>
  );
}

function CustomChatContent() {
  const { messages, addMessage } = useChatContext();
  
  return (
    <div>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <EnhancedChatInput onSend={addMessage} />
    </div>
  );
}
```

---

## API Integration

The chatbot expects an endpoint at `/api/ai/chat` that:

**Request**:

```json
{
  "message": "User's question",
  "contractId": "optional-contract-id",
  "attachments": [
    { "name": "document.pdf", "type": "application/pdf" }
  ]
}
```

**Response** (JSON or Streaming):

```json
{
  "response": "AI generated response",
  "sources": [
    {
      "id": "source-1",
      "title": "Contract ABC",
      "relevance": 0.95,
      "snippet": "Relevant excerpt..."
    }
  ]
}
```

---

## Accessibility

- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: ARIA labels on interactive elements
- **Focus Management**: Proper focus handling in modals
- **Color Contrast**: Meets WCAG 2.1 AA standards
- **Reduced Motion**: Respects `prefers-reduced-motion`

---

## Performance Considerations

- **Memoization**: All components wrapped with `React.memo`
- **Virtualization Ready**: Message list can be virtualized for long conversations
- **Lazy Loading**: Components can be dynamically imported
- **Debouncing**: Input handlers use appropriate debouncing
- **Storage Limits**: Automatic cleanup of old conversations

---

## File Structure

```
apps/web/components/ai/chat/
├── index.ts                 # Barrel exports
├── MessageBubble.tsx        # Rich message rendering
├── EnhancedChatInput.tsx    # Feature-rich input
├── TypingIndicator.tsx      # Loading states
├── ChatContext.tsx          # State management
├── SmartSuggestions.tsx     # AI suggestions
├── ConversationSidebar.tsx  # History navigation
├── EnhancedChatbot.tsx      # Main component
└── ChatBubbleTrigger.tsx    # Floating trigger
```

---

## Dependencies

- `framer-motion` - Animations
- `lucide-react` - Icons
- `@/lib/utils` - Utility functions (cn helper)

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Web Speech API (voice input) requires:

- Chrome/Edge (full support)
- Safari (partial support)
- Firefox (limited support)

---

## Future Improvements

1. **Message Threading**: Reply to specific messages
2. **Message Search**: Search within conversation history
3. **Export/Import**: Save and load conversations
4. **Custom Themes**: User-customizable color schemes
5. **Multi-Language**: i18n support for UI strings
6. **Analytics**: Track user engagement metrics
7. **Collaborative Chat**: Share conversations with team members
