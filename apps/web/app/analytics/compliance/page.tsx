/**
 * Compliance Analytics Dashboard
 * Monitor contract compliance and identify issues
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageBreadcrumb } from '@/components/navigation';
import { ComplianceMetricsCard } from '@/components/analytics/ComplianceMetricsCard';
import { ComplianceIssuesList } from '@/components/analytics/ComplianceIssuesList';
import { ComplianceTrendChart } from '@/components/analytics/ComplianceTrendChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Download, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';



interface ComplianceData {
  metrics: Array<{
    label: string;
    value: number;
    total: number;
    status: 'compliant' | 'warning' | 'non-compliant' | 'pending';
  }>;
  issues: Array<{
    id: string;
    contractId: string;
    contractTitle: string;
    issueType: 'missing_clause' | 'expired' | 'non_standard' | 'high_risk';
    severity: 'high' | 'medium' | 'low';
    description: string;
    dueDate?: string;
    createdAt: string;
  }>;
  trend: Array<{
    date: string;
    compliant: number;
    warning: number;
    nonCompliant: number;
    total: number;
  }>;
}

export default function ComplianceAnalyticsPage() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchComplianceData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/analytics/compliance?action=report');
      if (!response.ok) throw new Error('Failed to fetch compliance data');
      
      const result = await response.json();
      setData(result.data || result);
    } catch {
      toast.error('Failed to load compliance data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  const handleResolveIssue = async (issueId: string) => {
    try {
      const response = await fetch(`/api/analytics/compliance/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });

      if (!response.ok) throw new Error('Failed to resolve issue');

      toast.success('Issue marked as resolved');
      fetchComplianceData();
    } catch {
      toast.error('Failed to resolve issue');
    }
  };

  const handleExportReport = async () => {
    try {
      const response = await fetch('/api/analytics/compliance/export');
      if (!response.ok) throw new Error('Failed to export report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Report exported successfully');
    } catch {
      toast.error('Failed to export report');
    }
  };

  const overallCompliance = data?.metrics.length
    ? Math.round(
        (data.metrics.reduce((sum, m) => sum + m.value, 0) /
          data.metrics.reduce((sum, m) => sum + m.total, 0)) *
          100
      )
    : 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Breadcrumbs */}
      <div className="mb-2">
        <PageBreadcrumb />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8" />
            Compliance Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor contract compliance and identify potential issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchComplianceData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Compliance Score</CardTitle>
          <CardDescription>
            Aggregate compliance status across all active contracts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-5xl font-bold">
                {overallCompliance}
                <span className="text-2xl text-muted-foreground">%</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.metrics.reduce((sum, m) => sum + m.value, 0) || 0} of{' '}
                {data?.metrics.reduce((sum, m) => sum + m.total, 0) || 0} checks passed
              </p>
            </div>
            <Badge
              variant={
                overallCompliance >= 90
                  ? 'default'
                  : overallCompliance >= 70
                  ? 'secondary'
                  : 'destructive'
              }
              className="text-lg px-4 py-2"
            >
              {overallCompliance >= 90 ? 'Excellent' : overallCompliance >= 70 ? 'Good' : 'Needs Attention'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Metrics and Trend */}
      <div className="grid gap-6 md:grid-cols-2">
        <ComplianceMetricsCard metrics={data?.metrics || []} isLoading={isLoading} />
        <ComplianceTrendChart data={data?.trend || []} isLoading={isLoading} />
      </div>

      {/* Issues List */}
      <ComplianceIssuesList
        issues={data?.issues || []}
        isLoading={isLoading}
        onResolve={handleResolveIssue}
      />

      {/* Action Items */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <FileText className="h-5 w-5 text-violet-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Review high-severity issues</p>
              <p className="text-sm text-muted-foreground">
                {data?.issues.filter((i) => i.severity === 'high').length || 0} contracts require
                immediate attention
              </p>
            </div>
            <Button variant="outline" size="sm">
              Review
            </Button>
          </div>
          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <FileText className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Update compliance checklist</p>
              <p className="text-sm text-muted-foreground">
                Add new compliance requirements to standardized checks
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
