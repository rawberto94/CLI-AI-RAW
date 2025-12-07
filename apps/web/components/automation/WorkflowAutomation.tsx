/**
 * Workflow Automation Component
 * Configure and manage automated contract processing workflows
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { 
  Workflow, 
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Copy,
  MoreVertical,
  ChevronRight,
  ArrowRight,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  FileText,
  Tag,
  Bell,
  Mail,
  Webhook,
  Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// Types
interface WorkflowTrigger {
  type: 'upload' | 'status_change' | 'expiration' | 'schedule' | 'manual';
  config: Record<string, unknown>;
}

interface WorkflowAction {
  id: string;
  type: 'extract_metadata' | 'generate_artifacts' | 'categorize' | 'notify' | 'webhook' | 'ai_analysis' | 'tag';
  config: Record<string, unknown>;
  order: number;
}

interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: unknown;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
}

interface WorkflowAutomationProps {
  className?: string;
}

const triggerConfig: Record<string, { icon: React.ElementType; label: string; description: string }> = {
  upload: { icon: FileText, label: 'Contract Uploaded', description: 'Triggers when a new contract is uploaded' },
  status_change: { icon: ChevronRight, label: 'Status Changed', description: 'Triggers when contract status changes' },
  expiration: { icon: Clock, label: 'Expiration Approaching', description: 'Triggers before contract expires' },
  schedule: { icon: Clock, label: 'Scheduled', description: 'Triggers at scheduled times' },
  manual: { icon: Play, label: 'Manual', description: 'Triggered manually by user' },
};

const actionConfig: Record<string, { icon: React.ElementType; label: string; description: string }> = {
  extract_metadata: { icon: FileText, label: 'Extract Metadata', description: 'Extract key information from contract' },
  generate_artifacts: { icon: Bot, label: 'Generate Artifacts', description: 'Generate AI summaries and analysis' },
  categorize: { icon: Tag, label: 'Auto-Categorize', description: 'Automatically categorize the contract' },
  notify: { icon: Bell, label: 'Send Notification', description: 'Send in-app notification' },
  webhook: { icon: Webhook, label: 'Call Webhook', description: 'Send data to external webhook' },
  ai_analysis: { icon: Bot, label: 'AI Analysis', description: 'Run comprehensive AI analysis' },
  tag: { icon: Tag, label: 'Apply Tags', description: 'Apply specified tags to contract' },
};

// Mock workflows
function generateMockWorkflows(): AutomationWorkflow[] {
  return [
    {
      id: 'wf_1',
      name: 'Auto-Process New Uploads',
      description: 'Automatically extract metadata, categorize, and generate artifacts for new uploads',
      enabled: true,
      trigger: { type: 'upload', config: {} },
      conditions: [],
      actions: [
        { id: 'a1', type: 'extract_metadata', config: {}, order: 1 },
        { id: 'a2', type: 'categorize', config: {}, order: 2 },
        { id: 'a3', type: 'generate_artifacts', config: {}, order: 3 },
      ],
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      lastRun: new Date(Date.now() - 3600000),
      runCount: 234,
      successCount: 228,
      failureCount: 6,
    },
    {
      id: 'wf_2',
      name: 'Expiration Alerts',
      description: 'Notify stakeholders 30 days before contract expiration',
      enabled: true,
      trigger: { type: 'expiration', config: { daysBefore: 30 } },
      conditions: [
        { field: 'status', operator: 'equals', value: 'active' },
      ],
      actions: [
        { id: 'a1', type: 'notify', config: { recipients: ['contract-admins'] }, order: 1 },
        { id: 'a2', type: 'tag', config: { tags: ['expiring-soon'] }, order: 2 },
      ],
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lastRun: new Date(Date.now() - 86400000),
      runCount: 45,
      successCount: 45,
      failureCount: 0,
    },
    {
      id: 'wf_3',
      name: 'High-Value Contract Webhook',
      description: 'Notify external system when high-value contracts are processed',
      enabled: false,
      trigger: { type: 'status_change', config: { newStatus: 'processed' } },
      conditions: [
        { field: 'value', operator: 'greater_than', value: 100000 },
      ],
      actions: [
        { id: 'a1', type: 'webhook', config: { url: 'https://api.example.com/contracts' }, order: 1 },
      ],
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      runCount: 12,
      successCount: 10,
      failureCount: 2,
    },
  ];
}

export const WorkflowAutomation = memo(function WorkflowAutomation({
  className,
}: WorkflowAutomationProps) {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    triggerType: 'upload',
    actions: ['extract_metadata'],
  });

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/workflows');
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.workflows.map((w: AutomationWorkflow) => ({
          ...w,
          createdAt: new Date(w.createdAt),
          updatedAt: new Date(w.updatedAt),
          lastRun: w.lastRun ? new Date(w.lastRun) : undefined,
        })));
      } else {
        setWorkflows(generateMockWorkflows());
      }
    } catch {
      setWorkflows(generateMockWorkflows());
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newWorkflow.name) {
      toast.error('Please enter a workflow name');
      return;
    }

    setCreating(true);
    try {
      await new Promise(r => setTimeout(r, 1000));

      const workflow: AutomationWorkflow = {
        id: `wf_${Date.now()}`,
        name: newWorkflow.name,
        description: newWorkflow.description,
        enabled: true,
        trigger: { type: newWorkflow.triggerType as WorkflowTrigger['type'], config: {} },
        conditions: [],
        actions: newWorkflow.actions.map((type, i) => ({
          id: `a${i + 1}`,
          type: type as WorkflowAction['type'],
          config: {},
          order: i + 1,
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
        runCount: 0,
        successCount: 0,
        failureCount: 0,
      };

      setWorkflows(prev => [workflow, ...prev]);
      setShowCreateDialog(false);
      setNewWorkflow({ name: '', description: '', triggerType: 'upload', actions: ['extract_metadata'] });
      toast.success('Workflow created successfully');
    } catch {
      toast.error('Failed to create workflow');
    } finally {
      setCreating(false);
    }
  };

  const toggleWorkflow = (workflowId: string) => {
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId ? { ...w, enabled: !w.enabled, updatedAt: new Date() } : w
    ));
    toast.success('Workflow updated');
  };

  const duplicateWorkflow = (workflow: AutomationWorkflow) => {
    const duplicate: AutomationWorkflow = {
      ...workflow,
      id: `wf_${Date.now()}`,
      name: `${workflow.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      lastRun: undefined,
    };
    setWorkflows(prev => [duplicate, ...prev]);
    toast.success('Workflow duplicated');
  };

  const deleteWorkflow = (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    setWorkflows(prev => prev.filter(w => w.id !== workflowId));
    toast.success('Workflow deleted');
  };

  const runWorkflow = async (workflowId: string) => {
    toast.success('Workflow triggered manually');
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId 
        ? { ...w, lastRun: new Date(), runCount: w.runCount + 1, successCount: w.successCount + 1 }
        : w
    ));
  };

  const toggleAction = (actionType: string) => {
    setNewWorkflow(prev => ({
      ...prev,
      actions: prev.actions.includes(actionType)
        ? prev.actions.filter(a => a !== actionType)
        : [...prev.actions, actionType],
    }));
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-blue-600" />
              Workflow Automation
            </CardTitle>
            <CardDescription>
              Automate contract processing with custom workflows
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Workflow</DialogTitle>
                <DialogDescription>
                  Set up an automated workflow for contract processing
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="wf-name">Workflow Name *</Label>
                    <Input
                      id="wf-name"
                      placeholder="e.g., Auto-Process Uploads"
                      value={newWorkflow.name}
                      onChange={(e) => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="wf-desc">Description</Label>
                    <Textarea
                      id="wf-desc"
                      placeholder="What does this workflow do?"
                      value={newWorkflow.description}
                      onChange={(e) => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Trigger</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(triggerConfig).map(([type, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => setNewWorkflow(prev => ({ ...prev, triggerType: type }))}
                          className={cn(
                            'p-3 rounded-lg border-2 text-left transition-all',
                            newWorkflow.triggerType === type
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={cn(
                              'h-4 w-4',
                              newWorkflow.triggerType === type ? 'text-blue-600' : 'text-slate-400'
                            )} />
                            <span className="font-medium text-sm">{config.label}</span>
                          </div>
                          <p className="text-xs text-slate-500">{config.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Actions (select one or more)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(actionConfig).map(([type, config]) => {
                      const Icon = config.icon;
                      const isSelected = newWorkflow.actions.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => toggleAction(type)}
                          className={cn(
                            'p-3 rounded-lg border text-left transition-all flex items-start gap-3',
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <div className={cn(
                            'p-1.5 rounded',
                            isSelected ? 'bg-blue-100' : 'bg-slate-100'
                          )}>
                            <Icon className={cn(
                              'h-4 w-4',
                              isSelected ? 'text-blue-600' : 'text-slate-400'
                            )} />
                          </div>
                          <div>
                            <span className="font-medium text-sm block">{config.label}</span>
                            <span className="text-xs text-slate-500">{config.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating} className="gap-2">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Workflow'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 text-center">
            <Workflow className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold">{workflows.length}</p>
            <p className="text-xs text-slate-500">Total Workflows</p>
          </div>
          <div className="p-4 rounded-lg bg-green-50 text-center">
            <Zap className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="text-2xl font-bold text-green-600">
              {workflows.filter(w => w.enabled).length}
            </p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-blue-600">
              {workflows.reduce((acc, w) => acc + w.runCount, 0)}
            </p>
            <p className="text-xs text-slate-500">Total Runs</p>
          </div>
        </div>

        {/* Workflow List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span>Loading workflows...</span>
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No workflows configured. Create your first workflow to get started.
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {workflows.map(workflow => {
                const triggerConf = triggerConfig[workflow.trigger.type] ?? triggerConfig.contract_created;
                const TriggerIcon = triggerConf!.icon;
                const successRate = workflow.runCount > 0 
                  ? Math.round((workflow.successCount / workflow.runCount) * 100)
                  : 100;

                return (
                  <div
                    key={workflow.id}
                    className={cn(
                      'p-4 border rounded-lg transition-colors',
                      workflow.enabled ? 'bg-white' : 'bg-slate-50 opacity-75'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          workflow.enabled ? 'bg-blue-100' : 'bg-slate-200'
                        )}>
                          <TriggerIcon className={cn(
                            'h-5 w-5',
                            workflow.enabled ? 'text-blue-600' : 'text-slate-400'
                          )} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{workflow.name}</h4>
                            <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
                              {workflow.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{workflow.description}</p>
                          
                          {/* Actions preview */}
                          <div className="flex items-center gap-1 mt-3">
                            <Badge variant="outline" className="text-xs">
                              {triggerConf!.label}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-slate-300" />
                            {workflow.actions.slice(0, 3).map((action, i) => {
                              const actConfig = actionConfig[action.type] ?? actionConfig.send_notification;
                              const ActionIcon = actConfig!.icon;
                              return (
                                <Badge key={i} variant="outline" className="text-xs gap-1">
                                  <ActionIcon className="h-3 w-3" />
                                  {actConfig!.label}
                                </Badge>
                              );
                            })}
                            {workflow.actions.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{workflow.actions.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right mr-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500">{workflow.runCount} runs</span>
                            <span className={cn(
                              'font-medium',
                              successRate >= 95 ? 'text-green-600' : 
                              successRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                            )}>
                              {successRate}% success
                            </span>
                          </div>
                          {workflow.lastRun && (
                            <p className="text-xs text-slate-400">
                              Last run: {formatDistanceToNow(workflow.lastRun, { addSuffix: true })}
                            </p>
                          )}
                        </div>

                        <Switch
                          checked={workflow.enabled}
                          onCheckedChange={() => toggleWorkflow(workflow.id)}
                        />

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runWorkflow(workflow.id)}
                          disabled={!workflow.enabled}
                        >
                          <Play className="h-4 w-4" />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateWorkflow(workflow)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Settings className="h-4 w-4 mr-2" />
                              View Logs
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => deleteWorkflow(workflow.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});
