import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ current, total, label, className = '' }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{label}</span>
          <span>{current}/{total} ({percentage}%)</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ inlineSize: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface ContractProgressProps {
  contractId: string;
  onProgressUpdate?: (progress: { current: number; total: number }) => void;
}

export function ContractProgress({ contractId, onProgressUpdate }: ContractProgressProps) {
  const [progress, setProgress] = React.useState({ current: 0, total: 0 });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/contracts/${contractId}/progress`, {
          headers: {
            'x-tenant-id': localStorage.getItem('tenantId') || 'demo',
          },
        });

        if (!response.ok) {
          throw new Error(`Progress fetch failed: ${response.status}`);
        }

        const data = await response.json();
        setProgress(data);
        onProgressUpdate?.(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch progress');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
    
    // Poll for updates every 2 seconds if not complete
    const interval = setInterval(() => {
      if (progress.current < progress.total) {
        fetchProgress();
      }
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, progress.current, progress.total, onProgressUpdate]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
        <div className="h-2 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        Error loading progress: {error}
      </div>
    );
  }

  const isComplete = progress.current >= progress.total && progress.total > 0;

  return (
    <ProgressBar
      current={progress.current}
      total={progress.total}
      label="Analysis Progress"
      className={isComplete ? 'opacity-75' : ''}
    />
  );
}
