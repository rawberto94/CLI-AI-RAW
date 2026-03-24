/**
 * useAgenticDraft Hook
 *
 * Consumes SSE from POST /api/ai/agents/draft to drive
 * the 6-step agentic contract drafting pipeline with real-time UI updates.
 *
 * Steps: Intent Detection → Template Selection → Clause Recommendation
 *        → Content Generation → Risk Analysis → Save Draft
 */

'use client';

import { useState, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentStep {
  step: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export interface AgenticDraftResult {
  draftId: string;
  title: string;
  contractType: string;
  templateUsed: { id: string; name: string } | null;
  clausesIncorporated: number;
  risksIdentified: number;
  contentLength: number;
  totalDurationMs: number;
  editUrl: string;
}

export interface AgenticDraftRequest {
  prompt?: string;
  contractType?: string;
  templateId?: string;
  variables?: Record<string, string>;
  clauseIds?: string[];
  tone?: 'formal' | 'standard' | 'plain-english';
  jurisdiction?: string;
  instructions?: string;
  title?: string;
  stream?: boolean;
}

export interface AgenticDraftState {
  isRunning: boolean;
  steps: AgentStep[];
  currentStep: number;
  result: AgenticDraftResult | null;
  error: string | null;
  progress: number; // 0-100
}

const STEP_NAMES = [
  'Intent Detection',
  'Template Selection',
  'Clause Recommendation',
  'Content Generation',
  'Risk Analysis',
  'Save Draft',
];

const INITIAL_STATE: AgenticDraftState = {
  isRunning: false,
  steps: STEP_NAMES.map((name, i) => ({
    step: i + 1,
    name,
    status: 'pending',
  })),
  currentStep: 0,
  result: null,
  error: null,
  progress: 0,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgenticDraft() {
  const [state, setState] = useState<AgenticDraftState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({ ...prev, isRunning: false, error: 'Cancelled' }));
  }, []);

  const generate = useCallback(async (request: AgenticDraftRequest): Promise<AgenticDraftResult | null> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState({
      ...INITIAL_STATE,
      isRunning: true,
    });

    try {
      // Get CSRF token from cookie
      const csrfCookie = document.cookie
        .split('; ')
        .find(c => c.startsWith('csrf_token='));
      const csrfToken = csrfCookie?.split('=').slice(1).join('=') || '';

      const response = await fetch('/api/ai/agents/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({ ...request, stream: true }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result: AgenticDraftResult | null = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep incomplete last line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          if (line.startsWith('event: ')) {
            // SSE event type — handled via data line
            continue;
          }

          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(dataStr);
            } catch {
              continue;
            }

            // Determine event type from the data shape
            if ('totalSteps' in parsed) {
              // metadata event — pipeline started
              continue;
            }

            if ('step' in parsed && 'name' in parsed && 'status' in parsed) {
              // step event
              const stepData = parsed as unknown as AgentStep;
              setState(prev => {
                const steps = [...prev.steps];
                const idx = stepData.step - 1;
                if (idx >= 0 && idx < steps.length) {
                  steps[idx] = {
                    ...steps[idx],
                    status: stepData.status as AgentStep['status'],
                    result: stepData.result as Record<string, unknown> | undefined,
                    error: stepData.error as string | undefined,
                    durationMs: stepData.durationMs as number | undefined,
                  };
                }
                const completedCount = steps.filter(
                  s => s.status === 'completed' || s.status === 'skipped'
                ).length;
                return {
                  ...prev,
                  steps,
                  currentStep: stepData.step,
                  progress: Math.round((completedCount / 6) * 100),
                };
              });
            }

            if ('draftId' in parsed && 'editUrl' in parsed) {
              // done event
              result = parsed as unknown as AgenticDraftResult;
              setState(prev => ({
                ...prev,
                isRunning: false,
                result,
                progress: 100,
              }));
            }

            if ('message' in parsed && !('draftId' in parsed) && !('step' in parsed)) {
              // error event
              const errMsg = parsed.message as string;
              setState(prev => ({
                ...prev,
                isRunning: false,
                error: errMsg,
              }));
              throw new Error(errMsg);
            }
          }
        }
      }

      return result;
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return null;
      }
      const errMsg = error instanceof Error ? error.message : 'Draft generation failed';
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: errMsg,
      }));
      return null;
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  return {
    ...state,
    generate,
    abort,
    reset,
  };
}

export default useAgenticDraft;
