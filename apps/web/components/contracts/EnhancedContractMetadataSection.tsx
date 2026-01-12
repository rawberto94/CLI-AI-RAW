'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Pencil,
  Save,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  FileText,
  Users,
  DollarSign,
  Calendar,
  Bell,
  Shield,
  Building2,
  Globe,
  Languages,
  Hash,
  CreditCard,
  Clock,
  UserCircle,
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ContractMetadataSchema,
  ExternalParty,
  PaymentType,
  BillingFrequencyType,
  Periodicity,
  CONTRACT_METADATA_FIELDS,
  getFieldsBySection,
  getFieldsNeedingAttention,
  formatPaymentType,
  formatBillingFrequency,
  formatPeriodicity,
  getDefaultContractMetadata,
  MetadataFieldDefinition,
  UIAttention
} from '@/lib/types/contract-metadata-schema';
import { formatCurrency, formatDate } from '@/lib/design-tokens';

// ============ SECTION ICONS ============

const SECTION_ICONS = {
  identification: FileText,
  parties: Users,
  commercials: DollarSign,
  dates: Calendar,
  reminders: Bell,
  ownership: Shield
};

const SECTION_LABELS = {
  identification: 'Identification',
  parties: 'Parties',
  commercials: 'Commercials & Financials',
  dates: 'Key Dates',
  reminders: 'Reminders & Notices',
  ownership: 'Ownership & Access'
};

// ============ ATTENTION BADGE ============

function AttentionBadge({ attention, message, onMarkVerified }: { attention: UIAttention; message?: string; onMarkVerified?: () => void }) {
  if (attention === 'none') return null;
  
  const config = {
    warning: { 
      icon: AlertTriangle, 
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      iconClass: 'text-amber-500'
    },
    error: { 
      icon: AlertCircle, 
      className: 'bg-red-50 text-red-700 border-red-200',
      iconClass: 'text-red-500'
    },
    info: { 
      icon: Info, 
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      iconClass: 'text-blue-500'
    }
  };
  
  const cfg = config[attention];
  const Icon = cfg.icon;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("text-xs px-1.5 py-0.5", cfg.className)}>
            <Icon className={cn("h-3 w-3", cfg.iconClass)} />
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 text-white border-slate-700">
          <div className="space-y-2">
            <p className="text-xs text-white">{message || 'Requires verification'}</p>
            {onMarkVerified && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkVerified();
                }}
                className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Mark as Verified
              </Button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============ CONFIDENCE INDICATOR ============

function ConfidenceIndicator({ confidence, source }: { confidence?: number; source?: string }) {
  if (confidence === undefined) return null;
  
  const percent = Math.round(confidence * 100);
  const color = percent >= 80 ? 'emerald' : percent >= 60 ? 'amber' : 'red';
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] px-1.5 py-0 font-mono",
              color === 'emerald' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
              color === 'amber' && 'bg-amber-50 text-amber-700 border-amber-200',
              color === 'red' && 'bg-red-50 text-red-700 border-red-200'
            )}
          >
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
            {percent}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="bg-slate-900 text-white border-slate-700">
          <p className="text-xs text-white">AI Confidence: {percent}%</p>
          {source && <p className="text-xs text-slate-300">Source: {source}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============ COPYABLE FIELD ============

function CopyableValue({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <span className={cn("inline-flex items-center gap-1.5 group", className)}>
      <span className="font-mono text-sm">{value}</span>
      <button 
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-100 rounded"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3 text-slate-400" />
        )}
      </button>
    </span>
  );
}

// ============ PARTY CARD ============

