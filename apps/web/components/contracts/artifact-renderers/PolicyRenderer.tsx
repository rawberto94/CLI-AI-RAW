'use client';

/**
 * Policy Check Artifact Content Renderer
 */

import React, { memo } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { FindingSourceLink } from '@/components/contracts/FindingSourceLink';

interface PolicyFinding {
  ruleCode?: string;
  status?: string;
  severity?: string;
  category?: string;
  title?: string;
  detail?: string;
  evidence?: Array<{ quote?: string; startOffset?: number; endOffset?: number; page?: number }>;
  remediation?: string | null;
  penaltyContribution?: number;
  method?: string;
  confidence?: number;
}

interface PolicyData {
  status?: string;
  policyScore?: number;
  penalty?: number;
  packName?: string;
  packVersion?: number;
  mode?: string;
  coverage?: number;
  criticalCount?: number;
  highCount?: number;
  findings?: PolicyFinding[];
  evaluatedAt?: string;
}

interface PolicyRendererProps {
  data: PolicyData;
}

const ISSUE_STATUSES = new Set(['VIOLATION', 'MISSING', 'INCONSISTENCY', 'FAIL', 'REVIEW']);
const UNVERIFIED_STATUSES = new Set(['INSUFFICIENT_EVIDENCE']);
const PASS_STATUSES = new Set(['PASS', 'PASS_WITH_NOTES', 'WAIVED']);

const severityClass = (severity?: string) => {
  const s = (severity || '').toUpperCase();
  if (s === 'BLOCKER' || s === 'CRITICAL') {
    return 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-red-300 dark:border-red-800';
  }
  if (s === 'HIGH') {
    return 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-orange-300 dark:border-orange-800';
  }
  if (s === 'MEDIUM') {
    return 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/50 dark:to-amber-950/50 border-yellow-300 dark:border-yellow-800';
  }
  return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
};

function PolicyFindingCard({
  finding: f,
  contractId,
  quiet,
}: {
  finding: PolicyFinding;
  contractId?: string;
  quiet?: boolean;
}) {
  const headline = f.title || f.detail || f.ruleCode || 'Finding';
  return (
    <div className={`p-6 rounded-xl border-2 shadow-sm ${quiet ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' : severityClass(f.severity)}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{headline}</h4>
          {f.ruleCode && f.ruleCode !== headline && (
            <p className="text-[10px] font-mono text-gray-400 mt-0.5">{f.ruleCode}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs capitalize">{f.status}</Badge>
          {f.severity && (
            <Badge
              variant={['CRITICAL', 'BLOCKER', 'HIGH'].includes((f.severity || '').toUpperCase()) ? 'destructive' : 'secondary'}
              className="text-xs capitalize"
            >
              {f.severity}
            </Badge>
          )}
        </div>
      </div>
      {f.detail && f.detail !== headline && (
        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{f.detail}</p>
      )}
      {f.evidence?.[0]?.quote && (
        <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-sm text-gray-600 dark:text-gray-400 mb-3">
          “{f.evidence[0].quote}”
          <div className="mt-2 not-italic">
            <FindingSourceLink
              contractId={contractId}
              snippet={f.evidence[0].quote}
              heading={f.title || f.ruleCode}
              startOffset={f.evidence[0].startOffset}
              endOffset={f.evidence[0].endOffset}
              page={f.evidence[0].page}
            />
          </div>
        </blockquote>
      )}
      {f.remediation && (
        <div className="mt-3 pt-3 border-t border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Remediation</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{f.remediation}</p>
        </div>
      )}
      {typeof f.penaltyContribution === 'number' && f.penaltyContribution > 0 && (
        <p className="mt-2 text-xs text-gray-500">Score impact −{f.penaltyContribution}</p>
      )}
    </div>
  );
}

export const PolicyRenderer = memo(function PolicyRenderer({ data }: PolicyRendererProps) {
  const params = useParams();
  const contractId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : undefined;
  const findings = (data.findings || []).filter((f) => !PASS_STATUSES.has((f.status || '').toUpperCase()));
  const unverified = findings.filter((f) => UNVERIFIED_STATUSES.has((f.status || '').toUpperCase()));
  const issues = findings.filter((f) => {
    const status = (f.status || '').toUpperCase();
    return ISSUE_STATUSES.has(status) || !UNVERIFIED_STATUSES.has(status);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-white dark:bg-gray-900">
        <div>
          <p className="text-sm text-gray-500">Policy score</p>
          <p className="text-3xl font-bold">{data.policyScore ?? '—'}</p>
        </div>
        <Badge variant={data.status === 'FAIL' ? 'destructive' : 'secondary'} className="text-sm">
          {data.status || 'UNKNOWN'}
        </Badge>
        {data.packName && (
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {data.packName}
            {data.packVersion != null ? ` v${data.packVersion}` : ''}
            {data.mode ? ` · ${data.mode}` : ''}
          </span>
        )}
        {typeof data.coverage === 'number' && (
          <span className="text-xs text-gray-500">
            Coverage {data.coverage <= 1 ? (data.coverage * 100).toFixed(0) : data.coverage.toFixed(0)}%
          </span>
        )}
        {(data.criticalCount || 0) > 0 && (
          <Badge variant="destructive">{data.criticalCount} critical</Badge>
        )}
      </div>

      {issues.length === 0 ? (
        <p className="text-base text-gray-500 dark:text-gray-400 text-center py-8">
          No policy violations found
        </p>
      ) : (
        <div className="space-y-4">
          {issues.map((f, i) => (
            <PolicyFindingCard key={`${f.ruleCode || f.title}-${i}`} finding={f} contractId={contractId} />
          ))}
        </div>
      )}

      {unverified.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500">Could not verify from the document</p>
          {unverified.map((f, i) => (
            <PolicyFindingCard
              key={`unverified-${f.ruleCode || f.title}-${i}`}
              finding={f}
              contractId={contractId}
              quiet
            />
          ))}
        </div>
      )}
    </div>
  );
});
