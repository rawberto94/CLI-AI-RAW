'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Lock,
  Unlock,
  Settings,
  FileText,
  Users,
  Clock,
  History,
  Activity,
  BarChart3,
  Sliders,
  Bell,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  RefreshCw,
  Download,
  Flag,
  Info,
  Zap,
  Brain,
  Scale,
  AlertCircle,
  Target,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  FileCheck,
  Ban,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useRiskFlags } from '@/hooks/use-optimistic-mutations';

interface Policy {
  id: string;
  name: string;
  description: string;
  category: 'compliance' | 'risk' | 'commercial' | 'legal' | 'operational';
  status: 'active' | 'inactive' | 'draft';
  severity: 'critical' | 'high' | 'medium' | 'low';
  rules: number;
  violations: number;
  lastUpdated: string;
  enforcement: 'block' | 'warn' | 'audit';
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  resource: string;
  decision: 'approved' | 'rejected' | 'escalated' | 'overridden';
  reason: string;
  policyId: string;
  riskScore: number;
}

interface RiskFlag {
  id: string;
  type: 'ai-generated' | 'deviation' | 'compliance' | 'threshold';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  contract: string;
  clause?: string;
  detectedAt: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'false-positive';
  recommendation: string;
}

interface Threshold {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  unit: string;
  action: 'block' | 'warn' | 'notify' | 'escalate';
  enabled: boolean;
}

