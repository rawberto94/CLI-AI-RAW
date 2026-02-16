'use client';

/**
 * Risk Radar Dashboard
 *
 * Visual risk assessment showing portfolio-wide contract risks
 * in a radar/heat-map layout with drill-down capability.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Shield,
  TrendingDown,
  TrendingUp,
  Activity,
  Eye,
  Filter,
  RefreshCw,
  ChevronRight,
  Clock,
  DollarSign,
  FileWarning,
  Scale,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface RiskItem {
  id: string;
  contractId: string;
  contractName: string;
  supplierName: string;
  riskCategory: RiskCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  score: number; // 0-100
  trend: 'increasing' | 'stable' | 'decreasing';
  description: string;
  detectedAt: string;
  recommendedAction: string;
  factors: string[];
}

type RiskCategory =
  | 'financial'
  | 'compliance'
  | 'operational'
  | 'deadline'
  | 'legal'
  | 'counterparty';

interface RiskSummary {
  totalRisks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  byCategory: Record<RiskCategory, number>;
  portfolioRiskScore: number;
  trend: 'improving' | 'stable' | 'worsening';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RISK_CATEGORIES: { key: RiskCategory; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'financial', label: 'Financial', icon: DollarSign, color: 'text-amber-500' },
  { key: 'compliance', label: 'Compliance', icon: Scale, color: 'text-red-500' },
  { key: 'operational', label: 'Operational', icon: Activity, color: 'text-blue-500' },
  { key: 'deadline', label: 'Deadline', icon: Clock, color: 'text-orange-500' },
  { key: 'legal', label: 'Legal', icon: FileWarning, color: 'text-purple-500' },
  { key: 'counterparty', label: 'Counterparty', icon: Shield, color: 'text-indigo-500' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function RiskRadarDashboard() {
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<RiskCategory | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<RiskItem | null>(null);

  const fetchRiskData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/intelligence/risk-radar');
      const json = await res.json();
      if (json.success && json.data) {
        setRisks(json.data.risks || []);
        setSummary(json.data.summary || null);
      } else {
        setRisks([]);
        setSummary(null);
      }
    } catch {
      toast.error('Failed to load risk data');
      setRisks([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRiskData();
  }, [fetchRiskData]);

  const filteredRisks = useMemo(() => {
    return risks.filter(r => {
      if (selectedCategory !== 'all' && r.riskCategory !== selectedCategory) return false;
      if (selectedSeverity !== 'all' && r.severity !== selectedSeverity) return false;
      return true;
    });
  }, [risks, selectedCategory, selectedSeverity]);

  const severityCounts = useMemo(() => ({
    critical: risks.filter(r => r.severity === 'critical').length,
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
    low: risks.filter(r => r.severity === 'low').length,
  }), [risks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Risk Radar</h2>
          <p className="text-muted-foreground">
            Real-time portfolio risk assessment across all contracts
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRiskData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Portfolio Risk</span>
            </div>
            <p className="text-2xl font-bold mt-1">{summary?.portfolioRiskScore ?? '—'}</p>
            <div className="flex items-center gap-1 mt-1">
              {summary?.trend === 'worsening' ? (
                <TrendingUp className="h-3 w-3 text-red-500" />
              ) : summary?.trend === 'improving' ? (
                <TrendingDown className="h-3 w-3 text-green-500" />
              ) : (
                <Activity className="h-3 w-3 text-yellow-500" />
              )}
              <span className="text-xs text-muted-foreground capitalize">{summary?.trend ?? 'unknown'}</span>
            </div>
          </CardContent>
        </Card>

        {(['critical', 'high', 'medium', 'low'] as const).map(sev => (
          <Card
            key={sev}
            className={`col-span-1 cursor-pointer transition-all ${selectedSeverity === sev ? 'ring-2 ring-violet-500' : ''}`}
            onClick={() => setSelectedSeverity(prev => prev === sev ? 'all' : sev)}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <span className="text-xs text-muted-foreground capitalize">{sev}</span>
              <p className="text-2xl font-bold mt-1">{severityCounts[sev]}</p>
              <Badge className={`mt-1 text-[10px] ${SEVERITY_COLORS[sev]}`}>{sev}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          All Categories
        </Button>
        {RISK_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const count = summary?.byCategory?.[cat.key] ?? risks.filter(r => r.riskCategory === cat.key).length;
          return (
            <Button
              key={cat.key}
              variant={selectedCategory === cat.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(prev => prev === cat.key ? 'all' : cat.key)}
              className="gap-1"
            >
              <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
              {cat.label}
              {count > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{count}</Badge>}
            </Button>
          );
        })}
      </div>

      {/* Risk List + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Items */}
        <div className="lg:col-span-2 space-y-3">
          {loading && (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3" />
              <p>Loading risk data...</p>
            </div>
          )}
          {!loading && filteredRisks.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No risks detected</p>
                <p className="text-sm mt-1">
                  {risks.length > 0 ? 'No risks match the current filters' : 'Risk data will appear as contracts are analyzed'}
                </p>
              </CardContent>
            </Card>
          )}
          <AnimatePresence>
            {filteredRisks.map((risk, index) => (
              <motion.div
                key={risk.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedRisk?.id === risk.id ? 'ring-2 ring-violet-500' : ''}`}
                  onClick={() => setSelectedRisk(risk)}
                >
                  <CardContent className="py-4 px-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={SEVERITY_COLORS[risk.severity]}>{risk.severity}</Badge>
                          <Badge variant="outline" className="text-[10px]">{risk.riskCategory}</Badge>
                          {risk.trend === 'increasing' && <TrendingUp className="h-3 w-3 text-red-500" />}
                          {risk.trend === 'decreasing' && <TrendingDown className="h-3 w-3 text-green-500" />}
                        </div>
                        <h4 className="font-semibold text-sm">{risk.contractName}</h4>
                        <p className="text-xs text-muted-foreground">{risk.supplierName}</p>
                        <p className="text-sm mt-1 text-slate-600 dark:text-slate-400 line-clamp-2">{risk.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-2xl font-bold">{risk.score}</div>
                        <div className="text-[10px] text-muted-foreground">Risk Score</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Risk Detail Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {selectedRisk ? 'Risk Detail' : 'Select a Risk'}
              </CardTitle>
              {selectedRisk && (
                <CardDescription>{selectedRisk.contractName}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedRisk ? (
                <div className="space-y-4">
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1">Description</h5>
                    <p className="text-sm">{selectedRisk.description}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-1">Recommended Action</h5>
                    <div className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{selectedRisk.recommendedAction}</p>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Contributing Factors</h5>
                    <div className="space-y-1">
                      {selectedRisk.factors.map((factor, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          {factor}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        window.open(`/contracts/${selectedRisk.contractId}`, '_blank');
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Contract
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Click on a risk item to see details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
