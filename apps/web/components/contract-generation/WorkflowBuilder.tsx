'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Plus,
  Trash2,
  GripVertical,
  Settings,
  Users,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Zap,
  GitBranch,
  Timer,
  ArrowRight,
  Copy,
  Eye,
  Edit3,
  MoreHorizontal,
  Shield,
  Bell,
  FileSignature,
  Bot,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  WorkflowDefinition,
  WorkflowStep,
  TriggerType,
  StepType,
  AssigneeType,
  WorkflowCategory,
} from '@/types/contract-generation';

// ====================
// CONFIGURATION
// ====================

const stepTypeConfig: Record<StepType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  APPROVAL: { 
    label: 'Approval', 
    icon: <CheckCircle2 className="h-4 w-4" />, 
    color: 'bg-green-500',
    description: 'Request approval from specified users',
  },
  REVIEW: { 
    label: 'Review', 
    icon: <Eye className="h-4 w-4" />, 
    color: 'bg-violet-500',
    description: 'Request review without formal approval',
  },
  TASK: { 
    label: 'Task', 
    icon: <Edit3 className="h-4 w-4" />, 
    color: 'bg-violet-500',
    description: 'Assign a task to be completed',
  },
  NOTIFICATION: { 
    label: 'Notification', 
    icon: <Bell className="h-4 w-4" />, 
    color: 'bg-amber-500',
    description: 'Send notification to users',
  },
  CONDITIONAL: { 
    label: 'Condition', 
    icon: <GitBranch className="h-4 w-4" />, 
    color: 'bg-orange-500',
    description: 'Branch based on conditions',
  },
  PARALLEL: { 
    label: 'Parallel', 
    icon: <Workflow className="h-4 w-4" />, 
    color: 'bg-violet-500',
    description: 'Execute multiple steps in parallel',
  },
  DELAY: { 
    label: 'Delay', 
    icon: <Timer className="h-4 w-4" />, 
    color: 'bg-gray-500',
    description: 'Wait for specified duration',
  },
  INTEGRATION: { 
    label: 'Integration', 
    icon: <Zap className="h-4 w-4" />, 
    color: 'bg-pink-500',
    description: 'Trigger external integration',
  },
  AI_ANALYSIS: { 
    label: 'AI Analysis', 
    icon: <Bot className="h-4 w-4" />, 
    color: 'bg-violet-500',
    description: 'Run AI-powered analysis',
  },
  SIGNATURE: { 
    label: 'Signature', 
    icon: <FileSignature className="h-4 w-4" />, 
    color: 'bg-violet-500',
    description: 'Request electronic signature',
  },
};

const triggerTypeConfig: Record<TriggerType, { label: string; description: string }> = {
  MANUAL: { label: 'Manual', description: 'Triggered manually by user' },
  DRAFT_CREATED: { label: 'Draft Created', description: 'When a new draft is created' },
  DRAFT_SUBMITTED: { label: 'Draft Submitted', description: 'When a draft is submitted for approval' },
  CONTRACT_VALUE_THRESHOLD: { label: 'Value Threshold', description: 'When contract exceeds value threshold' },
  RISK_SCORE_HIGH: { label: 'High Risk Score', description: 'When risk score exceeds threshold' },
  CLAUSE_DEVIATION: { label: 'Clause Deviation', description: 'When clauses deviate from standard' },
  RENEWAL_APPROACHING: { label: 'Renewal Approaching', description: 'Before contract renewal date' },
  CONTRACT_EXPIRING: { label: 'Contract Expiring', description: 'Before contract expiration' },
  AMENDMENT_REQUESTED: { label: 'Amendment Requested', description: 'When amendment is requested' },
  COMPLIANCE_FLAG: { label: 'Compliance Flag', description: 'When compliance issue detected' },
};

// ====================
// MOCK DATA
// ====================