function PartyCard({ 
  party, 
  isEditing, 
  onChange, 
  onRemove 
}: { 
  party: ExternalParty; 
  isEditing: boolean;
  onChange: (updated: ExternalParty) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          {isEditing ? (
            <Input 
              value={party.legalName}
              onChange={(e) => onChange({ ...party, legalName: e.target.value })}
              placeholder="Legal entity name"
              className="h-8 text-sm font-medium"
            />
          ) : (
            <span className="font-medium text-slate-900">{party.legalName}</span>
          )}
        </div>
        {isEditing && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRemove}
            className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {isEditing ? (
        <div className="grid grid-cols-2 gap-2">
          <Input 
            value={party.legalForm || ''}
            onChange={(e) => onChange({ ...party, legalForm: e.target.value })}
            placeholder="Legal form (e.g., LLC)"
            className="h-8 text-xs"
          />
          <Input 
            value={party.role || ''}
            onChange={(e) => onChange({ ...party, role: e.target.value })}
            placeholder="Role (e.g., Supplier)"
            className="h-8 text-xs"
          />
          <Input 
            value={party.registeredSeat || ''}
            onChange={(e) => onChange({ ...party, registeredSeat: e.target.value })}
            placeholder="Registered seat"
            className="h-8 text-xs col-span-2"
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {party.legalForm && <Badge variant="outline" className="text-xs">{party.legalForm}</Badge>}
          {party.role && <Badge variant="secondary" className="text-xs">{party.role}</Badge>}
          {party.registeredSeat && <span>{party.registeredSeat}</span>}
        </div>
      )}
    </div>
  );
}

// ============ SECTION COMPONENT ============

interface MetadataSectionProps {
  section: keyof typeof SECTION_LABELS;
  metadata: Partial<ContractMetadataSchema>;
  isEditing: boolean;
  onChange: (field: string, value: any) => void;
  defaultOpen?: boolean;
}

