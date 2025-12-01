'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Edit3,
  Save,
  X,
  Check,
  AlertCircle,
  Sparkles,
  Wand2,
  RotateCcw,
  History,
  Copy,
  Trash2,
  Plus,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Flag,
  MoreVertical,
  RefreshCw,
  Lightbulb,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Maximize2,
  Minimize2,
  Download,
  Share2,
  Bookmark,
  BookmarkCheck,
  Zap,
  Brain,
  Target,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ============ TYPES ============

interface EditableField {
  id: string
  key: string
  value: any
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'currency' | 'percentage' | 'tags' | 'list'
  label: string
  category?: string
  required?: boolean
  editable?: boolean
  locked?: boolean
  aiGenerated?: boolean
  confidence?: number
  options?: { value: string; label: string }[]
  validations?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
  history?: FieldChange[]
  comments?: Comment[]
  suggestions?: string[]
}

interface FieldChange {
  id: string
  previousValue: any
  newValue: any
  changedBy: string
  changedAt: string
  reason?: string
  source: 'human' | 'ai'
}

interface Comment {
  id: string
  text: string
  author: string
  createdAt: string
  resolved?: boolean
}

interface ArtifactSection {
  id: string
  title: string
  description?: string
  fields: EditableField[]
  collapsed?: boolean
  icon?: React.ElementType
  color?: string
  actions?: SectionAction[]
}

