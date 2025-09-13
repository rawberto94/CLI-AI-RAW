"use client";
import { useEffect, useRef, useState } from 'react';

export default function AgenticPage() {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<any[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  const start = async () => {
    setRunning(true);
    setSteps([]);
    setSummary(null);
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    // Kick off processing and receive runId
    const res = await fetch("/api/v2/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      setRunning(false);
      return;
    }
    const { runId } = await res.json();
    const es = new EventSource(`/api/v2/stream/${runId}`);
    streamRef.current = es;
    es.addEventListener("step", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        setSteps((prev) => [...prev, data]);
      } catch {}
    });
    es.addEventListener("done", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        setSummary(data.summary || null);
      } catch {}
      setRunning(false);
      es.close();
      streamRef.current = null;
    });
    es.onerror = () => {
      setRunning(false);
      es.close();
      streamRef.current = null;
    };
  };

  useEffect(() => () => streamRef.current?.close(), []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Agentic Processor</h1>
      <textarea
        className="w-full h-40 border rounded p-2"
        placeholder="Paste contract text here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        disabled={!text || running}
        onClick={start}
      >
        {running ? "Running..." : "Run Agent"}
      </button>
      <div className="space-y-2">
        <h2 className="text-xl font-medium">Steps</h2>
        <ul className="space-y-1">
          {steps.map((s, idx) => (
            <li key={idx} className="text-sm">
              <span className="font-semibold">{s.name}</span>: {s.status}
            </li>
          ))}
        </ul>
      </div>
      {summary && (
        <div className="space-y-1">
          <h2 className="text-xl font-medium">Summary</h2>
          <p className="text-sm whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  );
}
