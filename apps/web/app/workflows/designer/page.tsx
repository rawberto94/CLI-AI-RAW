'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import {
  Layers,
  Plus,
  Play,
  Save,
  Trash2,
  ArrowRight,
  CheckCircle,
  Clock,
  UserCheck,
  Mail,
  GitBranch,
  Zap,
  Settings,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { toast } from 'sonner';
import { PageBreadcrumb } from '@/components/navigation';

// Step types available in the designer
const STEP_TYPES = [
  { id: 'approval', label: 'Approval Step', icon: UserCheck, color: 'bg-violet-100 text-violet-700', description: 'Require approval from a user or group' },
  { id: 'review', label: 'Review Step', icon: FileText, color: 'bg-blue-100 text-blue-700', description: 'Document review checkpoint' },
  { id: 'notification', label: 'Notification', icon: Mail, color: 'bg-amber-100 text-amber-700', description: 'Send email or in-app notification' },
  { id: 'condition', label: 'Condition', icon: GitBranch, color: 'bg-green-100 text-green-700', description: 'Branch based on contract value or type' },
  { id: 'automation', label: 'Automation', icon: Zap, color: 'bg-orange-100 text-orange-700', description: 'Trigger automated action or webhook' },
  { id: 'delay', label: 'Wait/Delay', icon: Clock, color: 'bg-gray-100 text-gray-700', description: 'Pause workflow for a specified duration' },
] as const;

type StepType = typeof STEP_TYPES[number]['id'];

interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  config: Record<string, string>;
}

export default function WorkflowDesignerPage() {
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { id: '1', type: 'review', name: 'Initial Review', config: { assignee: 'Legal Team' } },
    { id: '2', type: 'approval', name: 'Manager Approval', config: { assignee: 'Department Head' } },
    { id: '3', type: 'notification', name: 'Notify Stakeholders', config: { recipient: 'All Parties' } },
  ]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStepType, setNewStepType] = useState<StepType>('approval');
  const [newStepName, setNewStepName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const addStep = useCallback(() => {
    if (!newStepName.trim()) {
      toast.error('Step name is required');
      return;
    }
    const step: WorkflowStep = {
      id: Date.now().toString(),
      type: newStepType,
      name: newStepName,
      config: {},
    };
    setSteps(prev => [...prev, step]);
    setShowAddDialog(false);
    setNewStepName('');
    toast.success(`Added "${step.name}" step`);
  }, [newStepType, newStepName]);

  const removeStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
    toast.success('Step removed');
  }, []);

  const duplicateStep = useCallback((step: WorkflowStep) => {
    const copy: WorkflowStep = {
      ...step,
      id: Date.now().toString(),
      name: `${step.name} (Copy)`,
    };
    setSteps(prev => [...prev, copy]);
    toast.success('Step duplicated');
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflowName,
          type: 'APPROVAL',
          steps: steps.map((s, i) => ({
            name: s.name,
            stepType: s.type.toUpperCase(),
            order: i + 1,
            config: s.config,
          })),
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Workflow saved successfully');
    } catch {
      toast.error('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  };

  const getStepMeta = (type: StepType) => STEP_TYPES.find(t => t.id === type)!;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <PageBreadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <Layers className="h-7 w-7" />
          </div>
          <div>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-2xl font-bold border-none shadow-none p-0 h-auto focus-visible:ring-0 bg-transparent"
            />
            <p className="text-muted-foreground text-sm">
              {steps.length} step{steps.length !== 1 ? 's' : ''} configured
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.info('Test run started')}>
            <Play className="h-4 w-4 mr-2" /> Test
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="space-y-1">
        <Reorder.Group axis="y" values={steps} onReorder={setSteps} className="space-y-3">
          <AnimatePresence>
            {steps.map((step, index) => {
              const meta = getStepMeta(step.type);
              const Icon = meta.icon;
              const isExpanded = expandedStep === step.id;
              return (
                <Reorder.Item key={step.id} value={step}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="group"
                  >
                    {/* Connector */}
                    {index > 0 && (
                      <div className="flex justify-center py-1">
                        <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                      </div>
                    )}

                    <Card className="border-l-4 hover:shadow-md transition-shadow" style={{ borderLeftColor: `var(--${meta.color.includes('violet') ? 'violet' : meta.color.includes('blue') ? 'blue' : meta.color.includes('amber') ? 'amber' : meta.color.includes('green') ? 'green' : meta.color.includes('orange') ? 'orange' : 'gray'}-500)` }}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className={`p-2 rounded-lg ${meta.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{step.name}</span>
                              <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{meta.description}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedStep(isExpanded ? null : step.id)}>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateStep(step)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => removeStep(step.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 pt-4 border-t space-y-3">
                            <div>
                              <Label>Step Name</Label>
                              <Input value={step.name} onChange={(e) => setSteps(prev => prev.map(s => s.id === step.id ? { ...s, name: e.target.value } : s))} />
                            </div>
                            <div>
                              <Label>Assignee / Recipient</Label>
                              <Input
                                value={step.config.assignee || step.config.recipient || ''}
                                onChange={(e) => setSteps(prev => prev.map(s => s.id === step.id ? { ...s, config: { ...s.config, assignee: e.target.value } } : s))}
                                placeholder="e.g. Legal Team, john@example.com"
                              />
                            </div>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </Reorder.Item>
              );
            })}
          </AnimatePresence>
        </Reorder.Group>

        {/* Add Step Button */}
        <motion.div className="flex justify-center pt-4">
          <Button variant="outline" size="lg" className="border-dashed" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-5 w-5 mr-2" /> Add Step
          </Button>
        </motion.div>
      </div>

      {/* Add Step Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Workflow Step</DialogTitle>
            <DialogDescription>Choose a step type and configure it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Step Type</Label>
              <Select value={newStepType} onValueChange={(v) => setNewStepType(v as StepType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <t.icon className="h-4 w-4" /> {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Step Name</Label>
              <Input 
                value={newStepName} 
                onChange={(e) => setNewStepName(e.target.value)}
                placeholder="e.g. Legal Review"
                onKeyDown={(e) => e.key === 'Enter' && addStep()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={addStep}>Add Step</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
