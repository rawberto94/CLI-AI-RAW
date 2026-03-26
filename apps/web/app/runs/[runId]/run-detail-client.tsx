"use client";
import { useEffect, useRef, useState } from 'react';

export function RunDetailClient({ params }: { params: { runId: string } }) {
  const { runId } = params;
  const [steps, setSteps] = useState<any[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/v2/stream/${runId}`);
    esRef.current = es;
    es.addEventListener('step', (ev) => {
      try { setSteps((prev) => [...prev, JSON.parse((ev as MessageEvent).data)]); } catch (err) { console.error('[RunDetail] Failed to parse step event:', err); }
    });
    es.addEventListener('done', (ev) => {
      try { const data = JSON.parse((ev as MessageEvent).data); setSummary(data.summary || null); } catch (err) { console.error('[RunDetail] Failed to parse done event:', err); }
      setDone(true);
      es.close(); esRef.current = null;
    });
    es.onerror = () => { setDone(true); es.close(); esRef.current = null; };
    return () => { esRef.current?.close(); };
  }, [runId]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Run {runId}</h1>
      <div>
        <h2 className="text-xl font-medium">Steps</h2>
        <ul className="space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="text-sm"><b>{s.name}</b>: {s.status}</li>
          ))}
        </ul>
      </div>
      {summary && (
        <div>
          <h2 className="text-xl font-medium">Summary</h2>
          <p className="text-sm whitespace-pre-wrap">{summary}</p>
        </div>
      )}
      {done && <div className="text-sm text-gray-600">Completed</div>}
    </div>
  );
}