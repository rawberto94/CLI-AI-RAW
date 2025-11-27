"use client";

import { useQuery } from '@tanstack/react-query';

const fetchRuns = async () => {
  const response = await fetch('/api/v2/runs');
  if (!response.ok) {
    throw new Error('Failed to fetch runs');
  }
  return response.json();
};

export default function RunsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['runs'],
    queryFn: fetchRuns,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const runs = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Runs</h1>
        <div className="text-sm text-muted-foreground">Loading runs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Runs</h1>
        <div className="text-sm text-red-600">Failed to load runs</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Runs</h1>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs found</p>
      ) : (
        <ul className="space-y-2">
          {runs.map((r: any) => (
            <li key={r.runId} className="text-sm">
              <a href={`/runs/${r.runId}`} className="text-blue-600 underline">{r.runId}</a>
              <span className="ml-2">{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
