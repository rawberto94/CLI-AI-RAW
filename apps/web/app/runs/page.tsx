"use client";
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function RunsPage() {
  const { data } = useSWR('/api/v2/runs', fetcher, { refreshInterval: 5000 });
  const runs = Array.isArray(data) ? data : [];
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Runs</h1>
      <ul className="space-y-2">
        {runs.map((r: any) => (
          <li key={r.runId} className="text-sm">
            <a href={`/runs/${r.runId}`} className="text-blue-600 underline">{r.runId}</a>
            <span className="ml-2">{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
