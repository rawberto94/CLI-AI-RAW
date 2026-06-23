'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getTenantId } from '@/lib/tenant';
import { useConfirm, confirmPresets } from '@/components/dialogs/ConfirmDialog';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Filter,
  Copy,
} from 'lucide-react';
import Link from 'next/link';
import { PageBreadcrumb } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ContractGroup {
  id: string;
  name: string;
  description?: string;
  groupType: 'static' | 'smart';
  contractIds?: string[];
  query?: Record<string, any>;
  requireAllTags?: string[];
  requireAnyTags?: string[];
  contractCount: number;
}

interface ResolvedContracts {
  resolved: Array<{ id: string; title: string }>;
  unresolved: string[];
}

export default function ContractGroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const isNew = id === 'new';
  const confirm = useConfirm();

  const [group, setGroup] = useState<ContractGroup | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [contracts, setContracts] = useState<ResolvedContracts | null>(null);
  const [loadingContracts, setLoadingContracts] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    groupType: 'static' as 'static' | 'smart',
    contractIds: [] as string[],
    query: {} as Record<string, any>,
    requireAllTags: [] as string[],
    requireAnyTags: [] as string[],
  });

  useEffect(() => {
    if (isNew) {
      setGroup({ id: 'new', name: '', groupType: 'static', contractCount: 0 } as any);
      return;
    }

    const fetchGroup = async () => {
      try {
        const response = await fetch(`/api/contract-groups/${id}`, {
          headers: { 'x-tenant-id': getTenantId() },
        });
        if (!response.ok) throw new Error('Failed to fetch group');
        const data = await response.json();
        const groupData = data.data;
        setGroup(groupData);
        setFormData({
          name: groupData.name,
          description: groupData.description || '',
          groupType: groupData.groupType,
          contractIds: groupData.contractIds || [],
          query: groupData.query || {},
          requireAllTags: groupData.requireAllTags || [],
          requireAnyTags: groupData.requireAnyTags || [],
        });
      } catch (error) {
        toast.error('Failed to load group');
        router.push('/settings/contract-groups');
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [id, isNew, router]);

  const handleLoadContracts = async () => {
    if (isNew && formData.groupType === 'smart') {
      toast.error('Save the group first before viewing contracts');
      return;
    }

    setLoadingContracts(true);
    try {
      const response = await fetch(
        isNew ? '/api/contract-groups' : `/api/contract-groups/${id}`,
        {
          headers: { 'x-tenant-id': getTenantId() },
        }
      );
      if (!response.ok) throw new Error('Failed to load contracts');
      const data = await response.json();
      setContracts(data.data?.resolved || { resolved: [], unresolved: [] });
    } catch (error) {
      toast.error('Failed to load contracts');
    } finally {
      setLoadingContracts(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setSaving(true);
    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/contract-groups' : `/api/contract-groups/${id}`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save group');
      }

      toast.success(isNew ? 'Group created' : 'Group updated');
      if (isNew) {
        const data = await response.json();
        router.push(`/settings/contract-groups/${data.data.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm(
      confirmPresets.delete(`group "${formData.name}"`)
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/contract-groups/${id}`, {
        method: 'DELETE',
        headers: { 'x-tenant-id': getTenantId() },
      });
      if (!response.ok) throw new Error('Failed to delete group');
      toast.success('Group deleted');
      router.push('/settings/contract-groups');
    } catch (error) {
      toast.error('Failed to delete group');
    } finally {
      setSaving(false);
    }
  };

  const addContractId = (contractId: string) => {
    if (contractId.trim() && !formData.contractIds.includes(contractId.trim())) {
      setFormData({
        ...formData,
        contractIds: [...formData.contractIds, contractId.trim()],
      });
    }
  };

  const removeContractId = (contractId: string) => {
    setFormData({
      ...formData,
      contractIds: formData.contractIds.filter((id) => id !== contractId),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/settings/contract-groups">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <PageBreadcrumb
              items={[
                { label: 'Settings', href: '/settings' },
                { label: 'Contract Groups', href: '/settings/contract-groups' },
                { label: isNew ? 'New Group' : formData.name, href: '#', current: true },
              ]}
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {isNew ? 'Create Contract Group' : 'Edit Contract Group'}
          </h1>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Group Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="E.g., Q1 2024 Renewals"
                  className="h-10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this group"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Group Type
                </label>
                <div className="flex gap-4">
                  {['static', 'smart'].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="groupType"
                        value={type}
                        checked={formData.groupType === type}
                        onChange={(e) => setFormData({ ...formData, groupType: e.target.value as any })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">
                        {type === 'static' ? '📌 Static (manual list)' : '🔍 Smart (dynamic query)'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Static Group: Contract IDs */}
          {formData.groupType === 'static' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Copy className="w-5 h-5" />
                  Contract IDs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste contract ID"
                      className="h-10 flex-1"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addContractId(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={(e) => {
                        const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                        if (input.value) {
                          addContractId(input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 min-h-[32px]">
                    {formData.contractIds.map((contractId) => (
                      <Badge key={contractId} variant="secondary" className="gap-1">
                        {contractId.slice(0, 8)}...
                        <button onClick={() => removeContractId(contractId)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Smart Group: Query & Tags */}
          {formData.groupType === 'smart' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Smart Query Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Statuses (comma-separated)</label>
                    <Input
                      placeholder="draft, executed"
                      value={(formData.query?.status || []).join(', ')}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          query: {
                            ...formData.query,
                            status: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          },
                        })
                      }
                      className="h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contract Types</label>
                    <Input
                      placeholder="NDA, MSA"
                      value={(formData.query?.contractType || []).join(', ')}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          query: {
                            ...formData.query,
                            contractType: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          },
                        })
                      }
                      className="h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Min Value</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.query?.minValue || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          query: { ...formData.query, minValue: e.target.value ? parseInt(e.target.value) : undefined },
                        })
                      }
                      className="h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Max Value</label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={formData.query?.maxValue || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          query: { ...formData.query, maxValue: e.target.value ? parseInt(e.target.value) : undefined },
                        })
                      }
                      className="h-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Required Tags (ALL must match)</label>
                  <Input
                    placeholder="high-risk, renewal-due"
                    value={formData.requireAllTags.join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        requireAllTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="h-10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Optional Tags (ANY can match)</label>
                  <Input
                    placeholder="vendor, customer"
                    value={formData.requireAnyTags.join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        requireAnyTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    className="h-10"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contracts Preview */}
          {!isNew && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Member Contracts ({group?.contractCount || 0})</CardTitle>
                  <Button size="sm" variant="outline" onClick={handleLoadContracts} disabled={loadingContracts}>
                    {loadingContracts ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {contracts ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {contracts.resolved.length === 0 && contracts.unresolved.length === 0 ? (
                      <p className="text-sm text-slate-600">No contracts in this group</p>
                    ) : (
                      <>
                        {contracts.resolved.map((contract) => (
                          <div key={contract.id} className="text-sm py-1 px-2 bg-slate-50 rounded">
                            {contract.title}
                          </div>
                        ))}
                        {contracts.unresolved.length > 0 && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-700 font-medium mb-1">⚠️ Unresolved IDs:</p>
                            {contracts.unresolved.map((id) => (
                              <div key={id} className="text-sm text-red-600">
                                {id}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Click "Load" to see member contracts</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
            {!isNew && (
              <Button
                onClick={handleDelete}
                disabled={saving}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
            <Link href="/settings/contract-groups" className="ml-auto">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
