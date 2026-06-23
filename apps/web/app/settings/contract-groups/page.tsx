'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getTenantId } from '@/lib/tenant';
import { useConfirm, confirmPresets } from '@/components/dialogs/ConfirmDialog';
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  RefreshCw,
  Filter,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { PageBreadcrumb } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ContractGroup {
  id: string;
  name: string;
  description?: string;
  groupType: 'static' | 'smart';
  contractCount: number;
  color?: string;
  createdBy?: string;
}

export default function ContractGroupsPage() {
  const confirm = useConfirm();
  const [groups, setGroups] = useState<ContractGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'static' | 'smart'>('all');

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contract-groups', {
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data.data?.groups || []);
    } catch (error) {
      toast.error('Failed to load groups');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm(
      confirmPresets.delete(`group "${name}"`)
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/contract-groups/${id}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) throw new Error('Failed to delete group');
      toast.success('Group deleted');
      fetchGroups();
    } catch (error) {
      toast.error('Failed to delete group');
      console.error(error);
    }
  };

  const filteredGroups = groups.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || g.groupType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <PageBreadcrumb
            items={[
              { label: 'Settings', href: '/settings' },
              { label: 'Contract Groups', href: '/settings/contract-groups' },
            ]}
          />

          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <FolderOpen className="w-8 h-8 text-blue-600" />
                Contract Groups
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Organize contracts with static or dynamic groups
              </p>
            </div>
            <Link href="/settings/contract-groups/new">
              <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4" />
                New Group
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <FolderOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {groups.length}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <Filter className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {groups.filter((g) => g.groupType === 'smart').length}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Smart Groups</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <FolderOpen className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {groups.reduce((sum, g) => sum + g.contractCount, 0)}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Contracts</p>
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
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="static">Static</option>
                <option value="smart">Smart</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchGroups}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Groups Grid */}
        <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Groups ({filteredGroups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No groups found
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {searchQuery ? 'Try a different search term' : 'Create your first group to get started'}
                </p>
                {!searchQuery && (
                  <Link href="/settings/contract-groups/new">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Group
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredGroups.map((group, index) => (
                    <motion.div
                      key={group.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link href={`/settings/contract-groups/${group.id}`}>
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all cursor-pointer group">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                                {group.name}
                              </h3>
                              {group.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 truncate mt-1">
                                  {group.description}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                          </div>

                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">
                              {group.groupType === 'smart' ? '🔍 Smart' : '📌 Static'}
                            </Badge>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {group.contractCount} contracts
                            </span>
                          </div>
                        </div>
                      </Link>
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
