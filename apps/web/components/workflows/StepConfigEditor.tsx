'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Settings,
  Users,
  Clock,
  Bell,
  CheckCircle,
  AlertTriangle,
  Zap,
  Shield,
  Mail,
  MessageSquare,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepConfig {
  id: string;
  name: string;
  description?: string;
  stepType: 'APPROVAL' | 'REVIEW' | 'NOTIFICATION' | 'TASK';
  assigneeType: 'USER' | 'ROLE' | 'GROUP' | 'DEPARTMENT' | 'DYNAMIC';
  assignees: string[];
  approvalType?: 'any' | 'all' | 'majority';
  slaHours?: number;
  escalationEnabled: boolean;
  escalationAfterHours?: number;
  escalateTo?: string;
  allowReject: boolean;
  allowDelegate: boolean;
  requireComments: boolean;
  autoApproveConditions?: Array<{
    field: string;
    operator: string;
    value: string | number;
  }>;
  notifications: {
    onAssignment: boolean;
    onApproval: boolean;
    onRejection: boolean;
    onEscalation: boolean;
    reminderBeforeDeadline: number;
    channels: ('email' | 'inApp' | 'slack' | 'teams')[];
  };
}

interface StepConfigEditorProps {
  step: StepConfig;
  open: boolean;
  onClose: () => void;
  onSave: (step: StepConfig) => void;
}

// Sample data for assignees
const SAMPLE_USERS = [
  { id: 'user-1', name: 'John Smith', role: 'Legal Counsel', email: 'john@company.com' },
  { id: 'user-2', name: 'Sarah Johnson', role: 'Finance Manager', email: 'sarah@company.com' },
  { id: 'user-3', name: 'Mike Chen', role: 'Procurement Lead', email: 'mike@company.com' },
  { id: 'user-4', name: 'Lisa Wang', role: 'VP Operations', email: 'lisa@company.com' },
];

const SAMPLE_ROLES = [
  { id: 'role-legal', name: 'Legal Team', members: 5 },
  { id: 'role-finance', name: 'Finance Team', members: 8 },
  { id: 'role-procurement', name: 'Procurement Team', members: 12 },
  { id: 'role-executive', name: 'Executive Team', members: 3 },
];

const CONDITION_FIELDS = [
  { value: 'contractValue', label: 'Contract Value', type: 'number' },
  { value: 'contractType', label: 'Contract Type', type: 'string' },
  { value: 'department', label: 'Department', type: 'string' },
  { value: 'riskScore', label: 'Risk Score', type: 'number' },
];

