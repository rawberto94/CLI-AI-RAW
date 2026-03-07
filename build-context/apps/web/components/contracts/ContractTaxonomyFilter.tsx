/**
 * Contract Taxonomy Filter Component
 * 
 * Filter contracts by category, document role, and tags
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaxonomyFilters {
  categoryId?: string;
  documentRole?: string;
  pricingModel?: string;
  deliveryModel?: string;
  dataProfile?: string;
  riskFlag?: string;
}

interface ContractTaxonomyFilterProps {
  filters: TaxonomyFilters;
  onChange: (filters: TaxonomyFilters) => void;
  className?: string;
}

const CATEGORIES = [
  { id: 'master_framework', label: 'Master / Framework' },
  { id: 'scope_work_authorization', label: 'Scope / Work Authorization' },
  { id: 'performance_operations', label: 'Performance / Operations' },
  { id: 'purchase_supply', label: 'Purchase / Supply' },
  { id: 'data_security_privacy', label: 'Data / Security / Privacy' },
  { id: 'confidentiality_ip', label: 'Confidentiality / IP' },
  { id: 'software_cloud', label: 'Software / Cloud' },
  { id: 'partnerships_jv', label: 'Partnerships / JV' },
  { id: 'hr_employment', label: 'HR / Employment' },
  { id: 'compliance_regulatory', label: 'Compliance / Regulatory' },
];

const DOCUMENT_ROLES = [
  { id: 'primary', label: 'Primary' },
  { id: 'supporting', label: 'Supporting' },
  { id: 'derivative', label: 'Derivative' },
  { id: 'reference', label: 'Reference' },
  { id: 'amendment', label: 'Amendment' },
  { id: 'superseded', label: 'Superseded' },
  { id: 'template', label: 'Template' },
];

const PRICING_MODELS = [
  { id: 'fixed_price', label: 'Fixed Price' },
  { id: 'time_materials', label: 'Time & Materials' },
  { id: 'unit_pricing', label: 'Unit Pricing' },
  { id: 'retainer', label: 'Retainer' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'performance_based', label: 'Performance Based' },
];

const RISK_FLAGS = [
  { id: 'compliance_risk', label: 'Compliance Risk' },
  { id: 'financial_risk', label: 'Financial Risk' },
  { id: 'data_risk', label: 'Data Risk' },
  { id: 'operational_risk', label: 'Operational Risk' },
  { id: 'legal_risk', label: 'Legal Risk' },
  { id: 'vendor_risk', label: 'Vendor Risk' },
];

export function ContractTaxonomyFilter({ 
  filters, 
  onChange,
  className 
}: ContractTaxonomyFilterProps) {
  const [expanded, setExpanded] = useState(false);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const clearFilter = (key: keyof TaxonomyFilters) => {
    onChange({ ...filters, [key]: undefined });
  };

  const clearAllFilters = () => {
    onChange({});
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Taxonomy Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs"
          >
            Clear All
          </Button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 border rounded-lg bg-muted/50">
          {/* Category Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select
              value={filters.categoryId || ''}
              onValueChange={(value) => 
                onChange({ ...filters, categoryId: value || undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Document Role Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Document Role</label>
            <Select
              value={filters.documentRole || ''}
              onValueChange={(value) => 
                onChange({ ...filters, documentRole: value || undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                {DOCUMENT_ROLES.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing Model Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Pricing Model</label>
            <Select
              value={filters.pricingModel || ''}
              onValueChange={(value) => 
                onChange({ ...filters, pricingModel: value || undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Pricing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Pricing</SelectItem>
                {PRICING_MODELS.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Risk Flag Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Risk Flags</label>
            <Select
              value={filters.riskFlag || ''}
              onValueChange={(value) => 
                onChange({ ...filters, riskFlag: value || undefined })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Risks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Risks</SelectItem>
                {RISK_FLAGS.map(flag => (
                  <SelectItem key={flag.id} value={flag.id}>
                    {flag.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.categoryId && (
            <Badge variant="secondary" className="gap-1">
              Category: {CATEGORIES.find(c => c.id === filters.categoryId)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => clearFilter('categoryId')}
              />
            </Badge>
          )}
          {filters.documentRole && (
            <Badge variant="secondary" className="gap-1">
              Role: {DOCUMENT_ROLES.find(r => r.id === filters.documentRole)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => clearFilter('documentRole')}
              />
            </Badge>
          )}
          {filters.pricingModel && (
            <Badge variant="secondary" className="gap-1">
              Pricing: {PRICING_MODELS.find(p => p.id === filters.pricingModel)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => clearFilter('pricingModel')}
              />
            </Badge>
          )}
          {filters.riskFlag && (
            <Badge variant="destructive" className="gap-1">
              Risk: {RISK_FLAGS.find(r => r.id === filters.riskFlag)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => clearFilter('riskFlag')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
