/**
 * Compliance Issues List
 * Display and manage compliance issues
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface ComplianceIssue {
  id: string;
  contractId: string;
  contractTitle: string;
  issueType: 'missing_clause' | 'expired' | 'non_standard' | 'high_risk';
  severity: 'high' | 'medium' | 'low';
  description: string;
  dueDate?: string;
  createdAt: string;
}

interface ComplianceIssuesListProps {
  issues: ComplianceIssue[];
  isLoading?: boolean;
  onResolve?: (issueId: string) => void;
}

export function ComplianceIssuesList({ issues, isLoading, onResolve }: ComplianceIssuesListProps) {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

  const getSeverityColor = (severity: ComplianceIssue['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low':
        return 'bg-violet-100 text-violet-800 border-violet-200';
    }
  };

  const getIssueTypeLabel = (type: ComplianceIssue['issueType']) => {
    switch (type) {
      case 'missing_clause':
        return 'Missing Clause';
      case 'expired':
        return 'Expired';
      case 'non_standard':
        return 'Non-Standard';
      case 'high_risk':
        return 'High Risk';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (issues.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance Issues</CardTitle>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No compliance issues found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Compliance Issues ({issues.length})</CardTitle>
        <Badge variant="outline">
          {issues.filter((i) => i.severity === 'high').length} High Priority
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="font-medium">{issue.contractTitle}</span>
                  <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                    {issue.severity.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">{getIssueTypeLabel(issue.issueType)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                {issue.dueDate && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      Due: {new Date(issue.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/contracts/${issue.contractId}`}>
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </Link>
                {onResolve && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResolve(issue.id)}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
