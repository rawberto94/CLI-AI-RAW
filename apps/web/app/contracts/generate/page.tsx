'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  Download,
  Sparkles,
  AlertCircle,
  Calendar,
  DollarSign,
  User,
  Building,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  description: string
  category: string
  clauses?: unknown
  structure?: unknown
  metadata?: unknown
  variableCount?: number
  variables: Array<{
    name: string
    label: string
    type: string
    required: boolean
    defaultValue?: string
    options?: Array<{ value: string; label: string }>
  }>
}

interface FormData {
  [key: string]: string
}

export default function GenerateContractPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState<FormData>({})
  const [generatedContract, setGeneratedContract] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const totalSteps = 4

  useEffect(() => {
    loadTemplates()
  }, [])

  const pickFirst = (data: FormData, keys: string[], fallback: string) => {
    for (const key of keys) {
      const value = data[key]
      if (value) return value
    }
    return fallback
  }

  const interpolate = (text: string, data: FormData) => {
    return text.replace(/\{\{\s*([a-zA-Z0-9_\-\.]+)\s*\}\}/g, (_, key: string) => {
      const value = data[key]
      return value ?? ''
    })
  }

  const fetchClauseIndex = async () => {
    const index = new Map<string, { title?: string; content: string }>()

    const tryAdd = (raw: unknown) => {
      if (!Array.isArray(raw)) return
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const clause = item as Record<string, unknown>
        const id = typeof clause.id === 'string' ? clause.id : ''
        const title = typeof clause.title === 'string' ? clause.title : undefined
        const content = typeof clause.content === 'string' ? clause.content : ''
        if (!id || !content) continue
        index.set(id, { title, content })
      }
    }

    try {
      const [libraryResp, clausesResp] = await Promise.all([
        fetch('/api/clauses/library'),
        fetch('/api/clauses'),
      ])

      if (libraryResp.ok) {
        const json = (await libraryResp.json()) as { clauses?: unknown }
        tryAdd(json?.clauses)
      }

      if (clausesResp.ok) {
        const json = (await clausesResp.json()) as { clauses?: unknown }
        tryAdd(json?.clauses)
      }
    } catch {
      // Clause library unavailable — templates still work without pre-built clauses
    }

    return index
  }

  const mapApiVariables = (rawVariables: unknown): Template['variables'] => {
    if (!Array.isArray(rawVariables)) return []
    return rawVariables
      .map((v) => {
        if (!v || typeof v !== 'object') return null
        const variable = v as Record<string, unknown>
        const name = typeof variable.name === 'string' ? variable.name : ''
        if (!name) return null
        const label =
          typeof variable.displayName === 'string'
            ? variable.displayName
            : typeof variable.label === 'string'
              ? variable.label
              : name

        const type = typeof variable.type === 'string' ? variable.type : 'text'
        const required = Boolean(variable.required)
        const defaultValueRaw = variable.defaultValue
        const defaultValue =
          typeof defaultValueRaw === 'string' || typeof defaultValueRaw === 'number'
            ? String(defaultValueRaw)
            : undefined

        const optionsRaw = variable.options
        const options = Array.isArray(optionsRaw)
          ? optionsRaw
              .map((o) => {
                if (!o || typeof o !== 'object') return null
                const opt = o as Record<string, unknown>
                const value = typeof opt.value === 'string' ? opt.value : ''
                const label = typeof opt.label === 'string' ? opt.label : value
                if (!value) return null
                return { value, label }
              })
              .filter(Boolean) as Array<{ value: string; label: string }>
          : undefined

        return {
          name,
          label,
          type,
          required,
          defaultValue,
          options,
        }
      })
      .filter(Boolean) as Template['variables']
  }

  const mapApiTemplates = (rawTemplates: unknown): Template[] => {
    if (!Array.isArray(rawTemplates)) return []
    return rawTemplates
      .map((t) => {
        if (!t || typeof t !== 'object') return null
        const template = t as Record<string, unknown>
        const id = typeof template.id === 'string' ? template.id : ''
        const name = typeof template.name === 'string' ? template.name : ''
        if (!id || !name) return null

        const description = typeof template.description === 'string' ? template.description : ''
        const category = typeof template.category === 'string' ? template.category : 'GENERAL'

        const metadata = template.metadata
        let variableCount: number | undefined
        if (metadata && typeof metadata === 'object') {
          const vars = (metadata as Record<string, unknown>).variables
          if (Array.isArray(vars)) variableCount = vars.length
        }

        return {
          id,
          name,
          description,
          category,
          clauses: template.clauses,
          structure: template.structure,
          metadata,
          variableCount,
          variables: [],
        }
      })
      .filter(Boolean) as Template[]
  }

  const hydrateTemplateVariables = async (template: Template) => {
    if (template.variables.length > 0) return template

    try {
      const response = await fetch(`/api/templates/${template.id}/variables`)
      if (!response.ok) return template
      const json = (await response.json()) as { variables?: unknown }
      const variables = mapApiVariables(json?.variables)

      const hydrated: Template = {
        ...template,
        variables,
        variableCount: variables.length,
      }

      setTemplates((current) => current.map((t) => (t.id === template.id ? hydrated : t)))
      return hydrated
    } catch {
      return template
    }
  }

  const loadTemplates = async () => {
    // Try managed templates first
    try {
      const response = await fetch('/api/templates?limit=100')
      if (response.ok) {
        const json = (await response.json()) as { success?: boolean; templates?: unknown }
        if (json?.success && json.templates) {
          const apiTemplates = mapApiTemplates(json.templates)
          if (apiTemplates.length > 0) {
            setTemplates(apiTemplates)
            return
          }
        }
      }
    } catch {
      // No templates available
      setTemplates([])
    }
  }

  const selectTemplate = async (template: Template) => {
    const hydrated = await hydrateTemplateVariables(template)
    setSelectedTemplate(hydrated)

    // Initialize form data with default values
    const initialData: FormData = {}
    hydrated.variables.forEach((variable) => {
      if (variable.defaultValue !== undefined) {
        initialData[variable.name] = variable.defaultValue
      }
    })
    setFormData(initialData)

    setStep(2)
  }

  const updateFormData = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value })
  }

  const generateContract = async () => {
    if (!selectedTemplate) return
    
    setGenerating(true)
    setGenerationError(null)
    try {
      // Generate contract content from template
      let content = `# ${formData.contractTitle || selectedTemplate.name}\n\n`
      content += `## Agreement Details\n\n`
      content += `**Effective Date:** ${formData.effectiveDate}\n\n`

      const isManagedTemplate = Boolean(selectedTemplate.clauses || selectedTemplate.structure || selectedTemplate.metadata)
      if (isManagedTemplate) {
        const entries = selectedTemplate.variables
          .map((v) => ({ label: v.label, value: formData[v.name] }))
          .filter((x) => x.value)

        if (entries.length > 0) {
          content += `## Provided Values\n\n`
          for (const entry of entries) {
            content += `- **${entry.label}:** ${entry.value}\n`
          }
          content += `\n`
        }

        const structure = selectedTemplate.structure
        const structureObj = structure && typeof structure === 'object' ? (structure as Record<string, unknown>) : null

        const header = structureObj && typeof structureObj.header === 'string' ? structureObj.header : ''
        const footer = structureObj && typeof structureObj.footer === 'string' ? structureObj.footer : ''
        const sectionsRaw = structureObj ? structureObj.sections : undefined

        if (header) {
          content += `## Header\n\n`
          content += `${interpolate(header, formData)}\n\n`
        }

        if (Array.isArray(sectionsRaw) && sectionsRaw.length > 0) {
          const sections = sectionsRaw
            .filter((s) => s && typeof s === 'object')
            .map((s) => s as Record<string, unknown>)
            .map((s) => ({
              title:
                typeof s.title === 'string'
                  ? s.title
                  : typeof s.name === 'string'
                    ? s.name
                    : 'Section',
              order: typeof s.order === 'number' ? s.order : 999,
              clauses: Array.isArray(s.clauses) ? (s.clauses.filter((c) => typeof c === 'string') as string[]) : [],
              body: typeof s.body === 'string' ? s.body : typeof s.content === 'string' ? s.content : '',
            }))
            .sort((a, b) => a.order - b.order)

          const neededClauseIds = new Set<string>()
          for (const section of sections) {
            for (const clauseId of section.clauses) neededClauseIds.add(clauseId)
          }

          const clauseIndex = neededClauseIds.size > 0 ? await fetchClauseIndex() : new Map<string, { title?: string; content: string }>()

          content += `## Sections\n\n`
          for (const section of sections) {
            content += `### ${interpolate(section.title, formData)}\n\n`
            if (section.body) {
              content += `${interpolate(section.body, formData)}\n\n`
            }

            for (const clauseId of section.clauses) {
              const clause = clauseIndex.get(clauseId)
              if (!clause) continue
              if (clause.title) content += `**${interpolate(clause.title, formData)}**\n\n`
              content += `${interpolate(clause.content, formData)}\n\n`
            }
          }
        } else {
          const clauses = selectedTemplate.clauses
          if (Array.isArray(clauses) && clauses.length > 0) {
            content += `## Template Clauses\n\n`
            for (const clause of clauses) {
              if (typeof clause === 'string') {
                const text = interpolate(clause, formData)
                if (text.trim()) content += `${text}\n\n`
                continue
              }
              if (!clause || typeof clause !== 'object') continue
              const c = clause as Record<string, unknown>
              const title =
                typeof c.title === 'string'
                  ? c.title
                  : typeof c.name === 'string'
                    ? c.name
                    : typeof c.heading === 'string'
                      ? c.heading
                      : ''
              const body =
                typeof c.content === 'string'
                  ? c.content
                  : typeof c.text === 'string'
                    ? c.text
                    : typeof c.body === 'string'
                      ? c.body
                      : ''

              if (title) content += `### ${interpolate(title, formData)}\n`
              if (body) content += `${interpolate(body, formData)}\n\n`
            }
          } else {
            content += `## Template Content\n\n`
            content += `This document was generated from a managed template.\n\n`
          }
        }

        if (footer) {
          content += `## Footer\n\n`
          content += `${interpolate(footer, formData)}\n\n`
        }

        content += `---\n\n`
        const sigParty1 = pickFirst(
          formData,
          ['clientName', 'client_name', 'party1Name', 'party1_name', 'controllerName', 'controller_name', 'buyerName', 'buyer_name'],
          'Party 1'
        )
        const sigParty2 = pickFirst(
          formData,
          ['supplierName', 'supplier_name', 'party2Name', 'party2_name', 'processorName', 'processor_name'],
          'Party 2'
        )

        content += `**${sigParty1}**\n`
        content += `Signature: ___________________\n`
        content += `Date: ___________________\n\n`
        content += `**${sigParty2}**\n`
        content += `Signature: ___________________\n`
        content += `Date: ___________________\n`

        setGeneratedContract(content)
        setStep(4)
        return
      }
      
      if (selectedTemplate.id === '1') {
        content += `## SOFTWARE LICENSE AGREEMENT\n\n`
        content += `This Software License Agreement ("Agreement") is entered into on ${formData.effectiveDate} by and between:\n\n`
        content += `**${formData.clientName}** ("Client")\n`
        content += `Address: ${formData.clientAddress}\n\n`
        content += `and\n\n`
        content += `**${formData.supplierName}** ("Supplier")\n`
        content += `Address: ${formData.supplierAddress}\n\n`
        content += `### 1. Grant of License\n`
        content += `Supplier hereby grants to Client a non-exclusive, non-transferable license to use the Software during the term of this Agreement.\n\n`
        content += `### 2. License Fee and Payment\n`
        content += `Client agrees to pay Supplier a license fee of ${formData.totalValue} ${formData.currency}.\n\n`
        content += `### 3. Term\n`
        content += `This Agreement shall commence on ${formData.startDate} and shall continue until ${formData.endDate}.\n\n`
        content += `### 4. Termination\n`
        content += `Either party may terminate this Agreement upon 30 days written notice.\n\n`
        content += `### 5. Confidentiality\n`
        content += `Both parties agree to maintain confidentiality of proprietary information.\n\n`
        content += `### 6. Limitation of Liability\n`
        content += `Supplier's liability shall not exceed the total fees paid under this Agreement.\n\n`
      } else if (selectedTemplate.id === '2') {
        content += `## MASTER SERVICES AGREEMENT\n\n`
        content += `This Agreement is between ${formData.clientName} ("Client") and ${formData.supplierName} ("Supplier").\n\n`
        content += `### Scope of Work\n${formData.scopeOfWork}\n\n`
        content += `### Compensation\n${formData.totalValue}\n\n`
        content += `### Payment Terms\n${formData.paymentTerms}\n\n`
      } else if (selectedTemplate.id === '3') {
        content += `## NON-DISCLOSURE AGREEMENT\n\n`
        content += `This NDA is between ${formData.party1Name} and ${formData.party2Name}.\n\n`
        content += `### Purpose\n${formData.purpose}\n\n`
        content += `### Confidentiality Period\n${formData.confidentialityPeriod} years\n\n`
      } else if (selectedTemplate.id === '4') {
        content += `## STATEMENT OF WORK (SOW)\n\n`
        content += `This Statement of Work ("SoW") is effective as of ${formData.effectiveDate} and is entered into by and between ${formData.clientName} ("Client") and ${formData.supplierName} ("Supplier").\n\n`
        content += `### Project\n**${formData.projectName}**\n\n`
        content += `### Scope / Description\n${formData.scopeOfWork}\n\n`
        content += `### Deliverables\n${formData.deliverables}\n\n`
        if (formData.milestones) {
          content += `### Milestones\n${formData.milestones}\n\n`
        }
        content += `### Term\nStart: ${formData.startDate}\nEnd: ${formData.endDate}\n\n`
        content += `### Fees & Payment\nTotal: ${formData.totalValue}\nPayment Terms: ${formData.paymentTerms}\n\n`
      } else if (selectedTemplate.id === '5') {
        content += `## SERVICE LEVEL AGREEMENT (SLA)\n\n`
        content += `This SLA is effective as of ${formData.effectiveDate} between ${formData.clientName} ("Customer") and ${formData.supplierName} ("Provider").\n\n`
        content += `### Service\n${formData.serviceName}\n\n`
        content += `### Availability\nUptime Target: ${formData.uptimeTarget}%\n\n`
        content += `### Support\nSupport Hours: ${formData.supportHours}\nInitial Response Time: ${formData.responseTime}\n\n`
        content += `### Service Credits\n${formData.serviceCredits || 'To be defined based on availability shortfalls.'}\n\n`
      } else if (selectedTemplate.id === '6') {
        content += `## DATA PROCESSING ADDENDUM (DPA)\n\n`
        content += `This DPA is effective as of ${formData.effectiveDate} between ${formData.controllerName} ("Controller") and ${formData.processorName} ("Processor").\n\n`
        content += `### Processing Description\n${formData.processingDescription}\n\n`
        content += `### Categories of Data\n${formData.dataTypes}\n\n`
        content += `### Security Measures\n${formData.securityMeasures || 'Appropriate technical and organizational measures will be implemented to protect personal data.'}\n\n`
      } else if (selectedTemplate.id === '7') {
        content += `## ORDER FORM / PURCHASE ORDER\n\n`
        content += `Order Number: ${formData.orderNumber}\n`
        content += `Order Date: ${formData.orderDate}\n\n`
        content += `Buyer: ${formData.buyerName}\n`
        content += `Supplier: ${formData.supplierName}\n\n`
        content += `### Items / Services\n${formData.items}\n\n`
        content += `### Total\n${formData.totalValue} ${formData.currency}\n\n`
        content += `### Payment Terms\n${formData.paymentTerms}\n\n`
        if (formData.deliveryDate) {
          content += `### Delivery Date\n${formData.deliveryDate}\n\n`
        }
      } else if (selectedTemplate.id === '8') {
        content += `## CONTRACT AMENDMENT\n\n`
        content += `This Amendment ("Amendment") is effective as of ${formData.effectiveDate} and amends the ${formData.originalAgreementTitle} (the "Original Agreement") between ${formData.party1Name} and ${formData.party2Name}.\n\n`
        content += `### Amendments\n${formData.changes}\n\n`
        content += `### No Other Changes\nExcept as expressly modified by this Amendment, the Original Agreement remains in full force and effect.\n\n`
      } else {
        content += `## AGREEMENT\n\n`
        content += `This document was generated from the selected template.\n\n`
      }
      
      content += `---\n\n`
      const sigParty1 = formData.clientName || formData.party1Name || formData.controllerName || formData.buyerName || 'Party 1'
      const sigParty2 = formData.supplierName || formData.party2Name || formData.processorName || 'Party 2'

      content += `**${sigParty1}**\n`
      content += `Signature: ___________________\n`
      content += `Date: ___________________\n\n`
      content += `**${sigParty2}**\n`
      content += `Signature: ___________________\n`
      content += `Date: ___________________\n`
      
      setGeneratedContract(content)
      setStep(4)
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate contract. Please try again.');
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadMarkdown = () => {
    if (!generatedContract) return;
    const blob = new Blob([generatedContract], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${formData.contractTitle || 'contract'}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDownloadText = () => {
    if (!generatedContract) return;
    const blob = new Blob([generatedContract], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${formData.contractTitle || 'contract'}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const [saving, setSaving] = useState(false);

  const handleSaveToDrafts = async () => {
    if (!generatedContract || !selectedTemplate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.contractTitle || selectedTemplate.name,
          type: selectedTemplate.id === '3' ? 'NDA' : 'MSA',
          sourceType: 'TEMPLATE',
          templateId: selectedTemplate.id,
          content: generatedContract,
          variables: formData,
        }),
      });
      if (!res.ok) throw new Error('Failed to save draft');
      toast.success('Contract saved as draft');
      router.push('/drafting');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 2 && selectedTemplate) {
      const requiredFields = selectedTemplate.variables.filter(v => v.required)
      return requiredFields.every(field => formData[field.name])
    }
    return true
  }

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-4 mb-8">
      {[1, 2, 3, 4].map((stepNum) => (
        <div key={stepNum} className="flex items-center">
          <div
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-full font-bold transition-all',
              step === stepNum
                ? 'bg-gradient-to-r from-violet-500 to-pink-600 text-white shadow-lg scale-110'
                : step > stepNum
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            )}
          >
            {step > stepNum ? <Check className="h-6 w-6" /> : stepNum}
          </div>
          {stepNum < 4 && (
            <div className={cn(
              'w-16 h-1 mx-2',
              step > stepNum ? 'bg-green-500' : 'bg-gray-200'
            )} />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-violet-500 to-pink-600 rounded-xl shadow-lg">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900">Generate Contract</h1>
            </div>
            <p className="text-gray-600 text-lg">
              Create a new contract from a template in just a few steps
            </p>
          </div>
          
          <Link href="/contracts">
            <Button variant="ghost" size="lg">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Cancel
            </Button>
          </Link>
        </div>

        {renderStepIndicator()}

        {/* Step 1: Select Template */}
        {step === 1 && (
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Step 1: Choose a Template</CardTitle>
              <p className="text-gray-600">Select the type of contract you want to generate</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => selectTemplate(template)}
                    className="p-6 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border-2 border-violet-200 hover:border-violet-400 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{template.name}</h3>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{template.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <FileText className="h-4 w-4" />
                      <span>{(template.variableCount ?? template.variables.length) || 0} fields to fill</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Fill Variables */}
        {step === 2 && selectedTemplate && (
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Step 2: Fill Contract Details</CardTitle>
              <p className="text-gray-600">Provide information for {selectedTemplate.name}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedTemplate.variables.map((variable) => (
                  <div key={variable.name} className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      {variable.type === 'date' && <Calendar className="h-4 w-4 text-gray-500" />}
                      {variable.type === 'currency' && <DollarSign className="h-4 w-4 text-gray-500" />}
                      {(variable.name.includes('Name') || variable.name.includes('party')) && <User className="h-4 w-4 text-gray-500" />}
                      {variable.name.includes('Address') && <Building className="h-4 w-4 text-gray-500" />}
                      {variable.label}
                      {variable.required && <span className="text-red-500">*</span>}
                    </label>
                    {variable.type === 'select' && variable.options && variable.options.length > 0 ? (
                      <Select
                        value={formData[variable.name] || ''}
                        onValueChange={(value) => updateFormData(variable.name, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${variable.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {variable.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : variable.type === 'textarea' ? (
                      <Textarea
                        value={formData[variable.name] || ''}
                        onChange={(e) => updateFormData(variable.name, e.target.value)}
                        placeholder={`Enter ${variable.label.toLowerCase()}`}
                        rows={4}
                        required={variable.required}
                      />
                    ) : (
                      <Input
                        type={variable.type === 'number' ? 'number' : variable.type === 'date' ? 'date' : 'text'}
                        value={formData[variable.name] || ''}
                        onChange={(e) => updateFormData(variable.name, e.target.value)}
                        placeholder={`Enter ${variable.label.toLowerCase()}`}
                        required={variable.required}
                      />
                    )}
                  </div>
                ))}
              </div>

              {!canProceed() && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Required fields missing</p>
                    <p className="text-sm text-yellow-700">Please fill in all required fields to continue</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceed()}
                  className="bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-600 hover:to-pink-700 text-white"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review and Generate */}
        {step === 3 && selectedTemplate && (
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl">Step 3: Review and Generate</CardTitle>
              <p className="text-gray-600">Review your information before generating the contract</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedTemplate.variables.map((variable) => (
                  formData[variable.name] && (
                    <div key={variable.name} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm font-medium text-gray-500 uppercase mb-1">
                        {variable.label}
                      </p>
                      <p className="text-gray-900 font-medium">
                        {formData[variable.name]}
                      </p>
                    </div>
                  )
                ))}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Edit Details
                </Button>
                <Button
                  onClick={generateContract}
                  disabled={generating}
                  className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-purple-700 text-white"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Contract
                    </>
                  )}
                </Button>
                {generationError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {generationError}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Contract Generated */}
        {step === 4 && (
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl">
                  <Check className="h-7 w-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Contract Generated Successfully!</CardTitle>
                  <p className="text-gray-600">Your contract is ready for review and download</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-6 bg-white border-2 border-gray-200 rounded-lg prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans">{generatedContract}</pre>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Another
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleDownloadMarkdown}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Markdown
                  </Button>
                  <Button variant="outline" onClick={handleDownloadText}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Text
                  </Button>
                  <Button
                    onClick={handleSaveToDrafts}
                    disabled={saving}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
                  >
                    {saving ? 'Saving...' : 'Save to Drafts'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
