# Real-Time Orchestrator Progress Implementation

## Overview
Implemented a comprehensive real-time orchestrator progress tracking system for contract details pages with AI chatbot integration. The system provides live updates on contract processing status, smart artifact suggestions, and on-demand generation capabilities.

## Architecture

### 1. Client-Side Components

#### **useContractOrchestrator Hook** (`apps/web/hooks/useContractOrchestrator.ts`)
- Real-time progress tracking via Server-Sent Events (SSE)
- Automatic fallback to polling when SSE unavailable
- Auto-reconnect on connection loss
- Exports:
  - `OrchestratorProgress` type
  - `ArtifactSuggestion` type
  - `useContractOrchestrator({ contractId, tenantId, enabled, pollInterval })`
  - `progress`, `suggestions`, `isConnected`, `error` state
  - `generateArtifact(type)`, `triggerOrchestrator()`, `refresh()` actions

#### **OrchestratorProgress Component** (`apps/web/components/contracts/OrchestratorProgress.tsx`)
- Visual display of orchestrator status
- Features:
  - Overall progress bar
  - Per-step status with icons (pending/running/completed/failed)
  - Artifacts completion counter
  - Current activity display (enqueued jobs)
  - Smart suggestions panel with generate buttons
  - Live/polling connection indicator
  - Iteration counter
  - Re-run orchestrator trigger

#### **useOrchestratorChatbot Hook** (`apps/web/hooks/useOrchestratorChatbot.ts`)
- Combines chatbot with orchestrator awareness
- Automatically includes orchestrator state in system context
- Handles orchestrator commands:
  - "What's happening?" → Status report
  - "Generate [artifact]" → Trigger artifact generation
  - "Re-run processing" → Trigger orchestrator
- Returns: `messages`, `isLoading`, `sendMessage`, `orchestratorProgress`, `generateArtifact`, `triggerOrchestrator`

#### **OrchestratorAwareChatbot Component** (`apps/web/components/contracts/OrchestratorAwareChatbot.tsx`)
- Full-featured chatbot UI with orchestrator integration
- Features:
  - Live connection badge
  - Artifact completion counter in header
  - Orchestrator status badges on messages
  - Quick suggestion buttons
  - Minimizable/closable interface
  - Floating button trigger

### 2. API Routes

#### **GET /api/contracts/[id]/orchestrator/progress** (`route.ts`)
- REST endpoint for orchestrator state
- Returns:
  - Current status (idle/running/completed)
  - Iteration count
  - Plan and step details
  - Agent state (version, iteration, lastDecision, history)
  - Artifacts stats (total, completed, required, missing)
  - Smart suggestions (top 5, with relevance and reasons)
- Uses contract type profiles to determine relevant artifacts
- Generates context-aware suggestions based on contract type

#### **GET /api/contracts/[id]/orchestrator/stream** (`route.ts`)
- Server-Sent Events endpoint for real-time updates
- Polls ProcessingJob every 2 seconds
- Sends events:
  - `connected`: Initial connection
  - `progress`: State updates
  - `complete`: Processing finished
  - `error`: Error occurred
  - `timeout`: 5-minute timeout
- Includes heartbeat (every 15s) to keep connection alive
- Auto-cleanup on disconnect

#### **POST /api/contracts/[id]/orchestrator/trigger** (`route.ts`)
- Manually trigger orchestrator processing
- Enqueues agent orchestrator job with priority 40
- Returns job ID and trace ID for tracking

#### **POST /api/contracts/[id]/orchestrator/generate-artifact** (`route.ts`)
- Trigger generation of specific artifact type
- Validates contract has sufficient text (>100 chars)
- Enqueues artifact generation job with priority 35
- Returns job ID for tracking

### 3. Integration

#### **Contract Details Page** (`apps/web/app/contracts/[id]/state-of-the-art/page.tsx`)
- Added `<OrchestratorProgress>` component prominently
- Added floating chatbot button with live indicator
- Integrated `<OrchestratorAwareChatbot>` component
- Both components share the same orchestrator state via hooks

## Data Flow

```
ProcessingJob (DB)
    ↓
GET /orchestrator/progress (REST)
    ↓
useContractOrchestrator Hook
    ↓
OrchestratorProgress Component (UI)

ProcessingJob (DB)
    ↓
GET /orchestrator/stream (SSE)
    ↓
EventSource → useContractOrchestrator Hook
    ↓
OrchestratorProgress Component (Real-time updates)

User Action
    ↓
POST /orchestrator/generate-artifact
    ↓
Queue → Worker → ProcessingJob
    ↓
SSE update → UI refresh

Chatbot Message
    ↓
useOrchestratorChatbot Hook
    ↓
POST /api/ai/chat (with orchestrator context)
    ↓
AI Response (with orchestrator awareness)
    ↓
OrchestratorAwareChatbot Component
```

## Features

### Real-Time Updates
- **SSE-first**: Immediate updates via Server-Sent Events
- **Polling fallback**: Automatic degradation for compatibility
- **Auto-reconnect**: Resilient connection handling
- **Live indicators**: Visual feedback on connection status

### Smart Artifact Suggestions
- **Contract-type aware**: Suggestions based on contract type profile
- **Relevance categorization**: Required vs Optional artifacts
- **Context-aware reasons**: Explains why each artifact is suggested
- **One-click generation**: Generate artifacts directly from UI

