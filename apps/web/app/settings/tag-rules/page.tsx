'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getTenantId } from '@/lib/tenant';
import { useConfirm, confirmPresets } from '@/components/dialogs/ConfirmDialog';
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  RefreshCw,
  PlayCircle,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { PageBreadcrumb } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface TagRule {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  enabled: boolean;
  createdBy?: string;
}

interface ExecutionResult {
  ruleId: string;
  ruleName: string;
  matched: number;
  updated: number;
  success: boolean;
}

export default function TagRulesPage() {
  const confirm = useConfirm();
  const [rules, setRules] = useState<TagRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTrigger, setFilterTrigger] = useState<string>('all');
  const [executingRuleId, setExecutingRuleId] = useState<string | null>(null);
  const [lastExecution, setLastExecution] = useState<ExecutionResult | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tag-rules', {
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) throw new Error('Failed to fetch rules');
      const data = await response.json();
      setRules(data.data?.rules || []);
    } catch (error) {
      toast.error('Failed to load rules');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggleEnabled = async (rule: TagRule) => {
    try {
      const response = await fetch(`/api/tag-rules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({
          id: rule.id,
          enabled: !rule.enabled,
        }),
      });
      if (!response.ok) throw new Error('Failed to update rule');
      toast.success(rule.enabled ? 'Rule disabled' : 'Rule enabled');
      fetchRules();
    } catch (error) {
      toast.error('Failed to update rule');
    }
  };

  const handleExecute = async (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule || !rule.enabled) {
      toast.error('Only enabled rules can be executed');
      return;
    }

    setExecutingRuleId(ruleId);
    try {
      const response = await fetch(`/api/tag-rules?id=${ruleId}`, {
        method: 'PATCH',
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) throw new Error('Failed to execute rule');
      const data = await response.json();
      const result: ExecutionResult = {
        ruleId,
        ruleName: rule.name,
        matched: data.data?.matched || 0,
        updated: data.data?.updated || 0,
        success: true,
      };
      setLastExecution(result);
      toast.success(`✅ Executed: ${result.updated} contracts updated`);
      fetchRules();
    } catch (error) {
      toast.error('Failed to execute rule');
      const result: ExecutionResult = {
        ruleId,
        ruleName: rule.name,
        matched: 0,
        updated: 0,
        success: false,
      };
      setLastExecution(result);
    } finally {
      setExecutingRuleId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm(confirmPresets.delete(`rule "${name}"`));
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/tag-rules`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Failed to delete rule');
      toast.success('Rule deleted');
      fetchRules();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const filteredRules = rules.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrigger = filterTrigger === 'all' || r.trigger === filterTrigger;
    return matchesSearch && matchesTrigger;
  });

  const triggerOptions = ['all', ...new Set(rules.map((r) => r.trigger))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <PageBreadcrumb
            items={[
              { label: 'Settings', href: '/settings' },
              { label: 'Tag Rules', href: '/settings/tag-rules' },
            ]}
          />

          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Zap className="w-8 h-8 text-amber-600" />
                Tag Rules & Automation
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Create rules to automatically tag contracts based on conditions
              </p>
            </div>
            <Link href="/settings/tag-rules/new">
              <Button className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="w-4 h-4" />
                New Rule
              </Button>
            </Link>
          </div>
        </div>

        {/* Last Execution Result */}
        {lastExecution && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3"
          >
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-900 dark:text-green-200">
                Rule &quot;{lastExecution.ruleName}&quot; executed successfully
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Matched {lastExecution.matched} contracts, updated {lastExecution.updated}
              </p>
            </div>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                  <Zap className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {rules.length}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Rules</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {rules.filter((r) => r.enabled).length}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Enabled</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {rules.filter((r) => r.trigger === 'daily').length}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Daily Rules</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <Card className="mb-6 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <select
                value={filterTrigger}
                onChange={(e) => setFilterTrigger(e.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              >
                {triggerOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'all' ? 'All Triggers' : `Trigger: ${opt}`}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRules}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rules List */}
        <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Rules ({filteredRules.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : filteredRules.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No rules found
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {searchQuery ? 'Try a different search term' : 'Create your first rule to get started'}
                </p>
                {!searchQuery && (
                  <Link href="/settings/tag-rules/new">
                    <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Rule
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                <AnimatePresence mode="popLayout">
                  {filteredRules.map((rule, index) => (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="py-4 px-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                              {rule.name}
                            </h3>
                            <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                              {rule.enabled ? '✓ Enabled' : '○ Disabled'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {rule.trigger}
                            </Badge>
                          </div>
                          {rule.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                              {rule.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {rule.enabled && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExecute(rule.id)}
                              disabled={executingRuleId === rule.id}
                            >
                              {executingRuleId === rule.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <PlayCircle className="w-4 h-4 mr-1" />
                                  Run
                                </>
                              )}
                            </Button>
                          )}
                          <Link href={`/settings/tag-rules/${rule.id}`}>
                            <Button size="sm" variant="ghost">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(rule.id, rule.name)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
