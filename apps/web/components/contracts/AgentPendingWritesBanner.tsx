'use client';

/**
 * Banner on contract detail when agents have field-change proposals awaiting HITL.
 * Links into Contigo Labs approvals (filtered client-side by queue).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bot, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgentPendingWritesBannerProps {
  contractId: string;
  className?: string;
}

export function AgentPendingWritesBanner({
  contractId,
  className,
}: AgentPendingWritesBannerProps) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agents/approvals?type=agent_write&limit=50');
        if (!res.ok) return;
        const raw = await res.json();
        const approvals = raw?.data?.approvals ?? raw?.approvals ?? [];
        const n = (approvals as Array<{ contractId?: string; type?: string }>).filter(
          (a) => a.type === 'agent_write' && a.contractId === contractId,
        ).length;
        if (!cancelled) setCount(n);
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (loading || count === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3',
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            {count} agent field change{count !== 1 ? 's' : ''} awaiting review
          </p>
          <p className="text-xs text-amber-800/80 mt-0.5">
            An agent proposed updates to this contract. Approve or reject them before they apply.
          </p>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
      >
        <Link href="/contigo-labs?tab=approvals">
          Open approval queue
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </Button>
    </div>
  );
}

export default AgentPendingWritesBanner;
