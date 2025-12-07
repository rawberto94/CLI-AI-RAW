'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Bell,
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  FileText,
  Users,
  Loader2,
  Settings,
  BellRing,
  CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface Reminder {
  id: string;
  contractId: string;
  contractName?: string;
  type: 'expiration' | 'renewal' | 'review' | 'custom';
  title: string;
  description?: string;
  dueDate: Date;
  reminderDate: Date;
  notifyBefore: number; // days before
  notifyVia: ('email' | 'in-app' | 'slack')[];
  recipients: string[];
  status: 'active' | 'completed' | 'snoozed' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  recurring?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    endDate?: Date;
  };
  createdAt: Date;
  createdBy: string;
}

interface ReminderFormData {
  type: Reminder['type'];
  title: string;
  description: string;
  dueDate: string;
  notifyBefore: number;
  notifyVia: Reminder['notifyVia'];
  recipients: string;
  priority: Reminder['priority'];
  recurringEnabled: boolean;
  recurringFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

// ============================================================================
// Component
// ============================================================================

interface ContractRemindersProps {
  contractId: string;
  contractName?: string;
  expirationDate?: Date;
  renewalDate?: Date;
}

export function ContractReminders({
  contractId,
  contractName,
  expirationDate,
  renewalDate,
}: ContractRemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [formData, setFormData] = useState<ReminderFormData>({
    type: 'custom',
    title: '',
    description: '',
    dueDate: '',
    notifyBefore: 7,
    notifyVia: ['in-app', 'email'],
    recipients: '',
    priority: 'medium',
    recurringEnabled: false,
    recurringFrequency: 'monthly',
  });

  // Load reminders
  useEffect(() => {
    loadReminders();
  }, [contractId]);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/reminders`);
      if (response.ok) {
        const data = await response.json();
        setReminders(data.data || []);
      } else {
        // Generate default reminders based on contract dates
        const defaultReminders: Reminder[] = [];
        
        if (expirationDate) {
          defaultReminders.push({
            id: 'exp-1',
            contractId,
            contractName,
            type: 'expiration',
            title: 'Contract Expiration',
            description: `Contract "${contractName}" expires on ${new Date(expirationDate).toLocaleDateString()}`,
            dueDate: new Date(expirationDate),
            reminderDate: new Date(new Date(expirationDate).getTime() - 30 * 24 * 60 * 60 * 1000),
            notifyBefore: 30,
            notifyVia: ['email', 'in-app'],
            recipients: [],
            status: 'active',
            priority: 'high',
            createdAt: new Date(),
            createdBy: 'System',
          });
        }

        if (renewalDate) {
          defaultReminders.push({
            id: 'ren-1',
            contractId,
            contractName,
            type: 'renewal',
            title: 'Contract Renewal Due',
            description: `Contract "${contractName}" renewal is due`,
            dueDate: new Date(renewalDate),
            reminderDate: new Date(new Date(renewalDate).getTime() - 14 * 24 * 60 * 60 * 1000),
            notifyBefore: 14,
            notifyVia: ['email', 'in-app'],
            recipients: [],
            status: 'active',
            priority: 'medium',
            createdAt: new Date(),
            createdBy: 'System',
          });
        }

        setReminders(defaultReminders);
      }
    } catch (error) {
      console.error('Failed to load reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReminder = async () => {
    try {
      const reminder: Partial<Reminder> = {
        contractId,
        contractName,
        type: formData.type,
        title: formData.title,
        description: formData.description,
        dueDate: new Date(formData.dueDate),
        reminderDate: new Date(new Date(formData.dueDate).getTime() - formData.notifyBefore * 24 * 60 * 60 * 1000),
        notifyBefore: formData.notifyBefore,
        notifyVia: formData.notifyVia,
        recipients: formData.recipients.split(',').map(r => r.trim()).filter(Boolean),
        status: 'active',
        priority: formData.priority,
        recurring: formData.recurringEnabled ? {
          enabled: true,
          frequency: formData.recurringFrequency,
        } : undefined,
        createdAt: new Date(),
        createdBy: 'Current User',
      };

      const response = await fetch(`/api/contracts/${contractId}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminder),
      });

      if (response.ok) {
        toast.success('Reminder created successfully');
        loadReminders();
        setShowCreateDialog(false);
        resetForm();
      } else {
        // Simulate success for demo
        const newReminder: Reminder = {
          ...(reminder as Omit<Reminder, 'id'>),
          id: `rem-${Date.now()}`,
        };
        setReminders(prev => [...prev, newReminder]);
        toast.success('Reminder created successfully');
        setShowCreateDialog(false);
        resetForm();
      }
    } catch (error) {
      console.error('Failed to create reminder:', error);
      toast.error('Failed to create reminder');
    }
  };

  const handleCompleteReminder = async (reminderId: string) => {
    setReminders(prev =>
      prev.map(r => r.id === reminderId ? { ...r, status: 'completed' as const } : r)
    );
    toast.success('Reminder marked as complete');
  };

  const handleDismissReminder = async (reminderId: string) => {
    setReminders(prev =>
      prev.map(r => r.id === reminderId ? { ...r, status: 'dismissed' as const } : r)
    );
    toast.success('Reminder dismissed');
  };

  const handleDeleteReminder = async (reminderId: string) => {
    setReminders(prev => prev.filter(r => r.id !== reminderId));
    toast.success('Reminder deleted');
  };

  const resetForm = () => {
    setFormData({
      type: 'custom',
      title: '',
      description: '',
      dueDate: '',
      notifyBefore: 7,
      notifyVia: ['in-app', 'email'],
      recipients: '',
      priority: 'medium',
      recurringEnabled: false,
      recurringFrequency: 'monthly',
    });
    setEditingReminder(null);
  };

  const getTypeIcon = (type: Reminder['type']) => {
    switch (type) {
      case 'expiration': return Calendar;
      case 'renewal': return CalendarClock;
      case 'review': return FileText;
      default: return Bell;
    }
  };

  const getTypeColor = (type: Reminder['type']) => {
    switch (type) {
      case 'expiration': return 'text-red-600 bg-red-50';
      case 'renewal': return 'text-blue-600 bg-blue-50';
      case 'review': return 'text-purple-600 bg-purple-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getPriorityColor = (priority: Reminder['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const activeReminders = reminders.filter(r => r.status === 'active');
  const upcomingReminders = activeReminders.filter(r => {
    const daysUntil = Math.ceil((new Date(r.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold">Reminders & Alerts</h3>
          {upcomingReminders.length > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              {upcomingReminders.length} upcoming
            </Badge>
          )}
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Add Reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Reminder</DialogTitle>
              <DialogDescription>
                Set up a reminder for this contract
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reminder Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as Reminder['type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expiration">Expiration</SelectItem>
                    <SelectItem value="renewal">Renewal</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter reminder title"
                />
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add details about this reminder"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notify Before (days)</Label>
                  <Select
                    value={formData.notifyBefore.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, notifyBefore: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">1 week</SelectItem>
                      <SelectItem value="14">2 weeks</SelectItem>
                      <SelectItem value="30">1 month</SelectItem>
                      <SelectItem value="60">2 months</SelectItem>
                      <SelectItem value="90">3 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as Reminder['priority'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notify Recipients (emails, comma-separated)</Label>
                <Input
                  value={formData.recipients}
                  onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
                  placeholder="john@example.com, jane@example.com"
                />
              </div>

              <div className="space-y-3">
                <Label>Notification Channels</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notifyVia.includes('in-app')}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          notifyVia: checked
                            ? [...prev.notifyVia, 'in-app']
                            : prev.notifyVia.filter(n => n !== 'in-app')
                        }));
                      }}
                      className="rounded"
                    />
                    <Bell className="h-4 w-4" />
                    <span className="text-sm">In-App</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notifyVia.includes('email')}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          notifyVia: checked
                            ? [...prev.notifyVia, 'email']
                            : prev.notifyVia.filter(n => n !== 'email')
                        }));
                      }}
                      className="rounded"
                    />
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.notifyVia.includes('slack')}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => ({
                          ...prev,
                          notifyVia: checked
                            ? [...prev.notifyVia, 'slack']
                            : prev.notifyVia.filter(n => n !== 'slack')
                        }));
                      }}
                      className="rounded"
                    />
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm">Slack</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium">Recurring Reminder</span>
                </div>
                <Switch
                  checked={formData.recurringEnabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, recurringEnabled: checked }))}
                />
              </div>

              {formData.recurringEnabled && (
                <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                  <Label>Repeat</Label>
                  <Select
                    value={formData.recurringFrequency}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      recurringFrequency: value as 'daily' | 'weekly' | 'monthly' | 'yearly' 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateReminder} disabled={!formData.title || !formData.dueDate}>
                Create Reminder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reminders List */}
      {reminders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Bell className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600">No reminders set</p>
            <p className="text-sm text-slate-500 mt-1">
              Create reminders to stay on top of important contract dates
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reminders
            .filter(r => r.status === 'active')
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .map((reminder) => {
              const Icon = getTypeIcon(reminder.type);
              const daysUntil = Math.ceil((new Date(reminder.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const isOverdue = daysUntil < 0;
              const isUrgent = daysUntil <= 7 && daysUntil >= 0;

              return (
                <Card 
                  key={reminder.id}
                  className={cn(
                    'transition-all',
                    isOverdue && 'border-red-200 bg-red-50/50',
                    isUrgent && !isOverdue && 'border-amber-200 bg-amber-50/50'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('p-2 rounded-lg', getTypeColor(reminder.type))}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{reminder.title}</h4>
                            <Badge 
                              variant="outline" 
                              className={cn('text-xs', getPriorityColor(reminder.priority))}
                            >
                              {reminder.priority}
                            </Badge>
                            {reminder.recurring?.enabled && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {reminder.recurring.frequency}
                              </Badge>
                            )}
                          </div>
                          {reminder.description && (
                            <p className="text-sm text-slate-600 mt-1">{reminder.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {new Date(reminder.dueDate).toLocaleDateString()}
                            </span>
                            <span className={cn(
                              'font-medium',
                              isOverdue && 'text-red-600',
                              isUrgent && !isOverdue && 'text-amber-600'
                            )}>
                              {isOverdue 
                                ? `${Math.abs(daysUntil)} days overdue`
                                : daysUntil === 0 
                                  ? 'Due today'
                                  : `${daysUntil} days left`
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:bg-green-50"
                          onClick={() => handleCompleteReminder(reminder.id)}
                          title="Mark complete"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:bg-slate-50"
                          onClick={() => handleDismissReminder(reminder.id)}
                          title="Dismiss"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:bg-red-50"
                          onClick={() => handleDeleteReminder(reminder.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

          {/* Completed/Dismissed section */}
          {reminders.filter(r => r.status !== 'active').length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
                {reminders.filter(r => r.status !== 'active').length} completed/dismissed reminders
              </summary>
              <div className="mt-2 space-y-2 pl-4 border-l-2 border-slate-200">
                {reminders
                  .filter(r => r.status !== 'active')
                  .map(reminder => (
                    <div 
                      key={reminder.id}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm"
                    >
                      <span className="line-through text-slate-400">{reminder.title}</span>
                      <Badge variant="secondary" className="text-xs">
                        {reminder.status}
                      </Badge>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default ContractReminders;