export function StepConfigEditor({ step, open, onClose, onSave }: StepConfigEditorProps) {
  const [config, setConfig] = useState<StepConfig>(step);
  const [activeTab, setActiveTab] = useState('general');

  const updateConfig = (updates: Partial<StepConfig>) => {
    setConfig({ ...config, ...updates });
  };

  const toggleAssignee = (assigneeId: string) => {
    const assignees = config.assignees.includes(assigneeId)
      ? config.assignees.filter((id) => id !== assigneeId)
      : [...config.assignees, assigneeId];
    updateConfig({ assignees });
  };

  const addAutoApproveCondition = () => {
    const newCondition = {
      field: 'contractValue',
      operator: 'lessThan',
      value: 10000,
    };
    updateConfig({
      autoApproveConditions: [...(config.autoApproveConditions || []), newCondition],
    });
  };

  const removeAutoApproveCondition = (index: number) => {
    updateConfig({
      autoApproveConditions: config.autoApproveConditions?.filter((_, i) => i !== index),
    });
  };

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            Configure Approval Step
          </DialogTitle>
          <DialogDescription>
            Define the approval requirements, assignees, and automation rules for this step
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="assignees" className="gap-2">
              <Users className="w-4 h-4" />
              Assignees
            </TabsTrigger>
            <TabsTrigger value="automation" className="gap-2">
              <Zap className="w-4 h-4" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stepName">Step Name</Label>
                <Input
                  id="stepName"
                  value={config.name}
                  onChange={(e) => updateConfig({ name: e.target.value })}
                  placeholder="e.g., Legal Review"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={config.description || ''}
                  onChange={(e) => updateConfig({ description: e.target.value })}
                  placeholder="Describe what this step reviews..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stepType">Step Type</Label>
                  <Select
                    value={config.stepType}
                    onValueChange={(value: any) => updateConfig({ stepType: value })}
                  >
                    <SelectTrigger id="stepType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPROVAL">Approval</SelectItem>
                      <SelectItem value="REVIEW">Review</SelectItem>
                      <SelectItem value="NOTIFICATION">Notification</SelectItem>
                      <SelectItem value="TASK">Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.stepType === 'APPROVAL' && (
                  <div className="space-y-2">
                    <Label htmlFor="approvalType">Approval Type</Label>
                    <Select
                      value={config.approvalType || 'any'}
                      onValueChange={(value: any) => updateConfig({ approvalType: value })}
                    >
                      <SelectTrigger id="approvalType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any one can approve</SelectItem>
                        <SelectItem value="all">All must approve</SelectItem>
                        <SelectItem value="majority">Majority (50%+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <Label className="text-base font-semibold">Timing & SLA</Label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slaHours">SLA (hours)</Label>
                    <Input
                      id="slaHours"
                      type="number"
                      value={config.slaHours || 24}
                      onChange={(e) => updateConfig({ slaHours: parseInt(e.target.value) })}
                      min="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Escalation</Label>
                      <Switch
                        checked={config.escalationEnabled}
                        onCheckedChange={(checked) => updateConfig({ escalationEnabled: checked })}
                      />
                    </div>
                    {config.escalationEnabled && (
                      <Input
                        type="number"
                        placeholder="Escalate after (hours)"
                        value={config.escalationAfterHours || ''}
                        onChange={(e) =>
                          updateConfig({ escalationAfterHours: parseInt(e.target.value) })
                        }
                        min="1"
                      />
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-600" />
                  <Label className="text-base font-semibold">Permissions</Label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Rejection</Label>
                      <p className="text-xs text-slate-500">Approver can reject the request</p>
                    </div>
                    <Switch
                      checked={config.allowReject}
                      onCheckedChange={(checked) => updateConfig({ allowReject: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Delegation</Label>
                      <p className="text-xs text-slate-500">Approver can delegate to others</p>
                    </div>
                    <Switch
                      checked={config.allowDelegate}
                      onCheckedChange={(checked) => updateConfig({ allowDelegate: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Comments</Label>
                      <p className="text-xs text-slate-500">Force approver to add comments</p>
                    </div>
                    <Switch
                      checked={config.requireComments}
                      onCheckedChange={(checked) => updateConfig({ requireComments: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Assignees Tab */}
          <TabsContent value="assignees" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Assignee Type</Label>
                <Select
                  value={config.assigneeType}
                  onValueChange={(value: any) => updateConfig({ assigneeType: value, assignees: [] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">Specific Users</SelectItem>
                    <SelectItem value="ROLE">By Role</SelectItem>
                    <SelectItem value="GROUP">Group</SelectItem>
                    <SelectItem value="DEPARTMENT">Department</SelectItem>
                    <SelectItem value="DYNAMIC">Dynamic (Runtime)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.assigneeType === 'USER' && (
                <div className="space-y-3">
                  <Label>Select Users</Label>
                  <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg max-h-96 overflow-y-auto">
                    {SAMPLE_USERS.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => toggleAssignee(user.id)}
                        className={cn(
                          'flex flex-col gap-1 p-3 rounded-lg text-left transition-all duration-200 border-2',
                          'hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
                          config.assignees.includes(user.id)
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-indigo-300 dark:border-purple-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm'
                        )}
                        aria-pressed={config.assignees.includes(user.id)}
                        aria-label={`Select ${user.name} as assignee`}
                      >
                        <div className="font-medium text-sm dark:text-slate-100">{user.name}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">{user.role}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-500">{user.email}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {config.assigneeType === 'ROLE' && (
                <div className="space-y-3">
                  <Label>Select Roles</Label>
                  <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                    {SAMPLE_ROLES.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => toggleAssignee(role.id)}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg text-left transition-all duration-200 border-2',
                          'hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
                          config.assignees.includes(role.id)
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-indigo-300 dark:border-purple-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm'
                        )}
                        aria-pressed={config.assignees.includes(role.id)}
                        aria-label={`Select ${role.name} role`}
                      >
                        <div>
                          <div className="font-medium text-sm dark:text-slate-100">{role.name}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">{role.members} members</div>
                        </div>
                        {config.assignees.includes(role.id) && (
                          <CheckCircle className="w-5 h-5 text-purple-600 dark:text-indigo-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {config.assigneeType === 'DYNAMIC' && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <div className="font-medium text-amber-900 dark:text-amber-200">Dynamic Assignment</div>
                      <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Assignees will be determined at runtime based on contract data and rules
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {config.assignees.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div className="font-medium text-green-900">
                      {config.assignees.length} assignee{config.assignees.length > 1 ? 's' : ''} selected
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Auto-Approve Conditions</Label>
                  <p className="text-xs text-slate-500 mt-1">
                    Automatically approve when conditions are met
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={addAutoApproveCondition}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Condition
                </Button>
              </div>

              {config.autoApproveConditions && config.autoApproveConditions.length > 0 ? (
                <div className="space-y-3">
                  {config.autoApproveConditions.map((condition, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 grid grid-cols-3 gap-3">
                            <Select
                              value={condition.field}
                              onValueChange={(value) => {
                                const updated = [...(config.autoApproveConditions || [])];
                                updated[index] = { ...condition, field: value };
                                updateConfig({ autoApproveConditions: updated });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Field" />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITION_FIELDS.map((field) => (
                                  <SelectItem key={field.value} value={field.value}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Select
                              value={condition.operator}
                              onValueChange={(value) => {
                                const updated = [...(config.autoApproveConditions || [])];
                                updated[index] = { ...condition, operator: value };
                                updateConfig({ autoApproveConditions: updated });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Operator" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="equals">Equals</SelectItem>
                                <SelectItem value="notEquals">Not Equals</SelectItem>
                                <SelectItem value="lessThan">Less Than</SelectItem>
                                <SelectItem value="greaterThan">Greater Than</SelectItem>
                                <SelectItem value="contains">Contains</SelectItem>
                              </SelectContent>
                            </Select>

                            <Input
                              value={condition.value}
                              onChange={(e) => {
                                const updated = [...(config.autoApproveConditions || [])];
                                updated[index] = { ...condition, value: e.target.value };
                                updateConfig({ autoApproveConditions: updated });
                              }}
                              placeholder="Value"
                            />
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeAutoApproveCondition(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                  <Zap className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <div>No auto-approve conditions set</div>
                  <div className="text-xs mt-1">This step will always require manual approval</div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base">Notification Events</Label>
                <p className="text-xs text-slate-500 mt-1">Choose when to send notifications</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-slate-600" />
                    <div>
                      <Label>On Assignment</Label>
                      <p className="text-xs text-slate-500">When task is assigned to approver</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.notifications.onAssignment}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        notifications: { ...config.notifications, onAssignment: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <Label>On Approval</Label>
                      <p className="text-xs text-slate-500">When request is approved</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.notifications.onApproval}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        notifications: { ...config.notifications, onApproval: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <div>
                      <Label>On Rejection</Label>
                      <p className="text-xs text-slate-500">When request is rejected</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.notifications.onRejection}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        notifications: { ...config.notifications, onRejection: checked },
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <div>
                      <Label>On Escalation</Label>
                      <p className="text-xs text-slate-500">When task is escalated</p>
                    </div>
                  </div>
                  <Switch
                    checked={config.notifications.onEscalation}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        notifications: { ...config.notifications, onEscalation: checked },
                      })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Notification Channels</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'email', label: 'Email', icon: Mail },
                    { value: 'inApp', label: 'In-App', icon: Bell },
                    { value: 'slack', label: 'Slack', icon: MessageSquare },
                    { value: 'teams', label: 'Teams', icon: MessageSquare },
                  ].map((channel) => (
                    <button
                      key={channel.value}
                      onClick={() => {
                        const channels = config.notifications.channels.includes(channel.value as any)
                          ? config.notifications.channels.filter((c) => c !== channel.value)
                          : [...config.notifications.channels, channel.value as any];
                        updateConfig({
                          notifications: { ...config.notifications, channels },
                        });
                      }}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border-2 transition-all',
                        config.notifications.channels.includes(channel.value as any)
                          ? 'bg-purple-50 border-indigo-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <channel.icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{channel.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminder">Reminder Before Deadline (hours)</Label>
                <Input
                  id="reminder"
                  type="number"
                  value={config.notifications.reminderBeforeDeadline}
                  onChange={(e) =>
                    updateConfig({
                      notifications: {
                        ...config.notifications,
                        reminderBeforeDeadline: parseInt(e.target.value),
                      },
                    })
                  }
                  min="1"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-gradient-to-r from-purple-500 to-purple-600">
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
