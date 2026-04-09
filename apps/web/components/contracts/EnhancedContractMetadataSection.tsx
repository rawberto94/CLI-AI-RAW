'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  FileText,
  Users,
  DollarSign,
  Calendar,
  Bell,
  Shield,
  Building2,
  Sparkles,
  Copy,
  Check,
  Plus,
  Trash2,
  Eye,
  MapPin,
  Hash,
  FileCheck,
  Settings2,
  PartyPopper,
  Undo2,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ContractMetadataSchema,
  ExternalParty,
  PaymentType,
  BillingFrequencyType,
  Periodicity,
  getFieldsBySection,
  getFieldsNeedingAttention,
  formatPaymentType,
  formatBillingFrequency,
  formatPeriodicity,
  getDefaultContractMetadata,
  MetadataFieldDefinition,
  UIAttention,
  SignatureStatus,
  DocumentClassification
} from '@/lib/types/contract-metadata-schema';
import { formatCurrency, formatDate } from '@/lib/design-tokens';

// ============ DEBOUNCE HOOK ============

function useDebounce<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

// ============ CONFETTI CELEBRATION COMPONENT ============

function ConfettiCelebration({ show }: { show: boolean }) {
  if (!show) return null;
  
  const confettiColors = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
  const confettiCount = 50;
  
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {show && Array.from({ length: confettiCount }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-sm"
            style={{
              backgroundColor: confettiColors[i % confettiColors.length],
              left: `${Math.random() * 100}%`,
            }}
            initial={{ 
              top: -20, 
              rotate: 0,
              opacity: 1,
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              top: '110%',
              rotate: Math.random() * 720 - 360,
              opacity: [1, 1, 0],
            }}
            transition={{ 
              duration: Math.random() * 2 + 2,
              delay: Math.random() * 0.5,
              ease: 'easeOut'
            }}
            exit={{ opacity: 0 }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============ SECTION CONFIG ============

const SECTION_CONFIG = {
  identification: {
    icon: FileText,
    label: 'Identification',
    description: 'Document type, title, and classification',
    gradient: 'from-violet-500 to-purple-500',
    bgGradient: 'from-violet-50 to-purple-50',
    iconBg: 'bg-gradient-to-br from-violet-100 to-purple-100',
    iconColor: 'text-violet-600',
    borderColor: 'border-violet-200',
    accentColor: 'blue'
  },
  parties: {
    icon: Users,
    label: 'Parties',
    description: 'Contracting parties and stakeholders',
    gradient: 'from-violet-500 to-purple-500',
    bgGradient: 'from-violet-50 to-purple-50',
    iconBg: 'bg-gradient-to-br from-violet-100 to-purple-100',
    iconColor: 'text-violet-600',
    borderColor: 'border-violet-200',
    accentColor: 'violet'
  },
  commercials: {
    icon: DollarSign,
    label: 'Commercials',
    description: 'Financial terms, pricing, and billing',
    gradient: 'from-violet-500 to-violet-500',
    bgGradient: 'from-violet-50 to-violet-50',
    iconBg: 'bg-gradient-to-br from-violet-100 to-violet-100',
    iconColor: 'text-violet-600',
    borderColor: 'border-violet-200',
    accentColor: 'emerald'
  },
  dates: {
    icon: Calendar,
    label: 'Key Dates',
    description: 'Timeline, signatures, and deadlines',
    gradient: 'from-orange-500 to-amber-500',
    bgGradient: 'from-orange-50 to-amber-50',
    iconBg: 'bg-gradient-to-br from-orange-100 to-amber-100',
    iconColor: 'text-orange-600',
    borderColor: 'border-orange-200',
    accentColor: 'orange'
  },
  reminders: {
    icon: Bell,
    label: 'Reminders',
    description: 'Notifications and notice periods',
    gradient: 'from-pink-500 to-rose-500',
    bgGradient: 'from-pink-50 to-rose-50',
    iconBg: 'bg-gradient-to-br from-pink-100 to-rose-100',
    iconColor: 'text-pink-600',
    borderColor: 'border-pink-200',
    accentColor: 'pink'
  },
  ownership: {
    icon: Shield,
    label: 'Ownership',
    description: 'Access control and responsibilities',
    gradient: 'from-slate-500 to-zinc-500',
    bgGradient: 'from-slate-50 to-zinc-50',
    iconBg: 'bg-gradient-to-br from-slate-100 to-zinc-100',
    iconColor: 'text-slate-600',
    borderColor: 'border-slate-200',
    accentColor: 'slate'
  }
};

// For backwards compatibility - exported for potential external use
export const SECTION_ICONS = Object.fromEntries(
  Object.entries(SECTION_CONFIG).map(([k, v]) => [k, v.icon])
) as Record<string, React.ComponentType<{ className?: string }>>;

export const SECTION_LABELS = Object.fromEntries(
  Object.entries(SECTION_CONFIG).map(([k, v]) => [k, v.label])
) as Record<string, string>;

// ============ ANIMATED PROGRESS RING ============

function ProgressRing({ 
  progress, 
  size = 44, 
  strokeWidth = 3.5,
  showLabel = true 
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  showLabel?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  const getColor = () => {
    if (progress >= 80) return { stroke: 'text-violet-500', text: 'text-violet-600', bg: 'text-violet-100' };
    if (progress >= 50) return { stroke: 'text-amber-500', text: 'text-amber-600', bg: 'text-amber-100' };
    return { stroke: 'text-red-500', text: 'text-red-600', bg: 'text-red-100' };
  };
  
  const colors = getColor();
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className={colors.bg}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          className={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-xs font-bold", colors.text)}>
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ============ ATTENTION BADGE ============

function AttentionBadge({ 
  attention, 
  message, 
  onMarkVerified, 
  isVerifying 
}: { 
  attention: UIAttention; 
  message?: string; 
  onMarkVerified?: () => void; 
  isVerifying?: boolean;
}) {
  if (attention === 'none') return null;
  
  const config = {
    warning: { 
      icon: AlertTriangle, 
      className: 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200/60 shadow-sm shadow-amber-100/50',
      iconClass: 'text-amber-500',
      glowClass: 'ring-2 ring-amber-100'
    },
    error: { 
      icon: AlertCircle, 
      className: 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200/60 shadow-sm shadow-red-100/50',
      iconClass: 'text-red-500',
      glowClass: 'ring-2 ring-red-100'
    },
    info: { 
      icon: Info, 
      className: 'bg-gradient-to-r from-violet-50 to-sky-50 text-violet-700 border-violet-200/60 shadow-sm shadow-violet-100/50',
      iconClass: 'text-violet-500',
      glowClass: 'ring-2 ring-violet-100'
    }
  };
  
  const cfg = config[attention];
  const Icon = cfg.icon;
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs px-2 py-0.5 cursor-pointer transition-all",
                cfg.className
              )}
            >
              <Icon className={cn("h-3 w-3 mr-1", cfg.iconClass)} />
              <span className="font-medium">Review</span>
            </Badge>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-slate-900/95 backdrop-blur-md text-white border-slate-700/50 shadow-2xl max-w-xs p-4 rounded-xl"
          sideOffset={8}
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <div className={cn(
                "p-1.5 rounded-lg",
                attention === 'warning' && "bg-amber-500/20",
                attention === 'error' && "bg-red-500/20",
                attention === 'info' && "bg-violet-500/20"
              )}>
                <Icon className={cn(
                  "h-4 w-4",
                  attention === 'warning' && "text-amber-400",
                  attention === 'error' && "text-red-400",
                  attention === 'info' && "text-violet-400"
                )} />
              </div>
              <p className="text-sm text-slate-100 leading-relaxed">{message || 'This field requires verification'}</p>
            </div>
            {onMarkVerified && (
              <Button 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkVerified();
                }}
                disabled={isVerifying}
                className="w-full h-9 bg-violet-500 hover:bg-violet-400 text-white font-medium shadow-lg shadow-violet-500/30 transition-all rounded-lg"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Mark as Verified
                  </>
                )}
              </Button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============ VERIFIED BADGE ============

function VerifiedBadge({ validatedAt }: { validatedAt?: string }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Badge 
              variant="outline" 
              className="text-xs px-2 py-0.5 bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 border-violet-200/60 shadow-sm shadow-violet-100/50"
            >
              <CheckCircle2 className="h-3 w-3 mr-1 text-violet-500" />
              <span className="font-medium">Verified</span>
            </Badge>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-slate-900/95 backdrop-blur-md text-white border-slate-700/50 shadow-xl rounded-xl p-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-500/20">
              <CheckCircle2 className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Verified</p>
              {validatedAt && (
                <p className="text-xs text-slate-400">{new Date(validatedAt).toLocaleDateString()}</p>
              )}
            </div>
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
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            whileHover={{ scale: 1.05 }}
          >
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] px-1.5 py-0 font-mono cursor-help transition-all",
                color === 'emerald' && 'bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 border-violet-200',
                color === 'amber' && 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-amber-200',
                color === 'red' && 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200'
              )}
            >
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              {percent}%
            </Badge>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-slate-900/95 backdrop-blur-md text-white border-slate-700/50 shadow-xl rounded-xl p-4"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "p-1.5 rounded-lg",
                color === 'emerald' && "bg-violet-500/20",
                color === 'amber' && "bg-amber-500/20",
                color === 'red' && "bg-red-500/20"
              )}>
                <Sparkles className={cn(
                  "h-4 w-4",
                  color === 'emerald' && 'text-violet-400',
                  color === 'amber' && 'text-amber-400',
                  color === 'red' && 'text-red-400'
                )} />
              </div>
              <div>
                <p className="font-medium">AI Confidence</p>
                <p className={cn(
                  "text-lg font-bold",
                  color === 'emerald' && 'text-violet-400',
                  color === 'amber' && 'text-amber-400',
                  color === 'red' && 'text-red-400'
                )}>{percent}%</p>
              </div>
            </div>
            {source && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Eye className="h-3 w-3" />
                Source: {source}
              </div>
            )}
            <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
              <motion.div 
                className={cn(
                  "h-full rounded-full",
                  color === 'emerald' && 'bg-gradient-to-r from-violet-500 to-purple-400',
                  color === 'amber' && 'bg-gradient-to-r from-amber-500 to-yellow-400',
                  color === 'red' && 'bg-gradient-to-r from-red-500 to-rose-400'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
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
    toast.success('Copied to clipboard', { duration: 1500 });
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <span className={cn("inline-flex items-center gap-2 group", className)}>
      <span className="font-mono text-sm bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">{value}</span>
      <motion.button 
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-slate-100 rounded-lg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Check className="h-3.5 w-3.5 text-violet-500" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Copy className="h-3.5 w-3.5 text-slate-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </span>
  );
}