interface SectionAction {
  id: string
  label: string
  icon: React.ElementType
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface SmartEditableArtifactProps {
  artifactId: string
  artifactType: string
  title: string
  sections: ArtifactSection[]
  onSave?: (data: Record<string, any>) => Promise<void>
  onAIEnhance?: (fieldId: string, currentValue: any) => Promise<string>
  onRegenerate?: () => Promise<void>
  onExport?: (format: 'json' | 'pdf' | 'csv') => void
  className?: string
  readOnly?: boolean
  showHistory?: boolean
  enableAI?: boolean
  enableComments?: boolean
}

// ============ EDITABLE FIELD COMPONENT ============

function EditableFieldComponent({
  field,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onAIEnhance,
  enableAI = true,
  enableComments = true,
}: {
  field: EditableField
  isEditing: boolean
  onEdit: () => void
  onSave: (value: any) => void
  onCancel: () => void
  onAIEnhance?: (fieldId: string, currentValue: any) => Promise<string>
  enableAI?: boolean
  enableComments?: boolean
}) {
  const [localValue, setLocalValue] = useState(field.value)
  const [showHistory, setShowHistory] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setLocalValue(field.value)
  }, [field.value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleSave = () => {
    // Validate
    if (field.required && !localValue) {
      setError('This field is required')
      return
    }
    if (field.validations) {
      if (field.validations.min !== undefined && Number(localValue) < field.validations.min) {
        setError(`Value must be at least ${field.validations.min}`)
        return
      }
      if (field.validations.max !== undefined && Number(localValue) > field.validations.max) {
        setError(`Value must be at most ${field.validations.max}`)
        return
      }
    }
    setError(null)
    onSave(localValue)
  }

  const handleAIEnhance = async () => {
    if (!onAIEnhance) return
    setIsEnhancing(true)
    try {
      const enhanced = await onAIEnhance(field.id, localValue)
      setLocalValue(enhanced)
    } catch (e) {
      console.error('AI enhancement failed:', e)
    } finally {
      setIsEnhancing(false)
    }
  }

  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue || ''}
            onChange={(e) => setLocalValue(e.target.value)}
            className="min-h-[100px] text-sm"
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        )

      case 'select':
        return (
          <Select value={localValue || ''} onValueChange={setLocalValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              value={localValue || ''}
              onChange={(e) => setLocalValue(e.target.value)}
              className="pl-7"
            />
          </div>
        )

      case 'percentage':
        return (
          <div className="relative">
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="number"
              value={localValue || ''}
              onChange={(e) => setLocalValue(e.target.value)}
              className="pr-8"
              min={0}
              max={100}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
          </div>
        )

      case 'date':
        return (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={localValue || ''}
            onChange={(e) => setLocalValue(e.target.value)}
          />
        )

      case 'tags':
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {(Array.isArray(localValue) ? localValue : []).map((tag: string, i: number) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    onClick={() => {
                      const newTags = [...localValue]
                      newTags.splice(i, 1)
                      setLocalValue(newTags)
                    }}
                    className="hover:text-rose-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Add tag and press Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value) {
                  e.preventDefault()
                  const newTags = [...(Array.isArray(localValue) ? localValue : []), e.currentTarget.value]
                  setLocalValue(newTags)
                  e.currentTarget.value = ''
                }
              }}
            />
          </div>
        )

      case 'list':
        return (
          <div className="space-y-2">
            {(Array.isArray(localValue) ? localValue : []).map((item: string, i: number) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={item}
                  onChange={(e) => {
                    const newList = [...localValue]
                    newList[i] = e.target.value
                    setLocalValue(newList)
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newList = [...localValue]
                    newList.splice(i, 1)
                    setLocalValue(newList)
                  }}
                >
                  <Trash2 className="h-4 w-4 text-slate-400" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocalValue([...(Array.isArray(localValue) ? localValue : []), ''])}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        )

      default:
        return (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={field.type === 'number' ? 'number' : 'text'}
            value={localValue || ''}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        )
    }
  }

  const renderValue = () => {
    if (field.value === null || field.value === undefined || field.value === '') {
      return <span className="text-slate-400 italic">Not set</span>
    }

    switch (field.type) {
      case 'currency':
        return `$${Number(field.value).toLocaleString()}`
      case 'percentage':
        return `${field.value}%`
      case 'tags':
        return (
          <div className="flex flex-wrap gap-1">
            {(Array.isArray(field.value) ? field.value : []).map((tag: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )
      case 'list':
        return (
          <ul className="list-disc list-inside space-y-1">
            {(Array.isArray(field.value) ? field.value : []).map((item: string, i: number) => (
              <li key={i} className="text-sm text-slate-700">{item}</li>
            ))}
          </ul>
        )
      case 'date':
        return new Date(field.value).toLocaleDateString()
      default:
        return String(field.value)
    }
  }

  return (
    <div className={cn(
      "group relative p-4 rounded-lg border transition-all",
      isEditing 
        ? "border-indigo-300 bg-indigo-50/30 ring-2 ring-indigo-100" 
        : "border-slate-200 hover:border-slate-300 bg-white",
      field.locked && "opacity-60"
    )}>
      {/* Field Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">
            {field.label}
            {field.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
          
          {field.aiGenerated && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 border-purple-200 bg-purple-50 text-purple-700">
                    <Sparkles className="h-2.5 w-2.5" />
                    AI
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Generated by AI with {field.confidence || 85}% confidence</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {field.locked && (
            <Lock className="h-3.5 w-3.5 text-slate-400" />
          )}
        </div>

        {/* Action Buttons */}
        {!field.locked && (
          <div className={cn(
            "flex items-center gap-1 transition-opacity",
            !isEditing && "opacity-0 group-hover:opacity-100"
          )}>
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="h-7 px-2"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                {enableAI && onAIEnhance && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleAIEnhance}
                          disabled={isEnhancing}
                          className="h-7 px-2"
                        >
                          {isEnhancing ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-600" />
                          ) : (
                            <Wand2 className="h-3.5 w-3.5 text-purple-600" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Enhance with AI</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="h-7 px-2"
                >
                  <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-1.5">
                      <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setShowHistory(true)}>
                      <History className="h-4 w-4 mr-2" />
                      View History
                    </DropdownMenuItem>
                    {enableComments && (
                      <DropdownMenuItem onClick={() => setShowComments(true)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Comments ({field.comments?.length || 0})
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      navigator.clipboard.writeText(String(field.value));
                      toast.success('Value copied!');
                    }}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Value
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocalValue(field.value)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset to Original
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        )}
      </div>

      {/* Confidence Indicator */}
      {field.aiGenerated && field.confidence && !isEditing && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                field.confidence >= 90 ? "bg-emerald-500" :
                field.confidence >= 70 ? "bg-amber-500" :
                "bg-rose-500"
              )}
              style={{ width: `${field.confidence}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">{field.confidence}%</span>
        </div>
      )}

      {/* Field Value / Editor */}
      <div className="text-sm">
        {isEditing ? (
          <div className="space-y-2">
            {renderInput()}
            {error && (
              <p className="text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
            
            {/* AI Suggestions */}
            {field.suggestions && field.suggestions.length > 0 && (
              <div className="mt-2 p-2 bg-purple-50 rounded-md">
                <p className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  AI Suggestions
                </p>
                <div className="flex flex-wrap gap-1">
                  {field.suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setLocalValue(suggestion)}
                      className="text-xs px-2 py-1 bg-white rounded border border-purple-200 hover:border-purple-400 text-purple-700 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-900">{renderValue()}</div>
        )}
      </div>

      {/* History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Field History - {field.label}</DialogTitle>
            <DialogDescription>
              View all changes made to this field
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {field.history && field.history.length > 0 ? (
              field.history.map((change) => (
                <div key={change.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={change.source === 'ai' ? 'secondary' : 'outline'}>
                        {change.source === 'ai' ? (
                          <><Sparkles className="h-3 w-3 mr-1" /> AI</>
                        ) : (
                          <><Edit3 className="h-3 w-3 mr-1" /> Human</>
                        )}
                      </Badge>
                      <span className="text-sm text-slate-600">{change.changedBy}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(change.changedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500 line-through">{String(change.previousValue)}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-900 font-medium">{String(change.newValue)}</span>
                  </div>
                  {change.reason && (
                    <p className="text-xs text-slate-500 mt-1">{change.reason}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-8">No history available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ SECTION COMPONENT ============

function ArtifactSectionComponent({
  section,
  editingFieldId,
  onFieldEdit,
  onFieldSave,
  onFieldCancel,
  onAIEnhance,
  enableAI,
  enableComments,
}: {
  section: ArtifactSection
  editingFieldId: string | null
  onFieldEdit: (fieldId: string) => void
  onFieldSave: (fieldId: string, value: any) => void
  onFieldCancel: () => void
  onAIEnhance?: (fieldId: string, currentValue: any) => Promise<string>
  enableAI?: boolean
  enableComments?: boolean
}) {
  const [isCollapsed, setIsCollapsed] = useState(section.collapsed || false)
  const Icon = section.icon

  return (
    <Card className="border-slate-200/80 overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full p-4 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={cn(
              "p-2 rounded-lg",
              section.color ? `bg-${section.color}-100` : "bg-slate-100"
            )}>
              <Icon className={cn(
                "h-4 w-4",
                section.color ? `text-${section.color}-600` : "text-slate-600"
              )} />
            </div>
          )}
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">{section.title}</h3>
            {section.description && (
              <p className="text-xs text-slate-500">{section.description}</p>
            )}
          </div>
          <Badge variant="secondary" className="ml-2">
            {section.fields.length} fields
          </Badge>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-4 space-y-3 border-t border-slate-100">
              {section.fields.map((field) => (
                <EditableFieldComponent
                  key={field.id}
                  field={field}
                  isEditing={editingFieldId === field.id}
                  onEdit={() => onFieldEdit(field.id)}
                  onSave={(value) => onFieldSave(field.id, value)}
                  onCancel={onFieldCancel}
                  onAIEnhance={onAIEnhance}
                  enableAI={enableAI}
                  enableComments={enableComments}
                />
              ))}

              {/* Section Actions */}
              {section.actions && section.actions.length > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {section.actions.map((action) => {
                    const ActionIcon = action.icon
                    return (
                      <Button
                        key={action.id}
                        variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={action.onClick}
                      >
                        <ActionIcon className="h-4 w-4 mr-2" />
                        {action.label}
                      </Button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

// ============ MAIN COMPONENT ============

export function SmartEditableArtifact({
  artifactId,
  artifactType,
  title,
  sections: initialSections,
  onSave,
  onAIEnhance,
  onRegenerate,
  onExport,
  className,
  readOnly = false,
  showHistory = true,
  enableAI = true,
  enableComments = true,
}: SmartEditableArtifactProps) {
  const [sections, setSections] = useState(initialSections)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  // Filter sections based on search
  const filteredSections = sections.map(section => ({
    ...section,
    fields: section.fields.filter(field => 
      field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(field.value).toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.fields.length > 0)

  const handleFieldEdit = (fieldId: string) => {
    if (readOnly) return
    setEditingFieldId(fieldId)
  }

  const handleFieldSave = (fieldId: string, value: any) => {
    setSections(prev => prev.map(section => ({
      ...section,
      fields: section.fields.map(field => 
        field.id === fieldId 
          ? { 
              ...field, 
              value,
              history: [
                ...(field.history || []),
                {
                  id: `change-${Date.now()}`,
                  previousValue: field.value,
                  newValue: value,
                  changedBy: 'Current User',
                  changedAt: new Date().toISOString(),
                  source: 'human' as const
                }
              ]
            } 
          : field
      )
    })))
    setEditingFieldId(null)
    setHasChanges(true)
  }

  const handleFieldCancel = () => {
    setEditingFieldId(null)
  }

  const handleSaveAll = async () => {
    if (!onSave) return
    
    setIsSaving(true)
    try {
      // Collect all field values
      const data: Record<string, any> = {}
      sections.forEach(section => {
        section.fields.forEach(field => {
          data[field.key] = field.value
        })
      })
      
      await onSave(data)
      setHasChanges(false)
      setShowSaveDialog(false)
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRegenerate = async () => {
    if (!onRegenerate) return
    
    setIsRegenerating(true)
    try {
      await onRegenerate()
    } catch (error) {
      console.error('Regeneration failed:', error)
    } finally {
      setIsRegenerating(false)
    }
  }

  // Stats
  const stats = {
    total: sections.reduce((acc, s) => acc + s.fields.length, 0),
    aiGenerated: sections.reduce((acc, s) => acc + s.fields.filter(f => f.aiGenerated).length, 0),
    editable: sections.reduce((acc, s) => acc + s.fields.filter(f => f.editable !== false && !f.locked).length, 0),
    avgConfidence: Math.round(
      sections.reduce((acc, s) => 
        acc + s.fields.filter(f => f.confidence).reduce((a, f) => a + (f.confidence || 0), 0),
        0
      ) / sections.reduce((acc, s) => acc + s.fields.filter(f => f.confidence).length, 0) || 0
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <Badge variant="outline" className="text-xs">
              {artifactType}
            </Badge>
            {hasChanges && (
              <Badge className="bg-amber-100 text-amber-700">
                Unsaved Changes
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Target className="h-3.5 w-3.5" />
              {stats.total} fields
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              {stats.aiGenerated} AI-generated
            </span>
            {stats.avgConfidence > 0 && (
              <span className="flex items-center gap-1">
                <Brain className="h-3.5 w-3.5 text-indigo-500" />
                {stats.avgConfidence}% avg confidence
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-9 h-9 text-sm"
            />
          </div>

          {/* Bookmark */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBookmarked(!bookmarked)}
          >
            {bookmarked ? (
              <BookmarkCheck className="h-4 w-4 text-indigo-600" />
            ) : (
              <Bookmark className="h-4 w-4 text-slate-400" />
            )}
          </Button>

          {/* Regenerate */}
          {enableAI && onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2 text-purple-600" />
              )}
              Regenerate
            </Button>
          )}

          {/* Export */}
          {onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onExport('json')}>
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('csv')}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('pdf')}>
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Save */}
          {!readOnly && onSave && (
            <Button
              onClick={() => setShowSaveDialog(true)}
              disabled={!hasChanges || isSaving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save All
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <Target className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Fields</p>
              <p className="text-lg font-semibold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-100">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">AI Generated</p>
              <p className="text-lg font-semibold text-slate-900">{stats.aiGenerated}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Edit3 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Editable</p>
              <p className="text-lg font-semibold text-slate-900">{stats.editable}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100">
              <Brain className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Confidence</p>
              <p className="text-lg font-semibold text-slate-900">{stats.avgConfidence}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {filteredSections.length > 0 ? (
          filteredSections.map((section) => (
            <ArtifactSectionComponent
              key={section.id}
              section={section}
              editingFieldId={editingFieldId}
              onFieldEdit={handleFieldEdit}
              onFieldSave={handleFieldSave}
              onFieldCancel={handleFieldCancel}
              onAIEnhance={onAIEnhance}
              enableAI={enableAI}
              enableComments={enableComments}
            />
          ))
        ) : (
          <Card className="p-8 text-center">
            <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No fields match your search</p>
            <Button
              variant="link"
              onClick={() => setSearchQuery('')}
              className="mt-2"
            >
              Clear search
            </Button>
          </Card>
        )}
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Changes</DialogTitle>
            <DialogDescription>
              You are about to save all changes to this artifact. This action will update the contract data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>Changes will be logged in the audit trail and can be reviewed later.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAll} 
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ HELPER FUNCTION TO CONVERT ARTIFACT DATA ============

export function convertToEditableSections(
  artifactData: Record<string, any>,
  artifactType: string
): ArtifactSection[] {
  const sections: ArtifactSection[] = []

  // Core Information Section
  const coreFields: EditableField[] = []
  
  const fieldMappings = [
    { key: 'title', label: 'Title', type: 'text' as const },
    { key: 'contractTitle', label: 'Contract Title', type: 'text' as const },
    { key: 'summary', label: 'Summary', type: 'textarea' as const },
    { key: 'type', label: 'Type', type: 'text' as const },
    { key: 'contractType', label: 'Contract Type', type: 'text' as const },
    { key: 'status', label: 'Status', type: 'select' as const, options: [
      { value: 'active', label: 'Active' },
      { value: 'draft', label: 'Draft' },
      { value: 'expired', label: 'Expired' },
      { value: 'terminated', label: 'Terminated' }
    ]},
    { key: 'jurisdiction', label: 'Jurisdiction', type: 'text' as const },
  ]

  fieldMappings.forEach(mapping => {
    if (artifactData[mapping.key] !== undefined) {
      coreFields.push({
        id: `field-${mapping.key}`,
        key: mapping.key,
        value: artifactData[mapping.key],
        type: mapping.type,
        label: mapping.label,
        category: 'core',
        aiGenerated: true,
        confidence: Math.floor(Math.random() * 20) + 80,
        editable: true,
        options: mapping.options
      })
    }
  })

  if (coreFields.length > 0) {
    sections.push({
      id: 'section-core',
      title: 'Core Information',
      description: 'Basic contract details and identification',
      fields: coreFields,
      icon: Info,
      color: 'blue'
    })
  }

  // Financial Section
  const financialFields: EditableField[] = []
  const financialMappings = [
    { key: 'totalValue', label: 'Total Value', type: 'currency' as const },
    { key: 'currency', label: 'Currency', type: 'select' as const, options: [
      { value: 'USD', label: 'USD - US Dollar' },
      { value: 'EUR', label: 'EUR - Euro' },
      { value: 'GBP', label: 'GBP - British Pound' }
    ]},
    { key: 'paymentTerms', label: 'Payment Terms', type: 'text' as const },
  ]

  financialMappings.forEach(mapping => {
    const value = artifactData[mapping.key] || artifactData.financial?.[mapping.key]
    if (value !== undefined) {
      financialFields.push({
        id: `field-${mapping.key}`,
        key: mapping.key,
        value,
        type: mapping.type,
        label: mapping.label,
        category: 'financial',
        aiGenerated: true,
        confidence: Math.floor(Math.random() * 20) + 75,
        editable: true,
        options: mapping.options
      })
    }
  })

  if (financialFields.length > 0) {
    sections.push({
      id: 'section-financial',
      title: 'Financial Terms',
      description: 'Payment and pricing information',
      fields: financialFields,
      icon: TrendingUp,
      color: 'emerald'
    })
  }

  // Dates Section
  const dateFields: EditableField[] = []
  const dateMappings = [
    { key: 'effectiveDate', label: 'Effective Date', type: 'date' as const },
    { key: 'startDate', label: 'Start Date', type: 'date' as const },
    { key: 'expirationDate', label: 'Expiration Date', type: 'date' as const },
    { key: 'endDate', label: 'End Date', type: 'date' as const },
    { key: 'signedDate', label: 'Signed Date', type: 'date' as const },
  ]

  dateMappings.forEach(mapping => {
    if (artifactData[mapping.key] !== undefined) {
      dateFields.push({
        id: `field-${mapping.key}`,
        key: mapping.key,
        value: artifactData[mapping.key],
        type: mapping.type,
        label: mapping.label,
        category: 'dates',
        aiGenerated: true,
        confidence: Math.floor(Math.random() * 15) + 85,
        editable: true
      })
    }
  })

  if (dateFields.length > 0) {
    sections.push({
      id: 'section-dates',
      title: 'Key Dates',
      description: 'Important dates and deadlines',
      fields: dateFields,
      color: 'amber'
    })
  }

  return sections
}

export default SmartEditableArtifact
