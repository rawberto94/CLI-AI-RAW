/**
 * Alert Management Dashboard
 * View, create, and manage alert rules
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Bell, Edit, Trash2, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import toast from 'react-hot-toast';
import { AlertRuleForm, type AlertRuleFormValues } from './AlertRuleForm';

type AlertRuleType = AlertRuleFormValues['ruleType'];
type AlertTargetEntity = AlertRuleFormValues['targetEntity'];
type AlertComparisonOperator = AlertRuleFormValues['comparisonOperator'];

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  ruleType: AlertRuleType;
  targetEntity: AlertTargetEntity;
  targetId?: string;
  thresholdValue: number;
  comparisonOperator: AlertComparisonOperator;
  timeWindow?: number;
  isActive: boolean;
  notificationChannels: string[];
  recipients: string[];
  webhookUrl?: string;
  triggeredCount: number;
  lastTriggered?: string;
  createdAt: string;
}

export function AlertManagementDashboard() {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const fetchAlertRules = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/rate-cards/alerts');
      if (!response.ok) throw new Error('Failed to fetch alert rules');
      const data = await response.json();
      setAlertRules(data.data || data.alerts || []);
    } catch (error) {
      console.error('Error fetching alert rules:', error);
      toast.error('Failed to load alert rules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlertRules();
  }, [fetchAlertRules]);

  const handleCreateRule = useCallback(
    async (values: any) => {
      try {
        const response = await fetch('/api/rate-cards/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });

        if (!response.ok) throw new Error('Failed to create alert rule');

        await fetchAlertRules();
        setIsCreateDialogOpen(false);
        toast.success('Alert rule created successfully');
      } catch (error) {
        console.error('Error creating alert rule:', error);
        throw error;
      }
    },
    [fetchAlertRules]
  );

  const handleUpdateRule = useCallback(
    async (values: any) => {
      if (!editingRule) return;

      try {
        const response = await fetch(`/api/rate-cards/alerts/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });

        if (!response.ok) throw new Error('Failed to update alert rule');

        await fetchAlertRules();
        setEditingRule(null);
        toast.success('Alert rule updated successfully');
      } catch (error) {
        console.error('Error updating alert rule:', error);
        throw error;
      }
    },
    [editingRule, fetchAlertRules]
  );

  const handleToggleRule = useCallback(
    async (ruleId: string, isActive: boolean) => {
      try {
        const response = await fetch(`/api/rate-cards/alerts/${ruleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive }),
        });

        if (!response.ok) throw new Error('Failed to toggle alert rule');

        await fetchAlertRules();
        toast.success(`Alert rule ${isActive ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error('Error toggling alert rule:', error);
        toast.error('Failed to toggle alert rule');
      }
    },
    [fetchAlertRules]
  );

  const handleDeleteRule = useCallback(
    async (ruleId: string) => {
      try {
        const response = await fetch(`/api/rate-cards/alerts/${ruleId}`, {
          method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete alert rule');

        await fetchAlertRules();
        setDeletingRuleId(null);
        toast.success('Alert rule deleted successfully');
      } catch (error) {
        console.error('Error deleting alert rule:', error);
        toast.error('Failed to delete alert rule');
      }
    },
    [fetchAlertRules]
  );

  const getRuleTypeLabel = (ruleType: AlertRuleType) => {
    const labels: Record<AlertRuleType, string> = {
      price_threshold: 'Price Threshold',
      percentage_change: 'Percentage Change',
      rate_expiry: 'Rate Expiry',
      market_deviation: 'Market Deviation',
    };
    return labels[ruleType];
  };

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      gt: '>',
      gte: '≥',
      lt: '<',
      lte: '≤',
      eq: '=',
    };
    return labels[operator] || operator;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alert Rules</h2>
          <p className="text-muted-foreground">
            Manage automated alerts for rate card monitoring
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Alert Rule
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading alert rules...</p>
          </CardContent>
        </Card>
      ) : alertRules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Alert Rules</h3>
            <p className="text-muted-foreground mb-4">
              Create your first alert rule to start monitoring rate cards
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Alert Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {alertRules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {rule.name}
                      {!rule.isActive && (
                        <Badge variant="outline" className="font-normal">
                          Disabled
                        </Badge>
                      )}
                      {rule.triggeredCount > 0 && (
                        <Badge variant="secondary" className="font-normal">
                          {rule.triggeredCount} triggers
                        </Badge>
                      )}
                    </CardTitle>
                    {rule.description && (
                      <CardDescription>{rule.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleRule(rule.id, !rule.isActive)}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingRuleId(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{getRuleTypeLabel(rule.ruleType)}</Badge>
                    <Badge variant="outline">{rule.targetEntity}</Badge>
                    <Badge>
                      {getOperatorLabel(rule.comparisonOperator)} {rule.thresholdValue}
                      {rule.ruleType === 'percentage_change' && '%'}
                    </Badge>
                    {rule.timeWindow && (
                      <Badge variant="secondary">{rule.timeWindow} days</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Bell className="h-4 w-4" />
                    <span>
                      {rule.notificationChannels.map((c) => c.replace('_', ' ')).join(', ')}
                    </span>
                    <span>•</span>
                    <span>{rule.recipients.length} recipient(s)</span>
                  </div>

                  {rule.lastTriggered && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        Last triggered: {new Date(rule.lastTriggered).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Alert Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertRuleForm
            onSubmit={handleCreateRule}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Alert Dialog */}
      <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {editingRule && (
            <AlertRuleForm
              initialValues={editingRule}
              onSubmit={handleUpdateRule}
              onCancel={() => setEditingRule(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingRuleId}
        onOpenChange={(open) => !open && setDeletingRuleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this alert rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRuleId && handleDeleteRule(deletingRuleId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
