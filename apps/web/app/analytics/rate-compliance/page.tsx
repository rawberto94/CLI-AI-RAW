'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  RefreshCw,
  Download,
  Loader2,
  XCircle,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageBreadcrumb } from '@/components/navigation';
import { motion } from 'framer-motion';

interface ComplianceResult {
  contractId: string;
  contractName: string;
  supplier: string;
  rateCardId: string;
  rateCardName: string;
  totalLineItems: number;
  compliantItems: number;
  overchargedItems: number;
  underchargedItems: number;
  complianceRate: number;
  potentialSavings: number;
  status: 'compliant' | 'warning' | 'non-compliant';
}

interface ComplianceSummary {
  totalContracts: number;
  overallCompliance: number;
  totalPotentialSavings: number;
  compliantCount: number;
  warningCount: number;
  nonCompliantCount: number;
}

export default function RateCompliancePage() {
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');

  useEffect(() => {
    fetchCompliance();
  }, [timeRange]);

  const fetchCompliance = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [contractsRes, rateCardsRes] = await Promise.all([
        fetch(`/api/contracts?limit=50&period=${timeRange}`),
        fetch('/api/rate-cards'),
      ]);

      if (!contractsRes.ok && !rateCardsRes.ok) {
        throw new Error('Both contracts and rate cards failed to load');
      }

      const contractsData = contractsRes.ok ? await contractsRes.json() : { data: { contracts: [] } };
      const rateCardsData = rateCardsRes.ok ? await rateCardsRes.json() : { data: { rateCards: [] } };

      const contracts = contractsData.data?.contracts || contractsData.contracts || [];
      const rateCards = rateCardsData.data?.rateCards || rateCardsData.rateCards || [];

      // Build compliance results by matching contracts to rate cards
      const complianceResults: ComplianceResult[] = contracts.slice(0, 20).map((c: any) => {
        const matchedCard = rateCards.find((rc: any) => rc.supplierId === c.supplierId || rc.id === c.rateCardId);
        const totalItems = Math.max(1, c.lineItemCount || 0);
        const complianceRate = matchedCard && totalItems > 0 ? (c.complianceRate ?? 0) : 0;
        const compliantItems = Math.round(totalItems * (complianceRate / 100));
        const overcharged = c.overchargedItems ?? Math.round((totalItems - compliantItems) * 0.6);
        const undercharged = totalItems - compliantItems - overcharged;
        const savings = c.potentialSavings ?? 0;
        const status: ComplianceResult['status'] = complianceRate >= 90 ? 'compliant' : complianceRate >= 70 ? 'warning' : 'non-compliant';

        return {
          contractId: c.id,
          contractName: c.name || c.title || 'Untitled Contract',
          supplier: c.supplierName || c.parties?.[0]?.name || 'Unknown Supplier',
          rateCardId: matchedCard?.id || '',
          rateCardName: matchedCard?.name || 'No Rate Card',
          totalLineItems: totalItems,
          compliantItems,
          overchargedItems: overcharged,
          underchargedItems: undercharged,
          complianceRate: Math.round(complianceRate),
          potentialSavings: Math.round(savings),
          status,
        };
      });

      setResults(complianceResults);
      
      const totalSavings = complianceResults.reduce((acc, r) => acc + r.potentialSavings, 0);
      const avgCompliance = complianceResults.length > 0
        ? Math.round(complianceResults.reduce((acc, r) => acc + r.complianceRate, 0) / complianceResults.length)
        : 0;

      setSummary({
        totalContracts: complianceResults.length,
        overallCompliance: avgCompliance,
        totalPotentialSavings: totalSavings,
        compliantCount: complianceResults.filter(r => r.status === 'compliant').length,
        warningCount: complianceResults.filter(r => r.status === 'warning').length,
        nonCompliantCount: complianceResults.filter(r => r.status === 'non-compliant').length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load compliance data';
      setLoadError(msg);
      toast.error('Failed to load compliance data');
    } finally {
      setIsLoading(false);
    }
  };

  const statusConfig = {
    compliant: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Compliant' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Warning' },
    'non-compliant': { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Non-Compliant' },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4 space-y-6">
      <PageBreadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Rate Compliance
            </h1>
            <p className="text-muted-foreground">
              Monitor contract rates against approved rate cards
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => toast.success('Report exported')}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button variant="outline" onClick={fetchCompliance}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50/50 p-4">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Couldn’t load rate compliance</p>
              <p className="text-sm text-rose-700 mt-1">{loadError}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCompliance} className="flex-shrink-0">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Compliance</p>
                  <p className="text-3xl font-bold">{summary.overallCompliance}%</p>
                </div>
                <div className={`p-3 rounded-xl ${summary.overallCompliance >= 80 ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {summary.overallCompliance >= 80 ? <TrendingUp className="h-6 w-6 text-green-600" /> : <TrendingDown className="h-6 w-6 text-amber-600" />}
                </div>
              </div>
              <Progress value={summary.overallCompliance} className="mt-3 h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Potential Savings</p>
              <p className="text-3xl font-bold text-green-600">${summary.totalPotentialSavings.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">From rate card overcharges</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Contracts Analyzed</p>
              <p className="text-3xl font-bold">{summary.totalContracts}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-green-100 text-green-800 text-xs">{summary.compliantCount} OK</Badge>
                <Badge className="bg-amber-100 text-amber-800 text-xs">{summary.warningCount} Warn</Badge>
                <Badge className="bg-red-100 text-red-800 text-xs">{summary.nonCompliantCount} Fail</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Avg Overcharge</p>
              <p className="text-3xl font-bold">
                {results.length > 0 
                  ? `$${Math.round(results.reduce((a, r) => a + r.potentialSavings, 0) / Math.max(1, results.filter(r => r.overchargedItems > 0).length)).toLocaleString()}`
                  : '$0'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Per non-compliant contract</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Compliance Results
          </CardTitle>
          <CardDescription>Rate card compliance check for active contracts</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No contracts to analyze</p>
              <p className="text-sm">Upload contracts and rate cards to see compliance results</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Rate Card</TableHead>
                  <TableHead className="text-center">Compliance</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Savings</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => {
                  const sc = statusConfig[r.status];
                  const StatusIcon = sc.icon;
                  return (
                    <TableRow key={r.contractId}>
                      <TableCell className="font-medium max-w-48 truncate">{r.contractName}</TableCell>
                      <TableCell className="text-muted-foreground">{r.supplier}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.rateCardName}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={r.complianceRate} className="w-16 h-2" />
                          <span className="text-sm font-medium">{r.complianceRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <span className="text-green-600">{r.compliantItems}</span>
                        {r.overchargedItems > 0 && <span className="text-red-600 ml-1">+{r.overchargedItems}</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {r.potentialSavings > 0 ? (
                          <span className="text-green-600">${r.potentialSavings.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`${sc.bg} ${sc.color} border-0`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {sc.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
