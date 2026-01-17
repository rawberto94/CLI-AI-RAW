'use client'

import React, { useState, useEffect } from 'react'
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
  Type,
  Code,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

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

export default function TemplateEditorPage() {
  const params = useParams()
  const router = useRouter()
  const isNew = params.id === 'new'
  
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')
  const [templateLanguage, setTemplateLanguage] = useState('en-US')
  const [templateStatus, setTemplateStatus] = useState<'draft' | 'active'>('draft')
  const [templateContent, setTemplateContent] = useState('')
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [showClauseLibrary, setShowClauseLibrary] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const clauseLibrary: Clause[] = [
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  const loadTemplate = async () => {
    setLoading(true)
    try {
      // Mock loading - in production, fetch from API
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setTemplateName('Software License Agreement')
      setTemplateDescription('Standard SaaS software licensing agreement with usage terms')
      setTemplateCategory('Technology')
      setTemplateLanguage('en-US')
      setTemplateStatus('active')
      setTemplateContent(
        '# {{contractTitle}}\n\n' +
        '## SOFTWARE LICENSE AGREEMENT\n\n' +
        'This Agreement is entered into on {{effectiveDate}} between {{clientName}} and {{supplierName}}.\n\n' +
        '### 1. Grant of License\n' +
        'Supplier grants Client a non-exclusive, non-transferable license to use the Software.\n\n' +
        '### 2. Fees\n' +
        'Client agrees to pay {{totalValue}} {{currency}} per {{billingCycle}}.\n\n' +
        '### 3. Term and Termination\n' +
        'This Agreement begins on {{startDate}} and continues until {{endDate}}.\n\n'
      )
      setVariables([
        { name: 'contractTitle', label: 'Contract Title', type: 'text', required: true },
        { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
        { name: 'clientName', label: 'Client Name', type: 'text', required: true },
        { name: 'supplierName', label: 'Supplier Name', type: 'text', required: true },
        { name: 'totalValue', label: 'License Fee', type: 'currency', required: true },
        { name: 'currency', label: 'Currency', type: 'text', required: true, defaultValue: 'USD' },
        { name: 'billingCycle', label: 'Billing Cycle', type: 'text', required: true, defaultValue: 'month' },
        { name: 'startDate', label: 'Start Date', type: 'date', required: true },
        { name: 'endDate', label: 'End Date', type: 'date', required: true },
      ])
    } catch {
      // Template loading failed silently
    } finally {
      setLoading(false)
    }
  }

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
    setSaving(true)
    try {
      // In production, save to API
      await new Promise(resolve => setTimeout(resolve, 1000))
      router.push('/templates')
    } catch {
      // Save failed silently
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
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
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
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

          <div className="flex gap-2">
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
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-lg"
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
                  <Button size="sm" variant="outline" onClick={addVariable}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {variables.map((variable, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <code className="text-xs font-mono text-purple-600">
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowClauseLibrary(!showClauseLibrary)}
                  >
                    <Library className="h-4 w-4 mr-2" />
                    Clause Library
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
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
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Library className="h-5 w-5" />
                    Clause Library
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clauseLibrary.map((clause) => (
                      <div
                        key={clause.id}
                        className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:shadow-md transition-shadow cursor-pointer"
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
