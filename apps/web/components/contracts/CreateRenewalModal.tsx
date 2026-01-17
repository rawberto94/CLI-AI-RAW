/**
 * Create Renewal Modal
 * Modal for creating a renewal contract from an existing contract
 */

'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, addMonths, addYears, differenceInDays } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  Calendar as CalendarIcon,
  DollarSign,
  FileText,
  Users,
  Copy,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';

interface OriginalContract {
  id: string;
  title: string;
  fileName?: string;
  effectiveDate?: Date | string | null;
  expirationDate?: Date | string | null;
  totalValue?: number | null;
  currency?: string | null;
  clientName?: string | null;
  supplierName?: string | null;
  contractType?: string | null;
  status?: string | null;
}

interface RenewalResult {
  id: string;
  title: string;
  effectiveDate: string;
  expirationDate: string;
  totalValue: number | null;
}

interface CreateRenewalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: OriginalContract;
  onRenewalCreated: (renewal: RenewalResult) => void;
}

const DURATION_PRESETS = [
  { label: '6 Months', value: 6, unit: 'months' as const },
  { label: '1 Year', value: 1, unit: 'years' as const },
  { label: '2 Years', value: 2, unit: 'years' as const },
  { label: '3 Years', value: 3, unit: 'years' as const },
  { label: '5 Years', value: 5, unit: 'years' as const },
  { label: 'Custom', value: 0, unit: 'custom' as const },
];

