'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  Building2,
  User,
  Calendar,
  DollarSign,
  AlertTriangle,
  Sparkles,
  Loader2,
  Send,
  Edit3,
  Download,
  Eye,
  RefreshCw,
  Shield,
  Scale,
  Briefcase,
  Clock,
  CheckCircle2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  avgGenerationTime: string;
  requiredFields: string[];
}

interface GenerationStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
}

interface ContractFormData {
  templateId: string;
  counterparty: string;
  counterpartyContact: string;
  counterpartyEmail: string;
  startDate: string;
  endDate: string;
  totalValue: string;
  currency: string;
  paymentTerms: string;
  description: string;
  specialTerms: string;
  jurisdiction: string;
  autoRenew: boolean;
  renewalNotice: string;
}

// ============================================================================
// Constants
// ============================================================================

const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'nda',
    name: 'Non-Disclosure Agreement',
    description: 'Standard NDA for protecting confidential information',
    category: 'Legal',
    icon: Shield,
    avgGenerationTime: '30 seconds',
    requiredFields: ['counterparty', 'startDate', 'jurisdiction'],
  },
  {
    id: 'service_agreement',
    name: 'Service Agreement',
    description: 'Professional services contract with scope and deliverables',
    category: 'Services',
    icon: Briefcase,
    avgGenerationTime: '2 minutes',
    requiredFields: ['counterparty', 'startDate', 'endDate', 'totalValue', 'description'],
  },
  {
    id: 'software_license',
    name: 'Software License Agreement',
    description: 'SaaS or software licensing terms',
    category: 'Technology',
    icon: FileText,
    avgGenerationTime: '2 minutes',
    requiredFields: ['counterparty', 'startDate', 'totalValue', 'paymentTerms'],
  },
  {
    id: 'employment',
    name: 'Employment Contract',
    description: 'Standard employment agreement with terms and conditions',
    category: 'HR',
    icon: User,
    avgGenerationTime: '3 minutes',
    requiredFields: ['counterparty', 'startDate', 'totalValue', 'jurisdiction'],
  },
  {
    id: 'vendor',
    name: 'Vendor Agreement',
    description: 'Contract for vendor/supplier relationships',
    category: 'Procurement',
    icon: Building2,
    avgGenerationTime: '2 minutes',
    requiredFields: ['counterparty', 'startDate', 'totalValue', 'paymentTerms'],
  },
  {
    id: 'consulting',
    name: 'Consulting Agreement',
    description: 'Independent contractor or consulting engagement',
    category: 'Services',
    icon: Scale,
    avgGenerationTime: '2 minutes',
    requiredFields: ['counterparty', 'startDate', 'endDate', 'totalValue', 'description'],
  },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'];
const PAYMENT_TERMS = ['Net 30', 'Net 45', 'Net 60', 'Net 90', 'Due on Receipt', 'Monthly', 'Quarterly', 'Annually'];
const JURISDICTIONS = [
  'Delaware, USA',
  'California, USA',
  'New York, USA',
  'United Kingdom',
  'Germany',
  'Singapore',
  'Ireland',
];

// ============================================================================
// Components
// ============================================================================

/**
 * Template selection card
 */