function MetadataSection({ 
  section, 
  metadata, 
  isEditing, 
  onChange,
  defaultOpen = true 
}: MetadataSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const fields = getFieldsBySection(section);
  const Icon = SECTION_ICONS[section];
  const label = SECTION_LABELS[section];
  
  // Get fields needing attention in this section
  const attentionFields = fields.filter(f => {
    const confidence = metadata._field_confidence?.[f.key];
    return f.ui_attention !== 'none' || confidence?.needsVerification;
  });
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-slate-500" />
            <span className="font-medium text-slate-700">{label}</span>
            {attentionFields.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                {attentionFields.length} needs review
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 px-1">
          {section === 'parties' ? (
            <div className="col-span-2 space-y-3">
              {(metadata.external_parties || []).map((party, idx) => (
                <PartyCard 
                  key={idx}
                  party={party}
                  isEditing={isEditing}
                  onChange={(updated) => {
                    const parties = [...(metadata.external_parties || [])];
                    parties[idx] = updated;
                    onChange('external_parties', parties);
                  }}
                  onRemove={() => {
                    const parties = [...(metadata.external_parties || [])];
                    parties.splice(idx, 1);
                    onChange('external_parties', parties);
                  }}
                />
              ))}
              {isEditing && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const parties = [...(metadata.external_parties || [])];
                    parties.push({ legalName: '' });
                    onChange('external_parties', parties);
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Party
                </Button>
              )}
              {!isEditing && (metadata.external_parties || []).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No parties defined</p>
              )}
            </div>
          ) : (
            fields.map(field => (
              <MetadataField 
                key={field.key}
                field={field}
                value={metadata[field.key]}
                confidence={metadata._field_confidence?.[field.key]}
                isEditing={isEditing && field.editable}
                onChange={(value) => onChange(field.key, value)}
                metadata={metadata}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============ FIELD COMPONENT ============

interface MetadataFieldProps {
  field: MetadataFieldDefinition;
  value: any;
  confidence?: { value: number; source?: string; needsVerification: boolean; message?: string };
  isEditing: boolean;
  onChange: (value: any) => void;
  metadata: Partial<ContractMetadataSchema>;
}

function MetadataField({ field, value, confidence, isEditing, onChange, metadata }: MetadataFieldProps) {
  const [isFieldEditing, setIsFieldEditing] = useState(false);
  const [fieldValue, setFieldValue] = useState(value);
  const [isVerified, setIsVerified] = useState(false);
  const needsAttention = (field.ui_attention !== 'none' || confidence?.needsVerification) && !isVerified;
  
  // Sync with external value changes
  useEffect(() => {
    setFieldValue(value);
  }, [value]);
  
  const handleSaveField = () => {
    onChange(fieldValue);
    setIsFieldEditing(false);
  };
  
  const handleCancelField = () => {
    setFieldValue(value);
    setIsFieldEditing(false);
  };
  
  const handleMarkVerified = () => {
    setIsVerified(true);
    toast.success('Field marked as verified');
  };
  
  const renderValue = () => {
    // Special handling for certain fields
    if (field.key === 'document_number') {
      return <CopyableValue value={value || 'Not assigned'} />;
    }
    
    if (field.type === 'decimal' && field.key === 'tcv_amount') {
      const currency = metadata.currency || 'USD';
      return value ? formatCurrency(value, currency) : 'Not specified';
    }
    
    if (field.type === 'date') {
      return value ? formatDate(value) : 'Not specified';
    }
    
    if (field.type === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (field.type === 'enum') {
      if (field.key === 'payment_type') return formatPaymentType(value as PaymentType);
      if (field.key === 'billing_frequency_type') return formatBillingFrequency(value as BillingFrequencyType);
      if (field.key === 'periodicity') return formatPeriodicity(value as Periodicity);
      return value || 'Not specified';
    }
    
    if (field.type === 'array_fk') {
      if (Array.isArray(value) && value.length > 0) {
        return value.join(', ');
      }
      return 'Not assigned';
    }
    
    return value || 'Not specified';
  };
  
  const renderInput = () => {
    if (field.type === 'string') {
      if (field.key === 'contract_short_description' || field.key === 'tcv_text') {
        return (
          <Textarea
            value={fieldValue || ''}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            className="min-h-[80px] text-sm bg-white"
          />
        );
      }
      return (
        <Input
          value={fieldValue || ''}
          onChange={(e) => setFieldValue(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}...`}
          className="h-9 text-sm bg-white"
        />
      );
    }
    
    if (field.type === 'decimal' || field.type === 'integer') {
      return (
        <Input
          type="number"
          value={fieldValue || ''}
          onChange={(e) => setFieldValue(field.type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value))}
          placeholder="0"
          className="h-9 text-sm bg-white"
        />
      );
    }
    
    if (field.type === 'date') {
      return (
        <Input
          type="date"
          value={fieldValue || ''}
          onChange={(e) => setFieldValue(e.target.value)}
          className="h-9 text-sm bg-white"
        />
      );
    }
    
    if (field.type === 'boolean') {
      return (
        <Switch
          checked={!!fieldValue}
          onCheckedChange={setFieldValue}
        />
      );
    }
    
    if (field.type === 'enum' && field.enum) {
      return (
        <Select value={fieldValue || ''} onValueChange={setFieldValue}>
          <SelectTrigger className="h-9 text-sm bg-white">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {field.enum.map(opt => (
              <SelectItem key={opt} value={opt}>
                {field.key === 'payment_type' ? formatPaymentType(opt as PaymentType) :
                 field.key === 'billing_frequency_type' ? formatBillingFrequency(opt as BillingFrequencyType) :
                 field.key === 'periodicity' ? formatPeriodicity(opt as Periodicity) :
                 opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    return <Input value={fieldValue || ''} onChange={(e) => setFieldValue(e.target.value)} className="h-9 text-sm bg-white" />;
  };
  
  const colSpan = field.key === 'contract_short_description' || field.key === 'tcv_text' || field.key === 'notice_period' 
    ? 'md:col-span-2' 
    : '';
  
  // Determine if this field should be editable
  const canEdit = field.editable && !field.system_generated;
  const showEditMode = isEditing || isFieldEditing;
  
  return (
    <div className={cn(
      "flex flex-col p-3 rounded-lg transition-colors",
      needsAttention ? 'bg-amber-50/50 border border-amber-100' : 'bg-slate-50',
      colSpan
    )}>
      <div className="flex items-center gap-2 mb-1">
        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {field.label}
        </Label>
        {field.required && <span className="text-red-400 text-xs">*</span>}
        {field.system_generated && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-slate-100 text-slate-500">
            System
          </Badge>
        )}
        {confidence && <ConfidenceIndicator confidence={confidence.value} source={confidence.source} />}
        {needsAttention && (
          <AttentionBadge 
            attention={field.ui_attention || 'warning'} 
            message={confidence?.message || 'Requires verification'} 
            onMarkVerified={handleMarkVerified}
          />
        )}
        
        {/* Inline edit button - only show if not in global edit mode */}
        {!isEditing && canEdit && !isFieldEditing && (
          <button
            onClick={() => setIsFieldEditing(true)}
            className="ml-auto p-1 hover:bg-slate-200 rounded transition-colors"
            title="Edit this field"
          >
            <Pencil className="h-3 w-3 text-slate-400 hover:text-slate-600" />
          </button>
        )}
        
        {/* Inline save/cancel buttons */}
        {isFieldEditing && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={handleSaveField}
              className="p-1 hover:bg-emerald-100 rounded transition-colors"
              title="Save"
            >
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            </button>
            <button
              onClick={handleCancelField}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5 text-red-500" />
            </button>
          </div>
        )}
      </div>
      
      {showEditMode && canEdit ? (
        renderInput()
      ) : (
        <div 
          className={cn(
            "text-sm mt-0.5",
            value ? 'text-slate-900' : 'text-slate-400 italic',
            canEdit && !isEditing && "cursor-pointer hover:bg-slate-100 p-1.5 rounded -m-1.5 transition-colors"
          )}
          onClick={() => {
            if (canEdit && !isEditing) {
              setIsFieldEditing(true);
            }
          }}
          title={canEdit && !isEditing ? "Click to edit" : undefined}
        >
          {renderValue()}
        </div>
      )}
    </div>
  );
}

// ============ MAIN COMPONENT ============

interface EnhancedContractMetadataSectionProps {
  contractId: string;
  tenantId: string;
  initialMetadata?: Partial<ContractMetadataSchema>;
  contract?: any; // Legacy contract data for backward compatibility
  overviewData?: any; // AI-extracted overview data
  financialData?: any; // AI-extracted financial data
  onSave?: (metadata: Partial<ContractMetadataSchema>) => Promise<void>;
  onRefresh?: () => void;
}

export function EnhancedContractMetadataSection({
  contractId,
  tenantId,
  initialMetadata,
  contract,
  overviewData,
  financialData,
  onSave,
  onRefresh
}: EnhancedContractMetadataSectionProps) {
  const [metadataFromAPI, setMetadataFromAPI] = useState<Partial<ContractMetadataSchema> | null>(null);
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  
  // Fetch metadata from API
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/api/contracts/${contractId}/metadata`, {
          headers: { 'x-tenant-id': tenantId }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.metadata) {
            setMetadataFromAPI(data.metadata);
          }
        }
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      }
    };
    
    fetchMetadata();
  }, [contractId, tenantId]);
  
  // Merge legacy data with new schema
  const mergedInitial = useMemo(() => {
    const base = getDefaultContractMetadata();
    
    // First, use metadata from API if available
    if (metadataFromAPI) {
      Object.assign(base, metadataFromAPI);
    }
    
    // Map legacy fields
    if (contract) {
      if (!base.document_number) base.document_number = contract.id || contractId;
      if (!base.document_title) base.document_title = contract.contractTitle || contract.filename || '';
      if (!base.currency) base.currency = contract.currency || 'USD';
      if (!base.start_date) base.start_date = contract.effectiveDate || contract.startDate || '';
      if (!base.end_date) base.end_date = contract.expirationDate || contract.endDate || null;
    }
    
    // Map overview data from AI extraction (lowest priority)
    if (overviewData) {
      if (!base.document_title) base.document_title = overviewData.contractTitle || '';
      if (!base.contract_short_description) base.contract_short_description = overviewData.summary || overviewData.description || '';
      if (!base.jurisdiction) base.jurisdiction = overviewData.jurisdiction || '';
      if (!base.contract_language) base.contract_language = overviewData.language || 'en';
      if (!base.tcv_amount) base.tcv_amount = overviewData.totalValue || 0;
      if (!base.start_date) base.start_date = overviewData.effectiveDate || '';
      if (!base.end_date) base.end_date = overviewData.expirationDate || null;
      
      // Map parties
      if (!base.external_parties?.length && overviewData.parties && Array.isArray(overviewData.parties)) {
        base.external_parties = overviewData.parties.map((p: any) => ({
          legalName: p.name || '',
          role: p.role || '',
          registeredAddress: p.address || ''
        }));
      }
    }
    
    // Map financial data from AI extraction
    if (financialData) {
      base.tcv_amount = base.tcv_amount || financialData.totalValue || 0;
      base.tcv_text = financialData.totalValue ? formatCurrency(financialData.totalValue, base.currency) : '';
      base.currency = base.currency || financialData.currency || 'USD';
      
      // Map payment terms to payment_type (ensure string conversion for safety)
      const paymentTerms = String(financialData.paymentTerms || '').toLowerCase();
      if (paymentTerms.includes('milestone')) {
        base.payment_type = 'milestone';
      } else if (paymentTerms.includes('time') || paymentTerms.includes('hourly')) {
        base.payment_type = 'time_and_material';
      } else if (paymentTerms.includes('fixed') || paymentTerms.includes('lump')) {
        base.payment_type = 'fixed_price';
      } else if (paymentTerms.includes('retainer')) {
        base.payment_type = 'retainer';
      }
      
      // Try to extract billing frequency from payment schedule
      if (financialData.paymentSchedule && Array.isArray(financialData.paymentSchedule)) {
        const scheduleLength = financialData.paymentSchedule.length;
        if (scheduleLength === 4) {
          base.billing_frequency_type = 'recurring';
          base.periodicity = 'quarterly';
        } else if (scheduleLength === 12) {
          base.billing_frequency_type = 'recurring';
          base.periodicity = 'monthly';
        } else if (scheduleLength === 1) {
          base.billing_frequency_type = 'one_off';
        }
      }
      
      // Map notice period from penalties or payment terms
      if (paymentTerms.includes('30 day')) {
        base.notice_period = '30 days';
        base.notice_period_days = 30;
      } else if (paymentTerms.includes('60 day')) {
        base.notice_period = '60 days';
        base.notice_period_days = 60;
      } else if (paymentTerms.includes('90 day')) {
        base.notice_period = '90 days';
        base.notice_period_days = 90;
      }
    }
    
    // Override with explicit initial metadata
    return { ...base, ...initialMetadata };
  }, [contractId, contract, overviewData, financialData, initialMetadata, metadataFromAPI]);
  
  const [metadata, setMetadata] = useState<Partial<ContractMetadataSchema>>(mergedInitial);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Update when initial data changes
  useEffect(() => {
    setMetadata(mergedInitial);
  }, [mergedInitial]);
  
  const fieldsNeedingAttention = useMemo(() => 
    getFieldsNeedingAttention(metadata), 
    [metadata]
  );
  
  const handleChange = useCallback((field: string, value: any) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  }, []);
  
  // Validation rules
  const validateMetadata = useCallback((data: Partial<ContractMetadataSchema>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Required fields validation
    if (!data.document_title?.trim()) {
      errors.push('Document title is required');
    }
    
    // Date validations
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      if (endDate < startDate) {
        errors.push('Contract end date must be after start date');
      }
    }
    
    // Financial validations
    if (data.tcv_amount !== undefined && data.tcv_amount < 0) {
      errors.push('Contract value cannot be negative');
    }
    
    // Reminder days validation
    if (data.reminder_days_before_end !== undefined && data.reminder_days_before_end < 0) {
      errors.push('Reminder days must be positive');
    }
    
    // Notice period validation
    if (data.notice_period_days !== undefined && data.notice_period_days < 0) {
      errors.push('Notice period days must be positive');
    }
    
    return { isValid: errors.length === 0, errors };
  }, []);
  
  const handleSave = async () => {
    // Validate before saving
    const { isValid, errors } = validateMetadata(metadata);
    
    if (!isValid) {
      errors.forEach(error => toast.error(error));
      return;
    }
    
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      if (onSave) {
        await onSave(metadata);
      } else {
        // Default save to API
        const response = await fetch(`/api/contracts/${contractId}/metadata`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
          body: JSON.stringify({
            tenantId,
            metadata,
            userId: 'current-user'
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to save metadata');
        }
        
        // Fetch fresh metadata after save
        const getResponse = await fetch(`/api/contracts/${contractId}/metadata`, {
          headers: { 'x-tenant-id': tenantId }
        });
        
        if (getResponse.ok) {
          const data = await getResponse.json();
          if (data.success && data.metadata) {
            setMetadataFromAPI(data.metadata);
            setMetadata(data.metadata);
          }
        }
      }
      
      setSaveSuccess(true);
      setIsEditing(false);
      toast.success('Contract metadata saved successfully');
      
      setTimeout(() => setSaveSuccess(false), 3000);
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to save metadata:', error);
      toast.error('Failed to save metadata. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCancel = () => {
    setMetadata(mergedInitial);
    setIsEditing(false);
  };
  
  const handleAIExtraction = async () => {
    setIsExtractingAI(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          force: true,
          includeConfidence: true
        })
      });
      
      if (!response.ok) {
        throw new Error('AI extraction failed');
      }
      
      toast.success('AI extraction started. Refreshing metadata...');
      
      // Refresh metadata after a delay
      setTimeout(async () => {
        const getResponse = await fetch(`/api/contracts/${contractId}/metadata`, {
          headers: { 'x-tenant-id': tenantId }
        });
        
        if (getResponse.ok) {
          const data = await getResponse.json();
          if (data.success && data.metadata) {
            setMetadataFromAPI(data.metadata);
            setMetadata(data.metadata);
          }
        }
        
        if (onRefresh) {
          onRefresh();
        }
        
        toast.success('AI extraction completed! Metadata updated with confidence scores.');
      }, 3000);
    } catch (error) {
      console.error('Failed to trigger AI extraction:', error);
      toast.error('Failed to start AI extraction. Please try again.');
    } finally {
      setIsExtractingAI(false);
    }
  };
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-indigo-600" />
              Contract Metadata
            </CardTitle>
            <CardDescription className="mt-1">
              {isEditing ? 'Editing metadata - changes will be saved' : 'Core contract information and details'}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {fieldsNeedingAttention.length > 0 && !isEditing && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {fieldsNeedingAttention.length} fields need review
              </Badge>
            )}
            
            {!isEditing ? (
              <>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleAIExtraction}
                  disabled={isExtractingAI}
                  className="border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  {isExtractingAI ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1.5" />
                      AI Extract
                    </>
                  )}
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => setIsEditing(true)}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit Metadata
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* Success Message */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-700">Metadata saved successfully</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Sections */}
        <div className="space-y-3">
          <MetadataSection 
            section="identification" 
            metadata={metadata} 
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={true}
          />
          
          <MetadataSection 
            section="parties" 
            metadata={metadata} 
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={true}
          />
          
          <MetadataSection 
            section="commercials" 
            metadata={metadata} 
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={true}
          />
          
          <MetadataSection 
            section="dates" 
            metadata={metadata} 
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default EnhancedContractMetadataSection;
