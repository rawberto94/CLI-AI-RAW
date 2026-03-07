# AI Chatbot - OpenAI Integration Guide

## Overview

The AI Chatbot now supports **both mock responses and real OpenAI API calls** with an easy-to-use toggle switch.

---

## Features

### 🔄 **Dual Mode Support**

- **Mock Mode**: Fast, deterministic responses using predefined templates (no API costs)
- **Real AI Mode**: Powered by OpenAI GPT-4o-mini for intelligent, context-aware responses

### 🎛️ **Easy Toggle**

- Switch between modes with a single click
- Located in the chatbot header (top-right corner)
- Persists during session
- Visual indicator shows current mode

### 🧠 **Real OpenAI Integration**

- Uses `gpt-4o-mini` model (configurable)
- Context-aware system prompts
- Conversation history support (last 10 messages)
- Smart temperature settings (0.7)
- Token limits (1000 max tokens per response)

---

## Setup Instructions

### 1. **Environment Configuration**

Your `.env` file already has the OpenAI API key configured:

```env
# AI Service Configuration
OPENAI_API_KEY="sk-proj-vDA8qIueei1DOsuA14TGb..."
OPENAI_MODEL="gpt-4o-mini"
```

**Note**: The API key is already set! The chatbot will work in real mode immediately.

### 2. **Package Installation**

The `openai` package has been installed:

```bash
pnpm add openai --filter web
```

✅ **Already completed!**

### 3. **Verify Installation**

Check that the OpenAI package is in your dependencies:

```bash
grep "openai" apps/web/package.json
```

---

## Usage

### **Starting the Chatbot**

1. **Click the floating blue button** (bottom-right corner on any page)
2. The chatbot dialog opens with a **toggle switch** in the header
3. **Default mode**: Mock Mode (enabled by default)

### **Switching Modes**

#### **Enable Real AI Mode:**

1. Click the **"Mock Mode" toggle** in the chatbot header
2. Toggle turns OFF (unchecked)
3. Status changes to **"Powered by GPT-4"**
4. Next message will use OpenAI API

#### **Return to Mock Mode:**

1. Click the toggle again
2. Toggle turns ON (checked)
3. Status changes to **"Mock Mode"**
4. Next message will use predefined responses

### **Visual Indicators**

| Mode | Header Text | Toggle State | Color |
|------|-------------|--------------|-------|
| Mock | "Mock Mode" | ✅ Checked | White/Gray |
| Real AI | "Powered by GPT-4" | ⬜ Unchecked | White/Gray |

---

## API Details

### **Endpoint**: `POST /api/ai/chat`

#### **Request Body**:

```typescript
{
  message: string;           // User's question
  contractId?: string;       // Optional contract context
  context?: string;          // 'global' | 'contracts' | 'templates' | 'deadlines'
  conversationHistory?: Message[];  // Last 10 messages
  useMock: boolean;          // true = mock, false = real OpenAI
}
```

#### **Response**:

```typescript
{
  response: string;          // AI-generated response (markdown)
  sources: string[];         // Data sources used
  suggestedActions: Array<{
    label: string;
    action: string;
  }>;
  suggestions: string[];     // Follow-up questions
}
```

---

## Mock Mode Responses

### **Predefined Query Types**:

1. **High-Risk Contracts**
   - Keywords: "high-risk", "risky"
   - Returns: 5 contracts with risk scores, issues, recommended actions

2. **Expiring Contracts**
   - Keywords: "expire", "renewal"
   - Returns: 12 contracts in 3 urgency tiers, total value at risk

3. **Pending Approvals**
   - Keywords: "pending", "approval"
   - Returns: 8 pending items by priority, waiting times

4. **Contract Summary**
   - Keywords: "summarize", "summary"
   - Returns: Full contract details, key terms, risk score

5. **General Help**
   - Default fallback
   - Returns: AI capabilities menu, suggested actions

---

## Real AI Mode

### **System Prompt**:

```
You are an AI assistant for a Contract Lifecycle Management (CLM) system.
You help users with:
- Searching and analyzing contracts
- Managing deadlines and renewals
- Creating templates and clauses
- Identifying risks and compliance issues
- Workflow approvals and signatures
- Generating reports and insights

Current context: {context}
Contract ID: {contractId}

Provide concise, actionable responses.
Format your response with markdown.
When referencing contracts, use bullet points and bold for emphasis.
```

### **Model Configuration**:

- **Model**: `gpt-4o-mini` (fast, cost-effective)
- **Temperature**: 0.7 (balanced creativity/accuracy)
- **Max Tokens**: 1000 (sufficient for detailed responses)
- **History**: Last 10 messages (maintains conversation context)

### **Cost Estimation**:

- **Input**: ~$0.15 per 1M tokens
- **Output**: ~$0.60 per 1M tokens
- **Average query**: ~500 input + 500 output tokens = **$0.000375** (~0.04¢ per query)
- **1000 queries**: ~$0.38

---

## Error Handling

### **Missing API Key**:

```json
{
  "error": "OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file or enable mock mode."
}
```

**Status**: 500

### **API Failure**:

```json
{
  "error": "OpenAI API error: {error_message}"
}
```

**Status**: 500

