/**
 * Streaming Handler Hook
 * 
 * Handles streaming API responses with retry logic, 
 * tool progress tracking, and abort capability.
 * 
 * Consolidated from FloatingAIBubble and AIChatbot streaming logic.
 */

import { useState, useCallback, useRef } from 'react';

export interface StreamingState {
  isStreaming: boolean;
  content: string;
  toolsUsed: string[];
  currentTool: string | null;
  thinkingStage: number;
  error: string | null;
  ragSources: RagSource[];
  metadata?: StreamMetadata;
  planSteps?: Array<{ step: number; description: string }>;
  toolPreviews?: Array<{ toolName: string; preview: Record<string, unknown> }>;
  selfCritique?: { score: number; note: string; grounded: boolean };
}

export interface RagSource {
  id: string;
  contractTitle?: string;
  supplierName?: string;
  relevance: number;
  chunk?: string;
}

export interface StreamMetadata {
  model?: string;
  tokenCount?: number;
  processingTime?: number;
  agentUsed?: boolean;
  steps?: number;
}

interface StreamOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onProgress?: (state: StreamingState) => void;
  onComplete?: (content: string, metadata?: StreamMetadata) => void;
  onError?: (error: string) => void;
}

const DEFAULT_OPTIONS: Required<StreamOptions> = {
  maxRetries: 2,
  retryDelay: 1000,
  timeout: 60000,
  onProgress: () => {},
  onComplete: () => {},
  onError: () => {},
};

// Thinking stage messages
const THINKING_STAGES = [
  'Analyzing your question...',
  'Searching relevant context...',
  'Processing contracts...',
  'Generating response...',
];

export function useStreamingHandler(options: StreamOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    content: '',
    toolsUsed: [],
    currentTool: null,
    thinkingStage: 0,
    error: null,
    ragSources: [],
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const thinkingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Start thinking animation
  const startThinkingAnimation = useCallback(() => {
    setState(prev => ({ ...prev, thinkingStage: 0 }));
    thinkingIntervalRef.current = setInterval(() => {
      setState(prev => ({
        ...prev,
        thinkingStage: (prev.thinkingStage + 1) % THINKING_STAGES.length,
      }));
    }, 2000);
  }, []);
  
  // Stop thinking animation
  const stopThinkingAnimation = useCallback(() => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
  }, []);
  
  // Abort current request
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopThinkingAnimation();
    setState(prev => ({ ...prev, isStreaming: false }));
  }, [stopThinkingAnimation]);
  
  // Parse SSE line
  const parseSSELine = useCallback((line: string) => {
    if (!line.startsWith('data: ')) return null;
    
    const data = line.slice(6);
    if (data === '[DONE]') return { type: 'done' };
    
    try {
      return JSON.parse(data);
    } catch {
      // Plain text content
      return { type: 'content', text: data };
    }
  }, []);
  
  // Stream message
  const streamMessage = useCallback(async (
    message: string,
    conversationHistory: Array<{ role: string; content: string }>,
    context?: Record<string, unknown>
  ): Promise<string> => {
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    
    setState({
      isStreaming: true,
      content: '',
      toolsUsed: [],
      currentTool: null,
      thinkingStage: 0,
      error: null,
      ragSources: [],
    });
    
    startThinkingAnimation();
    
    try {
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, opts.timeout);
      
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory,
          context,
          stream: true,
        }),
        signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      if (!response.body) {
        throw new Error('No response body');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let metadata: StreamMetadata | undefined;
      
      stopThinkingAnimation();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          const parsed = parseSSELine(line);
          if (!parsed) continue;
          
          switch (parsed.type) {
            case 'content':
              fullContent += parsed.text || '';
              setState(prev => {
                const newState = { ...prev, content: fullContent };
                opts.onProgress(newState);
                return newState;
              });
              break;
              
            case 'tool_start':
              setState(prev => ({
                ...prev,
                currentTool: parsed.tool || parsed.toolName,
                toolsUsed: prev.toolsUsed.includes(parsed.tool || parsed.toolName) 
                  ? prev.toolsUsed 
                  : [...prev.toolsUsed, parsed.tool || parsed.toolName],
              }));
              break;
              
            case 'tool_end':
            case 'tool_done':
              setState(prev => ({ ...prev, currentTool: null }));
              break;
              
            case 'tool_preview':
              setState(prev => ({
                ...prev,
                toolPreviews: [
                  ...(prev.toolPreviews || []),
                  { toolName: parsed.toolName, preview: parsed.preview },
                ],
              }));
              break;
              
            case 'plan':
              setState(prev => ({
                ...prev,
                planSteps: (parsed.steps || []).map((s: { step?: number; description?: string }, i: number) => ({
                  step: s.step || i + 1,
                  description: s.description || String(s),
                })),
              }));
              break;
              
            case 'rag_sources':
              setState(prev => ({
                ...prev,
                ragSources: parsed.sources || [],
              }));
              break;
              
            case 'metadata':
              metadata = {
                model: parsed.model,
                tokenCount: parsed.tokenCount,
                processingTime: parsed.processingTime,
                agentUsed: parsed.agentUsed,
                steps: parsed.steps,
              };
              setState(prev => ({ ...prev, metadata }));
              break;
              
            case 'done':
              // Extract selfCritique from done event if present
              if (parsed.selfCritique) {
                setState(prev => ({
                  ...prev,
                  selfCritique: parsed.selfCritique,
                }));
              }
              break;
          }
        }
      }
      
      setState(prev => ({ ...prev, isStreaming: false }));
      opts.onComplete(fullContent, metadata);
      retryCountRef.current = 0;
      
      return fullContent;
      
    } catch (error) {
      stopThinkingAnimation();
      
      if (signal.aborted) {
        setState(prev => ({ ...prev, isStreaming: false, error: 'Request cancelled' }));
        return '';
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Retry logic
      if (retryCountRef.current < opts.maxRetries) {
        retryCountRef.current++;
        const delay = opts.retryDelay * Math.pow(2, retryCountRef.current - 1);
        
        setState(prev => ({
          ...prev,
          error: `Retrying... (${retryCountRef.current}/${opts.maxRetries})`,
        }));
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return streamMessage(message, conversationHistory, context);
      }
      
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: errorMessage,
      }));
      
      opts.onError(errorMessage);
      return '';
    }
  }, [opts, parseSSELine, startThinkingAnimation, stopThinkingAnimation]);
  
  // Non-streaming fallback
  const sendMessage = useCallback(async (
    message: string,
    conversationHistory: Array<{ role: string; content: string }>,
    context?: Record<string, unknown>
  ): Promise<string> => {
    setState(prev => ({
      ...prev,
      isStreaming: true,
      error: null,
    }));
    
    startThinkingAnimation();
    
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory,
          context,
        }),
      });
      
      stopThinkingAnimation();
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const content = data.response || data.message || '';
      
      setState(prev => ({
        ...prev,
        isStreaming: false,
        content,
        ragSources: data.sources || [],
        metadata: {
          model: data.model,
          tokenCount: data.tokenCount,
        },
      }));
      
      opts.onComplete(content);
      return content;
      
    } catch (error) {
      stopThinkingAnimation();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: errorMessage,
      }));
      
      opts.onError(errorMessage);
      return '';
    }
  }, [opts, startThinkingAnimation, stopThinkingAnimation]);
  
  return {
    state,
    streamMessage,
    sendMessage,
    abort,
    thinkingMessage: THINKING_STAGES[state.thinkingStage],
    isActive: state.isStreaming,
  };
}

export default useStreamingHandler;
