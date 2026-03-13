/**
 * Stream-to-JSON Adapter
 * 
 * Calls the streaming `/api/ai/chat/stream` endpoint and collects
 * SSE events into a single JSON response compatible with the legacy
 * `/api/ai/chat` response shape.
 * 
 * This allows legacy consumers to benefit from the streaming endpoint's
 * improvements (model failover, tool calling, RAG) without requiring
 * full SSE handling on the client side.
 */

export interface StreamToJSONOptions {
  message: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface StreamToJSONResult {
  response: string;
  message: string; // alias for response (legacy compat)
  sources: string[];
  confidence: number;
  model: string;
  suggestions: string[];
  suggestedActions: Array<{ label: string; action: string }>;
  toolsUsed: string[];
  conversationId: string | null;
  cached: boolean;
}

/**
 * Call the streaming endpoint and collect results into a JSON-like object.
 */
export async function streamChatToJSON(options: StreamToJSONOptions): Promise<StreamToJSONResult> {
  const { message, conversationHistory = [], context = {}, signal } = options;

  const response = await fetch('/api/ai/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationHistory, context }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let content = '';
  let sources: string[] = [];
  let confidence = 0;
  let model = '';
  let suggestedActions: Array<{ label: string; action: string }> = [];
  let toolsUsed: string[] = [];
  let conversationId: string | null = null;
  let cached = false;
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr);

          switch (event.type) {
            case 'content':
              content += event.content || '';
              break;
            case 'metadata':
              sources = event.sources || sources;
              if (event.confidence) confidence = event.confidence;
              if (event.suggestedActions) suggestedActions = event.suggestedActions;
              if (event.cached) cached = true;
              break;
            case 'done':
              if (event.confidence) confidence = event.confidence;
              if (event.model) model = event.model;
              if (event.toolsUsed) toolsUsed = event.toolsUsed;
              if (event.suggestedActions) suggestedActions = event.suggestedActions;
              if (event.conversationId) conversationId = event.conversationId;
              if (event.cached) cached = true;
              break;
            case 'error':
              throw new Error(event.error || 'AI processing error');
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'AI processing error' && !e.message.startsWith('API request failed')) {
            // JSON parse error — skip malformed event
            continue;
          }
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    response: content,
    message: content,
    sources,
    confidence,
    model,
    suggestions: suggestedActions.map(a => a.label),
    suggestedActions,
    toolsUsed,
    conversationId,
    cached,
  };
}
