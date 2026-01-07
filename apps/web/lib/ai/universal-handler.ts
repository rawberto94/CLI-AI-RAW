/**
 * Universal Message Handler
 * 
 * Ensures any message from the user gets a meaningful response
 * Provides fallback handling for edge cases and unexpected inputs
 */

import OpenAI from 'openai';
import { processMessage, generateDynamicSystemPrompt } from './flexible-processor';

// Universal response templates
const FALLBACK_RESPONSES = {
  greeting: [
    "Hello! I'm your ConTigo AI assistant. How can I help you with your contracts today?",
    "Hi there! I'm here to help with anything related to your contracts. What would you like to know?",
    "Welcome! I can help you search, analyze, and manage your contracts. What would you like to do?",
  ],
  
  thanks: [
    "You're welcome! Is there anything else I can help you with?",
    "Happy to help! Let me know if you need anything else.",
    "Anytime! Feel free to ask if you have more questions.",
  ],
  
  unclear: [
    "I'd be happy to help! Could you tell me a bit more about what you're looking for?",
    "I want to make sure I understand correctly. Could you provide more details?",
    "That's an interesting question! To give you the best answer, could you elaborate a bit?",
  ],
  
  error: [
    "I apologize, but I encountered an issue. Could you try rephrasing your question?",
    "Something went wrong on my end. Let me know if you'd like to try again.",
    "I'm having trouble processing that. Would you mind asking in a different way?",
  ],
  
  capabilities: `I'm ConTigo AI, your intelligent contract management assistant. Here's what I can help you with:

**📋 Contract Search & Discovery**
- Find contracts by supplier, status, value, or any criteria
- Search for specific clauses or terms within contracts
- List contracts expiring soon or needing attention

**📊 Analytics & Insights**
- Spending analysis by supplier, category, or time period
- Risk assessment and contract health monitoring
- Trend analysis and portfolio overview

**🔍 Deep Analysis**
- Summarize contracts and extract key terms
- Compare contracts or suppliers
- Identify risks and compliance issues

**🔄 Workflow Guidance**
- Guide you through renewal processes
- Help with contract organization
- Provide recommendations

Just ask me anything in natural language, and I'll do my best to help!`,
};

// Detect message category for fallback handling
function categorizeMessage(message: string): 'greeting' | 'thanks' | 'help' | 'question' | 'command' | 'unclear' {
  const lower = message.toLowerCase().trim();
  
  // Greetings
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|greetings|howdy|yo|sup|what'?s?\s+up)\b/i.test(lower)) {
    return 'greeting';
  }
  
  // Thanks/appreciation
  if (/^(thanks?|thank\s+you|thx|ty|appreciate|great|awesome|perfect|excellent)\b/i.test(lower)) {
    return 'thanks';
  }
  
  // Help requests
  if (/^(help|what\s+can\s+you\s+do|capabilities|features|how\s+does\s+this\s+work|what\s+are\s+you)\b/i.test(lower)) {
    return 'help';
  }
  
  // Questions (has question words or question mark)
  if (/(\?|^(what|where|when|why|how|who|which|can|could|would|should|is|are|do|does|did|will)\b)/i.test(lower)) {
    return 'question';
  }
  
  // Commands (starts with action verbs)
  if (/^(show|find|search|get|list|compare|analyze|summarize|create|start|renew|export)\b/i.test(lower)) {
    return 'command';
  }
  
  // Default to unclear
  return 'unclear';
}

// Get a random response from an array
function getRandomResponse(responses: string[]): string {
  return responses[Math.floor(Math.random() * responses.length)];
}

// Generate contextual suggestions based on the message
function generateContextualSuggestions(message: string, category: string): string[] {
  const lower = message.toLowerCase();
  
  // Based on message content
  if (/supplier|vendor/i.test(lower)) {
    return [
      'List all suppliers',
      'Show top suppliers by spend',
      'Find contracts by supplier name',
    ];
  }
  
  if (/expir|renew/i.test(lower)) {
    return [
      'Show contracts expiring in 30 days',
      'List auto-renewing contracts',
      'Find contracts needing renewal',
    ];
  }
  
  if (/spend|cost|value|budget/i.test(lower)) {
    return [
      'Show spending by category',
      'Top 10 contracts by value',
      'Monthly spending trend',
    ];
  }
  
  if (/risk|compliance|audit/i.test(lower)) {
    return [
      'Show high-risk contracts',
      'Compliance status overview',
      'List contracts with missing data',
    ];
  }
  
  // Based on category
  switch (category) {
    case 'greeting':
      return [
        'Show my contracts summary',
        'What contracts expire soon?',
        'Show spending analysis',
      ];
    case 'thanks':
      return [
        'Show another analysis',
        'Find more contracts',
        'Any risks I should know?',
      ];
    case 'help':
      return [
        'Search for a contract',
        'Show expiring contracts',
        'Analyze my portfolio',
      ];
    default:
      return [
        'Search contracts',
        'Show expiring soon',
        'Spending overview',
      ];
  }
}

