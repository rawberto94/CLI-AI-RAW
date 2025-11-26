'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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

interface Template {
  id: string
  name: string
  description: string
  category: string
  variables: Array<{
    name: string
    label: string
    type: string
    required: boolean
    defaultValue?: string
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

  const totalSteps = 4

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    // Mock templates
    const mockTemplates: Template[] = [
      {
        id: '1',
        name: 'Software License Agreement',
        description: 'Standard SaaS software licensing agreement with usage terms',
        category: 'Technology',
        variables: [
          { name: 'contractTitle', label: 'Contract Title', type: 'text', required: true },
          { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
          { name: 'clientName', label: 'Client Name', type: 'text', required: true },
          { name: 'clientAddress', label: 'Client Address', type: 'text', required: true },
          { name: 'supplierName', label: 'Supplier Name', type: 'text', required: true },
          { name: 'supplierAddress', label: 'Supplier Address', type: 'text', required: true },
          { name: 'totalValue', label: 'License Fee', type: 'currency', required: true },
          { name: 'currency', label: 'Currency', type: 'text', required: true, defaultValue: 'USD' },
          { name: 'startDate', label: 'Start Date', type: 'date', required: true },
          { name: 'endDate', label: 'End Date', type: 'date', required: true },
        ]
      },
      {
        id: '2',
        name: 'Master Services Agreement',
        description: 'Comprehensive MSA template for professional services',
        category: 'Services',
        variables: [
          { name: 'contractTitle', label: 'Contract Title', type: 'text', required: true },
          { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
          { name: 'clientName', label: 'Client Name', type: 'text', required: true },
          { name: 'supplierName', label: 'Supplier Name', type: 'text', required: true },
          { name: 'scopeOfWork', label: 'Scope of Work', type: 'textarea', required: true },
          { name: 'totalValue', label: 'Total Value', type: 'currency', required: true },
          { name: 'paymentTerms', label: 'Payment Terms', type: 'text', required: true },
          { name: 'startDate', label: 'Start Date', type: 'date', required: true },
          { name: 'endDate', label: 'End Date', type: 'date', required: true },
        ]
      },
      {
        id: '3',
        name: 'Non-Disclosure Agreement',
        description: 'Mutual NDA with customizable confidentiality terms',
        category: 'Legal',
        variables: [
          { name: 'party1Name', label: 'Party 1 Name', type: 'text', required: true },
          { name: 'party2Name', label: 'Party 2 Name', type: 'text', required: true },
          { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
          { name: 'purpose', label: 'Purpose', type: 'textarea', required: true },
          { name: 'confidentialityPeriod', label: 'Confidentiality Period (years)', type: 'number', required: true },
        ]
      },
    ]
    setTemplates(mockTemplates)
  }

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template)
    
    // Initialize form data with default values
    const initialData: FormData = {}
    template.variables.forEach(variable => {
      if (variable.defaultValue) {
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
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Generate contract content
      let content = `# ${formData.contractTitle || selectedTemplate.name}\n\n`
      content += `## Agreement Details\n\n`
      content += `**Effective Date:** ${formData.effectiveDate}\n\n`
      
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
      } else {
        content += `## NON-DISCLOSURE AGREEMENT\n\n`
        content += `This NDA is between ${formData.party1Name} and ${formData.party2Name}.\n\n`
        content += `### Purpose\n${formData.purpose}\n\n`
        content += `### Confidentiality Period\n${formData.confidentialityPeriod} years\n\n`
      }
      
      content += `---\n\n`
      content += `**${formData.clientName || formData.party1Name}**\n`
      content += `Signature: ___________________\n`
      content += `Date: ___________________\n\n`
      content += `**${formData.supplierName || formData.party2Name}**\n`
      content += `Signature: ___________________\n`
      content += `Date: ___________________\n`
      
      setGeneratedContract(content)
      setStep(4)
    } catch (error) {
      console.error('Failed to generate contract:', error)
    } finally {
      setGenerating(false)
    }
  }

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
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg scale-110'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
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
                    className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{template.name}</h3>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{template.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <FileText className="h-4 w-4" />
                      <span>{template.variables.length} fields to fill</span>
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
                    {variable.type === 'textarea' ? (
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
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
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
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Contract Generated */}
        {step === 4 && (
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
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
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Word
                  </Button>
                  <Button
                    onClick={() => router.push('/contracts')}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                  >
                    Save to Contracts
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
