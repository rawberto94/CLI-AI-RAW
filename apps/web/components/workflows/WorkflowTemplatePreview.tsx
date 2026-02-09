'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Eye,
  X,
  Clock,
  Users,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  FileText,
  Zap,
  Play,
  ChevronRight,
  Target,
  Shield,
  Building2,
  Scale,
  Briefcase,
  UserCheck,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'approval' | 'review' | 'notification' | 'auto' | 'parallel';
  description: string;
  assignee?: string;
  slaHours?: number;
  isOptional?: boolean;
  conditions?: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  estimatedDuration: string;
  steps: WorkflowStep[];
  triggers: string[];
  slaTarget: number; // percentage
  useCases: string[];
  bestFor: string[];
}

interface WorkflowTemplatePreviewProps {
  template: WorkflowTemplate;
  onClose: () => void;
  onSelect?: (template: WorkflowTemplate) => void;
}

// ============================================================================
// Template Data
// ============================================================================

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'standard',
    name: 'Standard Review',
    description: 'Standard multi-step approval workflow for mid-value contracts',
    category: 'General',
    icon: FileText,
    estimatedDuration: '3-5 days',
    slaTarget: 95,
    steps: [
      { id: '1', name: 'Initial Submission', type: 'auto', description: 'Contract automatically validated and metadata extracted', slaHours: 1 },
      { id: '2', name: 'Manager Review', type: 'approval', description: 'Direct manager reviews and approves the request', assignee: 'Direct Manager', slaHours: 48 },
      { id: '3', name: 'Legal Review', type: 'review', description: 'Legal team reviews terms and conditions', assignee: 'Legal Team', slaHours: 72, isOptional: true, conditions: ['Value > $50K', 'Non-standard terms'] },
      { id: '4', name: 'Finance Approval', type: 'approval', description: 'Finance validates budget and payment terms', assignee: 'Finance Team', slaHours: 24 },
      { id: '5', name: 'Final Sign-off', type: 'approval', description: 'Final authorization before execution', assignee: 'Department Head', slaHours: 24 },
      { id: '6', name: 'Counterparty Send', type: 'notification', description: 'Contract sent to counterparty for signature', slaHours: 1 },
    ],
    triggers: ['Manual submission', 'Contract value $25K-$100K', 'Standard contract types'],
    useCases: ['Vendor agreements', 'Service contracts', 'Software licenses'],
    bestFor: ['Medium complexity contracts', 'Established vendor relationships', 'Standard terms'],
  },
  {
    id: 'express',
    name: 'Express Approval',
    description: 'Fast-track workflow for low-value, low-risk contracts',
    category: 'Fast Track',
    icon: Zap,
    estimatedDuration: '1-2 days',
    slaTarget: 98,
    steps: [
      { id: '1', name: 'Auto-Validation', type: 'auto', description: 'AI validates contract against policy', slaHours: 0.5 },
      { id: '2', name: 'Manager Approval', type: 'approval', description: 'Single approval from direct manager', assignee: 'Direct Manager', slaHours: 24 },
      { id: '3', name: 'Auto-Execute', type: 'auto', description: 'Contract automatically sent for signature', slaHours: 1 },
    ],
    triggers: ['Contract value < $25K', 'Pre-approved vendors', 'Standard NDA'],
    useCases: ['NDAs', 'Small vendor purchases', 'Subscription renewals'],
    bestFor: ['Low-value contracts', 'Standard terms', 'Trusted vendors'],
  },
  {
    id: 'legal',
    name: 'Legal Review',
    description: 'Comprehensive legal review for high-complexity contracts',
    category: 'Compliance',
    icon: Scale,
    estimatedDuration: '5-10 days',
    slaTarget: 90,
    steps: [
      { id: '1', name: 'Submission & Triage', type: 'auto', description: 'Contract triaged based on complexity', slaHours: 2 },
      { id: '2', name: 'Legal Assignment', type: 'auto', description: 'Assigned to appropriate legal specialist', slaHours: 4 },
      { id: '3', name: 'Primary Legal Review', type: 'review', description: 'Detailed legal review and redlining', assignee: 'Legal Counsel', slaHours: 96 },
      { id: '4', name: 'Compliance Check', type: 'review', description: 'Regulatory compliance verification', assignee: 'Compliance Officer', slaHours: 48 },
      { id: '5', name: 'Senior Legal Approval', type: 'approval', description: 'Senior counsel sign-off', assignee: 'General Counsel', slaHours: 48, conditions: ['Value > $500K', 'Non-standard terms'] },
      { id: '6', name: 'Business Approval', type: 'approval', description: 'Business stakeholder final approval', assignee: 'Requesting Manager', slaHours: 24 },
    ],
    triggers: ['Non-standard terms', 'High-value contracts', 'New vendors', 'International'],
    useCases: ['Enterprise agreements', 'Partnership contracts', 'M&A related'],
    bestFor: ['Complex negotiations', 'High-risk terms', 'New relationships'],
  },
  {
    id: 'executive',
    name: 'Executive Approval',
    description: 'High-value contracts requiring C-suite authorization',
    category: 'Enterprise',
    icon: Building2,
    estimatedDuration: '7-14 days',
    slaTarget: 85,
    steps: [
      { id: '1', name: 'Initial Processing', type: 'auto', description: 'Contract registered and initial checks', slaHours: 2 },
      { id: '2', name: 'Department Review', type: 'approval', description: 'Sponsoring department approval', assignee: 'Department VP', slaHours: 48 },
      { id: '3', name: 'Legal Review', type: 'review', description: 'Full legal review', assignee: 'General Counsel', slaHours: 96 },
      { id: '4', name: 'Finance Review', type: 'review', description: 'Financial impact assessment', assignee: 'CFO Office', slaHours: 72 },
      { id: '5', name: 'Risk Assessment', type: 'parallel', description: 'Parallel risk and compliance review', assignee: 'Risk Committee', slaHours: 48 },
      { id: '6', name: 'Executive Committee', type: 'approval', description: 'Executive committee review', assignee: 'Executive Committee', slaHours: 168, conditions: ['Value > $1M'] },
      { id: '7', name: 'CEO/Board Approval', type: 'approval', description: 'Final executive sign-off', assignee: 'CEO', slaHours: 72, conditions: ['Value > $5M', 'Strategic significance'] },
    ],
    triggers: ['Contract value > $500K', 'Strategic partnerships', 'Board oversight required'],
    useCases: ['Major vendor contracts', 'Strategic partnerships', 'Capital commitments'],
    bestFor: ['High-value deals', 'Strategic relationships', 'Material commitments'],
  },
  {
    id: 'nda_fast_track',
    name: 'NDA Fast Track',
    description: 'Streamlined workflow for non-disclosure agreements',
    category: 'Fast Track',
    icon: Shield,
    estimatedDuration: '< 24 hours',
    slaTarget: 99,
    steps: [
      { id: '1', name: 'Template Validation', type: 'auto', description: 'AI validates against approved NDA template', slaHours: 0.25 },
      { id: '2', name: 'Auto-Approve', type: 'auto', description: 'Standard NDAs auto-approved', slaHours: 0.1, conditions: ['Standard template', 'Known counterparty'] },
      { id: '3', name: 'Quick Review', type: 'approval', description: 'Rapid legal review for non-standard', assignee: 'Legal Team', slaHours: 8, isOptional: true },
      { id: '4', name: 'Execute & Send', type: 'auto', description: 'Automatic execution and delivery', slaHours: 0.1 },
    ],
    triggers: ['NDA contract type', 'Mutual or one-way standard', 'Pre-qualified templates'],
    useCases: ['Mutual NDAs', 'Confidentiality agreements', 'Pre-sales discussions'],
    bestFor: ['High volume NDAs', 'Standard confidentiality terms', 'Quick turnaround needed'],
  },
  {
    id: 'vendor_onboarding',
    name: 'Vendor Onboarding',
    description: 'Complete vendor qualification and contract workflow',
    category: 'Procurement',
    icon: Briefcase,
    estimatedDuration: '2-4 weeks',
    slaTarget: 88,
    steps: [
      { id: '1', name: 'Vendor Request', type: 'auto', description: 'Vendor request submitted and validated', slaHours: 2 },
      { id: '2', name: 'Due Diligence', type: 'review', description: 'Background checks and qualification', assignee: 'Procurement Team', slaHours: 168 },
      { id: '3', name: 'Security Assessment', type: 'review', description: 'Security and compliance check', assignee: 'Security Team', slaHours: 120, conditions: ['Data access', 'IT systems'] },
      { id: '4', name: 'Contract Negotiation', type: 'review', description: 'Terms negotiation', assignee: 'Procurement Manager', slaHours: 168 },
      { id: '5', name: 'Legal Review', type: 'review', description: 'Legal approval of final terms', assignee: 'Legal Team', slaHours: 72 },
      { id: '6', name: 'Finance Setup', type: 'auto', description: 'Vendor setup in financial systems', slaHours: 24 },
      { id: '7', name: 'Final Approval', type: 'approval', description: 'Final procurement approval', assignee: 'Procurement Director', slaHours: 48 },
    ],
    triggers: ['New vendor request', 'Vendor renewal', 'Vendor upgrade'],
    useCases: ['New supplier setup', 'Vendor qualification', 'Preferred vendor programs'],
    bestFor: ['New vendor relationships', 'Regulated industries', 'Complex services'],
  },
];

