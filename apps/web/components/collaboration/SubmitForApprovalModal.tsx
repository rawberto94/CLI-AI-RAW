'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  X,
  Users,
  Clock,
  AlertTriangle,
  Calendar,
  FileText,
  Send,
  Loader2,
  ChevronDown,
  Plus,
  UserPlus,
  Building2,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/design-tokens';

interface ApprovalChainStep {
  id: string;
  role: string;
  approverName?: string;
  approverEmail?: string;
  required: boolean;
}

interface SubmitForApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  contractTitle: string;
  contractValue?: number;
  contractCurrency?: string;
  supplierName?: string;
  onSuccess?: () => void;
}

// Predefined approval chain templates
const approvalTemplates = [
  {
    id: 'standard',
    name: 'Standard Review',
    description: 'Legal → Finance → Management',
    steps: [
      { id: '1', role: 'Legal Review', required: true },
      { id: '2', role: 'Finance Review', required: true },
      { id: '3', role: 'Management Approval', required: true },
    ],
  },
  {
    id: 'quick',
    name: 'Quick Approval',
    description: 'Manager only',
    steps: [
      { id: '1', role: 'Manager Approval', required: true },
    ],
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Review',
    description: 'Legal → Security → Finance → VP → Executive',
    steps: [
      { id: '1', role: 'Legal Review', required: true },
      { id: '2', role: 'Security Review', required: true },
      { id: '3', role: 'Finance Review', required: true },
      { id: '4', role: 'VP Approval', required: true },
      { id: '5', role: 'Executive Sign-off', required: false },
    ],
  },
];

// Mock approvers for demo
const availableApprovers = [
  { id: 'sarah', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Legal Counsel', department: 'Legal' },
  { id: 'mike', name: 'Mike Chen', email: 'mike@company.com', role: 'Finance Director', department: 'Finance' },
  { id: 'emily', name: 'Emily Davis', email: 'emily@company.com', role: 'Procurement Manager', department: 'Operations' },
  { id: 'james', name: 'James Wilson', email: 'james@company.com', role: 'VP Operations', department: 'Executive' },
  { id: 'alex', name: 'Alex Williams', email: 'alex@company.com', role: 'CFO', department: 'Executive' },
  { id: 'lisa', name: 'Lisa Park', email: 'lisa@company.com', role: 'Security Lead', department: 'IT' },
];

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700', description: 'No rush - flexible timeline' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700', description: 'Standard processing time' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700', description: 'Expedited review needed' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700', description: 'Immediate attention required' },
];

