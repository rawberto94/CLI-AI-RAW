/**
 * Alert Rule Form Component
 * Create and edit alert rules for rate card monitoring
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Bell, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const alertRuleSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  ruleType: z.enum(['price_threshold', 'percentage_change', 'rate_expiry', 'market_deviation']),
  targetEntity: z.enum(['supplier', 'role', 'location', 'skill']),
  targetId: z.string().optional(),
  thresholdValue: z.number().min(0),
  comparisonOperator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
  timeWindow: z.number().min(1).max(365).optional(),
  isActive: z.boolean().default(true),
});

export type AlertRuleFormValues = z.infer<typeof alertRuleSchema>;

interface AlertRuleFormProps {
  initialValues?: Partial<AlertRuleFormValues & { notificationChannels?: string[]; recipients?: string[] }>;
  onSubmit: (values: AlertRuleFormValues & { notificationChannels: string[]; recipients: string[] }) => Promise<void>;
  onCancel?: () => void;
}

export function AlertRuleForm({ initialValues, onSubmit, onCancel }: AlertRuleFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipients, setRecipients] = useState<string[]>(initialValues?.recipients || []);
  const [channels, setChannels] = useState<string[]>(initialValues?.notificationChannels || ['email']);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AlertRuleFormValues>({
    resolver: zodResolver(alertRuleSchema),
    defaultValues: {
      name: initialValues?.name || '',
      description: initialValues?.description || '',
      ruleType: initialValues?.ruleType || 'price_threshold',
      targetEntity: initialValues?.targetEntity || 'supplier',
      targetId: initialValues?.targetId || '',
      thresholdValue: initialValues?.thresholdValue || 0,
      comparisonOperator: initialValues?.comparisonOperator || 'gt',
      timeWindow: initialValues?.timeWindow || 30,
      isActive: initialValues?.isActive ?? true,
    },
  });

  const ruleType = watch('ruleType');

  const onFormSubmit = async (data: AlertRuleFormValues) => {
    if (recipients.length === 0) {
      toast.error('Please add at least one email recipient');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ ...data, notificationChannels: channels, recipients });
      toast.success('Alert rule saved successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save alert rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addRecipient = () => {
    const email = prompt('Enter email address:');
    if (email && /\S+@\S+\.\S+/.test(email)) {
      setRecipients([...recipients, email]);
    } else if (email) {
      toast.error('Invalid email address');
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const toggleChannel = (channel: string) => {
    if (channels.includes(channel)) {
      setChannels(channels.filter((c) => c !== channel));
    } else {
      setChannels([...channels, channel]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {initialValues?.name ? 'Edit Alert Rule' : 'Create Alert Rule'}
        </CardTitle>
        <CardDescription>
          Set up automatic alerts for rate card changes and market conditions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="name">Rule Name *</Label>
            <Input id="name" {...register('name')} placeholder="e.g., Senior Developer Rate Spike Alert" />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Input id="description" {...register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ruleType">Alert Type *</Label>
              <select
                id="ruleType"
                {...register('ruleType')}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="price_threshold">Price Threshold</option>
                <option value="percentage_change">Percentage Change</option>
                <option value="rate_expiry">Rate Expiry</option>
                <option value="market_deviation">Market Deviation</option>
              </select>
            </div>

            <div>
              <Label htmlFor="targetEntity">Monitor *</Label>
              <select
                id="targetEntity"
                {...register('targetEntity')}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="supplier">Supplier</option>
                <option value="role">Role</option>
                <option value="location">Location</option>
                <option value="skill">Skill</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="comparisonOperator">Condition *</Label>
              <select
                id="comparisonOperator"
                {...register('comparisonOperator')}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="gt">Greater than (&gt;)</option>
                <option value="gte">Greater than or equal (≥)</option>
                <option value="lt">Less than (&lt;)</option>
                <option value="lte">Less than or equal (≤)</option>
                <option value="eq">Equal to (=)</option>
              </select>
            </div>

            <div>
              <Label htmlFor="thresholdValue">
                {ruleType === 'percentage_change' ? 'Percentage (%) *' : 'Value *'}
              </Label>
              <Input
                id="thresholdValue"
                type="number"
                {...register('thresholdValue', { valueAsNumber: true })}
              />
            </div>
          </div>

          {(ruleType === 'percentage_change' || ruleType === 'rate_expiry') && (
            <div>
              <Label htmlFor="timeWindow">
                {ruleType === 'percentage_change' ? 'Time Window (days)' : 'Days Before Expiry'}
              </Label>
              <Input
                id="timeWindow"
                type="number"
                {...register('timeWindow', { valueAsNumber: true })}
                placeholder="30"
              />
            </div>
          )}

          <div>
            <Label>Notification Channels *</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['email', 'in_app', 'slack', 'webhook'].map((channel) => (
                <Badge
                  key={channel}
                  variant={channels.includes(channel) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleChannel(channel)}
                >
                  {channel.replace('_', ' ').toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <Label>Email Recipients *</Label>
            <div className="space-y-2 mt-2">
              {recipients.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input value={email} disabled className="bg-gray-50" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRecipient(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addRecipient}>
                <Plus className="h-4 w-4 mr-1" />
                Add Recipient
              </Button>
              {recipients.length === 0 && (
                <p className="text-sm text-amber-600">At least one recipient is required</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : initialValues?.name ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
