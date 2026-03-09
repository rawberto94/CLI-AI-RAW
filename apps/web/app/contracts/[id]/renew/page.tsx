'use client';

/**
 * Contract Renewal Wizard
 * 
 * A comprehensive wizard for renewing contracts:
 * 1. Review original contract summary
 * 2. Configure new terms (dates, value, parties)
 * 3. Edit/modify clauses and content
 * 4. Preview and confirm
 * 5. Generate the renewal document
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RefreshCw,
  FileText,
  Calendar,
  DollarSign,
  Users,
  Edit3,
  Eye,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Settings,
  FileSignature,
  Plus,
  Trash2,
  BookOpen,
  FolderKanban,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getTenantId } from '@/lib/tenant';
import { toast } from 'sonner';
import Link from 'next/link';

// Types
interface OriginalContract {
  id: string;
  title: string;
  filename?: string;
  status: string;
  contractType?: string;
  effectiveDate?: string;
  expirationDate?: string;
  totalValue?: number;
  currency?: string;
  clientName?: string;
  supplierName?: string;
  description?: string;
  rawText?: string;
  extractedData?: {
    overview?: {
      summary?: string;
      parties?: Array<{ name: string; role?: string }>;
    };
    clauses?: Array<{
      id: string;
      title: string;
      content: string;
      category: string;
    }>;
  };
}

interface RenewalDraft {
  title: string;
  effectiveDate: Date;
  expirationDate: Date;
  totalValue: number;
  currency: string;
  parties: Array<{ name: string; role: string; email?: string }>;
  clauses: Array<{ id: string; title: string; content: string; isModified: boolean }>;
  notes: string;
  keepTerms: boolean;
  adjustForInflation: boolean;
  inflationRate: number;
  templateId?: string; // Selected template for the renewal
}

// Template interface for renewal templates
interface RenewalTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content?: string;
  variables?: number;
  clauses?: Array<{ id: string; title: string; content: string }>;
  usageCount?: number;
}

// Steps configuration
const STEPS = [
  { id: 'review', title: 'Review Original', icon: FileText },
  { id: 'terms', title: 'New Terms', icon: Settings },
  { id: 'content', title: 'Edit Content', icon: Edit3 },
  { id: 'preview', title: 'Preview', icon: Eye },
  { id: 'confirm', title: 'Confirm', icon: Check },
];

export default function ContractRenewalPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;
  
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [originalContract, setOriginalContract] = useState<OriginalContract | null>(null);
  const [draft, setDraft] = useState<RenewalDraft | null>(null);
  
  // Template state
  const [templates, setTemplates] = useState<RenewalTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RenewalTemplate | null>(null);
  
  // Approval workflow
  const [submitForApproval, setSubmitForApproval] = useState(false);
  
  // Load templates for renewal
  useEffect(() => {
    async function loadTemplates() {
      setTemplatesLoading(true);
      try {
        const response = await fetch('/api/templates', {
          headers: { 'x-tenant-id': getTenantId() },
        });
        if (response.ok) {
          const raw = await response.json();
          const data = raw.data ?? raw;
          // Filter for renewal-appropriate templates
          const allTemplates = data.templates || [];
          setTemplates(allTemplates);
        }
      } catch {
        // Template loading failed silently
      } finally {
        setTemplatesLoading(false);
      }
    }
    loadTemplates();
  }, []);
  
  // Apply template to draft
  const applyTemplate = useCallback((template: RenewalTemplate) => {
    if (!draft) return;
    
    setSelectedTemplate(template);
    
    // If template has clauses, apply them
    if (template.clauses && template.clauses.length > 0) {
      const templateClauses = template.clauses.map(c => ({
        id: `tpl-${c.id}-${Date.now()}`,
        title: c.title,
        content: c.content,
        isModified: false,
      }));
      setDraft(prev => prev ? { ...prev, clauses: templateClauses, templateId: template.id } : null);
      toast.success(`Applied template: ${template.name}`, {
        description: `${templateClauses.length} clauses added from template`,
      });
    } else {
      setDraft(prev => prev ? { ...prev, templateId: template.id } : null);
      toast.success(`Selected template: ${template.name}`);
    }
  }, [draft]);
  
  // Load original contract
  useEffect(() => {
    async function loadContract() {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/contracts/${contractId}`, {
          headers: { 'x-tenant-id': getTenantId() },
        });
        
        if (!response.ok) {
          throw new Error('Failed to load contract');
        }
        
        const raw = await response.json();
        const data = raw.data ?? raw;
        setOriginalContract({
          id: data.id,
          title: data.document_title || data.contractTitle || data.filename || 'Contract',
          filename: data.filename,
          status: data.status,
          contractType: data.contractType,
          effectiveDate: data.effectiveDate || data.start_date,
          expirationDate: data.expirationDate || data.end_date,
          totalValue: typeof data.totalValue === 'string' ? parseFloat(data.totalValue) : data.totalValue,
          currency: data.currency || 'USD',
          clientName: data.clientName,
          supplierName: data.supplierName,
          description: data.description || data.contract_short_description,
          rawText: data.rawText,
          extractedData: data.extractedData,
        });
        
        // Initialize draft with original contract data
        const originalDuration = data.effectiveDate && data.expirationDate
          ? differenceInDays(new Date(data.expirationDate), new Date(data.effectiveDate))
          : 365;
        
        const newEffective = data.expirationDate 
          ? new Date(data.expirationDate) 
          : new Date();
        
        const newExpiration = new Date(newEffective);
        newExpiration.setDate(newExpiration.getDate() + originalDuration);
        
        // Extract parties from contract
        const parties: Array<{ name: string; role: string; email?: string }> = [];
        if (data.clientName) {
          parties.push({ name: data.clientName, role: 'Client' });
        }
        if (data.supplierName) {
          parties.push({ name: data.supplierName, role: 'Supplier' });
        }
        if (Array.isArray(data.external_parties)) {
          data.external_parties.forEach((p: { legalName: string; role?: string }) => {
            if (!parties.find(existing => existing.name === p.legalName)) {
              parties.push({ name: p.legalName, role: p.role || 'Party' });
            }
          });
        }
        
        // Extract clauses if available
        const rawClauses = data.extractedData?.clauses;
        const clauses = Array.isArray(rawClauses)
          ? rawClauses.map((c: { id: string; title: string; content: string }) => ({
              id: c.id,
              title: c.title,
              content: c.content,
              isModified: false,
            }))
          : [];
        
        setDraft({
          title: `${data.document_title || data.filename || 'Contract'} - Renewal`,
          effectiveDate: newEffective,
          expirationDate: newExpiration,
          totalValue: data.totalValue || 0,
          currency: data.currency || 'USD',
          parties,
          clauses,
          notes: '',
          keepTerms: true,
          adjustForInflation: false,
          inflationRate: 3,
        });
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load contract');
      } finally {
        setLoading(false);
      }
    }
    
    loadContract();
  }, [contractId]);
  
  // Navigation
  const canProceed = useCallback(() => {
    if (!draft) return false;
    switch (currentStep) {
      case 0: return true; // Review - always can proceed
      case 1: return draft.effectiveDate && draft.expirationDate; // Terms
      case 2: return true; // Content - always can proceed
      case 3: return true; // Preview - always can proceed
      default: return true;
    }
  }, [currentStep, draft]);
  
  const handleNext = () => {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  // Create renewal
  const handleCreateRenewal = async () => {
    if (!draft || !originalContract) return;
    
    setSaving(true);
    
    try {
      const response = await fetch(`/api/contracts/${contractId}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({
          title: draft.title,
          effectiveDate: draft.effectiveDate.toISOString(),
          expirationDate: draft.expirationDate.toISOString(),
          totalValue: draft.totalValue,
          renewalNote: draft.notes,
          copyParties: true,
          copyTerms: draft.keepTerms,
          copyMetadata: true,
        }),
      });
      
      if (!response.ok) {
        const errResp = await response.json();
        const err = errResp.error;
        throw new Error((typeof err === 'object' ? err?.message : err) || 'Failed to create renewal');
      }
      
      const result = await response.json();
      const payload = result.data ?? result;
      const newContractId = payload.renewal?.id || payload.id;
      
      if (submitForApproval) {
        toast.success('Renewal created — redirecting to approval submission...');
        router.push(`/contracts/${newContractId}?submitApproval=true`);
      } else {
        toast.success('Renewal contract created successfully!');
        router.push(`/contracts/${newContractId}`);
      }
      
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create renewal');
    } finally {
      setSaving(false);
    }
  };
  
  // Update draft
  const updateDraft = (updates: Partial<RenewalDraft>) => {
    setDraft(prev => prev ? { ...prev, ...updates } : null);
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading contract...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !originalContract || !draft) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Unable to Load Contract</h2>
              <p className="text-muted-foreground">{error || 'Contract not found'}</p>
              <Button asChild>
                <Link href={`/contracts/${contractId}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Contract
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const progress = ((currentStep + 1) / STEPS.length) * 100;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/contracts/${contractId}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Cancel
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                <span className="font-semibold">Contract Renewal Wizard</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Step {currentStep + 1} of {STEPS.length}
              </Badge>
            </div>
          </div>
          
          {/* Progress */}
          <div className="pb-4">
            <Progress value={progress} className="h-1" />
          </div>
        </div>
      </div>
      
      {/* Step Indicators */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => index <= currentStep && setCurrentStep(index)}
                  disabled={index > currentStep}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-primary/10 text-primary cursor-pointer",
                    !isActive && !isCompleted && "text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  <span className="hidden sm:inline font-medium">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={cn(
                    "flex-1 h-px mx-2",
                    index < currentStep ? "bg-primary" : "bg-border"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === 0 && (
              <ReviewStep 
                original={originalContract} 
                templates={templates}
                templatesLoading={templatesLoading}
                selectedTemplate={selectedTemplate}
                onApplyTemplate={applyTemplate}
              />
            )}
            {currentStep === 1 && (
              <TermsStep draft={draft} onUpdate={updateDraft} original={originalContract} />
            )}
            {currentStep === 2 && (
              <ContentStep draft={draft} onUpdate={updateDraft} original={originalContract} />
            )}
            {currentStep === 3 && (
              <PreviewStep draft={draft} original={originalContract} />
            )}
            {currentStep === 4 && (
              <ConfirmStep
                draft={draft}
                original={originalContract}
                onConfirm={handleCreateRenewal}
                saving={saving}
                submitForApproval={submitForApproval}
                onSubmitForApprovalChange={setSubmitForApproval}
              />
            )}
          </motion.div>
        </AnimatePresence>
        
        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleCreateRenewal} 
              disabled={saving}
              className="bg-gradient-to-r from-violet-500 to-violet-600"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Renewal...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Renewal Contract
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components

