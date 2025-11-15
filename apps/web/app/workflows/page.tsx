'use client'

import React, { useState, useEffect } from 'react'
import { WorkflowBuilder } from '@/components/workflows/WorkflowBuilder'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Settings,
  Play,
  Pause,
  Trash2,
  Edit,
  Copy,
  BarChart3,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function WorkflowsPage() {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)

  useEffect(() => {
    loadWorkflows()
  }, [])

  const loadWorkflows = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/workflows')
      if (response.ok) {
        const data = await response.json()
        setWorkflows(data.workflows || [])
      }
    } catch (error) {
      console.error('Failed to load workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const createNew = () => {
    setSelectedWorkflow(null)
    setShowBuilder(true)
  }

  const editWorkflow = (workflow: any) => {
    setSelectedWorkflow(workflow)
    setShowBuilder(true)
  }

  const toggleWorkflow = async (workflowId: string, isActive: boolean) => {
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      await loadWorkflows()
    } catch (error) {
      console.error('Failed to toggle workflow:', error)
    }
  }

  const deleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return
    
    try {
      await fetch(`/api/workflows/${workflowId}`, { method: 'DELETE' })
      await loadWorkflows()
    } catch (error) {
      console.error('Failed to delete workflow:', error)
    }
  }

  const duplicateWorkflow = async (workflow: any) => {
    try {
      await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...workflow,
          name: `${workflow.name} (Copy)`,
          isActive: false,
        }),
      })
      await loadWorkflows()
    } catch (error) {
      console.error('Failed to duplicate workflow:', error)
    }
  }

  if (showBuilder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-pink-50/30 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Button variant="outline" onClick={() => setShowBuilder(false)}>
              ← Back to Workflows
            </Button>
          </div>
          <WorkflowBuilder
            workflowId={selectedWorkflow?.id}
            initialData={selectedWorkflow}
            onSave={async (data) => {
              const method = selectedWorkflow ? 'PUT' : 'POST'
              const url = selectedWorkflow ? `/api/workflows/${selectedWorkflow.id}` : '/api/workflows'
              
              await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              })
              
              setShowBuilder(false)
              await loadWorkflows()
            }}
            onTest={async (data) => {
              console.log('Testing workflow:', data)
              alert('Workflow test completed! Check console for details.')
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-pink-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-900 to-pink-900 bg-clip-text text-transparent">
              Workflow Automation
            </h1>
            <p className="text-gray-600 mt-2">Create and manage automated approval workflows</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadWorkflows}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={createNew}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </div>
        </div>

        {/* Workflows List */}
        {loading ? (
          <Card className="shadow-xl">
            <CardContent className="p-12 text-center">
              <RefreshCw className="h-12 w-12 mx-auto animate-spin text-purple-600 mb-4" />
              <p className="text-gray-600">Loading workflows...</p>
            </CardContent>
          </Card>
        ) : workflows.length === 0 ? (
          <Card className="shadow-xl">
            <CardContent className="p-12 text-center">
              <Settings className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No workflows yet</h3>
              <p className="text-gray-600 mb-6">Create your first automated workflow to streamline approvals</p>
              <Button onClick={createNew} className="bg-gradient-to-r from-purple-600 to-pink-600">
                <Plus className="h-4 w-4 mr-2" />
                Create First Workflow
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="shadow-xl border-0 hover:shadow-2xl transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{workflow.name}</h3>
                        <Badge className={workflow.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {workflow.isActive ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <Pause className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{workflow.description || 'No description'}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{workflow.steps?.length || 0} steps</span>
                        <span>•</span>
                        <span className="capitalize">{workflow.type?.toLowerCase().replace('_', ' ')}</span>
                        <span>•</span>
                        <span>{workflow.executions || 0} executions</span>
                      </div>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                      <Settings className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editWorkflow(workflow)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => duplicateWorkflow(workflow)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleWorkflow(workflow.id, !workflow.isActive)}
                    >
                      {workflow.isActive ? (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteWorkflow(workflow.id)}
                      className="hover:bg-red-50 hover:border-red-300 ml-auto"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
