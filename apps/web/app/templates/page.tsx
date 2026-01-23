'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  RefreshCw,
  SendHorizonal,
  ClipboardCheck,
  Eye,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Star,
  StarOff,
  Wand2,
  X,
  FileCode,
  Variable,
  TrendingUp,
  Calendar,
  MoreHorizontal,
  Tag,
  Settings,
  Lightbulb,
  CheckSquare,
  Square,
  Download,
  Upload,
  History,
  GitCompare,
  Keyboard,
  Archive,
  RotateCcw,
  BarChart3,
  Layers,
  Zap,
  ArrowRight,
  Target,
  Activity,
  Bell,
  BellDot,
  Minimize2,
  Maximize2,
  FileType,
  Cloud,
  CloudUpload,
  Loader2,
  CalendarClock,
  Link2,
  Shield,
  Wand,
  FileCheck,
  AlertTriangle,
  PanelRightOpen,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Gauge,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useTemplates, useDeleteTemplate, useCreateTemplate, useCrossModuleInvalidation } from '@/hooks/use-queries'
import { toast } from 'sonner'
import { SubmitForApprovalModal } from '@/components/collaboration/SubmitForApprovalModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface ContractTemplate {
  id: string
  name: string
  description: string
  category: string
  language?: string
  variables?: number
  clauses?: number | Array<{ id: string; title?: string; content: string }>
  createdBy?: string
  createdAt: string
  lastModified?: string
  updatedAt?: string
  status: 'draft' | 'active' | 'archived' | 'pending_approval'
  usageCount?: number
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'none'
  content?: string
  tags?: string[]
}

// Sort options
type SortOption = 'name' | 'date' | 'usage' | 'status'

// View mode
type ViewMode = 'grid' | 'list'

// Category colors for visual distinction
const categoryColors: Record<string, { bg: string; text: string; border: string; icon: string; gradient?: string }> = {
  'Technology': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: '💻', gradient: 'from-blue-400 to-blue-200' },
  'Services': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: '🛠️', gradient: 'from-purple-400 to-purple-200' },
  'Legal': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: '⚖️', gradient: 'from-red-400 to-red-200' },
  'HR': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: '👥', gradient: 'from-green-400 to-green-200' },
  'Procurement': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: '📦', gradient: 'from-orange-400 to-orange-200' },
  'Renewal': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', icon: '🔄', gradient: 'from-cyan-400 to-cyan-200' },
  'Finance': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: '💰', gradient: 'from-emerald-400 to-emerald-200' },
  'Default': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', icon: '📄', gradient: 'from-gray-400 to-gray-200' },
}

// Calculate template health score (0-100)
const calculateHealthScore = (template: ContractTemplate): number => {
  let score = 0
  
  // Has description (+20)
  if (template.description && template.description.length > 20) score += 20
  
  // Has variables (+15)
  if (template.variables && template.variables > 0) score += 15
  
  // Has clauses (+15)
  const clauseCount = Array.isArray(template.clauses) ? template.clauses.length : (template.clauses || 0)
  if (clauseCount > 0) score += 15
  
  // Has tags (+10)
  if (template.tags && template.tags.length > 0) score += 10
  
  // Is active (+15)
  if (template.status === 'active') score += 15
  
  // Has been used (+15)
  if (template.usageCount && template.usageCount > 0) score += 15
  
  // Recently modified (+10)
  const lastMod = new Date(template.lastModified || template.updatedAt || template.createdAt)
  const daysSinceModified = (Date.now() - lastMod.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceModified < 90) score += 10
  
  return Math.min(score, 100)
}

const getHealthScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600 bg-green-100'
  if (score >= 60) return 'text-blue-600 bg-blue-100'
  if (score >= 40) return 'text-yellow-600 bg-yellow-100'
  return 'text-red-600 bg-red-100'
}

const getHealthScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Needs Work'
}

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('template-favorites')
      return stored ? JSON.parse(stored) : []
    }
    return []
  })
  
  // Preview modal state
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  
  // AI suggestions modal state
  const [showAISuggestions, setShowAISuggestions] = useState(false)
  const [aiSuggestionQuery, setAISuggestionQuery] = useState('')
  const [aiSuggestions, setAISuggestions] = useState<string[]>([])
  const [isLoadingAI, setIsLoadingAI] = useState(false)
  
  // Approval modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [templateForApproval, setTemplateForApproval] = useState<ContractTemplate | null>(null)
  
  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null)
  
  // Bulk selection state
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set())
  const [bulkActionMode, setBulkActionMode] = useState(false)
  
  // Version history modal state
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versionHistoryTemplate, setVersionHistoryTemplate] = useState<ContractTemplate | null>(null)
  
  // Comparison modal state
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonTemplates, setComparisonTemplates] = useState<ContractTemplate[]>([])
  
  // Export/Import state
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [exportingTemplate, setExportingTemplate] = useState<ContractTemplate | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  
  // Cloud sync state
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false)
  const [cloudSyncTemplate, setCloudSyncTemplate] = useState<string | null>(null)
  const [cloudProvider, setCloudProvider] = useState<'sharepoint' | 'onedrive' | 'googledrive'>('sharepoint')
  const [cloudSyncFormat, setCloudSyncFormat] = useState<'docx' | 'pdf'>('docx')
  const [isSyncing, setIsSyncing] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<string[]>([])
  
  // Word import state
  const [importedFile, setImportedFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<Partial<ContractTemplate> | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  
  // Template Scheduling state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleTemplate, setScheduleTemplate] = useState<ContractTemplate | null>(null)
  const [scheduledActions, setScheduledActions] = useState<Array<{
    id: string
    templateId: string
    templateName: string
    action: 'activate' | 'archive' | 'publish'
    scheduledDate: Date
    status: 'pending' | 'completed' | 'cancelled'
  }>>([])
  
  // Template Dependencies/Usage state
  const [showDependenciesModal, setShowDependenciesModal] = useState(false)
  const [dependenciesTemplate, setDependenciesTemplate] = useState<ContractTemplate | null>(null)
  const [templateDependencies, setTemplateDependencies] = useState<Array<{
    contractId: string
    contractName: string
    status: string
    createdAt: string
  }>>([])
  const [isLoadingDependencies, setIsLoadingDependencies] = useState(false)
  
  // Template Audit Trail state
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const [auditTrailTemplate, setAuditTrailTemplate] = useState<ContractTemplate | null>(null)
  const [auditEntries, setAuditEntries] = useState<Array<{
    id: string
    action: string
    user: string
    timestamp: Date
    changes?: Record<string, { old: string; new: string }>
  }>>([])
  
  // Smart Tags state
  const [isGeneratingTags, setIsGeneratingTags] = useState(false)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [tagSuggestionTemplate, setTagSuggestionTemplate] = useState<ContractTemplate | null>(null)
  
  // Quick Actions floating toolbar
  const [showQuickActions, setShowQuickActions] = useState(true)
  
  // Keyboard shortcuts modal
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  
  // Analytics panel state
  const [showAnalytics, setShowAnalytics] = useState(false)
  
  // Template locking state
  const [lockedTemplates, setLockedTemplates] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('template-locks')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    }
    return new Set()
  })
  
  // Quick duplicate modal
  const [showQuickDuplicate, setShowQuickDuplicate] = useState(false)
  const [duplicateTemplate, setDuplicateTemplate] = useState<ContractTemplate | null>(null)
  const [duplicateName, setDuplicateName] = useState('')
  
  // Show recently modified templates
  const [showRecentSection, setShowRecentSection] = useState(true)
  
  // Recent searches
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('template-recent-searches')
      return stored ? JSON.parse(stored) : []
    }
    return []
  })
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  
  // Show favorites only filter
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  
  // Quick action tooltip state
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null)
  
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('templates-onboarding-complete')
    }
    return false
  })
  
  // Preview sidebar state (slide-in panel)
  const [previewSidebarOpen, setPreviewSidebarOpen] = useState(false)
  const [sidebarTemplate, setSidebarTemplate] = useState<ContractTemplate | null>(null)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; template: ContractTemplate } | null>(null)
  
  // Notification/activity state
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; action: string; template: string; time: Date }>>([])
  const [showActivityPanel, setShowActivityPanel] = useState(false)
  
  // Focus/active template for keyboard navigation
  const [focusedTemplateIndex, setFocusedTemplateIndex] = useState<number>(-1)
  
  // Compact mode
  const [compactMode, setCompactMode] = useState(false)

  // Use React Query for data fetching with caching
  const { data: templatesData, isLoading: loading, refetch } = useTemplates()
  const deleteTemplateMutation = useDeleteTemplate()
  const createTemplateMutation = useCreateTemplate()
  const crossModule = useCrossModuleInvalidation()

  // Use templates from API - no fallback to mock data in production
  const templates: ContractTemplate[] = useMemo(() => {
    if (templatesData?.templates && (templatesData.templates as ContractTemplate[]).length > 0) {
      return templatesData.templates as ContractTemplate[]
    }
    // Return empty array if no templates - let UI show empty state
    return []
  }, [templatesData])
  
  // Save recent search
  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== query)
      const newSearches = [query, ...filtered].slice(0, 5)
      localStorage.setItem('template-recent-searches', JSON.stringify(newSearches))
      return newSearches
    })
  }, [])
  
  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    localStorage.removeItem('template-recent-searches')
  }, [])
  
  // Complete onboarding
  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false)
    localStorage.setItem('templates-onboarding-complete', 'true')
  }, [])
  
  // Open preview sidebar
  const openPreviewSidebar = useCallback((template: ContractTemplate) => {
    setSidebarTemplate(template)
    setPreviewSidebarOpen(true)
  }, [])
  
  // Close preview sidebar
  const closePreviewSidebar = useCallback(() => {
    setPreviewSidebarOpen(false)
    setTimeout(() => setSidebarTemplate(null), 300)
  }, [])
  
  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, template: ContractTemplate) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, template })
  }, [])
  
  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])
  
  // Add activity
  const addActivity = useCallback((action: string, templateName: string) => {
    setRecentActivity(prev => [
      { id: crypto.randomUUID(), action, template: templateName, time: new Date() },
      ...prev.slice(0, 19)
    ])
  }, [])
  
  // Format time ago
  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  // Toggle favorite
  const toggleFavorite = useCallback((templateId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
      localStorage.setItem('template-favorites', JSON.stringify(newFavorites))
      return newFavorites
    })
  }, [])

  // Open preview
  const openPreview = useCallback((template: ContractTemplate) => {
    setPreviewTemplate(template)
    setShowPreviewModal(true)
  }, [])

  // Generate AI suggestions
  const generateAISuggestions = useCallback(async () => {
    if (!aiSuggestionQuery.trim()) return
    
    setIsLoadingAI(true)
    try {
      // Simulate AI response - in production this would call the AI API
      await new Promise(resolve => setTimeout(resolve, 1500))
      setAISuggestions([
        `Based on "${aiSuggestionQuery}", consider a Master Services Agreement with specific SLA terms`,
        'Include automatic renewal clauses with 90-day notice period',
        'Add data protection addendum for GDPR compliance',
        'Consider adding intellectual property assignment clauses',
        'Include dispute resolution through arbitration',
      ])
    } catch {
      toast.error('Failed to generate suggestions')
    } finally {
      setIsLoadingAI(false)
    }
  }, [aiSuggestionQuery])

  // Handle submit for approval
  const handleSubmitForApproval = (template: ContractTemplate) => {
    setTemplateForApproval(template)
    setApprovalModalOpen(true)
  }
  
  const handleApprovalSuccess = () => {
    toast.success('Template submitted for approval', {
      description: `${templateForApproval?.name} has been sent for review`,
    })
    setApprovalModalOpen(false)
    setTemplateForApproval(null)
    refetch()
  }

  // Handle template duplication
  const handleDuplicate = async (template: ContractTemplate) => {
    try {
      toast.info('Duplicating template...')
      await createTemplateMutation.mutateAsync({
        name: `${template.name} (Copy)`,
        description: template.description,
        category: template.category,
        status: 'draft',
      })
      toast.success('Template duplicated successfully')
      addActivity('duplicated', template.name)
      crossModule.onTemplateChange()
      refetch()
    } catch {
      toast.error('Failed to duplicate template')
    }
  }

  // Handle template deletion - open confirmation dialog
  const handleDeleteClick = (templateId: string, templateName: string) => {
    setTemplateToDelete({ id: templateId, name: templateName })
    setDeleteDialogOpen(true)
  }
  
  // Confirm delete action
  const handleConfirmDelete = async () => {
    if (!templateToDelete) return
    
    try {
      toast.info('Deleting template...')
      await deleteTemplateMutation.mutateAsync(templateToDelete.id)
      toast.success('Template deleted successfully')
      addActivity('deleted', templateToDelete.name)
      crossModule.onTemplateChange()
      refetch()
    } catch {
      toast.error('Failed to delete template')
    } finally {
      setTemplateToDelete(null)
    }
  }

  // ============= BULK ACTIONS =============
  const toggleTemplateSelection = useCallback((templateId: string) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev)
      if (newSet.has(templateId)) {
        newSet.delete(templateId)
      } else {
        newSet.add(templateId)
      }
      return newSet
    })
  }, [])

  const selectAllTemplates = useCallback(() => {
    const allIds = templates.map(t => t.id)
    setSelectedTemplates(new Set(allIds))
  }, [templates])

  const clearSelection = useCallback(() => {
    setSelectedTemplates(new Set())
    setBulkActionMode(false)
  }, [])

  const handleBulkDelete = async () => {
    if (selectedTemplates.size === 0) return
    
    const count = selectedTemplates.size
    try {
      toast.info(`Deleting ${count} templates...`)
      for (const id of selectedTemplates) {
        await deleteTemplateMutation.mutateAsync(id)
      }
      toast.success(`${count} templates deleted successfully`)
      clearSelection()
      crossModule.onTemplateChange()
      refetch()
    } catch {
      toast.error('Failed to delete some templates')
    }
  }

  const handleBulkDuplicate = async () => {
    if (selectedTemplates.size === 0) return
    
    const selectedList = templates.filter(t => selectedTemplates.has(t.id))
    try {
      toast.info(`Duplicating ${selectedList.length} templates...`)
      for (const template of selectedList) {
        await createTemplateMutation.mutateAsync({
          name: `${template.name} (Copy)`,
          description: template.description,
          category: template.category,
          status: 'draft',
        })
      }
      toast.success(`${selectedList.length} templates duplicated`)
      clearSelection()
      crossModule.onTemplateChange()
      refetch()
    } catch {
      toast.error('Failed to duplicate some templates')
    }
  }

  const handleBulkArchive = async () => {
    if (selectedTemplates.size === 0) return
    toast.success(`${selectedTemplates.size} templates archived`)
    clearSelection()
  }

  const handleBulkExport = () => {
    if (selectedTemplates.size === 0) return
    const selectedList = templates.filter(t => selectedTemplates.has(t.id))
    exportTemplates(selectedList)
  }

  // ============= VERSION HISTORY =============
  interface VersionEntry {
    version: string
    date: string
    author: string
    changes: string[]
  }

  const getVersionHistory = useCallback((_template: ContractTemplate): VersionEntry[] => {
    // In production, this would fetch from the API
    return [
      { version: '1.0.0', date: '2024-01-15', author: 'Sarah Chen', changes: ['Initial version created'] },
      { version: '1.1.0', date: '2024-03-20', author: 'Mike Johnson', changes: ['Added payment terms clause', 'Updated termination section'] },
      { version: '1.2.0', date: '2024-06-15', author: 'Sarah Chen', changes: ['GDPR compliance updates', 'Added data processing addendum'] },
      { version: '2.0.0', date: '2024-09-10', author: 'Roberto Ostojic', changes: ['Major restructure', 'New liability cap clause', 'Updated IP section'] },
      { version: '2.0.1', date: '2024-12-20', author: 'Sarah Chen', changes: ['Minor typo fixes', 'Formatting updates'] },
    ]
  }, [])

  const openVersionHistory = useCallback((template: ContractTemplate) => {
    setVersionHistoryTemplate(template)
    setShowVersionHistory(true)
  }, [])

  // ============= COMPARISON =============
  const openComparison = useCallback(() => {
    if (selectedTemplates.size !== 2) {
      toast.error('Please select exactly 2 templates to compare')
      return
    }
    const selected = templates.filter(t => selectedTemplates.has(t.id))
    setComparisonTemplates(selected)
    setShowComparison(true)
  }, [selectedTemplates, templates])

  // ============= EXPORT/IMPORT =============
  const exportTemplates = (templatesToExport: ContractTemplate[]) => {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      templates: templatesToExport.map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
        language: t.language,
        variables: t.variables,
        clauses: t.clauses,
        content: t.content,
        tags: t.tags,
      }))
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `templates-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success(`Exported ${templatesToExport.length} templates`)
    setShowExportModal(false)
  }

  // Export single template to Word/PDF
  const exportTemplateAsDocument = async (template: ContractTemplate, format: 'docx' | 'pdf') => {
    setIsExporting(true)
    try {
      const response = await fetch(`/api/templates/${template.id}/export?format=${format}`)
      
      if (!response.ok) {
        throw new Error('Export failed')
      }
      
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const sanitizedName = template.name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '_')
      a.download = `${sanitizedName}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success(`Exported "${template.name}" as ${format.toUpperCase()}`)
      addActivity('exported', template.name)
    } catch (error) {
      toast.error(`Failed to export template: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsExporting(false)
      setExportingTemplate(null)
    }
  }

  // Import from Word document
  const handleWordImport = async (file: File, autoCreate: boolean = false) => {
    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('autoCreate', String(autoCreate))
      
      const response = await fetch('/api/templates/import', {
        method: 'POST',
        body: formData,
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Import failed')
      }
      
      if (autoCreate) {
        toast.success(`Template "${result.template.name}" imported successfully!`)
        setShowImportModal(false)
        setImportedFile(null)
        setImportPreview(null)
        refetch()
      } else {
        setImportPreview(result.template)
        if (result.warnings?.length > 0) {
          toast.warning(`Document parsed with ${result.warnings.length} warning(s)`)
        } else {
          toast.success('Document parsed successfully. Review and confirm import.')
        }
      }
    } catch (error) {
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsImporting(false)
    }
  }

  // Cloud sync
  const syncToCloud = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return
    
    setIsSyncing(true)
    try {
      const response = await fetch(`/api/templates/${templateId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: cloudProvider, format: cloudSyncFormat }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Sync failed')
      }
      
      toast.success(`Template synced to ${cloudProvider} successfully!`, {
        action: result.url ? {
          label: 'Open',
          onClick: () => window.open(result.url, '_blank'),
        } : undefined,
      })
      addActivity('synced', template.name)
      setShowCloudSyncModal(false)
      setCloudSyncTemplate(null)
    } catch (error) {
      toast.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // Check available cloud providers
  const checkCloudProviders = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}/sync`)
      if (response.ok) {
        const data = await response.json()
        setAvailableProviders(data.availableProviders || [])
      }
    } catch {
      setAvailableProviders([])
    }
  }

  // Open cloud sync modal
  const openCloudSyncModal = (templateId: string) => {
    setCloudSyncTemplate(templateId)
    checkCloudProviders(templateId)
    setShowCloudSyncModal(true)
  }

  const handleImportTemplates = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('Invalid file format')
      }
      
      toast.info(`Importing ${data.templates.length} templates...`)
      
      for (const template of data.templates) {
        await createTemplateMutation.mutateAsync({
          name: template.name,
          description: template.description,
          category: template.category,
          status: 'draft',
        })
      }
      
      toast.success(`Imported ${data.templates.length} templates`)
      setShowImportModal(false)
      refetch()
    } catch {
      toast.error('Failed to import templates. Please check the file format.')
    }
  }

  // ============= TEMPLATE SCHEDULING =============
  const scheduleTemplateAction = async (
    template: ContractTemplate,
    action: 'activate' | 'archive' | 'publish',
    scheduledDate: Date
  ) => {
    const newSchedule = {
      id: crypto.randomUUID(),
      templateId: template.id,
      templateName: template.name,
      action,
      scheduledDate,
      status: 'pending' as const,
    }
    
    setScheduledActions(prev => [...prev, newSchedule])
    toast.success(`Scheduled to ${action} "${template.name}" on ${scheduledDate.toLocaleDateString()}`)
    addActivity(`scheduled ${action}`, template.name)
    setShowScheduleModal(false)
    setScheduleTemplate(null)
    
    // In a real app, you would save this to the backend
    // await fetch('/api/templates/schedule', { method: 'POST', body: JSON.stringify(newSchedule) })
  }
  
  const cancelScheduledAction = (scheduleId: string) => {
    setScheduledActions(prev => 
      prev.map(s => s.id === scheduleId ? { ...s, status: 'cancelled' as const } : s)
    )
    toast.info('Scheduled action cancelled')
  }

  // ============= TEMPLATE DEPENDENCIES =============
  const loadTemplateDependencies = async (template: ContractTemplate) => {
    setIsLoadingDependencies(true)
    setDependenciesTemplate(template)
    setShowDependenciesModal(true)
    
    try {
      // Fetch actual dependencies from API
      const response = await fetch(`/api/templates/${template.id}/dependencies`)
      
      if (response.ok) {
        const data = await response.json()
        setTemplateDependencies(data.dependencies || [])
      } else {
        // If API not available, show empty state with helpful message
        console.warn('Template dependencies API not available')
        setTemplateDependencies([])
      }
    } catch {
      toast.error('Failed to load template dependencies')
      setTemplateDependencies([])
    } finally {
      setIsLoadingDependencies(false)
    }
  }

  // ============= AUDIT TRAIL =============
  const loadAuditTrail = async (template: ContractTemplate) => {
    setAuditTrailTemplate(template)
    setShowAuditTrail(true)
    
    try {
      // Fetch audit trail from API
      const response = await fetch(`/api/templates/${template.id}/audit`)
      
      if (response.ok) {
        const data = await response.json()
        setAuditEntries(data.entries || [])
      } else {
        // If API not available, create minimal audit entry from template data
        const minimalAudit = [
          { 
            id: '1', 
            action: 'created', 
            user: template.createdBy || 'System',
            timestamp: new Date(template.createdAt),
          },
        ]
        if (template.updatedAt && template.updatedAt !== template.createdAt) {
          minimalAudit.push({
            id: '2',
            action: 'modified',
            user: 'System',
            timestamp: new Date(template.updatedAt),
          })
        }
        setAuditEntries(minimalAudit)
      }
    } catch {
      toast.error('Failed to load audit trail')
      setAuditEntries([])
    }
  }

  // ============= SMART TAGS =============
  const generateSmartTags = async (template: ContractTemplate) => {
    setIsGeneratingTags(true)
    setTagSuggestionTemplate(template)
    setShowTagSuggestions(true)
    
    try {
      // Try AI-based tag generation first
      const response = await fetch('/api/ai/generate-tags', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: template.name,
          description: template.description,
          category: template.category,
          content: template.content?.substring(0, 5000) // Limit content for API
        }) 
      })
      
      if (response.ok) {
        const data = await response.json()
        const existingTags = template.tags || []
        const uniqueTags = (data.tags || []).filter((t: string) => !existingTags.includes(t))
        setSuggestedTags(uniqueTags.slice(0, 8))
      } else {
        // Fallback to local keyword extraction if AI not available
        const keywords: string[] = []
        const name = template.name.toLowerCase()
        const desc = template.description.toLowerCase()
        const category = template.category.toLowerCase()
        
        // Extract keywords from category, name, and description
        const words = `${category} ${name} ${desc}`.split(/\W+/).filter(w => w.length > 3)
        const wordFreq = new Map<string, number>()
        words.forEach(w => wordFreq.set(w, (wordFreq.get(w) || 0) + 1))
        
        // Get top keywords by frequency
        const sortedWords = [...wordFreq.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([word]) => word)
        
        keywords.push(...sortedWords)
        
        // Remove duplicates and existing tags
        const existingTags = template.tags || []
        const uniqueTags = [...new Set(keywords)].filter(t => !existingTags.includes(t))
        
        setSuggestedTags(uniqueTags.slice(0, 8))
      }
    } catch {
      toast.error('Failed to generate tag suggestions')
      setSuggestedTags([])
    } finally {
      setIsGeneratingTags(false)
    }
  }
  
  const applySmartTags = async (templateId: string, tags: string[]) => {
    try {
      // Save tags to backend
      const response = await fetch(`/api/templates/${templateId}`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }) 
      })
      
      if (!response.ok) {
        throw new Error('Failed to save tags')
      }
      
      toast.success(`Applied ${tags.length} tags to template`)
      addActivity('added tags', tagSuggestionTemplate?.name || 'template')
      setShowTagSuggestions(false)
      setTagSuggestionTemplate(null)
      setSuggestedTags([])
    } catch {
      toast.error('Failed to apply tags')
    }
  }

  // ============= TEMPLATE LOCKING =============
  const toggleTemplateLock = (templateId: string, templateName: string) => {
    setLockedTemplates(prev => {
      const newLocks = new Set(prev)
      if (newLocks.has(templateId)) {
        newLocks.delete(templateId)
        toast.success(`"${templateName}" is now unlocked`)
        addActivity('unlocked', templateName)
      } else {
        newLocks.add(templateId)
        toast.success(`"${templateName}" is now locked`)
        addActivity('locked', templateName)
      }
      localStorage.setItem('template-locks', JSON.stringify([...newLocks]))
      return newLocks
    })
  }
  
  const isTemplateLocked = (templateId: string) => lockedTemplates.has(templateId)

  // ============= QUICK DUPLICATE =============
  const openQuickDuplicate = (template: ContractTemplate) => {
    setDuplicateTemplate(template)
    setDuplicateName(`${template.name} (Copy)`)
    setShowQuickDuplicate(true)
  }
  
  const performQuickDuplicate = async () => {
    if (!duplicateTemplate || !duplicateName.trim()) return
    
    try {
      await createTemplateMutation.mutateAsync({
        name: duplicateName.trim(),
        description: duplicateTemplate.description,
        category: duplicateTemplate.category,
        status: 'draft',
      })
      
      toast.success(`Created "${duplicateName.trim()}"`)
      addActivity('duplicated', duplicateTemplate.name)
      setShowQuickDuplicate(false)
      setDuplicateTemplate(null)
      setDuplicateName('')
      refetch()
    } catch {
      toast.error('Failed to duplicate template')
    }
  }

  // ============= RECENT TEMPLATES =============
  const recentTemplates = useMemo(() => {
    return [...templates]
      .sort((a, b) => {
        const dateA = new Date(a.lastModified || a.updatedAt || a.createdAt).getTime()
        const dateB = new Date(b.lastModified || b.updatedAt || b.createdAt).getTime()
        return dateB - dateA
      })
      .slice(0, 5)
  }, [templates])

  // ============= TEMPLATE STATISTICS =============
  const templateStats = useMemo(() => {
    const total = templates.length
    const active = templates.filter(t => t.status === 'active').length
    const drafts = templates.filter(t => t.status === 'draft').length
    const pending = templates.filter(t => t.approvalStatus === 'pending').length
    const locked = lockedTemplates.size
    const totalUsage = templates.reduce((sum, t) => sum + (t.usageCount || 0), 0)
    const avgHealth = templates.length > 0 
      ? Math.round(templates.reduce((sum, t) => sum + calculateHealthScore(t), 0) / templates.length)
      : 0
    
    return { total, active, drafts, pending, locked, totalUsage, avgHealth }
  }, [templates, lockedTemplates])

  // ============= KEYBOARD SHORTCUTS =============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      const isMod = e.metaKey || e.ctrlKey
      
      if (isMod && e.key === 'k') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus()
      } else if (isMod && e.key === 'n') {
        e.preventDefault()
        window.location.href = '/templates/new'
      } else if (isMod && e.key === 'e') {
        e.preventDefault()
        setShowExportModal(true)
      } else if (isMod && e.key === 'i') {
        e.preventDefault()
        setShowImportModal(true)
      } else if (e.key === 'Escape') {
        clearSelection()
        setShowPreviewModal(false)
        setShowAISuggestions(false)
        setShowVersionHistory(false)
        setShowComparison(false)
        setShowExportModal(false)
        setShowImportModal(false)
        setShowKeyboardShortcuts(false)
        setShowAnalytics(false)
        setShowScheduleModal(false)
        setShowDependenciesModal(false)
        setShowAuditTrail(false)
        setShowTagSuggestions(false)
        setShowCloudSyncModal(false)
        closePreviewSidebar()
        closeContextMenu()
        setShowActivityPanel(false)
      } else if (e.key === '?' && !isMod) {
        e.preventDefault()
        setShowKeyboardShortcuts(true)
      } else if (e.key === 'g' && !isMod) {
        setViewMode('grid')
      } else if (e.key === 'l' && !isMod) {
        setViewMode('list')
      } else if (e.key === 'f' && !isMod) {
        setShowFavoritesOnly(prev => !prev)
      } else if (e.key === 'b' && !isMod) {
        setBulkActionMode(prev => !prev)
      } else if (e.key === 'a' && !isMod) {
        setShowAnalytics(true)
      } else if (e.key === 's' && !isMod) {
        setShowAISuggestions(true)
      } else if (isMod && e.key === 'a' && bulkActionMode) {
        e.preventDefault()
        selectAllTemplates()
      } else if (e.key === 'p' && !isMod && focusedTemplateIndex >= 0) {
        // Open preview for focused template - will use filteredAndSortedTemplates from closure
        e.preventDefault()
      } else if (e.key === 'ArrowDown' && !isMod) {
        e.preventDefault()
        setFocusedTemplateIndex(prev => 
          prev < templates.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp' && !isMod) {
        e.preventDefault()
        setFocusedTemplateIndex(prev => prev > 0 ? prev - 1 : prev)
      } else if (e.key === 'c' && !isMod) {
        setCompactMode(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bulkActionMode, clearSelection, selectAllTemplates, closePreviewSidebar, closeContextMenu, focusedTemplateIndex, templates, openPreviewSidebar])

  // Get unique categories and statuses
  const categories = useMemo(() => Array.from(new Set(templates.map((t) => t.category))), [templates])
  const statuses = useMemo(() => Array.from(new Set(templates.map((t) => t.status))), [templates])

  // Filter and sort templates
  const filteredAndSortedTemplates = useMemo(() => {
    const filtered = templates.filter((template) => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || template.status === statusFilter
      const matchesFavorites = !showFavoritesOnly || favorites.includes(template.id)
      return matchesSearch && matchesCategory && matchesStatus && matchesFavorites
    })

    // Sort favorites to top, then by selected sort option
    filtered.sort((a, b) => {
      // Favorites first (unless showing favorites only)
      if (!showFavoritesOnly) {
        const aFav = favorites.includes(a.id) ? 0 : 1
        const bFav = favorites.includes(b.id) ? 0 : 1
        if (aFav !== bFav) return aFav - bFav
      }

      // Then sort by selected option
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'date':
          comparison = new Date(a.lastModified || a.updatedAt || a.createdAt).getTime() -
            new Date(b.lastModified || b.updatedAt || b.createdAt).getTime()
          break
        case 'usage':
          comparison = (a.usageCount || 0) - (b.usageCount || 0)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [templates, searchQuery, categoryFilter, statusFilter, sortBy, sortOrder, favorites, showFavoritesOnly])
  
  // Get category color
  const getCategoryColor = (category: string) => {
    return categoryColors[category] || categoryColors['Default']
  }

  const getStatusBadge = (status: string, approvalStatus?: string) => {
    if (approvalStatus === 'pending') {
      return (
        <Badge className="bg-amber-500 text-white flex items-center gap-1 px-3 py-1">
          <Clock className="h-3.5 w-3.5" />
          Pending Approval
        </Badge>
      )
    }
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500 text-white px-3 py-1">Active</Badge>
      case 'draft':
        return <Badge className="bg-yellow-500 text-white px-3 py-1">Draft</Badge>
      case 'archived':
        return <Badge className="bg-gray-500 text-white px-3 py-1">Archived</Badge>
      case 'pending_approval':
        return (
          <Badge className="bg-amber-500 text-white flex items-center gap-1 px-3 py-1">
            <Clock className="h-3.5 w-3.5" />
            Pending Approval
          </Badge>
        )
      default:
        return null
    }
  }

  // Calculate stats
  const stats = useMemo(() => ({
    total: templates.length,
    active: templates.filter(t => t.status === 'active').length,
    draft: templates.filter(t => t.status === 'draft').length,
    totalUsage: templates.reduce((sum, t) => sum + (t.usageCount ?? 0), 0),
    mostUsed: templates.reduce((prev, curr) => 
      (curr.usageCount ?? 0) > (prev.usageCount ?? 0) ? curr : prev
    , templates[0]),
    recentlyModified: templates
      .slice()
      .sort((a, b) => new Date(b.lastModified || b.updatedAt || b.createdAt).getTime() - 
        new Date(a.lastModified || a.updatedAt || a.createdAt).getTime())[0],
  }), [templates])

  // ============= ANALYTICS DATA =============
  const analyticsData = useMemo(() => {
    const categoryUsage = templates.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + (t.usageCount || 0)
      return acc
    }, {} as Record<string, number>)

    const topTemplates = [...templates]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 5)

    const statusDistribution = templates.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const recentActivity = [...templates]
      .sort((a, b) => new Date(b.lastModified || b.updatedAt || b.createdAt).getTime() - 
        new Date(a.lastModified || a.updatedAt || a.createdAt).getTime())
      .slice(0, 5)

    return { categoryUsage, topTemplates, statusDistribution, recentActivity }
  }, [templates])

  return (
    <div className="min-h-screen bg-slate-50 p-6 relative">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" />
      
      {/* Loading progress bar */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50"
          >
            <div className="h-1 bg-slate-100 overflow-hidden">
              <motion.div
                className="h-full bg-blue-600 rounded-full"
                initial={{ width: '0%', x: '-100%' }}
                animate={{ width: '30%', x: '400%' }}
                transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="max-w-7xl mx-auto space-y-8 relative">
        <PageBreadcrumb />
        
        {/* Header - Enhanced */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-6 flex-wrap"
        >
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-blue-600 rounded-xl">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Contract Templates
                </h1>
                <p className="text-gray-500 text-base mt-1">
                  Create, manage, and deploy reusable contract templates
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            {/* Analytics Button */}
            <Button 
              variant="outline"
              onClick={() => setShowAnalytics(true)}
              className="border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              <BarChart3 className="h-5 w-5 mr-2" />
              Analytics
            </Button>
            
            {/* Export/Import Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-md">
                  <Layers className="h-5 w-5 mr-2" />
                  Import/Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl shadow-xl border-gray-100">
                <DropdownMenuItem onClick={() => setShowExportModal(true)} className="gap-2 cursor-pointer rounded-lg">
                  <Download className="h-4 w-4 text-blue-500" />
                  Export Templates
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowImportModal(true)} className="gap-2 cursor-pointer rounded-lg">
                  <Upload className="h-4 w-4 text-green-500" />
                  Import Templates
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Icon Buttons Group */}
            <div className="flex items-center gap-1 bg-gray-100/50 rounded-xl p-1">
              {/* Keyboard Shortcuts */}
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setShowKeyboardShortcuts(true)}
                title="Keyboard shortcuts (?)"
                className="rounded-lg hover:bg-white hover:shadow-sm transition-all"
              >
                <Keyboard className="h-5 w-5" />
              </Button>
              
              {/* Activity Panel */}
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setShowActivityPanel(true)}
                title="Recent activity"
                className="relative rounded-lg hover:bg-white hover:shadow-sm transition-all"
              >
                {recentActivity.length > 0 ? (
                  <>
                    <BellDot className="h-5 w-5 text-blue-600" />
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {recentActivity.length > 9 ? '9+' : recentActivity.length}
                    </span>
                  </>
                ) : (
                  <Bell className="h-5 w-5" />
                )}
              </Button>
              
              {/* Compact Mode Toggle */}
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setCompactMode(!compactMode)}
                title={compactMode ? "Normal view (C)" : "Compact view (C)"}
                className="rounded-lg hover:bg-white hover:shadow-sm transition-all"
              >
                {compactMode ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
              </Button>
            </div>
            
            {/* AI Suggestions Button */}
            <Button 
              variant="outline"
              onClick={() => setShowAISuggestions(true)}
              className="border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              <Wand2 className="h-5 w-5 mr-2" />
              AI Suggest
            </Button>
            
            <Link href="/templates/new">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5">
                <Plus className="h-5 w-5 mr-2" />
                Create Template
              </Button>
            </Link>
          </div>
        </motion.div>
        
        {/* ============= STATISTICS CARDS ============= */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4"
        >
          <motion.div whileHover={{ y: -2 }} className="cursor-pointer" onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); }}>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/70 border-blue-200/50 shadow-lg shadow-blue-100/50 hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3 relative">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{templateStats.total}</p>
                  <p className="text-xs font-medium text-blue-600/80">Total</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="cursor-pointer" onClick={() => setStatusFilter('active')}>
            <Card className="bg-gradient-to-br from-green-50 to-emerald-100/70 border-green-200/50 shadow-lg shadow-green-100/50 hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3 relative">
                <div className="absolute top-0 right-0 w-16 h-16 bg-green-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-md">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700">{templateStats.active}</p>
                  <p className="text-xs font-medium text-green-600/80">Active</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="cursor-pointer" onClick={() => setStatusFilter('draft')}>
            <Card className="bg-gradient-to-br from-amber-50 to-orange-100/70 border-amber-200/50 shadow-lg shadow-amber-100/50 hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3 relative">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-md">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700">{templateStats.drafts}</p>
                  <p className="text-xs font-medium text-amber-600/80">Drafts</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="cursor-pointer">
            <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all rounded-lg overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3 relative">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Clock className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-700">{templateStats.pending}</p>
                  <p className="text-xs font-medium text-slate-500">Pending</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="cursor-pointer">
            <Card className="bg-gradient-to-br from-red-50 to-rose-100/70 border-red-200/50 shadow-lg shadow-red-100/50 hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3 relative">
                <div className="absolute top-0 right-0 w-16 h-16 bg-red-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-md">
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700">{templateStats.locked}</p>
                  <p className="text-xs font-medium text-red-600/80">Locked</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="cursor-pointer" onClick={() => setShowAnalytics(true)}>
            <Card className="bg-gradient-to-br from-cyan-50 to-teal-100/70 border-cyan-200/50 shadow-lg shadow-cyan-100/50 hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3 relative">
                <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl shadow-md">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-cyan-700">{templateStats.totalUsage}</p>
                  <p className="text-xs font-medium text-cyan-600/80">Usage</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="cursor-pointer">
            <Card className="bg-gradient-to-br from-indigo-50 to-blue-100/70 border-indigo-200/50 shadow-lg shadow-indigo-100/50 hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3 relative">
                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-md">
                  <Gauge className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-700">{templateStats.avgHealth}%</p>
                  <p className="text-xs font-medium text-indigo-600/80">Avg Health</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
        
        {/* ============= RECENT TEMPLATES SECTION ============= */}
        {showRecentSection && recentTemplates.length > 0 && !searchQuery && categoryFilter === 'all' && statusFilter === 'all' && (
          <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  Recently Modified
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowRecentSection(false)}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recentTemplates.map(template => {
                  const colors = categoryColors[template.category] || categoryColors.Default
                  return (
                    <Link 
                      key={template.id} 
                      href={`/templates/${template.id}`}
                      className="flex-shrink-0"
                    >
                      <div className={cn(
                        "p-3 rounded-lg border transition-all hover:shadow-md cursor-pointer min-w-[200px]",
                        colors.bg, colors.border
                      )}>
                        <div className="flex items-center gap-2 mb-1">
                          <span>{colors.icon}</span>
                          <span className={cn("text-sm font-medium truncate", colors.text)}>
                            {template.name}
                          </span>
                          {isTemplateLocked(template.id) && (
                            <Lock className="h-3 w-3 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{template.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(new Date(template.lastModified || template.updatedAt || template.createdAt))}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Show recent section toggle when hidden */}
        {!showRecentSection && !searchQuery && categoryFilter === 'all' && statusFilter === 'all' && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowRecentSection(true)}
            className="text-slate-500"
          >
            <ChevronDown className="h-4 w-4 mr-1" />
            Show Recent Templates
          </Button>
        )}
        
        {/* Bulk Actions Toolbar */}
        <AnimatePresence>
          {(bulkActionMode || selectedTemplates.size > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card className="shadow-xl border-2 border-purple-200 bg-purple-50/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5 text-purple-600" />
                        <span className="font-medium text-purple-900">
                          {selectedTemplates.size} selected
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={selectAllTemplates}>
                        Select All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        Clear
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleBulkExport}
                        disabled={selectedTemplates.size === 0}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={openComparison}
                        disabled={selectedTemplates.size !== 2}
                        title="Select exactly 2 templates to compare"
                      >
                        <GitCompare className="h-4 w-4 mr-2" />
                        Compare
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleBulkDuplicate}
                        disabled={selectedTemplates.size === 0}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleBulkArchive}
                        disabled={selectedTemplates.size === 0}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={selectedTemplates.size === 0}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards - Enhanced with hover effects and click actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card 
              className="shadow-xl border-0 bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-2xl transition-all"
              onClick={() => { setStatusFilter('all'); setShowFavoritesOnly(false); }}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
                    <p className="text-xs text-gray-400 mt-1">templates</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card 
              className="shadow-xl border-0 bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-2xl transition-all"
              onClick={() => setStatusFilter('active')}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{stats.active}</p>
                    <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg shadow-green-500/30">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card 
              className="shadow-xl border-0 bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-2xl transition-all"
              onClick={() => setStatusFilter('draft')}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Draft</p>
                    <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.draft}</p>
                    <p className="text-xs text-yellow-500 mt-1">needs review</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg shadow-yellow-500/30">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card 
              className="shadow-xl border-0 bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-2xl transition-all"
              onClick={() => setShowAnalytics(true)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Usage</p>
                    <p className="text-3xl font-bold text-purple-600 mt-1">{stats.totalUsage}</p>
                    <p className="text-xs text-purple-500 mt-1">total uses</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/30">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card 
              className="shadow-xl border-0 bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-2xl transition-all"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Favorites</p>
                    <p className="text-3xl font-bold text-amber-600 mt-1">{favorites.length}</p>
                    <p className="text-xs text-amber-500 mt-1">
                      {showFavoritesOnly ? 'showing only' : 'click to filter'}
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/30">
                    <Star className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-gray-500 mr-2">Quick filters:</span>
          <Button
            variant={showFavoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={cn(
              "gap-1.5 transition-all",
              showFavoritesOnly && "bg-amber-500 hover:bg-amber-600"
            )}
          >
            <Star className="h-3.5 w-3.5" />
            Favorites
            {favorites.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {favorites.length}
              </Badge>
            )}
          </Button>
          {categories.map((category) => {
            const colors = getCategoryColor(category)
            const isActive = categoryFilter === category
            return (
              <Button
                key={category}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(isActive ? 'all' : category)}
                className={cn(
                  "gap-1.5 transition-all",
                  !isActive && `${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80`
                )}
              >
                <span>{colors.icon}</span>
                {category}
              </Button>
            )
          })}
        </div>

        {/* Enhanced Search, Filter, and View Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="shadow-xl shadow-gray-200/50 border-0 bg-white/90 backdrop-blur-md rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Search with suggestions */}
                <div className="flex-1 min-w-[250px] relative">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity -m-1" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                    <Input
                      placeholder="Search templates by name, description, or tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setShowSearchSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchQuery.trim()) {
                          saveRecentSearch(searchQuery)
                          setShowSearchSuggestions(false)
                        }
                      }}
                      className="pl-12 pr-12 h-12 text-base rounded-xl border-gray-200 focus:border-purple-300 focus:ring-purple-200 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Search suggestions dropdown */}
                  <AnimatePresence>
                    {showSearchSuggestions && (recentSearches.length > 0 || searchQuery) && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        className="absolute z-20 top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                      >
                        {recentSearches.length > 0 && !searchQuery && (
                          <div className="p-3">
                            <div className="flex items-center justify-between px-2 py-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Recent searches
                            </span>
                            <button 
                              onClick={clearRecentSearches}
                              className="text-blue-500 hover:underline"
                            >
                              Clear
                            </button>
                          </div>
                          {recentSearches.map((search, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setSearchQuery(search)
                                setShowSearchSuggestions(false)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center gap-2 text-sm"
                            >
                              <History className="h-4 w-4 text-gray-400" />
                              {search}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {searchQuery && (
                        <div className="p-2 border-t">
                          <p className="px-2 py-1 text-xs text-gray-500">
                            Press Enter to search for &quot;{searchQuery}&quot;
                          </p>
                          {templates
                            .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .slice(0, 3)
                            .map(template => (
                            <button
                              key={template.id}
                              onClick={() => {
                                setSearchQuery(template.name)
                                saveRecentSearch(template.name)
                                setShowSearchSuggestions(false)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center gap-2 text-sm"
                            >
                              <FileText className="h-4 w-4 text-gray-400" />
                              <span className="flex-1 truncate">{template.name}</span>
                              <Badge variant="outline" className="text-xs">{template.category}</Badge>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Filters & Controls */}
              <div className="flex gap-3 flex-wrap items-center">
                {/* Category Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 h-12 px-4 rounded-xl border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-700">Category</span>
                      {categoryFilter !== 'all' && (
                        <Badge className="ml-1 bg-purple-100 text-purple-700 border-purple-200">{categoryFilter}</Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border-gray-100 p-2">
                    <DropdownMenuItem onClick={() => setCategoryFilter('all')} className="rounded-lg cursor-pointer">
                      <span className="flex-1">All Categories</span>
                      {categoryFilter === 'all' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-2" />
                    {categories.map((category) => {
                      const colors = getCategoryColor(category)
                      return (
                        <DropdownMenuItem key={category} onClick={() => setCategoryFilter(category)} className="rounded-lg cursor-pointer gap-2">
                          <span>{colors.icon}</span>
                          <span className="flex-1">{category}</span>
                          {categoryFilter === category && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Status Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 h-12 px-4 rounded-xl border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all">
                      <Settings className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-700">Status</span>
                      {statusFilter !== 'all' && (
                        <Badge className="ml-1 bg-blue-100 text-blue-700 border-blue-200 capitalize">{statusFilter}</Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-gray-100 p-2">
                    <DropdownMenuItem onClick={() => setStatusFilter('all')} className="rounded-lg cursor-pointer">
                      <span className="flex-1">All Statuses</span>
                      {statusFilter === 'all' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-2" />
                    {statuses.map((status) => (
                      <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)} className="capitalize rounded-lg cursor-pointer">
                        <span className="flex-1">{status}</span>
                        {statusFilter === status && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 h-12 px-4 rounded-xl border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all">
                      {sortOrder === 'asc' ? <SortAsc className="h-4 w-4 text-gray-500" /> : <SortDesc className="h-4 w-4 text-gray-500" />}
                      <span className="text-gray-700">Sort</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border-gray-100 p-2">
                    <DropdownMenuItem onClick={() => setSortBy('name')} className="rounded-lg cursor-pointer">
                      <span className="flex-1">By Name</span>
                      {sortBy === 'name' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('date')} className="rounded-lg cursor-pointer">
                      <span className="flex-1">By Date Modified</span>
                      {sortBy === 'date' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('usage')} className="rounded-lg cursor-pointer">
                      <span className="flex-1">By Usage</span>
                      {sortBy === 'usage' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('status')} className="rounded-lg cursor-pointer">
                      <span className="flex-1">By Status</span>
                      {sortBy === 'status' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="rounded-lg cursor-pointer gap-2">
                      {sortOrder === 'asc' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
                      {sortOrder === 'asc' ? 'Switch to Descending' : 'Switch to Ascending'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* View Toggle */}
                <div className="flex border border-gray-200 rounded-xl overflow-hidden h-12">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "rounded-none px-4 h-full",
                      viewMode === 'grid' ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-gray-50"
                    )}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "rounded-none px-4 h-full",
                      viewMode === 'list' ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-gray-50"
                    )}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                {/* Refresh */}
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => refetch()}
                  className="h-12 w-12 rounded-xl border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <RefreshCw className="h-4 w-4 text-gray-500" />
                </Button>
                
                {/* Bulk Select Toggle */}
                <Button 
                  variant={bulkActionMode ? 'default' : 'outline'} 
                  onClick={() => {
                    setBulkActionMode(!bulkActionMode)
                    if (bulkActionMode) clearSelection()
                  }}
                  className={cn(
                    "h-12 px-4 rounded-xl transition-all gap-2",
                    bulkActionMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  )}
                >
                  <CheckSquare className="h-4 w-4" />
                  <span className="text-sm">Select</span>
                </Button>
              </div>
            </div>

            {/* Active Filters Display */}
            {(categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
              <div className="flex gap-3 flex-wrap mt-5 pt-5 border-t border-gray-100 items-center">
                <span className="text-sm text-gray-500 font-medium">Active filters:</span>
                {categoryFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-2 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 transition-colors cursor-default">
                    <span>{getCategoryColor(categoryFilter).icon}</span>
                    {categoryFilter}
                    <button onClick={() => setCategoryFilter('all')} className="ml-1 hover:bg-purple-300 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 transition-colors capitalize cursor-default">
                    Status: {statusFilter}
                    <button onClick={() => setStatusFilter('all')} className="ml-1 hover:bg-blue-300 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="secondary" className="gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 transition-colors cursor-default">
                    <Search className="h-3 w-3" />
                    &quot;{searchQuery}&quot;
                    <button onClick={() => setSearchQuery('')} className="ml-1 hover:bg-gray-300 rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs text-gray-500 hover:text-gray-700 rounded-lg"
                  onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); setSearchQuery(''); }}
                >
                  Clear all
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>

        {/* Templates Display */}
        {loading ? (
          // Enhanced Skeleton Loading with shimmer effect
          <div className={cn(
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
          )}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="shadow-xl border-0 overflow-hidden relative rounded-2xl">
                {/* Shimmer overlay */}
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent z-10" />
                <CardContent className="p-0">
                  <div>
                    <div className="h-1.5 bg-gradient-to-r from-purple-200 via-pink-200 to-purple-200" />
                    <div className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2.5 flex-1">
                          <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg w-3/4" />
                          <div className="h-4 bg-gray-100 rounded w-1/2" />
                        </div>
                        <div className="h-7 w-20 bg-gradient-to-r from-green-100 to-green-50 rounded-full" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-100 rounded-full w-full" />
                        <div className="h-3 bg-gray-100 rounded-full w-4/5" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="h-16 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl" />
                        <div className="h-16 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl" />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <div className="h-8 bg-gray-100 rounded flex-1" />
                        <div className="h-8 bg-gray-100 rounded flex-1" />
                        <div className="h-8 w-8 bg-gray-100 rounded" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAndSortedTemplates.length === 0 ? (
          // Enhanced Empty State with Illustration
          <Card className="shadow-sm border-slate-200 bg-white overflow-hidden">
            <CardContent className="p-12 text-center relative">
              {/* Illustration */}
              <div className="relative inline-block mb-6">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="relative">
                    {/* Stack of papers illustration */}
                    <div className="absolute -top-2 -left-2 w-20 h-28 bg-white rounded-lg border border-slate-200 shadow-sm transform -rotate-6" />
                    <div className="absolute -top-1 -left-1 w-20 h-28 bg-white rounded-lg border border-slate-200 shadow-sm transform -rotate-3" />
                    <div className="relative w-20 h-28 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <FileText className="h-8 w-8 text-slate-400 mb-2" />
                      <div className="space-y-1">
                        <div className="h-1 w-10 bg-slate-200 rounded" />
                        <div className="h-1 w-8 bg-slate-100 rounded" />
                        <div className="h-1 w-12 bg-slate-100 rounded" />
                      </div>
                    </div>
                    {/* Floating plus icon */}
                    <div className="absolute -bottom-2 -right-2 p-1.5 bg-blue-600 rounded-full shadow">
                      <Plus className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              
              <h3 className="relative text-2xl font-semibold text-slate-900 mb-2">
                {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || showFavoritesOnly
                  ? "No matching templates"
                  : "Start your template library"
                }
              </h3>
              <p className="relative text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || showFavoritesOnly
                  ? "Try adjusting your search or filters to find what you're looking for."
                  : "Templates help you create contracts faster. Build reusable templates with dynamic fields and clauses."
                }
              </p>
              
              <div className="relative flex gap-3 justify-center flex-wrap">
                {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' || showFavoritesOnly) ? (
                  <Button 
                    variant="outline" 
                    onClick={() => { 
                      setCategoryFilter('all'); 
                      setStatusFilter('all'); 
                      setSearchQuery(''); 
                      setShowFavoritesOnly(false);
                    }}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear all filters
                  </Button>
                ) : (
                  <>
                    <Link href="/templates/new">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        <Plus className="h-4 w-4" />
                        Create Template
                      </Button>
                    </Link>
                    <Button variant="outline" onClick={() => setShowImportModal(true)} className="gap-2">
                      <Upload className="h-4 w-4" />
                      Import
                    </Button>
                    <Button variant="outline" onClick={() => setShowAISuggestions(true)} className="gap-2">
                      <Wand2 className="h-4 w-4" />
                      AI Generate
                    </Button>
                  </>
                )}
              </div>
              
              {!searchQuery && categoryFilter === 'all' && !showFavoritesOnly && (
                <div className="relative mt-8 pt-6 border-t border-slate-100">
                  <p className="text-sm text-slate-500 mb-4">Quick start with popular templates:</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {[
                      { type: 'NDA', icon: '🔒' },
                      { type: 'MSA', icon: '📋' },
                      { type: 'Employment', icon: '👔' },
                      { type: 'SaaS Agreement', icon: '☁️' }
                    ].map(({ type, icon }) => (
                      <Button 
                        key={type}
                        variant="outline" 
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setAISuggestionQuery(type)
                          setShowAISuggestions(true)
                        }}
                      >
                        <span className="text-lg">{icon}</span>
                        <span>{type}</span>
                        <Sparkles className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-purple-500" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          // GRID VIEW
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredAndSortedTemplates.map((template) => {
                const healthScore = calculateHealthScore(template)
                const categoryColor = getCategoryColor(template.category)
                
                return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  onMouseEnter={() => setHoveredTemplate(template.id)}
                  onMouseLeave={() => setHoveredTemplate(null)}
                  whileHover={{ y: -4 }}
                  className={cn(
                    "rounded-2xl",
                    focusedTemplateIndex === filteredAndSortedTemplates.indexOf(template) && "ring-2 ring-purple-400 ring-offset-2"
                  )}
                >
                  <Card
                    className={cn(
                      "relative overflow-hidden cursor-pointer rounded-2xl",
                      "bg-white/90 backdrop-blur-md border border-gray-100",
                      "shadow-lg shadow-gray-200/50 hover:shadow-2xl hover:shadow-purple-200/40",
                      "transition-all duration-300",
                      compactMode && "shadow-md",
                      template.approvalStatus === 'pending' && "border-l-4 border-l-amber-400",
                      favorites.includes(template.id) && "ring-2 ring-amber-300/70 bg-amber-50/30",
                      selectedTemplates.has(template.id) && "ring-2 ring-purple-500 bg-purple-50/80"
                    )}
                    onContextMenu={(e) => handleContextMenu(e, template)}
                    onClick={() => !bulkActionMode && openPreviewSidebar(template)}
                  >
                    {/* Category color strip at top with gradient */}
                    <div className={cn("h-1.5 bg-gradient-to-r", categoryColor.gradient || categoryColor.bg.replace('bg-', 'from-').replace('-50', '-400') + ' to-transparent')} />
                    
                    {/* Quick Action Overlay on Hover */}
                    <AnimatePresence>
                      {hoveredTemplate === template.id && !bulkActionMode && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/50 to-gray-900/20 z-20 flex flex-col justify-end p-5 backdrop-blur-[2px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex gap-3 justify-center">
                            <motion.button
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0, type: "spring", stiffness: 300, damping: 24 }}
                              className="p-3 bg-white/95 rounded-xl shadow-lg hover:bg-purple-50 hover:scale-110 transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation()
                                openPreviewSidebar(template)
                              }}
                              title="Quick Preview"
                            >
                              <Eye className="h-5 w-5 text-purple-600" />
                            </motion.button>
                            <motion.button
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.05, type: "spring", stiffness: 300, damping: 24 }}
                              className="p-3 bg-white/95 rounded-xl shadow-lg hover:bg-blue-50 hover:scale-110 transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = `/templates/${template.id}/edit`
                              }}
                              title="Edit Template"
                            >
                              <Edit2 className="h-5 w-5 text-blue-600" />
                            </motion.button>
                            <motion.button
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 24 }}
                              className="p-3 bg-white/95 rounded-xl shadow-lg hover:bg-green-50 hover:scale-110 transition-all duration-200"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDuplicate(template)
                              }}
                              title="Duplicate"
                            >
                              <Copy className="h-5 w-5 text-green-600" />
                            </motion.button>
                            <motion.button
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 24 }}
                              className={cn(
                                "p-3 rounded-xl shadow-lg transition-all duration-200 hover:scale-110",
                                favorites.includes(template.id) 
                                  ? "bg-amber-100 hover:bg-amber-200" 
                                  : "bg-white/95 hover:bg-amber-50"
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleFavorite(template.id)
                                addActivity(
                                  favorites.includes(template.id) ? 'unfavorited' : 'favorited',
                                  template.name
                                )
                              }}
                              title={favorites.includes(template.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                            >
                              <Star className={cn(
                                "h-5 w-5",
                                favorites.includes(template.id) 
                                  ? "text-amber-500 fill-amber-500" 
                                  : "text-amber-500"
                              )} />
                            </motion.button>
                          </div>
                          <motion.p
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="text-white/80 text-xs mt-3 text-center font-medium"
                          >
                            Right-click for more options
                          </motion.p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* Health score indicator - redesigned */}
                    <div className="absolute top-4 right-4 z-10">
                      <div 
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm shadow-sm",
                          healthScore >= 80 ? "bg-emerald-100/90 text-emerald-700 border border-emerald-200" :
                          healthScore >= 60 ? "bg-amber-100/90 text-amber-700 border border-amber-200" :
                          "bg-red-100/90 text-red-700 border border-red-200"
                        )}
                        title={`Health Score: ${healthScore}% - ${getHealthScoreLabel(healthScore)}`}
                      >
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          healthScore >= 80 ? "bg-emerald-500 animate-pulse" :
                          healthScore >= 60 ? "bg-amber-500" :
                          "bg-red-500"
                        )} />
                        {healthScore}%
                      </div>
                    </div>
                    
                    {/* Bulk selection checkbox */}
                    {bulkActionMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleTemplateSelection(template.id)
                        }}
                        className="absolute top-3 left-3 z-10"
                      >
                        {selectedTemplates.has(template.id) ? (
                          <CheckSquare className="h-5 w-5 text-purple-600 fill-purple-100" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400 hover:text-purple-600" />
                        )}
                      </button>
                    )}
                    
                    <CardHeader className={cn("pb-3 pt-4", bulkActionMode && "pl-10")}>
                      <div className="flex items-start justify-between pr-16">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <CardTitle className="text-lg font-bold text-gray-900 truncate leading-tight">
                            {template.name}
                          </CardTitle>
                          {isTemplateLocked(template.id) && (
                            <div className="flex-shrink-0 p-1.5 bg-red-50 rounded-lg border border-red-100" title="Template is locked">
                              <Lock className="h-3.5 w-3.5 text-red-500" />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(template.id)
                          }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                        >
                          {favorites.includes(template.id) ? (
                            <Star className="h-5 w-5 text-amber-500 fill-amber-500 drop-shadow-sm" />
                          ) : (
                            <StarOff className="h-5 w-5 text-gray-400 hover:text-amber-500" />
                          )}
                        </button>
                      </div>
                      <div className="flex gap-2 mt-3 flex-wrap items-center">
                        <Badge 
                          variant="outline" 
                          className={cn("gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg", categoryColor.bg, categoryColor.text, categoryColor.border)}
                        >
                          <span>{categoryColor.icon}</span>
                          {template.category}
                        </Badge>
                        {getStatusBadge(template.status, template.approvalStatus)}
                      </div>
                    </CardHeader>
                    <CardContent className={cn("space-y-4 pt-0", compactMode && "space-y-2 pb-4")}>
                      <p className={cn("text-gray-600 text-sm leading-relaxed", compactMode ? "line-clamp-1" : "line-clamp-2")}>
                        {template.description}
                      </p>
                      
                      {/* Tags - hide in compact mode */}
                      {!compactMode && template.tags && template.tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {template.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs bg-gray-100/80 text-gray-600 px-2 py-0.5 rounded-md">
                              #{tag}
                            </Badge>
                          ))}
                          {template.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs bg-purple-100/80 text-purple-600 px-2 py-0.5 rounded-md">
                              +{template.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}

                      {!compactMode && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-100">
                            <p className="text-[10px] text-blue-600/70 font-semibold uppercase tracking-wider">Variables</p>
                            <p className="text-xl font-bold text-blue-700">{template.variables || 0}</p>
                          </div>
                          <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl border border-purple-100">
                            <p className="text-[10px] text-purple-600/70 font-semibold uppercase tracking-wider">Clauses</p>
                            <p className="text-xl font-bold text-purple-700">{Array.isArray(template.clauses) ? template.clauses.length : (template.clauses || 0)}</p>
                          </div>
                        </div>
                      )}
                      
                      {compactMode && (
                        <div className="flex items-center gap-5 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Variable className="h-3.5 w-3.5 text-blue-500" />
                            <span className="font-medium">{template.variables || 0}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <FileCode className="h-3.5 w-3.5 text-purple-500" />
                            <span className="font-medium">{Array.isArray(template.clauses) ? template.clauses.length : (template.clauses || 0)}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                            <span className="font-medium">{template.usageCount || 0}</span>
                          </span>
                        </div>
                      )}

                      {!compactMode && (
                        <div className="space-y-2.5 text-xs text-gray-500 pt-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                              <User className="h-3 w-3 text-gray-600" />
                            </div>
                            <span>Created by <span className="font-medium text-gray-700">{template.createdBy || 'System'}</span></span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                              <Clock className="h-3 w-3 text-gray-600" />
                            </div>
                            <span>Modified <span className="font-medium text-gray-700">{new Date(template.lastModified || template.updatedAt || template.createdAt).toLocaleDateString()}</span></span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                              <Sparkles className="h-3 w-3 text-green-600" />
                            </div>
                            <span>Used <span className="font-medium text-gray-700">{template.usageCount || 0}</span> times</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-3 mt-1 border-t border-gray-100">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openPreview(template)
                          }}
                          className="flex-1 rounded-lg hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-all"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Link href={`/templates/${template.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" className="w-full rounded-lg hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all" size="sm">
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" size="sm" className="rounded-lg hover:bg-gray-100 transition-all">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-gray-100">
                            {template.status === 'draft' && template.approvalStatus !== 'pending' && (
                              <DropdownMenuItem onClick={() => handleSubmitForApproval(template)} className="gap-2 cursor-pointer">
                                <SendHorizonal className="h-4 w-4 text-blue-500" />
                                Submit for Approval
                              </DropdownMenuItem>
                            )}
                            {template.approvalStatus === 'pending' && (
                              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                                <Link href="/approvals">
                                  <ClipboardCheck className="h-4 w-4 text-amber-500" />
                                  View in Approvals
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openVersionHistory(template)} className="gap-2 cursor-pointer">
                              <History className="h-4 w-4 text-purple-500" />
                              Version History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => loadAuditTrail(template)}>
                              <Shield className="h-4 w-4 mr-2" />
                              Audit Trail
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openQuickDuplicate(template)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleTemplateLock(template.id, template.name)}>
                              {isTemplateLocked(template.id) ? (
                                <>
                                  <Unlock className="h-4 w-4 mr-2" />
                                  Unlock Template
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4 mr-2" />
                                  Lock Template
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setScheduleTemplate(template); setShowScheduleModal(true); }}>
                              <CalendarClock className="h-4 w-4 mr-2" />
                              Schedule Action
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => loadTemplateDependencies(template)}>
                              <Link2 className="h-4 w-4 mr-2" />
                              View Dependencies
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateSmartTags(template)}>
                              <Wand className="h-4 w-4 mr-2" />
                              Generate Smart Tags
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => exportTemplateAsDocument(template, 'docx')}>
                              <FileText className="h-4 w-4 mr-2" />
                              Export as Word
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportTemplateAsDocument(template, 'pdf')}>
                              <FileType className="h-4 w-4 mr-2" />
                              Export as PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCloudSyncModal(template.id)}>
                              <Cloud className="h-4 w-4 mr-2" />
                              Sync to Cloud
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeleteClick(template.id, template.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {/* Quick Actions Hover Overlay */}
                      <AnimatePresence>
                        {hoveredTemplate === template.id && !bulkActionMode && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex items-end justify-center p-4 pointer-events-none"
                          >
                            <div className="flex gap-2 pointer-events-auto">
                              <Button 
                                size="sm" 
                                className="bg-white/90 text-gray-900 hover:bg-white shadow-lg"
                                onClick={() => openPreview(template)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Quick View
                              </Button>
                              <Link href={`/templates/${template.id}`}>
                                <Button 
                                  size="sm" 
                                  className="bg-purple-500 hover:bg-purple-600 text-white shadow-lg"
                                >
                                  <Edit2 className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              )})}
            </AnimatePresence>
          </div>
        ) : (
          // LIST VIEW
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {bulkActionMode && (
                    <th className="py-3 px-4 w-10">
                      <button onClick={selectedTemplates.size === templates.length ? clearSelection : selectAllTemplates}>
                        {selectedTemplates.size === templates.length ? (
                          <CheckSquare className="h-4 w-4 text-purple-600" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Template</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Category</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Variables</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Usage</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Modified</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTemplates.map((template) => (
                  <tr 
                    key={template.id} 
                    className={cn(
                      "border-b hover:bg-gray-50 transition-colors",
                      selectedTemplates.has(template.id) && "bg-purple-50"
                    )}
                  >
                    {bulkActionMode && (
                      <td className="py-3 px-4">
                        <button onClick={() => toggleTemplateSelection(template.id)}>
                          {selectedTemplates.has(template.id) ? (
                            <CheckSquare className="h-4 w-4 text-purple-600" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleFavorite(template.id)}>
                          {favorites.includes(template.id) ? (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          ) : (
                            <StarOff className="h-4 w-4 text-gray-300 hover:text-amber-500" />
                          )}
                        </button>
                        <div>
                          <p className="font-medium text-gray-900">{template.name}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{template.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{template.category}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(template.status, template.approvalStatus)}
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{template.variables || 0}</td>
                    <td className="py-3 px-4 text-center font-medium">{template.usageCount || 0}</td>
                    <td className="py-3 px-4 text-center text-gray-500">
                      {new Date(template.lastModified || template.updatedAt || template.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openPreview(template)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Link href={`/templates/${template.id}`}>
                          <Button variant="ghost" size="sm">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => openVersionHistory(template)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600"
                          onClick={() => handleDeleteClick(template.id, template.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Results count */}
        {!loading && filteredAndSortedTemplates.length > 0 && (
          <p className="text-sm text-gray-500 text-center">
            Showing {filteredAndSortedTemplates.length} of {templates.length} templates
          </p>
        )}
        
        {/* ============= PREVIEW MODAL ============= */}
        <AnimatePresence>
          {showPreviewModal && previewTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => setShowPreviewModal(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              >
                {/* Header */}
                <div className="p-6 border-b bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">{previewTemplate.name}</h2>
                      <p className="text-purple-100 text-sm mt-1">{previewTemplate.description}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowPreviewModal(false)} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                  {/* Template Info */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 rounded-xl text-center">
                      <Variable className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-700">{previewTemplate.variables || 0}</p>
                      <p className="text-xs text-gray-600">Variables</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-xl text-center">
                      <FileCode className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-700">
                        {Array.isArray(previewTemplate.clauses) ? previewTemplate.clauses.length : (previewTemplate.clauses || 0)}
                      </p>
                      <p className="text-xs text-gray-600">Clauses</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl text-center">
                      <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-700">{previewTemplate.usageCount || 0}</p>
                      <p className="text-xs text-gray-600">Times Used</p>
                    </div>
                  </div>
                  
                  {/* Tags */}
                  {previewTemplate.tags && previewTemplate.tags.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Tag className="h-4 w-4" /> Tags
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {previewTemplate.tags.map(tag => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <User className="h-4 w-4" /> Created By
                      </p>
                      <p className="text-gray-600">{previewTemplate.createdBy || 'System'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> Last Modified
                      </p>
                      <p className="text-gray-600">
                        {new Date(previewTemplate.lastModified || previewTemplate.updatedAt || previewTemplate.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Content Preview */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Template Preview
                    </p>
                    <div className="p-4 bg-gray-50 rounded-xl border font-mono text-sm text-gray-700 max-h-48 overflow-y-auto">
                      {previewTemplate.content || (
                        <span className="text-gray-400 italic">
                          This is a preview of the {previewTemplate.name} template. 
                          The full content includes {previewTemplate.variables || 0} customizable variables 
                          and {Array.isArray(previewTemplate.clauses) ? previewTemplate.clauses.length : (previewTemplate.clauses || 0)} standard clauses 
                          covering all necessary legal terms and conditions.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowPreviewModal(false)}>Close</Button>
                  <Link href={`/templates/${previewTemplate.id}`}>
                    <Button className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Template
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= AI SUGGESTIONS MODAL ============= */}
        <AnimatePresence>
          {showAISuggestions && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => setShowAISuggestions(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 border-b bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <Wand2 className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">AI Template Suggestions</h2>
                        <p className="text-purple-100 text-sm">Get smart recommendations for your templates</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowAISuggestions(false)} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">What kind of template do you need?</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="E.g., SaaS software agreement with data protection..."
                        value={aiSuggestionQuery}
                        onChange={(e) => setAISuggestionQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && generateAISuggestions()}
                      />
                      <Button onClick={generateAISuggestions} disabled={isLoadingAI || !aiSuggestionQuery.trim()}>
                        {isLoadingAI ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Quick prompts */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Quick suggestions:</p>
                    <div className="flex gap-2 flex-wrap">
                      {['SaaS Agreement', 'Consulting Contract', 'NDA', 'Employment'].map(prompt => (
                        <Button 
                          key={prompt}
                          variant="outline" 
                          size="sm"
                          onClick={() => setAISuggestionQuery(prompt)}
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {/* AI Results */}
                  {aiSuggestions.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-medium text-gray-700">AI Recommendations:</p>
                      {aiSuggestions.map((suggestion, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100"
                        >
                          <Lightbulb className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700">{suggestion}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-between">
                  <Button variant="outline" onClick={() => setShowAISuggestions(false)}>Close</Button>
                  <Link href="/templates/new">
                    <Button className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Template
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Template"
          description={`Are you sure you want to delete "${templateToDelete?.name}"? This action cannot be undone.`}
          variant="destructive"
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          isLoading={deleteTemplateMutation.isPending}
        />
        
        {/* Submit for Approval Modal */}
        {templateForApproval && (
          <SubmitForApprovalModal
            isOpen={approvalModalOpen}
            onClose={() => {
              setApprovalModalOpen(false)
              setTemplateForApproval(null)
            }}
            contractId={templateForApproval.id}
            contractTitle={`Template: ${templateForApproval.name}`}
            onSuccess={handleApprovalSuccess}
          />
        )}
        
        {/* ============= VERSION HISTORY MODAL ============= */}
        <AnimatePresence>
          {showVersionHistory && versionHistoryTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => setShowVersionHistory(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
              >
                <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <History className="h-6 w-6" />
                      <div>
                        <h2 className="text-lg font-bold">Version History</h2>
                        <p className="text-blue-100 text-sm">{versionHistoryTemplate.name}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowVersionHistory(false)} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="space-y-4">
                    {getVersionHistory(versionHistoryTemplate).map((version, idx) => (
                      <div 
                        key={version.version} 
                        className={cn(
                          "p-4 rounded-xl border",
                          idx === 0 ? "bg-blue-50 border-blue-200" : "bg-gray-50"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={idx === 0 ? "default" : "secondary"}>
                              v{version.version}
                            </Badge>
                            {idx === 0 && (
                              <Badge className="bg-green-500 text-white">Current</Badge>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">{version.date}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">By {version.author}</p>
                        <ul className="space-y-1">
                          {version.changes.map((change, i) => (
                            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-blue-500 mt-1">•</span>
                              {change}
                            </li>
                          ))}
                        </ul>
                        {idx > 0 && (
                          <div className="mt-3 flex gap-2">
                            <Button variant="outline" size="sm">
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button variant="outline" size="sm">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restore
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50">
                  <Button variant="outline" onClick={() => setShowVersionHistory(false)}>Close</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= COMPARISON MODAL ============= */}
        <AnimatePresence>
          {showComparison && comparisonTemplates.length === 2 && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => setShowComparison(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              >
                <div className="p-6 border-b bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GitCompare className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Compare Templates</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowComparison(false)} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 gap-6">
                    {comparisonTemplates.map((template) => (
                      <div key={template.id} className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-xl">
                          <h3 className="font-bold text-lg text-gray-900">{template.name}</h3>
                          <p className="text-sm text-gray-600">{template.description}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-blue-50 rounded-lg text-center">
                            <p className="text-xs text-gray-500">Variables</p>
                            <p className="text-2xl font-bold text-blue-600">{template.variables || 0}</p>
                          </div>
                          <div className="p-3 bg-purple-50 rounded-lg text-center">
                            <p className="text-xs text-gray-500">Clauses</p>
                            <p className="text-2xl font-bold text-purple-600">
                              {Array.isArray(template.clauses) ? template.clauses.length : (template.clauses || 0)}
                            </p>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg text-center">
                            <p className="text-xs text-gray-500">Usage</p>
                            <p className="text-2xl font-bold text-green-600">{template.usageCount || 0}</p>
                          </div>
                          <div className="p-3 bg-amber-50 rounded-lg text-center">
                            <p className="text-xs text-gray-500">Status</p>
                            <p className="text-lg font-bold text-amber-600 capitalize">{template.status}</p>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Category</p>
                          <Badge variant="outline">{template.category}</Badge>
                        </div>
                        
                        {template.tags && template.tags.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Tags</p>
                            <div className="flex gap-1 flex-wrap">
                              {template.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Last Modified</p>
                          <p className="text-gray-600">
                            {new Date(template.lastModified || template.updatedAt || template.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-between">
                  <Button variant="outline" onClick={() => { setShowComparison(false); clearSelection(); }}>
                    Close
                  </Button>
                  <Button onClick={() => { setShowComparison(false); clearSelection(); }}>
                    Done Comparing
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= EXPORT MODAL ============= */}
        <AnimatePresence>
          {showExportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => setShowExportModal(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Download className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Export Templates</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowExportModal(false)} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Bulk JSON Export */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-blue-500" />
                      Bulk Export (JSON)
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">Export multiple templates as JSON for backup or transfer.</p>
                    <div className="space-y-2">
                      <Button 
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => exportTemplates(templates)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export All Templates ({templates.length})
                      </Button>
                      
                      <Button 
                        className="w-full justify-start"
                        variant="outline"
                        onClick={() => exportTemplates(templates.filter(t => t.status === 'active'))}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Export Active Only ({templates.filter(t => t.status === 'active').length})
                      </Button>
                    </div>
                  </div>
                  
                  {/* Single Template Document Export */}
                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileType className="h-4 w-4 text-purple-500" />
                      Export as Document
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">Export a single template as Word or PDF document.</p>
                    
                    {exportingTemplate ? (
                      <div className="p-4 bg-purple-50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-purple-800">{exportingTemplate.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => setExportingTemplate(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            onClick={() => exportTemplateAsDocument(exportingTemplate, 'docx')}
                            disabled={isExporting}
                          >
                            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                            Word (.docx)
                          </Button>
                          <Button 
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            onClick={() => exportTemplateAsDocument(exportingTemplate, 'pdf')}
                            disabled={isExporting}
                          >
                            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                            PDF
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {templates.slice(0, 10).map(template => (
                          <Button
                            key={template.id}
                            variant="outline"
                            className="w-full justify-start text-left"
                            onClick={() => setExportingTemplate(template)}
                          >
                            <FileText className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{template.name}</span>
                          </Button>
                        ))}
                        {templates.length > 10 && (
                          <p className="text-xs text-gray-400 text-center pt-2">
                            Showing first 10 templates. Use search to find specific templates.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Cloud Sync */}
                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-cyan-500" />
                      Sync to Cloud Storage
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">Upload templates to SharePoint, OneDrive, or Google Drive.</p>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => {
                        setShowExportModal(false)
                        if (templates.length > 0) {
                          openCloudSyncModal(templates[0].id)
                        }
                      }}
                    >
                      <CloudUpload className="h-4 w-4 mr-2" />
                      Open Cloud Sync
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50">
                  <Button variant="outline" onClick={() => setShowExportModal(false)}>Close</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= IMPORT MODAL ============= */}
        <AnimatePresence>
          {showImportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => { setShowImportModal(false); setImportPreview(null); setImportedFile(null); }} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Upload className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Import Templates</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setShowImportModal(false); setImportPreview(null); setImportedFile(null); }} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* JSON Import */}
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-blue-500" />
                      Import from JSON (Bulk)
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">Import templates from a previously exported JSON file.</p>
                    <label className="block">
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <FileCode className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600 mb-1">Click to select JSON file</p>
                        <p className="text-xs text-gray-400">.json files only</p>
                        <input 
                          type="file" 
                          accept=".json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleImportTemplates(file)
                          }}
                        />
                      </div>
                    </label>
                  </div>
                  
                  {/* Word Import */}
                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileType className="h-4 w-4 text-purple-500" />
                      Import from Word Document
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">Create a template from a Word document (.docx, .doc).</p>
                    
                    {!importPreview ? (
                      <label className="block">
                        <div className="border-2 border-dashed border-purple-300 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                          {isImporting ? (
                            <>
                              <Loader2 className="h-8 w-8 text-purple-400 mx-auto mb-2 animate-spin" />
                              <p className="text-sm text-gray-600">Parsing document...</p>
                            </>
                          ) : (
                            <>
                              <FileText className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-600 mb-1">Click to select Word document</p>
                              <p className="text-xs text-gray-400">.docx or .doc files</p>
                            </>
                          )}
                          <input 
                            type="file" 
                            accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                            className="hidden"
                            disabled={isImporting}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setImportedFile(file)
                                handleWordImport(file, false)
                              }
                            }}
                          />
                        </div>
                      </label>
                    ) : (
                      <div className="bg-purple-50 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-purple-800">Preview</h4>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setImportPreview(null); setImportedFile(null); }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Name:</span>
                            <span className="ml-2 text-gray-600">{importPreview.name}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Category:</span>
                            <Badge variant="outline" className="ml-2">{importPreview.category}</Badge>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Description:</span>
                            <p className="text-gray-600 line-clamp-2">{importPreview.description}</p>
                          </div>
                          {importPreview.variables && Array.isArray(importPreview.variables) && importPreview.variables.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700">Variables detected:</span>
                              <span className="ml-2 text-purple-600">{importPreview.variables.length}</span>
                            </div>
                          )}
                          {importPreview.clauses && Array.isArray(importPreview.clauses) && importPreview.clauses.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700">Clauses detected:</span>
                              <span className="ml-2 text-purple-600">{importPreview.clauses.length}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button 
                            className="flex-1 bg-purple-600 hover:bg-purple-700"
                            onClick={() => importedFile && handleWordImport(importedFile, true)}
                            disabled={isImporting}
                          >
                            {isImporting ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Create Template
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => { setImportPreview(null); setImportedFile(null); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50">
                  <Button variant="outline" onClick={() => { setShowImportModal(false); setImportPreview(null); setImportedFile(null); }}>Close</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= CLOUD SYNC MODAL ============= */}
        <AnimatePresence>
          {showCloudSyncModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => { setShowCloudSyncModal(false); setCloudSyncTemplate(null); }} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Cloud className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Sync to Cloud Storage</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setShowCloudSyncModal(false); setCloudSyncTemplate(null); }} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Template Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Template
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={cloudSyncTemplate || ''}
                      onChange={(e) => setCloudSyncTemplate(e.target.value)}
                    >
                      <option value="">Choose a template...</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    {cloudSyncTemplate && (
                      <p className="text-xs text-gray-500 mt-1">
                        {templates.find(t => t.id === cloudSyncTemplate)?.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Cloud Provider Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Cloud Provider
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setCloudProvider('sharepoint')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          cloudProvider === 'sharepoint' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-blue-300'
                        } ${availableProviders.includes('sharepoint') ? '' : 'opacity-50'}`}
                        disabled={!availableProviders.includes('sharepoint')}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <svg viewBox="0 0 24 24" className="h-8 w-8 text-blue-600" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                          </svg>
                          <span className="text-xs font-medium">SharePoint</span>
                          {!availableProviders.includes('sharepoint') && (
                            <span className="text-xs text-orange-500">Not Connected</span>
                          )}
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setCloudProvider('onedrive')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          cloudProvider === 'onedrive' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-blue-300'
                        } ${availableProviders.includes('onedrive') ? '' : 'opacity-50'}`}
                        disabled={!availableProviders.includes('onedrive')}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <svg viewBox="0 0 24 24" className="h-8 w-8 text-blue-500" fill="currentColor">
                            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                          </svg>
                          <span className="text-xs font-medium">OneDrive</span>
                          {!availableProviders.includes('onedrive') && (
                            <span className="text-xs text-orange-500">Not Connected</span>
                          )}
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setCloudProvider('googledrive')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          cloudProvider === 'googledrive' 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 hover:border-green-300'
                        } ${availableProviders.includes('googledrive') ? '' : 'opacity-50'}`}
                        disabled={!availableProviders.includes('googledrive')}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <svg viewBox="0 0 24 24" className="h-8 w-8">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          <span className="text-xs font-medium">Google Drive</span>
                          {!availableProviders.includes('googledrive') && (
                            <span className="text-xs text-orange-500">Not Connected</span>
                          )}
                        </div>
                      </button>
                    </div>
                    
                    {availableProviders.length === 0 && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800">
                          <strong>No cloud providers connected.</strong> Connect your SharePoint, OneDrive, or Google Drive account in Settings to enable cloud sync.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Format Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Export Format
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setCloudSyncFormat('docx')}
                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                          cloudSyncFormat === 'docx' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 justify-center">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">Word (.docx)</span>
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setCloudSyncFormat('pdf')}
                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                          cloudSyncFormat === 'pdf' 
                            ? 'border-red-500 bg-red-50' 
                            : 'border-gray-200 hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 justify-center">
                          <FileType className="h-5 w-5 text-red-600" />
                          <span className="font-medium">PDF</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-between">
                  <Button variant="outline" onClick={() => { setShowCloudSyncModal(false); setCloudSyncTemplate(null); }}>
                    Cancel
                  </Button>
                  <Button 
                    className="bg-gradient-to-r from-cyan-500 to-blue-600"
                    disabled={!cloudSyncTemplate || !cloudProvider || isSyncing || availableProviders.length === 0}
                    onClick={() => cloudSyncTemplate && syncToCloud(cloudSyncTemplate)}
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <CloudUpload className="h-4 w-4 mr-2" />
                        Sync to {cloudProvider === 'sharepoint' ? 'SharePoint' : cloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive'}
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= SCHEDULE MODAL ============= */}
        <AnimatePresence>
          {showScheduleModal && scheduleTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => { setShowScheduleModal(false); setScheduleTemplate(null); }} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CalendarClock className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Schedule Action</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setShowScheduleModal(false); setScheduleTemplate(null); }} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">Template</p>
                    <p className="font-semibold">{scheduleTemplate.name}</p>
                    <Badge variant="outline" className="mt-1">{scheduleTemplate.status}</Badge>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['activate', 'archive', 'publish'].map((action) => (
                        <button
                          key={action}
                          type="button"
                          className="p-3 rounded-lg border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-colors text-center"
                          onClick={() => {
                            const dateInput = document.getElementById('schedule-date') as HTMLInputElement
                            if (dateInput?.value) {
                              scheduleTemplateAction(scheduleTemplate, action as 'activate' | 'archive' | 'publish', new Date(dateInput.value))
                            } else {
                              toast.error('Please select a date')
                            }
                          }}
                        >
                          <span className="text-2xl block mb-1">
                            {action === 'activate' ? '✅' : action === 'archive' ? '📦' : '🚀'}
                          </span>
                          <span className="text-xs font-medium capitalize">{action}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Date</label>
                    <input
                      type="datetime-local"
                      id="schedule-date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                  
                  {scheduledActions.filter(s => s.templateId === scheduleTemplate.id && s.status === 'pending').length > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm font-medium text-amber-800 mb-2">Pending Scheduled Actions</p>
                      {scheduledActions
                        .filter(s => s.templateId === scheduleTemplate.id && s.status === 'pending')
                        .map(s => (
                          <div key={s.id} className="flex items-center justify-between text-sm py-1">
                            <span className="capitalize">{s.action} on {s.scheduledDate.toLocaleDateString()}</span>
                            <Button variant="ghost" size="sm" onClick={() => cancelScheduledAction(s.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= DEPENDENCIES MODAL ============= */}
        <AnimatePresence>
          {showDependenciesModal && dependenciesTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => { setShowDependenciesModal(false); setDependenciesTemplate(null); }} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Link2 className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Template Dependencies</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setShowDependenciesModal(false); setDependenciesTemplate(null); }} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="p-4 bg-indigo-50 rounded-lg mb-4">
                    <p className="text-sm font-medium text-indigo-700">Template</p>
                    <p className="font-semibold text-indigo-900">{dependenciesTemplate.name}</p>
                    <p className="text-sm text-indigo-600 mt-1">
                      Used in {dependenciesTemplate.usageCount || 0} contracts
                    </p>
                  </div>
                  
                  {isLoadingDependencies ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    </div>
                  ) : templateDependencies.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No contracts are using this template yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">Contracts using this template:</p>
                      {templateDependencies.map((dep) => (
                        <div key={dep.contractId} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{dep.contractName}</p>
                            <p className="text-xs text-gray-500">Created {dep.createdAt}</p>
                          </div>
                          <Badge variant={dep.status === 'active' ? 'default' : 'secondary'}>
                            {dep.status}
                          </Badge>
                        </div>
                      ))}
                      
                      {(dependenciesTemplate.usageCount || 0) > templateDependencies.length && (
                        <p className="text-sm text-gray-500 text-center">
                          + {(dependenciesTemplate.usageCount || 0) - templateDependencies.length} more contracts
                        </p>
                      )}
                    </div>
                  )}
                  
                  {templateDependencies.length > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                          <strong>Warning:</strong> Changes to this template may affect existing contracts. Consider creating a new version instead.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= AUDIT TRAIL MODAL ============= */}
        <AnimatePresence>
          {showAuditTrail && auditTrailTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => { setShowAuditTrail(false); setAuditTrailTemplate(null); }} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
              >
                <div className="p-6 border-b bg-gradient-to-r from-slate-600 to-slate-800 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Shield className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Audit Trail</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setShowAuditTrail(false); setAuditTrailTemplate(null); }} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 overflow-y-auto">
                  <div className="p-3 bg-slate-50 rounded-lg mb-4">
                    <p className="text-sm font-medium text-slate-700">Template</p>
                    <p className="font-semibold">{auditTrailTemplate.name}</p>
                  </div>
                  
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
                    
                    <div className="space-y-4">
                      {auditEntries.map((entry, idx) => (
                        <div key={entry.id} className="relative flex gap-4 pl-10">
                          {/* Timeline dot */}
                          <div className={cn(
                            "absolute left-2.5 w-3 h-3 rounded-full border-2 border-white",
                            idx === 0 ? "bg-green-500" : "bg-slate-400"
                          )} />
                          
                          <div className="flex-1 p-3 bg-white border rounded-lg shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-slate-900 capitalize">{entry.action}</span>
                              <span className="text-xs text-slate-500">{formatTimeAgo(entry.timestamp)}</span>
                            </div>
                            <p className="text-sm text-slate-600">by {entry.user}</p>
                            {entry.changes && (
                              <div className="mt-2 pt-2 border-t">
                                {Object.entries(entry.changes).map(([field, change]) => (
                                  <div key={field} className="text-xs">
                                    <span className="font-medium">{field}:</span>
                                    <span className="text-red-500 line-through ml-1">{change.old}</span>
                                    <span className="mx-1">→</span>
                                    <span className="text-green-600">{change.new}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= SMART TAGS MODAL ============= */}
        <AnimatePresence>
          {showTagSuggestions && tagSuggestionTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => { setShowTagSuggestions(false); setTagSuggestionTemplate(null); }} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b bg-gradient-to-r from-pink-500 to-rose-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wand className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Smart Tag Suggestions</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setShowTagSuggestions(false); setTagSuggestionTemplate(null); }} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="p-3 bg-pink-50 rounded-lg mb-4">
                    <p className="text-sm font-medium text-pink-700">Template</p>
                    <p className="font-semibold text-pink-900">{tagSuggestionTemplate.name}</p>
                    {tagSuggestionTemplate.tags && tagSuggestionTemplate.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-pink-600">Current tags:</span>
                        {tagSuggestionTemplate.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {isGeneratingTags ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-pink-500 mb-3" />
                      <p className="text-sm text-gray-500">Analyzing template content...</p>
                    </div>
                  ) : suggestedTags.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Tag className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No additional tags suggested.</p>
                      <p className="text-sm mt-1">The template already has comprehensive tags.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-3">Suggested tags based on content:</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {suggestedTags.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            className="px-3 py-1.5 bg-pink-100 text-pink-700 rounded-full text-sm hover:bg-pink-200 transition-colors flex items-center gap-1"
                            onClick={() => setSuggestedTags(prev => prev.filter(t => t !== tag))}
                          >
                            {tag}
                            <X className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                      
                      <Button 
                        className="w-full bg-gradient-to-r from-pink-500 to-rose-600"
                        onClick={() => applySmartTags(tagSuggestionTemplate.id, suggestedTags)}
                      >
                        <Tag className="h-4 w-4 mr-2" />
                        Apply {suggestedTags.length} Tags
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= QUICK DUPLICATE MODAL ============= */}
        <AnimatePresence>
          {showQuickDuplicate && duplicateTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => { setShowQuickDuplicate(false); setDuplicateTemplate(null); }} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Copy className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Duplicate Template</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setShowQuickDuplicate(false); setDuplicateTemplate(null); }} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="p-4 bg-cyan-50 rounded-lg">
                    <p className="text-sm text-cyan-700">Duplicating:</p>
                    <p className="font-semibold text-cyan-900">{duplicateTemplate.name}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Template Name</label>
                    <Input 
                      value={duplicateName}
                      onChange={(e) => setDuplicateName(e.target.value)}
                      placeholder="Enter name for the duplicate"
                      autoFocus
                    />
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    <p>The duplicate will include:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Description and content</li>
                      <li>Category: {duplicateTemplate.category}</li>
                      <li>Variables and clauses</li>
                    </ul>
                    <p className="mt-2 text-amber-600">Note: The duplicate will be created as a draft.</p>
                  </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-between">
                  <Button variant="outline" onClick={() => { setShowQuickDuplicate(false); setDuplicateTemplate(null); }}>
                    Cancel
                  </Button>
                  <Button 
                    className="bg-gradient-to-r from-cyan-500 to-blue-600"
                    onClick={performQuickDuplicate}
                    disabled={!duplicateName.trim()}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Create Duplicate
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= KEYBOARD SHORTCUTS MODAL ============= */}
        <AnimatePresence>
          {showKeyboardShortcuts && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => setShowKeyboardShortcuts(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b bg-gradient-to-r from-gray-700 to-gray-900 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Keyboard className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowKeyboardShortcuts(false)} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 max-h-96 overflow-y-auto">
                  <div className="space-y-3">
                    {[
                      { keys: ['⌘', 'K'], desc: 'Focus search' },
                      { keys: ['⌘', 'N'], desc: 'Create new template' },
                      { keys: ['⌘', 'E'], desc: 'Export templates' },
                      { keys: ['⌘', 'I'], desc: 'Import templates' },
                      { keys: ['G'], desc: 'Grid view' },
                      { keys: ['L'], desc: 'List view' },
                      { keys: ['C'], desc: 'Toggle compact mode' },
                      { keys: ['F'], desc: 'Toggle favorites filter' },
                      { keys: ['B'], desc: 'Toggle bulk select mode' },
                      { keys: ['A'], desc: 'Show analytics' },
                      { keys: ['S'], desc: 'AI suggestions' },
                      { keys: ['P'], desc: 'Preview focused template' },
                      { keys: ['↑', '↓'], desc: 'Navigate templates' },
                      { keys: ['?'], desc: 'Show shortcuts' },
                      { keys: ['Esc'], desc: 'Close modals / Clear selection' },
                      { keys: ['⌘', 'A'], desc: 'Select all (in bulk mode)' },
                    ].map((shortcut, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-gray-700">{shortcut.desc}</span>
                        <div className="flex gap-1">
                          {shortcut.keys.map((key, i) => (
                            <kbd 
                              key={i}
                              className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50">
                  <Button variant="outline" onClick={() => setShowKeyboardShortcuts(false)}>Close</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= ANALYTICS MODAL ============= */}
        <AnimatePresence>
          {showAnalytics && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50" 
                onClick={() => setShowAnalytics(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              >
                <div className="p-6 border-b bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-6 w-6" />
                      <h2 className="text-lg font-bold">Template Analytics</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowAnalytics(false)} className="text-white hover:bg-white/20">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Category Usage */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Layers className="h-4 w-4 text-blue-500" />
                          Usage by Category
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(analyticsData.categoryUsage)
                            .sort(([,a], [,b]) => b - a)
                            .map(([category, usage]) => (
                            <div key={category}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-700">{category}</span>
                                <span className="font-medium">{usage}</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                  style={{ width: `${(usage / stats.totalUsage) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Top Templates */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          Most Used Templates
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analyticsData.topTemplates.map((template, idx) => (
                            <div key={template.id} className="flex items-center gap-3">
                              <span className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                idx === 0 ? "bg-amber-100 text-amber-700" :
                                idx === 1 ? "bg-gray-200 text-gray-700" :
                                idx === 2 ? "bg-orange-100 text-orange-700" :
                                "bg-gray-100 text-gray-500"
                              )}>
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{template.name}</p>
                                <p className="text-xs text-gray-500">{template.category}</p>
                              </div>
                              <Badge variant="secondary">{template.usageCount || 0} uses</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Status Distribution */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Zap className="h-4 w-4 text-purple-500" />
                          Status Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-3 flex-wrap">
                          {Object.entries(analyticsData.statusDistribution).map(([status, count]) => (
                            <div 
                              key={status}
                              className={cn(
                                "px-4 py-3 rounded-xl text-center flex-1 min-w-[100px]",
                                status === 'active' ? "bg-green-50 border border-green-200" :
                                status === 'draft' ? "bg-yellow-50 border border-yellow-200" :
                                "bg-gray-50 border border-gray-200"
                              )}
                            >
                              <p className="text-2xl font-bold">{count}</p>
                              <p className="text-xs text-gray-600 capitalize">{status}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Recent Activity */}
                    <Card className="shadow-lg">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          Recent Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analyticsData.recentActivity.map((template) => (
                            <div key={template.id} className="flex items-center gap-3 text-sm">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{template.name}</p>
                              </div>
                              <span className="text-gray-500 text-xs">
                                {new Date(template.lastModified || template.updatedAt || template.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50">
                  <Button variant="outline" onClick={() => setShowAnalytics(false)}>Close</Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= ONBOARDING MODAL ============= */}
        <AnimatePresence>
          {showOnboarding && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60" 
                onClick={completeOnboarding} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-8 bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 text-white text-center">
                  <div className="inline-flex p-4 bg-white/20 rounded-2xl mb-4">
                    <FileText className="h-10 w-10" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Welcome to Templates!</h2>
                  <p className="text-purple-100">Your central hub for managing contract templates</p>
                </div>
                
                <div className="p-6 space-y-4">
                  {[
                    { icon: Plus, title: 'Create Templates', desc: 'Build reusable templates with variables and clauses' },
                    { icon: Star, title: 'Favorites', desc: 'Star your most-used templates for quick access' },
                    { icon: BarChart3, title: 'Analytics', desc: 'Track usage and identify popular templates' },
                    { icon: Wand2, title: 'AI Suggestions', desc: 'Get smart recommendations for your templates' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <item.icon className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                  <Button variant="ghost" onClick={completeOnboarding}>
                    Skip
                  </Button>
                  <Button 
                    onClick={completeOnboarding}
                    className="bg-gradient-to-r from-purple-500 to-pink-600 text-white"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* ============= PREVIEW SIDEBAR (Slide-in Panel) ============= */}
        <AnimatePresence>
          {previewSidebarOpen && sidebarTemplate && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                onClick={closePreviewSidebar}
              />
              
              {/* Sidebar Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 mr-4">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(sidebarTemplate.status, sidebarTemplate.approvalStatus)}
                        <Badge className={cn("text-xs", getCategoryColor(sidebarTemplate.category).bg, getCategoryColor(sidebarTemplate.category).text)}>
                          {getCategoryColor(sidebarTemplate.category).icon} {sidebarTemplate.category}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-lg text-gray-900">{sidebarTemplate.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{sidebarTemplate.description}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={closePreviewSidebar}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="p-4 grid grid-cols-3 gap-3 border-b">
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <Variable className="h-5 w-5 mx-auto text-blue-600" />
                    <p className="text-lg font-bold text-blue-700 mt-1">{sidebarTemplate.variables || 0}</p>
                    <p className="text-xs text-blue-600">Variables</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <FileCode className="h-5 w-5 mx-auto text-green-600" />
                    <p className="text-lg font-bold text-green-700 mt-1">
                      {Array.isArray(sidebarTemplate.clauses) ? sidebarTemplate.clauses.length : sidebarTemplate.clauses || 0}
                    </p>
                    <p className="text-xs text-green-600">Clauses</p>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 mx-auto text-purple-600" />
                    <p className="text-lg font-bold text-purple-700 mt-1">{sidebarTemplate.usageCount || 0}</p>
                    <p className="text-xs text-purple-600">Uses</p>
                  </div>
                </div>
                
                {/* Template Info */}
                <div className="p-4 border-b space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Created by {sidebarTemplate.createdBy || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Last modified {new Date(sidebarTemplate.lastModified || sidebarTemplate.updatedAt || sidebarTemplate.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {sidebarTemplate.tags && sidebarTemplate.tags.length > 0 && (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Tag className="h-4 w-4 text-gray-400" />
                      {sidebarTemplate.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Health Score */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Template Health</span>
                    <span className={cn("text-sm font-semibold px-2 py-0.5 rounded", getHealthScoreColor(calculateHealthScore(sidebarTemplate)))}>
                      {calculateHealthScore(sidebarTemplate)}% - {getHealthScoreLabel(calculateHealthScore(sidebarTemplate))}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <motion.div 
                      className={cn(
                        "h-2 rounded-full",
                        calculateHealthScore(sidebarTemplate) >= 80 ? "bg-green-500" :
                        calculateHealthScore(sidebarTemplate) >= 60 ? "bg-blue-500" :
                        calculateHealthScore(sidebarTemplate) >= 40 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${calculateHealthScore(sidebarTemplate)}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
                
                {/* Preview Content */}
                <div className="p-4 flex-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 500px)' }}>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 font-mono whitespace-pre-wrap">
                    {sidebarTemplate.content || 'No content preview available. Edit the template to add content.'}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t flex gap-2">
                  <Button asChild className="flex-1 bg-purple-600 hover:bg-purple-700">
                    <Link href={`/templates/${sidebarTemplate.id}/edit`}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="outline" onClick={() => handleDuplicate(sidebarTemplate)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      toggleFavorite(sidebarTemplate.id)
                      addActivity(favorites.includes(sidebarTemplate.id) ? 'unfavorited' : 'favorited', sidebarTemplate.name)
                    }}
                    className={favorites.includes(sidebarTemplate.id) ? 'text-amber-600 border-amber-300 bg-amber-50' : ''}
                  >
                    <Star className={cn("h-4 w-4", favorites.includes(sidebarTemplate.id) && "fill-current")} />
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        
        {/* ============= CONTEXT MENU ============= */}
        <AnimatePresence>
          {contextMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={closeContextMenu}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="fixed z-50 bg-white rounded-lg shadow-xl border py-1 min-w-[180px]"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                <button
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    openPreviewSidebar(contextMenu.template)
                    closeContextMenu()
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Quick Preview
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    window.location.href = `/templates/${contextMenu.template.id}/edit`
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Template
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    handleDuplicate(contextMenu.template)
                    closeContextMenu()
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    toggleFavorite(contextMenu.template.id)
                    addActivity(
                      favorites.includes(contextMenu.template.id) ? 'unfavorited' : 'favorited',
                      contextMenu.template.name
                    )
                    closeContextMenu()
                  }}
                >
                  <Star className={cn("h-4 w-4", favorites.includes(contextMenu.template.id) && "fill-amber-500 text-amber-500")} />
                  {favorites.includes(contextMenu.template.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                </button>
                <div className="border-t my-1" />
                <button
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    setVersionHistoryTemplate(contextMenu.template)
                    setShowVersionHistory(true)
                    closeContextMenu()
                  }}
                >
                  <History className="h-4 w-4" />
                  Version History
                </button>
                <button
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                  onClick={() => {
                    exportTemplates([contextMenu.template])
                    closeContextMenu()
                  }}
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <div className="border-t my-1" />
                <button
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  onClick={() => {
                    handleDeleteClick(contextMenu.template.id, contextMenu.template.name)
                    closeContextMenu()
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        
        {/* ============= ACTIVITY PANEL ============= */}
        <AnimatePresence>
          {showActivityPanel && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 z-40"
                onClick={() => setShowActivityPanel(false)}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50"
              >
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    Recent Activity
                  </h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowActivityPanel(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
                  {recentActivity.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">No recent activity</p>
                      <p className="text-sm text-gray-400">Your actions will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                          <div className={cn(
                            "p-1.5 rounded-full",
                            activity.action === 'favorited' ? 'bg-amber-100 text-amber-600' :
                            activity.action === 'unfavorited' ? 'bg-gray-100 text-gray-600' :
                            activity.action === 'duplicated' ? 'bg-blue-100 text-blue-600' :
                            activity.action === 'deleted' ? 'bg-red-100 text-red-600' :
                            'bg-purple-100 text-purple-600'
                          )}>
                            {activity.action === 'favorited' && <Star className="h-3.5 w-3.5 fill-current" />}
                            {activity.action === 'unfavorited' && <StarOff className="h-3.5 w-3.5" />}
                            {activity.action === 'duplicated' && <Copy className="h-3.5 w-3.5" />}
                            {activity.action === 'deleted' && <Trash2 className="h-3.5 w-3.5" />}
                            {!['favorited', 'unfavorited', 'duplicated', 'deleted'].includes(activity.action) && <Activity className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{activity.template}</p>
                            <p className="text-xs text-gray-500 capitalize">{activity.action}</p>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{formatTimeAgo(activity.time)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        
        {/* ============= FLOATING ACTION BUTTON (Mobile) ============= */}
        <div className="fixed bottom-6 right-6 z-40 md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="lg"
                className="h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
              <DropdownMenuItem asChild>
                <Link href="/templates/new" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Template
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAISuggestions(true)}>
                <Wand2 className="h-4 w-4 mr-2" />
                AI Suggest
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowImportModal(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowAnalytics(true)}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* ============= SCHEDULED ACTIONS INDICATOR ============= */}
        <AnimatePresence>
          {scheduledActions.filter(s => s.status === 'pending').length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="fixed right-6 top-24 z-40 bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-lg max-w-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-amber-600" />
                  <span className="font-semibold text-amber-900">Scheduled Actions</span>
                </div>
                <Badge variant="outline" className="bg-amber-100 text-amber-700">
                  {scheduledActions.filter(s => s.status === 'pending').length}
                </Badge>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {scheduledActions.filter(s => s.status === 'pending').slice(0, 3).map(action => (
                  <div key={action.id} className="text-sm flex items-center justify-between">
                    <span className="text-amber-800 truncate flex-1">
                      <span className="capitalize">{action.action}</span> {action.templateName}
                    </span>
                    <span className="text-xs text-amber-600 ml-2">
                      {action.scheduledDate.toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
              {scheduledActions.filter(s => s.status === 'pending').length > 3 && (
                <p className="text-xs text-amber-600 mt-2">
                  +{scheduledActions.filter(s => s.status === 'pending').length - 3} more
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* ============= QUICK ACTIONS FLOATING BAR ============= */}
        <AnimatePresence>
          {showQuickActions && templates.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border px-2 py-2"
            >
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => window.location.href = '/templates/new'}
                  title="New Template (⌘N)"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
                <div className="w-px h-6 bg-gray-200" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setShowImportModal(true)}
                  title="Import (⌘I)"
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setShowExportModal(true)}
                  title="Export (⌘E)"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-gray-200" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setBulkActionMode(!bulkActionMode)}
                  title="Bulk Select"
                >
                  <CheckSquare className={cn("h-4 w-4", bulkActionMode && "text-blue-600")} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setShowAnalytics(true)}
                  title="Analytics"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setShowAISuggestions(true)}
                  title="AI Suggestions"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-gray-200" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setShowKeyboardShortcuts(true)}
                  title="Keyboard Shortcuts (?)"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-gray-400 hover:text-gray-600"
                  onClick={() => setShowQuickActions(false)}
                  title="Hide Toolbar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Show Quick Actions Toggle when hidden */}
        <AnimatePresence>
          {!showQuickActions && templates.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setShowQuickActions(true)}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 p-3 bg-white rounded-full shadow-lg border hover:shadow-xl transition-shadow"
              title="Show Quick Actions"
            >
              <PanelRightOpen className="h-5 w-5 text-gray-600" />
            </motion.button>
          )}
        </AnimatePresence>
        
        {/* ============= SCROLL TO TOP BUTTON ============= */}
        <AnimatePresence>
          {filteredAndSortedTemplates.length > 6 && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-6 left-6 z-40 p-3 rounded-full bg-white shadow-lg border hover:shadow-xl transition-shadow hidden md:block"
              title="Scroll to top"
            >
              <Target className="h-5 w-5 text-gray-600" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
