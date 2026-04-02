'use client'

/**
 * Create New Contract Page
 * 
 * A comprehensive wizard-style form for creating contracts manually
 * without uploading a file. Supports metadata entry, party management,
 * and optional file attachment.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import {
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Tags,
  Users,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  Save,
  ArrowLeft,
  AlertCircle,
  User,
  Mail,
  Building,
  FileSignature,
  Clock,
  Shield,
  Loader2,
  X,
  Eye,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant';
import { toast } from 'sonner'

// ============ SCHEMA ============

const partySchema = z.object({
  name: z.string().min(1, 'Party name is required'),
  role: z.enum(['client', 'vendor', 'partner', 'subcontractor', 'other']),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  company: z.string().optional(),
})

const contractFormSchema = z.object({
  // Step 1: Basic Info
  title: z.string().min(3, 'Title must be at least 3 characters'),
  type: z.string().min(1, 'Contract type is required'),
  description: z.string().optional(),
  
  // Step 2: Parties
  parties: z.array(partySchema).min(1, 'At least one party is required'),
  
  // Step 3: Terms
  effectiveDate: z.date({ required_error: 'Effective date is required' }),
  expirationDate: z.date().optional(),
  autoRenew: z.boolean().default(false),
  renewalNoticeDays: z.number().min(0).optional(),
  
  // Step 4: Financials
  totalValue: z.number().min(0).optional(),
  currency: z.string().default('USD'),
  paymentTerms: z.string().optional(),
  
  // Step 5: Additional
  tags: z.array(z.string()).default([]),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  confidential: z.boolean().default(false),
  internalNotes: z.string().optional(),
})

type ContractFormData = z.infer<typeof contractFormSchema>

// ============ CONSTANTS ============

const CONTRACT_TYPES = [
  { value: 'msa', label: 'Master Service Agreement (MSA)' },
  { value: 'nda', label: 'Non-Disclosure Agreement (NDA)' },
  { value: 'sow', label: 'Statement of Work (SoW)' },
  { value: 'sla', label: 'Service Level Agreement (SLA)' },
  { value: 'dpa', label: 'Data Processing Agreement (DPA)' },
  { value: 'employment', label: 'Employment Agreement' },
  { value: 'consulting', label: 'Consulting Agreement' },
  { value: 'license', label: 'License Agreement' },
  { value: 'lease', label: 'Lease Agreement' },
  { value: 'procurement', label: 'Procurement Contract' },
  { value: 'partnership', label: 'Partnership Agreement' },
  { value: 'amendment', label: 'Contract Amendment' },
  { value: 'addendum', label: 'Contract Addendum' },
  { value: 'other', label: 'Other' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP - British Pound', symbol: '£' },
  { value: 'CAD', label: 'CAD - Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'AUD - Australian Dollar', symbol: 'A$' },
  { value: 'JPY', label: 'JPY - Japanese Yen', symbol: '¥' },
  { value: 'CHF', label: 'CHF - Swiss Franc', symbol: 'CHF' },
  { value: 'CNY', label: 'CNY - Chinese Yuan', symbol: '¥' },
]

const PARTY_ROLES = [
  { value: 'client', label: 'Client' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'partner', label: 'Partner' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'other', label: 'Other' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
]

const WIZARD_STEPS = [
  { id: 'basic', title: 'Basic Info', icon: FileText, description: 'Title, type, and description' },
  { id: 'parties', title: 'Parties', icon: Users, description: 'Add contract parties' },
  { id: 'terms', title: 'Terms', icon: Calendar, description: 'Dates and renewal' },
  { id: 'financials', title: 'Financials', icon: DollarSign, description: 'Value and payment terms' },
  { id: 'additional', title: 'Additional', icon: Tags, description: 'Tags, priority, and notes' },
]

// ============ COMPONENTS ============

interface StepIndicatorProps {
  steps: typeof WIZARD_STEPS
  currentStep: number
  completedSteps: Set<number>
  onStepClick: (step: number) => void
}

function StepIndicator({ steps, currentStep, completedSteps, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => {
        const StepIcon = step.icon
        const isActive = index === currentStep
        const isCompleted = completedSteps.has(index)
        const isClickable = isCompleted || index <= currentStep
        
        return (
          <React.Fragment key={step.id}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => isClickable && onStepClick(index)}
                    disabled={!isClickable}
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-full transition-all",
                      isActive && "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25",
                      isCompleted && !isActive && "bg-violet-100 text-violet-700",
                      !isActive && !isCompleted && "bg-slate-100 text-slate-400",
                      isClickable && "cursor-pointer hover:scale-105",
                      !isClickable && "cursor-not-allowed"
                    )}
                  >
                    {isCompleted && !isActive ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="activeStep"
                        className="absolute inset-0 rounded-full border-2 border-violet-500"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-xs text-slate-500">{step.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {index < steps.length - 1 && (
              <div className={cn(
                "w-12 h-0.5 rounded-full transition-colors",
                isCompleted ? "bg-violet-300" : "bg-slate-200"
              )} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ============ MAIN COMPONENT ============

export default function CreateContractPage() {
  const router = useRouter()
  
  // State
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  
  // Form
  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      title: '',
      type: '',
      description: '',
      parties: [{ name: '', role: 'client', email: '', company: '' }],
      effectiveDate: new Date(),
      autoRenew: false,
      renewalNoticeDays: 30,
      totalValue: undefined,
      currency: 'USD',
      paymentTerms: '',
      tags: [],
      priority: 'medium',
      confidential: false,
      internalNotes: '',
    },
    mode: 'onChange',
  })
  
  const { fields: partyFields, append: appendParty, remove: removeParty } = useFieldArray({
    control: form.control,
    name: 'parties',
  })
  
  const tags = form.watch('tags')
  const formValues = form.watch()
  
  // Handlers
  const handleAddTag = useCallback(() => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      form.setValue('tags', [...tags, tagInput.trim()])
      setTagInput('')
    }
  }, [tagInput, tags, form])
  
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    form.setValue('tags', tags.filter(t => t !== tagToRemove))
  }, [tags, form])
  
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const fieldsToValidate: (keyof ContractFormData)[] = []
    
    switch (currentStep) {
      case 0: // Basic Info
        fieldsToValidate.push('title', 'type')
        break
      case 1: // Parties
        fieldsToValidate.push('parties')
        break
      case 2: // Terms
        fieldsToValidate.push('effectiveDate')
        break
      case 3: // Financials
        // All optional
        break
      case 4: // Additional
        // All optional
        break
    }
    
    const result = await form.trigger(fieldsToValidate)
    return result
  }, [currentStep, form])
  
  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep()
    if (isValid) {
      setCompletedSteps(prev => new Set([...prev, currentStep]))
      if (currentStep < WIZARD_STEPS.length - 1) {
        setCurrentStep(currentStep + 1)
      }
    }
  }, [currentStep, validateCurrentStep])
  
  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])
  
  const handleStepClick = useCallback((step: number) => {
    setCurrentStep(step)
  }, [])
  
  const handleSubmit = useCallback(async (data: ContractFormData) => {
    setIsSubmitting(true)
    
    try {
      // Build the contract payload
      const payload = {
        title: data.title,
        type: data.type.toUpperCase(),
        description: data.description || '',
        status: 'DRAFT',
        parties: data.parties.map(p => ({
          name: p.name,
          role: p.role.toUpperCase(),
          email: p.email || null,
          company: p.company || null,
        })),
        effectiveDate: data.effectiveDate.toISOString(),
        expirationDate: data.expirationDate?.toISOString() || null,
        autoRenew: data.autoRenew,
        renewalNoticeDays: data.renewalNoticeDays || null,
        totalValue: data.totalValue || null,
        currency: data.currency,
        paymentTerms: data.paymentTerms || null,
        tags: data.tags,
        priority: data.priority.toUpperCase(),
        confidential: data.confidential,
        internalNotes: data.internalNotes || null,
      }
      
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create contract')
      }
      
      const result = await response.json()
      
      toast.success('Contract created successfully!', {
        description: `${data.title} has been saved as a draft.`,
      })
      
      router.push(`/contracts/${result.id}`)
    } catch (error: unknown) {
      toast.error('Failed to create contract', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [router])
  
  // Progress calculation
  const progress = useMemo(() => {
    return ((currentStep + 1) / WIZARD_STEPS.length) * 100
  }, [currentStep])
  
  // Currency symbol
  const currencySymbol = useMemo(() => {
    return CURRENCIES.find(c => c.value === formValues.currency)?.symbol || '$'
  }, [formValues.currency])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/contracts')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Create New Contract</h1>
                <p className="text-sm text-slate-500">
                  Step {currentStep + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentStep].title}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={form.handleSubmit(handleSubmit)}
                disabled={isSubmitting}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <Progress value={progress} className="h-1" />
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Step Indicator */}
        <StepIndicator
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />
        
        <div className="flex gap-8">
          {/* Form Area */}
          <motion.div 
            className={cn("flex-1", showPreview && "max-w-xl")}
            layout
          >
            <Card className="shadow-lg border-slate-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {React.createElement(WIZARD_STEPS[currentStep].icon, { className: "h-5 w-5 text-violet-500" })}
                  {WIZARD_STEPS[currentStep].title}
                </CardTitle>
                <CardDescription>{WIZARD_STEPS[currentStep].description}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={(e) => e.preventDefault()}>
                  <AnimatePresence mode="wait">
                    {/* Step 0: Basic Info */}
                    {currentStep === 0 && (
                      <motion.div
                        key="basic"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="title" className="flex items-center gap-1">
                            Contract Title
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="title"
                            placeholder="e.g., Software Development Agreement with Acme Corp"
                            {...form.register('title')}
                            className={cn(form.formState.errors.title && "border-red-300 focus-visible:ring-red-500")}
                          />
                          {form.formState.errors.title && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {form.formState.errors.title.message}
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="type" className="flex items-center gap-1">
                            Contract Type
                            <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="type"
                            control={form.control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className={cn(form.formState.errors.type && "border-red-300")}>
                                  <SelectValue placeholder="Select contract type..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONTRACT_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {form.formState.errors.type && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {form.formState.errors.type.message}
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="description">Description (Optional)</Label>
                          <Textarea
                            id="description"
                            placeholder="Brief description of the contract purpose and scope..."
                            rows={4}
                            {...form.register('description')}
                          />
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Step 1: Parties */}
                    {currentStep === 1 && (
                      <motion.div
                        key="parties"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        {partyFields.map((field, index) => (
                          <Card key={field.id} className="border-slate-200">
                            <CardContent className="pt-4">
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-medium text-slate-700">
                                  Party {index + 1}
                                </span>
                                {partyFields.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeParty(index)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    Name
                                    <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    placeholder="Party name"
                                    {...form.register(`parties.${index}.name`)}
                                    className={cn(
                                      form.formState.errors.parties?.[index]?.name && "border-red-300"
                                    )}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label className="flex items-center gap-1">
                                    <FileSignature className="h-3 w-3" />
                                    Role
                                  </Label>
                                  <Controller
                                    name={`parties.${index}.role`}
                                    control={form.control}
                                    render={({ field }) => (
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {PARTY_ROLES.map((role) => (
                                            <SelectItem key={role.value} value={role.value}>
                                              {role.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label className="flex items-center gap-1">
                                    <Building className="h-3 w-3" />
                                    Company
                                  </Label>
                                  <Input
                                    placeholder="Company name"
                                    {...form.register(`parties.${index}.company`)}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    Email
                                  </Label>
                                  <Input
                                    type="email"
                                    placeholder="contact@example.com"
                                    {...form.register(`parties.${index}.email`)}
                                    className={cn(
                                      form.formState.errors.parties?.[index]?.email && "border-red-300"
                                    )}
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => appendParty({ name: '', role: 'vendor', email: '', company: '' })}
                          className="w-full border-dashed"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Another Party
                        </Button>
                      </motion.div>
                    )}
                    
                    {/* Step 2: Terms */}
                    {currentStep === 2 && (
                      <motion.div
                        key="terms"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Effective Date
                              <span className="text-red-500">*</span>
                            </Label>
                            <Controller
                              name="effectiveDate"
                              control={form.control}
                              render={({ field }) => (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !field.value && "text-muted-foreground",
                                        form.formState.errors.effectiveDate && "border-red-300"
                                      )}
                                    >
                                      <Calendar className="mr-2 h-4 w-4" />
                                      {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      mode="single"
                                      selected={field.value}
                                      onSelect={field.onChange}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              )}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expiration Date
                            </Label>
                            <Controller
                              name="expirationDate"
                              control={form.control}
                              render={({ field }) => (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      <Calendar className="mr-2 h-4 w-4" />
                                      {field.value ? format(field.value, 'PPP') : 'Pick a date (optional)'}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      mode="single"
                                      selected={field.value || undefined}
                                      onSelect={field.onChange}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              )}
                            />
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Auto-Renewal</Label>
                              <p className="text-sm text-slate-500">
                                Automatically renew this contract upon expiration
                              </p>
                            </div>
                            <Controller
                              name="autoRenew"
                              control={form.control}
                              render={({ field }) => (
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              )}
                            />
                          </div>
                          
                          {formValues.autoRenew && (
                            <div className="space-y-2 pl-4 border-l-2 border-violet-200">
                              <Label>Renewal Notice Period (Days)</Label>
                              <Input
                                type="number"
                                min={0}
                                placeholder="30"
                                className="max-w-[150px]"
                                {...form.register('renewalNoticeDays', { valueAsNumber: true })}
                              />
                              <p className="text-xs text-slate-500">
                                Days before expiration to send renewal notice
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Step 3: Financials */}
                    {currentStep === 3 && (
                      <motion.div
                        key="financials"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Total Contract Value
                            </Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                {currencySymbol}
                              </span>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="0.00"
                                className="pl-8"
                                {...form.register('totalValue', { valueAsNumber: true })}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Currency</Label>
                            <Controller
                              name="currency"
                              control={form.control}
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CURRENCIES.map((currency) => (
                                      <SelectItem key={currency.value} value={currency.value}>
                                        {currency.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Payment Terms</Label>
                          <Textarea
                            placeholder="e.g., Net 30, Monthly installments, Upon completion..."
                            rows={3}
                            {...form.register('paymentTerms')}
                          />
                        </div>
                        
                        <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
                          <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-violet-500 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-violet-900">Financial Information</p>
                              <p className="text-sm text-violet-700 mt-1">
                                All financial fields are optional. You can add or update them later when the contract is finalized.
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Step 4: Additional */}
                    {currentStep === 4 && (
                      <motion.div
                        key="additional"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                      >
                        <div className="space-y-2">
                          <Label className="flex items-center gap-1">
                            <Tags className="h-3 w-3" />
                            Tags
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add a tag..."
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleAddTag()
                                }
                              }}
                            />
                            <Button type="button" variant="outline" onClick={handleAddTag}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="gap-1 pr-1"
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="p-0.5 hover:bg-slate-300 rounded"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Controller
                            name="priority"
                            control={form.control}
                            render={({ field }) => (
                              <div className="flex gap-2">
                                {PRIORITY_OPTIONS.map((option) => (
                                  <Button
                                    key={option.value}
                                    type="button"
                                    variant="outline"
                                    onClick={() => field.onChange(option.value)}
                                    className={cn(
                                      "flex-1",
                                      field.value === option.value && option.color
                                    )}
                                  >
                                    {option.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-slate-600" />
                            <div>
                              <Label className="text-sm">Confidential</Label>
                              <p className="text-xs text-slate-500">
                                Mark this contract as confidential
                              </p>
                            </div>
                          </div>
                          <Controller
                            name="confidential"
                            control={form.control}
                            render={({ field }) => (
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Internal Notes</Label>
                          <Textarea
                            placeholder="Any internal notes about this contract..."
                            rows={3}
                            {...form.register('internalNotes')}
                          />
                          <p className="text-xs text-slate-500">
                            These notes are only visible to your team
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-8 pt-6 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentStep === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>
                    
                    {currentStep < WIZARD_STEPS.length - 1 ? (
                      <Button
                        type="button"
                        onClick={handleNext}
                        className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={form.handleSubmit(handleSubmit)}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Create Contract
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Preview Panel */}
          <AnimatePresence>
            {showPreview && (
              <motion.div key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-80 shrink-0"
              >
                <Card className="sticky top-28 shadow-lg border-slate-200/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4 text-violet-500" />
                      Live Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <span className="text-slate-500">Title</span>
                      <p className="font-medium truncate">
                        {formValues.title || 'Untitled Contract'}
                      </p>
                    </div>
                    
                    <div>
                      <span className="text-slate-500">Type</span>
                      <p className="font-medium">
                        {CONTRACT_TYPES.find(t => t.value === formValues.type)?.label || 'Not selected'}
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <span className="text-slate-500">Parties ({formValues.parties.length})</span>
                      <div className="mt-1 space-y-1">
                        {formValues.parties.map((party, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            <span className="truncate">{party.name || 'Unnamed'}</span>
                            <Badge variant="outline" className="text-[10px] px-1">
                              {party.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-500">Effective</span>
                        <p className="font-medium">
                          {formValues.effectiveDate ? format(formValues.effectiveDate, 'PP') : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Expires</span>
                        <p className="font-medium">
                          {formValues.expirationDate ? format(formValues.expirationDate, 'PP') : '-'}
                        </p>
                      </div>
                    </div>
                    
                    {formValues.totalValue && (
                      <div>
                        <span className="text-slate-500">Value</span>
                        <p className="font-medium text-lg text-violet-600">
                          {currencySymbol}{formValues.totalValue.toLocaleString()}
                        </p>
                      </div>
                    )}
                    
                    {tags.length > 0 && (
                      <div>
                        <span className="text-slate-500">Tags</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.slice(0, 5).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                          {tags.length > 5 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{tags.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Badge className={PRIORITY_OPTIONS.find(p => p.value === formValues.priority)?.color}>
                        {formValues.priority} priority
                      </Badge>
                      {formValues.confidential && (
                        <Badge variant="outline" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Confidential
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
