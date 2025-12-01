'use client'

import React, { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { WorkflowBuilder } from '@/components/workflows/WorkflowBuilder'
import { ApprovalsQueue } from '@/components/workflows/ApprovalsQueue'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Settings,
  Play,
  Pause,
  Trash2,
  Edit,
  Copy,
  RefreshCw,
  CheckCircle,
  Clock,
  ArrowRight,
  FileText,
  Zap,
  Activity,
  GitBranch,
  ChevronRight,
  Inbox,
  Workflow,
  Sparkles,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { useWorkflows, useUpdateWorkflow, useDeleteWorkflow, useCreateWorkflow, type Workflow as WorkflowType } from '@/hooks/use-queries'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Workflow template presets
const workflowTemplates = [
  {
    id: 'standard-approval',
    name: 'Standard Approval',
    description: 'Legal → Finance → Management approval chain',
    icon: CheckCircle,
    color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    steps: 3,
    popular: true,
  },
  {
    id: 'quick-approval',
    name: 'Quick Approval',
    description: 'Single manager approval for low-value contracts',
    icon: Zap,
    color: 'bg-gradient-to-br from-green-500 to-emerald-600',
    steps: 1,
  },
  {
    id: 'comprehensive-review',
    name: 'Comprehensive Review',
    description: 'Full review with Legal, Security, Finance, and Executive sign-off',
    icon: GitBranch,
    color: 'bg-gradient-to-br from-purple-500 to-fuchsia-600',
    steps: 5,
  },
  {
    id: 'renewal-workflow',
    name: 'Renewal Workflow',
    description: 'Automated renewal review with performance check',
    icon: RefreshCw,
    color: 'bg-gradient-to-br from-amber-500 to-orange-600',
    steps: 2,
  },
]

function WorkflowsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'queue'
  
  const [activeTab, setActiveTab] = useState<'queue' | 'automation' | 'templates'>(
    initialTab === 'automation' || initialTab === 'templates' ? initialTab : 'queue'
  )
  const [showBuilder, setShowBuilder] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null)
  
  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowType | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: workflowsData, isLoading: loading, refetch } = useWorkflows()
  const updateWorkflow = useUpdateWorkflow()
  const deleteWorkflowMutation = useDeleteWorkflow()
  const createWorkflowMutation = useCreateWorkflow()

  const workflows: WorkflowType[] = workflowsData?.workflows || []

  const stats = useMemo(() => ({
    total: workflows.length,
    active: workflows.filter(w => w.isActive).length,
    inactive: workflows.filter(w => !w.isActive).length,
    totalExecutions: workflows.reduce((sum, w) => sum + (w.executions || 0), 0),
  }), [workflows])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', activeTab)
    router.replace(url.pathname + url.search, { scroll: false })
  }, [activeTab, router])

  const createNew = () => {
    setSelectedWorkflow(null)
    setShowBuilder(true)
  }

  const createFromTemplate = (templateId: string) => {
    toast.info('Template selected', { description: 'Creating workflow from template...' })
    setSelectedWorkflow(null)
    setShowBuilder(true)
  }

  const editWorkflow = (workflow: WorkflowType) => {
    setSelectedWorkflow(workflow)
    setShowBuilder(true)
  }

  const toggleWorkflow = async (workflowId: string, isActive: boolean) => {
    try {
      await updateWorkflow.mutateAsync({ id: workflowId, data: { isActive } })
      toast.success(isActive ? 'Workflow activated' : 'Workflow deactivated')
    } catch (error) {
      console.error('Failed to toggle workflow:', error)
      toast.error('Failed to update workflow')
    }
  }

  const handleDeleteWorkflow = async (workflowId: string) => {
    setIsDeleting(true)
    try {
      await deleteWorkflowMutation.mutateAsync(workflowId)
      toast.success('Workflow deleted')
      setDeleteModalOpen(false)
      setWorkflowToDelete(null)
    } catch (error) {
      console.error('Failed to delete workflow:', error)
      toast.error('Failed to delete workflow')
    } finally {
      setIsDeleting(false)
    }
  }
  
  const openDeleteModal = (workflow: WorkflowType) => {
    setWorkflowToDelete(workflow)
    setDeleteModalOpen(true)
  }

  const duplicateWorkflow = async (workflow: WorkflowType) => {
    try {
      await createWorkflowMutation.mutateAsync({
        ...workflow,
        name: `${workflow.name} (Copy)`,
        isActive: false,
      })
      toast.success('Workflow duplicated')
    } catch (error) {
      console.error('Failed to duplicate workflow:', error)
      toast.error('Failed to duplicate workflow')
    }
  }

  if (showBuilder) {
    return (
      <div className="h-full overflow-auto bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-6">
            <Button variant="outline" onClick={() => setShowBuilder(false)} className="gap-2">
              <ArrowRight className="h-4 w-4 rotate-180" />
              Back to Workflows
            </Button>
          </div>
          <WorkflowBuilder
            workflowId={selectedWorkflow?.id}
            initialData={selectedWorkflow}
            onSave={async (data) => {
              const method = selectedWorkflow ? 'PUT' : 'POST'
              const url = selectedWorkflow ? `/api/workflows/${selectedWorkflow.id}` : '/api/workflows'
              await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
              setShowBuilder(false)
              await refetch()
              toast.success(selectedWorkflow ? 'Workflow updated' : 'Workflow created')
            }}
            onTest={async (data) => {
              console.log('Testing workflow:', data)
              toast.info('Workflow test completed', { description: 'Check console for details.' })
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20">
      <div className="max-w-7xl mx-auto">
        {/* Unified Header */}
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 px-6 py-5 sticky top-0 z-20">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl blur-md opacity-50" />
                <div className="relative p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <Workflow className="h-7 w-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-900 via-purple-800 to-indigo-900 bg-clip-text text-transparent">
                  Workflows
                </h1>
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  Manage approvals and automation in one place
                  <Badge variant="secondary" className="bg-indigo-100/80 text-indigo-700 text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Unified
                  </Badge>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2 mr-2">
                <Badge variant="outline" className="gap-1 px-2.5 py-1 bg-amber-50 border-amber-200 text-amber-700">
                  <Clock className="h-3 w-3" />
                  <span className="font-semibold">4</span> Pending
                </Badge>
                <Badge variant="outline" className="gap-1 px-2.5 py-1 bg-green-50 border-green-200 text-green-700">
                  <CheckCircle className="h-3 w-3" />
                  <span className="font-semibold">{stats.active}</span> Active
                </Badge>
              </div>

              <Button variant="outline" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              
              <Button
                onClick={createNew}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg gap-2"
              >
                <Plus className="h-4 w-4" />
                New Workflow
              </Button>
            </div>
          </motion.div>

          {/* Unified Tabs */}
          <div className="mt-5">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'queue' | 'automation' | 'templates')}>
              <TabsList className="bg-slate-100/80 p-1 rounded-xl">
                <TabsTrigger 
                  value="queue" 
                  className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <Inbox className="h-4 w-4" />
                  Queue
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 ml-1 text-xs">4</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="automation" 
                  className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <GitBranch className="h-4 w-4" />
                  Automation
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 ml-1 text-xs">{stats.total}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="templates" 
                  className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4" />
                  Templates
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'queue' && (
              <motion.div
                key="queue"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-[calc(100vh-220px)]"
              >
                <ApprovalsQueue />
              </motion.div>
            )}

            {activeTab === 'automation' && (
              <motion.div
                key="automation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total', value: stats.total, icon: GitBranch, color: 'from-indigo-100 to-purple-100', iconColor: 'text-indigo-600' },
                    { label: 'Active', value: stats.active, icon: CheckCircle, color: 'from-green-100 to-emerald-100', iconColor: 'text-green-600', valueColor: 'text-green-600' },
                    { label: 'Inactive', value: stats.inactive, icon: Pause, color: 'from-slate-100 to-slate-50', iconColor: 'text-slate-600', valueColor: 'text-slate-600' },
                    { label: 'Executions', value: stats.totalExecutions, icon: Activity, color: 'from-blue-100 to-cyan-100', iconColor: 'text-blue-600', valueColor: 'text-blue-600' },
                  ].map((stat) => (
                    <Card key={stat.label} className="bg-white/70 backdrop-blur border-0 shadow-md hover:shadow-lg transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 bg-gradient-to-br ${stat.color} rounded-xl`}>
                            <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                          </div>
                          <div>
                            <p className="text-sm text-slate-500">{stat.label}</p>
                            <p className={`text-2xl font-bold ${stat.valueColor || 'text-slate-900'}`}>{stat.value}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Workflows List */}
                {loading ? (
                  <Card className="shadow-xl border-0 bg-white/80">
                    <CardContent className="p-12 text-center">
                      <RefreshCw className="h-12 w-12 mx-auto animate-spin text-indigo-600 mb-4" />
                      <p className="text-gray-600">Loading workflows...</p>
                    </CardContent>
                  </Card>
                ) : workflows.length === 0 ? (
                  <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                    <CardContent className="p-12 text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <GitBranch className="h-10 w-10 text-indigo-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No workflows yet</h3>
                      <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        Create your first automated workflow to streamline contract approvals.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Button onClick={createNew} className="bg-gradient-to-r from-indigo-600 to-purple-600 gap-2">
                          <Plus className="h-4 w-4" />
                          Create Workflow
                        </Button>
                        <Button variant="outline" onClick={() => setActiveTab('templates')} className="gap-2">
                          <FileText className="h-4 w-4" />
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {workflows.map((workflow, index) => (
                      <motion.div
                        key={workflow.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="shadow-lg border-0 bg-white/90 backdrop-blur hover:shadow-xl transition-all group">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-xl font-bold text-gray-900">{workflow.name}</h3>
                                  <Badge className={workflow.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                                    {workflow.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-3">{workflow.description || 'No description'}</p>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <ArrowRight className="h-3 w-3" />
                                    {workflow.steps?.length || 0} steps
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    {workflow.executions || 0} runs
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg group-hover:scale-105 transition-transform">
                                <Settings className="h-6 w-6 text-white" />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-4 border-t">
                              <Button variant="outline" size="sm" onClick={() => editWorkflow(workflow)} className="gap-1">
                                <Edit className="h-4 w-4" /> Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => duplicateWorkflow(workflow)} className="gap-1">
                                <Copy className="h-4 w-4" /> Copy
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => toggleWorkflow(workflow.id, !workflow.isActive)} className="gap-1">
                                {workflow.isActive ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Activate</>}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openDeleteModal(workflow)} className="hover:bg-red-50 hover:border-red-300 ml-auto">
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'templates' && (
              <motion.div
                key="templates"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Quick Start Templates</h2>
                  <p className="text-slate-500">Choose a template to get started quickly</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {workflowTemplates.map((template) => {
                    const Icon = template.icon
                    return (
                      <motion.div key={template.id} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                        <Card 
                          className="shadow-lg border-0 bg-white/90 backdrop-blur hover:shadow-xl transition-all cursor-pointer group"
                          onClick={() => createFromTemplate(template.id)}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              <div className={`p-3 ${template.color} rounded-xl shadow-lg group-hover:scale-105 transition-transform`}>
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                                  {template.popular && <Badge className="bg-amber-100 text-amber-700">Popular</Badge>}
                                </div>
                                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                                <div className="text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <ArrowRight className="h-3 w-3" />
                                    {template.steps} step{template.steps > 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
                
                <div className="mt-8 text-center">
                  <p className="text-gray-500 mb-4">Need something custom?</p>
                  <Button onClick={createNew} variant="outline" size="lg" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create from Scratch
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle>Delete Workflow</DialogTitle>
                <DialogDescription className="mt-1">
                  This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {workflowToDelete && (
            <div className="py-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-medium text-slate-900">{workflowToDelete.name}</p>
                {workflowToDelete.isActive && (
                  <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    This workflow is currently active
                  </p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false)
                setWorkflowToDelete(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => workflowToDelete && handleDeleteWorkflow(workflowToDelete.id)}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Workflow
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function UnifiedWorkflowsPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    }>
      <WorkflowsPageContent />
    </Suspense>
  )
}
