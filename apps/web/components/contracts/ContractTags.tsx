/**
 * Contract Tags Display Component
 * 
 * Shows pricing models, delivery models, data profiles, and risk flags
 */

import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  Truck, 
  Database, 
  AlertTriangle,
  Calendar,
  Clock,
  TrendingUp,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContractTagsProps {
  pricingModels?: string[];
  deliveryModels?: string[];
  dataProfiles?: string[];
  riskFlags?: string[];
  className?: string;
  compact?: boolean;
}

const TAG_LABELS = {
  // Pricing Models
  fixed_price: 'Fixed Price',
  time_materials: 'T&M',
  unit_pricing: 'Unit Pricing',
  retainer: 'Retainer',
  milestone: 'Milestone',
  subscription: 'Subscription',
  hybrid: 'Hybrid',
  performance_based: 'Performance',
  
  // Delivery Models
  on_demand: 'On Demand',
  scheduled: 'Scheduled',
  continuous: 'Continuous',
  milestone_based: 'Milestone',
  agile: 'Agile',
  waterfall: 'Waterfall',
  support_maintenance: 'Support',
  
  // Data Profiles
  personal: 'Personal Data',
  financial: 'Financial Data',
  health: 'Health Data',
  technical: 'Technical Data',
  proprietary: 'Proprietary',
  
  // Risk Flags
  compliance_risk: 'Compliance',
  financial_risk: 'Financial',
  data_risk: 'Data Risk',
  operational_risk: 'Operational',
  legal_risk: 'Legal',
  vendor_risk: 'Vendor',
  currency_risk: 'Currency',
  termination_risk: 'Termination',
};

export function ContractTags({ 
  pricingModels = [], 
  deliveryModels = [], 
  dataProfiles = [], 
  riskFlags = [],
  className,
  compact = false
}: ContractTagsProps) {
  const hasAnyTags = 
    pricingModels.length > 0 || 
    deliveryModels.length > 0 || 
    dataProfiles.length > 0 || 
    riskFlags.length > 0;

  if (!hasAnyTags) {
    return null;
  }

  if (compact) {
    // Compact mode: show count badges
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {pricingModels.length > 0 && (
          <Badge variant="outline" className="text-xs">
            <DollarSign className="h-3 w-3 mr-1" />
            {pricingModels.length}
          </Badge>
        )}
        {deliveryModels.length > 0 && (
          <Badge variant="outline" className="text-xs">
            <Truck className="h-3 w-3 mr-1" />
            {deliveryModels.length}
          </Badge>
        )}
        {dataProfiles.length > 0 && (
          <Badge variant="outline" className="text-xs">
            <Database className="h-3 w-3 mr-1" />
            {dataProfiles.length}
          </Badge>
        )}
        {riskFlags.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {riskFlags.length}
          </Badge>
        )}
      </div>
    );
  }

  // Full mode: show all tags
  return (
    <div className={cn("space-y-2", className)}>
      {pricingModels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground mr-2 flex items-center">
            <DollarSign className="h-3 w-3 mr-1" />
            Pricing:
          </span>
          {pricingModels.map(model => (
            <Badge key={model} variant="secondary" className="text-xs">
              {TAG_LABELS[model as keyof typeof TAG_LABELS] || model}
            </Badge>
          ))}
        </div>
      )}

      {deliveryModels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground mr-2 flex items-center">
            <Truck className="h-3 w-3 mr-1" />
            Delivery:
          </span>
          {deliveryModels.map(model => (
            <Badge key={model} variant="secondary" className="text-xs">
              {TAG_LABELS[model as keyof typeof TAG_LABELS] || model}
            </Badge>
          ))}
        </div>
      )}

      {dataProfiles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground mr-2 flex items-center">
            <Database className="h-3 w-3 mr-1" />
            Data:
          </span>
          {dataProfiles.map(profile => (
            <Badge 
              key={profile} 
              variant="outline" 
              className="text-xs border-violet-300 text-violet-700"
            >
              {TAG_LABELS[profile as keyof typeof TAG_LABELS] || profile}
            </Badge>
          ))}
        </div>
      )}

      {riskFlags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground mr-2 flex items-center">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Risks:
          </span>
          {riskFlags.map(flag => (
            <Badge 
              key={flag} 
              variant="destructive" 
              className="text-xs"
            >
              {TAG_LABELS[flag as keyof typeof TAG_LABELS] || flag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
