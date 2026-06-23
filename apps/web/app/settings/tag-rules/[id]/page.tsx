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
  Zap,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { PageBreadcrumb } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface TagRule {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  condition: Record<string, any>;
  action: { addTags: string[] };
  enabled: boolean;
}

export default function TagRuleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const isNew = id === 'new';
  const confirm = useConfirm();

  const [rule, setRule] = useState<TagRule | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: 'contract_updated' as string,
    condition: {} as Record<string, any>,
    action: { addTags: [] } as { addTags: string[] },
    enabled: true,
  });

  useEffect(() => {
    if (isNew) {
      setRule({ id: 'new', name: '', trigger: 'contract_updated', condition: {}, action: { addTags: [] }, enabled: true } as any);
      return;
    }

    const fetchRule = async () => {
      try {
        const response = await fetch(`/api/tag-rules?id=${id}`, {
          headers: { 'x-tenant-id': getTenantId() },
        });
        if (!response.ok) throw new Error('Failed to fetch rule');
        const data = await response.json();
        const ruleData = data.data;
        setRule(ruleData);
        setFormData({
          name: ruleData.name,
          description: ruleData.description || '',
          trigger: ruleData.trigger,
          condition: ruleData.condition || {},
          action: ruleData.action || { addTags: [] },
          enabled: ruleData.enabled !== false,
        });
      } catch (error) {
        toast.error('Failed to load rule');
        router.push('/settings/tag-rules');
      } finally {
        setLoading(false);
      }
    };

    fetchRule();
  }, [id, isNew, router]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    if (!formData.action.addTags.length) {
      toast.error('At least one tag to add is required');
      return;
    }

    setSaving(true);
    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = '/api/tag-rules';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify(isNew ? formData : { id, ...formData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save rule');
      }

      toast.success(isNew ? 'Rule created' : 'Rule updated');
      if (isNew) {
        const data = await response.json();
        router.push(`/settings/tag-rules/${data.data.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm(
      confirmPresets.delete(`rule "${formData.name}"`)
    );
    if (!confirmed) return;

    setSaving(true);
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
      router.push('/settings/tag-rules');
    } catch (error) {
      toast.error('Failed to delete rule');
    } finally {
      setSaving(false);
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.action.addTags.includes(tag.trim())) {
      setFormData({
        ...formData,
        action: {
          addTags: [...formData.action.addTags, tag.trim()],
        },
      });
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      action: {
        addTags: formData.action.addTags.filter((t) => t !== tag),
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/settings/tag-rules">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <PageBreadcrumb
              items={[
                { label: 'Settings', href: '/settings' },
                { label: 'Tag Rules', href: '/settings/tag-rules' },
                { label: isNew ? 'New Rule' : formData.name, href: '#', current: true },
              ]}
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {isNew ? 'Create Tag Rule' : 'Edit Tag Rule'}
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
                  Rule Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="E.g., Auto-tag expiring contracts"
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
                  placeholder="Optional description for this rule"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Trigger
                </label>
                <select
                  value={formData.trigger}
                  onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="contract_created">On Contract Created</option>
                  <option value="contract_updated">On Contract Updated</option>
                  <option value="daily">Daily (batch processing)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Enable this rule
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Conditions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Conditions (when to apply)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Contract Statuses (comma-separated)</label>
                  <Input
                    placeholder="draft, pending-signature"
                    value={(formData.condition?.statusIn || []).join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        condition: {
                          ...formData.condition,
                          statusIn: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
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
                    value={(formData.condition?.contractTypeIn || []).join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        condition: {
                          ...formData.condition,
                          contractTypeIn: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        },
                      })
                    }
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Min Contract Value</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.condition?.minTotalValue || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        condition: {
                          ...formData.condition,
                          minTotalValue: e.target.value ? parseInt(e.target.value) : undefined,
                        },
                      })
                    }
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Contract Value</label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={formData.condition?.maxTotalValue || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        condition: {
                          ...formData.condition,
                          maxTotalValue: e.target.value ? parseInt(e.target.value) : undefined,
                        },
                      })
                    }
                    className="h-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Expires Within (days)</label>
                <Input
                  type="number"
                  placeholder="30"
                  value={formData.condition?.expiresWithinDays || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: {
                        ...formData.condition,
                        expiresWithinDays: e.target.value ? parseInt(e.target.value) : undefined,
                      },
                    })
                  }
                  className="h-10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Must have ALL these tags</label>
                <Input
                  placeholder="high-risk, renewal-due"
                  value={(formData.condition?.requiresAllTags || []).join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: {
                        ...formData.condition,
                        requiresAllTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      },
                    })
                  }
                  className="h-10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Can have ANY of these tags</label>
                <Input
                  placeholder="vendor, customer"
                  value={(formData.condition?.requiresAnyTags || []).join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: {
                        ...formData.condition,
                        requiresAnyTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      },
                    })
                  }
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Actions (what to do)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tags to add</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter tag name"
                      className="h-10 flex-1"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={(e) => {
                        const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                        if (input.value) {
                          addTag(input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 min-h-[32px]">
                    {formData.action.addTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700"
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
            <Link href="/settings/tag-rules" className="ml-auto">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
