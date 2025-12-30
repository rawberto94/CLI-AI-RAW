/**
 * Example Contract Form using React Hook Form with Zod validation
 * Demonstrates best practices for form handling with auto-save and validation
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Check, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// Define form schema with Zod
const contractFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  type: z.enum(['service', 'product', 'employment', 'lease', 'other'], {
    required_error: 'Contract type is required',
  }),
  value: z.coerce.number().positive('Value must be positive').optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  supplierName: z.string().min(1, 'Supplier name is required'),
  supplierEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  autoRenew: z.boolean().default(false),
  notificationDays: z.coerce.number().int().min(1).max(365).default(30),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

interface ContractFormProps {
  initialData?: Partial<ContractFormValues>;
  contractId?: string;
  onSubmit?: (data: ContractFormValues) => Promise<void>;
  onAutoSave?: (data: ContractFormValues) => Promise<void>;
}

export function ContractForm({
  initialData,
  contractId,
  onSubmit,
  onAutoSave,
}: ContractFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'service',
      value: undefined,
      startDate: '',
      endDate: '',
      supplierName: '',
      supplierEmail: '',
      autoRenew: false,
      notificationDays: 30,
      ...initialData,
    },
    mode: 'onBlur', // Validate on blur for better UX
  });

  // Watch all form values for auto-save
  const formValues = form.watch();
  const debouncedValues = useDebounce(formValues, 2000); // 2 second delay

  // Auto-save effect
  useEffect(() => {
    const autoSave = async () => {
      if (!onAutoSave || !form.formState.isDirty) return;

      // Only auto-save if form is valid
      const isValid = await form.trigger();
      if (!isValid) return;

      setIsSaving(true);
      setSaveError(null);

      try {
        await onAutoSave(debouncedValues as ContractFormValues);
        setLastSaved(new Date());
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save');
      } finally {
        setIsSaving(false);
      }
    };

    autoSave();
  }, [debouncedValues, onAutoSave, form]);

  // Handle form submission
  const handleSubmit = form.handleSubmit(async (data) => {
    if (!onSubmit) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSubmit(data);
      form.reset(data); // Reset form state to mark as not dirty
      setLastSaved(new Date());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  });

  // Watch contract type to show/hide fields
  const contractType = form.watch('type');
  const autoRenew = form.watch('autoRenew');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Status Bar */}
      <div className="flex items-center justify-between py-2 px-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
        <div className="flex items-center gap-3">
          {form.formState.isDirty && !isSaving && (
            <Badge variant="secondary" className="gap-1.5">
              <AlertCircle className="h-3 w-3" />
              Unsaved changes
            </Badge>
          )}
          {isSaving && (
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </span>
          )}
          {!isSaving && lastSaved && !form.formState.isDirty && (
            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Check className="h-3.5 w-3.5 text-green-600" />
              Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
            </span>
          )}
          {saveError && (
            <Badge variant="destructive" className="gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {saveError}
            </Badge>
          )}
        </div>

        {contractId && (
          <span className="text-xs text-slate-500">ID: {contractId}</span>
        )}
      </div>

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">
            Contract Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            {...form.register('title')}
            placeholder="Enter contract title"
            aria-invalid={!!form.formState.errors.title}
            aria-describedby={form.formState.errors.title ? 'title-error' : undefined}
          />
          {form.formState.errors.title && (
            <p id="title-error" className="text-sm text-red-600">
              {form.formState.errors.title.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...form.register('description')}
            placeholder="Brief description of the contract"
            rows={3}
          />
        </div>

        {/* Contract Type */}
        <div className="space-y-2">
          <Label htmlFor="type">
            Contract Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={form.watch('type')}
            onValueChange={(value) => form.setValue('type', value as any, { shouldDirty: true })}
          >
            <SelectTrigger id="type">
              <SelectValue placeholder="Select contract type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="service">Service Agreement</SelectItem>
              <SelectItem value="product">Product Purchase</SelectItem>
              <SelectItem value="employment">Employment Contract</SelectItem>
              <SelectItem value="lease">Lease Agreement</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.type && (
            <p className="text-sm text-red-600">{form.formState.errors.type.message}</p>
          )}
        </div>

        {/* Conditional Field: Value (only for certain types) */}
        {['service', 'product', 'lease'].includes(contractType) && (
          <div className="space-y-2">
            <Label htmlFor="value">Contract Value (USD)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              {...form.register('value')}
              placeholder="0.00"
              aria-invalid={!!form.formState.errors.value}
            />
            {form.formState.errors.value && (
              <p className="text-sm text-red-600">{form.formState.errors.value.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Contract Period</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">
              Start Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="startDate"
              type="date"
              {...form.register('startDate')}
              aria-invalid={!!form.formState.errors.startDate}
            />
            {form.formState.errors.startDate && (
              <p className="text-sm text-red-600">{form.formState.errors.startDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" type="date" {...form.register('endDate')} />
          </div>
        </div>
      </div>

      {/* Supplier Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Supplier Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="supplierName">
              Supplier Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="supplierName"
              {...form.register('supplierName')}
              placeholder="Supplier name"
              aria-invalid={!!form.formState.errors.supplierName}
            />
            {form.formState.errors.supplierName && (
              <p className="text-sm text-red-600">{form.formState.errors.supplierName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplierEmail">Supplier Email</Label>
            <Input
              id="supplierEmail"
              type="email"
              {...form.register('supplierEmail')}
              placeholder="supplier@example.com"
              aria-invalid={!!form.formState.errors.supplierEmail}
            />
            {form.formState.errors.supplierEmail && (
              <p className="text-sm text-red-600">{form.formState.errors.supplierEmail.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Renewal Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Renewal Options</h3>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="autoRenew"
            {...form.register('autoRenew')}
            className="h-4 w-4 rounded border-slate-300"
          />
          <Label htmlFor="autoRenew" className="cursor-pointer">
            Auto-renew contract
          </Label>
        </div>

        {autoRenew && (
          <div className="space-y-2 ml-6">
            <Label htmlFor="notificationDays">Notification Days Before Renewal</Label>
            <Input
              id="notificationDays"
              type="number"
              {...form.register('notificationDays')}
              placeholder="30"
              className="max-w-xs"
            />
            <p className="text-xs text-slate-500">
              You'll be notified this many days before the contract renews
            </p>
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset()}
          disabled={!form.formState.isDirty || isSaving}
        >
          Reset
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => {
              // Draft save without validation
              if (onAutoSave) {
                onAutoSave(form.getValues());
              }
            }}
          >
            Save Draft
          </Button>

          <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Contract'}
          </Button>
        </div>
      </div>

      {/* Form Debug (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <summary className="cursor-pointer font-medium">Form Debug Info</summary>
          <div className="mt-4 space-y-2 text-xs">
            <div>
              <strong>Is Dirty:</strong> {form.formState.isDirty ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Is Valid:</strong> {form.formState.isValid ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Errors:</strong>
              <pre className="mt-1 p-2 bg-white dark:bg-slate-900 rounded">
                {JSON.stringify(form.formState.errors, null, 2)}
              </pre>
            </div>
            <div>
              <strong>Values:</strong>
              <pre className="mt-1 p-2 bg-white dark:bg-slate-900 rounded">
                {JSON.stringify(form.getValues(), null, 2)}
              </pre>
            </div>
          </div>
        </details>
      )}
    </form>
  );
}
