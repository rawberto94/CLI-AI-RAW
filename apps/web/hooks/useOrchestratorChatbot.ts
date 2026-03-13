/**
 * useOrchestratorChatbot
 * Hook for chatbot integration with orchestrator progress
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useContractOrchestrator } from './useContractOrchestrator';
import { streamChatToJSON } from '@/lib/ai/stream-to-json';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  orchestratorInfo?: {
    status: string;
    iteration: number;
    artifacts: {
      total: number;
      completed: number;
    };
    suggestions?: Array<{
      type: string;
      relevance: string;
      reason: string;
    }>;
  };
}

interface UseOrchestratorChatbotOptions {
  contractId?: string;
  tenantId: string;
  enabled?: boolean;
}

/**
 * Enhanced chatbot hook that includes orchestrator awareness
 */
export function useOrchestratorChatbot({
  contractId,
  tenantId,
  enabled = true,
}: UseOrchestratorChatbotOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Subscribe to orchestrator progress if contract is specified
  const {
    progress: orchestratorProgress,
    suggestions: orchestratorSuggestions,
    isConnected,
    generateArtifact,
    triggerOrchestrator,
  } = useContractOrchestrator({
    contractId: contractId || '',
    tenantId,
    enabled: enabled && !!contractId,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Add orchestrator context to system messages
  const getSystemContext = useCallback(() => {
    if (!contractId || !orchestratorProgress) return '';

    const context = {
      contractId,
      orchestrator: {
        status: orchestratorProgress.status,
        iteration: orchestratorProgress.iteration,
        artifacts: orchestratorProgress.artifacts,
        currentActivity: orchestratorProgress.agent?.lastDecision?.enqueued || [],
      },
      suggestions: orchestratorSuggestions.slice(0, 3).map((s) => ({
        type: s.type,
        relevance: s.relevance,
        reason: s.reason,
      })),
    };

    return `

## Current Contract Processing Status
${JSON.stringify(context, null, 2)}

You have access to real-time orchestrator information. When users ask about:
- "What's happening?" → Describe current status and activity
- "What artifacts are ready?" → List completed artifacts
- "What can be generated?" → Suggest from available artifact suggestions
- "Generate [artifact]" → Trigger artifact generation via generateArtifact()
- "Re-run processing" → Trigger orchestrator via triggerOrchestrator()
`;
  }, [contractId, orchestratorProgress, orchestratorSuggestions]);

  // Send message with orchestrator context
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        // Check for orchestrator commands
        const lowerContent = content.toLowerCase();
        
        // Handle artifact generation requests
        const artifactMatch = content.match(/generate\s+(\w+)/i);
        if (artifactMatch && contractId) {
          const artifactType = artifactMatch[1].toUpperCase();
          await generateArtifact(artifactType);
          
          const botMessage: ChatMessage = {
            id: `bot-${Date.now()}`,
            role: 'assistant',
            content: `I've triggered generation of the ${artifactType} artifact. You can monitor the progress in real-time above.`,
            timestamp: new Date(),
            orchestratorInfo: orchestratorProgress
              ? {
                  status: orchestratorProgress.status,
                  iteration: orchestratorProgress.iteration,
                  artifacts: orchestratorProgress.artifacts,
                  suggestions: orchestratorSuggestions.slice(0, 3),
                }
              : undefined,
          };
          setMessages((prev) => [...prev, botMessage]);
          setIsLoading(false);
          return;
        }

        // Handle orchestrator trigger
        if (
          lowerContent.includes('re-run') ||
          lowerContent.includes('reprocess') ||
          lowerContent.includes('run again')
        ) {
          if (contractId) {
            await triggerOrchestrator();
            const botMessage: ChatMessage = {
              id: `bot-${Date.now()}`,
              role: 'assistant',
              content: `I've triggered the orchestrator to re-run processing for this contract. The progress will update above in real-time.`,
              timestamp: new Date(),
              orchestratorInfo: orchestratorProgress
                ? {
                    status: orchestratorProgress.status,
                    iteration: orchestratorProgress.iteration,
                    artifacts: orchestratorProgress.artifacts,
                    suggestions: orchestratorSuggestions.slice(0, 3),
                  }
                : undefined,
            };
            setMessages((prev) => [...prev, botMessage]);
            setIsLoading(false);
            return;
          }
        }

        // Handle status queries
        if (
          lowerContent.includes("what's happening") ||
          lowerContent.includes('status') ||
          lowerContent.includes('progress')
        ) {
          if (orchestratorProgress) {
            const statusMsg = `
**Current Status:** ${orchestratorProgress.status}
**Iteration:** ${orchestratorProgress.iteration}/${orchestratorProgress.maxIterations}
**Artifacts:** ${orchestratorProgress.artifacts.completed}/${orchestratorProgress.artifacts.total} completed

${
  orchestratorProgress.agent?.lastDecision?.enqueued?.length
    ? `**Currently Processing:**
${orchestratorProgress.agent.lastDecision.enqueued.map((j) => `- ${j.name}`).join('\n')}`
    : ''
}

${
  orchestratorSuggestions.length > 0
    ? `**Recommended Artifacts:**
${orchestratorSuggestions.slice(0, 3).map((s) => `- **${s.type}** (${s.relevance}): ${s.reason}`).join('\n')}`
    : ''
}
            `.trim();

            const botMessage: ChatMessage = {
              id: `bot-${Date.now()}`,
              role: 'assistant',
              content: statusMsg,
              timestamp: new Date(),
              orchestratorInfo: {
                status: orchestratorProgress.status,
                iteration: orchestratorProgress.iteration,
                artifacts: orchestratorProgress.artifacts,
                suggestions: orchestratorSuggestions.slice(0, 3),
              },
            };
            setMessages((prev) => [...prev, botMessage]);
            setIsLoading(false);
            return;
          }
        }

        // Regular AI chat with orchestrator context
        const systemContext = getSystemContext();
        const result = await streamChatToJSON({
          message: content,
          conversationHistory: messages.slice(-5).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: {
            context: contractId ? 'contract-detail' : 'global',
            contractId,
            systemContext,
          },
          signal: abortControllerRef.current.signal,
        });

        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: result.message || 'I apologize, but I encountered an error.',
          timestamp: new Date(),
          orchestratorInfo: orchestratorProgress
            ? {
                status: orchestratorProgress.status,
                iteration: orchestratorProgress.iteration,
                artifacts: orchestratorProgress.artifacts,
                suggestions: orchestratorSuggestions.slice(0, 3),
              }
            : undefined,
        };

        setMessages((prev) => [...prev, botMessage]);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
        
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      contractId,
      orchestratorProgress,
      orchestratorSuggestions,
      messages,
      getSystemContext,
      generateArtifact,
      triggerOrchestrator,
    ]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    orchestratorProgress,
    orchestratorSuggestions,
    isConnected,
    // Expose direct actions
    generateArtifact,
    triggerOrchestrator,
  };
}