function ReviewStep({ 
  original,
  templates,
  templatesLoading,
  selectedTemplate,
  onApplyTemplate,
}: { 
  original: OriginalContract;
  templates: RenewalTemplate[];
  templatesLoading: boolean;
  selectedTemplate: RenewalTemplate | null;
  onApplyTemplate: (template: RenewalTemplate) => void;
}) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.description?.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.category?.toLowerCase().includes(templateSearch.toLowerCase())
  );
  
  // Group templates by category
  const templatesByCategory = filteredTemplates.reduce((acc, t) => {
    const cat = t.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, RenewalTemplate[]>);
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Review Original Contract</h2>
        <p className="text-muted-foreground mt-1">
          Review the key details of the contract you are renewing
        </p>
      </div>
      
      {/* Template Selection Banner */}
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {selectedTemplate ? (
                    <>Using template: <span className="text-primary">{selectedTemplate.name}</span></>
                  ) : (
                    'Start from a template?'
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate 
                    ? 'Template clauses will be applied to your renewal'
                    : 'Use a pre-built template to streamline your renewal process'
                  }
                </p>
              </div>
            </div>
            <Button
              variant={selectedTemplate ? "outline" : "default"}
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
            >
              <FolderKanban className="h-4 w-4 mr-2" />
              {selectedTemplate ? 'Change Template' : 'Browse Templates'}
            </Button>
          </div>
          
          {/* Template Browser */}
          <AnimatePresence>
            {showTemplates && (
              <motion.div key="templates"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search templates..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/templates" target="_blank">
                        View All <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                  
                  {templatesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FolderKanban className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>No templates found</p>
                      <Button variant="link" size="sm" asChild>
                        <Link href="/templates/new">Create a new template</Link>
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-4">
                        {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                          <div key={category}>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              {category}
                            </h4>
                            <div className="grid md:grid-cols-2 gap-2">
                              {categoryTemplates.map((template) => (
                                <div
                                  key={template.id}
                                  onClick={() => onApplyTemplate(template)}
                                  className={cn(
                                    "p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md",
                                    selectedTemplate?.id === template.id 
                                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                                      : "hover:border-primary/50"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm truncate">{template.name}</p>
                                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                        {template.description}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2">
                                        {template.clauses && (
                                          <Badge variant="outline" className="text-[10px]">
                                            {Array.isArray(template.clauses) ? template.clauses.length : template.clauses} clauses
                                          </Badge>
                                        )}
                                        {template.usageCount && template.usageCount > 0 && (
                                          <span className="text-[10px] text-muted-foreground">
                                            Used {template.usageCount}x
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {selectedTemplate?.id === template.id && (
                                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{original.title}</CardTitle>
              <CardDescription>{original.filename}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Contract Type</p>
              <p className="font-semibold">{original.contractType || 'Not specified'}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="outline">{original.status}</Badge>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="font-semibold">
                {original.totalValue 
                  ? `${original.currency} ${original.totalValue.toLocaleString()}`
                  : 'Not specified'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-semibold">
                {original.effectiveDate && original.expirationDate
                  ? `${differenceInDays(new Date(original.expirationDate), new Date(original.effectiveDate))} days`
                  : 'Not specified'}
              </p>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Key Dates
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Effective Date:</span>
                  <span>{original.effectiveDate ? format(new Date(original.effectiveDate), 'PPP') : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expiration Date:</span>
                  <span className="text-red-600 font-medium">
                    {original.expirationDate ? format(new Date(original.expirationDate), 'PPP') : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Parties
              </h4>
              <div className="space-y-2 text-sm">
                {original.clientName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client:</span>
                    <span>{original.clientName}</span>
                  </div>
                )}
                {original.supplierName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supplier:</span>
                    <span>{original.supplierName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {original.description && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{original.description}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TermsStep({ 
  draft, 
  onUpdate, 
  
  original 
}: { 
  draft: RenewalDraft; 
  onUpdate: (updates: Partial<RenewalDraft>) => void;
  original: OriginalContract;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configure Renewal Terms</h2>
        <p className="text-muted-foreground mt-1">
          Set the new terms for the renewed contract
        </p>
      </div>
      
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contract Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Renewal Contract Title</Label>
              <Input
                value={draft.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="Enter contract title"
              />
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                value={draft.notes}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                placeholder="Add any notes about this renewal..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Term Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>New Effective Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(draft.effectiveDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={draft.effectiveDate}
                      onSelect={(date) => date instanceof Date && onUpdate({ effectiveDate: date })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label>New Expiration Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(draft.expirationDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={draft.expirationDate}
                      onSelect={(date) => date instanceof Date && onUpdate({ expirationDate: date })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="p-3 bg-violet-50 rounded-lg text-sm">
              <p className="text-violet-700">
                <strong>Duration:</strong> {differenceInDays(draft.expirationDate, draft.effectiveDate)} days
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Total Value</Label>
                <Input
                  type="number"
                  value={draft.totalValue}
                  onChange={(e) => onUpdate({ totalValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={draft.currency} onValueChange={(v) => onUpdate({ currency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Adjust for Inflation</Label>
                <p className="text-xs text-muted-foreground">Automatically increase value</p>
              </div>
              <Switch
                checked={draft.adjustForInflation}
                onCheckedChange={(v) => onUpdate({ adjustForInflation: v })}
              />
            </div>
            
            {draft.adjustForInflation && (
              <div>
                <Label>Inflation Rate (%)</Label>
                <Input
                  type="number"
                  value={draft.inflationRate}
                  onChange={(e) => onUpdate({ inflationRate: parseFloat(e.target.value) || 0 })}
                  step="0.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  New value: {draft.currency} {((draft.totalValue * (1 + draft.inflationRate / 100))).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Party Management Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contract Parties
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const newParty = { name: '', role: 'Party', email: '' };
                  onUpdate({ parties: [...draft.parties, newParty] });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Party
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {draft.parties.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No parties added yet</p>
                <p className="text-sm">Add the contracting parties for this renewal</p>
              </div>
            ) : (
              <div className="space-y-4">
                {draft.parties.map((party, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-muted/30">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Party Name</Label>
                        <Input
                          value={party.name}
                          onChange={(e) => {
                            const updated = [...draft.parties];
                            updated[index] = { ...party, name: e.target.value };
                            onUpdate({ parties: updated });
                          }}
                          placeholder="Company or individual name"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Role</Label>
                        <Select 
                          value={party.role} 
                          onValueChange={(v) => {
                            const updated = [...draft.parties];
                            updated[index] = { ...party, role: v };
                            onUpdate({ parties: updated });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Client">Client</SelectItem>
                            <SelectItem value="Supplier">Supplier</SelectItem>
                            <SelectItem value="Vendor">Vendor</SelectItem>
                            <SelectItem value="Partner">Partner</SelectItem>
                            <SelectItem value="Contractor">Contractor</SelectItem>
                            <SelectItem value="Service Provider">Service Provider</SelectItem>
                            <SelectItem value="Licensor">Licensor</SelectItem>
                            <SelectItem value="Licensee">Licensee</SelectItem>
                            <SelectItem value="Party">Party</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Email (optional)</Label>
                          <Input
                            type="email"
                            value={party.email || ''}
                            onChange={(e) => {
                              const updated = [...draft.parties];
                              updated[index] = { ...party, email: e.target.value };
                              onUpdate({ parties: updated });
                            }}
                            placeholder="contact@example.com"
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="flex-shrink-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            const updated = draft.parties.filter((_, i) => i !== index);
                            onUpdate({ parties: updated });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Keep Original Terms</Label>
                <p className="text-xs text-muted-foreground">Copy all terms from original contract</p>
              </div>
              <Switch
                checked={draft.keepTerms}
                onCheckedChange={(v) => onUpdate({ keepTerms: v })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// AI Suggestions for renewals
interface AISuggestion {
  id: string;
  type: 'update' | 'add' | 'warning' | 'tip';
  title: string;
  description: string;
  clauseId?: string;
  suggestedContent?: string;
  priority: 'high' | 'medium' | 'low';
}

// Library clause interface (matching ClauseLibrary)
interface LibraryClause {
  id: string;
  title: string;
  content: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
  tags: string[];
}

function ContentStep({ 
  draft, 
  onUpdate,
  
  original,
}: { 
  draft: RenewalDraft; 
  onUpdate: (updates: Partial<RenewalDraft>) => void;
  original: OriginalContract;
}) {
  const [activeClauseId, setActiveClauseId] = useState<string | null>(
    draft.clauses.length > 0 ? draft.clauses[0].id : null
  );
  const [showClauseLibrary, setShowClauseLibrary] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(true);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryClauses, setLibraryClauses] = useState<LibraryClause[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('all');
  const [addingClauseId, setAddingClauseId] = useState<string | null>(null);
  
  // Generate AI suggestions based on renewal context
  const [aiSuggestions] = useState<AISuggestion[]>(() => {
    const suggestions: AISuggestion[] = [];
    
    // Check for price escalation suggestion
    if (draft.adjustForInflation && draft.inflationRate > 0) {
      suggestions.push({
        id: 'price-escalation',
        type: 'tip',
        title: 'Update Payment Terms',
        description: `Contract value increased by ${draft.inflationRate}%. Consider updating payment clause to reflect new pricing structure.`,
        priority: 'medium',
      });
    }
    
    // Check for date-sensitive clauses
    const termClause = draft.clauses.find(c => 
      c.title.toLowerCase().includes('term') || 
      c.title.toLowerCase().includes('duration')
    );
    if (termClause) {
      suggestions.push({
        id: 'term-update',
        type: 'update',
        title: 'Update Term Clause',
        description: 'The term/duration clause should reflect the new contract dates.',
        clauseId: termClause.id,
        priority: 'high',
      });
    }
    
    // Check for auto-renewal language
    const hasAutoRenewal = draft.clauses.some(c => 
      c.content.toLowerCase().includes('auto-renewal') ||
      c.content.toLowerCase().includes('automatically renew')
    );
    if (hasAutoRenewal) {
      suggestions.push({
        id: 'auto-renewal-review',
        type: 'warning',
        title: 'Review Auto-Renewal Terms',
        description: 'This contract has auto-renewal language. Verify the terms are appropriate for the renewal period.',
        priority: 'high',
      });
    }
    
    // Suggest adding common renewal clauses
    const hasConfidentiality = draft.clauses.some(c => 
      c.title.toLowerCase().includes('confidential')
    );
    if (!hasConfidentiality) {
      suggestions.push({
        id: 'add-confidentiality',
        type: 'add',
        title: 'Add Confidentiality Clause',
        description: 'Consider adding a confidentiality clause to protect sensitive information during the renewal period.',
        priority: 'medium',
      });
    }
    
    // Data protection suggestion for modern compliance
    const hasDataProtection = draft.clauses.some(c =>
      c.title.toLowerCase().includes('data') ||
      c.content.toLowerCase().includes('gdpr') ||
      c.content.toLowerCase().includes('privacy')
    );
    if (!hasDataProtection) {
      suggestions.push({
        id: 'add-data-protection',
        type: 'add',
        title: 'Add Data Protection Clause',
        description: 'Modern contracts should include GDPR/CCPA compliant data protection terms.',
        priority: 'medium',
      });
    }
    
    return suggestions;
  });
  
  const activeClause = draft.clauses.find(c => c.id === activeClauseId);
  
  // Load clause library
  useEffect(() => {
    async function loadLibrary() {
      setLibraryLoading(true);
      try {
        const response = await fetch('/api/clauses', {
          headers: { 'x-tenant-id': getTenantId() },
        });
        if (response.ok) {
          const raw = await response.json();
          const data = raw.data ?? raw;
          setLibraryClauses(data.clauses || []);
        }
      } catch {
        // Clause library loading failed silently
      } finally {
        setLibraryLoading(false);
      }
    }
    
    if (showClauseLibrary) {
      loadLibrary();
    }
  }, [showClauseLibrary]);
  
  // Filter library clauses
  const filteredLibrary = libraryClauses.filter(c => {
    const matchesSearch = !librarySearch || 
      c.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
      c.content.toLowerCase().includes(librarySearch.toLowerCase());
    const matchesCategory = libraryCategory === 'all' || c.category === libraryCategory;
    return matchesSearch && matchesCategory;
  });
  
  const categories = [...new Set(libraryClauses.map(c => c.category))];
  
  const updateClause = (id: string, content: string) => {
    const updated = draft.clauses.map(c => 
      c.id === id ? { ...c, content, isModified: true } : c
    );
    onUpdate({ clauses: updated });
  };
  
  const updateClauseTitle = (id: string, title: string) => {
    const updated = draft.clauses.map(c => 
      c.id === id ? { ...c, title, isModified: true } : c
    );
    onUpdate({ clauses: updated });
  };
  
  const deleteClause = (id: string) => {
    const updated = draft.clauses.filter(c => c.id !== id);
    onUpdate({ clauses: updated });
    if (activeClauseId === id) {
      setActiveClauseId(updated.length > 0 ? updated[0].id : null);
    }
    toast.success('Clause removed');
  };
  
  const addNewClause = (title: string = 'New Clause', content: string = '') => {
    const newClause = {
      id: `custom-${Date.now()}`,
      title,
      content,
      isModified: true,
    };
    onUpdate({ clauses: [...draft.clauses, newClause] });
    setActiveClauseId(newClause.id);
    toast.success('Clause added');
  };
  
  const addFromLibrary = (clause: LibraryClause) => {
    setAddingClauseId(clause.id);
    setTimeout(() => {
      const newClause = {
        id: `lib-${clause.id}-${Date.now()}`,
        title: clause.title,
        content: clause.content,
        isModified: false,
      };
      onUpdate({ clauses: [...draft.clauses, newClause] });
      setActiveClauseId(newClause.id);
      setAddingClauseId(null);
      toast.success(`Added "${clause.title}" from library`);
    }, 300);
  };
  
  const applySuggestion = (suggestion: AISuggestion) => {
    if (suggestion.clauseId) {
      setActiveClauseId(suggestion.clauseId);
    }
    if (suggestion.type === 'add') {
      setShowClauseLibrary(true);
      setLibrarySearch(suggestion.title.replace('Add ', ''));
    }
    toast.info(`Applied: ${suggestion.title}`);
  };
  
  // Empty state when no clauses
  if (draft.clauses.length === 0 && !showClauseLibrary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Edit Contract Content</h2>
            <p className="text-muted-foreground mt-1">
              Add and modify clauses for the renewed contract
            </p>
          </div>
          <Button onClick={() => setShowClauseLibrary(true)}>
            <BookOpen className="h-4 w-4 mr-2" />
            Open Clause Library
          </Button>
        </div>
        
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Clauses Yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            The original contract does not have extracted clauses. 
            Add clauses from the library or create custom ones.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => addNewClause()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Clause
            </Button>
            <Button onClick={() => setShowClauseLibrary(true)}>
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Library
            </Button>
          </div>
        </Card>
        
        {/* AI Suggestions even with no clauses */}
        {aiSuggestions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {aiSuggestions.filter(s => s.type === 'add').slice(0, 3).map(s => (
                <div 
                  key={s.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <Plus className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => applySuggestion(s)}
                  >
                    Apply
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Edit Contract Content</h2>
          <p className="text-muted-foreground mt-1">
            Modify clauses and content for the renewed contract
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={showAiSuggestions ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowAiSuggestions(!showAiSuggestions)}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI Hints
            {aiSuggestions.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-700">
                {aiSuggestions.length}
              </Badge>
            )}
          </Button>
          <Button 
            variant={showClauseLibrary ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowClauseLibrary(!showClauseLibrary)}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Clause Library
          </Button>
        </div>
      </div>
      
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Clause List */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Clauses ({draft.clauses.length})</CardTitle>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addNewClause()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[450px]">
              {draft.clauses.map((clause, index) => (
                <div
                  key={clause.id}
                  onClick={() => setActiveClauseId(clause.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b transition-colors cursor-pointer group",
                    activeClauseId === clause.id 
                      ? "bg-primary/5 border-l-2 border-l-primary" 
                      : "hover:bg-muted border-l-2 border-l-transparent"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{index + 1}.</span>
                        <span className="font-medium text-sm truncate">{clause.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {clause.content.substring(0, 50)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {clause.isModified && (
                        <Badge variant="secondary" className="text-[10px] px-1">
                          Edited
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteClause(clause.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Clause Editor */}
        <Card className={cn(
          "transition-all",
          showClauseLibrary || showAiSuggestions ? "lg:col-span-5" : "lg:col-span-9"
        )}>
          <CardHeader className="pb-3">
            {activeClause ? (
              <Input
                value={activeClause.title}
                onChange={(e) => updateClauseTitle(activeClause.id, e.target.value)}
                className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0"
                placeholder="Clause title..."
              />
            ) : (
              <CardTitle>Select a clause</CardTitle>
            )}
          </CardHeader>
          <CardContent>
            {activeClause ? (
              <div className="space-y-3">
                <Textarea
                  value={activeClause.content}
                  onChange={(e) => updateClause(activeClause.id, e.target.value)}
                  className="min-h-[380px] font-mono text-sm resize-none"
                  placeholder="Enter clause content..."
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{activeClause.content.length} characters</span>
                  {activeClause.isModified && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Edit3 className="h-3 w-3" />
                      Modified from original
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[380px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>Select a clause from the list to edit</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* AI Suggestions Panel */}
        {showAiSuggestions && !showClauseLibrary && aiSuggestions.length > 0 && (
          <Card className="lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                AI Suggestions
              </CardTitle>
              <CardDescription>
                Smart recommendations for your renewal
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 p-4">
                  {aiSuggestions.map((suggestion) => (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-3 rounded-lg border transition-colors cursor-pointer hover:shadow-sm",
                        suggestion.priority === 'high' 
                          ? "border-red-200 bg-red-50/50 hover:bg-red-50" 
                          : suggestion.priority === 'medium'
                          ? "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
                          : "border-muted bg-muted/30 hover:bg-muted/50"
                      )}
                      onClick={() => applySuggestion(suggestion)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {suggestion.type === 'warning' && (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          )}
                          {suggestion.type === 'update' && (
                            <Edit3 className="h-4 w-4 text-violet-600" />
                          )}
                          {suggestion.type === 'add' && (
                            <Plus className="h-4 w-4 text-green-600" />
                          )}
                          {suggestion.type === 'tip' && (
                            <Sparkles className="h-4 w-4 text-violet-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{suggestion.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {suggestion.description}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px]",
                            suggestion.priority === 'high' && "border-red-300 text-red-700",
                            suggestion.priority === 'medium' && "border-amber-300 text-amber-700",
                            suggestion.priority === 'low' && "border-gray-300 text-gray-600"
                          )}
                        >
                          {suggestion.priority}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
        
        {/* Clause Library Panel */}
        {showClauseLibrary && (
          <Card className="lg:col-span-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-violet-600" />
                Clause Library
              </CardTitle>
              <div className="space-y-2 mt-2">
                <Input
                  placeholder="Search clauses..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="h-8 text-sm"
                />
                <Select value={libraryCategory} onValueChange={setLibraryCategory}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[350px]">
                {libraryLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLibrary.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No clauses found
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {filteredLibrary.map((clause) => (
                      <div
                        key={clause.id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{clause.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {clause.content.substring(0, 100)}...
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-[10px]">
                                {clause.category}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[10px]",
                                  clause.riskLevel === 'high' && "border-red-300 text-red-700",
                                  clause.riskLevel === 'medium' && "border-amber-300 text-amber-700",
                                  clause.riskLevel === 'low' && "border-green-300 text-green-700"
                                )}
                              >
                                {clause.riskLevel} risk
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-shrink-0"
                            onClick={() => addFromLibrary(clause)}
                            disabled={addingClauseId === clause.id}
                          >
                            {addingClauseId === clause.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PreviewStep({ 
  draft, 
  original 
}: { 
  draft: RenewalDraft; 
  original: OriginalContract;
}) {
  const finalValue = draft.adjustForInflation 
    ? draft.totalValue * (1 + draft.inflationRate / 100)
    : draft.totalValue;
    
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Preview Renewal</h2>
        <p className="text-muted-foreground mt-1">
          Review the renewal contract before creating it
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>{draft.title}</CardTitle>
          <CardDescription>
            Renewal of: {original.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="document">
            <TabsList>
              <TabsTrigger value="document">Document Preview</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
            </TabsList>
            
            {/* Document Preview Tab */}
            <TabsContent value="document" className="pt-4">
              <div className="bg-white border rounded-lg shadow-sm max-h-[600px] overflow-auto">
                <div className="p-8 font-serif max-w-3xl mx-auto">
                  {/* Document Header */}
                  <div className="text-center mb-8 pb-6 border-b">
                    <h1 className="text-2xl font-bold uppercase tracking-wide mb-2">
                      {original.contractType || 'Contract'} Renewal Agreement
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Renewal Reference: REN-{original.id?.substring(0, 8).toUpperCase() || 'DRAFT'}
                    </p>
                  </div>
                  
                  {/* Preamble */}
                  <div className="mb-8">
                    <p className="leading-relaxed">
                      <strong>THIS RENEWAL AGREEMENT</strong> (&quot;Agreement&quot;) is entered into as of{' '}
                      <span className="font-semibold text-primary underline decoration-dotted">
                        {format(draft.effectiveDate, 'MMMM d, yyyy')}
                      </span>{' '}
                      (&quot;Effective Date&quot;), by and between:
                    </p>
                  </div>
                  
                  {/* Parties */}
                  <div className="mb-8">
                    {draft.parties.map((party, index) => (
                      <p key={index} className="mb-3 leading-relaxed">
                        <strong>{index + 1}.</strong>{' '}
                        <span className="font-semibold">{party.name || '[Party Name]'}</span>
                        {party.email && (
                          <span className="text-muted-foreground"> ({party.email})</span>
                        )}
                        , hereinafter referred to as &quot;<strong>{party.role}</strong>&quot;
                        {index < draft.parties.length - 1 ? ', and' : '.'}
                      </p>
                    ))}
                    {draft.parties.length === 0 && (
                      <p className="text-muted-foreground italic">[No parties specified]</p>
                    )}
                  </div>
                  
                  {/* Recitals */}
                  <div className="mb-8">
                    <h2 className="text-lg font-bold mb-4 uppercase">Recitals</h2>
                    <p className="mb-3 leading-relaxed">
                      <strong>WHEREAS</strong>, the Parties previously entered into an agreement titled &quot;{original.title}&quot;
                      {original.effectiveDate && (
                        <span>
                          {' '}dated {format(new Date(original.effectiveDate), 'MMMM d, yyyy')}
                        </span>
                      )}
                      {original.expirationDate && (
                        <span>
                          {' '}with an expiration date of {format(new Date(original.expirationDate), 'MMMM d, yyyy')}
                        </span>
                      )}
                      {' '}(the &quot;Original Agreement&quot;); and
                    </p>
                    <p className="mb-3 leading-relaxed">
                      <strong>WHEREAS</strong>, the Parties wish to renew and extend the terms of the Original Agreement under
                      the terms and conditions set forth herein;
                    </p>
                    <p className="leading-relaxed">
                      <strong>NOW, THEREFORE</strong>, in consideration of the mutual covenants and agreements herein contained,
                      the Parties agree as follows:
                    </p>
                  </div>
                  
                  {/* Terms Section */}
                  <div className="mb-8">
                    <h2 className="text-lg font-bold mb-4 uppercase">Article I - Term and Renewal</h2>
                    <p className="mb-3 leading-relaxed">
                      <strong>1.1 Renewal Term.</strong> The Original Agreement is hereby renewed for an additional term
                      commencing on{' '}
                      <span className="font-semibold text-primary underline decoration-dotted">
                        {format(draft.effectiveDate, 'MMMM d, yyyy')}
                      </span>{' '}
                      and expiring on{' '}
                      <span className="font-semibold text-primary underline decoration-dotted">
                        {format(draft.expirationDate, 'MMMM d, yyyy')}
                      </span>{' '}
                      (the &quot;Renewal Term&quot;), unless terminated earlier in accordance with the terms of this Agreement.
                    </p>
                    <p className="leading-relaxed">
                      <strong>1.2 Duration.</strong> The Renewal Term shall be for a period of{' '}
                      <span className="font-semibold">
                        {differenceInDays(draft.expirationDate, draft.effectiveDate)} days
                      </span>{' '}
                      ({Math.round(differenceInDays(draft.expirationDate, draft.effectiveDate) / 30)} months).
                    </p>
                  </div>
                  
                  {/* Financial Terms */}
                  <div className="mb-8">
                    <h2 className="text-lg font-bold mb-4 uppercase">Article II - Consideration</h2>
                    <p className="mb-3 leading-relaxed">
                      <strong>2.1 Contract Value.</strong> The total value of this Renewal Agreement shall be{' '}
                      <span className="font-semibold text-primary underline decoration-dotted">
                        {draft.currency} {finalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {draft.adjustForInflation && (
                        <span className="text-muted-foreground">
                          {' '}(adjusted for inflation at {draft.inflationRate}% from original value of {draft.currency} {draft.totalValue.toLocaleString()})
                        </span>
                      )}
                      , payable in accordance with the payment terms set forth in the Original Agreement unless otherwise modified herein.
                    </p>
                  </div>
                  
                  {/* Clauses */}
                  {draft.clauses.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-lg font-bold mb-4 uppercase">Article III - Terms and Conditions</h2>
                      {draft.clauses.map((clause, index) => (
                        <div key={clause.id} className="mb-4">
                          <p className="leading-relaxed">
                            <strong>3.{index + 1} {clause.title}.</strong>{' '}
                            {clause.content}
                            {clause.isModified && (
                              <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-300">
                                Modified
                              </Badge>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Incorporation */}
                  {draft.keepTerms && (
                    <div className="mb-8">
                      <h2 className="text-lg font-bold mb-4 uppercase">Article IV - Incorporation</h2>
                      <p className="leading-relaxed">
                        <strong>4.1 Incorporation by Reference.</strong> Except as expressly modified herein, all terms
                        and conditions of the Original Agreement are incorporated into and made a part of this Renewal
                        Agreement and shall remain in full force and effect during the Renewal Term.
                      </p>
                    </div>
                  )}
                  
                  {/* Notes as Special Provisions */}
                  {draft.notes && (
                    <div className="mb-8">
                      <h2 className="text-lg font-bold mb-4 uppercase">Article V - Special Provisions</h2>
                      <p className="leading-relaxed">{draft.notes}</p>
                    </div>
                  )}
                  
                  {/* Signature Block */}
                  <div className="mt-12 pt-8 border-t">
                    <p className="mb-8 text-center italic">
                      IN WITNESS WHEREOF, the Parties have executed this Renewal Agreement as of the date first written above.
                    </p>
                    <div className="grid md:grid-cols-2 gap-8">
                      {draft.parties.map((party, index) => (
                        <div key={index} className="space-y-4">
                          <p className="font-semibold">{party.role.toUpperCase()}</p>
                          <div className="border-b border-dashed pb-2">
                            <p className="text-sm text-muted-foreground">Signature</p>
                          </div>
                          <p className="font-medium">{party.name || '_______________________'}</p>
                          <p className="text-sm text-muted-foreground">Name and Title</p>
                          <p className="text-sm text-muted-foreground">Date: _______________</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="summary" className="space-y-6 pt-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">New Terms</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Effective Date:</span>
                      <span className="font-medium">{format(draft.effectiveDate, 'PPP')}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Expiration Date:</span>
                      <span className="font-medium">{format(draft.expirationDate, 'PPP')}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Duration:</span>
                      <span className="font-medium">{differenceInDays(draft.expirationDate, draft.effectiveDate)} days</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span>Total Value:</span>
                      <span className="font-medium">
                        {draft.currency} {finalValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold">Parties</h4>
                  <div className="space-y-2">
                    {draft.parties.map((party, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{party.name}</span>
                        <Badge variant="outline" className="ml-auto">{party.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {draft.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{draft.notes}</p>
                </div>
              )}
              
              {draft.clauses.filter(c => c.isModified).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Modified Clauses</h4>
                  <div className="flex flex-wrap gap-2">
                    {draft.clauses.filter(c => c.isModified).map((clause) => (
                      <Badge key={clause.id} variant="secondary">{clause.title}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="comparison" className="space-y-4 pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-3 text-muted-foreground">Original Contract</h4>
                  <div className="space-y-2 text-sm">
                    <div className="p-2 bg-red-50 rounded">
                      <span className="text-muted-foreground">Expiration: </span>
                      <span className="line-through text-red-600">
                        {original.expirationDate ? format(new Date(original.expirationDate), 'PPP') : 'N/A'}
                      </span>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Value: </span>
                      <span>{original.currency} {original.totalValue?.toLocaleString() || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3 text-primary">Renewal Contract</h4>
                  <div className="space-y-2 text-sm">
                    <div className="p-2 bg-green-50 rounded">
                      <span className="text-muted-foreground">New Term: </span>
                      <span className="text-green-600 font-medium">
                        {format(draft.effectiveDate, 'PPP')} - {format(draft.expirationDate, 'PPP')}
                      </span>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Value: </span>
                      <span className="font-medium">
                        {draft.currency} {finalValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfirmStep({ 
  draft, 
  original,
  onConfirm,
  saving,
  submitForApproval,
  onSubmitForApprovalChange,
}: { 
  draft: RenewalDraft; 
  original: OriginalContract;
  onConfirm: () => void;
  saving: boolean;
  submitForApproval: boolean;
  onSubmitForApprovalChange: (v: boolean) => void;
}) {
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <FileSignature className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Ready to Create Renewal</h2>
        <p className="text-muted-foreground mt-1">
          Please confirm the details below and create your renewal contract
        </p>
      </div>
      
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium">{draft.title}</p>
                <p className="text-sm text-muted-foreground">
                  {format(draft.effectiveDate, 'PPP')} - {format(draft.expirationDate, 'PPP')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <DollarSign className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-medium">
                  {draft.currency} {draft.adjustForInflation 
                    ? (draft.totalValue * (1 + draft.inflationRate / 100)).toLocaleString()
                    : draft.totalValue.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total Contract Value</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Copy className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-medium">Linked to: {original.title}</p>
                <p className="text-sm text-muted-foreground">Original contract will be marked as renewed</p>
              </div>
            </div>
            
            {/* Approval Workflow Option */}
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-3 flex-1">
                <Users className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900">Submit for Approval</p>
                  <p className="text-sm text-amber-700">Route renewal through approval workflow before activation</p>
                </div>
              </div>
              <Switch 
                checked={submitForApproval}
                onCheckedChange={onSubmitForApprovalChange}
              />
            </div>
          </div>
          
          <Separator className="my-6" />
          
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {submitForApproval 
                ? 'The renewal will be created and submitted for approval before becoming active.'
                : 'By clicking the button below, a new contract will be created and linked to the original.'}
            </p>
            <Button 
              size="lg" 
              onClick={onConfirm} 
              disabled={saving}
              className={cn(
                "w-full sm:w-auto",
                submitForApproval 
                  ? "bg-gradient-to-r from-amber-500 to-orange-500"
                  : "bg-gradient-to-r from-violet-500 to-violet-600"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {submitForApproval ? 'Submitting...' : 'Creating Renewal...'}
                </>
              ) : submitForApproval ? (
                <>
                  <Users className="h-5 w-5 mr-2" />
                  Create &amp; Submit for Approval
                </>
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  Create Renewal Contract
                </>
              )}
            </Button>
            
            {submitForApproval && (
              <p className="text-xs text-muted-foreground">
                You&apos;ll be redirected to configure the approval workflow
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
