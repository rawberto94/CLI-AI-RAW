'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Settings,
  Power,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// Framer Motion typing workaround
const MotionDiv = motion.div as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    layout?: boolean;
    className?: string;
    key?: string;
  }
>;

interface DelegationRule {
  id: string;
  name: string;
  delegateTo: {
    id: string;
    name: string;
    email: string;
  };
  triggerType: 'date_range' | 'always' | 'condition';
  startDate?: string;
  endDate?: string;
  approvalTypes: ('contract' | 'amendment' | 'renewal' | 'termination')[];
  priority: 'low' | 'medium' | 'high' | 'all';
  isActive: boolean;
  notifyOnDelegation: boolean;
  createdAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Mock team members
const mockTeamMembers: TeamMember[] = [
  { id: 'tm1', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'Legal Manager' },
  { id: 'tm2', name: 'Michael Chen', email: 'michael@company.com', role: 'Finance Director' },
  { id: 'tm3', name: 'Emily Davis', email: 'emily@company.com', role: 'Procurement Lead' },
  { id: 'tm4', name: 'James Wilson', email: 'james@company.com', role: 'Contract Analyst' },
];

// Mock delegation rules
const mockRules: DelegationRule[] = [
  {
    id: 'dr1',
    name: 'Vacation Coverage',
    delegateTo: mockTeamMembers[0]!,
    triggerType: 'date_range',
    startDate: '2024-03-15',
    endDate: '2024-03-25',
    approvalTypes: ['contract', 'amendment', 'renewal'],
    priority: 'all',
    isActive: true,
    notifyOnDelegation: true,
    createdAt: '2024-01-10',
  },
  {
    id: 'dr2',
    name: 'High Priority Backup',
    delegateTo: mockTeamMembers[1]!,
    triggerType: 'condition',
    approvalTypes: ['contract', 'termination'],
    priority: 'high',
    isActive: false,
    notifyOnDelegation: true,
    createdAt: '2024-01-05',
  },
];

interface DelegationRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DelegationRulesModal({ isOpen, onClose }: DelegationRulesModalProps) {
  const [rules, setRules] = useState<DelegationRule[]>(mockRules);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<DelegationRule | null>(null);
  const queryClient = useQueryClient();

  // New rule form state
  const [newRule, setNewRule] = useState<Partial<DelegationRule>>({
    name: '',
    triggerType: 'date_range',
    approvalTypes: [],
    priority: 'all',
    isActive: true,
    notifyOnDelegation: true,
  });

  const resetNewRule = () => {
    setNewRule({
      name: '',
      triggerType: 'date_range',
      approvalTypes: [],
      priority: 'all',
      isActive: true,
      notifyOnDelegation: true,
    });
    setIsAddingRule(false);
    setEditingRule(null);
  };

  // Save rule mutation
  const saveRuleMutation = useMutation({
    mutationFn: async (rule: Partial<DelegationRule>) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return rule;
    },
    onSuccess: (rule) => {
      if (editingRule) {
        setRules(prev => prev.map(r => r.id === editingRule.id ? { ...r, ...rule } as DelegationRule : r));
        toast.success('Delegation rule updated');
      } else {
        const newDelegationRule: DelegationRule = {
          ...rule,
          id: `dr${Date.now()}`,
          createdAt: new Date().toISOString(),
        } as DelegationRule;
        setRules(prev => [...prev, newDelegationRule]);
        toast.success('Delegation rule created');
      }
      resetNewRule();
      queryClient.invalidateQueries({ queryKey: ['delegation-rules'] });
    },
    onError: () => {
      toast.error('Failed to save delegation rule');
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      return ruleId;
    },
    onSuccess: (ruleId) => {
      setRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success('Delegation rule deleted');
    },
    onError: () => {
      toast.error('Failed to delete delegation rule');
    },
  });

