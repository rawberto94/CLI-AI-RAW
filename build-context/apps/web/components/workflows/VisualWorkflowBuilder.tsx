'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play, Square, CheckCircle2, GitBranch, Bell, ClipboardList,
  Plus, Trash2, GripVertical, ArrowDown, Zap, Settings, Users,
  Clock, ChevronRight, LayoutGrid, LucideIcon, Save, Undo2,
  ZoomIn, ZoomOut, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Step type definitions
interface WorkflowStep {
  id: string;
  type: 'APPROVAL' | 'REVIEW' | 'NOTIFICATION' | 'TASK' | 'CONDITION' | 'PARALLEL';
  name: string;
  description?: string;
  assigneeType: 'USER' | 'ROLE' | 'DEPARTMENT' | 'AUTO';
  assigneeValue: string;
  dueDays: number;
  dueHours: number;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface Workflow {
  id?: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  trigger: string;
}

const stepTypeConfig: Record<string, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  APPROVAL: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100 border-green-300', label: 'Approval' },
  REVIEW: { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-100 border-blue-300', label: 'Review' },
  NOTIFICATION: { icon: Bell, color: 'text-yellow-600', bg: 'bg-yellow-100 border-yellow-300', label: 'Notification' },
  TASK: { icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-100 border-purple-300', label: 'Task' },
  CONDITION: { icon: GitBranch, color: 'text-orange-600', bg: 'bg-orange-100 border-orange-300', label: 'Condition' },
  PARALLEL: { icon: LayoutGrid, color: 'text-indigo-600', bg: 'bg-indigo-100 border-indigo-300', label: 'Parallel' },
};

const stepPalette = [
  { type: 'APPROVAL', label: 'Approval Step', desc: 'Requires user approval to continue' },
  { type: 'REVIEW', label: 'Review Step', desc: 'Content review checkpoint' },
  { type: 'NOTIFICATION', label: 'Notification', desc: 'Send email/push notifications' },
  { type: 'TASK', label: 'Task', desc: 'Manual or automated task' },
  { type: 'CONDITION', label: 'Condition', desc: 'Branching logic based on rules' },
  { type: 'PARALLEL', label: 'Parallel Gate', desc: 'Run steps in parallel' },
] as const;

function generateId() {
  return 'step_' + Math.random().toString(36).slice(2, 10);
}

interface VisualWorkflowBuilderProps {
  workflowId?: string;
  onSave?: (workflow: Workflow) => void;
}

export default function VisualWorkflowBuilder({ workflowId, onSave }: VisualWorkflowBuilderProps) {
  const [workflow, setWorkflow] = useState<Workflow>({
    name: '',
    description: '',
    steps: [],
    trigger: 'contract_created',
  });
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(100);
  const [undoStack, setUndoStack] = useState<WorkflowStep[][]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load existing workflow
  useEffect(() => {
    if (!workflowId) return;
    (async () => {
      try {
        const res = await fetch(`/api/workflows?id=${workflowId}`);
        const json = await res.json();
        if (json.success && json.data.workflow) {
          const w = json.data.workflow;
          setWorkflow({
            id: w.id,
            name: w.name,
            description: w.description || '',
            steps: (w.steps || []).map((s: any, i: number) => ({
              id: s.id || generateId(),
              type: s.type || 'APPROVAL',
              name: s.name || `Step ${i + 1}`,
              description: s.description || '',
              assigneeType: s.assigneeType || 'ROLE',
              assigneeValue: s.assigneeValue || '',
              dueDays: s.dueDays || 3,
              dueHours: s.dueHours || 0,
              config: s.config || {},
              position: { x: 0, y: i * 120 },
            })),
            trigger: w.trigger || 'contract_created',
          });
        }
      } catch { /* ignore */ }
    })();
  }, [workflowId]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), workflow.steps.map(s => ({ ...s }))]);
  }, [workflow.steps]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setWorkflow(w => ({ ...w, steps: prev }));
  }, [undoStack]);

  const addStep = useCallback((type: string) => {
    pushUndo();
    const newStep: WorkflowStep = {
      id: generateId(),
      type: type as WorkflowStep['type'],
      name: stepTypeConfig[type]?.label || 'Step',
      description: '',
      assigneeType: 'ROLE',
      assigneeValue: '',
      dueDays: 3,
      dueHours: 0,
      config: {},
      position: { x: 0, y: workflow.steps.length * 120 },
    };
    setWorkflow(w => ({ ...w, steps: [...w.steps, newStep] }));
    setEditingStep(newStep);
    setStepDialogOpen(true);
  }, [pushUndo, workflow.steps.length]);

  const removeStep = useCallback((stepId: string) => {
    pushUndo();
    setWorkflow(w => ({ ...w, steps: w.steps.filter(s => s.id !== stepId) }));
    if (selectedStep === stepId) setSelectedStep(null);
    toast.success('Step removed');
  }, [pushUndo, selectedStep]);

  const duplicateStep = useCallback((stepId: string) => {
    pushUndo();
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return;
    const dup: WorkflowStep = { ...step, id: generateId(), name: `${step.name} (Copy)` };
    const idx = workflow.steps.findIndex(s => s.id === stepId);
    const newSteps = [...workflow.steps];
    newSteps.splice(idx + 1, 0, dup);
    setWorkflow(w => ({ ...w, steps: newSteps }));
    toast.success('Step duplicated');
  }, [pushUndo, workflow.steps]);

  const moveStep = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    pushUndo();
    setWorkflow(w => {
      const newSteps = [...w.steps];
      const [moved] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, moved);
      return { ...w, steps: newSteps };
    });
  }, [pushUndo]);

  const saveStep = (step: WorkflowStep) => {
    setWorkflow(w => ({
      ...w,
      steps: w.steps.map(s => s.id === step.id ? step : s),
    }));
    setStepDialogOpen(false);
    setEditingStep(null);
  };

  const handleSave = async () => {
    if (!workflow.name) { toast.error('Workflow name required'); return; }
    try {
      const method = workflow.id ? 'PATCH' : 'POST';
      const res = await fetch('/api/workflows', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(workflow.id ? 'Workflow updated' : 'Workflow created');
        onSave?.(workflow);
      } else {
        toast.error(json.error?.message || 'Save failed');
      }
    } catch { toast.error('Failed to save workflow'); }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Left Panel — Step Palette */}
      <Card className="w-64 shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Step Palette
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-3 pt-0">
          <div className="space-y-2">
            {stepPalette.map(sp => {
              const conf = stepTypeConfig[sp.type];
              const Icon = conf.icon;
              return (
                <button
                  key={sp.type}
                  onClick={() => addStep(sp.type)}
                  className={cn(
                    'w-full p-3 rounded-lg border-2 border-dashed text-left hover:border-solid transition-all',
                    'hover:shadow-sm cursor-pointer group',
                    conf.bg
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', conf.color)} />
                    <span className="font-medium text-sm">{sp.label}</span>
                    <Plus className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{sp.desc}</p>
                </button>
              );
            })}
          </div>

          <Separator className="my-4" />

          <div className="space-y-3">
            <Label className="text-xs font-medium">Trigger</Label>
            <Select value={workflow.trigger} onValueChange={t => setWorkflow(w => ({ ...w, trigger: t }))}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contract_created">Contract Created</SelectItem>
                <SelectItem value="contract_uploaded">Contract Uploaded</SelectItem>
                <SelectItem value="contract_expiring">Contract Expiring</SelectItem>
                <SelectItem value="approval_needed">Approval Needed</SelectItem>
                <SelectItem value="value_threshold">Value Threshold</SelectItem>
                <SelectItem value="manual">Manual Trigger</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Center — Visual Canvas */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Input
              value={workflow.name}
              onChange={e => setWorkflow(w => ({ ...w, name: e.target.value }))}
              placeholder="Workflow Name"
              className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 w-64"
            />
            <Badge variant="outline" className="text-xs">{workflow.steps.length} steps</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(50, z - 10))}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(150, z + 10))}>
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <Button variant="ghost" size="sm" onClick={undo} disabled={undoStack.length === 0}>
              <Undo2 className="h-3 w-3" />
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-6" ref={canvasRef}>
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }} className="transition-transform">
            {/* Start Node */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shadow-md">
                <Play className="h-5 w-5" />
              </div>
              <span className="text-xs text-muted-foreground mt-1">Start</span>
              {workflow.steps.length > 0 && (
                <div className="w-0.5 h-6 bg-border" />
              )}
            </div>

            {/* Steps */}
            {workflow.steps.map((step, idx) => {
              const conf = stepTypeConfig[step.type] || stepTypeConfig.TASK;
              const Icon = conf.icon;
              const isSelected = selectedStep === step.id;
              const isDragOver = dragOverIndex === idx;

              return (
                <div key={step.id} className="flex flex-col items-center">
                  {isDragOver && dragSourceIndex !== idx && (
                    <div className="w-64 h-1 bg-primary rounded-full mb-2 transition-all" />
                  )}
                  <div
                    draggable
                    onDragStart={() => setDragSourceIndex(idx)}
                    onDragOver={e => { e.preventDefault(); setDragOverIndex(idx); }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={() => {
                      if (dragSourceIndex !== null) moveStep(dragSourceIndex, idx);
                      setDragSourceIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => { setDragSourceIndex(null); setDragOverIndex(null); }}
                    onClick={() => setSelectedStep(step.id)}
                    onDoubleClick={() => { setEditingStep(step); setStepDialogOpen(true); }}
                    className={cn(
                      'w-72 border-2 rounded-lg p-3 cursor-pointer transition-all group relative',
                      conf.bg,
                      isSelected && 'ring-2 ring-primary ring-offset-2',
                      'hover:shadow-md'
                    )}
                  >
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    </div>

                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg bg-white/80', conf.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm truncate">{step.name}</h4>
                          <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">{step.type}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{step.assigneeValue || step.assigneeType}</span>
                          <Clock className="h-3 w-3 ml-1" />
                          <span>{step.dueDays}d {step.dueHours}h</span>
                        </div>
                        {step.description && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{step.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons — visible on hover */}
                    <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={e => { e.stopPropagation(); setEditingStep(step); setStepDialogOpen(true); }}
                      >
                        <Settings className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={e => { e.stopPropagation(); duplicateStep(step.id); }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={e => { e.stopPropagation(); removeStep(step.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Connector arrow */}
                  {idx < workflow.steps.length - 1 && (
                    <div className="flex flex-col items-center py-1">
                      <div className="w-0.5 h-4 bg-border" />
                      <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* End Node */}
            {workflow.steps.length > 0 && (
              <div className="flex flex-col items-center mt-2">
                <div className="w-0.5 h-6 bg-border" />
                <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-md">
                  <Square className="h-5 w-5" />
                </div>
                <span className="text-xs text-muted-foreground mt-1">End</span>
              </div>
            )}

            {workflow.steps.length === 0 && (
              <div className="text-center py-16">
                <ArrowDown className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Add steps from the palette to build your workflow</p>
                <p className="text-xs text-muted-foreground mt-1">Drag steps to reorder, double-click to edit</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right Panel — Step Properties */}
      {selectedStep && (() => {
        const step = workflow.steps.find(s => s.id === selectedStep);
        if (!step) return null;
        const conf = stepTypeConfig[step.type];
        const Icon = conf.icon;
        return (
          <Card className="w-72 shrink-0 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className={cn('h-4 w-4', conf.color)} /> Step Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-4">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={step.name}
                  onChange={e => setWorkflow(w => ({
                    ...w,
                    steps: w.steps.map(s => s.id === step.id ? { ...s, name: e.target.value } : s)
                  }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select
                  value={step.type}
                  onValueChange={t => setWorkflow(w => ({
                    ...w,
                    steps: w.steps.map(s => s.id === step.id ? { ...s, type: t as WorkflowStep['type'] } : s)
                  }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(stepTypeConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Assignee Type</Label>
                <Select
                  value={step.assigneeType}
                  onValueChange={t => setWorkflow(w => ({
                    ...w,
                    steps: w.steps.map(s => s.id === step.id ? { ...s, assigneeType: t as WorkflowStep['assigneeType'] } : s)
                  }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">Specific User</SelectItem>
                    <SelectItem value="ROLE">Role</SelectItem>
                    <SelectItem value="DEPARTMENT">Department</SelectItem>
                    <SelectItem value="AUTO">Auto-assign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Assignee</Label>
                <Input
                  value={step.assigneeValue}
                  onChange={e => setWorkflow(w => ({
                    ...w,
                    steps: w.steps.map(s => s.id === step.id ? { ...s, assigneeValue: e.target.value } : s)
                  }))}
                  placeholder={step.assigneeType === 'ROLE' ? 'e.g., Legal, Finance' : 'Assignee name/email'}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Due (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={step.dueDays}
                    onChange={e => setWorkflow(w => ({
                      ...w,
                      steps: w.steps.map(s => s.id === step.id ? { ...s, dueDays: parseInt(e.target.value) || 0 } : s)
                    }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Due (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={step.dueHours}
                    onChange={e => setWorkflow(w => ({
                      ...w,
                      steps: w.steps.map(s => s.id === step.id ? { ...s, dueHours: parseInt(e.target.value) || 0 } : s)
                    }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  value={step.description || ''}
                  onChange={e => setWorkflow(w => ({
                    ...w,
                    steps: w.steps.map(s => s.id === step.id ? { ...s, description: e.target.value } : s)
                  }))}
                  placeholder="Optional step description"
                  className="mt-1"
                />
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => duplicateStep(step.id)}>
                  Duplicate
                </Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => removeStep(step.id)}>
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Step Edit Dialog */}
      <Dialog open={stepDialogOpen} onOpenChange={o => { setStepDialogOpen(o); if (!o) setEditingStep(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStep ? 'Edit Step' : 'Add Step'}</DialogTitle>
            <DialogDescription>Configure the workflow step</DialogDescription>
          </DialogHeader>
          {editingStep && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Step Name</Label>
                <Input value={editingStep.name} onChange={e => setEditingStep(s => s ? { ...s, name: e.target.value } : s)} />
              </div>
              <div>
                <Label>Step Type</Label>
                <Select value={editingStep.type} onValueChange={t => setEditingStep(s => s ? { ...s, type: t as WorkflowStep['type'] } : s)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(stepTypeConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Assignee Type</Label>
                  <Select value={editingStep.assigneeType} onValueChange={t => setEditingStep(s => s ? { ...s, assigneeType: t as WorkflowStep['assigneeType'] } : s)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="ROLE">Role</SelectItem>
                      <SelectItem value="DEPARTMENT">Department</SelectItem>
                      <SelectItem value="AUTO">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assignee</Label>
                  <Input value={editingStep.assigneeValue} onChange={e => setEditingStep(s => s ? { ...s, assigneeValue: e.target.value } : s)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Due Days</Label>
                  <Input type="number" min={0} value={editingStep.dueDays} onChange={e => setEditingStep(s => s ? { ...s, dueDays: parseInt(e.target.value) || 0 } : s)} />
                </div>
                <div>
                  <Label>Due Hours</Label>
                  <Input type="number" min={0} max={23} value={editingStep.dueHours} onChange={e => setEditingStep(s => s ? { ...s, dueHours: parseInt(e.target.value) || 0 } : s)} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editingStep.description || ''} onChange={e => setEditingStep(s => s ? { ...s, description: e.target.value } : s)} placeholder="Optional" />
              </div>

              {/* Condition-specific config */}
              {editingStep.type === 'CONDITION' && (
                <div className="border rounded-lg p-3 bg-orange-50">
                  <Label className="text-xs font-medium text-orange-700">Condition Rules</Label>
                  <div className="mt-2 space-y-2">
                    <Input
                      placeholder="Field (e.g., contract.totalValue)"
                      value={editingStep.config.field || ''}
                      onChange={e => setEditingStep(s => s ? { ...s, config: { ...s.config, field: e.target.value } } : s)}
                    />
                    <Select
                      value={editingStep.config.operator || 'gt'}
                      onValueChange={v => setEditingStep(s => s ? { ...s, config: { ...s.config, operator: v } } : s)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gt">Greater than</SelectItem>
                        <SelectItem value="lt">Less than</SelectItem>
                        <SelectItem value="eq">Equal to</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Value (e.g., 100000)"
                      value={editingStep.config.value || ''}
                      onChange={e => setEditingStep(s => s ? { ...s, config: { ...s.config, value: e.target.value } } : s)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStepDialogOpen(false); setEditingStep(null); }}>Cancel</Button>
            <Button onClick={() => editingStep && saveStep(editingStep)}>Save Step</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
