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
  /** Post-generation faithfulness receipt — which of the user's stated values
   *  landed in the draft vs. which the AI dropped. Null when no user prompt
   *  was supplied (e.g. pure template-type flow).
   *  `repaired` = a second LLM pass was run to weave missing values into the draft.
   *  `addendumAppended` = an explicit "User-Requested Terms" schedule was added
   *  at the end of the contract for anything the repair pass still missed. */
  faithfulness?: {
    items: Array<{ label: string; value: string; found: boolean }>;
    honored: number;
    total: number;
    score: number;
    repaired?: boolean;
    addendumAppended?: boolean;
  } | null;
}

export interface AgenticDraftRequest {
  prompt?: string;
  contractType?: string;
  templateId?: string;
  /** Playbook (policy pack) to align the draft with. */
  playbookId?: string;
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
  /** Non-fatal risk warning emitted during the Risk Analysis step. */
  riskWarning: {
    critical: number;
    high: number;
    message: string;
    risks?: Array<{ category: string; severity: string; description: string }>;
  } | null;
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
  riskWarning: null,
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
    // Refuse a new generation while one is already in flight. Without this
    // guard a double-click on "Generate" (or two UI paths racing) overwrites
    // `abortControllerRef.current`, orphans the first stream reader, and
    // interleaves SSE chunks from both responses into the same state slice.
    if (abortControllerRef.current) {
      return null;
    }
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
      // Track the current SSE event name across `event:` / `data:` line pairs.
      let currentEvent: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep incomplete last line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Blank line separates SSE messages — reset the current event name.
          if (!line.trim()) {
            currentEvent = null;
            continue;
          }

          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
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

            const evt = currentEvent || '';

            switch (evt) {
              case 'metadata':
                // pipeline started — nothing to do
                break;

              case 'step': {
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
                break;
              }

              case 'risk_warning': {
                // Non-fatal — surface as a warning, but DO NOT stop the stream.
                setState(prev => ({
                  ...prev,
                  riskWarning: {
                    critical: Number(parsed.critical) || 0,
                    high: Number(parsed.high) || 0,
                    message: String(parsed.message || ''),
                    risks: Array.isArray(parsed.risks)
                      ? (parsed.risks as Array<{ category: string; severity: string; description: string }>)
                      : undefined,
                  },
                }));
                break;
              }

              case 'done': {
                result = parsed as unknown as AgenticDraftResult;
                setState(prev => ({
                  ...prev,
                  isRunning: false,
                  result,
                  progress: 100,
                }));
                break;
              }

              case 'error': {
                const errMsg = String(parsed.message || 'Draft generation failed');
                setState(prev => ({
                  ...prev,
                  isRunning: false,
                  error: errMsg,
                }));
                throw new Error(errMsg);
              }

              default:
                // Unknown event — ignore.
                break;
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