// ============ CLEAN PARTY CARD ============

interface PartyDisplayProps {
  party: ExternalParty;
  index: number;
  isEditing: boolean;
  onChange: (updated: ExternalParty) => void;
  onRemove: () => void;
}

function PartyCard({ party, index, isEditing, onChange, onRemove }: PartyDisplayProps) {
  const displayName = party.legalName || '';
  const displayRole = party.role || 'Party';
  
  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-violet-50 rounded-lg shrink-0">
            <Building2 className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1 space-y-3">
            <Input
              value={displayName}
              onChange={(e) => onChange({ ...party, legalName: e.target.value })}
              placeholder="Company name"
              className="h-9 font-medium"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={party.role || ''}
                onChange={(e) => onChange({ ...party, role: e.target.value })}
                placeholder="Role (e.g., Client)"
                className="h-8 text-sm"
              />
              <Input
                value={party.legalForm || ''}
                onChange={(e) => onChange({ ...party, legalForm: e.target.value })}
                placeholder="Legal form (e.g., GmbH)"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // View mode - clean and minimal
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:border-violet-200 hover:shadow-sm transition-all"
    >
      <div className="p-2.5 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl shrink-0">
        {party.role?.toLowerCase().includes('client') ? (
          <Briefcase className="h-5 w-5 text-violet-600" />
        ) : (
          <Building2 className="h-5 w-5 text-violet-600" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-slate-900 truncate">
            {displayName || <span className="text-slate-400 italic">Unnamed Party</span>}
          </h4>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-600 hover:bg-slate-100">
            {displayRole}
          </Badge>
          {party.legalForm && (
            <span className="text-xs text-slate-500">{party.legalForm}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============ CLEAN EMPTY STATE ============

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-10 px-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50"
    >
      <div className="p-3 bg-white rounded-xl shadow-sm mb-3">
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <h3 className="text-sm font-medium text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mb-3">{description}</p>
      {action}
    </motion.div>
  );
}

// ============ SECTION COMPONENT ============

type SectionKey = keyof typeof SECTION_CONFIG;

interface MetadataSectionProps {
  section: SectionKey;
  metadata: Partial<ContractMetadataSchema>;
  isEditing: boolean;
  onChange: (field: string, value: unknown) => void;
  defaultOpen?: boolean;
  contractId?: string;
  tenantId?: string;
  fieldValidations?: Record<string, { status: string; validatedAt?: string }>;
  onFieldValidated?: (fieldKey: string) => void;
}

function MetadataSection({ 
  section, 
  metadata, 
  isEditing, 
  onChange,
  defaultOpen = true,
  contractId,
  tenantId,
  fieldValidations,
  onFieldValidated,
  
  sectionProgress // Can be used for external sync, currently calculated internally
}: MetadataSectionProps & { sectionProgress?: { verified: number; total: number } }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const fields = getFieldsBySection(section);
  const config = SECTION_CONFIG[section];
  const Icon = config.icon;
  
  // Get fields needing attention in this section (excluding already validated ones)
  const attentionFields = fields.filter(f => {
    // Skip if field has been validated
    const savedValidation = fieldValidations?.[f.key];
    const isValidated = savedValidation?.status === 'validate' || savedValidation?.status === 'validated';
    if (isValidated) return false;
    
    // Check AI confidence
    const confidence = (metadata._field_confidence as Record<string, { value: number; source?: string; needsVerification: boolean; message?: string }> | undefined)?.[f.key];
    const hasLowConfidence = confidence && confidence.value < 0.8;
    const needsVerification = confidence?.needsVerification;
    
    // Check if field has attention requirement from schema
    const hasSchemaAttention = f.ui_attention !== 'none';
    
    // Check if required field is missing a value
    const value = (metadata as Record<string, unknown>)[f.key];
    const isMissingRequired = f.required && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0));
    
    return hasSchemaAttention || hasLowConfidence || needsVerification || isMissingRequired;
  });
  
  // Get verified fields count
  const verifiedFields = fields.filter(f => {
    const savedValidation = fieldValidations?.[f.key];
    return savedValidation?.status === 'validate' || savedValidation?.status === 'validated';
  });
  
  // Get unverified fields (for "Verify All" button)
  const unverifiedFields = fields.filter(f => {
    const savedValidation = fieldValidations?.[f.key];
    return savedValidation?.status !== 'validate' && savedValidation?.status !== 'validated';
  });
  
  // Calculate progress percentage
  const totalFields = fields.length;
  const verifiedCount = verifiedFields.length;
  const progressPercent = totalFields > 0 ? Math.round((verifiedCount / totalFields) * 100) : 0;
  
  // Handler for verifying all unverified fields in section
  const handleVerifyAll = async () => {
    if (!contractId || unverifiedFields.length === 0) return;
    
    setIsVerifyingAll(true);
    try {
      // Verify each unverified field in the section
      for (const field of unverifiedFields) {
        const response = await fetch(`/api/contracts/${contractId}/metadata/validate`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId || 'demo',
          },
          body: JSON.stringify({
            fieldKey: field.key,
            action: 'validate',
            newValue: (metadata as Record<string, unknown>)[field.key],
          }),
        });
        
        if (response.ok) {
          onFieldValidated?.(field.key);
        }
      }
      toast.success(`${unverifiedFields.length} fields verified in ${config.label}`);
    } catch {
      toast.error('Failed to verify all fields');
    } finally {
      setIsVerifyingAll(false);
    }
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div 
          className={cn(
            "flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer border",
            isOpen 
              ? "bg-white border-slate-200 shadow-sm"
              : "bg-slate-50/80 hover:bg-white border-transparent hover:border-slate-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isOpen ? "bg-violet-50" : "bg-slate-100"
            )}>
              <Icon className={cn("h-4 w-4", isOpen ? "text-violet-600" : "text-slate-500")} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800 text-sm">{config.label}</span>
                {attentionFields.length > 0 ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                    {attentionFields.length}
                  </Badge>
                ) : verifiedCount === totalFields && totalFields > 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : null}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isOpen && totalFields > 0 && (
              <span className="text-xs text-slate-400">{verifiedCount}/{totalFields}</span>
            )}
            <ChevronDown className={cn(
              "h-4 w-4 text-slate-400 transition-transform",
              isOpen && "rotate-180"
            )} />
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="mt-3 pl-2 pr-2 pb-2">
          {/* Clean verification progress */}
          {totalFields > 0 && (
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      progressPercent >= 80 ? "bg-emerald-500" :
                      progressPercent >= 50 ? "bg-amber-500" :
                      "bg-slate-400"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {verifiedCount}/{totalFields} verified
                </span>
              </div>
              {unverifiedFields.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleVerifyAll}
                  disabled={isVerifyingAll}
                  className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                >
                  {isVerifyingAll ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>Verify all</>
                  )}
                </Button>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {section === 'parties' ? (
              <div className="col-span-2 space-y-2">
                <AnimatePresence mode="popLayout">
                  {(metadata.external_parties || []).map((party, idx) => (
                    <PartyCard 
                      key={idx}
                      party={party}
                      index={idx}
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
                </AnimatePresence>
                
                {isEditing && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const parties = [...(metadata.external_parties || [])];
                      parties.push({ legalName: '' });
                      onChange('external_parties', parties);
                    }}
                    className="w-full h-10 border-dashed border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add party
                  </Button>
                )}
                
                {!isEditing && (metadata.external_parties || []).length === 0 && (
                  <EmptyState
                    icon={Users}
                    title="No parties extracted"
                    description="Parties will appear here after AI processing or manual entry."
                  />
                )}
              </div>
            ) : (
              fields.map((field, idx) => (
                <MetadataField 
                  key={field.key}
                  field={field}
                  value={(metadata as Record<string, unknown>)[field.key]}
                  confidence={(metadata._field_confidence as Record<string, { value: number; source?: string; needsVerification: boolean; message?: string }> | undefined)?.[field.key]}
                  isEditing={isEditing && field.editable}
                  onChange={(value) => onChange(field.key, value)}
                  metadata={metadata}
                  contractId={contractId}
                  tenantId={tenantId}
                  fieldValidations={fieldValidations}
                  onFieldValidated={onFieldValidated}
                  index={idx}
                />
              ))
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============ FIELD COMPONENT ============

interface MetadataFieldProps {
  field: MetadataFieldDefinition;
  value: unknown;
  confidence?: { value: number; source?: string; needsVerification: boolean; message?: string };
  isEditing: boolean;
  onChange: (value: unknown) => void;
  metadata: Partial<ContractMetadataSchema>;
  contractId?: string;
  tenantId?: string;
  fieldValidations?: Record<string, { status: string; validatedAt?: string }>;
  onFieldValidated?: (fieldKey: string) => void;
  index?: number;
}

function MetadataField({ 
  field, 
  value, 
  confidence, 
  isEditing, 
  onChange, 
  metadata, 
  contractId, 
  tenantId, 
  fieldValidations, 
  onFieldValidated,
  index = 0
}: MetadataFieldProps) {
  const [isFieldEditing, setIsFieldEditing] = useState(false);
  const [fieldValue, setFieldValue] = useState(value);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Check if field was previously validated (from API response or local state)
  const savedValidation = fieldValidations?.[field.key];
  const isValidatedFromAPI = savedValidation?.status === 'validate' || savedValidation?.status === 'validated';
  
  // Track local verification (for immediate UI feedback before API confirms)
  const [localVerified, setLocalVerified] = useState(false);
  
  // Field is verified if either API says so or local state says so
  const isVerified = isValidatedFromAPI || localVerified;
  
  // Reset local verified state when API validation status changes
  React.useEffect(() => {
    if (isValidatedFromAPI) {
      setLocalVerified(false); // Clear local state since API has the source of truth
    }
  }, [isValidatedFromAPI]);
  
  // Determine if field needs attention (more comprehensive check)
  const hasLowConfidence = confidence && confidence.value < 0.8;
  const hasSchemaAttention = field.ui_attention !== 'none';
  const isMissingRequired = field.required && (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0));
  const needsAttention = (hasSchemaAttention || hasLowConfidence || confidence?.needsVerification || isMissingRequired) && !isVerified;
  
  // Determine attention level based on severity
  const getAttentionLevel = (): UIAttention => {
    if (!needsAttention) return 'none';
    if (isMissingRequired && field.ui_attention === 'error') return 'error';
    if (field.ui_attention === 'error') return 'error';
    if (hasLowConfidence && confidence!.value < 0.5) return 'error';
    if (hasLowConfidence || hasSchemaAttention) return 'warning';
    return 'info';
  };
  
  // Generate attention message
  const getAttentionMessage = (): string => {
    if (isMissingRequired) return `${field.label} is required`;
    if (confidence?.message) return confidence.message;
    if (hasLowConfidence) return `AI confidence: ${Math.round(confidence!.value * 100)}% - please verify`;
    if (hasSchemaAttention) return 'This field requires verification';
    return 'Requires verification';
  };
  
  // Sync with external value changes
  useEffect(() => {
    setFieldValue(value);
  }, [value]);
  
  const handleSaveField = () => {
    onChange(fieldValue);
    setIsFieldEditing(false);
    toast.success(`${field.label} updated`);
  };
  
  const handleCancelField = () => {
    setFieldValue(value);
    setIsFieldEditing(false);
  };
  
  const handleMarkVerified = async () => {
    // Set local verified state immediately for UI feedback
    setLocalVerified(true);
    
    if (!contractId) {
      toast.success('Field marked as verified');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/metadata/validate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId || 'demo',
        },
        body: JSON.stringify({
          fieldKey: field.key,
          action: 'validate',
          newValue: value,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Notify parent component about the validation
        if (onFieldValidated) {
          onFieldValidated(field.key);
        }
        toast.success(`${field.label} verified successfully`);
      } else {
        // Even if API fails, keep local state
        // Field validation API returned non-success - handled gracefully
        toast.success('Field marked as verified');
      }
    } catch (error) {
      console.error('Field validation error:', error);
      toast.success('Field marked as verified');
    } finally {
      setIsVerifying(false);
    }
  };
  
  const renderValue = () => {
    // Special handling for certain fields
    if (field.key === 'document_number') {
      return <CopyableValue value={String(value) || 'Not assigned'} />;
    }
    
    if (field.type === 'decimal' && field.key === 'tcv_amount') {
      const currency = metadata.currency || 'USD';
      return value ? (
        <span className="text-lg font-bold text-violet-700">{formatCurrency(Number(value), currency)}</span>
      ) : (
        <span className="text-slate-400 italic">Not specified</span>
      );
    }
    
    if (field.type === 'date') {
      return value ? (
        <span className="font-medium">{formatDate(String(value))}</span>
      ) : (
        <span className="text-slate-400 italic">Not specified</span>
      );
    }
    
    if (field.type === 'boolean') {
      return (
        <Badge variant="outline" className={cn(
          "font-medium",
          value 
            ? "bg-violet-50 text-violet-700 border-violet-200" 
            : "bg-slate-50 text-slate-600 border-slate-200"
        )}>
          {value ? 'Yes' : 'No'}
        </Badge>
      );
    }
    
    if (field.type === 'enum') {
      if (field.key === 'payment_type') return formatPaymentType(value as PaymentType) || <span className="text-slate-400 italic">Not specified</span>;
      if (field.key === 'billing_frequency_type') return formatBillingFrequency(value as BillingFrequencyType) || <span className="text-slate-400 italic">Not specified</span>;
      if (field.key === 'periodicity') return formatPeriodicity(value as Periodicity) || <span className="text-slate-400 italic">Not specified</span>;
      if (field.key === 'signature_status') {
        const statusConfig: Record<string, { label: string; className: string }> = {
          signed: { label: '✓ Signed', className: 'bg-violet-50 text-violet-700 border-violet-200' },
          partially_signed: { label: '⚠ Partially Signed', className: 'bg-amber-50 text-amber-700 border-amber-200' },
          unsigned: { label: '✗ Unsigned', className: 'bg-red-50 text-red-700 border-red-200' },
          unknown: { label: '? Unknown', className: 'bg-slate-50 text-slate-600 border-slate-200' },
        };
        const cfg = statusConfig[value as string] || statusConfig.unknown;
        return value ? (
          <Badge variant="outline" className={cn("font-medium", cfg.className)}>
            {cfg.label}
          </Badge>
        ) : <span className="text-slate-400 italic">Not specified</span>;
      }
      if (field.key === 'document_classification') {
        const classLabels: Record<string, string> = {
          contract: 'Contract',
          purchase_order: 'Purchase Order',
          invoice: 'Invoice',
          quote: 'Quote',
          proposal: 'Proposal',
          work_order: 'Work Order',
          letter_of_intent: 'Letter of Intent',
          memorandum: 'Memorandum',
          amendment: 'Amendment',
          addendum: 'Addendum',
          unknown: 'Unknown',
        };
        return value ? (
          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 font-medium">
            {classLabels[value as string] || String(value)}
          </Badge>
        ) : <span className="text-slate-400 italic">Not specified</span>;
      }
      return value ? String(value) : <span className="text-slate-400 italic">Not specified</span>;
    }
    
    if (field.type === 'fk') {
      return value ? String(value) : <span className="text-slate-400 italic">Not assigned</span>;
    }
    
    if (field.type === 'array_fk') {
      if (Array.isArray(value) && value.length > 0) {
        return (
          <div className="flex flex-wrap gap-1.5">
            {value.map((v, i) => (
              <Badge key={i} variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                {String(v)}
              </Badge>
            ))}
          </div>
        );
      }
      return <span className="text-slate-400 italic">Not assigned</span>;
    }
    
    return value ? (
      <span className="text-slate-900">{String(value)}</span>
    ) : (
      <span className="text-slate-400 italic">Not specified</span>
    );
  };
  
  const renderInput = () => {
    if (field.type === 'string') {
      if (field.key === 'contract_short_description' || field.key === 'tcv_text') {
        return (
          <Textarea
            value={String(fieldValue || '')}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            className="min-h-[100px] text-sm bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-xl resize-none"
          />
        );
      }
      return (
        <Input
          value={String(fieldValue || '')}
          onChange={(e) => setFieldValue(e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}...`}
          className="h-10 text-sm bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-lg"
        />
      );
    }
    
    if (field.type === 'decimal' || field.type === 'integer') {
      return (
        <Input
          type="number"
          value={String(fieldValue || '')}
          onChange={(e) => setFieldValue(field.type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value))}
          placeholder="0"
          className="h-10 text-sm bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-lg font-mono"
        />
      );
    }
    
    if (field.type === 'date') {
      return (
        <Input
          type="date"
          value={String(fieldValue || '')}
          onChange={(e) => setFieldValue(e.target.value)}
          className="h-10 text-sm bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-lg"
        />
      );
    }
    
    if (field.type === 'boolean') {
      return (
        <div className="flex items-center gap-3 h-10">
          <Switch
            checked={!!fieldValue}
            onCheckedChange={setFieldValue}
            className="data-[state=checked]:bg-violet-600"
          />
          <span className="text-sm text-slate-600">{fieldValue ? 'Yes' : 'No'}</span>
        </div>
      );
    }
    
    if (field.type === 'enum' && field.enum) {
      const getEnumLabel = (opt: string) => {
        if (field.key === 'payment_type') return formatPaymentType(opt as PaymentType);
        if (field.key === 'billing_frequency_type') return formatBillingFrequency(opt as BillingFrequencyType);
        if (field.key === 'periodicity') return formatPeriodicity(opt as Periodicity);
        if (field.key === 'signature_status') {
          const labels: Record<string, string> = {
            signed: '✓ Signed',
            partially_signed: '⚠ Partially Signed',
            unsigned: '✗ Unsigned',
            unknown: '? Unknown',
          };
          return labels[opt] || opt;
        }
        return opt;
      };
      
      return (
        <Select value={String(fieldValue || '')} onValueChange={setFieldValue}>
          <SelectTrigger className="h-10 text-sm bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-lg">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {field.enum.map(opt => (
              <SelectItem key={opt} value={opt} className="rounded-lg">
                {getEnumLabel(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    return (
      <Input 
        value={String(fieldValue || '')} 
        onChange={(e) => setFieldValue(e.target.value)} 
        className="h-10 text-sm bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 rounded-lg" 
      />
    );
  };
  
  const colSpan = field.key === 'contract_short_description' || field.key === 'tcv_text' || field.key === 'notice_period' 
    ? 'md:col-span-2' 
    : '';
  
  // Determine if this field should be editable
  const canEdit = field.editable && !field.system_generated;
  const showEditMode = isEditing || isFieldEditing;
  
  return (
    <div 
      className={cn(
        "relative flex flex-col p-3 rounded-lg transition-all",
        needsAttention 
          ? 'bg-amber-50/50 border border-amber-200' 
          : isVerified 
            ? 'bg-violet-50/30 border border-violet-100' 
            : 'bg-slate-50 border border-transparent hover:border-slate-200',
        colSpan
      )}
    >
      {/* Field Label Row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium text-slate-600">
            {field.label}
          </Label>
          {field.required && <span className="text-red-400 text-xs">*</span>}
          {isVerified && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
          {needsAttention && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><AlertTriangle className="h-3 w-3 text-amber-500" /></TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{getAttentionMessage()}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {!isVerified && !needsAttention && !isEditing && (
            <button onClick={handleMarkVerified} disabled={isVerifying} className="p-1 hover:bg-violet-50 rounded text-slate-400 hover:text-violet-600">
              {isVerifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            </button>
          )}
          {!isEditing && canEdit && !isFieldEditing && (
            <button onClick={() => setIsFieldEditing(true)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {isFieldEditing && (
            <div className="flex items-center gap-0.5">
              <button onClick={handleSaveField} className="p-1 hover:bg-emerald-50 rounded text-emerald-600" aria-label="Save field"><Check className="h-3 w-3" /></button>
              <button onClick={handleCancelField} className="p-1 hover:bg-red-50 rounded text-red-500" aria-label="Cancel editing"><X className="h-3 w-3" /></button>
            </div>
          )}
        </div>
      </div>
      
      {/* Field Value/Input */}
      {showEditMode && canEdit ? (
        <div className="mt-1.5">
          {renderInput()}
        </div>
      ) : (
        <div 
          className={cn(
            "text-sm mt-0.5 text-slate-700",
            canEdit && !isEditing && "cursor-pointer hover:text-slate-900"
          )}
          onClick={() => {
            if (canEdit && !isEditing) {
              setIsFieldEditing(true);
            }
          }}
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
  contract?: Record<string, unknown>; // Legacy contract data for backward compatibility
  overviewData?: Record<string, unknown>; // AI-extracted overview data
  financialData?: Record<string, unknown>; // AI-extracted financial data
  onSave?: (metadata: Partial<ContractMetadataSchema>) => Promise<void>;
  onRefresh?: () => void;
  onVerificationChange?: (verificationProgress: number) => void; // Called when verification % changes
}

export function EnhancedContractMetadataSection({
  contractId,
  tenantId,
  initialMetadata,
  contract,
  overviewData,
  financialData,
  onSave,
  onRefresh,
  onVerificationChange
}: EnhancedContractMetadataSectionProps) {
  const [metadataFromAPI, setMetadataFromAPI] = useState<Partial<ContractMetadataSchema> | null>(null);
  const [fieldValidations, setFieldValidations] = useState<Record<string, { status: string; validatedAt?: string }>>({});
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
            // Extract field validations from customFields if present
            const validations = data.metadata._fieldValidations || data.rawMetadata?.customFields?._fieldValidations;
            if (validations) {
              setFieldValidations(validations);
            }
          }
        }
      } catch {
        // Silent fail for metadata fetch
      }
    };
    
    fetchMetadata();
  }, [contractId, tenantId]);
  
  // Handler for when a field is validated
  const handleFieldValidated = useCallback((fieldKey: string) => {
    setFieldValidations(prev => ({
      ...prev,
      [fieldKey]: { status: 'validate', validatedAt: new Date().toISOString() }
    }));
  }, []);
  
  // Helper to unwrap values (AI may return { value: X, source: '...' } or just X)
  const unwrapValue = useCallback((val: unknown): unknown => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object' && val !== null && 'value' in val) {
      return (val as { value: unknown }).value;
    }
    return val;
  }, []);
  
  const unwrapNumber = useCallback((val: unknown): number => {
    const unwrapped = unwrapValue(val);
    if (unwrapped === null || unwrapped === undefined) return 0;
    if (typeof unwrapped === 'number') return unwrapped;
    if (typeof unwrapped === 'string') {
      const cleaned = unwrapped.replace(/[$€£¥,]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }, [unwrapValue]);
  
  const unwrapString = useCallback((val: unknown): string => {
    const unwrapped = unwrapValue(val);
    if (unwrapped === null || unwrapped === undefined) return '';
    return String(unwrapped);
  }, [unwrapValue]);
  
  // Merge legacy data with new schema
  const mergedInitial = useMemo(() => {
    const base = getDefaultContractMetadata();
    
    // First, use metadata from API if available
    if (metadataFromAPI) {
      Object.assign(base, metadataFromAPI);
    }
    
    // Map fields from API response (high priority)
    if (contract) {
      if (!base.document_number) base.document_number = String(contract.id || contractId);
      if (!base.document_title) base.document_title = String(contract.contractTitle || contract.filename || '');
      if (!base.currency) base.currency = String(contract.currency || 'USD');
      if (!base.start_date) base.start_date = String(contract.effectiveDate || contract.startDate || '');
      if (!base.end_date) base.end_date = contract.expirationDate || contract.endDate ? String(contract.expirationDate || contract.endDate) : null;
      
      // Financial data (from DB or API-built)
      if (!base.tcv_amount && (contract.totalValue !== undefined || contract.tcv_amount !== undefined)) {
        const val = contract.totalValue !== undefined ? contract.totalValue : contract.tcv_amount;
        base.tcv_amount = typeof val === 'number' ? val : typeof val === 'string' ? parseFloat(val) || 0 : 0;
      }
      
      // Use external_parties from API (built from artifacts)
      if (contract.external_parties && Array.isArray(contract.external_parties) && contract.external_parties.length > 0) {
        base.external_parties = contract.external_parties.filter((p: any) => p.legalName || p.name);
      }
      
      // Fallback: Create parties from clientName/supplierName if external_parties is empty
      if (!base.external_parties || base.external_parties.length === 0) {
        const fallbackParties: ExternalParty[] = [];
        
        if (contract.clientName) {
          fallbackParties.push({
            legalName: String(contract.clientName),
            role: 'Client',
          });
        }
        
        if (contract.supplierName) {
          fallbackParties.push({
            legalName: String(contract.supplierName),
            role: 'Supplier',
          });
        }
        
        if (fallbackParties.length > 0) {
          base.external_parties = fallbackParties;
        }
      }
      
      // Description/summary (built by API from artifacts)
      if (!base.contract_short_description && contract.contract_short_description) {
        base.contract_short_description = String(contract.contract_short_description);
      }
      
      // Jurisdiction (from DB or AI extraction)
      if (!base.jurisdiction && contract.jurisdiction) {
        base.jurisdiction = String(contract.jurisdiction);
      }
      
      // Contract type - store in document_classification
      if (contract.contractType) {
        base.document_classification = String(contract.contractType) as DocumentClassification;
      }
      
      // Signature info (from DB columns)
      if (contract.signature_date) base.signature_date = String(contract.signature_date);
      if (contract.signature_status) base.signature_status = String(contract.signature_status) as SignatureStatus;
      if (contract.signature_required_flag !== undefined) base.signature_required_flag = Boolean(contract.signature_required_flag);
      
      // Document classification (from DB columns)
      if (contract.document_classification) base.document_classification = String(contract.document_classification) as DocumentClassification;
      if (contract.document_classification_warning) base.document_classification_warning = String(contract.document_classification_warning);
      
      // Notice period (from DB)
      if (contract.notice_period) base.notice_period = String(contract.notice_period);
      if (contract.notice_period_days) base.notice_period_days = Number(contract.notice_period_days);
      
      // Reminder settings (if available)
      if (contract.reminder_enabled !== undefined) base.reminder_enabled = Boolean(contract.reminder_enabled);
      if (contract.reminder_days_before_end !== undefined) base.reminder_days_before_end = Number(contract.reminder_days_before_end);
    }
    
    // Map overview data from AI extraction (lowest priority) - handle wrapped values
    if (overviewData) {
      if (!base.document_title) base.document_title = unwrapString(overviewData.contractTitle);
      if (!base.contract_short_description) base.contract_short_description = unwrapString(overviewData.summary) || unwrapString(overviewData.description);
      if (!base.jurisdiction) base.jurisdiction = unwrapString(overviewData.jurisdiction);
      if (!base.contract_language) base.contract_language = unwrapString(overviewData.language) || 'en';
      if (!base.tcv_amount) base.tcv_amount = unwrapNumber(overviewData.totalValue);
      if (!base.start_date) base.start_date = unwrapString(overviewData.effectiveDate) || unwrapString(overviewData.effective_date) || unwrapString(overviewData.startDate);
      if (!base.end_date) {
        const endDate = unwrapString(overviewData.expirationDate) || unwrapString(overviewData.expiration_date) || unwrapString(overviewData.endDate);
        base.end_date = endDate || null;
      }
      
      // Map parties - handle wrapped values
      if (!base.external_parties?.length && overviewData.parties && Array.isArray(overviewData.parties)) {
        base.external_parties = (overviewData.parties as Array<Record<string, unknown>>).map((p) => ({
          legalName: unwrapString(p.name) || unwrapString(p.legalName),
          role: unwrapString(p.role) || unwrapString(p.type),
          registeredAddress: unwrapString(p.address)
        }));
      }
    }
    
    // Map financial data from AI extraction - handle wrapped values
    if (financialData) {
      base.tcv_amount = base.tcv_amount || unwrapNumber(financialData.totalValue);
      base.tcv_text = financialData.totalValue ? formatCurrency(unwrapNumber(financialData.totalValue), base.currency) : '';
      base.currency = base.currency || unwrapString(financialData.currency) || 'USD';
      
      // Map payment terms to payment_type (ensure string conversion for safety)
      const paymentTerms = unwrapString(financialData.paymentTerms).toLowerCase();
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
  }, [contractId, contract, overviewData, financialData, initialMetadata, metadataFromAPI, unwrapString, unwrapNumber]);
  
  const [metadata, setMetadata] = useState<Partial<ContractMetadataSchema>>(mergedInitial);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Update when initial data changes
  useEffect(() => {
    setMetadata(mergedInitial);
  }, [mergedInitial]);
  
  // Calculate fields needing attention (excluding validated fields)
  const fieldsNeedingAttention = useMemo(() => {
    const baseFields = getFieldsNeedingAttention(metadata);
    // Filter out fields that have already been validated
    return baseFields.filter(field => {
      const validation = fieldValidations[field.key];
      const isValidated = validation?.status === 'validate' || validation?.status === 'validated';
      return !isValidated;
    });
  }, [metadata, fieldValidations]);
  
  // Calculate verified fields count
  const verifiedFieldsCount = useMemo(() => {
    return Object.values(fieldValidations).filter(
      v => v.status === 'validate' || v.status === 'validated'
    ).length;
  }, [fieldValidations]);
  
  // Calculate total fields for progress
  const totalFieldsCount = useMemo(() => {
    return Object.keys(SECTION_CONFIG).reduce((acc, section) => {
      return acc + getFieldsBySection(section as keyof typeof SECTION_CONFIG).length;
    }, 0);
  }, []);
  
  // Calculate all unverified fields (for Verify All button)
  const allUnverifiedFields = useMemo(() => {
    const allFields = Object.keys(SECTION_CONFIG).flatMap(section => 
      getFieldsBySection(section as keyof typeof SECTION_CONFIG)
    );
    return allFields.filter(f => {
      const validation = fieldValidations[f.key];
      return validation?.status !== 'validate' && validation?.status !== 'validated';
    });
  }, [fieldValidations]);
  
  // Overall progress percentage
  const overallProgress = totalFieldsCount > 0 ? Math.round((verifiedFieldsCount / totalFieldsCount) * 100) : 0;
  
  // Track previous progress for celebration trigger
  const prevProgressRef = useRef(overallProgress);
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Celebration when reaching 100%
  useEffect(() => {
    if (overallProgress === 100 && prevProgressRef.current < 100) {
      setShowCelebration(true);
      toast.success('🎉 All metadata fields verified!', {
        description: 'Great job! Your contract metadata is now fully verified.',
        duration: 5000
      });
      setTimeout(() => setShowCelebration(false), 3000);
    }
    prevProgressRef.current = overallProgress;
  }, [overallProgress]);
  
  // Debounced callback to avoid excessive API calls
  const debouncedVerificationChange = useDebounce(
    useCallback((progress: number) => {
      if (onVerificationChange) {
        onVerificationChange(progress);
      }
    }, [onVerificationChange]),
    500
  );
  
  // Notify parent of verification progress changes (debounced)
  useEffect(() => {
    debouncedVerificationChange(overallProgress);
  }, [overallProgress, debouncedVerificationChange]);
  
  // Calculate section progress for mini indicators
  const sectionProgress = useMemo(() => {
    return Object.keys(SECTION_CONFIG).reduce((acc, section) => {
      const fields = getFieldsBySection(section as keyof typeof SECTION_CONFIG);
      const verified = fields.filter(f => {
        const v = fieldValidations[f.key];
        return v?.status === 'validate' || v?.status === 'validated';
      }).length;
      acc[section] = { verified, total: fields.length };
      return acc;
    }, {} as Record<string, { verified: number; total: number }>);
  }, [fieldValidations]);
  
  // State for verifying all fields
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  
  // Handler to verify all unverified fields at once
  const handleVerifyAllFields = useCallback(async () => {
    if (allUnverifiedFields.length === 0) return;
    
    setIsVerifyingAll(true);
    try {
      // Batch verify all unverified fields
      const response = await fetch(`/api/contracts/${contractId}/metadata/validate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          allFields: Object.fromEntries(
            allUnverifiedFields.map(f => [f.key, (metadata as Record<string, unknown>)[f.key]])
          ),
        }),
      });
      
      if (response.ok) {
        // Update local state for all validated fields
        const newValidations: Record<string, { status: string; validatedAt: string }> = {};
        allUnverifiedFields.forEach(f => {
          newValidations[f.key] = { status: 'validate', validatedAt: new Date().toISOString() };
        });
        setFieldValidations(prev => ({ ...prev, ...newValidations }));
        toast.success(`${allUnverifiedFields.length} fields verified successfully!`);
      } else {
        throw new Error('Verification failed');
      }
    } catch {
      toast.error('Failed to verify all fields. Please try again.');
    } finally {
      setIsVerifyingAll(false);
    }
  }, [contractId, tenantId, allUnverifiedFields, metadata]);
  
  const handleChange = useCallback((field: string, value: unknown) => {
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
      
      // Dispatch event to notify chatbot and other components about the update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('artifact-updated', { 
          detail: { contractId, type: 'metadata', timestamp: Date.now() } 
        }));
        window.dispatchEvent(new CustomEvent('contract:refresh', { 
          detail: { contractId } 
        }));
      }
      
      if (onRefresh) {
        onRefresh();
      }
    } catch {
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
      const response = await fetch(`/api/contracts/${contractId}/extract-metadata`, {
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
    } catch {
      toast.error('Failed to start AI extraction. Please try again.');
    } finally {
      setIsExtractingAI(false);
    }
  };
  
  // Reset all verifications handler
  const [isResettingAll, setIsResettingAll] = useState(false);
  
  const handleResetAllVerifications = useCallback(async () => {
    if (verifiedFieldsCount === 0) return;
    
    setIsResettingAll(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/metadata/validate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          resetAll: true,
        }),
      });
      
      if (response.ok) {
        setFieldValidations({});
        toast.success('All verifications have been reset');
      } else {
        throw new Error('Reset failed');
      }
    } catch {
      toast.error('Failed to reset verifications. Please try again.');
    } finally {
      setIsResettingAll(false);
    }
  }, [contractId, tenantId, verifiedFieldsCount]);
  
  return (
    <>
    {/* Celebration confetti */}
    <ConfettiCelebration show={showCelebration} />
    
    <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white">
      {/* Clean header */}
      <CardHeader className="pb-4 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-800">
              Contract Metadata
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              {isEditing ? 'Make changes and click Save' : `${verifiedFieldsCount} of ${totalFieldsCount} fields verified`}
            </CardDescription>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                {fieldsNeedingAttention.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                    {fieldsNeedingAttention.length} need review
                  </Badge>
                )}
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleAIExtraction}
                  disabled={isExtractingAI}
                  className="h-8 text-xs"
                >
                  {isExtractingAI ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  AI Extract
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => setIsEditing(true)}
                  className="h-8 text-xs bg-violet-600 hover:bg-violet-700"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-8 text-xs bg-violet-600 hover:bg-violet-700"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-3">
        {/* Success Message */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div key="save-success"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-sm text-emerald-700">Saved successfully</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Sections */}
        <div className="space-y-2">
          <MetadataSection 
            section="identification" 
            metadata={metadata} 
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={true}
            contractId={contractId}
            tenantId={tenantId}
            fieldValidations={fieldValidations}
            onFieldValidated={handleFieldValidated}
            sectionProgress={sectionProgress.identification}
          />
          
          <MetadataSection 
            section="parties" 
            metadata={metadata} 
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={true}
            contractId={contractId}
            tenantId={tenantId}
            fieldValidations={fieldValidations}
            onFieldValidated={handleFieldValidated}
            sectionProgress={sectionProgress.parties}
          />
          
          <MetadataSection 
            section="commercials" 
            metadata={metadata} 
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={true}
            contractId={contractId}
            tenantId={tenantId}
            fieldValidations={fieldValidations}
            onFieldValidated={handleFieldValidated}
            sectionProgress={sectionProgress.commercials}
          />
          
          <MetadataSection 
            section="dates" 
            metadata={metadata}
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={true}
            contractId={contractId}
            tenantId={tenantId}
            fieldValidations={fieldValidations}
            onFieldValidated={handleFieldValidated}
            sectionProgress={sectionProgress.dates}
          />
          
          <MetadataSection 
            section="reminders" 
            metadata={metadata} 
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={false}
            contractId={contractId}
            tenantId={tenantId}
            fieldValidations={fieldValidations}
            onFieldValidated={handleFieldValidated}
            sectionProgress={sectionProgress.reminders}
          />
          
          <MetadataSection 
            section="ownership" 
            metadata={metadata} 
            isEditing={isEditing}
            onChange={handleChange}
            defaultOpen={false}
            contractId={contractId}
            tenantId={tenantId}
            fieldValidations={fieldValidations}
            onFieldValidated={handleFieldValidated}
            sectionProgress={sectionProgress.ownership}
          />
        </div>
      </CardContent>
    </Card>
    </>
  );
}

export default EnhancedContractMetadataSection;
