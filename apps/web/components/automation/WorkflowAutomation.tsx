'use client'

import React, { useState, useEffect } from 'react'
import { 
  Play, 
  Pause, 
  Settings, 
  Plus, 
  Zap, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Edit,
  Trash2,
  Copy,
  BarChart3
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface WorkflowStep {
  id: string
  name: string
  type: 'trigger' | 'condition' | 'action'
  description: string
  config?: Record<string, any>
}

interface Workflow {
  id: string
  name: string
  description: string
  enabled: boolean
  steps: WorkflowStep[]
  executions: number
  successRate: number
  lastRun?: Date
  category: 'risk-management' | 'compliance' | 'optimization' | 'reporting'
  priority: 'low' | 'medium' | 'high'
}

interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'running' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  progress: number
  logs: string[]
}

export default function WorkflowAutomation() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  useEffect(() => {
    // Initialize with sample workflows
    const sampleWorkflows: Workflow[] = [
      {
        id: '1',
        name: 'High-Risk Contract Alert',
        description: 'Automatically flag contracts with risk scores above 80% and notify stakeholders',
        enabled: true,
        executions: 156,
        successRate: 98.7,
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        category: 'risk-management',
        priority: 'high',
        steps: [
          { id: '1', name: 'Contract Upload', type: 'trigger', description: 'When a new contract is uploaded' },
          { id: '2', name: 'Risk Analysis', type: 'action', description: 'Run AI risk assessment' },
          { id: '3', name: 'Risk Threshold Check', type: 'condition', description: 'If risk score > 80%' },
          { id: '4', name: 'Send Alert', type: 'action', description: 'Notify legal team via email' },
          { id: '5', name: 'Create Task', type: 'action', description: 'Create review task in system' }
        ]
      },
      {
        id: '2',
        name: 'Compliance Monitoring',
        description: 'Daily scan for compliance violations and generate reports',
        enabled: true,
        executions: 89,
        successRate: 100,
        lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
        category: 'compliance',
        priority: 'medium',
        steps: [
          { id: '1', name: 'Daily Schedule', type: 'trigger', description: 'Every day at 9:00 AM' },
          { id: '2', name: 'Scan Contracts', type: 'action', description: 'Check all active contracts' },
          { id: '3', name: 'Compliance Check', type: 'condition', description: 'If violations found' },
          { id: '4', name: 'Generate Report', type: 'action', description: 'Create compliance report' },
          { id: '5', name: 'Distribute Report', type: 'action', description: 'Send to compliance team' }
        ]
      },
      {
        id: '3',
        name: 'Cost Optimization Finder',
        description: 'Identify potential cost savings opportunities in vendor contracts',
        enabled: false,
        executions: 23,
        successRate: 95.7,
        lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        category: 'optimization',
        priority: 'medium',
        steps: [
          { id: '1', name: 'Weekly Trigger', type: 'trigger', description: 'Every Monday at 8:00 AM' },
          { id: '2', name: 'Analyze Contracts', type: 'action', description: 'Run cost analysis AI' },
          { id: '3', name: 'Savings Threshold', type: 'condition', description: 'If potential savings > $10K' },
          { id: '4', name: 'Create Opportunity', type: 'action', description: 'Log optimization opportunity' },
          { id: '5', name: 'Notify Procurement', type: 'action', description: 'Alert procurement team' }
        ]
      },
      {
        id: '4',
        name: 'Executive Dashboard Update',
        description: 'Generate and update executive KPI dashboard with latest metrics',
        enabled: true,
        executions: 45,
        successRate: 100,
        lastRun: new Date(Date.now() - 60 * 60 * 1000),
        category: 'reporting',
        priority: 'low',
        steps: [
          { id: '1', name: 'Hourly Trigger', type: 'trigger', description: 'Every hour' },
          { id: '2', name: 'Collect Metrics', type: 'action', description: 'Gather performance data' },
          { id: '3', name: 'Update Dashboard', type: 'action', description: 'Refresh executive dashboard' },
          { id: '4', name: 'Cache Results', type: 'action', description: 'Store for quick access' }
        ]
      }
    ]

    setWorkflows(sampleWorkflows)

    // Simulate some running executions
    const sampleExecutions: WorkflowExecution[] = [
      {
        id: '1',
        workflowId: '1',
        status: 'running',
        startTime: new Date(Date.now() - 5 * 60 * 1000),
        progress: 75,
        logs: [
          'Started workflow execution',
          'Contract uploaded: ABC-2024-001',
          'Running AI risk assessment...',
          'Risk score calculated: 85%',
          'Threshold exceeded, sending alerts...'
        ]
      }
    ]

    setExecutions(sampleExecutions)

    // Simulate execution updates
    const interval = setInterval(() => {
      setExecutions(prev => prev.map(exec => {
        if (exec.status === 'running' && exec.progress < 100) {
          const newProgress = Math.min(100, exec.progress + Math.random() * 10)
          const newLogs = [...exec.logs]
          
          if (newProgress > 90 && exec.logs.length < 6) {
            newLogs.push('Workflow completed successfully')
          }
          
          return {
            ...exec,
            progress: newProgress,
            logs: newLogs,
            status: newProgress >= 100 ? 'completed' : 'running',
            endTime: newProgress >= 100 ? new Date() : undefined
          }
        }
        return exec
      }))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const toggleWorkflow = (id: string) => {
    setWorkflows(prev => prev.map(w => 
      w.id === id ? { ...w, enabled: !w.enabled } : w
    ))
  }

  const getCategoryColor = (category: Workflow['category']) => {
    switch (category) {
      case 'risk-management': return 'bg-red-100 text-red-800 border-red-200'
      case 'compliance': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'optimization': return 'bg-green-100 text-green-800 border-green-200'
      case 'reporting': return 'bg-purple-100 text-purple-800 border-purple-200'
    }
  }

  const getPriorityColor = (priority: Workflow['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-gray-100 text-gray-800'
    }
  }

  const getStepIcon = (type: WorkflowStep['type']) => {
    switch (type) {
      case 'trigger': return <Zap className="h-3 w-3 text-blue-500" />
      case 'condition': return <AlertTriangle className="h-3 w-3 text-yellow-500" />
      case 'action': return <CheckCircle className="h-3 w-3 text-green-500" />
    }
  }

  const formatLastRun = (date?: Date) => {
    if (!date) return 'Never'
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) return `${hours}h ${minutes}m ago`
    return `${minutes}m ago`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflow Automation</h2>
          <p className="text-muted-foreground">
            Automate contract intelligence processes with AI-powered workflows
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
              <DialogDescription>
                Set up automated processes for contract intelligence tasks
              </DialogDescription>
            </DialogHeader>
            <div className="p-4 text-center text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Workflow builder coming soon...</p>
              <p className="text-sm">Use templates below to get started quickly</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Executions */}
      {executions.filter(e => e.status === 'running').length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Play className="h-5 w-5" />
              Active Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {executions.filter(e => e.status === 'running').map(execution => {
              const workflow = workflows.find(w => w.id === execution.workflowId)
              return (
                <div key={execution.id} className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{workflow?.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Started {formatLastRun(execution.startTime)}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800">
                      Running
                    </Badge>
                  </div>
                  <Progress value={execution.progress} className="mb-3" />
                  <div className="text-sm text-muted-foreground">
                    Progress: {Math.round(execution.progress)}% complete
                  </div>
                  {execution.logs.length > 0 && (
                    <div className="mt-3 text-xs">
                      <p className="font-medium mb-1">Latest: {execution.logs[execution.logs.length - 1]}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Workflows Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {workflows.map((workflow) => (
          <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 mb-2">
                    <span>{workflow.name}</span>
                    <Switch
                      checked={workflow.enabled}
                      onCheckedChange={() => toggleWorkflow(workflow.id)}
                    />
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mb-3">
                    {workflow.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={getCategoryColor(workflow.category)}
                    >
                      {workflow.category.replace('-', ' ')}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={getPriorityColor(workflow.priority)}
                    >
                      {workflow.priority} priority
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Workflow Steps */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Workflow Steps</h4>
                <div className="space-y-2">
                  {workflow.steps.slice(0, 3).map((step, index) => (
                    <div key={step.id} className="flex items-center gap-2 text-sm">
                      {getStepIcon(step.type)}
                      <span className="truncate">{step.name}</span>
                      {index < workflow.steps.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                  {workflow.steps.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{workflow.steps.length - 3} more steps
                    </div>
                  )}
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                <div>
                  <div className="text-lg font-semibold">{workflow.executions}</div>
                  <div className="text-xs text-muted-foreground">Executions</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{workflow.successRate}%</div>
                  <div className="text-xs text-muted-foreground">Success Rate</div>
                </div>
                <div>
                  <div className="text-sm font-medium">{formatLastRun(workflow.lastRun)}</div>
                  <div className="text-xs text-muted-foreground">Last Run</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSelectedWorkflow(workflow)}
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Configure
                </Button>
                <Button size="sm" variant="outline">
                  <Play className="h-3 w-3 mr-1" />
                  Run Now
                </Button>
                <Button size="sm" variant="outline">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workflow Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Templates</CardTitle>
          <p className="text-sm text-muted-foreground">
            Quick-start templates for common automation scenarios
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                name: 'Contract Expiry Alerts',
                description: 'Notify teams before contracts expire',
                category: 'compliance',
                icon: <Clock className="h-4 w-4" />
              },
              {
                name: 'Vendor Risk Monitoring',
                description: 'Track supplier risk changes',
                category: 'risk-management',
                icon: <AlertTriangle className="h-4 w-4" />
              },
              {
                name: 'Performance Reporting',
                description: 'Generate automated reports',
                category: 'reporting',
                icon: <BarChart3 className="h-4 w-4" />
              }
            ].map((template, index) => (
              <div 
                key={index}
                className="p-4 border border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  {template.icon}
                  <h4 className="font-medium">{template.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {template.description}
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  Use Template
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}