'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Save,
  ArrowRight,
  MoveUp,
  MoveDown,
  CheckCircle,
  Users,
  Zap,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ============================================================================
// LEAN APPROACH: Smart defaults, minimal configuration
// ============================================================================

interface WorkflowStep {
  id: string
  name: string
  assignee: string // Simple: just a name or role
  type: 'approval' | 'review' | 'notify'
}

interface SimpleWorkflowBuilderProps {
  workflowId?: string
  initialName?: string
  initialSteps?: WorkflowStep[]
  onSave: (data: { name: string; steps: WorkflowStep[] }) => Promise<void>
  onCancel: () => void
}

// Smart defaults - most common workflow patterns
const QUICK_TEMPLATES = [
  {
    id: 'standard',
    name: 'Standard Approval',
    steps: [
      { id: '1', name: 'Legal Review', assignee: 'Legal Team', type: 'review' as const },
      { id: '2', name: 'Finance Approval', assignee: 'Finance', type: 'approval' as const },
      { id: '3', name: 'Final Sign-off', assignee: 'Manager', type: 'approval' as const },
    ],
  },
  {
    id: 'quick',
    name: 'Quick Approval',
    steps: [
      { id: '1', name: 'Manager Approval', assignee: 'Manager', type: 'approval' as const },
    ],
  },
  {
    id: 'legal',
    name: 'Legal-Only',
    steps: [
      { id: '1', name: 'Legal Review', assignee: 'Legal Team', type: 'approval' as const },
    ],
  },
]

const COMMON_ASSIGNEES = [
  'Manager',
  'Legal Team',
  'Finance',
  'Procurement',
  'Department Head',
  'VP',
  'CFO',
]

export function SimpleWorkflowBuilder({
  workflowId,
  initialName = '',
  initialSteps = [],
  onSave,
  onCancel,
}: SimpleWorkflowBuilderProps) {
  const [name, setName] = useState(initialName)
  const defaultSteps = QUICK_TEMPLATES[0]?.steps ?? []
  const [steps, setSteps] = useState<WorkflowStep[]>(
    initialSteps.length > 0 ? initialSteps : defaultSteps
  )
  const [saving, setSaving] = useState(false)

  const addStep = () => {
    setSteps([
      ...steps,
      {
        id: Date.now().toString(),
        name: `Step ${steps.length + 1}`,
        assignee: 'Manager',
        type: 'approval',
      },
    ])
  }

  const removeStep = (id: string) => {
    if (steps.length <= 1) {
      toast.error('Workflow needs at least one step')
      return
    }
    setSteps(steps.filter(s => s.id !== id))
  }

  const moveStep = (id: string, direction: 'up' | 'down') => {
    const index = steps.findIndex(s => s.id === id)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === steps.length - 1) return

    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const currentStep = newSteps[index]
    const targetStep = newSteps[targetIndex]
    if (currentStep && targetStep) {
      newSteps[index] = targetStep
      newSteps[targetIndex] = currentStep
    }
    setSteps(newSteps)
  }

  const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map(s => (s.id === id ? { ...s, ...updates } : s)))
  }

  const applyTemplate = (templateId: string) => {
    const template = QUICK_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setSteps(template.steps.map(s => ({ ...s, id: Date.now().toString() + s.id })))
      if (!name) setName(template.name)
      toast.success(`Applied "${template.name}" template`)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a workflow name')
      return
    }
    if (steps.length === 0) {
      toast.error('Add at least one step')
      return
    }

    setSaving(true)
    try {
      await onSave({ name: name.trim(), steps })
    } catch (err) {
      toast.error('Failed to save workflow')
    } finally {
      setSaving(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'approval': return CheckCircle
      case 'review': return Users
      case 'notify': return Zap
      default: return CheckCircle
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">
          {workflowId ? 'Edit Workflow' : 'Create Workflow'}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-purple-600 gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Quick Templates */}
      {!workflowId && (
        <Card className="bg-gradient-to-br from-slate-50 to-purple-50/30 border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-slate-600 mb-3">Quick Start:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_TEMPLATES.map(template => (
                <Button
                  key={template.id}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template.id)}
                  className="bg-white hover:bg-purple-50 hover:border-indigo-300"
                >
                  <Shield className="h-3 w-3 mr-1.5" />
                  {template.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Name */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium">Workflow Name</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Standard Contract Approval"
            className="mt-1.5"
          />
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Approval Steps</CardTitle>
            <Button variant="outline" size="sm" onClick={addStep} className="gap-1">
              <Plus className="h-4 w-4" />
              Add Step
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, index) => {
            const TypeIcon = getTypeIcon(step.type)
            return (
              <div key={step.id} className="relative">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors">
                  {/* Step Number */}
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {index + 1}
                  </div>

                  {/* Step Details */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      value={step.name}
                      onChange={e => updateStep(step.id, { name: e.target.value })}
                      placeholder="Step name"
                      className="bg-white"
                    />
                    <Select
                      value={step.assignee}
                      onValueChange={value => updateStep(step.id, { assignee: value })}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_ASSIGNEES.map(a => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={step.type}
                      onValueChange={value => updateStep(step.id, { type: value as WorkflowStep['type'] })}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approval">Approval</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="notify">Notify</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveStep(step.id, 'up')}
                      disabled={index === 0}
                    >
                      <MoveUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveStep(step.id, 'down')}
                      disabled={index === steps.length - 1}
                    >
                      <MoveDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-red-50"
                      onClick={() => removeStep(step.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* Arrow to next step */}
                {index < steps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </div>
                )}
              </div>
            )
          })}

          {steps.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p>No steps yet. Add a step or use a template above.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-slate-500 px-1">
        <span>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
        <Badge variant="outline" className="gap-1">
          <Zap className="h-3 w-3" />
          Smart defaults applied
        </Badge>
      </div>
    </div>
  )
}
