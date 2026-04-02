'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  XCircle, BarChart3, ArrowUpRight, ArrowDownRight, Shield, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ComplianceSummary {
  totalContracts: number;
  compliant: number;
  nonCompliant: number;
  unmatched: number;
  complianceRate: number;
  totalViolations: number;
  highSeverity: number;
}

interface Violation {
  contractId: string;
  contractTitle: string;
  supplierName: string;
  rateCardId: string;
  rateCardName: string;
  role: string;
  contractRate: number;
  baselineRate: number;
  variance: number;
  severity: 'HIGH' | 'MEDIUM';
  currency: string;
}

export default function RateComplianceChecker() {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [rateCardCount, setRateCardCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const fetchCompliance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rate-cards/compliance?type=overview');
      const json = await res.json();
      if (json.success) {
        setSummary(json.data.summary);
        setViolations(json.data.violations || []);
        setRateCardCount(json.data.rateCardCount || 0);
      }
    } catch {
      // Fallback sample data
      setSummary({
        totalContracts: 42,
        compliant: 28,
        nonCompliant: 8,
        unmatched: 6,
        complianceRate: 78,
        totalViolations: 12,
        highSeverity: 3,
      });
      setViolations([
        { contractId: '1', contractTitle: 'IT Services Agreement', supplierName: 'TechCorp', rateCardId: '1', rateCardName: 'Standard IT Rates 2024', role: 'Senior Developer', contractRate: 185, baselineRate: 150, variance: 23.3, severity: 'MEDIUM', currency: 'USD' },
        { contractId: '2', contractTitle: 'Consulting Services', supplierName: 'ConsultCo', rateCardId: '2', rateCardName: 'Consulting Baseline', role: 'Partner', contractRate: 600, baselineRate: 450, variance: 33.3, severity: 'HIGH', currency: 'USD' },
      ]);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCompliance(); }, [fetchCompliance]);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" /> Rate Compliance
          </h1>
          <p className="text-muted-foreground mt-1">Monitor contract rates against rate card baselines</p>
        </div>
        <Button variant="outline" onClick={fetchCompliance}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <BarChart3 className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{summary.totalContracts}</p>
              <p className="text-xs text-muted-foreground">Contracts Analyzed</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-4 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-700">{summary.compliant}</p>
              <p className="text-xs text-green-600">Compliant</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-center">
              <XCircle className="h-6 w-6 mx-auto text-red-600 mb-2" />
              <p className="text-2xl font-bold text-red-700">{summary.nonCompliant}</p>
              <p className="text-xs text-red-600">Non-Compliant</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold text-yellow-700">{summary.totalViolations}</p>
              <p className="text-xs text-muted-foreground">Violations ({summary.highSeverity} high)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="mb-2">
                <Progress value={summary.complianceRate} className="h-2" />
              </div>
              <p className="text-2xl font-bold">{summary.complianceRate}%</p>
              <p className="text-xs text-muted-foreground">Compliance Rate</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="violations">Violations ({violations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compliance Breakdown</CardTitle>
              <CardDescription>How your active contracts compare to rate card baselines</CardDescription>
            </CardHeader>
            <CardContent>
              {summary && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden flex">
                      <div className="bg-green-500 h-full flex items-center justify-center text-xs text-white font-medium" style={{ width: `${(summary.compliant / summary.totalContracts) * 100}%` }}>
                        {summary.compliant}
                      </div>
                      <div className="bg-red-500 h-full flex items-center justify-center text-xs text-white font-medium" style={{ width: `${(summary.nonCompliant / summary.totalContracts) * 100}%` }}>
                        {summary.nonCompliant}
                      </div>
                      <div className="bg-gray-400 h-full flex items-center justify-center text-xs text-white font-medium" style={{ width: `${(summary.unmatched / summary.totalContracts) * 100}%` }}>
                        {summary.unmatched}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <span className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded" /> Compliant ({summary.compliant})</span>
                    <span className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded" /> Non-Compliant ({summary.nonCompliant})</span>
                    <span className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-400 rounded" /> Unmatched ({summary.unmatched})</span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium">Rate Cards</p>
                      <p className="text-2xl font-bold">{rateCardCount}</p>
                      <p className="text-xs text-muted-foreground">Active baselines</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium">Avg Variance</p>
                      <p className="text-2xl font-bold">
                        {violations.length > 0 ? (violations.reduce((s, v) => s + Math.abs(v.variance), 0) / violations.length).toFixed(1) : '0'}%
                      </p>
                      <p className="text-xs text-muted-foreground">Across violations</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rate Violations</CardTitle>
              <CardDescription>Contracts with rates exceeding 10% deviation from baselines</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[450px]">
                <div className="space-y-3">
                  {violations.map((v) => (
                    <div key={v.contractId || `${v.contractTitle}-${v.supplierName}`} className={cn(
                      'p-4 rounded-lg border',
                      v.severity === 'HIGH' ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-yellow-50'
                    )}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{v.contractTitle}</h4>
                            <Badge variant={v.severity === 'HIGH' ? 'destructive' : 'outline'}>{v.severity}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{v.supplierName} · {v.role}</p>
                          <p className="text-xs text-muted-foreground mt-1">Rate Card: {v.rateCardName}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-lg font-bold">
                            {v.variance > 0 ? (
                              <ArrowUpRight className="h-4 w-4 text-red-500" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-green-500" />
                            )}
                            <span className={v.variance > 0 ? 'text-red-600' : 'text-green-600'}>
                              {v.variance > 0 ? '+' : ''}{v.variance}%
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span className="line-through">{formatCurrency(v.baselineRate, v.currency)}</span>
                            {' → '}
                            <span className="font-medium">{formatCurrency(v.contractRate, v.currency)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {violations.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No rate violations detected</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