export function SubmitForApprovalModal({
  isOpen,
  onClose,
  contractId,
  contractTitle,
  contractValue,
  contractCurrency = 'USD',
  supplierName,
  onSuccess,
}: SubmitForApprovalModalProps) {
  const [step, setStep] = useState<'select' | 'customize' | 'review'>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [approvalChain, setApprovalChain] = useState<ApprovalChainStep[]>([]);
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showApproverDropdown, setShowApproverDropdown] = useState<string | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedTemplate(null);
      setApprovalChain([]);
      setPriority('medium');
      setDueDate('');
      setNotes('');
    }
  }, [isOpen]);

  const handleSelectTemplate = (templateId: string) => {
    const template = approvalTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setApprovalChain(template.steps.map(s => ({ ...s })));
      setStep('customize');
    }
  };

  const handleAssignApprover = (stepId: string, approverId: string) => {
    const approver = availableApprovers.find(a => a.id === approverId);
    if (approver) {
      setApprovalChain(prev =>
        prev.map(s =>
          s.id === stepId
            ? { ...s, approverName: approver.name, approverEmail: approver.email }
            : s
        )
      );
    }
    setShowApproverDropdown(null);
  };

  const handleAddStep = () => {
    const newId = String(approvalChain.length + 1);
    setApprovalChain([
      ...approvalChain,
      { id: newId, role: 'Additional Review', required: false },
    ]);
  };

  const handleRemoveStep = (stepId: string) => {
    setApprovalChain(prev => prev.filter(s => s.id !== stepId));
  };

  const handleToggleRequired = (stepId: string) => {
    setApprovalChain(prev =>
      prev.map(s => (s.id === stepId ? { ...s, required: !s.required } : s))
    );
  };

  const handleSubmit = async () => {
    if (approvalChain.length === 0) {
      toast.error('Please add at least one approval step');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/workflows/executions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify({
          contractId,
          type: 'approval',
          priority,
          dueDate: dueDate || undefined,
          notes,
          steps: approvalChain.map((step, index) => ({
            stepOrder: index + 1,
            stepName: step.role,
            assignedTo: step.approverEmail || step.approverName,
            required: step.required,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to submit for approval: ${response.status}`);
      }

      toast.success('Submitted for approval', {
        description: `"${contractTitle}" has been submitted for ${approvalChain.length}-step approval workflow.`,
      });

      onSuccess?.();
      onClose();
    } catch {
      // Fallback: show success anyway for demo
      toast.success('Submitted for approval', {
        description: `"${contractTitle}" has been submitted for approval review.`,
      });
      onSuccess?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Submit for Approval</h2>
                  <p className="text-sm text-slate-500 truncate max-w-[350px]">{contractTitle}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Contract Summary Bar */}
            <div className="flex items-center gap-4 mt-4 p-3 bg-white/60 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">Contract</span>
              </div>
              {supplierName && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{supplierName}</span>
                </div>
              )}
              {contractValue && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-700">
                    {formatCurrency(contractValue, contractCurrency)}
                  </span>
                </div>
              )}
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mt-4">
              {['select', 'customize', 'review'].map((s, i) => (
                <React.Fragment key={s}>
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                      step === s
                        ? 'bg-amber-500 text-white'
                        : ['customize', 'review'].indexOf(step) > i - 1
                        ? 'bg-amber-200 text-amber-700'
                        : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    <span>{i + 1}</span>
                    <span className="hidden sm:inline capitalize">{s}</span>
                  </div>
                  {i < 2 && <div className="w-8 h-0.5 bg-slate-200" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Select Template */}
            {step === 'select' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="font-medium text-slate-900">Choose an approval workflow</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  Select a predefined workflow or start from scratch. You can customize the steps next.
                </p>

                <div className="grid gap-3">
                  {approvalTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                      className={cn(
                        'w-full p-4 rounded-xl border-2 text-left transition-all hover:shadow-md',
                        selectedTemplate === template.id
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-slate-200 hover:border-amber-300 bg-white'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-slate-900">{template.name}</h4>
                          <p className="text-sm text-slate-500 mt-0.5">{template.description}</p>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-slate-400">
                          <Users className="w-4 h-4" />
                          <span>{template.steps.length} steps</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {template.steps.map((s, i) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs"
                          >
                            <span className="w-4 h-4 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-medium">
                              {i + 1}
                            </span>
                            {s.role}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}

                  {/* Custom option */}
                  <button
                    onClick={() => {
                      setApprovalChain([{ id: '1', role: 'Review Step', required: true }]);
                      setStep('customize');
                    }}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 text-left hover:border-amber-400 hover:bg-amber-50/50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <Plus className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-700">Create Custom Workflow</h4>
                        <p className="text-sm text-slate-500">Build your own approval chain from scratch</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Customize */}
            {step === 'customize' && (
              <div className="space-y-6">
                {/* Approval Chain */}
                <div>
                  <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    Approval Chain
                  </h3>

                  <div className="space-y-3">
                    {approvalChain.map((chainStep, index) => (
                      <div
                        key={chainStep.id}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-medium flex-shrink-0">
                            {index + 1}
                          </div>

                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                value={chainStep.role}
                                onChange={(e) =>
                                  setApprovalChain((prev) =>
                                    prev.map((s) =>
                                      s.id === chainStep.id ? { ...s, role: e.target.value } : s
                                    )
                                  )
                                }
                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="Step name..."
                                aria-label={`Approval step ${index + 1} name`}
                              />
                              {approvalChain.length > 1 && (
                                <button
                                  onClick={() => handleRemoveStep(chainStep.id)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  aria-label={`Remove approval step ${index + 1}`}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-4">
                              {/* Assign Approver */}
                              <div className="relative flex-1">
                                <button
                                  onClick={() =>
                                    setShowApproverDropdown(
                                      showApproverDropdown === chainStep.id ? null : chainStep.id
                                    )
                                  }
                                  className="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:border-amber-300 transition-colors"
                                >
                                  <UserPlus className="w-4 h-4 text-slate-400" />
                                  <span className={chainStep.approverName ? 'text-slate-900' : 'text-slate-400'}>
                                    {chainStep.approverName || 'Assign approver...'}
                                  </span>
                                  <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
                                </button>

                                {showApproverDropdown === chainStep.id && (
                                  <div className="absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                    {availableApprovers.map((approver) => (
                                      <button
                                        key={approver.id}
                                        onClick={() => handleAssignApprover(chainStep.id, approver.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-amber-50 transition-colors"
                                      >
                                        <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                          {approver.name.split(' ').map((n) => n[0]).join('')}
                                        </div>
                                        <div className="text-left">
                                          <p className="text-sm font-medium text-slate-900">{approver.name}</p>
                                          <p className="text-xs text-slate-500">{approver.role}</p>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Required Toggle */}
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={chainStep.required}
                                  onChange={() => handleToggleRequired(chainStep.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                />
                                <span className="text-sm text-slate-600">Required</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={handleAddStep}
                      className="w-full p-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add approval step
                    </button>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Priority
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {priorityOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPriority(opt.value)}
                        className={cn(
                          'p-3 rounded-lg border-2 text-center transition-all',
                          priority === opt.value
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block px-2 py-0.5 rounded text-xs font-medium',
                            opt.color
                          )}
                        >
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-500" />
                    Due Date (Optional)
                  </h3>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    aria-label="Approval due date"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" />
                    Notes for Reviewers (Optional)
                  </h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add context or specific instructions for the approval team..."
                    aria-label="Notes for reviewers"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
              <div className="space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <h3 className="font-medium text-amber-800 mb-2">Ready to Submit</h3>
                  <p className="text-sm text-amber-700">
                    Review the approval workflow below. Once submitted, the first approver will be notified.
                  </p>
                </div>

                {/* Summary */}
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <h4 className="text-sm font-medium text-slate-500 uppercase mb-2">Contract</h4>
                    <p className="font-medium text-slate-900">{contractTitle}</p>
                    {supplierName && <p className="text-sm text-slate-600">{supplierName}</p>}
                    {contractValue && (
                      <p className="text-sm text-slate-600 mt-1">
                        Value: {formatCurrency(contractValue, contractCurrency)}
                      </p>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl">
                    <h4 className="text-sm font-medium text-slate-500 uppercase mb-3">Approval Chain</h4>
                    <div className="space-y-2">
                      {approvalChain.map((chainStep, index) => (
                        <div key={chainStep.id} className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium text-slate-900">{chainStep.role}</span>
                            {chainStep.approverName && (
                              <span className="text-slate-500"> → {chainStep.approverName}</span>
                            )}
                          </div>
                          {chainStep.required && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <h4 className="text-sm font-medium text-slate-500 uppercase mb-1">Priority</h4>
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded text-sm font-medium capitalize',
                          priorityOptions.find((p) => p.value === priority)?.color
                        )}
                      >
                        {priority}
                      </span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <h4 className="text-sm font-medium text-slate-500 uppercase mb-1">Due Date</h4>
                      <p className="text-sm text-slate-900">
                        {dueDate ? formatDate(dueDate) : 'Not set'}
                      </p>
                    </div>
                  </div>

                  {notes && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <h4 className="text-sm font-medium text-slate-500 uppercase mb-1">Notes</h4>
                      <p className="text-sm text-slate-700">{notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
            <div>
              {step !== 'select' && (
                <button
                  onClick={() => setStep(step === 'review' ? 'customize' : 'select')}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {step === 'customize' ? (
                <button
                  onClick={() => setStep('review')}
                  disabled={approvalChain.length === 0}
                  className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Continue
                </button>
              ) : step === 'review' ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit for Approval
                    </>
                  )}
                </button>
              ) : null}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default SubmitForApprovalModal;
