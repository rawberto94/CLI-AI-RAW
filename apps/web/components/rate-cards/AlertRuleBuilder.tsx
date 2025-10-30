'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AlertRule {
  name: string;
  type: string;
  threshold: number;
  condition: string;
  enabled: boolean;
}

interface AlertRuleBuilderProps {
  tenantId: string;
  userId: string;
  onSave?: (rule: AlertRule) => void;
}

export function AlertRuleBuilder({ tenantId, userId, onSave }: AlertRuleBuilderProps) {
  const [rule, setRule] = useState<AlertRule>({
    name: '',
    type: 'rate_increase',
    threshold: 10,
    condition: 'greater_than',
    enabled: true,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/rate-cards/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId, rule }),
      });

      if (!response.ok) throw new Error('Failed to save alert rule');

      const savedRule = await response.json();
      onSave?.(savedRule);
      
      // Reset form
      setRule({
        name: '',
        type: 'rate_increase',
        threshold: 10,
        condition: 'greater_than',
        enabled: true,
      });
    } catch (error) {
      console.error('Error saving alert rule:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Create Alert Rule</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Rule Name</label>
          <input
            type="text"
            value={rule.name}
            onChange={(e) => setRule({ ...rule, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="e.g., High Rate Increase Alert"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Alert Type</label>
          <select
            value={rule.type}
            onChange={(e) => setRule({ ...rule, type: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="rate_increase">Rate Increase</option>
            <option value="market_shift">Market Shift</option>
            <option value="opportunity">New Opportunity</option>
            <option value="quality_issue">Quality Issue</option>
            <option value="supplier_alert">Supplier Alert</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Condition</label>
          <select
            value={rule.condition}
            onChange={(e) => setRule({ ...rule, condition: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
            <option value="equals">Equals</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Threshold (%)
          </label>
          <input
            type="number"
            value={rule.threshold}
            onChange={(e) => setRule({ ...rule, threshold: Number(e.target.value) })}
            className="w-full px-3 py-2 border rounded-md"
            min="0"
            max="100"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
            className="mr-2"
          />
          <label className="text-sm font-medium">Enable this rule</label>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !rule.name}
          className="w-full"
        >
          {saving ? 'Saving...' : 'Create Alert Rule'}
        </Button>
      </div>
    </Card>
  );
}