// Dead mock data removed — all data comes from /api/governance

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'low':
      return 'bg-violet-100 text-violet-700 border-violet-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'compliance':
      return 'bg-violet-100 text-violet-700';
    case 'risk':
      return 'bg-red-100 text-red-700';
    case 'commercial':
      return 'bg-green-100 text-green-700';
    case 'legal':
      return 'bg-violet-100 text-violet-700';
    case 'operational':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getDecisionColor = (decision: string) => {
  switch (decision) {
    case 'approved':
      return 'text-green-600 bg-green-50';
    case 'rejected':
      return 'text-red-600 bg-red-50';
    case 'escalated':
      return 'text-orange-600 bg-orange-50';
    case 'overridden':
      return 'text-violet-600 bg-violet-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export function AIGuardrails() {
  const [activeTab, setActiveTab] = useState<'policies' | 'flags' | 'audit' | 'thresholds'>('policies');
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [apiStats, setApiStats] = useState<{
    totalChecks: number; complianceRate: number; avgRiskScore: number;
    auditLogCount: number; complianceScore: number; highValueContracts: number;
  }>({ totalChecks: 0, complianceRate: 100, avgRiskScore: 0, auditLogCount: 0, complianceScore: 100, highValueContracts: 0 });
  const [thresholds, setThresholds] = useState<Threshold[]>([
    { id: 't1', name: 'Max Contract Value (Auto)', metric: 'Contract Value', operator: 'lte', value: 100000, unit: 'USD', action: 'notify', enabled: true },
    { id: 't2', name: 'VP Approval Threshold', metric: 'Contract Value', operator: 'gt', value: 500000, unit: 'USD', action: 'escalate', enabled: true },
    { id: 't3', name: 'Exec Approval Threshold', metric: 'Contract Value', operator: 'gt', value: 1000000, unit: 'USD', action: 'block', enabled: true },
    { id: 't4', name: 'Max Contract Duration', metric: 'Term Length', operator: 'lte', value: 36, unit: 'months', action: 'warn', enabled: true },
    { id: 't5', name: 'Risk Score Limit', metric: 'Risk Score', operator: 'lt', value: 70, unit: 'points', action: 'block', enabled: true },
    { id: 't6', name: 'Min Payment Terms', metric: 'Payment Terms', operator: 'gte', value: 45, unit: 'days', action: 'warn', enabled: false },
  ]);
  const [loading, setLoading] = useState(true);

  // Fetch governance data from API - no mock data fallback
  useEffect(() => {
    async function fetchGovernance() {
      try {
        const res = await fetch('/api/governance');
        const json = await res.json();
        if (json.success && json.data) {
          // Use real data from API, even if empty
          setPolicies(json.data.policies || []);
          setRiskFlags(json.data.flags || []);
          setAuditLogs(json.data.auditLogs || []);
          if (json.data.stats) {
            setApiStats({
              totalChecks: json.data.stats.totalChecks || 0,
              complianceRate: json.data.stats.complianceRate ?? 100,
              avgRiskScore: json.data.stats.avgRiskScore || 0,
              auditLogCount: json.data.stats.auditLogCount || 0,
              complianceScore: json.data.stats.complianceScore || 100,
              highValueContracts: json.data.stats.highValueContracts || 0,
            });
          }
        } else {
          // API error - show empty state, not mock data
          setPolicies([]);
          setRiskFlags([]);
          setAuditLogs([]);
        }
      } catch {
        // Network error - show empty state, not mock data
        setPolicies([]);
        setRiskFlags([]);
        setAuditLogs([]);
      } finally {
        setLoading(false);
      }
    }
    fetchGovernance();
  }, []);

  const openFlags = riskFlags.filter(f => f.status === 'open').length;
  const criticalFlags = riskFlags.filter(f => f.severity === 'critical' && f.status !== 'resolved').length;
  const totalViolations = policies.reduce((sum, p) => sum + p.violations, 0);

  const router = useRouter();

  // Handle configure settings
  const handleConfigure = useCallback(() => {
    toast.info('Opening configuration settings...');
    // In a real app, this would open a configuration modal or page
  }, []);

  // Handle view rules
  const handleViewRules = useCallback((policyId: string, policyName: string) => {
    toast.info(`Viewing rules for: ${policyName}`);
  }, []);

  // Handle edit policy
  const handleEditPolicy = useCallback((policyId: string, policyName: string) => {
    toast.info(`Editing policy: ${policyName}`);
  }, []);

  // Handle toggle policy lock
  const handleToggleLock = useCallback((policyId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    toast.success(`Policy ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  }, []);

  // Handle export flags
  const handleExportFlags = useCallback(() => {
    try {
      const csvContent = [
        ['ID', 'Title', 'Description', 'Severity', 'Status', 'Contract', 'Detected At'].join(','),
        ...riskFlags.map(f => [
          f.id,
          f.title,
          f.description.replace(/,/g, ';'),
          f.severity,
          f.status,
          f.contract || 'N/A',
          f.detectedAt || 'N/A',
        ].join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `risk-flags-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Risk flags exported successfully');
    } catch (error) {
      toast.error('Failed to export flags');
    }
  }, [riskFlags]);

  // Use optimistic mutation hooks for instant UI feedback
  const riskFlagMutations = useRiskFlags();

  // Handle resolve flag - now uses optimistic mutations
  const handleResolveFlag = useCallback((flagId: string) => {
    // Optimistic update - UI updates instantly, syncs in background
    riskFlagMutations.resolve.mutate(flagId, {
      onSuccess: () => {
        setRiskFlags(prev => prev.map(f => f.id === flagId ? { ...f, status: 'resolved' } : f));
      },
    });
  }, [riskFlagMutations.resolve]);

  // Handle dismiss flag - now uses optimistic mutations
  const handleDismissFlag = useCallback((flagId: string) => {
    // Optimistic update - UI updates instantly, syncs in background
    riskFlagMutations.dismiss.mutate(flagId, {
      onSuccess: () => {
        setRiskFlags(prev => prev.filter(f => f.id !== flagId));
      },
    });
  }, [riskFlagMutations.dismiss]);

  // Handle investigate flag
  const handleInvestigate = useCallback((flagId: string, contractId?: string) => {
    if (contractId) {
      router.push(`/contracts/${contractId}`);
    } else {
      toast.info('Opening investigation...');
    }
  }, [router]);

  // Handle export audit log
  const handleExportAuditLog = useCallback(() => {
    try {
      const csvContent = [
        ['ID', 'Action', 'User', 'Timestamp', 'Resource', 'Decision', 'Reason'].join(','),
        ...auditLogs.map(log => [
          log.id,
          log.action,
          log.user || 'System',
          log.timestamp || 'N/A',
          log.resource || 'N/A',
          log.decision || 'N/A',
          (log.reason || '').replace(/,/g, ';'),
        ].join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Audit log exported successfully');
    } catch (error) {
      toast.error('Failed to export audit log');
    }
  }, [auditLogs]);

  // Handle create new policy
  const handleCreatePolicy = useCallback(() => {
    toast.info('Opening policy creator...');
    setShowPolicyModal(true);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-600">Loading governance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Guardrails & Governance</h1>
              <p className="text-gray-500">Policy enforcement, risk management, and audit controls</p>
            </div>
          </div>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openAIChatbot', {
                detail: { message: 'Analyze our current governance posture — policies, open risk flags, compliance rate, and recommend improvements.' }
              }));
            }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm"
          >
            <Brain className="h-4 w-4" />
            Ask AI
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{policies.filter(p => p.status === 'active').length}</p>
                <p className="text-sm text-gray-500">Active Policies</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${criticalFlags > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <ShieldAlert className={`h-5 w-5 ${criticalFlags > 0 ? 'text-red-600' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{openFlags}</p>
                <p className="text-sm text-gray-500">Open Flags</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalViolations}</p>
                <p className="text-sm text-gray-500">Violations (30d)</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Brain className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{apiStats.complianceRate}%</p>
                <p className="text-sm text-gray-500">Compliance Rate</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Scale className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{apiStats.avgRiskScore}</p>
                <p className="text-sm text-gray-500">Avg Risk Score</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-6">
              <nav className="flex space-x-8">
                {[
                  { id: 'policies', label: 'Policies', icon: FileCheck, count: policies.length },
                  { id: 'flags', label: 'Risk Flags', icon: Flag, count: openFlags },
                  { id: 'audit', label: 'Audit Log', icon: History },
                  { id: 'thresholds', label: 'Thresholds', icon: Sliders },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center gap-2 py-4 border-b-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'border-violet-600 text-violet-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        activeTab === tab.id ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
              <button onClick={handleConfigure} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                <Settings className="h-4 w-4" />
                Configure
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'policies' && (
              <div className="space-y-4">
                {policies.map((policy) => (
                  <motion.div
                    key={policy.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`bg-gray-50 rounded-xl p-5 border cursor-pointer transition-all ${
                      selectedPolicy === policy.id
                        ? 'border-violet-300 ring-2 ring-violet-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedPolicy(selectedPolicy === policy.id ? null : policy.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${
                          policy.status === 'active' ? 'bg-green-100' :
                          policy.status === 'draft' ? 'bg-gray-100' : 'bg-red-100'
                        }`}>
                          {policy.status === 'active' ? (
                            <ShieldCheck className="h-5 w-5 text-green-600" />
                          ) : policy.status === 'draft' ? (
                            <FileText className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ShieldAlert className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{policy.name}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${getSeverityColor(policy.severity)}`}>
                              {policy.severity}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(policy.category)}`}>
                              {policy.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{policy.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span>{policy.rules} rules</span>
                            <span>{policy.violations} violations</span>
                            <span>Updated {policy.lastUpdated}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          policy.enforcement === 'block' ? 'bg-red-100 text-red-700' :
                          policy.enforcement === 'warn' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {policy.enforcement === 'block' ? 'Blocking' :
                           policy.enforcement === 'warn' ? 'Warning' : 'Audit Only'}
                        </span>
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedPolicy === policy.id && (
                        <motion.div key="selected-policy"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-gray-200"
                        >
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 bg-white rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Enforcement Mode</p>
                              <p className="font-medium text-gray-900 capitalize">{policy.enforcement}</p>
                            </div>
                            <div className="p-3 bg-white rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Total Checks</p>
                              <p className="font-medium text-gray-900">{apiStats.totalChecks.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-white rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Compliance Rate</p>
                              <p className="font-medium text-green-600">{apiStats.complianceRate}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-4">
                            <button onClick={() => handleViewRules(policy.id, policy.name)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 text-sm">
                              <Eye className="h-4 w-4" />
                              View Rules
                            </button>
                            <button onClick={() => handleEditPolicy(policy.id, policy.name)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                              <Settings className="h-4 w-4" />
                              Edit Policy
                            </button>
                            <button onClick={() => handleToggleLock(policy.id, policy.status)} className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                              {policy.status === 'active' ? (
                                <Lock className="h-4 w-4 text-gray-500" />
                              ) : (
                                <Unlock className="h-4 w-4 text-gray-500" />
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}

            {activeTab === 'flags' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                      All
                    </button>
                    <button className="px-3 py-1.5 text-gray-500 rounded-lg text-sm hover:bg-gray-100">
                      Open
                    </button>
                    <button className="px-3 py-1.5 text-gray-500 rounded-lg text-sm hover:bg-gray-100">
                      Critical
                    </button>
                  </div>
                  <button onClick={handleExportFlags} className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>

                {riskFlags.map((flag) => (
                  <div
                    key={flag.id}
                    className={`p-5 rounded-xl border ${
                      flag.status === 'resolved' ? 'bg-gray-50 border-gray-100' :
                      flag.severity === 'critical' ? 'bg-red-50 border-red-200' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${
                        flag.type === 'ai-generated' ? 'bg-violet-100' :
                        flag.type === 'deviation' ? 'bg-red-100' :
                        flag.type === 'compliance' ? 'bg-violet-100' :
                        'bg-yellow-100'
                      }`}>
                        {flag.type === 'ai-generated' ? <Brain className="h-5 w-5 text-violet-600" /> :
                         flag.type === 'deviation' ? <AlertTriangle className="h-5 w-5 text-red-600" /> :
                         flag.type === 'compliance' ? <Shield className="h-5 w-5 text-violet-600" /> :
                         <Target className="h-5 w-5 text-yellow-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{flag.title}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${getSeverityColor(flag.severity)}`}>
                            {flag.severity}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            flag.status === 'open' ? 'bg-red-100 text-red-700' :
                            flag.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-700' :
                            flag.status === 'resolved' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {flag.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>Contract: {flag.contract}</span>
                          {flag.clause && <span>Clause: {flag.clause}</span>}
                          <span>Detected: {flag.detectedAt}</span>
                        </div>
                        <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                          <div className="flex items-start gap-2">
                            <Zap className="h-4 w-4 text-violet-600 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-violet-700">AI Recommendation</p>
                              <p className="text-sm text-violet-600 mt-0.5">{flag.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {flag.status !== 'resolved' && (
                        <div className="flex flex-col gap-2">
                          <button onClick={() => handleResolveFlag(flag.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                            Resolve
                          </button>
                          <button onClick={() => handleDismissFlag(flag.id)} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search audit logs..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toast.info('Opening filter options...')} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                      <Filter className="h-4 w-4" />
                      Filter
                    </button>
                    <button onClick={handleExportAuditLog} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                      <Download className="h-4 w-4" />
                      Export
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No audit log entries found</p>
                            <p className="text-xs mt-1">Activity will appear here as actions are performed</p>
                          </td>
                        </tr>
                      ) : auditLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500">{log.time || log.timestamp || '—'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{log.action}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{log.user || 'System'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{log.entity || log.resource || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              (log.status || log.decision) === 'completed' || (log.status || log.decision) === 'approved'
                                ? 'text-green-600 bg-green-50'
                                : (log.status || log.decision) === 'rejected'
                                ? 'text-red-600 bg-red-50'
                                : 'text-gray-600 bg-gray-50'
                            }`}>
                              {log.status || log.decision || 'completed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'thresholds' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Automated Thresholds</h3>
                  <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm">
                    <Sliders className="h-4 w-4" />
                    Add Threshold
                  </button>
                </div>

                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-violet-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-violet-900">Threshold Rules</p>
                      <p className="text-sm text-violet-700 mt-0.5">
                        Thresholds automatically trigger actions when contract attributes exceed defined limits.
                        Actions include blocking, warnings, notifications, and escalations.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {thresholds.map((threshold) => (
                    <div
                      key={threshold.id}
                      className={`p-4 rounded-xl border ${
                        threshold.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${
                            threshold.action === 'block' ? 'bg-red-100' :
                            threshold.action === 'warn' ? 'bg-yellow-100' :
                            threshold.action === 'escalate' ? 'bg-orange-100' :
                            'bg-violet-100'
                          }`}>
                            {threshold.action === 'block' ? <Ban className="h-5 w-5 text-red-600" /> :
                             threshold.action === 'warn' ? <AlertTriangle className="h-5 w-5 text-yellow-600" /> :
                             threshold.action === 'escalate' ? <TrendingUp className="h-5 w-5 text-orange-600" /> :
                             <Bell className="h-5 w-5 text-violet-600" />}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{threshold.name}</h4>
                            <p className="text-sm text-gray-500">
                              {threshold.metric} {
                                threshold.operator === 'gt' ? '>' :
                                threshold.operator === 'lt' ? '<' :
                                threshold.operator === 'gte' ? '≥' :
                                threshold.operator === 'lte' ? '≤' : '='
                              } {threshold.value.toLocaleString()} {threshold.unit}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            threshold.action === 'block' ? 'bg-red-100 text-red-700' :
                            threshold.action === 'warn' ? 'bg-yellow-100 text-yellow-700' :
                            threshold.action === 'escalate' ? 'bg-orange-100 text-orange-700' :
                            'bg-violet-100 text-violet-700'
                          }`}>
                            {threshold.action}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={threshold.enabled}
                              onChange={() => {
                                setThresholds(prev => prev.map(t =>
                                  t.id === threshold.id ? { ...t, enabled: !t.enabled } : t
                                ));
                                toast.success(`Threshold "${threshold.name}" ${threshold.enabled ? 'disabled' : 'enabled'}`);
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                          </label>
                          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                            <Settings className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
