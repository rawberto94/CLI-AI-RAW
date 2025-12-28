/**
 * Contract Lifecycle Selector
 * Appears during upload to classify contract purpose
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  FilePlus, 
  FileEdit, 
  RefreshCw,
  Info,
  CheckCircle,
  Clock,
  Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ContractLifecycleType = 'NEW' | 'EXISTING' | 'AMENDMENT' | 'RENEWAL';

interface ContractLifecycleSelectorProps {
  value: ContractLifecycleType;
  onChange: (value: ContractLifecycleType) => void;
  showDetails?: boolean;
}

const lifecycleOptions = [
  {
    value: 'NEW' as const,
    label: 'New Contract',
    description: 'Contract being created/negotiated - requires approval workflow',
    icon: FilePlus,
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    iconColor: 'text-blue-600',
    badge: 'Approval Required',
    badgeVariant: 'default' as const,
    workflow: true,
  },
  {
    value: 'AMENDMENT' as const,
    label: 'Amendment',
    description: 'Changes to existing contract - requires approval',
    icon: FileEdit,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    iconColor: 'text-purple-600',
    badge: 'Approval Required',
    badgeVariant: 'default' as const,
    workflow: true,
  },
  {
    value: 'RENEWAL' as const,
    label: 'Renewal',
    description: 'Contract renewal - may require approval if terms change',
    icon: RefreshCw,
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    iconColor: 'text-amber-600',
    badge: 'Conditional Approval',
    badgeVariant: 'secondary' as const,
    workflow: false,
  },
  {
    value: 'EXISTING' as const,
    label: 'Existing Contract',
    description: 'Already signed contract for reference/storage - no approval needed',
    icon: Archive,
    color: 'slate',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    textColor: 'text-slate-700',
    iconColor: 'text-slate-600',
    badge: 'No Approval',
    badgeVariant: 'outline' as const,
    workflow: false,
  },
];

export function ContractLifecycleSelector({ 
  value, 
  onChange,
  showDetails = true 
}: ContractLifecycleSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-slate-500" />
        <p className="text-sm text-slate-600">
          Help us understand this contract's purpose
        </p>
      </div>

      <RadioGroup value={value} onValueChange={(v) => onChange(v as ContractLifecycleType)}>
        <div className="grid gap-3">
          {lifecycleOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = value === option.value;
            
            return (
              <Label
                key={option.value}
                htmlFor={option.value}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md",
                  isSelected 
                    ? `${option.borderColor} ${option.bgColor} shadow-sm` 
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <RadioGroupItem
                  value={option.value}
                  id={option.value}
                  className="mt-1"
                />
                
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  isSelected ? option.bgColor : "bg-slate-100"
                )}>
                  <Icon className={cn(
                    "h-5 w-5",
                    isSelected ? option.iconColor : "text-slate-500"
                  )} />
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-semibold",
                      isSelected ? option.textColor : "text-slate-900"
                    )}>
                      {option.label}
                    </span>
                    <Badge variant={option.badgeVariant} className="text-xs">
                      {option.badge}
                    </Badge>
                  </div>
                  
                  {showDetails && (
                    <p className="text-sm text-slate-600">
                      {option.description}
                    </p>
                  )}
                  
                  {isSelected && option.workflow && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-600">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Approval workflow will be triggered after upload</span>
                    </div>
                  )}
                </div>
                
                {isSelected && (
                  <CheckCircle className={cn("h-5 w-5", option.iconColor)} />
                )}
              </Label>
            );
          })}
        </div>
      </RadioGroup>
    </div>
  );
}

/**
 * Compact version for inline use
 */
export function CompactLifecycleSelector({ 
  value, 
  onChange 
}: Omit<ContractLifecycleSelectorProps, 'showDetails'>) {
  return (
    <div className="flex gap-2">
      {lifecycleOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
              isSelected
                ? `${option.borderColor} ${option.bgColor}`
                : "border-slate-200 hover:border-slate-300 bg-white"
            )}
          >
            <Icon className={cn(
              "h-5 w-5",
              isSelected ? option.iconColor : "text-slate-500"
            )} />
            <span className={cn(
              "text-xs font-medium",
              isSelected ? option.textColor : "text-slate-600"
            )}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
