'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Copy,
  Trash2,
  Edit2,
  MoreHorizontal,
  Search,
  Filter,
  Settings,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ApprovalWorkflowBuilder, WorkflowTemplate } from '@/components/workflows/ApprovalWorkflowBuilder';
import Link from 'next/link';

// Sample workflows
const SAMPLE_WORKFLOWS: WorkflowTemplate[] = [
  {
    id: 'wf-1',
    name: 'Standard Contract Approval',
    description: 'For contracts under $100,000',
    steps: [
      {
        id: 'step-1',
        name: 'Legal Review',
        approverType: 'role',
        approvers: ['role-legal'],
        approvalType: 'any',
        slaHours: 24,
        escalationEnabled: true,
        escalationAfterHours: 48,
        escalateTo: 'user-4',
        notifications: { onAssignment: true, onApproval: true, onRejection: true, onEscalation: true, reminderBeforeDeadline: 4, channels: ['email', 'inApp'] },
        order: 0,
      },
      {
        id: 'step-2',
        name: 'Finance Approval',
        approverType: 'role',
        approvers: ['role-finance'],
        approvalType: 'any',
        slaHours: 24,
        escalationEnabled: false,
        notifications: { onAssignment: true, onApproval: true, onRejection: true, onEscalation: true, reminderBeforeDeadline: 4, channels: ['email', 'inApp'] },
        order: 1,
      },
    ],
    conditions: [
      { id: 'c1', field: 'contractValue', operator: 'lessThan', value: 100000 },
    ],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-02-15'),
  },
  {
    id: 'wf-2',
    name: 'High-Value Contract Approval',
    description: 'For contracts $100,000 and above',
    steps: [
      {
        id: 'step-1',
        name: 'Legal Review',
        approverType: 'role',
        approvers: ['role-legal'],
        approvalType: 'all',
        slaHours: 48,
        escalationEnabled: true,
        escalationAfterHours: 72,
        escalateTo: 'user-5',
        notifications: { onAssignment: true, onApproval: true, onRejection: true, onEscalation: true, reminderBeforeDeadline: 8, channels: ['email', 'inApp'] },
        order: 0,
      },
      {
        id: 'step-2',
        name: 'Finance Approval',
        approverType: 'role',
        approvers: ['role-finance'],
        approvalType: 'all',
        slaHours: 48,
        escalationEnabled: true,
        escalationAfterHours: 72,
        escalateTo: 'user-5',
        notifications: { onAssignment: true, onApproval: true, onRejection: true, onEscalation: true, reminderBeforeDeadline: 8, channels: ['email', 'inApp'] },
        order: 1,
      },
      {
        id: 'step-3',
        name: 'Executive Approval',
        approverType: 'role',
        approvers: ['role-executive'],
        approvalType: 'any',
        slaHours: 72,
        escalationEnabled: false,
        notifications: { onAssignment: true, onApproval: true, onRejection: true, onEscalation: true, reminderBeforeDeadline: 12, channels: ['email', 'inApp', 'slack'] },
        order: 2,
      },
    ],
    conditions: [
      { id: 'c1', field: 'contractValue', operator: 'greaterThan', value: 100000 },
    ],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-02-20'),
  },
  {
    id: 'wf-3',
    name: 'NDA Quick Approval',
    description: 'Fast-track for standard NDAs',
    steps: [
      {
        id: 'step-1',
        name: 'Legal Review',
        approverType: 'user',
        approvers: ['user-1'],
        approvalType: 'any',
        slaHours: 8,
        escalationEnabled: false,
        notifications: { onAssignment: true, onApproval: true, onRejection: true, onEscalation: true, reminderBeforeDeadline: 2, channels: ['email', 'inApp'] },
        order: 0,
      },
    ],
    conditions: [
      { id: 'c1', field: 'contractType', operator: 'equals', value: 'NDA' },
    ],
    isActive: true,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-25'),
  },
];

// Workflow Card Component
function WorkflowCard({
  workflow,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleActive,
}: {
  workflow: WorkflowTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <Card className={cn('transition-all hover:shadow-md', !workflow.isActive && 'opacity-60')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              workflow.isActive ? 'bg-green-100' : 'bg-slate-100'
            )}>
              <GitBranch className={cn(
                'w-5 h-5',
                workflow.isActive ? 'text-green-600' : 'text-slate-400'
              )} />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {workflow.name}
                {workflow.isActive ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </CardTitle>
              <CardDescription>{workflow.description}</CardDescription>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Workflow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleActive}>
                {workflow.isActive ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {/* Steps Preview */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          {workflow.steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <span className="font-medium text-slate-700">{step.name}</span>
              </div>
              {index < workflow.steps.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {workflow.steps.length} steps
          </span>
          <span className="flex items-center gap-1">
            <Filter className="w-3 h-3" />
            {workflow.conditions.length} conditions
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Updated {workflow.updatedAt.toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Page Component
export default function ApprovalWorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>(SAMPLE_WORKFLOWS);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredWorkflows = workflows.filter(
    (wf) =>
      wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveWorkflow = (workflow: WorkflowTemplate) => {
    if (editingWorkflow) {
      setWorkflows((prev) => prev.map((wf) => (wf.id === workflow.id ? workflow : wf)));
    } else {
      setWorkflows((prev) => [...prev, workflow]);
    }
    setShowBuilder(false);
    setEditingWorkflow(null);
  };

  const handleDuplicate = (workflow: WorkflowTemplate) => {
    const duplicate: WorkflowTemplate = {
      ...workflow,
      id: `wf-${Date.now()}`,
      name: `${workflow.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setWorkflows((prev) => [...prev, duplicate]);
    toast.success('Workflow duplicated');
  };

  const handleDelete = (id: string) => {
    setWorkflows((prev) => prev.filter((wf) => wf.id !== id));
    setDeleteConfirm(null);
    toast.success('Workflow deleted');
  };

  const handleToggleActive = (id: string) => {
    setWorkflows((prev) =>
      prev.map((wf) => (wf.id === id ? { ...wf, isActive: !wf.isActive } : wf))
    );
  };

  if (showBuilder) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-5xl mx-auto">
          <ApprovalWorkflowBuilder
            template={editingWorkflow || undefined}
            onSave={handleSaveWorkflow}
            onCancel={() => {
              setShowBuilder(false);
              setEditingWorkflow(null);
            }}
            className="min-h-[80vh]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/workflows">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                All Workflows
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
                Approval Workflows
              </h1>
              <p className="text-slate-500 mt-1">
                Configure and manage contract approval chains
              </p>
            </div>
            <Button onClick={() => setShowBuilder(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Approval Workflow
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search approval workflows..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Workflows</p>
                  <p className="text-2xl font-bold text-slate-900">{workflows.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <GitBranch className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {workflows.filter((w) => w.isActive).length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Play className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Inactive</p>
                  <p className="text-2xl font-bold text-slate-600">
                    {workflows.filter((w) => !w.isActive).length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <Pause className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workflow List */}
        {filteredWorkflows.length > 0 ? (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout">
              {filteredWorkflows.map((workflow) => (
                <motion.div
                  key={workflow.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <WorkflowCard
                    workflow={workflow}
                    onEdit={() => {
                      setEditingWorkflow(workflow);
                      setShowBuilder(true);
                    }}
                    onDuplicate={() => handleDuplicate(workflow)}
                    onDelete={() => setDeleteConfirm(workflow.id)}
                    onToggleActive={() => handleToggleActive(workflow.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No approval workflows found</h3>
            <p className="text-slate-500 mb-6">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Create your first approval workflow'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowBuilder(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Workflow
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
