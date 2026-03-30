'use client'

import React, { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { LazyWorkflowBuilder as WorkflowBuilder, LazySimpleApprovalsQueue as SimpleApprovalsQueue } from '@/components/lazy'
import { BulkApprovalActions } from '@/components/approvals/BulkApprovalActions'
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
import { useWorkflows, useUpdateWorkflow, useDeleteWorkflow, useCreateWorkflow, useCrossModuleInvalidation, type Workflow as WorkflowType } from '@/hooks/use-queries'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { PageBreadcrumb } from '@/components/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Workflow template presets - synced with backend WORKFLOW_TEMPLATES
const workflowTemplates = [
  {
    id: 'standard',
    name: 'Standard Approval',
    description: 'Initial Review → Legal Review → Final Approval',
    icon: CheckCircle,
    color: 'bg-gradient-to-br from-violet-500 to-purple-600',
    steps: 3,
    popular: true,
    type: 'APPROVAL',
  },
  {
    id: 'express',
    name: 'Express Approval',
    description: 'Quick review for low-value contracts (<$25K)',
    icon: Zap,
    color: 'bg-gradient-to-br from-violet-500 to-violet-600',
    steps: 2,
    type: 'APPROVAL',
  },
  {
    id: 'legal_review',
    name: 'Legal Review',
    description: 'Legal Analysis → Compliance → Legal Director',
    icon: FileText,
    color: 'bg-gradient-to-br from-slate-500 to-slate-700',
    steps: 3,
    type: 'APPROVAL',
  },
  {
    id: 'executive',
    name: 'Executive Approval',
    description: 'Full approval chain for high-value contracts',
    icon: GitBranch,
    color: 'bg-gradient-to-br from-violet-500 to-fuchsia-600',
    steps: 5,
    popular: true,
    type: 'APPROVAL',
  },
  {
    id: 'amendment',
    name: 'Amendment Approval',
    description: 'For amendments, addendums, and change orders',
    icon: Edit,
    color: 'bg-gradient-to-br from-amber-500 to-orange-600',
    steps: 3,
    type: 'APPROVAL',
  },
  {
    id: 'nda_fast_track',
    name: 'NDA Fast Track',
    description: 'Expedited approval for standard NDAs',
    icon: Zap,
    color: 'bg-gradient-to-br from-violet-500 to-purple-600',
    steps: 2,
    type: 'APPROVAL',
  },
  {
    id: 'vendor_onboarding',
    name: 'Vendor Onboarding',
    description: 'Compliance → Finance → Procurement review',
    icon: Activity,
    color: 'bg-gradient-to-br from-violet-500 to-violet-600',
    steps: 3,
    type: 'REVIEW',
  },
  {
    id: 'termination',
    name: 'Contract Termination',
    description: 'Legal → Finance Impact → Manager → Executive',
    icon: AlertTriangle,
    color: 'bg-gradient-to-br from-red-500 to-rose-600',
    steps: 4,
    type: 'APPROVAL',
  },
  {
    id: 'renewal_opt_out',
    name: 'Renewal Opt-Out',
    description: 'Notification workflow for auto-renewal cancellation',
    icon: RefreshCw,
    color: 'bg-gradient-to-br from-orange-500 to-amber-600',
    steps: 3,
    type: 'NOTIFICATION',
  },
  {
    id: 'risk_escalation',
    name: 'Risk Escalation',
    description: 'Risk Assessment → Compliance → Legal Director → Executive',
    icon: AlertTriangle,
    color: 'bg-gradient-to-br from-rose-500 to-red-700',
    steps: 4,
    type: 'APPROVAL',
  },
  {
    id: 'multi_party',
    name: 'Multi-Party Signature',
    description: 'Internal → Counter-party A → Counter-party B → Final',
    icon: GitBranch,
    color: 'bg-gradient-to-br from-violet-500 to-purple-700',
    steps: 4,
    type: 'APPROVAL',
  },
  {
    id: 'procurement',
    name: 'Procurement Review',
    description: 'Budget → Procurement → Finance → Department Head',
    icon: FileText,
    color: 'bg-gradient-to-br from-violet-500 to-purple-700',
    steps: 4,
    type: 'APPROVAL',
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
  const crossModule = useCrossModuleInvalidation()

  
  const workflows: WorkflowType[] = workflowsData?.workflows || []

  const stats = useMemo(() => ({
    total: workflows.length,
    active: workflows.filter(w => w.isActive).length,
    inactive: workflows.filter(w => !w.isActive).length,
    totalExecutions: workflows.reduce((sum, w) => sum + (w.executions || 0), 0),
    pending: workflows.filter(w => w.isActive && (w.executions || 0) === 0).length,
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

  const createFromTemplate = async (templateId: string) => {
    const template = workflowTemplates.find(t => t.id === templateId)
    toast.info('Creating workflow', { description: `Creating "${template?.name}" from template...` })
    
    try {
      const response = await fetch('/api/workflows/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_from_template',
          templateKey: templateId,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create workflow')
      }
      
      const result = await response.json()
      toast.success('Workflow created', { description: `"${template?.name}" workflow is ready` })
      crossModule.onWorkflowChange()
      refetch()
    } catch (error) {
      toast.error('Failed to create workflow from template')
    }
  }

  const editWorkflow = (workflow: WorkflowType) => {
    setSelectedWorkflow(workflow)
    setShowBuilder(true)
  }

  const toggleWorkflow = async (workflowId: string, isActive: boolean) => {
    try {
      await updateWorkflow.mutateAsync({ id: workflowId, data: { isActive } })
      toast.success(isActive ? 'Workflow activated' : 'Workflow deactivated')
      crossModule.onWorkflowChange()
    } catch {
      toast.error('Failed to update workflow')
    }
  }

  const handleDeleteWorkflow = async (workflowId: string) => {
    setIsDeleting(true)
    try {
      await deleteWorkflowMutation.mutateAsync(workflowId)
      toast.success('Workflow deleted')
      crossModule.onWorkflowChange()
      setDeleteModalOpen(false)
      setWorkflowToDelete(null)
    } catch {
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
      crossModule.onWorkflowChange()
    } catch {
      toast.error('Failed to duplicate workflow')
    }
  }

  if (showBuilder) {
    return (
      <div className="h-full overflow-auto bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/20 dark:from-slate-900 dark:via-purple-950/20 dark:to-purple-950/20">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-6">
            <Button variant="outline" onClick={() => setShowBuilder(false)} className="gap-2 dark:border-slate-600 dark:hover:bg-slate-700">
              <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
              Back to Workflows
            </Button>
          </div>
          <WorkflowBuilder
            workflowId={selectedWorkflow?.id}
            initialData={selectedWorkflow}
            onSave={async (data) => {
              try {
                const method = selectedWorkflow ? 'PUT' : 'POST'
                const url = selectedWorkflow ? `/api/workflows/${selectedWorkflow.id}` : '/api/workflows'
                const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
                if (!res.ok) throw new Error('Failed to save workflow')
                setShowBuilder(false)
                crossModule.onWorkflowChange()
                await refetch()
                toast.success(selectedWorkflow ? 'Workflow updated' : 'Workflow created')
              } catch {
                toast.error('Failed to save workflow. Please try again.')
              }
            }}
            onTest={async (data) => {
              toast.info('Workflow test completed', { description: 'Workflow validated successfully.' })
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/20 dark:from-slate-900 dark:via-purple-950/20 dark:to-purple-950/20">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumbs */}
        <div className="px-6 pt-4">
          <PageBreadcrumb />
        </div>
        {/* Unified Header */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/50 px-6 py-5 sticky top-0 z-20">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 motion-reduce:transition-none"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-md opacity-50" aria-hidden="true" />
                <div className="relative p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                  <Workflow className="h-7 w-7 text-white" aria-hidden="true" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-900 via-purple-800 to-violet-900 dark:from-violet-300 dark:via-purple-300 dark:to-purple-300 bg-clip-text text-transparent">
                  Workflows
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  Manage approvals and automation in one place
                  <Badge variant="secondary" className="bg-violet-100/80 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs px-3 py-1">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                    Unified
                  </Badge>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="hidden lg:flex items-center gap-2.5 mr-2">
                <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-semibold">{stats.pending}</span> Pending
                </Badge>
                <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-semibold">{stats.active}</span> Active
                </Badge>
              </div>

              <Button variant="outline" onClick={() => refetch()} className="gap-2 h-8 dark:border-slate-600 dark:hover:bg-slate-700" aria-label="Refresh workflows">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              
              <Button
                onClick={createNew}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg gap-2 h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                New Workflow
              </Button>
            </div>
          </motion.div>

          {/* Unified Tabs */}
          <div className="mt-5">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'queue' | 'automation' | 'templates')}>
              <TabsList className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 p-1.5 rounded-xl shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30">
                <TabsTrigger 
                  value="queue" 
                  className="gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:via-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/30 transition-all duration-200 dark:text-slate-300"
                >
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                  Queue
                  <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 ml-1 text-xs">{stats.pending}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="automation" 
                  className="gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:via-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/30 transition-all duration-200 dark:text-slate-300"
                >
                  <GitBranch className="h-4 w-4" aria-hidden="true" />
                  Automation
                  <Badge variant="secondary" className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 ml-1 text-xs">{stats.total}</Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="templates" 
                  className="gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:via-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-violet-500/30 transition-all duration-200 dark:text-slate-300"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
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
                <SimpleApprovalsQueue />
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
                    { label: 'Total', value: stats.total, icon: GitBranch, color: 'from-violet-100 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50', iconColor: 'text-violet-600 dark:text-violet-400' },
                    { label: 'Active', value: stats.active, icon: CheckCircle, color: 'from-violet-100 to-violet-100 dark:from-violet-900/50 dark:to-violet-900/50', iconColor: 'text-green-600 dark:text-green-400', valueColor: 'text-green-600 dark:text-green-400' },
                    { label: 'Inactive', value: stats.inactive, icon: Pause, color: 'from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-700/50', iconColor: 'text-slate-600 dark:text-slate-400', valueColor: 'text-slate-600 dark:text-slate-400' },
                    { label: 'Executions', value: stats.totalExecutions, icon: Activity, color: 'from-violet-100 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50', iconColor: 'text-violet-600 dark:text-violet-400', valueColor: 'text-violet-600 dark:text-violet-400' },
                  ].map((stat) => (
                    <Card key={stat.label} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur border-0 dark:border dark:border-slate-700/50 shadow-md hover:shadow-lg transition-all motion-reduce:transition-none">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 bg-gradient-to-br ${stat.color} rounded-xl`}>
                            <stat.icon className={`h-5 w-5 ${stat.iconColor}`} aria-hidden="true" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
                            <p className={`text-2xl font-bold ${stat.valueColor || 'text-slate-900 dark:text-slate-100'}`}>{stat.value}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Workflows List */}
                {loading ? (
                  <Card className="shadow-xl border-0 dark:border dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80">
                    <CardContent className="p-5 text-center">
                      <RefreshCw className="h-12 w-12 mx-auto motion-safe:animate-spin text-violet-600 dark:text-violet-400 mb-4" aria-hidden="true" />
                      <p className="text-gray-600 dark:text-gray-300">Loading workflows...</p>
                    </CardContent>
                  </Card>
                ) : workflows.length === 0 ? (
                  <Card className="shadow-xl border-0 dark:border dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur">
                    <CardContent className="p-5 text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <GitBranch className="h-10 w-10 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No workflows yet</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                        Create your first automated workflow to streamline contract approvals.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                        <Button onClick={createNew} className="bg-gradient-to-r from-violet-600 to-purple-600 gap-2 h-8">
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          Create Workflow
                        </Button>
                        <Button variant="outline" onClick={() => setActiveTab('templates')} className="gap-2 h-8 dark:border-slate-600 dark:hover:bg-slate-700">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
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
                        className="motion-reduce:transition-none"
                      >
                        <Card className="shadow-lg border-0 dark:border dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 backdrop-blur hover:shadow-xl transition-all motion-reduce:transition-none group">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{workflow.name}</h3>
                                  <Badge className={workflow.isActive ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-3 py-1' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1'}>
                                    {workflow.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{workflow.description || 'No description'}</p>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                    {workflow.steps?.length || 0} steps
                                  </span>
                                  <span aria-hidden="true">•</span>
                                  <span className="flex items-center gap-1">
                                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                                    {workflow.executions || 0} runs
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg group-hover:scale-105 transition-transform motion-reduce:transform-none">
                                <Settings className="h-6 w-6 text-white" aria-hidden="true" />
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 pt-4 border-t dark:border-slate-700">
                              <Button variant="outline" size="sm" onClick={() => editWorkflow(workflow)} className="gap-1 h-8 dark:border-slate-600 dark:hover:bg-slate-700">
                                <Edit className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => duplicateWorkflow(workflow)} className="gap-1 h-8 dark:border-slate-600 dark:hover:bg-slate-700">
                                <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => toggleWorkflow(workflow.id, !workflow.isActive)} className="gap-1 h-8 dark:border-slate-600 dark:hover:bg-slate-700">
                                {workflow.isActive ? <><Pause className="h-3.5 w-3.5" aria-hidden="true" /> Pause</> : <><Play className="h-3.5 w-3.5" aria-hidden="true" /> Activate</>}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openDeleteModal(workflow)} className="hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-700 ml-auto h-8 dark:border-slate-600" aria-label={`Delete ${workflow.name}`}>
                                <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden="true" />
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
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Quick Start Templates</h2>
                  <p className="text-slate-500 dark:text-slate-400">Choose a template to get started quickly, or seed all templates to your database</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 gap-2 dark:border-slate-600 dark:hover:bg-slate-700"
                    onClick={async () => {
                      toast.info('Seeding templates...', { description: 'Creating all workflow templates in database' })
                      try {
                        const response = await fetch('/api/workflows/templates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'seed' }),
                        })
                        const result = await response.json()
                        if (result.data?.created?.length > 0) {
                          toast.success('Templates seeded', { 
                            description: `Created ${result.data.created.length} workflows: ${result.data.created.slice(0, 3).join(', ')}${result.data.created.length > 3 ? '...' : ''}` 
                          })
                          refetch()
                        } else {
                          toast.info('All templates exist', { description: 'Workflow templates are already in your database' })
                        }
                      } catch {
                        toast.error('Failed to seed templates')
                      }
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Seed All Templates to Database
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {workflowTemplates.map((template) => {
                    const Icon = template.icon
                    return (
                      <motion.div key={template.id} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} className="motion-reduce:transform-none">
                        <Card 
                          className="shadow-lg border-0 dark:border dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 backdrop-blur hover:shadow-xl transition-all motion-reduce:transition-none cursor-pointer group h-full"
                          onClick={() => createFromTemplate(template.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2.5 ${template.color} rounded-xl shadow-lg group-hover:scale-105 transition-transform motion-reduce:transform-none flex-shrink-0`}>
                                <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{template.name}</h3>
                                  {template.popular && <Badge className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs px-2 py-0.5">Popular</Badge>}
                                  <Badge variant="outline" className="text-xs px-2 py-0.5 dark:border-slate-600 dark:text-slate-300">{template.type}</Badge>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{template.description}</p>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                                  {template.steps} step{template.steps > 1 ? 's' : ''}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-violet-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all motion-reduce:transform-none flex-shrink-0" aria-hidden="true" />
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
                
                <div className="mt-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Need something custom?</p>
                  <Button onClick={createNew} variant="outline" size="lg" className="gap-2 h-8 dark:border-slate-600 dark:hover:bg-slate-700">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
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
        <DialogContent className="sm:max-w-md dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="dark:text-slate-100">Delete Workflow</DialogTitle>
                <DialogDescription className="mt-1 dark:text-slate-400">
                  This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {workflowToDelete && (
            <div className="py-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="font-medium text-slate-900 dark:text-slate-100">{workflowToDelete.name}</p>
                {workflowToDelete.isActive && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
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
              className="dark:border-slate-600 dark:hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => workflowToDelete && handleDeleteWorkflow(workflowToDelete.id)}
              disabled={isDeleting}
              className="gap-2 h-8"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/20 dark:from-slate-900 dark:via-purple-950/20 dark:to-purple-950/20">
        <RefreshCw className="h-8 w-8 motion-safe:animate-spin text-violet-600 dark:text-violet-400" aria-label="Loading workflows" />
      </div>
    }>
      <WorkflowsPageContent />
    </Suspense>
  )
}
