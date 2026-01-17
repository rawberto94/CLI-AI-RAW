import { useEffect, useRef, useState } from 'react';

export interface StreamEvent {
  type: 'start' | 'delta' | 'complete' | 'error';
  artifactId?: string;
  content?: string;
  validation?: any;
  success?: boolean;
  error?: string;
}

export function useImprovementStream(
  contractId: string,
  artifactId: string,
  userPrompt: string,
  userId: string,
  enabled: boolean
) {
  const [streamedContent, setStreamedContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !userPrompt || isStreaming) return;

    const startStream = async () => {
      setIsStreaming(true);
      setStreamedContent('');
      setError(null);
      setCompleted(false);
      setValidation(null);

      try {
        // POST to initiate stream
        const response = await fetch(
          `/api/contracts/${contractId}/artifacts/${artifactId}/improve-stream`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userPrompt, userId }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const event: StreamEvent = JSON.parse(data);

                if (event.type === 'delta' && event.content) {
                  setStreamedContent((prev) => prev + event.content);
                } else if (event.type === 'complete') {
                  setValidation(event.validation);
                  setCompleted(true);
                  setIsStreaming(false);
                } else if (event.type === 'error') {
                  setError(event.error || 'Unknown error');
                  setIsStreaming(false);
                }
              } catch {
                // Failed to parse SSE event
              }
            }
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Streaming failed';
        setError(message);
        setIsStreaming(false);
      }
    };

    startStream();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [enabled, contractId, artifactId, userPrompt, userId]);

  return {
    streamedContent,
    isStreaming,
    error,
    validation,
    completed,
  };
}