const TemplateCard: React.FC<{
  template: ContractTemplate;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ template, isSelected, onSelect }) => {
  const Icon = template.icon;

  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
        isSelected
          ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-100'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      }`}
    >
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center"
        >
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
        isSelected ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-600'
      }`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-slate-900">{template.name}</h3>
      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{template.description}</p>
      <div className="flex items-center gap-3 mt-3 text-xs">
        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">{template.category}</span>
        <span className="flex items-center gap-1 text-slate-400">
          <Clock className="w-3 h-3" />
          {template.avgGenerationTime}
        </span>
      </div>
    </motion.button>
  );
};

/**
 * Form field wrapper with label
 */
const FormField: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, error, children }) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

/**
 * Progress indicator for generation steps
 */
const GenerationProgress: React.FC<{ steps: GenerationStep[]; currentStep: number }> = ({ steps, currentStep }) => (
  <div className="space-y-3">
    {steps.map((step, index) => (
      <motion.div
        key={step.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        className="flex items-start gap-3"
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          step.isComplete
            ? 'bg-green-500 text-white'
            : index === currentStep
              ? 'bg-violet-500 text-white animate-pulse'
              : 'bg-slate-200 text-slate-400'
        }`}>
          {step.isComplete ? (
            <Check className="w-4 h-4" />
          ) : index === currentStep ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span className="text-sm font-medium">{index + 1}</span>
          )}
        </div>
        <div className="flex-1 pt-1">
          <div className={`font-medium ${step.isComplete ? 'text-green-600' : index === currentStep ? 'text-violet-600' : 'text-slate-400'}`}>
            {step.title}
          </div>
          <div className="text-sm text-slate-500">{step.description}</div>
        </div>
      </motion.div>
    ))}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const ContractGenerationWorkflow: React.FC<{
  onComplete?: (contractId: string) => void;
  onCancel?: () => void;
}> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ContractFormData>({
    templateId: '',
    counterparty: '',
    counterpartyContact: '',
    counterpartyEmail: '',
    startDate: '',
    endDate: '',
    totalValue: '',
    currency: 'USD',
    paymentTerms: 'Net 30',
    description: '',
    specialTerms: '',
    jurisdiction: 'Delaware, USA',
    autoRenew: false,
    renewalNotice: '30',
  });
  const [_isGenerating, setIsGenerating] = useState(false);
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  const [currentGenStep, setCurrentGenStep] = useState(0);
  const [generatedContract, setGeneratedContract] = useState<{
    id: string;
    name: string;
    content: string;
    riskScore: number;
    warnings: string[];
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedTemplate = CONTRACT_TEMPLATES.find(t => t.id === formData.templateId);

  const updateFormData = useCallback((field: keyof ContractFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  }, []);

  const validateStep = useCallback((currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1 && !formData.templateId) {
      newErrors.templateId = 'Please select a template';
    }

    if (currentStep === 2) {
      if (!formData.counterparty.trim()) newErrors.counterparty = 'Counterparty name is required';
      if (!formData.startDate) newErrors.startDate = 'Start date is required';
      if (selectedTemplate?.requiredFields.includes('totalValue') && !formData.totalValue) {
        newErrors.totalValue = 'Contract value is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, selectedTemplate]);

  const handleNext = useCallback(() => {
    if (validateStep(step)) {
      setStep(s => s + 1);
    }
  }, [step, validateStep]);

  const handleBack = useCallback(() => {
    setStep(s => Math.max(1, s - 1));
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setStep(4);

    const steps: GenerationStep[] = [
      { id: '1', title: 'Analyzing Requirements', description: 'Processing contract parameters...', isComplete: false },
      { id: '2', title: 'Selecting Clauses', description: 'Matching appropriate legal clauses...', isComplete: false },
      { id: '3', title: 'Generating Draft', description: 'Creating contract document...', isComplete: false },
      { id: '4', title: 'Risk Assessment', description: 'Analyzing potential risks...', isComplete: false },
      { id: '5', title: 'Final Review', description: 'Preparing for review...', isComplete: false },
    ];

    setGenerationSteps(steps);

    // Simulate AI generation with step updates
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
      setCurrentGenStep(i);
      setGenerationSteps(prev => prev.map((s, idx) => 
        idx <= i ? { ...s, isComplete: true } : s
      ));
    }

    // Simulate generated contract
    await new Promise(resolve => setTimeout(resolve, 500));
    setGeneratedContract({
      id: `CONTRACT-${Date.now()}`,
      name: `${selectedTemplate?.name || 'Contract'} - ${formData.counterparty}`,
      content: `# ${selectedTemplate?.name || 'Contract'}\n\nThis agreement is entered into by and between...\n\n## 1. Parties\n\nClient: Your Company\nCounterparty: ${formData.counterparty}\n\n## 2. Term\n\nStart Date: ${formData.startDate}\nEnd Date: ${formData.endDate || 'Ongoing'}\n\n## 3. Compensation\n\nTotal Value: ${formData.currency} ${formData.totalValue || 'N/A'}\nPayment Terms: ${formData.paymentTerms}\n\n## 4. Governing Law\n\nThis agreement shall be governed by the laws of ${formData.jurisdiction}.\n\n...`,
      riskScore: Math.floor(Math.random() * 30) + 10, // 10-40 risk score
      warnings: formData.autoRenew ? ['Auto-renewal clause enabled - ensure proper notice period'] : [],
    });

    setIsGenerating(false);
    setStep(5);
  }, [formData, selectedTemplate]);

  const handleSubmitForApproval = useCallback(() => {
    if (generatedContract) {
      onComplete?.(generatedContract.id);
    }
  }, [generatedContract, onComplete]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Generate New Contract</h2>
              <p className="text-sm text-white/80">AI-powered contract creation wizard</p>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-white/80 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mt-4">
          {[
            { num: 1, label: 'Template' },
            { num: 2, label: 'Details' },
            { num: 3, label: 'Review' },
            { num: 4, label: 'Generate' },
            { num: 5, label: 'Complete' },
          ].map(({ num, label }, idx) => (
            <React.Fragment key={num}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step > num
                    ? 'bg-white text-violet-600'
                    : step === num
                      ? 'bg-white/90 text-violet-600'
                      : 'bg-white/20 text-white/60'
                }`}>
                  {step > num ? <Check className="w-4 h-4" /> : num}
                </div>
                <span className={`text-sm hidden sm:inline ${step >= num ? 'text-white' : 'text-white/60'}`}>{label}</span>
              </div>
              {idx < 4 && (
                <div className={`flex-1 h-0.5 mx-2 ${step > num ? 'bg-white' : 'bg-white/20'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* Step 1: Template Selection */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Select Contract Template</h3>
              <p className="text-slate-500 mb-6">Choose the type of contract you want to generate</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {CONTRACT_TEMPLATES.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isSelected={formData.templateId === template.id}
                    onSelect={() => updateFormData('templateId', template.id)}
                  />
                ))}
              </div>
              {errors.templateId && (
                <p className="text-sm text-red-500 mt-4">{errors.templateId}</p>
              )}
            </motion.div>
          )}

          {/* Step 2: Contract Details */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Contract Details</h3>
                <p className="text-slate-500">Fill in the key information for your {selectedTemplate?.name || 'contract'}</p>
              </div>

              {/* Counterparty Information */}
              <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                <h4 className="font-medium text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-violet-500" />
                  Counterparty Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Company/Individual Name" required error={errors.counterparty}>
                    <input
                      type="text"
                      value={formData.counterparty}
                      onChange={(e) => updateFormData('counterparty', e.target.value)}
                      placeholder="Enter counterparty name"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                    />
                  </FormField>
                  <FormField label="Contact Person">
                    <input
                      type="text"
                      value={formData.counterpartyContact}
                      onChange={(e) => updateFormData('counterpartyContact', e.target.value)}
                      placeholder="Contact name"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                    />
                  </FormField>
                  <FormField label="Email">
                    <input
                      type="email"
                      value={formData.counterpartyEmail}
                      onChange={(e) => updateFormData('counterpartyEmail', e.target.value)}
                      placeholder="email@company.com"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                    />
                  </FormField>
                </div>
              </div>

              {/* Dates & Duration */}
              <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                <h4 className="font-medium text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-violet-500" />
                  Dates & Duration
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="Start Date" required error={errors.startDate}>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => updateFormData('startDate', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                    />
                  </FormField>
                  <FormField label="End Date">
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => updateFormData('endDate', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                    />
                  </FormField>
                  <FormField label="Auto-Renewal">
                    <div className="flex items-center gap-3 h-[42px]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.autoRenew}
                          onChange={(e) => updateFormData('autoRenew', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                      </label>
                      <span className="text-sm text-slate-600">{formData.autoRenew ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </FormField>
                </div>
              </div>

              {/* Financial Terms */}
              <div className="bg-slate-50 rounded-xl p-5 space-y-4">
                <h4 className="font-medium text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-violet-500" />
                  Financial Terms
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="Contract Value" required={selectedTemplate?.requiredFields.includes('totalValue')} error={errors.totalValue}>
                    <div className="flex">
                      <select
                        value={formData.currency}
                        onChange={(e) => updateFormData('currency', e.target.value)}
                        className="px-3 py-2.5 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-700 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        type="number"
                        value={formData.totalValue}
                        onChange={(e) => updateFormData('totalValue', e.target.value)}
                        placeholder="0.00"
                        className="flex-1 px-4 py-2.5 rounded-r-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                      />
                    </div>
                  </FormField>
                  <FormField label="Payment Terms">
                    <select
                      value={formData.paymentTerms}
                      onChange={(e) => updateFormData('paymentTerms', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                    >
                      {PAYMENT_TERMS.map(term => <option key={term} value={term}>{term}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Jurisdiction">
                    <select
                      value={formData.jurisdiction}
                      onChange={(e) => updateFormData('jurisdiction', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                    >
                      {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </FormField>
                </div>
              </div>

              {/* Additional Details */}
              <div className="space-y-4">
                <FormField label="Contract Description / Scope">
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    placeholder="Describe the scope of work, deliverables, or purpose of this contract..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all resize-none"
                  />
                </FormField>
                <FormField label="Special Terms or Conditions">
                  <textarea
                    value={formData.specialTerms}
                    onChange={(e) => updateFormData('specialTerms', e.target.value)}
                    placeholder="Any special clauses, conditions, or requirements..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all resize-none"
                  />
                </FormField>
              </div>
            </motion.div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Review Contract Details</h3>
              <p className="text-slate-500 mb-6">Please review all information before generating</p>

              <div className="space-y-4">
                {/* Template */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedTemplate && <selectedTemplate.icon className="w-6 h-6 text-violet-600" />}
                      <div>
                        <div className="font-medium text-slate-900">{selectedTemplate?.name}</div>
                        <div className="text-sm text-slate-500">{selectedTemplate?.category}</div>
                      </div>
                    </div>
                    <button onClick={() => setStep(1)} className="text-sm text-violet-600 hover:text-violet-700 font-medium">
                      Change
                    </button>
                  </div>
                </div>

                {/* Details Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-medium text-slate-700 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Counterparty
                    </h4>
                    <div className="text-slate-900">{formData.counterparty || '-'}</div>
                    {formData.counterpartyContact && (
                      <div className="text-sm text-slate-500">{formData.counterpartyContact}</div>
                    )}
                    {formData.counterpartyEmail && (
                      <div className="text-sm text-slate-500">{formData.counterpartyEmail}</div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-medium text-slate-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Duration
                    </h4>
                    <div className="text-slate-900">
                      {formData.startDate} {formData.endDate && `to ${formData.endDate}`}
                    </div>
                    <div className="text-sm text-slate-500">
                      Auto-renewal: {formData.autoRenew ? 'Yes' : 'No'}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-medium text-slate-700 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Financial
                    </h4>
                    <div className="text-slate-900">
                      {formData.totalValue ? `${formData.currency} ${Number(formData.totalValue).toLocaleString()}` : 'Not specified'}
                    </div>
                    <div className="text-sm text-slate-500">Payment: {formData.paymentTerms}</div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-medium text-slate-700 flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      Jurisdiction
                    </h4>
                    <div className="text-slate-900">{formData.jurisdiction}</div>
                  </div>
                </div>

                {formData.description && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="font-medium text-slate-700 mb-2">Description</h4>
                    <p className="text-slate-600 text-sm">{formData.description}</p>
                  </div>
                )}

                {/* AI Preview */}
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-violet-600" />
                    <span className="font-medium text-indigo-900">AI Generation Preview</span>
                  </div>
                  <ul className="text-sm text-violet-700 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Standard {selectedTemplate?.name} clauses will be included
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Jurisdiction-specific terms for {formData.jurisdiction}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Automatic risk assessment will be performed
                    </li>
                    {formData.autoRenew && (
                      <li className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Auto-renewal clause will be added
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Generating */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center py-8"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-white animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Generating Your Contract</h3>
              <p className="text-slate-500 mb-8">Our AI is creating your personalized contract...</p>

              <div className="max-w-md mx-auto">
                <GenerationProgress steps={generationSteps} currentStep={currentGenStep} />
              </div>
            </motion.div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && generatedContract && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Contract Generated Successfully!</h3>
                <p className="text-slate-500 mt-1">{generatedContract.name}</p>
              </div>

              {/* Risk Score */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      generatedContract.riskScore <= 25 ? 'bg-green-100 text-green-600' :
                      generatedContract.riskScore <= 50 ? 'bg-amber-100 text-amber-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">Risk Assessment</div>
                      <div className={`text-sm ${
                        generatedContract.riskScore <= 25 ? 'text-green-600' :
                        generatedContract.riskScore <= 50 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        Score: {generatedContract.riskScore}/100 ({
                          generatedContract.riskScore <= 25 ? 'Low Risk' :
                          generatedContract.riskScore <= 50 ? 'Medium Risk' :
                          'High Risk'
                        })
                      </div>
                    </div>
                  </div>
                </div>

                {generatedContract.warnings.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="text-sm font-medium text-amber-600 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Warnings
                    </div>
                    <ul className="text-sm text-slate-600 space-y-1">
                      {generatedContract.warnings.map((warning, i) => (
                        <li key={i}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-700">Contract Preview</span>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 hover:bg-slate-200 rounded transition-colors">
                      <Eye className="w-4 h-4 text-slate-600" />
                    </button>
                    <button className="p-1.5 hover:bg-slate-200 rounded transition-colors">
                      <Edit3 className="w-4 h-4 text-slate-600" />
                    </button>
                    <button className="p-1.5 hover:bg-slate-200 rounded transition-colors">
                      <Download className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
                <div className="p-4 max-h-60 overflow-y-auto bg-white">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                    {generatedContract.content}
                  </pre>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setGeneratedContract(null);
                    setStep(3);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
                    <Download className="w-4 h-4" />
                    Download Draft
                  </button>
                  <button
                    onClick={handleSubmitForApproval}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-violet-200 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    Submit for Approval
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      {step < 4 && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-violet-200 transition-all"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-violet-200 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Generate Contract
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ContractGenerationWorkflow;
