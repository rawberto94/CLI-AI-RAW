'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/feedback/LoadingButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface BaselineEntryFormProps {
  onSuccess?: (baseline: any) => void;
  onCancel?: () => void;
  initialData?: any;
  mode?: 'create' | 'edit';
}

export function BaselineEntryForm({
  onSuccess,
  onCancel,
  initialData,
  mode = 'create',
}: BaselineEntryFormProps) {
  const [formData, setFormData] = useState({
    baselineName: initialData?.baselineName || '',
    baselineType: initialData?.baselineType || 'TARGET_RATE',
    role: initialData?.role || '',
    seniority: initialData?.seniority || '',
    country: initialData?.country || '',
    region: initialData?.region || '',
    categoryL1: initialData?.categoryL1 || '',
    categoryL2: initialData?.categoryL2 || '',
    dailyRateUSD: initialData?.dailyRateUSD || '',
    currency: initialData?.currency || 'USD',
    minimumRate: initialData?.minimumRate || '',
    maximumRate: initialData?.maximumRate || '',
    tolerancePercentage: initialData?.tolerancePercentage || '5',
    source: initialData?.source || 'MANUAL_ENTRY',
    sourceDetails: initialData?.sourceDetails || '',
    effectiveDate: initialData?.effectiveDate || new Date().toISOString().split('T')[0],
    expiryDate: initialData?.expiryDate || '',
    notes: initialData?.notes || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const baselineTypes = [
    { value: 'TARGET_RATE', label: 'Target Rate' },
    { value: 'MARKET_BENCHMARK', label: 'Market Benchmark' },
    { value: 'HISTORICAL_BEST', label: 'Historical Best' },
    { value: 'NEGOTIATED_CAP', label: 'Negotiated Cap' },
    { value: 'INTERNAL_POLICY', label: 'Internal Policy' },
  ];

  const seniorityLevels = [
    { value: '', label: 'Any' },
    { value: 'JUNIOR', label: 'Junior' },
    { value: 'MID', label: 'Mid' },
    { value: 'SENIOR', label: 'Senior' },
    { value: 'LEAD', label: 'Lead' },
    { value: 'PRINCIPAL', label: 'Principal' },
    { value: 'DIRECTOR', label: 'Director' },
  ];

  const sources = [
    { value: 'MANUAL_ENTRY', label: 'Manual Entry' },
    { value: 'MARKET_RESEARCH', label: 'Market Research' },
    { value: 'HISTORICAL_DATA', label: 'Historical Data' },
    { value: 'INDUSTRY_REPORT', label: 'Industry Report' },
    { value: 'NEGOTIATED_AGREEMENT', label: 'Negotiated Agreement' },
    { value: 'IMPORTED_FILE', label: 'Imported File' },
  ];

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.baselineName.trim()) {
      newErrors.baselineName = 'Baseline name is required';
    }
    if (!formData.role.trim()) {
      newErrors.role = 'Role is required';
    }
    if (!formData.dailyRateUSD || Number(formData.dailyRateUSD) <= 0) {
      newErrors.dailyRateUSD = 'Valid daily rate is required';
    }
    if (formData.minimumRate && Number(formData.minimumRate) < 0) {
      newErrors.minimumRate = 'Minimum rate cannot be negative';
    }
    if (formData.maximumRate && Number(formData.maximumRate) < 0) {
      newErrors.maximumRate = 'Maximum rate cannot be negative';
    }
    if (formData.minimumRate && formData.maximumRate && 
        Number(formData.minimumRate) > Number(formData.maximumRate)) {
      newErrors.maximumRate = 'Maximum rate must be greater than minimum rate';
    }
    if (!formData.effectiveDate) {
      newErrors.effectiveDate = 'Effective date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        dailyRateUSD: Number(formData.dailyRateUSD),
        minimumRate: formData.minimumRate ? Number(formData.minimumRate) : undefined,
        maximumRate: formData.maximumRate ? Number(formData.maximumRate) : undefined,
        tolerancePercentage: formData.tolerancePercentage ? Number(formData.tolerancePercentage) : undefined,
        effectiveDate: new Date(formData.effectiveDate),
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined,
        seniority: formData.seniority || undefined,
      };

      const response = await fetch('/api/rate-cards/baselines', {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save baseline');
      }

      const result = await response.json();
      onSuccess?.(result);
    } catch (error: unknown) {
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save baseline' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Basic Information</h3>
        
        <div>
          <Label htmlFor="baselineName">Baseline Name *</Label>
          <Input
            id="baselineName"
            value={formData.baselineName}
            onChange={(e) => handleChange('baselineName', e.target.value)}
            placeholder="e.g., Q1 2025 Target Rates"
            className={errors.baselineName ? 'border-red-500' : ''}
          />
          {errors.baselineName && (
            <p className="text-sm text-red-500 mt-1">{errors.baselineName}</p>
          )}
        </div>

        <div>
          <Label htmlFor="baselineType">Baseline Type *</Label>
          <Select
            value={formData.baselineType}
            onValueChange={(value) => handleChange('baselineType', value)}
          >
            {baselineTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Role Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Role Information</h3>
        
        <div>
          <Label htmlFor="role">Role *</Label>
          <Input
            id="role"
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value)}
            placeholder="e.g., Software Engineer, Project Manager"
            className={errors.role ? 'border-red-500' : ''}
          />
          {errors.role && (
            <p className="text-sm text-red-500 mt-1">{errors.role}</p>
          )}
        </div>

        <div>
          <Label htmlFor="seniority">Seniority Level</Label>
          <Select
            value={formData.seniority}
            onValueChange={(value) => handleChange('seniority', value)}
          >
            {seniorityLevels.map(level => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="categoryL1">Category L1</Label>
            <Input
              id="categoryL1"
              value={formData.categoryL1}
              onChange={(e) => handleChange('categoryL1', e.target.value)}
              placeholder="e.g., IT Services"
            />
          </div>
          <div>
            <Label htmlFor="categoryL2">Category L2</Label>
            <Input
              id="categoryL2"
              value={formData.categoryL2}
              onChange={(e) => handleChange('categoryL2', e.target.value)}
              placeholder="e.g., Software Development"
            />
          </div>
        </div>
      </div>

      {/* Geographic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Geographic Scope</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value)}
              placeholder="e.g., United States"
            />
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Leave empty for global baseline</p>
          </div>
          <div>
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={formData.region}
              onChange={(e) => handleChange('region', e.target.value)}
              placeholder="e.g., North America"
            />
          </div>
        </div>
      </div>

      {/* Rate Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Rate Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dailyRateUSD">Target Daily Rate (USD) *</Label>
            <Input
              id="dailyRateUSD"
              type="number"
              step="0.01"
              value={formData.dailyRateUSD}
              onChange={(e) => handleChange('dailyRateUSD', e.target.value)}
              placeholder="e.g., 800"
              className={errors.dailyRateUSD ? 'border-red-500' : ''}
            />
            {errors.dailyRateUSD && (
              <p className="text-sm text-red-500 mt-1">{errors.dailyRateUSD}</p>
            )}
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              placeholder="USD"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="minimumRate">Minimum Rate</Label>
            <Input
              id="minimumRate"
              type="number"
              step="0.01"
              value={formData.minimumRate}
              onChange={(e) => handleChange('minimumRate', e.target.value)}
              placeholder="Optional"
              className={errors.minimumRate ? 'border-red-500' : ''}
            />
            {errors.minimumRate && (
              <p className="text-sm text-red-500 mt-1">{errors.minimumRate}</p>
            )}
          </div>
          <div>
            <Label htmlFor="maximumRate">Maximum Rate</Label>
            <Input
              id="maximumRate"
              type="number"
              step="0.01"
              value={formData.maximumRate}
              onChange={(e) => handleChange('maximumRate', e.target.value)}
              placeholder="Optional"
              className={errors.maximumRate ? 'border-red-500' : ''}
            />
            {errors.maximumRate && (
              <p className="text-sm text-red-500 mt-1">{errors.maximumRate}</p>
            )}
          </div>
          <div>
            <Label htmlFor="tolerancePercentage">Tolerance %</Label>
            <Input
              id="tolerancePercentage"
              type="number"
              step="0.1"
              value={formData.tolerancePercentage}
              onChange={(e) => handleChange('tolerancePercentage', e.target.value)}
              placeholder="5"
            />
          </div>
        </div>
      </div>

      {/* Source Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Source Information</h3>
        
        <div>
          <Label htmlFor="source">Source</Label>
          <Select
            value={formData.source}
            onValueChange={(value) => handleChange('source', value)}
          >
            {sources.map(source => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="sourceDetails">Source Details</Label>
          <Input
            id="sourceDetails"
            value={formData.sourceDetails}
            onChange={(e) => handleChange('sourceDetails', e.target.value)}
            placeholder="e.g., Gartner Report 2025, Contract XYZ"
          />
        </div>
      </div>

      {/* Validity Period */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Validity Period</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="effectiveDate">Effective Date *</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={formData.effectiveDate}
              onChange={(e) => handleChange('effectiveDate', e.target.value)}
              className={errors.effectiveDate ? 'border-red-500' : ''}
            />
            {errors.effectiveDate && (
              <p className="text-sm text-red-500 mt-1">{errors.effectiveDate}</p>
            )}
          </div>
          <div>
            <Label htmlFor="expiryDate">Expiry Date</Label>
            <Input
              id="expiryDate"
              type="date"
              value={formData.expiryDate}
              onChange={(e) => handleChange('expiryDate', e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Leave empty for no expiry</p>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional notes or context..."
          rows={3}
        />
      </div>

      {/* Error Message */}
      {errors.submit && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {errors.submit}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <LoadingButton 
          type="submit" 
          loading={isSubmitting}
          loadingText="Saving..."
        >
          {mode === 'edit' ? 'Update Baseline' : 'Create Baseline'}
        </LoadingButton>
      </div>
    </form>
  );
}