export function CreateRenewalModal({
  open,
  onOpenChange,
  contract,
  onRenewalCreated,
}: CreateRenewalModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<Date | undefined>(
    contract.expirationDate 
      ? new Date(contract.expirationDate) 
      : new Date()
  );
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(
    contract.expirationDate && contract.effectiveDate
      ? addDays(
          new Date(contract.expirationDate),
          differenceInDays(
            new Date(contract.expirationDate),
            new Date(contract.effectiveDate)
          )
        )
      : addYears(new Date(), 1)
  );
  const [totalValue, setTotalValue] = useState<string>(
    contract.totalValue?.toString() || ''
  );
  const [renewalNote, setRenewalNote] = useState('');
  
  // Copy options
  const [copyParties, setCopyParties] = useState(true);
  const [copyTerms, setCopyTerms] = useState(true);
  const [copyMetadata, setCopyMetadata] = useState(true);
  
  // UI state
  const [selectedPreset, setSelectedPreset] = useState<string>('1-years');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'configure' | 'review' | 'success'>('configure');
  const [createdRenewal, setCreatedRenewal] = useState<RenewalResult | null>(null);

  // Calculate original duration
  const originalDuration = contract.effectiveDate && contract.expirationDate
    ? differenceInDays(
        new Date(contract.expirationDate),
        new Date(contract.effectiveDate)
      )
    : 365;

  // Handle duration preset change
  const handlePresetChange = useCallback((preset: string) => {
    setSelectedPreset(preset);
    if (!effectiveDate) return;
    
    const [value, unit] = preset.split('-');
    const numValue = parseInt(value);
    
    if (unit === 'months') {
      setExpirationDate(addMonths(effectiveDate, numValue));
    } else if (unit === 'years') {
      setExpirationDate(addYears(effectiveDate, numValue));
    }
    // 'custom' doesn't auto-set expiration
  }, [effectiveDate]);

  // Handle effective date change
  const handleEffectiveDateChange = useCallback((date: Date | undefined) => {
    setEffectiveDate(date);
    if (date && selectedPreset !== '0-custom') {
      const [value, unit] = selectedPreset.split('-');
      const numValue = parseInt(value);
      
      if (unit === 'months') {
        setExpirationDate(addMonths(date, numValue));
      } else if (unit === 'years') {
        setExpirationDate(addYears(date, numValue));
      }
    }
  }, [selectedPreset]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!effectiveDate || !expirationDate) {
      toast.error('Please select both effective and expiration dates');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/contracts/${contract.id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify({
          title: title || undefined,
          effectiveDate: effectiveDate.toISOString(),
          expirationDate: expirationDate.toISOString(),
          totalValue: totalValue ? parseFloat(totalValue) : undefined,
          renewalNote: renewalNote || undefined,
          copyParties,
          copyTerms,
          copyMetadata,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create renewal');
      }

      const result = await response.json();
      setCreatedRenewal(result.renewal);
      setStep('success');
      toast.success('Renewal contract created successfully!');
      onRenewalCreated(result.renewal);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create renewal');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when modal closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep('configure');
      setCreatedRenewal(null);
    }
    onOpenChange(open);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: contract.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Create Contract Renewal
          </DialogTitle>
          <DialogDescription>
            Create a new contract that renews and links to the original
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'configure' && (
            <motion.div
              key="configure"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 py-4"
            >
              {/* Original Contract Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg">
                    <FileText className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {contract.title || contract.fileName}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                      <span>
                        {contract.effectiveDate 
                          ? format(new Date(contract.effectiveDate), 'MMM d, yyyy')
                          : 'N/A'} 
                        {' → '}
                        {contract.expirationDate
                          ? format(new Date(contract.expirationDate), 'MMM d, yyyy')
                          : 'N/A'}
                      </span>
                      {contract.totalValue && (
                        <>
                          <span>•</span>
                          <span>{formatCurrency(contract.totalValue)}</span>
                        </>
                      )}
                    </div>
                    {(contract.clientName || contract.supplierName) && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {[contract.clientName, contract.supplierName].filter(Boolean).join(' & ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    Original
                  </Badge>
                </div>
              </div>

              {/* Arrow indicator */}
              <div className="flex justify-center">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                </div>
              </div>

              {/* Renewal Configuration */}
              <div className="space-y-4">
                {/* Title (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="renewal-title">Renewal Title (Optional)</Label>
                  <Input
                    id="renewal-title"
                    placeholder={`${contract.title || 'Contract'} - Renewal`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Leave blank to auto-generate
                  </p>
                </div>

                {/* Duration Preset */}
                <div className="space-y-2">
                  <Label>Renewal Duration</Label>
                  <Select value={selectedPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_PRESETS.map((preset) => (
                        <SelectItem 
                          key={`${preset.value}-${preset.unit}`} 
                          value={`${preset.value}-${preset.unit}`}
                        >
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Effective Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !effectiveDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {effectiveDate ? format(effectiveDate, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={effectiveDate}
                          onSelect={handleEffectiveDateChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Expiration Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !expirationDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {expirationDate ? format(expirationDate, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={expirationDate}
                          onSelect={(date) => setExpirationDate(date as Date | undefined)}
                          initialFocus
                          disabled={(date) => effectiveDate ? date < effectiveDate : false}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Contract Value */}
                <div className="space-y-2">
                  <Label htmlFor="total-value">Contract Value</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="total-value"
                      type="number"
                      placeholder={contract.totalValue?.toString() || '0'}
                      value={totalValue}
                      onChange={(e) => setTotalValue(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Copy Options */}
                <div className="space-y-3">
                  <Label>Copy from Original</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        <span className="text-sm">Parties (Client & Supplier)</span>
                      </div>
                      <Switch checked={copyParties} onCheckedChange={setCopyParties} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="text-sm">Terms & Category</span>
                      </div>
                      <Switch checked={copyTerms} onCheckedChange={setCopyTerms} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Copy className="h-4 w-4 text-slate-400" />
                        <span className="text-sm">Metadata & Tags</span>
                      </div>
                      <Switch checked={copyMetadata} onCheckedChange={setCopyMetadata} />
                    </div>
                  </div>
                </div>

                {/* Renewal Note */}
                <div className="space-y-2">
                  <Label htmlFor="renewal-note">Renewal Note (Optional)</Label>
                  <Textarea
                    id="renewal-note"
                    placeholder="Add any notes about this renewal..."
                    value={renewalNote}
                    onChange={(e) => setRenewalNote(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 'success' && createdRenewal && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-8"
            >
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Renewal Created Successfully
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    The new contract has been linked to the original
                  </p>
                </div>
                
                {/* Renewal Summary */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-600">Linked Contracts</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Original</Badge>
                      <span className="text-sm truncate">{contract.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700 text-xs">Renewal</Badge>
                      <span className="text-sm truncate">{createdRenewal.title}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" onClick={() => handleOpenChange(false)}>
                    Close
                  </Button>
                  <Button onClick={() => window.location.href = `/contracts/${createdRenewal.id}`}>
                    View Renewal
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {step === 'configure' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !effectiveDate || !expirationDate}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Create Renewal
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default CreateRenewalModal;