### **Invalid Request**:

```json
{
  "error": "Message is required"
}
```

**Status**: 400

---

## Testing

### **Test Mock Mode**:

1. Enable Mock Mode (toggle ON)
2. Try these queries:
   - "Show me all high-risk contracts"
   - "What contracts expire in the next 30 days?"
   - "Summarize my pending approvals"
   - "Which templates are most popular?"
3. Verify responses are instant and predefined

### **Test Real AI Mode**:

1. Disable Mock Mode (toggle OFF)
2. Try natural language queries:
   - "What are the biggest risks in my active contracts?"
   - "Help me create an NDA template for tech startups"
   - "Analyze the payment terms across all vendor contracts"
   - "What's the renewal process for expiring MSAs?"
3. Verify responses are dynamic and context-aware

---

## Code Locations

### **Component**: `/apps/web/components/AIChatbot.tsx`

- Lines: 443 total
- Key changes:
  - Line 57: `useMockMode` state
  - Lines 141-146: API call with `useMock` parameter
  - Lines 282-293: Toggle UI in header

### **API Route**: `/apps/web/app/api/ai/chat/route.ts`

- Lines: ~180 total
- Key functions:
  - `getOpenAIResponse()`: Real AI integration
  - `selectResponse()`: Mock response routing
  - `POST()`: Main handler with mode switching

### **Environment**: `/.env`

- `OPENAI_API_KEY`: Your API key (already configured)
- `OPENAI_MODEL`: Model selection (default: gpt-4o-mini)

---

## Advantages

### **Mock Mode**:

✅ **Instant responses** (no API latency)
✅ **Zero costs** (no OpenAI charges)
✅ **Predictable** (consistent responses)
✅ **Offline capable** (no internet required)
✅ **Demo-friendly** (perfect for presentations)

### **Real AI Mode**:

✅ **Intelligent** (understands context and nuance)
✅ **Flexible** (handles any question)
✅ **Learning** (improves with conversation history)
✅ **Natural** (human-like responses)
✅ **Comprehensive** (can reason about complex scenarios)

---

## Best Practices

### **When to Use Mock Mode**:

- Demos and presentations
- Development without API costs
- Testing UI/UX flows
- Offline development
- Predictable response testing

### **When to Use Real AI Mode**:

- Production environment
- Complex user queries
- Natural language understanding needed
- Context-dependent analysis
- Creative problem-solving

### **Switching Strategy**:

```typescript
// Development
const useMockMode = process.env.NODE_ENV === 'development';

// Production with feature flag
const useMockMode = !process.env.ENABLE_AI_FEATURES;

// User preference
const useMockMode = localStorage.getItem('aiMode') === 'mock';
```

---

## Future Enhancements

### **Planned Features**:

- [ ] **Persistent mode preference** (localStorage)
- [ ] **Cost tracking** (OpenAI usage analytics)
- [ ] **Streaming responses** (real-time token streaming)
- [ ] **Custom system prompts** (per-context configuration)
- [ ] **Model selection** (GPT-4, GPT-3.5, Claude, etc.)
- [ ] **Function calling** (execute actions directly)
- [ ] **RAG integration** (retrieve from vector database)
- [ ] **Multi-language support** (i18n)

### **Advanced Configuration**:

```typescript
// Future: Custom AI configuration
interface AIConfig {
  provider: 'openai' | 'anthropic' | 'cohere';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enableStreaming: boolean;
  enableFunctionCalling: boolean;
}
```

---

## Troubleshooting

### **Issue**: Toggle doesn't appear

**Solution**: Clear browser cache, refresh page

### **Issue**: Real mode returns error

**Solution**:

1. Check `.env` has valid `OPENAI_API_KEY`
2. Verify API key has credits
3. Check network connection
4. Review browser console for errors

### **Issue**: Mock mode not working

**Solution**: Ensure toggle is enabled (checked state)

### **Issue**: Responses are slow

**Solution**:

- Mock mode: Should be instant (<1s)
- Real mode: 2-5s is normal for OpenAI API

### **Issue**: "API key not configured" error

**Solution**:

1. Check `.env` file exists in project root
2. Verify `OPENAI_API_KEY` is set
3. Restart dev server
4. Or enable Mock Mode as fallback

---

## Security Notes

### **API Key Protection**:

✅ **Server-side only** - API key never exposed to client
✅ **Environment variable** - Stored in `.env` (gitignored)
✅ **Request validation** - Input sanitization
✅ **Rate limiting** - Consider adding for production

### **Production Checklist**:

- [ ] Use separate API key for production
- [ ] Enable rate limiting (per user/IP)
- [ ] Add request logging
- [ ] Monitor costs (OpenAI dashboard)
- [ ] Implement error alerting
- [ ] Add user authentication
- [ ] Set token limits per user
- [ ] Cache common responses

---

## Summary

✅ **OpenAI integration complete**
✅ **Mock/Real toggle functional**
✅ **Zero TypeScript errors**
✅ **API key already configured**
✅ **Ready for immediate use**

**Total Implementation**:

- Modified files: 2
- New dependencies: 1 (openai)
- Lines added: ~100
- Configuration time: 5 minutes

**Start chatting with AI now!** 🚀