// ============================================================================
// Components
// ============================================================================

/**
 * Step indicator showing workflow step details
 */
const StepIndicator: React.FC<{
  step: WorkflowStep;
  index: number;
  isLast: boolean;
}> = ({ step, index: _index, isLast }) => {
  const getStepIcon = () => {
    switch (step.type) {
      case 'approval': return UserCheck;
      case 'review': return Eye;
      case 'notification': return AlertTriangle;
      case 'auto': return Zap;
      case 'parallel': return Users;
      default: return CheckCircle2;
    }
  };

  const getStepColor = () => {
    switch (step.type) {
      case 'approval': return 'bg-green-500';
      case 'review': return 'bg-violet-500';
      case 'notification': return 'bg-amber-500';
      case 'auto': return 'bg-violet-500';
      case 'parallel': return 'bg-violet-500';
      default: return 'bg-slate-500';
    }
  };

  const Icon = getStepIcon();

  return (
    <div className="relative">
      <div className="flex items-start gap-4">
        {/* Step Number & Icon */}
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full ${getStepColor()} flex items-center justify-center text-white shadow-lg`}>
            <Icon className="w-5 h-5" />
          </div>
          {!isLast && (
            <div className="w-0.5 h-16 bg-slate-200 my-2" />
          )}
        </div>

        {/* Step Content */}
        <div className="flex-1 pb-6">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-slate-900">{step.name}</h4>
            {step.isOptional && (
              <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                Optional
              </span>
            )}
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              step.type === 'approval' ? 'bg-green-100 text-green-700' :
              step.type === 'review' ? 'bg-violet-100 text-violet-700' :
              step.type === 'auto' ? 'bg-violet-100 text-violet-700' :
              step.type === 'notification' ? 'bg-amber-100 text-amber-700' :
              'bg-violet-100 text-violet-700'
            }`}>
              {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">{step.description}</p>
          
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
            {step.assignee && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {step.assignee}
              </span>
            )}
            {step.slaHours && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {step.slaHours < 24 ? `${step.slaHours}h` : `${Math.round(step.slaHours / 24)}d`} SLA
              </span>
            )}
          </div>

          {step.conditions && step.conditions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {step.conditions.map((cond, idx) => (
                <span key={idx} className="px-2 py-0.5 text-xs bg-amber-50 text-amber-700 rounded border border-amber-200">
                  {cond}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Info card for template metadata
 */
const InfoCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}> = ({ icon: Icon, label, value, color }) => (
  <div className={`rounded-lg p-3 ${color}`}>
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
    </div>
    <div className="mt-1 font-semibold">{value}</div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const WorkflowTemplatePreview: React.FC<WorkflowTemplatePreviewProps> = ({
  template,
  onClose,
  onSelect,
}) => {
  const Icon = template.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-violet-500 to-purple-600 text-white flex items-start justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Icon className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{template.name}</h2>
              <p className="text-white/80 text-sm mt-1">{template.description}</p>
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {template.category}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <InfoCard
              icon={Clock}
              label="Est. Duration"
              value={template.estimatedDuration}
              color="bg-violet-50 text-violet-700"
            />
            <InfoCard
              icon={Target}
              label="SLA Target"
              value={`${template.slaTarget}%`}
              color="bg-green-50 text-green-700"
            />
            <InfoCard
              icon={Users}
              label="Steps"
              value={`${template.steps.length} steps`}
              color="bg-violet-50 text-violet-700"
            />
          </div>

          {/* Workflow Steps */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-violet-500" />
              Workflow Steps
            </h3>
            <div className="bg-slate-50 rounded-xl p-5">
              {template.steps.map((step, index) => (
                <StepIndicator
                  key={step.id}
                  step={step}
                  index={index}
                  isLast={index === template.steps.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Triggers */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Auto-Triggers
            </h3>
            <div className="flex flex-wrap gap-2">
              {template.triggers.map((trigger, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 text-sm rounded-lg border border-amber-200"
                >
                  {trigger}
                </span>
              ))}
            </div>
          </div>

          {/* Use Cases & Best For */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-500" />
                Use Cases
              </h3>
              <ul className="space-y-2">
                {template.useCases.map((useCase, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    {useCase}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-green-500" />
                Best For
              </h3>
              <ul className="space-y-2">
                {template.bestFor.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                    <ChevronRight className="w-4 h-4 text-violet-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            Close
          </button>
          {onSelect && (
            <button
              onClick={() => onSelect(template)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-violet-200 transition-all"
            >
              <Play className="w-4 h-4" />
              Use This Workflow
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

/**
 * Preview button to trigger the modal
 */
export const WorkflowPreviewButton: React.FC<{
  template: WorkflowTemplate;
  onPreview: (template: WorkflowTemplate) => void;
  className?: string;
}> = ({ template, onPreview, className }) => (
  <button
    onClick={() => onPreview(template)}
    className={`flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors ${className || ''}`}
  >
    <Eye className="w-4 h-4" />
    Preview
  </button>
);

export default WorkflowTemplatePreview;
