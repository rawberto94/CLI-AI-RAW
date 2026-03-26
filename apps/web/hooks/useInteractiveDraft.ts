/**
 * useInteractiveDraft Hook
 *
 * Manages conversation state for the interactive contract drafting assistant.
 * Consumes SSE events from POST /api/ai/agents/draft-assistant to provide
 * chat-based drafting with context tracking and draft generation.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftingContext {
  contractType?: string;
  parties?: Array<{ name: string; role: string }>;
  jurisdiction?: string;
  keyTerms?: Record<string, string>;
  selectedClauses?: string[];
  tone?: 'formal' | 'standard' | 'plain-english';
  templateId?: string;
  title?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: Array<{ label: string; value: string }>;
  contextUpdates?: Array<{ field: string; value: unknown }>;
  isStreaming?: boolean;
}

export interface GenerationResult {
  draftId: string;
  title: string;
  editUrl: string;
}

export interface InteractiveDraftState {
  messages: ChatMessage[];
  context: DraftingContext;
  isStreaming: boolean;
  isGenerating: boolean;
  readyToGenerate: boolean;
  generationResult: GenerationResult | null;
  error: string | null;
  generationProgress: number;
  generationSteps: Array<{
    step: number;
    name: string;
    status: string;
    durationMs?: number;
  }>;
}

const INITIAL_CONTEXT: DraftingContext = {};

const INITIAL_STATE: InteractiveDraftState = {
  messages: [],
  context: INITIAL_CONTEXT,
  isStreaming: false,
  isGenerating: false,
  readyToGenerate: false,
  generationResult: null,
  error: null,
  generationProgress: 0,
  generationSteps: [],
};

const TOTAL_GENERATION_STEPS = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getCsrfToken(): string {
  const csrfCookie = document.cookie
    .split('; ')
    .find(c => c.startsWith('csrf_token='));
  return csrfCookie?.split('=').slice(1).join('=') || '';
}

function buildConversationHistory(
  messages: ChatMessage[],
  excludeId?: string
): Array<{ role: string; content: string }> {
  return messages
    .filter(m => m.id !== excludeId && !m.isStreaming)
    .map(({ role, content }) => ({ role, content }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInteractiveDraft() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_STATE.messages);
  const [context, setContext] = useState<DraftingContext>(INITIAL_STATE.context);
  const [isStreaming, setIsStreaming] = useState(INITIAL_STATE.isStreaming);
  const [isGenerating, setIsGenerating] = useState(INITIAL_STATE.isGenerating);
  const [readyToGenerate, setReadyToGenerate] = useState(INITIAL_STATE.readyToGenerate);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(INITIAL_STATE.generationResult);
  const [error, setError] = useState<string | null>(INITIAL_STATE.error);
  const [generationProgress, setGenerationProgress] = useState(INITIAL_STATE.generationProgress);
  const [generationSteps, setGenerationSteps] = useState<InteractiveDraftState['generationSteps']>(INITIAL_STATE.generationSteps);

  const abortRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // -----------------------------------------------------------------------
  // SSE stream consumer
  // -----------------------------------------------------------------------

  const consumeStream = useCallback(
    async (
      response: Response,
      assistantMessageId: string,
      mode: 'chat' | 'generate'
    ) => {
      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || line.startsWith('event: ')) continue;

            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              let parsed: Record<string, unknown>;
              try {
                parsed = JSON.parse(dataStr);
              } catch {
                continue;
              }

              if (mode === 'chat') {
                handleChatEvent(parsed, assistantMessageId);
              } else {
                handleGenerationEvent(parsed);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // -----------------------------------------------------------------------
  // Chat event handlers
  // -----------------------------------------------------------------------

  const handleChatEvent = useCallback(
    (parsed: Record<string, unknown>, assistantMessageId: string) => {
      // message — append streamed content
      if ('content' in parsed && typeof parsed.content === 'string' && !('draftId' in parsed)) {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: m.content + parsed.content }
              : m
          )
        );
        return;
      }

      // context_update — merge into context and record on message
      if ('field' in parsed && 'value' in parsed) {
        const field = parsed.field as string;
        const value = parsed.value;

        setContext(prev => ({ ...prev, [field]: value }));
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  contextUpdates: [
                    ...(m.contextUpdates || []),
                    { field, value },
                  ],
                }
              : m
          )
        );
        return;
      }

      // suggestions — attach to the assistant message
      if ('suggestions' in parsed && Array.isArray(parsed.suggestions)) {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  suggestions: parsed.suggestions as Array<{ label: string; value: string }>,
                }
              : m
          )
        );
        return;
      }

      // ready_to_generate
      if ('readyToGenerate' in parsed) {
        setReadyToGenerate(true);
        return;
      }

      // error
      if ('error' in parsed || ('message' in parsed && !('content' in parsed) && !('suggestions' in parsed))) {
        const errMsg = (parsed.error ?? parsed.message) as string;
        setError(errMsg);
        setIsStreaming(false);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, isStreaming: false }
              : m
          )
        );
        return;
      }

      // done — finalize the streamed message
      if ('done' in parsed || 'finished' in parsed) {
        setIsStreaming(false);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, isStreaming: false }
              : m
          )
        );
      }
    },
    []
  );

  // -----------------------------------------------------------------------
  // Generation event handlers
  // -----------------------------------------------------------------------

  const handleGenerationEvent = useCallback(
    (parsed: Record<string, unknown>) => {
      // generation_started
      if ('totalSteps' in parsed || ('status' in parsed && parsed.status === 'started')) {
        return;
      }

      // generation_step — track progress
      if ('step' in parsed && 'name' in parsed && 'status' in parsed && !('draftId' in parsed)) {
        const stepData = parsed as unknown as {
          step: number;
          name: string;
          status: string;
          durationMs?: number;
        };

        setGenerationSteps(prev => {
          const existing = prev.findIndex(s => s.step === stepData.step);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = stepData;
            return updated;
          }
          return [...prev, stepData];
        });

        const completedStep = stepData.step;
        setGenerationProgress(
          Math.round((completedStep / TOTAL_GENERATION_STEPS) * 100)
        );
        return;
      }

      // generation_complete — set result
      if ('draftId' in parsed && 'editUrl' in parsed) {
        const result: GenerationResult = {
          draftId: parsed.draftId as string,
          title: (parsed.title as string) || 'Untitled Draft',
          editUrl: parsed.editUrl as string,
        };
        setGenerationResult(result);
        setIsGenerating(false);
        setGenerationProgress(100);
        return;
      }

      // error
      if ('error' in parsed || ('message' in parsed && !('draftId' in parsed) && !('step' in parsed))) {
        const errMsg = (parsed.error ?? parsed.message) as string;
        setError(errMsg);
        setIsGenerating(false);
        return;
      }

      // done
      if ('done' in parsed || 'finished' in parsed) {
        setIsGenerating(false);
      }
    },
    []
  );

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------

  const sendMessage = useCallback(
    async (message: string) => {
      if (isStreamingRef.current) return;
      isStreamingRef.current = true;
      setError(null);

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const csrfToken = getCsrfToken();

        const conversationHistory = buildConversationHistory(
          [...messages, userMessage],
          assistantMessage.id
        );

        const response = await fetch('/api/ai/agents/draft-assistant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          },
          body: JSON.stringify({
            message,
            conversationHistory,
            context,
            action: 'chat',
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || errorData.message || `HTTP ${response.status}`
          );
        }

        await consumeStream(response, assistantMessage.id, 'chat');

        // Ensure streaming flag is cleared after stream ends
        setIsStreaming(false);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
          )
        );
      } catch (err: unknown) {
        if (controller.signal.aborted) return;

        const errMsg = err instanceof Error ? err.message : 'Failed to send message';
        setError(errMsg);
        setIsStreaming(false);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessage.id
              ? { ...m, content: m.content || errMsg, isStreaming: false }
              : m
          )
        );
      } finally {
        abortRef.current = null;
        isStreamingRef.current = false;
      }
    },
    [messages, context, consumeStream]
  );

  // -----------------------------------------------------------------------
  // generateDraft
  // -----------------------------------------------------------------------

  const generateDraft = useCallback(async () => {
    setError(null);
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationSteps([]);
    setGenerationResult(null);

    const systemMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: 'Generating your contract...',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, systemMessage]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const csrfToken = getCsrfToken();
      const conversationHistory = buildConversationHistory(messages);

      const response = await fetch('/api/ai/agents/draft-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({
          message: 'Generate the draft',
          conversationHistory,
          context,
          action: 'generate',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || errorData.message || `HTTP ${response.status}`
        );
      }

      await consumeStream(response, systemMessage.id, 'generate');

      setIsGenerating(false);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;

      const errMsg = err instanceof Error ? err.message : 'Draft generation failed';
      setError(errMsg);
      setIsGenerating(false);
    } finally {
      abortRef.current = null;
    }
  }, [messages, context, consumeStream]);

  // -----------------------------------------------------------------------
  // updateContext
  // -----------------------------------------------------------------------

  const updateContext = useCallback((updates: Partial<DraftingContext>) => {
    setContext(prev => ({ ...prev, ...updates }));
  }, []);

  // -----------------------------------------------------------------------
  // reset
  // -----------------------------------------------------------------------

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    isStreamingRef.current = false;
    setMessages(INITIAL_STATE.messages);
    setContext(INITIAL_CONTEXT);
    setIsStreaming(INITIAL_STATE.isStreaming);
    setIsGenerating(INITIAL_STATE.isGenerating);
    setReadyToGenerate(INITIAL_STATE.readyToGenerate);
    setGenerationResult(INITIAL_STATE.generationResult);
    setError(INITIAL_STATE.error);
    setGenerationProgress(INITIAL_STATE.generationProgress);
    setGenerationSteps(INITIAL_STATE.generationSteps);
  }, []);

  // -----------------------------------------------------------------------
  // abort
  // -----------------------------------------------------------------------

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    isStreamingRef.current = false;
    setIsStreaming(false);
    setIsGenerating(false);
    setMessages(prev =>
      prev.map(m => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, []);

  return {
    messages,
    context,
    isStreaming,
    isGenerating,
    readyToGenerate,
    generationResult,
    error,
    generationProgress,
    generationSteps,
    sendMessage,
    generateDraft,
    updateContext,
    reset,
    abort,
  };
}

export default useInteractiveDraft;