// Generate smart actions based on context
function generateSmartActions(message: string, category: string): Array<{ label: string; action: string }> {
  const actions: Array<{ label: string; action: string }> = [];
  const lower = message.toLowerCase();
  
  // Always useful actions
  if (category === 'greeting' || category === 'help') {
    actions.push(
      { label: '📊 View Dashboard', action: 'navigate:/dashboard' },
      { label: '📋 Browse Contracts', action: 'navigate:/contracts' },
    );
  }
  
  // Context-specific actions
  if (/expir|renew/i.test(lower)) {
    actions.push({ label: '🔔 Set Reminders', action: 'set-reminders' });
  }
  
  if (/risk/i.test(lower)) {
    actions.push({ label: '📈 Risk Report', action: 'generate-risk-report' });
  }
  
  // Limit to 3 actions
  return actions.slice(0, 3);
}

export interface UniversalResponse {
  message: string;
  suggestions: string[];
  actions: Array<{ label: string; action: string }>;
  category: string;
  confidence: number;
}

/**
 * Handle any message with a meaningful response
 */
export function handleAnyMessage(message: string): UniversalResponse {
  if (!message || typeof message !== 'string') {
    return {
      message: getRandomResponse(FALLBACK_RESPONSES.error),
      suggestions: ['Try again', 'Ask a different question'],
      actions: [{ label: '🔄 Start Over', action: 'new-conversation' }],
      category: 'error',
      confidence: 0,
    };
  }
  
  const trimmedMessage = message.trim();
  
  // Handle empty or very short messages
  if (trimmedMessage.length < 2) {
    return {
      message: "I'm here to help! Just type your question or request and I'll do my best to assist.",
      suggestions: generateContextualSuggestions('', 'unclear'),
      actions: [{ label: '❓ What can you do?', action: 'show-capabilities' }],
      category: 'unclear',
      confidence: 0.3,
    };
  }
  
  // Categorize the message
  const category = categorizeMessage(trimmedMessage);
  
  // Generate response based on category
  let response: string;
  
  switch (category) {
    case 'greeting':
      response = getRandomResponse(FALLBACK_RESPONSES.greeting);
      break;
    case 'thanks':
      response = getRandomResponse(FALLBACK_RESPONSES.thanks);
      break;
    case 'help':
      response = FALLBACK_RESPONSES.capabilities;
      break;
    default:
      // For questions and commands, we need AI processing
      // This is handled by the main API, this function is for fallbacks
      response = getRandomResponse(FALLBACK_RESPONSES.unclear);
  }
  
  return {
    message: response,
    suggestions: generateContextualSuggestions(trimmedMessage, category),
    actions: generateSmartActions(trimmedMessage, category),
    category,
    confidence: category === 'unclear' ? 0.5 : 0.9,
  };
}

/**
 * Build a comprehensive system prompt for flexible message handling
 */
export function buildFlexibleSystemPrompt(
  message: string,
  context?: Record<string, unknown>
): string {
  // Process the message to understand intent and entities
  const processed = processMessage(message);
  
  // Generate a dynamic prompt based on the processed message
  const additionalContext = context ? JSON.stringify(context, null, 2) : '';
  const dynamicPrompt = generateDynamicSystemPrompt(processed, additionalContext);
  
  // Add universal handling instructions
  const universalInstructions = `

**🎯 UNIVERSAL HANDLING RULES:**

1. **Always Respond** - Never leave a user without a response
2. **Be Helpful** - Even if you don't understand, offer alternatives
3. **Suggest Next Steps** - Always provide follow-up suggestions
4. **Stay on Topic** - Focus on contract management and related topics
5. **Admit Limitations** - If you can't do something, say so clearly

**📝 RESPONSE FORMAT:**
- Use clear markdown formatting
- Keep responses concise but complete
- Always include 2-3 suggested follow-up questions
- Link to relevant contracts when applicable

**🔗 LINKING FORMAT:**
When mentioning contracts, ALWAYS use this format: [Contract Name](/contracts/CONTRACT_ID)

**🚫 LIMITATIONS:**
- Cannot execute actual workflow approvals
- Cannot modify contract data directly
- Cannot provide legal advice
- Cannot access external systems

If a user asks for something outside capabilities, kindly redirect them to what you CAN help with.
`;

  return dynamicPrompt + universalInstructions;
}

/**
 * Parse and enhance AI response
 */
export function enhanceAIResponse(
  response: string,
  originalMessage: string
): {
  content: string;
  suggestions: string[];
  actions: Array<{ label: string; action: string }>;
} {
  const category = categorizeMessage(originalMessage);
  
  // Extract any suggestions from the response (if they're already there)
  let extractedSuggestions: string[] = [];
  const suggestionMatch = response.match(/(?:Try asking|You might also ask|Related questions):\s*([\s\S]*?)(?:\n\n|$)/i);
  if (suggestionMatch) {
    extractedSuggestions = suggestionMatch[1]
      .split('\n')
      .map(s => s.replace(/^[-•*]\s*/, '').trim())
      .filter(s => s.length > 0)
      .slice(0, 3);
  }
  
  // Generate suggestions if none were extracted
  const suggestions = extractedSuggestions.length > 0
    ? extractedSuggestions
    : generateContextualSuggestions(originalMessage, category);
  
  // Generate smart actions
  const actions = generateSmartActions(originalMessage, category);
  
  return {
    content: response,
    suggestions,
    actions,
  };
}

export default {
  handleAnyMessage,
  buildFlexibleSystemPrompt,
  enhanceAIResponse,
  categorizeMessage,
};
