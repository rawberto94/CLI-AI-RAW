'use client';

/**
 * Rate Card Entry Form
 * Multi-section form for manual rate card entry with validation and AI assistance
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, Save, X, AlertCircle, CheckCircle, Sparkles, RefreshCw, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrencyConverter } from '@/lib/services/currency.service';

interface RateCardFormData {
  // Source
  source: 'MANUAL' | 'PDF_EXTRACTION' | 'CSV_IMPORT';
  contractId?: string;

  // Supplier
  supplierName: string;
  supplierTier: 'BIG_4' | 'TIER_2' | 'BOUTIQUE' | 'OFFSHORE';
  supplierCountry: string;

  // Role
  roleOriginal: string;
  roleStandardized: string;
  seniority: 'JUNIOR' | 'MID' | 'SENIOR' | 'PRINCIPAL' | 'PARTNER';
  lineOfService: string;
  roleCategory: string;

  // Rate
  dailyRate: number;
  currency: string;

  // Geography
  country: string;
  region: string;
  city?: string;

  // Contract Context
  effectiveDate: string;
  expiryDate?: string;
  isNegotiated: boolean;
  negotiationNotes?: string;

  // Additional
  skills?: string;
  certifications?: string;
}

interface RateCardEntryFormProps {
  onSuccess?: (rateCard: any) => void;
  onCancel?: () => void;
  initialData?: Partial<RateCardFormData>;
  contractId?: string;
}

export function RateCardEntryForm({
  onSuccess,
  onCancel,
  initialData,
  contractId,
}: RateCardEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStandardizing, setIsStandardizing] = useState(false);
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [roleSuggestions, setRoleSuggestions] = useState<string[]>([]);
  const [convertedRates, setConvertedRates] = useState<{ usd: number; eur: number; gbp: number; chf: number } | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [showConversion, setShowConversion] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  const { convert, format } = useCurrencyConverter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RateCardFormData>({
    defaultValues: {
      source: 'MANUAL',
      contractId,
      supplierTier: 'TIER_2',
      seniority: 'MID',
      currency: 'USD',
      country: 'United States',
      region: 'Americas',
      isNegotiated: false,
      effectiveDate: new Date().toISOString().split('T')[0],
      ...initialData,
    },
  });

  const watchedFields = watch();

  // Fetch supplier suggestions
  const fetchSupplierSuggestions = async (query: string) => {
    if (query.length < 2) return;
    try {
      const response = await fetch(
        `/api/rate-cards/suppliers/suggestions?q=${encodeURIComponent(query)}`,
        {
          headers: { 'x-tenant-id': 'default-tenant' },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setSupplierSuggestions(data.suggestions || []);
      }
    } catch {
      // Error handled silently
    }
  };

  // Fetch role suggestions
  const fetchRoleSuggestions = async (query: string) => {
    if (query.length < 2) return;
    try {
      const response = await fetch(
        `/api/rate-cards/roles/suggestions?q=${encodeURIComponent(query)}`,
        {
          headers: { 'x-tenant-id': 'default-tenant' },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setRoleSuggestions(data.suggestions || []);
      }
    } catch {
      // Error handled silently
    }
  };

  // AI role standardization
  const handleStandardizeRole = async () => {
    if (!watchedFields.roleOriginal) {
      toast.error('Please enter a role name first');
      return;
    }

    setIsStandardizing(true);
    try {
      const response = await fetch('/api/rate-cards/roles/standardize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'default-tenant',
        },
        body: JSON.stringify({
          roleOriginal: watchedFields.roleOriginal,
          context: {
            lineOfService: watchedFields.lineOfService,
            seniority: watchedFields.seniority,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setValue('roleStandardized', data.standardized);
        setValue('roleCategory', data.category);
        toast.success(`Standardized to: ${data.standardized}`);
      }
    } catch {
      toast.error('Failed to standardize role');
    } finally {
      setIsStandardizing(false);
    }
  };

  // Currency conversion preview
  useEffect(() => {
    const convertCurrency = async () => {
      if (!watchedFields.dailyRate || !watchedFields.currency || watchedFields.dailyRate <= 0) {
        setConvertedRates(null);
        return;
      }

      setIsConverting(true);
      setShowConversion(true);
      try {
        const amount = watchedFields.dailyRate;
        const from = watchedFields.currency;

        const convertTo = async (to: string): Promise<number> => {
          if (from === to) return amount;
          const result = await convert(amount, from, to);
          return result.convertedAmount;
        };

        // Convert to major currencies for benchmarking
        const conversions = await Promise.all([
          convertTo('USD'),
          convertTo('EUR'),
          convertTo('GBP'),
          convertTo('CHF'),
        ]);

        setConvertedRates({
          usd: conversions[0],
          eur: conversions[1],
          gbp: conversions[2],
          chf: conversions[3],
        });
      } catch {
        setConvertedRates(null);
      } finally {
        setIsConverting(false);
      }
    };

    const debounce = setTimeout(convertCurrency, 500);
    return () => clearTimeout(debounce);
  }, [watchedFields.dailyRate, watchedFields.currency, convert]);

  // Check for duplicates
  useEffect(() => {
    const checkDuplicates = async () => {
      if (
        !watchedFields.roleStandardized ||
        !watchedFields.supplierName ||
        !watchedFields.seniority
      ) {
        return;
      }

      try {
        const response = await fetch('/api/rate-cards/check-duplicates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': 'default-tenant',
          },
          body: JSON.stringify({
            roleStandardized: watchedFields.roleStandardized,
            supplierName: watchedFields.supplierName,
            seniority: watchedFields.seniority,
            country: watchedFields.country,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.hasDuplicates) {
            setDuplicateWarning(data);
          } else {
            setDuplicateWarning(null);
          }
        }
      } catch {
        // Error handled silently
      }
    };

    const debounce = setTimeout(checkDuplicates, 1000);
    return () => clearTimeout(debounce);
  }, [
    watchedFields.roleStandardized,
    watchedFields.supplierName,
    watchedFields.seniority,
    watchedFields.country,
  ]);

  const onSubmit = async (data: RateCardFormData) => {
    setIsSubmitting(true);
    try {
      // Parse skills and certifications
      const formattedData = {
        ...data,
        skills: data.skills ? data.skills.split(',').map((s) => s.trim()) : [],
        certifications: data.certifications
          ? data.certifications.split(',').map((c) => c.trim())
          : [],
      };

      const response = await fetch('/api/rate-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'default-tenant',
          'x-user-id': 'current-user',
        },
        body: JSON.stringify(formattedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save rate card');
      }

      const result = await response.json();
      toast.success('Rate card saved successfully');
      onSuccess?.(result.rateCard);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save rate card');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Supplier Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Supplier Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="supplierName">
              Supplier Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="supplierName"
              {...register('supplierName', { required: 'Supplier name is required' })}
              onChange={(e) => {
                register('supplierName').onChange(e);
                fetchSupplierSuggestions(e.target.value);
              }}
              list="supplier-suggestions"
            />
            {supplierSuggestions.length > 0 && (
              <datalist id="supplier-suggestions">
                {supplierSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
            {errors.supplierName && (
              <p className="text-sm text-red-500 mt-1">{errors.supplierName.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="supplierTier">Supplier Tier</Label>
            <select
              id="supplierTier"
              {...register('supplierTier')}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="BIG_4">Big 4</option>
              <option value="TIER_2">Tier 2</option>
              <option value="BOUTIQUE">Boutique</option>
              <option value="OFFSHORE">Offshore</option>
            </select>
          </div>

          <div>
            <Label htmlFor="supplierCountry">Supplier Country</Label>
            <Input id="supplierCountry" {...register('supplierCountry')} />
          </div>
        </div>
      </Card>

      {/* Role Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Role Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="roleOriginal">
              Role Name (as in contract) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="roleOriginal"
              {...register('roleOriginal', { required: 'Role name is required' })}
              onChange={(e) => {
                register('roleOriginal').onChange(e);
                fetchRoleSuggestions(e.target.value);
              }}
              list="role-suggestions"
            />
            {roleSuggestions.length > 0 && (
              <datalist id="role-suggestions">
                {roleSuggestions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            )}
            {errors.roleOriginal && (
              <p className="text-sm text-red-500 mt-1">{errors.roleOriginal.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="roleStandardized">
              Standardized Role <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="roleStandardized"
                {...register('roleStandardized', {
                  required: 'Standardized role is required',
                })}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleStandardizeRole}
                disabled={isStandardizing || !watchedFields.roleOriginal}
              >
                {isStandardizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>
            </div>
            {errors.roleStandardized && (
              <p className="text-sm text-red-500 mt-1">{errors.roleStandardized.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="seniority">Seniority Level</Label>
            <select
              id="seniority"
              {...register('seniority')}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="JUNIOR">Junior</option>
              <option value="MID">Mid-Level</option>
              <option value="SENIOR">Senior</option>
              <option value="PRINCIPAL">Principal</option>
              <option value="PARTNER">Partner</option>
            </select>
          </div>

          <div>
            <Label htmlFor="lineOfService">Line of Service</Label>
            <Input
              id="lineOfService"
              {...register('lineOfService')}
              placeholder="e.g., Technology Consulting"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="skills">Skills (comma-separated)</Label>
            <Input
              id="skills"
              {...register('skills')}
              placeholder="e.g., React, Node.js, AWS"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="certifications">Certifications (comma-separated)</Label>
            <Input
              id="certifications"
              {...register('certifications')}
              placeholder="e.g., AWS Solutions Architect, PMP"
            />
          </div>
        </div>
      </Card>

      {/* Rate Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Rate Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dailyRate">
              Daily Rate <span className="text-red-500">*</span>
            </Label>
            <Input
              id="dailyRate"
              type="number"
              step="0.01"
              {...register('dailyRate', {
                required: 'Daily rate is required',
                min: { value: 0, message: 'Rate must be positive' },
              })}
            />
            {errors.dailyRate && (
              <p className="text-sm text-red-500 mt-1">{errors.dailyRate.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="currency">Currency</Label>
            <select
              id="currency"
              {...register('currency')}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
              <option value="INR">INR</option>
            </select>
          </div>

          {showConversion && convertedRates && (
            <div className="col-span-2 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <strong className="text-sm text-blue-900">Converted Rates</strong>
                </div>
                {isConverting && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {watchedFields.currency !== 'USD' && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">USD:</span>
                    <span className="font-medium">{format(convertedRates.usd, 'USD', 'en-US')}</span>
                  </div>
                )}
                {watchedFields.currency !== 'EUR' && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">EUR:</span>
                    <span className="font-medium">{format(convertedRates.eur, 'EUR', 'en-US')}</span>
                  </div>
                )}
                {watchedFields.currency !== 'GBP' && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">GBP:</span>
                    <span className="font-medium">{format(convertedRates.gbp, 'GBP', 'en-US')}</span>
                  </div>
                )}
                {watchedFields.currency !== 'CHF' && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">CHF:</span>
                    <span className="font-medium">{format(convertedRates.chf, 'CHF', 'en-US')}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Real-time conversion for global benchmarking
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Geography Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Geography</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="country">Country</Label>
            <Input id="country" {...register('country')} />
          </div>

          <div>
            <Label htmlFor="region">Region</Label>
            <Input id="region" {...register('region')} />
          </div>

          <div>
            <Label htmlFor="city">City (Optional)</Label>
            <Input id="city" {...register('city')} />
          </div>
        </div>
      </Card>

      {/* Contract Context */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Contract Context</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="effectiveDate">Effective Date</Label>
            <Input id="effectiveDate" type="date" {...register('effectiveDate')} />
          </div>

          <div>
            <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
            <Input id="expiryDate" type="date" {...register('expiryDate')} />
          </div>

          <div className="col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register('isNegotiated')} />
              <span>This rate was negotiated</span>
            </label>
          </div>

          {watchedFields.isNegotiated && (
            <div className="col-span-2">
              <Label htmlFor="negotiationNotes">Negotiation Notes</Label>
              <textarea
                id="negotiationNotes"
                {...register('negotiationNotes')}
                className="w-full px-3 py-2 border rounded-md"
                rows={3}
                placeholder="Add notes about the negotiation..."
              />
            </div>
          )}
        </div>
      </Card>

      {/* Duplicate Warning */}
      {duplicateWarning && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900">Similar Rate Cards Found</p>
              <p className="text-sm text-yellow-700 mt-1">
                Found {duplicateWarning.count} similar rate card(s) for this role and supplier.
              </p>
              {duplicateWarning.similar && duplicateWarning.similar.length > 0 && (
                <div className="mt-2 space-y-1">
                  {duplicateWarning.similar.slice(0, 3).map((dup: any, idx: number) => (
                    <div key={idx} className="text-xs text-yellow-700">
                      • {dup.roleStandardized} - {dup.dailyRate} {dup.currency} (
                      {new Date(dup.effectiveDate).toLocaleDateString()})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Rate Card
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
