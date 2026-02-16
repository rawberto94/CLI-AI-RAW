'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
  Play,
  Settings,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  MoveUp,
  MoveDown,
  Copy,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDataMode } from '@/contexts/DataModeContext'
import { useToast } from '@/hooks/use-toast'
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator'

interface WorkflowStep {
  id: string
  name: string
  description?: string
  order: number
  stepType: 'APPROVAL' | 'REVIEW' | 'NOTIFICATION' | 'TASK'
  assigneeType: 'USER' | 'ROLE' | 'GROUP' | 'DEPARTMENT'
  assigneeId?: string
  assigneeName?: string
  dueDays?: number
  dueHours?: number
  requiresApproval: boolean
  allowReject: boolean
  allowDelegate: boolean
}

interface WorkflowBuilderProps {
  workflowId?: string
  initialData?: any
  onSave?: (workflow: any) => Promise<void>
  onTest?: (workflow: any) => Promise<void>
}

export function WorkflowBuilder({
  workflowId,
  initialData,
  onSave,
  onTest,
}: WorkflowBuilderProps) {
  const { useRealData } = useDataMode()
  const { toast } = useToast()
  
  const [workflow, setWorkflow] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    type: initialData?.type || 'CONTRACT_APPROVAL',
    triggerType: initialData?.triggerType || 'MANUAL',
    isActive: initialData?.isActive ?? true,
  })

  const [steps, setSteps] = useState<WorkflowStep[]>(
    initialData?.steps || [
      {
        id: '1',
        name: 'Initial Review',
        order: 0,
        stepType: 'REVIEW',
        assigneeType: 'ROLE',
        requiresApproval: true,
        allowReject: true,
        allowDelegate: false,
      },
    ]
  )

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loading, setLoading] = useState(false)

  // Fetch workflow from database if workflowId is provided
  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/workflows/${workflowId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.workflow) {
          setWorkflow({
            name: data.workflow.name || '',
            description: data.workflow.description || '',
            type: data.workflow.type || 'CONTRACT_APPROVAL',
            triggerType: data.workflow.triggerType || 'MANUAL',
            isActive: data.workflow.isActive ?? true,
          })
          if (data.workflow.steps?.length > 0) {
            setSteps(data.workflow.steps)
          }
          toast({
            title: 'Workflow loaded',
            description: `Loaded "${data.workflow.name}" from ${data.source}`,
          })
        }
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false)
    }
  }, [workflowId, toast])

  useEffect(() => {
    if (workflowId && !initialData) {
      fetchWorkflow()
    }
  }, [workflowId, initialData, fetchWorkflow])

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: Date.now().toString(),
      name: `Step ${steps.length + 1}`,
      order: steps.length,
      stepType: 'APPROVAL',
      assigneeType: 'USER',
      requiresApproval: true,
      allowReject: true,
      allowDelegate: false,
    }
    setSteps([...steps, newStep])
  }

  const removeStep = (stepId: string) => {
    setSteps(steps.filter(s => s.id !== stepId).map((s, idx) => ({ ...s, order: idx })))
  }

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const index = steps.findIndex(s => s.id === stepId)
    if (index === -1) return
    
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === steps.length - 1) return
    
    const newSteps = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    const currentStep = newSteps[index]
    const targetStep = newSteps[targetIndex]
    if (!currentStep || !targetStep) return
    
    ;[newSteps[index], newSteps[targetIndex]] = [targetStep, currentStep]
    
    setSteps(newSteps.map((s, idx) => ({ ...s, order: idx })))
  }

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s))
  }

  const duplicateStep = (stepId: string) => {
    const step = steps.find(s => s.id === stepId)
    if (!step) return
    
    const newStep = {
      ...step,
      id: Date.now().toString(),
      name: `${step.name} (Copy)`,
      order: steps.length,
    }
    setSteps([...steps, newStep])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save to database via API
      const method = workflowId ? 'PUT' : 'POST'
      const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...workflow, steps }),
      })
      
      if (response.ok) {
        const data = await response.json()
        toast({
          title: 'Workflow saved',
          description: `Successfully saved workflow to ${data.source}`,
        })
      }
      
      // Also call the onSave callback if provided
      if (onSave) {
        await onSave({ ...workflow, steps })
      }
    } catch {
      toast({
        title: 'Save failed',
        description: 'Could not save workflow. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!onTest) return
    setTesting(true)
    try {
      await onTest({ ...workflow, steps })
    } finally {
      setTesting(false)
    }
  }

  const getStepTypeIcon = (type: string) => {
    switch (type) {
      case 'APPROVAL': return CheckCircle
      case 'REVIEW': return Users
      case 'NOTIFICATION': return Sparkles
      case 'TASK': return Settings
      default: return CheckCircle
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with data mode indicator and presence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Workflow Builder</h2>
          <Badge variant={useRealData ? "default" : "secondary"} className="text-xs">
            {useRealData ? "Live" : "Mock"}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {/* Real-time collaboration presence indicator */}
          {workflowId && (
            <PresenceIndicator 
              maxAvatars={4}
              showConnectionStatus
            />
          )}
          {workflowId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchWorkflow()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>
      
      {/* Workflow Configuration */}
      <Card className="shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 border-b">
          <CardTitle className="text-2xl bg-gradient-to-r from-violet-900 to-purple-900 bg-clip-text text-transparent">
            Workflow Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <Label htmlFor="workflow-name">Workflow Name *</Label>
              <Input
                id="workflow-name"
                value={workflow.name}
                onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                placeholder="e.g., Contract Approval Process"
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={workflow.description}
                onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                placeholder="Describe the purpose of this workflow"
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="workflow-type">Workflow Type *</Label>
              <Select
                value={workflow.type}
                onValueChange={(value) => setWorkflow({ ...workflow, type: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTRACT_APPROVAL">Contract Approval</SelectItem>
                  <SelectItem value="CONTRACT_REVIEW">Contract Review</SelectItem>
                  <SelectItem value="RENEWAL_APPROVAL">Renewal Approval</SelectItem>
                  <SelectItem value="AMENDMENT_APPROVAL">Amendment Approval</SelectItem>
                  <SelectItem value="TERMINATION_APPROVAL">Termination Approval</SelectItem>
                  <SelectItem value="CUSTOM">Custom Workflow</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="trigger-type">Trigger Type *</Label>
              <Select
                value={workflow.triggerType}
                onValueChange={(value) => setWorkflow({ ...workflow, triggerType: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual Trigger</SelectItem>
                  <SelectItem value="ON_UPLOAD">On Contract Upload</SelectItem>
                  <SelectItem value="ON_STATUS_CHANGE">On Status Change</SelectItem>
                  <SelectItem value="ON_VALUE_THRESHOLD">On Value Threshold</SelectItem>
                  <SelectItem value="ON_DATE">On Specific Date</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="workflow-active"
                checked={workflow.isActive}
                onChange={(e) => setWorkflow({ ...workflow, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="workflow-active" className="cursor-pointer">
                Workflow is active
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <Card className="shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-violet-50 to-pink-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl bg-gradient-to-r from-violet-900 to-pink-900 bg-clip-text text-transparent">
              Workflow Steps ({steps.length})
            </CardTitle>
            <Button
              onClick={addStep}
              className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Step
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {steps.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg mb-4">No steps added yet</p>
              <Button onClick={addStep} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Step
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => {
                const StepIcon = getStepTypeIcon(step.stepType)
                
                return (
                  <div key={step.id} className="relative">
                    <div className="p-6 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border-2 border-gray-200 hover:border-violet-300 transition-all">
                      {/* Step Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-violet-500 to-pink-600 rounded-xl shadow-lg">
                            <StepIcon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-violet-100 text-violet-700 border-violet-300">
                                Step {index + 1}
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {step.stepType.toLowerCase().replace('_', ' ')}
                              </Badge>
                            </div>
                            <Input
                              value={step.name}
                              onChange={(e) => updateStep(step.id, { name: e.target.value })}
                              className="font-bold text-lg border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                              placeholder="Step name"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveStep(step.id, 'up')}
                            disabled={index === 0}
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveStep(step.id, 'down')}
                            disabled={index === steps.length - 1}
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateStep(step.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeStep(step.id)}
                            className="hover:bg-red-50 hover:border-red-300"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      {/* Step Configuration */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <Label className="text-xs text-gray-600">Step Type</Label>
                          <Select
                            value={step.stepType}
                            onValueChange={(value: any) => updateStep(step.id, { stepType: value })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="APPROVAL">Approval</SelectItem>
                              <SelectItem value="REVIEW">Review</SelectItem>
                              <SelectItem value="NOTIFICATION">Notification</SelectItem>
                              <SelectItem value="TASK">Task</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs text-gray-600">Assign To</Label>
                          <Select
                            value={step.assigneeType}
                            onValueChange={(value: any) => updateStep(step.id, { assigneeType: value })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USER">Specific User</SelectItem>
                              <SelectItem value="ROLE">Role</SelectItem>
                              <SelectItem value="GROUP">Group</SelectItem>
                              <SelectItem value="DEPARTMENT">Department</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs text-gray-600">Assignee</Label>
                          <Input
                            value={step.assigneeName || ''}
                            onChange={(e) => updateStep(step.id, { assigneeName: e.target.value })}
                            placeholder="Enter name"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs text-gray-600">Due Days</Label>
                          <Input
                            type="number"
                            value={step.dueDays || ''}
                            onChange={(e) => updateStep(step.id, { dueDays: parseInt(e.target.value) || undefined })}
                            placeholder="Days"
                            className="mt-1"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-xs text-gray-600 mb-2 block">Options</Label>
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={step.requiresApproval}
                                onChange={(e) => updateStep(step.id, { requiresApproval: e.target.checked })}
                                className="h-4 w-4 rounded"
                              />
                              <span className="text-sm">Requires Approval</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={step.allowReject}
                                onChange={(e) => updateStep(step.id, { allowReject: e.target.checked })}
                                className="h-4 w-4 rounded"
                              />
                              <span className="text-sm">Allow Reject</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={step.allowDelegate}
                                onChange={(e) => updateStep(step.id, { allowDelegate: e.target.checked })}
                                className="h-4 w-4 rounded"
                              />
                              <span className="text-sm">Allow Delegate</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {step.description && (
                        <Textarea
                          value={step.description}
                          onChange={(e) => updateStep(step.id, { description: e.target.value })}
                          placeholder="Step description (optional)"
                          rows={2}
                          className="mt-4"
                        />
                      )}
                    </div>

                    {/* Arrow to next step */}
                    {index < steps.length - 1 && (
                      <div className="flex justify-center my-2">
                        <ArrowRight className="h-6 w-6 text-violet-500" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-gray-600">
          {steps.length} step{steps.length !== 1 ? 's' : ''} configured
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !workflow.name || steps.length === 0}
          >
            <Play className={cn('h-4 w-4 mr-2', testing && 'animate-spin')} />
            Test Workflow
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !workflow.name || steps.length === 0}
            className="bg-gradient-to-r from-violet-600 to-violet-600 hover:from-violet-700 hover:to-purple-700"
          >
            <Save className={cn('h-4 w-4 mr-2', saving && 'animate-spin')} />
            {saving ? 'Saving...' : 'Save Workflow'}
          </Button>
        </div>
      </div>
    </div>
  )
}