### AI Chatbot Integration
- **Orchestrator awareness**: Chatbot knows current processing status
- **Natural language commands**: 
  - "What's the status?"
  - "Generate OVERVIEW artifact"
  - "Re-run processing"
- **Visual indicators**: Status badges on messages
- **Suggestions in chat**: Quick action buttons for common queries

### Granular Control
- **Manual orchestrator trigger**: Re-run processing on demand
- **Per-artifact generation**: Generate specific artifacts
- **Progress visibility**: See what's running in real-time
- **Error handling**: Clear error messages and retry capabilities

## Contract Type Profiles Integration

The system uses contract type profiles (`packages/workers/src/contract-type-profiles.ts`) to:
- Determine which artifacts are relevant for a contract type
- Categorize artifact relevance (required/optional/not-applicable)
- Generate smart suggestions with contextual reasons
- Filter suggestions to show only actionable items

Example:
```typescript
// For SOW contracts
{
  artifactRelevance: {
    OVERVIEW: 'required',
    CLAUSES: 'required',
    FINANCIAL: 'required',
    RISK: 'optional',
    COMPLIANCE: 'not-applicable',
    ...
  }
}
```

## Benefits

1. **User Visibility**: Users see exactly what's happening with their contracts
2. **Proactive Suggestions**: System recommends missing important artifacts
3. **On-Demand Processing**: Generate artifacts when needed, not just at upload
4. **Conversational Interface**: Ask the chatbot about processing status
5. **Real-Time Feedback**: No page refreshes needed, updates stream live
6. **Intelligent Context**: Chatbot has full awareness of orchestrator state
7. **Flexible Architecture**: SSE + polling ensures it works everywhere

## Usage Examples

### 1. Viewing Progress
User uploads contract → `OrchestratorProgress` component automatically shows:
- Current iteration (e.g., "Iteration 2/20")
- Step progress (metadata extraction: completed, categorization: running)
- Artifacts completed (3/7)
- Suggested artifacts (FINANCIAL, RISK, COMPLIANCE)

### 2. Generating Artifact
User clicks "Generate FINANCIAL" → System:
1. Enqueues artifact generation job
2. Shows loading state
3. Streams progress updates via SSE
4. Displays completed artifact

### 3. Chatbot Interaction
```
User: "What's happening with this contract?"
Bot: **Current Status:** running
     **Iteration:** 2/20
     **Artifacts:** 3/7 completed
     **Currently Processing:**
     - CLAUSE_EXTRACTION
     - RISK_ANALYSIS

User: "Generate COMPLIANCE artifact"
Bot: I've triggered generation of the COMPLIANCE artifact. 
     You can monitor the progress in real-time above.
```

## Future Enhancements

1. **WebSocket Integration**: Use existing WebSocket context for push notifications
2. **Progress History**: Show timeline of orchestrator decisions
3. **Batch Generation**: Generate multiple artifacts at once
4. **Custom Artifact Types**: Allow users to request custom analysis
5. **Orchestrator Insights**: Show why orchestrator made specific decisions
6. **Performance Metrics**: Display processing time estimates
7. **Conflict Resolution**: Handle concurrent artifact generation requests
8. **Notification System**: Alert users when processing completes

## Testing Checklist

- [ ] Upload contract → verify progress component shows
- [ ] Check SSE connection → verify "Live" badge
- [ ] Disconnect network → verify fallback to "Polling"
- [ ] Click artifact suggestion → verify generation starts
- [ ] Ask chatbot "What's happening?" → verify status response
- [ ] Type "Generate OVERVIEW" → verify artifact generation
- [ ] Click "Re-run" → verify orchestrator triggers
- [ ] Multiple tabs → verify independent connections
- [ ] Long processing → verify heartbeat keeps connection alive
- [ ] Network reconnect → verify auto-reconnect works

## Configuration

### Environment Variables
None required - uses existing OpenAI and database configs

### Queue Priorities
- Agent orchestrator: 40 (high priority)
- Artifact generation: 35 (medium-high priority)

### Timeouts
- SSE connection: 5 minutes
- Heartbeat interval: 15 seconds
- Polling interval: 2 seconds (configurable via hook)
- Reconnect delay: 3 seconds

### Rate Limits
Consider adding rate limits to prevent:
- Excessive artifact generation requests
- Rapid orchestrator re-runs
- Chatbot message spam

## Performance Considerations

1. **SSE Connection Management**: Auto-closes after timeout or completion
2. **Polling Efficiency**: Only polls when SSE unavailable
3. **Data Volume**: Sends incremental updates, not full state
4. **Subscription Management**: Unsubscribes on unmount
5. **Message History**: Chatbot keeps last 5 messages for context

## Security

- All endpoints validate `tenantId` via `getApiTenantId()`
- Contract access is scoped to tenant
- No sensitive data in SSE stream
- Abort controllers cancel pending requests on unmount
- Job IDs are UUIDs to prevent enumeration

## Deployment

No additional deployment steps required. The system uses:
- Existing Next.js API routes
- Existing queue infrastructure
- Existing database models
- Standard HTTP/SSE protocols (no special server config)

Works with:
- Vercel
- AWS
- Docker
- Any Node.js hosting platform

---

**Status**: ✅ Implemented and integrated
**Last Updated**: 2024
**Author**: AI Implementation Team
