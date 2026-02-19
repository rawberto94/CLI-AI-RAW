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
  Undo2
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
  UIAttention
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

// ============ PARTY CARD ============

function PartyCard({ 
  party, 
  index,
  isEditing, 
  onChange, 
  onRemove 
}: { 
  party: ExternalParty; 
  index: number;
  isEditing: boolean;
  onChange: (updated: ExternalParty) => void;
  onRemove: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "relative p-5 rounded-2xl border-2 transition-all group",
        isEditing 
          ? "bg-white border-indigo-300 shadow-xl shadow-violet-100/50 ring-2 ring-indigo-100" 
          : "bg-gradient-to-br from-white via-white to-violet-50/30 border-slate-200 hover:border-violet-300 hover:shadow-lg"
      )}
    >
      {/* Role Badge */}
      {party.role && !isEditing && (
        <Badge className="absolute -top-2.5 right-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0 shadow-lg shadow-violet-200/50 px-3 py-0.5">
          {party.role}
        </Badge>
      )}
      
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={cn(
            "p-3 rounded-xl shrink-0 transition-colors",
            isEditing ? "bg-gradient-to-br from-violet-100 to-purple-100" : "bg-gradient-to-br from-violet-100 to-purple-100"
          )}>
            <Building2 className={cn(
              "h-6 w-6",
              isEditing ? "text-violet-600" : "text-violet-600"
            )} />
          </div>
          
          <div className="flex-1 min-w-0 pt-1">
            {isEditing ? (
              <Input 
                value={party.legalName}
                onChange={(e) => onChange({ ...party, legalName: e.target.value })}
                placeholder="Legal entity name"
                className="h-10 text-base font-semibold border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 bg-slate-50/50"
              />
            ) : (
              <h4 className="font-bold text-slate-900 text-lg truncate">{party.legalName || 'Unnamed Party'}</h4>
            )}
            
            {!isEditing && (party.legalForm || party.registeredSeat) && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {party.legalForm && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                    <Hash className="h-3 w-3" />
                    {party.legalForm}
                  </span>
                )}
                {party.registeredSeat && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                    <MapPin className="h-3 w-3" />
                    {party.registeredSeat}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {isEditing && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRemove}
            className="h-9 w-9 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl shrink-0 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <AnimatePresence>
        {isEditing && (
          <motion.div key="editing" 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200/60"
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Legal Form</Label>
              <Input 
                value={party.legalForm || ''}
                onChange={(e) => onChange({ ...party, legalForm: e.target.value })}
                placeholder="e.g., LLC, Inc., GmbH"
                className="h-9 text-sm bg-slate-50/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Role</Label>
              <Input 
                value={party.role || ''}
                onChange={(e) => onChange({ ...party, role: e.target.value })}
                placeholder="e.g., Supplier, Client"
                className="h-9 text-sm bg-slate-50/50"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-slate-500">Registered Seat</Label>
              <Input 
                value={party.registeredSeat || ''}
                onChange={(e) => onChange({ ...party, registeredSeat: e.target.value })}
                placeholder="City, Country"
                className="h-9 text-sm bg-slate-50/50"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============ EMPTY STATE ============

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 mb-4">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>
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
        <motion.div 
          className={cn(
            "flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer",
            isOpen 
              ? `bg-gradient-to-r ${config.bgGradient} border-2 ${config.borderColor} shadow-sm`
              : "bg-slate-50/80 hover:bg-slate-100 border-2 border-transparent"
          )}
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
        >
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-2.5 rounded-xl transition-all",
                config.iconBg
              )}>
                <Icon className={cn("h-5 w-5", config.iconColor)} />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{config.label}</span>
                  {attentionFields.length > 0 ? (
                    <Badge variant="outline" className="bg-amber-50/80 text-amber-700 border-amber-200 text-xs px-2 py-0 font-medium">
                      {attentionFields.length} needs review
                    </Badge>
                  ) : verifiedFields.length > 0 && verifiedCount === totalFields ? (
                    <Badge variant="outline" className="bg-violet-50/80 text-violet-700 border-violet-200 text-xs px-2 py-0 font-medium">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">{config.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Progress indicator */}
              {totalFields > 0 && !isOpen && (
                <div className="hidden sm:flex items-center gap-2">
                  <ProgressRing progress={progressPercent} size={32} strokeWidth={3} showLabel={false} />
                  <span className="text-xs text-slate-500 font-medium">{verifiedCount}/{totalFields}</span>
                </div>
              )}
            
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "p-1.5 rounded-lg",
                isOpen ? config.iconBg : "bg-slate-200/50"
              )}
            >
              <ChevronDown className={cn(
                "h-4 w-4",
                isOpen ? config.iconColor : "text-slate-400"
              )} />
            </motion.div>
          </div>
        </motion.div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mt-3 px-2"
        >
          {/* Section progress bar with Verify All button */}
          {totalFields > 0 && (
            <div className="mb-4 p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Verification Progress</span>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-xs font-bold",
                    progressPercent >= 80 ? "text-violet-600" : progressPercent >= 50 ? "text-amber-600" : "text-slate-500"
                  )}>
                    {verifiedCount} of {totalFields} fields verified
                  </span>
                  {unverifiedFields.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleVerifyAll}
                      disabled={isVerifyingAll}
                      className="h-7 px-2 text-xs border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300"
                    >
                      {isVerifyingAll ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verify All ({unverifiedFields.length})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    progressPercent >= 80 ? "bg-gradient-to-r from-violet-500 to-purple-400" :
                    progressPercent >= 50 ? "bg-gradient-to-r from-amber-500 to-yellow-400" :
                    "bg-gradient-to-r from-slate-400 to-slate-300"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section === 'parties' ? (
              <div className="col-span-2 space-y-4">
                <AnimatePresence>
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
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const parties = [...(metadata.external_parties || [])];
                        parties.push({ legalName: '' });
                        onChange('external_parties', parties);
                      }}
                      className="w-full h-12 border-dashed border-2 border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300 rounded-xl font-medium transition-all"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add Party
                    </Button>
                  </motion.div>
                )}
                
                {!isEditing && (metadata.external_parties || []).length === 0 && (
                  <EmptyState
                    icon={Users}
                    title="No parties defined"
                    description="Add contracting parties to track stakeholders involved in this contract."
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
        </motion.div>
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
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "relative flex flex-col p-4 rounded-xl transition-all group",
        needsAttention 
          ? 'bg-gradient-to-br from-amber-50/80 to-orange-50/40 border-2 border-amber-200/60 shadow-sm' 
          : isVerified 
            ? 'bg-gradient-to-br from-violet-50/60 to-purple-50/40 border-2 border-violet-200/60 shadow-sm' 
            : 'bg-slate-50/80 border-2 border-transparent hover:border-slate-200 hover:bg-white hover:shadow-md',
        colSpan
      )}
    >
      {/* Field Label Row */}
      <div className="flex items-center gap-2 mb-2">
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {field.label}
        </Label>
        {field.required && (
          <span className="text-red-400 text-xs font-bold">*</span>
        )}
        {field.system_generated && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-500 border-slate-200">
            <Settings2 className="h-2.5 w-2.5 mr-0.5" />
            System
          </Badge>
        )}
        
        <div className="flex-1" />
        
        {confidence && <ConfidenceIndicator confidence={confidence.value} source={confidence.source} />}
        {isVerified ? (
          <VerifiedBadge validatedAt={savedValidation?.validatedAt} />
        ) : needsAttention ? (
          <AttentionBadge 
            attention={getAttentionLevel()} 
            message={getAttentionMessage()} 
            onMarkVerified={handleMarkVerified}
            isVerifying={isVerifying}
          />
        ) : (
          /* Show verify button on hover for fields that don't need attention but aren't verified yet */
          <TooltipProvider>
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <motion.button
                  onClick={handleMarkVerified}
                  disabled={isVerifying}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-violet-50 rounded-lg transition-all border border-transparent hover:border-violet-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isVerifying ? (
                    <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 hover:text-violet-600" />
                  )}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-900 text-white text-xs px-2 py-1 rounded">
                Mark as verified
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {/* Inline edit button - only show if not in global edit mode */}
        {!isEditing && canEdit && !isFieldEditing && (
          <motion.button
            onClick={() => setIsFieldEditing(true)}
            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200 hover:shadow-sm"
            title="Edit this field"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Pencil className="h-3.5 w-3.5 text-slate-400 hover:text-violet-600" />
          </motion.button>
        )}
        
        {/* Inline save/cancel buttons */}
        <AnimatePresence>
          {isFieldEditing && (
            <motion.div key="field-editing" 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1"
            >
              <button
                onClick={handleSaveField}
                className="p-1.5 bg-violet-100 hover:bg-violet-200 rounded-lg transition-colors"
                title="Save"
              >
                <Check className="h-3.5 w-3.5 text-violet-600" />
              </button>
              <button
                onClick={handleCancelField}
                className="p-1.5 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5 text-red-500" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Field Value/Input */}
      <AnimatePresence mode="wait">
        {showEditMode && canEdit ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
          >
            {renderInput()}
          </motion.div>
        ) : (
          <motion.div 
            key="value"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={cn(
              "text-sm mt-0.5",
              canEdit && !isEditing && "cursor-pointer hover:bg-white p-2 rounded-lg -m-2 transition-all"
            )}
            onClick={() => {
              if (canEdit && !isEditing) {
                setIsFieldEditing(true);
              }
            }}
            title={canEdit && !isEditing ? "Click to edit" : undefined}
          >
            {renderValue()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
    
    // Map legacy fields
    if (contract) {
      if (!base.document_number) base.document_number = String(contract.id || contractId);
      if (!base.document_title) base.document_title = String(contract.contractTitle || contract.filename || '');
      if (!base.currency) base.currency = String(contract.currency || 'USD');
      if (!base.start_date) base.start_date = String(contract.effectiveDate || contract.startDate || '');
      if (!base.end_date) base.end_date = contract.expirationDate || contract.endDate ? String(contract.expirationDate || contract.endDate) : null;
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
    
    <Card className="overflow-hidden border-0 shadow-xl bg-white/80 backdrop-blur-sm">
      {/* Header with gradient */}
      <CardHeader className="pb-6 bg-gradient-to-r from-slate-50 via-purple-50/50 to-purple-50/30 border-b border-slate-200/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* 100% completion badge */}
          <AnimatePresence>
            {overallProgress === 100 && (
              <motion.div key="overall-progress"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-4 right-4 z-10"
              >
                <Badge className="bg-gradient-to-r from-violet-500 to-violet-500 text-white border-0 px-3 py-1.5 shadow-lg">
                  <PartyPopper className="h-4 w-4 mr-1.5" />
                  Fully Verified!
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-200/50">
              <FileCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-800">
                Contract Metadata
              </CardTitle>
              <CardDescription className="mt-1 text-slate-500">
                {isEditing ? 'Editing metadata - changes will be saved' : 'Core contract information and verification status'}
              </CardDescription>
            </div>
          </div>
          
          {/* Stats Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Progress Ring */}
            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
              <ProgressRing progress={overallProgress} size={40} strokeWidth={3} />
              <div className="text-sm">
                <p className="font-semibold text-slate-700">{verifiedFieldsCount}/{totalFieldsCount}</p>
                <p className="text-xs text-slate-500">Verified</p>
              </div>
            </div>
            
            {fieldsNeedingAttention.length > 0 && !isEditing && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1.5 text-sm font-medium shadow-sm">
                <AlertTriangle className="h-4 w-4 mr-1.5" />
                {fieldsNeedingAttention.length} needs review
              </Badge>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {!isEditing ? (
            <>
              {allUnverifiedFields.length > 0 && (
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleVerifyAllFields}
                  disabled={isVerifyingAll}
                  className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300 rounded-xl px-4 h-10 font-medium shadow-sm"
                >
                  {isVerifyingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Verify All ({allUnverifiedFields.length})
                    </>
                  )}
                </Button>
              )}
              <Button 
                size="sm"
                variant="outline"
                onClick={handleAIExtraction}
                disabled={isExtractingAI}
                className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300 rounded-xl px-4 h-10 font-medium shadow-sm"
              >
                {isExtractingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Extract
                  </>
                )}
              </Button>
              {verifiedFieldsCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm"
                        variant="ghost"
                        onClick={handleResetAllVerifications}
                        disabled={isResettingAll}
                        className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl h-10 font-medium"
                      >
                        {isResettingAll ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Undo2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset all verifications</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl px-4 h-10 font-medium shadow-lg shadow-violet-200/50"
              >
                <Pencil className="h-4 w-4 mr-2" />
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
                className="rounded-xl px-4 h-10 font-medium"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl px-4 h-10 font-medium shadow-lg shadow-violet-200/50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-4">
        {/* Success Message */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div key="save-success"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-violet-200 rounded-xl flex items-center gap-3 shadow-lg shadow-violet-100/50"
            >
              <div className="p-2 rounded-lg bg-violet-100">
                <CheckCircle2 className="h-5 w-5 text-violet-600" />
              </div>
              <p className="text-sm font-semibold text-violet-700">Metadata saved successfully</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Sections */}
        <div className="space-y-4">
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
