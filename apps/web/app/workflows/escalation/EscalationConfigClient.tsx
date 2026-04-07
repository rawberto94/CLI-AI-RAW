'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Plus, Trash2, Edit, ArrowRight, Clock, AlertTriangle, Zap,
  Users, Mail, MessageSquare, Save, Shield, ChevronRight, Settings2,
  ArrowUpCircle, Timer, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EscalationRule {
  id: string;
  name: string;
  trigger: string;
  triggerValue: string;
  severity: string;
  action: string;
  notifyRoles: string[];
  enabled: boolean;
  escalateAfterHours: number;
  description: string;
}

const DEFAULT_RULES: EscalationRule[] = [
  {
    id: '1',
    name: 'Critical SLA Breach',
    trigger: 'sla_breach',
    triggerValue: 'critical',
    severity: 'critical',
    action: 'notify_and_escalate',
    notifyRoles: ['admin', 'manager'],
    enabled: true,
    escalateAfterHours: 1,
    description: 'Escalate when critical SLA thresholds are breached',
  },
  {
    id: '2',
    name: 'Approval Timeout',
    trigger: 'approval_pending',
    triggerValue: '48',
    severity: 'high',
    action: 'notify',
    notifyRoles: ['manager'],
    enabled: true,
    escalateAfterHours: 48,
    description: 'Notify when approvals are pending for more than 48 hours',
  },
  {
    id: '3',
    name: 'Contract Expiring Soon',
    trigger: 'expiry_approaching',
    triggerValue: '30',
    severity: 'medium',
    action: 'notify',
    notifyRoles: ['owner', 'manager'],
    enabled: true,
    escalateAfterHours: 0,
    description: 'Alert when contracts are within 30 days of expiry',
  },
  {
    id: '4',
    name: 'High Risk Detection',
    trigger: 'risk_score',
    triggerValue: '80',
    severity: 'high',
    action: 'notify_and_escalate',
    notifyRoles: ['admin', 'compliance'],
    enabled: false,
    escalateAfterHours: 4,
    description: 'Escalate when contract risk score exceeds 80',
  },
];

const TRIGGERS = [
  { value: 'sla_breach', label: 'SLA Breach' },
  { value: 'approval_pending', label: 'Approval Pending (hours)' },
  { value: 'expiry_approaching', label: 'Contract Expiry (days)' },
  { value: 'risk_score', label: 'Risk Score Threshold' },
  { value: 'compliance_violation', label: 'Compliance Violation' },
  { value: 'value_threshold', label: 'Value Threshold ($)' },
];

const ACTIONS = [
  { value: 'notify', label: 'Send Notification' },
  { value: 'notify_and_escalate', label: 'Notify & Escalate' },
  { value: 'auto_assign', label: 'Auto-Assign' },
  { value: 'block_workflow', label: 'Block Workflow' },
];

const ROLES = ['admin', 'manager', 'owner', 'compliance', 'legal', 'finance'];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function EscalationConfigClient() {
  const [rules, setRules] = useState<EscalationRule[]>(DEFAULT_RULES);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [formData, setFormData] = useState<Partial<EscalationRule>>({
    name: '', trigger: 'sla_breach', triggerValue: '', severity: 'medium', action: 'notify',
    notifyRoles: ['manager'], enabled: true, escalateAfterHours: 24, description: '',
  });

  const handleSave = () => {
    if (editingRule) {
      setRules(prev => prev.map(r => r.id === editingRule.id ? { ...editingRule, ...formData } as EscalationRule : r));
      toast.success('Rule updated');
    } else {
      const newRule: EscalationRule = {
        id: Date.now().toString(),
        name: formData.name || 'New Rule',
        trigger: formData.trigger || 'sla_breach',
        triggerValue: formData.triggerValue || '',
        severity: formData.severity || 'medium',
        action: formData.action || 'notify',
        notifyRoles: formData.notifyRoles || ['manager'],
        enabled: formData.enabled ?? true,
        escalateAfterHours: formData.escalateAfterHours || 24,
        description: formData.description || '',
      };
      setRules(prev => [...prev, newRule]);
      toast.success('Rule created');
    }
    setShowCreateDialog(false);
    setEditingRule(null);
  };

  const handleEdit = (rule: EscalationRule) => {
    setEditingRule(rule);
    setFormData(rule);
    setShowCreateDialog(true);
  };

  const handleDelete = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success('Rule deleted');
  };

  const handleToggle = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const openCreate = () => {
    setEditingRule(null);
    setFormData({ name: '', trigger: 'sla_breach', triggerValue: '', severity: 'medium', action: 'notify', notifyRoles: ['manager'], enabled: true, escalateAfterHours: 24, description: '' });
    setShowCreateDialog(true);
  };

  const enabledCount = rules.filter(r => r.enabled).length;

  return (
    <DashboardLayout
      title="Escalation Configuration"
      description="Define rules for automatic escalation and notifications"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => toast.info('Escalation rules are stored locally for this session')}>
            <Save className="h-4 w-4 mr-2" /> Save All
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add Rule
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-violet-100"><Zap className="h-5 w-5 text-violet-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Rules</p>
                  <p className="text-2xl font-bold">{rules.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-100"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Rules</p>
                  <p className="text-2xl font-bold text-green-600">{enabledCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-100"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Critical Rules</p>
                  <p className="text-2xl font-bold text-amber-600">{rules.filter(r => r.severity === 'critical').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rules List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Escalation Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No escalation rules configured</p>
                <Button size="sm" className="mt-3" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Create Rule</Button>
              </div>
            ) : (
              rules.map(rule => (
                <motion.div
                  key={rule.id}
                  layout
                  className={cn('flex items-center gap-4 p-4 rounded-lg border transition-colors', rule.enabled ? 'bg-background' : 'bg-muted/30 opacity-60')}
                >
                  <Switch checked={rule.enabled} onCheckedChange={() => handleToggle(rule.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{rule.name}</span>
                      <Badge variant="outline" className={cn('text-[10px] capitalize', SEVERITY_COLORS[rule.severity])}>{rule.severity}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TRIGGERS.find(t => t.value === rule.trigger)?.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <ArrowUpCircle className="h-3 w-3" /> {ACTIONS.find(a => a.value === rule.action)?.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> {rule.notifyRoles.join(', ')}
                      </span>
                      {rule.escalateAfterHours > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Timer className="h-3 w-3" /> {rule.escalateAfterHours}h
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEdit(rule)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={v => { if (!v) { setShowCreateDialog(false); setEditingRule(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit' : 'Create'} Escalation Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Critical SLA Breach" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Trigger</Label>
                <Select value={formData.trigger} onValueChange={v => setFormData(f => ({ ...f, trigger: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Trigger Value</Label>
                <Input value={formData.triggerValue} onChange={e => setFormData(f => ({ ...f, triggerValue: e.target.value }))} placeholder="Threshold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severity</Label>
                <Select value={formData.severity} onValueChange={v => setFormData(f => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action</Label>
                <Select value={formData.action} onValueChange={v => setFormData(f => ({ ...f, action: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Escalate After (hours)</Label>
              <Input type="number" value={formData.escalateAfterHours} onChange={e => setFormData(f => ({ ...f, escalateAfterHours: Number(e.target.value) }))} min={0} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingRule(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name}>{editingRule ? 'Update' : 'Create'} Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