  // Toggle rule mutation
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { ruleId, isActive };
    },
    onSuccess: ({ ruleId, isActive }) => {
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive } : r));
      toast.success(isActive ? 'Delegation rule enabled' : 'Delegation rule disabled');
    },
  });

  const handleSaveRule = () => {
    if (!newRule.name || !newRule.delegateTo) {
      toast.error('Please fill in all required fields');
      return;
    }
    saveRuleMutation.mutate(editingRule ? { ...editingRule, ...newRule } : newRule);
  };

  const handleEditRule = (rule: DelegationRule) => {
    setEditingRule(rule);
    setNewRule({
      name: rule.name,
      delegateTo: rule.delegateTo,
      triggerType: rule.triggerType,
      startDate: rule.startDate,
      endDate: rule.endDate,
      approvalTypes: rule.approvalTypes,
      priority: rule.priority,
      isActive: rule.isActive,
      notifyOnDelegation: rule.notifyOnDelegation,
    });
    setIsAddingRule(true);
  };

  const approvalTypeLabels: Record<string, string> = {
    contract: 'New Contracts',
    amendment: 'Amendments',
    renewal: 'Renewals',
    termination: 'Terminations',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            Delegation Rules
          </DialogTitle>
          <DialogDescription>
            Set up automatic delegation for approvals when you&apos;re unavailable
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {isAddingRule ? (
              <MotionDiv
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 py-4"
              >
                {/* Rule Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={newRule.name || ''}
                    onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Vacation Coverage"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Delegate To */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Delegate To
                  </label>
                  <Select
                    value={(newRule.delegateTo as TeamMember)?.id || ''}
                    onValueChange={(value) => {
                      const member = mockTeamMembers.find(m => m.id === value);
                      if (member) {
                        setNewRule(prev => ({ ...prev, delegateTo: member }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockTeamMembers.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium">{member.name}</div>
                              <div className="text-xs text-slate-500">{member.role}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Trigger Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    When to Delegate
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'date_range', label: 'Date Range', icon: Calendar },
                      { value: 'always', label: 'Always', icon: Clock },
                      { value: 'condition', label: 'By Condition', icon: Settings },
                    ].map(option => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => setNewRule(prev => ({ ...prev, triggerType: option.value as DelegationRule['triggerType'] }))}
                          className={cn(
                            "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
                            newRule.triggerType === option.value
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <Icon className={cn(
                            "w-5 h-5",
                            newRule.triggerType === option.value ? "text-blue-500" : "text-slate-400"
                          )} />
                          <span className={cn(
                            "text-sm font-medium",
                            newRule.triggerType === option.value ? "text-blue-700" : "text-slate-600"
                          )}>
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date Range (conditional) */}
                {newRule.triggerType === 'date_range' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={newRule.startDate || ''}
                        onChange={(e) => setNewRule(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={newRule.endDate || ''}
                        onChange={(e) => setNewRule(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Approval Types */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Approval Types
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(approvalTypeLabels).map(([value, label]) => {
                      const isSelected = newRule.approvalTypes?.includes(value as any);
                      return (
                        <button
                          key={value}
                          onClick={() => {
                            setNewRule(prev => ({
                              ...prev,
                              approvalTypes: isSelected
                                ? prev.approvalTypes?.filter(t => t !== value)
                                : [...(prev.approvalTypes || []), value as any],
                            }));
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                            isSelected
                              ? "bg-blue-100 text-blue-700 border-2 border-blue-500"
                              : "bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Priority Level
                  </label>
                  <Select
                    value={newRule.priority || 'all'}
                    onValueChange={(value) => setNewRule(prev => ({ ...prev, priority: value as DelegationRule['priority'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="high">High Priority Only</SelectItem>
                      <SelectItem value="medium">Medium & Above</SelectItem>
                      <SelectItem value="low">Low Priority Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notify on Delegation */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="font-medium text-slate-900">Notify on Delegation</div>
                    <div className="text-sm text-slate-500">
                      Send email notification when approvals are delegated
                    </div>
                  </div>
                  <Switch
                    checked={newRule.notifyOnDelegation}
                    onCheckedChange={(checked) => setNewRule(prev => ({ ...prev, notifyOnDelegation: checked }))}
                  />
                </div>
              </MotionDiv>
            ) : (
              <MotionDiv
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="py-4"
              >
                {rules.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-medium text-slate-900 mb-1">No Delegation Rules</h3>
                    <p className="text-slate-500 text-sm mb-4">
                      Create rules to automatically delegate approvals when you&apos;re unavailable
                    </p>
                    <Button onClick={() => setIsAddingRule(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Rule
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map(rule => (
                      <div
                        key={rule.id}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all",
                          rule.isActive
                            ? "border-green-200 bg-green-50/50"
                            : "border-slate-200 bg-white"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              rule.isActive ? "bg-green-100" : "bg-slate-100"
                            )}>
                              <UserPlus className={cn(
                                "w-5 h-5",
                                rule.isActive ? "text-green-600" : "text-slate-400"
                              )} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate-900">{rule.name}</h4>
                                {rule.isActive && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 mt-0.5">
                                Delegating to {rule.delegateTo.name}
                              </p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {rule.triggerType === 'date_range' && rule.startDate && rule.endDate && (
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {rule.startDate} to {rule.endDate}
                                  </span>
                                )}
                                {rule.triggerType === 'always' && (
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Always active
                                  </span>
                                )}
                                <span className="text-slate-300">•</span>
                                <span className="text-xs text-slate-500">
                                  {rule.approvalTypes.length === 0 
                                    ? 'All types' 
                                    : rule.approvalTypes.map(t => approvalTypeLabels[t]).join(', ')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={(checked) => toggleRuleMutation.mutate({ 
                                ruleId: rule.id, 
                                isActive: checked 
                              })}
                            />
                            <button
                              onClick={() => handleEditRule(rule)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </MotionDiv>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="border-t border-slate-200 pt-4">
          {isAddingRule ? (
            <>
              <Button variant="outline" onClick={resetNewRule}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveRule}
                disabled={saveRuleMutation.isPending}
              >
                {saveRuleMutation.isPending ? (
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => setIsAddingRule(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DelegationRulesModal;