const mockWorkflows: WorkflowDefinition[] = [
  {
    id: 'w1',
    tenantId: 'demo',
    name: 'Standard Contract Approval',
    description: 'Default approval workflow for contracts under $1M',
    category: 'CONTRACT_APPROVAL',
    triggerType: 'DRAFT_SUBMITTED',
    triggerConfig: { conditions: { maxValue: 1000000 } },
    steps: [
      {
        id: 's1',
        workflowId: 'w1',
        name: 'Legal Review',
        description: 'Initial legal review of the contract',
        order: 1,
        type: 'REVIEW',
        config: {},
        assigneeType: 'ROLE',
        assigneeValue: 'legal_team',
        dueInHours: 48,
        reminderHours: [24, 8],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 's2',
        workflowId: 'w1',
        name: 'Manager Approval',
        description: 'Department manager approval',
        order: 2,
        type: 'APPROVAL',
        config: {},
        assigneeType: 'MANAGER',
        dueInHours: 24,
        reminderHours: [8],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 's3',
        workflowId: 'w1',
        name: 'Procurement Sign-off',
        description: 'Final procurement approval',
        order: 3,
        type: 'APPROVAL',
        config: {},
        assigneeType: 'ROLE',
        assigneeValue: 'procurement_manager',
        dueInHours: 24,
        reminderHours: [8],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    isActive: true,
    isDefault: true,
    priority: 1,
    slaHours: 96,
    usageCount: 145,
    avgCompletionHours: 72,
    createdBy: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-15'),
  },
  {
    id: 'w2',
    tenantId: 'demo',
    name: 'High Value Contract Approval',
    description: 'Multi-level approval for contracts over $1M',
    category: 'CONTRACT_APPROVAL',
    triggerType: 'CONTRACT_VALUE_THRESHOLD',
    triggerConfig: { conditions: { minValue: 1000000 } },
    steps: [
      {
        id: 's4',
        workflowId: 'w2',
        name: 'Legal Review',
        order: 1,
        type: 'REVIEW',
        config: {},
        assigneeType: 'ROLE',
        assigneeValue: 'legal_team',
        dueInHours: 72,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 's5',
        workflowId: 'w2',
        name: 'AI Risk Analysis',
        order: 2,
        type: 'AI_ANALYSIS',
        config: { analysisType: 'full_risk' },
        assigneeType: 'USER',
        dueInHours: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 's6',
        workflowId: 'w2',
        name: 'Director Approval',
        order: 3,
        type: 'APPROVAL',
        config: {},
        assigneeType: 'ROLE',
        assigneeValue: 'director',
        dueInHours: 48,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 's7',
        workflowId: 'w2',
        name: 'CFO Approval',
        order: 4,
        type: 'APPROVAL',
        config: {},
        assigneeType: 'USER',
        assigneeValue: 'cfo@company.com',
        dueInHours: 48,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    isActive: true,
    isDefault: false,
    priority: 2,
    slaHours: 168,
    usageCount: 23,
    avgCompletionHours: 120,
    createdBy: 'admin',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-08-20'),
  },
];

// ====================
// WORKFLOW STEP COMPONENT
// ====================

interface WorkflowStepCardProps {
  step: WorkflowStep;
  index: number;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function WorkflowStepCard({ step, index, isLast, onEdit, onDelete, onDuplicate }: WorkflowStepCardProps) {
  const config = stepTypeConfig[step.type];
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative">
      {/* Connector Line */}
      {!isLast && (
        <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-border -mb-4" />
      )}
      
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <Card className="relative hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              {/* Step Number & Icon */}
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full text-white shrink-0',
                config.color
              )}>
                {config.icon}
              </div>
              
              {/* Step Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{step.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {config.label}
                  </Badge>
                </div>
                {step.description && (
                  <CardDescription className="text-xs mt-1 line-clamp-1">
                    {step.description}
                  </CardDescription>
                )}
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Step actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Step
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2">
                  <span className="text-xs text-muted-foreground">
                    {step.assigneeType === 'ROLE' && `Role: ${step.assigneeValue}`}
                    {step.assigneeType === 'USER' && `User: ${step.assigneeValue}`}
                    {step.assigneeType === 'MANAGER' && 'Assigned to Manager'}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-2 space-y-2 text-xs text-muted-foreground">
                  {step.dueInHours && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Due in {step.dueInHours} hours
                    </div>
                  )}
                  {step.reminderHours && step.reminderHours.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Bell className="h-3 w-3" />
                      Reminders: {step.reminderHours.join('h, ')}h before
                    </div>
                  )}
                  {step.escalationHours && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3" />
                      Escalate after {step.escalationHours}h
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ====================
// WORKFLOW CARD
// ====================

interface WorkflowCardProps {
  workflow: WorkflowDefinition;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function WorkflowCard({ workflow, onEdit, onDuplicate, onToggleActive, onDelete }: WorkflowCardProps) {
  const trigger = triggerTypeConfig[workflow.triggerType];

  return (
    <Card className={cn(
      'transition-all hover:shadow-md',
      !workflow.isActive && 'opacity-60'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              workflow.isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              <Workflow className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {workflow.name}
                {workflow.isDefault && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {workflow.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={workflow.isActive}
              onCheckedChange={onToggleActive}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Workflow actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Workflow
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Trigger */}
        <div className="flex items-center gap-2 mb-3 text-xs">
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" />
            {trigger.label}
          </Badge>
          {workflow.slaHours && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              SLA: {workflow.slaHours}h
            </Badge>
          )}
        </div>

        {/* Steps Preview */}
        <div className="flex items-center gap-1 overflow-hidden">
          {workflow.steps.slice(0, 4).map((step, i) => {
            const stepConfig = stepTypeConfig[step.type];
            return (
              <div key={step.id} className="flex items-center gap-1">
                <div className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-white text-xs',
                  stepConfig.color
                )}>
                  {stepConfig.icon}
                </div>
                {i < Math.min(workflow.steps.length - 1, 3) && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            );
          })}
          {workflow.steps.length > 4 && (
            <Badge variant="secondary" className="text-xs ml-1">
              +{workflow.steps.length - 4} more
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <span>{workflow.usageCount} uses</span>
          {workflow.avgCompletionHours && (
            <span>~{workflow.avgCompletionHours}h avg</span>
          )}
          <span>{workflow.steps.length} steps</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ====================
// STEP PALETTE
// ====================

function StepPalette({ onAddStep }: { onAddStep: (type: StepType) => void }) {
  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold text-sm">Add Step</h3>
      <div className="grid grid-cols-2 gap-2">
        {(Object.entries(stepTypeConfig) as [StepType, typeof stepTypeConfig[StepType]][]).map(([type, config]) => (
          <Button
            key={type}
            variant="outline"
            className="h-auto py-3 flex-col gap-1 justify-start"
            onClick={() => onAddStep(type)}
          >
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-white',
              config.color
            )}>
              {config.icon}
            </div>
            <span className="text-xs font-medium">{config.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

// ====================
// WORKFLOW EDITOR
// ====================

interface WorkflowEditorProps {
  workflow: WorkflowDefinition;
  onSave: (workflow: WorkflowDefinition) => void;
  onCancel: () => void;
}

function WorkflowEditor({ workflow: initialWorkflow, onSave, onCancel }: WorkflowEditorProps) {
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(initialWorkflow);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const handleAddStep = useCallback((type: StepType) => {
    const newStep: WorkflowStep = {
      id: `s${Date.now()}`,
      workflowId: workflow.id,
      name: `New ${stepTypeConfig[type].label} Step`,
      order: workflow.steps.length + 1,
      type,
      config: {},
      assigneeType: 'ROLE',
      dueInHours: 24,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setWorkflow(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));
  }, [workflow.id, workflow.steps.length]);

  const handleDeleteStep = useCallback((stepId: string) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, order: i + 1 })),
    }));
  }, []);

  return (
    <div className="flex h-full">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Input
                value={workflow.name}
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                className="text-lg font-semibold h-auto py-1 px-2 -mx-2"
              />
              <Input
                value={workflow.description || ''}
                onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add description..."
                className="text-sm text-muted-foreground h-auto py-1 px-2 -mx-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button onClick={() => onSave(workflow)}>Save Workflow</Button>
            </div>
          </div>
        </div>

        {/* Trigger Config */}
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <Label className="font-semibold">Trigger:</Label>
            </div>
            <Select
              value={workflow.triggerType}
              onValueChange={(value) => setWorkflow(prev => ({ ...prev, triggerType: value as TriggerType }))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(triggerTypeConfig) as [TriggerType, typeof triggerTypeConfig[TriggerType]][]).map(([type, config]) => (
                  <SelectItem key={type} value={type}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 ml-auto">
              <Label htmlFor="sla">SLA (hours):</Label>
              <Input
                id="sla"
                type="number"
                value={workflow.slaHours || ''}
                onChange={(e) => setWorkflow(prev => ({ ...prev, slaHours: Number(e.target.value) }))}
                className="w-20"
              />
            </div>
          </div>
        </div>

        {/* Steps */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            <AnimatePresence mode="popLayout">
              {workflow.steps.map((step, i) => (
                <WorkflowStepCard
                  key={step.id}
                  step={step}
                  index={i}
                  isLast={i === workflow.steps.length - 1}
                  onEdit={() => setSelectedStepId(step.id)}
                  onDelete={() => handleDeleteStep(step.id)}
                  onDuplicate={() => {
                    const duplicate = { ...step, id: `s${Date.now()}`, order: workflow.steps.length + 1 };
                    setWorkflow(prev => ({ ...prev, steps: [...prev.steps, duplicate] }));
                  }}
                />
              ))}
            </AnimatePresence>

            {workflow.steps.length === 0 && (
              <Card className="border-dashed border-2 p-8 text-center">
                <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No steps yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add steps from the palette on the right
                </p>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Step Palette */}
      <div className="w-64 border-l bg-muted/30">
        <StepPalette onAddStep={handleAddStep} />
      </div>
    </div>
  );
}

// ====================
// MAIN COMPONENT
// ====================

export function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | null>(null);
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);

  // Fetch workflows from API
  useEffect(() => {
    async function fetchWorkflows() {
      try {
        const res = await fetch('/api/workflows');
        const data = await res.json();
        if (data.success && data.data?.length) {
          setWorkflows(data.data);
        }
      } catch {
        // Empty state on error
      } finally {
        setLoading(false);
      }
    }
    fetchWorkflows();
  }, []);

  const handleCreateNew = useCallback(() => {
    const newWorkflow: WorkflowDefinition = {
      id: `w${Date.now()}`,
      tenantId: 'demo',
      name: 'New Workflow',
      description: '',
      category: 'CONTRACT_APPROVAL',
      triggerType: 'MANUAL',
      triggerConfig: {},
      steps: [],
      isActive: false,
      isDefault: false,
      priority: 0,
      usageCount: 0,
      createdBy: 'current_user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setEditingWorkflow(newWorkflow);
  }, []);

  const handleSaveWorkflow = useCallback((workflow: WorkflowDefinition) => {
    setWorkflows(prev => {
      const exists = prev.find(w => w.id === workflow.id);
      if (exists) {
        return prev.map(w => w.id === workflow.id ? workflow : w);
      }
      return [...prev, workflow];
    });
    setEditingWorkflow(null);
  }, []);

  const handleToggleActive = useCallback((workflowId: string) => {
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId ? { ...w, isActive: !w.isActive } : w
    ));
  }, []);

  const handleDeleteWorkflow = useCallback((workflowId: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== workflowId));
  }, []);

  if (editingWorkflow) {
    return (
      <div className="h-screen">
        <WorkflowEditor
          workflow={editingWorkflow}
          onSave={handleSaveWorkflow}
          onCancel={() => setEditingWorkflow(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Builder</h1>
          <p className="text-muted-foreground">
            Design and manage approval workflows for contract generation
          </p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          New Workflow
        </Button>
      </div>

      {/* Workflow Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workflows.map(workflow => (
          <WorkflowCard
            key={workflow.id}
            workflow={workflow}
            onEdit={() => setEditingWorkflow(workflow)}
            onDuplicate={() => {
              const duplicate = {
                ...workflow,
                id: `w${Date.now()}`,
                name: `${workflow.name} (Copy)`,
                isDefault: false,
                usageCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              setWorkflows(prev => [...prev, duplicate]);
            }}
            onToggleActive={() => handleToggleActive(workflow.id)}
            onDelete={() => handleDeleteWorkflow(workflow.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default WorkflowBuilder;
