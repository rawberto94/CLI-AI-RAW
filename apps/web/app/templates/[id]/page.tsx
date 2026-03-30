'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText,
  Save,
  ArrowLeft,
  Plus,
  Library,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  AlertCircle,
  Sparkles,
  Wand2,
  Brain,
  ShieldCheck,
  Variable,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getTenantId } from '@/lib/tenant'

interface Clause {
  id: string
  category: string
  title: string
  content: string
  variables: string[]
}

interface TemplateVariable {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'currency'
  required: boolean
  defaultValue?: string
}

interface TemplateData {
  id?: string
  name: string
  description: string
  category: string
  clauses: unknown[]
  structure: Record<string, unknown>
  metadata: Record<string, unknown>
  isActive: boolean
}

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const isNew = params.id === 'new'
  
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateCategory, setTemplateCategory] = useState('GENERAL')
  const [templateLanguage, setTemplateLanguage] = useState('en-US')
  const [templateStatus, setTemplateStatus] = useState<'draft' | 'active'>('draft')
  const [templateContent, setTemplateContent] = useState('')
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [showClauseLibrary, setShowClauseLibrary] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingTemplateId, setExistingTemplateId] = useState<string | null>(null)

  // AI State
  const [aiLoading, setAiLoading] = useState<string | null>(null) // tracks which AI action is running
  const [aiClauses, setAiClauses] = useState<Clause[]>([])

  const callTemplateAI = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch('/api/templates/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `AI request failed (${response.status})`)
    }
    const json = await response.json()
    return json.data ?? json
  }, [])

  const handleGenerateClauses = useCallback(async () => {
    if (!templateName.trim()) { toast.error('Enter a template name first'); return }
    setAiLoading('generate-clauses')
    try {
      const result = await callTemplateAI({
        action: 'generate-clauses',
        templateName,
        category: templateCategory,
        description: templateDescription,
      })
      const clauses = (result.clauses || []).map((c: { title: string; category: string; content: string; variables: string[] }, i: number) => ({
        id: `ai-${i}`,
        ...c,
      }))
      setAiClauses(clauses)
      setShowClauseLibrary(true)
      toast.success(`Generated ${clauses.length} AI clauses`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate clauses')
    } finally {
      setAiLoading(null)
    }
  }, [templateName, templateCategory, templateDescription, callTemplateAI])

  const handleImproveContent = useCallback(async (instruction: 'improve' | 'simplify' | 'strengthen' | 'make-compliant') => {
    if (!templateContent.trim()) { toast.error('No content to improve'); return }
    setAiLoading(instruction)
    try {
      const result = await callTemplateAI({
        action: 'improve-clause',
        clauseTitle: templateName || 'Template Content',
        clauseContent: templateContent,
        templateCategory,
        instruction,
      })
      setTemplateContent(result.content)
      toast.success(`Content ${instruction === 'make-compliant' ? 'made compliant' : instruction + 'd'} — ${result.changesSummary}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI improvement failed')
    } finally {
      setAiLoading(null)
    }
  }, [templateContent, templateName, templateCategory, callTemplateAI])

  const handleGenerateTemplate = useCallback(async () => {
    if (!templateDescription.trim() || templateDescription.length < 10) {
      toast.error('Enter a description (at least 10 characters) to generate a template')
      return
    }
    setAiLoading('generate-template')
    try {
      const result = await callTemplateAI({
        action: 'generate-template',
        description: templateDescription,
        category: templateCategory,
        language: templateLanguage,
      })
      if (result.name && !templateName) setTemplateName(result.name)
      setTemplateContent(result.content)
      setVariables((result.variables || []).map((v: TemplateVariable) => ({
        ...v,
        defaultValue: '',
      })))
      toast.success('Template generated with AI')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Template generation failed')
    } finally {
      setAiLoading(null)
    }
  }, [templateDescription, templateCategory, templateLanguage, templateName, callTemplateAI])

  const handleExtractVariables = useCallback(async () => {
    if (!templateContent.trim()) { toast.error('No content to analyze'); return }
    setAiLoading('extract-variables')
    try {
      const result = await callTemplateAI({
        action: 'extract-variables',
        content: templateContent,
      })
      const newVars = (result.variables || []).map((v: TemplateVariable) => ({
        ...v,
        defaultValue: v.defaultValue || '',
      }))
      setVariables(prev => {
        const existing = new Set(prev.map(p => p.name))
        const additions = newVars.filter((v: TemplateVariable) => !existing.has(v.name))
        return [...prev, ...additions]
      })
      toast.success(`Found ${result.variables.length} variables (${result.variables.length - variables.length} new)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Variable extraction failed')
    } finally {
      setAiLoading(null)
    }
  }, [templateContent, variables.length, callTemplateAI])

  const defaultClauseLibrary: Clause[] = [
    {
      id: '1',
      category: 'Payment Terms',
      title: 'Standard Payment Terms',
      content: 'Payment shall be due within {{paymentDays}} days of invoice date. Invoices will be sent to {{clientEmail}}. Late payments will incur a {{lateFeePercent}}% monthly fee.',
      variables: ['paymentDays', 'clientEmail', 'lateFeePercent']
    },
    {
      id: '2',
      category: 'Termination',
      title: 'Termination for Convenience',
      content: 'Either party may terminate this Agreement for convenience by providing {{noticeDays}} days written notice to the other party.',
      variables: ['noticeDays']
    },
    {
      id: '3',
      category: 'Liability',
      title: 'Liability Limitation',
      content: 'The maximum liability of either party under this Agreement shall not exceed {{maxLiability}}. This limitation applies to all claims arising from or related to this Agreement.',
      variables: ['maxLiability']
    },
    {
      id: '4',
      category: 'Confidentiality',
      title: 'Confidentiality Obligations',
      content: 'Both parties agree to maintain confidentiality of all proprietary information shared during the term of this Agreement and for {{confidentialityYears}} years thereafter.',
      variables: ['confidentialityYears']
    },
    {
      id: '5',
      category: 'Intellectual Property',
      title: 'IP Ownership',
      content: 'All intellectual property created under this Agreement shall be owned by {{ipOwner}}. The other party shall execute all documents necessary to perfect such ownership.',
      variables: ['ipOwner']
    },
    {
      id: '6',
      category: 'Warranties',
      title: 'Limited Warranty',
      content: '{{warrantyProvider}} warrants that services will be performed in a professional manner for a period of {{warrantyDays}} days. This warranty is exclusive and replaces all other warranties.',
      variables: ['warrantyProvider', 'warrantyDays']
    },
    {
      id: '7',
      category: 'Indemnification',
      title: 'Mutual Indemnification',
      content: 'Each party agrees to indemnify and hold harmless the other party from any claims, damages, or losses arising from its breach of this Agreement or its negligent acts.',
      variables: []
    },
    {
      id: '8',
      category: 'Governing Law',
      title: 'Jurisdiction and Venue',
      content: 'This Agreement shall be governed by the laws of {{jurisdiction}} without regard to conflict of law principles. Any disputes shall be resolved in the courts of {{venue}}.',
      variables: ['jurisdiction', 'venue']
    },
  ]

  // Load template data from API
  const loadTemplate = useCallback(async () => {
    if (isNew) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/templates/${params.id}`)
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load template')
      }
      
      const template = data.template
      setExistingTemplateId(template.id)
      setTemplateName(template.name || '')
      setTemplateDescription(template.description || '')
      setTemplateCategory(template.category || 'GENERAL')
      
      // Load from metadata
      const meta = template.metadata || {}
      setTemplateStatus(meta.status || 'draft')
      setTemplateContent(meta.content || '')
      setTemplateLanguage(meta.language || 'en-US')
      setVariables(meta.variables || [])
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load template'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [isNew, params.id])

  useEffect(() => {
    if (!isNew) {
      loadTemplate()
    } else {
      // Set default template structure for new templates
      setTemplateContent(
        '# {{contractTitle}}\n\n' +
        '## PARTIES\n' +
        'This Agreement is entered into on {{effectiveDate}} between:\n\n' +
        '**{{clientName}}** ("Client")\n' +
        'Address: {{clientAddress}}\n\n' +
        '**{{supplierName}}** ("Supplier")\n' +
        'Address: {{supplierAddress}}\n\n' +
        '## TERMS\n\n' +
        '### 1. Scope of Work\n' +
        '{{scopeOfWork}}\n\n' +
        '### 2. Compensation\n' +
        'Total Value: {{totalValue}} {{currency}}\n\n' +
        '### 3. Term\n' +
        'Start Date: {{startDate}}\n' +
        'End Date: {{endDate}}\n\n'
      )
      
      // Default variables
      setVariables([
        { name: 'contractTitle', label: 'Contract Title', type: 'text', required: true },
        { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
        { name: 'clientName', label: 'Client Name', type: 'text', required: true },
        { name: 'supplierName', label: 'Supplier Name', type: 'text', required: true },
        { name: 'totalValue', label: 'Total Value', type: 'currency', required: true },
        { name: 'currency', label: 'Currency', type: 'text', required: true, defaultValue: 'USD' },
        { name: 'startDate', label: 'Start Date', type: 'date', required: true },
        { name: 'endDate', label: 'End Date', type: 'date', required: true },
      ])
    }
  }, [isNew, loadTemplate])

  const insertClause = (clause: Clause) => {
    const clauseText = `\n\n### ${clause.title}\n${clause.content}\n\n`
    setTemplateContent(templateContent + clauseText)
    
    // Add any new variables from the clause
    const newVariables = clause.variables.filter(
      v => !variables.some(existing => existing.name === v)
    ).map(v => ({
      name: v,
      label: v.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      type: 'text' as const,
      required: false
    }))
    
    if (newVariables.length > 0) {
      setVariables([...variables, ...newVariables])
    }
    
    setShowClauseLibrary(false)
    toast.success(`Inserted "${clause.title}" clause`)
  }

  const addVariable = () => {
    setVariables([
      ...variables,
      { name: `var${variables.length + 1}`, label: 'New Variable', type: 'text', required: false }
    ])
  }

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required')
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      const templateData: TemplateData = {
        name: templateName.trim(),
        description: templateDescription.trim(),
        category: templateCategory,
        clauses: [],
        structure: {},
        metadata: {
          status: templateStatus,
          content: templateContent,
          language: templateLanguage,
          variables: variables,
          tags: [],
        },
        isActive: templateStatus === 'active',
      }
      
      let response: Response
      
      if (isNew) {
        // Create new template
        response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData),
        })
      } else {
        // Update existing template
        response = await fetch(`/api/templates/${existingTemplateId || params.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData),
        })
      }
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save template')
      }
      
      toast.success(isNew ? 'Template created successfully!' : 'Template saved successfully!')
      router.push('/templates')
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save template'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const renderPreview = () => {
    let preview = templateContent
    variables.forEach(variable => {
      const placeholder = `{{${variable.name}}}`
      const value = variable.defaultValue || `[${variable.label}]`
      preview = preview.replaceAll(placeholder, value)
    })
    return preview
  }

  const clauseLibrary = aiClauses.length > 0 ? aiClauses : defaultClauseLibrary

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/30 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading template...</p>
        </div>
      </div>
    )
  }

  if (error && !isNew) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/30 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Template</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => router.push('/templates')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Templates
              </Button>
              <Button onClick={loadTemplate}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumbs */}
        <div className="mb-2">
          <PageBreadcrumb />
        </div>
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4">
            <Link href="/templates">
              <Button variant="ghost" size="lg">
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-violet-500 to-pink-600 rounded-xl shadow-lg">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900">
                  {isNew ? 'New Template' : 'Edit Template'}
                </h1>
              </div>
              <p className="text-gray-600 text-lg">
                {isNew ? 'Create a new contract template' : 'Modify template settings and content'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isNew && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleGenerateTemplate}
                disabled={!!aiLoading || templateDescription.length < 10}
                className="border-violet-300 text-violet-700 hover:bg-violet-50"
              >
                {aiLoading === 'generate-template' ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5 mr-2" />
                )}
                Generate with AI
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <EyeOff className="h-5 w-5 mr-2" /> : <Eye className="h-5 w-5 mr-2" />}
              {showPreview ? 'Hide' : 'Preview'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !templateName}
              className="bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-600 hover:to-pink-700 text-white shadow-lg"
              size="lg"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Template Settings */}
          <div className="space-y-6">
            {/* Basic Info */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Template Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Template Name *
                  </label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Software License Agreement"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Description
                  </label>
                  <Textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Brief description of the template"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Category
                  </label>
                  <Select value={templateCategory} onValueChange={setTemplateCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Services">Services</SelectItem>
                      <SelectItem value="Legal">Legal</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Procurement">Procurement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Language
                  </label>
                  <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="en-GB">English (UK)</SelectItem>
                      <SelectItem value="es-ES">Spanish</SelectItem>
                      <SelectItem value="fr-FR">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Status
                  </label>
                  <Select value={templateStatus} onValueChange={(val: 'draft' | 'active') => setTemplateStatus(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Variables */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Variables ({variables.length})</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExtractVariables}
                      disabled={!!aiLoading || !templateContent.trim()}
                      className="border-violet-300 text-violet-700 hover:bg-violet-50"
                    >
                      {aiLoading === 'extract-variables' ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Variable className="h-4 w-4 mr-1" />
                      )}
                      AI Extract
                    </Button>
                    <Button size="sm" variant="outline" onClick={addVariable}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {variables.map((variable, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <code className="text-xs font-mono text-violet-600">
                            {'{{' + variable.name + '}}'}
                          </code>
                          <p className="text-sm font-medium text-gray-900">{variable.label}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {variable.type}
                            </Badge>
                            {variable.required && (
                              <Badge className="bg-red-500 text-white text-xs">Required</Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariable(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Template Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Editor */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Template Content</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowClauseLibrary(!showClauseLibrary)}
                    >
                      <Library className="h-4 w-4 mr-2" />
                      Clause Library
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!showPreview && templateContent.trim() && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {[
                      { key: 'improve', label: 'Improve', icon: Sparkles },
                      { key: 'simplify', label: 'Simplify', icon: Wand2 },
                      { key: 'strengthen', label: 'Strengthen', icon: ShieldCheck },
                      { key: 'make-compliant', label: 'Make Compliant', icon: Brain },
                    ].map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        size="sm"
                        variant="outline"
                        onClick={() => handleImproveContent(key as 'improve' | 'simplify' | 'strengthen' | 'make-compliant')}
                        disabled={!!aiLoading}
                        className="border-violet-300 text-violet-700 hover:bg-violet-50"
                      >
                        {aiLoading === key ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Icon className="h-3.5 w-3.5 mr-1" />
                        )}
                        {label}
                      </Button>
                    ))}
                  </div>
                )}
                {showPreview ? (
                  <div className="min-h-[600px] p-6 bg-white border border-gray-200 rounded-lg prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans">{renderPreview()}</pre>
                  </div>
                ) : (
                  <Textarea
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    placeholder="Enter template content here. Use {{variableName}} for variables."
                    className="min-h-[600px] font-mono text-sm"
                  />
                )}
              </CardContent>
            </Card>

            {/* Clause Library */}
            {showClauseLibrary && (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Library className="h-5 w-5" />
                      Clause Library
                      {aiClauses.length > 0 && (
                        <Badge className="bg-violet-100 text-violet-700 text-xs">AI Generated</Badge>
                      )}
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateClauses}
                      disabled={!!aiLoading || !templateName.trim()}
                      className="border-violet-300 text-violet-700 hover:bg-violet-50"
                    >
                      {aiLoading === 'generate-clauses' ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      AI Generate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clauseLibrary.map((clause) => (
                      <div
                        key={clause.id}
                        className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg border border-violet-200 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => insertClause(clause)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{clause.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {clause.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {clause.content}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={(e) => {
                            e.stopPropagation()
                            insertClause(clause)
                          }}>
                            <Plus className="h-3 w-3 mr-1" />
                            Insert
                          </Button>
                          {clause.variables.length > 0 && (
                            <span className="text-xs text-gray-500">
                              {clause.variables.length} variable{clause.variables.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
