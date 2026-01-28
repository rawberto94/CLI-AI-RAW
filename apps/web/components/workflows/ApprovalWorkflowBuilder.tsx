'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  GitBranch,
  Plus,
  Trash2,
  GripVertical,
  User,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Settings,
  Save,
  Play,
  Pause,
  Copy,
  ArrowRight,
  Mail,
  Bell,
  Shield,
  DollarSign,
  FileText,
  Zap,
  X,
  Check,
  Edit2,
  MoreHorizontal,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Types
interface ApprovalStep {
  id: string;
  name: string;
  description?: string;
  approverType: 'user' | 'role' | 'group' | 'dynamic';
  approvers: string[];
  approvalType: 'any' | 'all' | 'majority';
  slaHours: number;
  escalationEnabled: boolean;
  escalationAfterHours?: number;
  escalateTo?: string;
  autoApproveConditions?: AutoApproveCondition[];
  notifications: NotificationConfig;
  order: number;
}

interface AutoApproveCondition {
  field: string;
  operator: 'equals' | 'lessThan' | 'greaterThan' | 'contains';
  value: string | number;
}

interface NotificationConfig {
  onAssignment: boolean;
  onApproval: boolean;
  onRejection: boolean;
  onEscalation: boolean;
  reminderBeforeDeadline: number; // hours
  channels: ('email' | 'inApp' | 'slack' | 'teams')[];
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: ApprovalStep[];
  conditions: WorkflowCondition[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowCondition {
  id: string;
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'in';
  value: string | number | string[];
}

interface ApprovalWorkflowBuilderProps {
  template?: WorkflowTemplate;
  onSave: (template: WorkflowTemplate) => void;
  onCancel: () => void;
  className?: string;
}

// Sample users and roles
const SAMPLE_USERS = [
  { id: 'user-1', name: 'John Smith', role: 'Legal Counsel' },
  { id: 'user-2', name: 'Sarah Johnson', role: 'Finance Manager' },
  { id: 'user-3', name: 'Mike Chen', role: 'Procurement Lead' },
  { id: 'user-4', name: 'Lisa Wang', role: 'VP Operations' },
  { id: 'user-5', name: 'James Wilson', role: 'CEO' },
];

const SAMPLE_ROLES = [
  { id: 'role-legal', name: 'Legal Team' },
  { id: 'role-finance', name: 'Finance Team' },
  { id: 'role-procurement', name: 'Procurement Team' },
  { id: 'role-executive', name: 'Executive Team' },
];

const CONDITION_FIELDS = [
  { id: 'contractValue', name: 'Contract Value', type: 'number' },
  { id: 'contractType', name: 'Contract Type', type: 'string' },
  { id: 'department', name: 'Department', type: 'string' },
  { id: 'vendor', name: 'Vendor', type: 'string' },
  { id: 'riskLevel', name: 'Risk Level', type: 'string' },
  { id: 'termLength', name: 'Term Length (months)', type: 'number' },
];

// Step Card Component
function StepCard({
  step,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  step: ApprovalStep;
  index: number;
  onUpdate: (step: ApprovalStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const getApproverTypeIcon = () => {
    switch (step.approverType) {
      case 'user': return User;
      case 'role': return Shield;
      case 'group': return Users;
      case 'dynamic': return Zap;
      default: return User;
    }
  };

  const ApproverIcon = getApproverTypeIcon();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="relative"
    >
      {/* Connection Line */}
      {!isLast && (
        <div className="absolute left-8 top-full w-0.5 h-6 bg-slate-200 z-0" />
      )}

      <Card className={cn('relative z-10', isExpanded && 'border-violet-300 shadow-md')}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div className="cursor-grab text-slate-400 hover:text-slate-600">
              <GripVertical className="w-5 h-5" />
            </div>

            {/* Step Number */}
            <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-sm font-semibold">
              {index + 1}
            </div>

            {/* Step Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{step.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  <ApproverIcon className="w-3 h-3 mr-1" />
                  {step.approverType}
                </Badge>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    'text-xs',
                    step.approvalType === 'all' && 'bg-purple-100 text-purple-700',
                    step.approvalType === 'any' && 'bg-green-100 text-green-700',
                    step.approvalType === 'majority' && 'bg-violet-100 text-violet-700'
                  )}
                >
                  {step.approvalType === 'all' ? 'All must approve' : 
                   step.approvalType === 'any' ? 'Any can approve' : 
                   'Majority'}
                </Badge>
              </div>
              {step.description && (
                <CardDescription className="mt-0.5">{step.description}</CardDescription>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onMoveUp}
                      disabled={isFirst}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move Up</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onMoveDown}
                      disabled={isLast}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move Down</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0"
              >
                <Settings className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')} />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Step
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0 border-t border-slate-100">
                <div className="grid grid-cols-2 gap-4 py-4">
                  {/* Approvers */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500">Approvers</Label>
                    <div className="flex flex-wrap gap-2">
                      {step.approvers.map((approver) => {
                        const user = SAMPLE_USERS.find(u => u.id === approver) ||
                                   SAMPLE_ROLES.find(r => r.id === approver);
                        return (
                          <Badge key={approver} variant="secondary" className="gap-1">
                            <User className="w-3 h-3" />
                            {user?.name || approver}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* SLA */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500">SLA</Label>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{step.slaHours} hours to approve</span>
                    </div>
                  </div>

                  {/* Escalation */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500">Escalation</Label>
                    {step.escalationEnabled ? (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>After {step.escalationAfterHours}h → {step.escalateTo}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">Disabled</span>
                    )}
                  </div>

                  {/* Notifications */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-500">Notifications</Label>
                    <div className="flex items-center gap-2">
                      {step.notifications.channels.map((channel) => (
                        <Badge key={channel} variant="outline" className="text-xs">
                          {channel === 'email' && <Mail className="w-3 h-3 mr-1" />}
                          {channel === 'inApp' && <Bell className="w-3 h-3 mr-1" />}
                          {channel}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-3 h-3 mr-1.5" />
                    Edit Step
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Arrow to next step */}
      {!isLast && (
        <div className="flex items-center justify-center h-6">
          <ArrowRight className="w-4 h-4 text-slate-300" />
        </div>
      )}
    </motion.div>
  );
}

// Step Editor Modal
function StepEditorModal({
  isOpen,
  onClose,
  step,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  step: ApprovalStep | null;
  onSave: (step: ApprovalStep) => void;
}) {
  const [name, setName] = useState(step?.name || '');
  const [description, setDescription] = useState(step?.description || '');
  const [approverType, setApproverType] = useState<ApprovalStep['approverType']>(step?.approverType || 'user');
  const [approvers, setApprovers] = useState<string[]>(step?.approvers || []);
  const [approvalType, setApprovalType] = useState<ApprovalStep['approvalType']>(step?.approvalType || 'any');
  const [slaHours, setSlaHours] = useState(step?.slaHours || 24);
  const [escalationEnabled, setEscalationEnabled] = useState(step?.escalationEnabled || false);
  const [escalationAfterHours, setEscalationAfterHours] = useState(step?.escalationAfterHours || 48);
  const [escalateTo, setEscalateTo] = useState(step?.escalateTo || '');

  React.useEffect(() => {
    if (step) {
      setName(step.name);
      setDescription(step.description || '');
      setApproverType(step.approverType);
      setApprovers(step.approvers);
      setApprovalType(step.approvalType);
      setSlaHours(step.slaHours);
      setEscalationEnabled(step.escalationEnabled);
      setEscalationAfterHours(step.escalationAfterHours || 48);
      setEscalateTo(step.escalateTo || '');
    }
  }, [step]);

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Step name is required');
      return;
    }
    if (approvers.length === 0) {
      toast.error('At least one approver is required');
      return;
    }

    onSave({
      id: step?.id || `step-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      approverType,
      approvers,
      approvalType,
      slaHours,
      escalationEnabled,
      escalationAfterHours: escalationEnabled ? escalationAfterHours : undefined,
      escalateTo: escalationEnabled ? escalateTo : undefined,
      notifications: step?.notifications || {
        onAssignment: true,
        onApproval: true,
        onRejection: true,
        onEscalation: true,
        reminderBeforeDeadline: 4,
        channels: ['email', 'inApp'],
      },
      order: step?.order || 0,
    });
    onClose();
  };

  const toggleApprover = (id: string) => {
    setApprovers(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step ? 'Edit Approval Step' : 'Add Approval Step'}</DialogTitle>
          <DialogDescription>
            Configure who needs to approve and the conditions for this step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Step Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Legal Review"
              />
            </div>
            <div className="space-y-2">
              <Label>Approval Type</Label>
              <Select value={approvalType} onValueChange={(v) => setApprovalType(v as ApprovalStep['approvalType'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any one can approve</SelectItem>
                  <SelectItem value="all">All must approve</SelectItem>
                  <SelectItem value="majority">Majority (50%+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this step reviews..."
              className="h-20"
            />
          </div>

          {/* Approver Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Approvers</Label>
              <Select value={approverType} onValueChange={(v) => setApproverType(v as ApprovalStep['approverType'])}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Specific Users</SelectItem>
                  <SelectItem value="role">By Role</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="dynamic">Dynamic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg max-h-48 overflow-y-auto">
              {(approverType === 'user' ? SAMPLE_USERS : SAMPLE_ROLES).map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleApprover(item.id)}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg text-left transition-colors',
                    approvers.includes(item.id)
                      ? 'bg-violet-100 text-violet-700 border border-violet-300'
                      : 'bg-white hover:bg-slate-100 border border-slate-200'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded border flex items-center justify-center',
                    approvers.includes(item.id)
                      ? 'bg-violet-500 border-violet-500 text-white'
                      : 'border-slate-300'
                  )}>
                    {approvers.includes(item.id) && <Check className="w-3 h-3" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    {'role' in item && <p className="text-xs text-slate-500">{(item as typeof SAMPLE_USERS[0]).role}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* SLA Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                SLA (hours to approve)
              </Label>
              <Input
                type="number"
                value={slaHours}
                onChange={(e) => setSlaHours(parseInt(e.target.value) || 24)}
                min={1}
                max={720}
              />
            </div>
          </div>

          {/* Escalation */}
          <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="escalation"
                checked={escalationEnabled}
                onChange={(e) => setEscalationEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-amber-300"
              />
              <Label htmlFor="escalation" className="flex items-center gap-2 cursor-pointer">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Enable Escalation
              </Label>
            </div>

            {escalationEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs">Escalate after (hours)</Label>
                  <Input
                    type="number"
                    value={escalationAfterHours}
                    onChange={(e) => setEscalationAfterHours(parseInt(e.target.value) || 48)}
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Escalate to</Label>
                  <Select value={escalateTo} onValueChange={setEscalateTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SAMPLE_USERS.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {step ? 'Update Step' : 'Add Step'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Component
export function ApprovalWorkflowBuilder({
  template,
  onSave,
  onCancel,
  className,
}: ApprovalWorkflowBuilderProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [steps, setSteps] = useState<ApprovalStep[]>(template?.steps || []);
  const [conditions, setConditions] = useState<WorkflowCondition[]>(template?.conditions || []);
  const [editingStep, setEditingStep] = useState<ApprovalStep | null>(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddStep = () => {
    setEditingStep(null);
    setShowStepEditor(true);
  };

  const handleSaveStep = (step: ApprovalStep) => {
    if (editingStep) {
      setSteps(prev => prev.map(s => s.id === step.id ? step : s));
    } else {
      setSteps(prev => [...prev, { ...step, order: prev.length }]);
    }
    setEditingStep(null);
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps(prev => prev.filter(s => s.id !== stepId));
  };

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    setSteps(prev => {
      const index = prev.findIndex(s => s.id === stepId);
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === prev.length - 1)
      ) {
        return prev;
      }

      const newSteps = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const step1 = newSteps[index];
      const step2 = newSteps[targetIndex];
      if (step1 && step2) {
        [newSteps[index], newSteps[targetIndex]] = [step2, step1];
      }
      return newSteps.map((s, i) => ({ ...s, order: i }));
    });
  };

  const handleAddCondition = () => {
    setConditions(prev => [
      ...prev,
      {
        id: `cond-${Date.now()}`,
        field: 'contractValue',
        operator: 'greaterThan',
        value: 0,
      },
    ]);
  };

  const handleUpdateCondition = (id: string, updates: Partial<WorkflowCondition>) => {
    setConditions(prev =>
      prev.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleDeleteCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Workflow name is required');
      return;
    }
    if (steps.length === 0) {
      toast.error('At least one approval step is required');
      return;
    }

    setIsSaving(true);
    try {
      const workflow: WorkflowTemplate = {
        id: template?.id || `workflow-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        steps,
        conditions,
        isActive: template?.isActive ?? true,
        createdAt: template?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      onSave(workflow);
      toast.success(template ? 'Workflow updated' : 'Workflow created');
    } catch (error) {
      toast.error('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn('flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-violet-500" />
            <h3 className="font-semibold text-slate-900">
              {template ? 'Edit Approval Workflow' : 'Create Approval Workflow'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Settings className="w-4 h-4" />
                </motion.div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Workflow
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Workflow Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Standard Contract Approval"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="When to use this workflow..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trigger Conditions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Trigger Conditions
                </CardTitle>
                <CardDescription>When should this workflow be used?</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddCondition}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Condition
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {conditions.length > 0 ? (
              <div className="space-y-2">
                {conditions.map((condition, index) => (
                  <div
                    key={condition.id}
                    className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg"
                  >
                    {index > 0 && (
                      <Badge variant="outline" className="text-xs">AND</Badge>
                    )}
                    <Select
                      value={condition.field}
                      onValueChange={(v) => handleUpdateCondition(condition.id, { field: v })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_FIELDS.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={condition.operator}
                      onValueChange={(v) => handleUpdateCondition(condition.id, { operator: v as WorkflowCondition['operator'] })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">equals</SelectItem>
                        <SelectItem value="notEquals">not equals</SelectItem>
                        <SelectItem value="greaterThan">greater than</SelectItem>
                        <SelectItem value="lessThan">less than</SelectItem>
                        <SelectItem value="contains">contains</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={condition.value.toString()}
                      onChange={(e) => handleUpdateCondition(condition.id, {
                        value: CONDITION_FIELDS.find(f => f.id === condition.field)?.type === 'number'
                          ? parseFloat(e.target.value) || 0
                          : e.target.value
                      })}
                      className="w-32"
                      placeholder="Value"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCondition(condition.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg text-slate-500 text-sm">
                <Info className="w-4 h-4" />
                No conditions set. This workflow will be available for all contracts.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval Steps */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Approval Steps
                </CardTitle>
                <CardDescription>Define the approval chain</CardDescription>
              </div>
              <Button onClick={handleAddStep}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Step
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {steps.length > 0 ? (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {steps.map((step, index) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      index={index}
                      onUpdate={(updated) => setSteps(prev => prev.map(s => s.id === updated.id ? updated : s))}
                      onDelete={() => handleDeleteStep(step.id)}
                      onMoveUp={() => handleMoveStep(step.id, 'up')}
                      onMoveDown={() => handleMoveStep(step.id, 'down')}
                      isFirst={index === 0}
                      isLast={index === steps.length - 1}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GitBranch className="w-12 h-12 text-slate-300 mb-4" />
                <h4 className="font-medium text-slate-900 mb-2">No approval steps</h4>
                <p className="text-sm text-slate-500 mb-4">
                  Add steps to define your approval workflow
                </p>
                <Button onClick={handleAddStep}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add First Step
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Step Editor Modal */}
      <StepEditorModal
        isOpen={showStepEditor}
        onClose={() => {
          setShowStepEditor(false);
          setEditingStep(null);
        }}
        step={editingStep}
        onSave={handleSaveStep}
      />
    </div>
  );
}

export type { WorkflowTemplate, ApprovalStep, WorkflowCondition };
