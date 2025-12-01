'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  GitBranch,
  Save,
  Play,
  Settings,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  Bell,
  Mail,
  Shield,
  DollarSign,
  Edit2,
  Copy,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface ApprovalStep {
  id: string;
  name: string;
  description?: string;
  approverType: 'user' | 'role' | 'group';
  approvers: string[];
  approvalType: 'any' | 'all';
  slaHours: number;
  escalationEnabled: boolean;
  escalateTo?: string;
  order: number;
}

interface ContractWorkflow {
  id: string;
  contractId: string;
  workflowTemplateId?: string;
  name: string;
  description?: string;
  isActive: boolean;
  steps: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

// Available approvers (mock data - in production, fetch from API)
const availableApprovers = [
  { id: 'user-1', name: 'Sarah Johnson', role: 'Procurement Manager', email: 'sarah@company.com' },
  { id: 'user-2', name: 'Michael Chen', role: 'Legal Counsel', email: 'michael@company.com' },
  { id: 'user-3', name: 'Emily Davis', role: 'Finance Director', email: 'emily@company.com' },
  { id: 'user-4', name: 'John Smith', role: 'CFO', email: 'john@company.com' },
  { id: 'user-5', name: 'Lisa Wang', role: 'VP Operations', email: 'lisa@company.com' },
];

const approverRoles = [
  'Procurement Manager',
  'Legal Counsel',
  'Finance Director',
  'CFO',
  'VP Operations',
  'Department Head',
  'Contract Owner',
];

export default function ContractWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contract, setContract] = useState<any>(null);
  const [workflow, setWorkflow] = useState<ContractWorkflow | null>(null);
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  useEffect(() => {
    loadContractAndWorkflow();
  }, [contractId]);

  const loadContractAndWorkflow = async () => {
    setLoading(true);
    try {
      // Load contract details
      const contractRes = await fetch(`/api/contracts/${contractId}`, {
        headers: { 'x-tenant-id': 'demo' },
      });
      if (contractRes.ok) {
        const contractData = await contractRes.json();
        setContract(contractData);
      }

      // Try to load existing workflow for this contract
      const workflowRes = await fetch(`/api/contracts/${contractId}/workflow`, {
        headers: { 'x-tenant-id': 'demo' },
      });
      
      if (workflowRes.ok) {
        const workflowData = await workflowRes.json();
        if (workflowData.workflow) {
          setWorkflow(workflowData.workflow);
          setWorkflowName(workflowData.workflow.name);
          setWorkflowDescription(workflowData.workflow.description || '');
          setIsActive(workflowData.workflow.isActive);
          setSteps(workflowData.workflow.steps || []);
        }
      }

      // If no workflow exists, create a default one
      if (!workflow && steps.length === 0) {
        setWorkflowName(`Approval Workflow - ${contract?.contractTitle || 'Contract'}`);
        setSteps([
          {
            id: 'step-1',
            name: 'Initial Review',
            description: 'First level review and verification',
            approverType: 'role',
            approvers: ['Procurement Manager'],
            approvalType: 'any',
            slaHours: 24,
            escalationEnabled: true,
            escalateTo: 'Department Head',
            order: 1,
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to load contract workflow:', error);
      toast.error('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    const newStep: ApprovalStep = {
      id: `step-${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      description: '',
      approverType: 'role',
      approvers: [],
      approvalType: 'any',
      slaHours: 24,
      escalationEnabled: false,
      order: steps.length + 1,
    };
    setSteps([...steps, newStep]);
    setExpandedStep(newStep.id);
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const updateStep = (stepId: string, updates: Partial<ApprovalStep>) => {
    setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const index = steps.findIndex(s => s.id === stepId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) {
      return;
    }
    const newSteps = [...steps];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newSteps[index]!;
    newSteps[index] = newSteps[swapIndex]!;
    newSteps[swapIndex] = temp;
    setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const saveWorkflow = async () => {
    setSaving(true);
    try {
      const workflowData = {
        contractId,
        name: workflowName,
        description: workflowDescription,
        isActive,
        steps,
      };

      const res = await fetch(`/api/contracts/${contractId}/workflow`, {
        method: workflow?.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify(workflowData),
      });

      if (res.ok) {
        const data = await res.json();
        setWorkflow(data.workflow);
        toast.success('Workflow saved successfully');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const activateWorkflow = async () => {
    setIsActive(true);
    await saveWorkflow();
    toast.success('Workflow activated', {
      description: 'This workflow will now be used for approvals.',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-600">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-pink-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/contracts/${contractId}`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Contract
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-purple-600" />
                  Contract Workflow
                </h1>
                <p className="text-sm text-slate-500">
                  {contract?.contractTitle || 'Configure approval workflow for this contract'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={isActive ? 'default' : 'secondary'} className={isActive ? 'bg-green-100 text-green-700' : ''}>
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Button variant="outline" onClick={loadContractAndWorkflow}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload
              </Button>
              <Button 
                onClick={saveWorkflow} 
                disabled={saving}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Workflow
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Workflow Settings */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-500" />
                  Workflow Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workflow-name">Workflow Name</Label>
                  <Input
                    id="workflow-name"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="Enter workflow name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workflow-description">Description</Label>
                  <Textarea
                    id="workflow-description"
                    value={workflowDescription}
                    onChange={(e) => setWorkflowDescription(e.target.value)}
                    placeholder="Describe this workflow..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label>Active</Label>
                    <p className="text-sm text-slate-500">Enable this workflow</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </CardContent>
            </Card>

            {/* Contract Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-500" />
                  Contract Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm text-slate-500">Title</span>
                  <p className="font-medium">{contract?.contractTitle || contract?.fileName || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Supplier</span>
                  <p className="font-medium">{contract?.supplierName || 'Not specified'}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Value</span>
                  <p className="font-medium">${(contract?.totalValue || 0).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm text-slate-500">Status</span>
                  <Badge variant="outline" className="ml-2">{contract?.status || 'Unknown'}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Quick Templates
                </CardTitle>
                <CardDescription>Apply a pre-configured workflow</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    setSteps([
                      { id: 'step-1', name: 'Manager Approval', approverType: 'role', approvers: ['Procurement Manager'], approvalType: 'any', slaHours: 24, escalationEnabled: true, escalateTo: 'VP Operations', order: 1 },
                    ]);
                    setWorkflowName('Quick Approval');
                    toast.success('Template applied');
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                  Quick Approval (1 step)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    setSteps([
                      { id: 'step-1', name: 'Legal Review', approverType: 'role', approvers: ['Legal Counsel'], approvalType: 'any', slaHours: 48, escalationEnabled: true, escalateTo: 'VP Operations', order: 1 },
                      { id: 'step-2', name: 'Finance Approval', approverType: 'role', approvers: ['Finance Director'], approvalType: 'any', slaHours: 24, escalationEnabled: true, escalateTo: 'CFO', order: 2 },
                      { id: 'step-3', name: 'Executive Sign-off', approverType: 'role', approvers: ['CFO'], approvalType: 'any', slaHours: 24, escalationEnabled: false, order: 3 },
                    ]);
                    setWorkflowName('Standard Approval');
                    toast.success('Template applied');
                  }}
                >
                  <GitBranch className="w-4 h-4 mr-2 text-blue-600" />
                  Standard (3 steps)
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    setSteps([
                      { id: 'step-1', name: 'Procurement Review', approverType: 'role', approvers: ['Procurement Manager'], approvalType: 'any', slaHours: 24, escalationEnabled: true, escalateTo: 'VP Operations', order: 1 },
                      { id: 'step-2', name: 'Legal Review', approverType: 'role', approvers: ['Legal Counsel'], approvalType: 'any', slaHours: 48, escalationEnabled: true, escalateTo: 'VP Operations', order: 2 },
                      { id: 'step-3', name: 'Security Review', approverType: 'role', approvers: ['Security Officer'], approvalType: 'any', slaHours: 48, escalationEnabled: false, order: 3 },
                      { id: 'step-4', name: 'Finance Approval', approverType: 'role', approvers: ['Finance Director', 'CFO'], approvalType: 'any', slaHours: 24, escalationEnabled: true, escalateTo: 'CFO', order: 4 },
                      { id: 'step-5', name: 'Executive Approval', approverType: 'role', approvers: ['CFO', 'CEO'], approvalType: 'all', slaHours: 48, escalationEnabled: false, order: 5 },
                    ]);
                    setWorkflowName('Comprehensive Review');
                    toast.success('Template applied');
                  }}
                >
                  <Shield className="w-4 h-4 mr-2 text-purple-600" />
                  Comprehensive (5 steps)
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Workflow Steps */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-slate-500" />
                      Approval Steps
                    </CardTitle>
                    <CardDescription>Define the approval chain for this contract</CardDescription>
                  </div>
                  <Button onClick={addStep} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Step
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {steps.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                    <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-700 mb-2">No approval steps defined</h3>
                    <p className="text-slate-500 mb-4">Add steps to create your approval workflow</p>
                    <Button onClick={addStep}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Step
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {steps.map((step, index) => (
                      <motion.div
                        key={step.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-slate-200 rounded-lg overflow-hidden"
                      >
                        {/* Step Header */}
                        <div 
                          className="flex items-center gap-3 p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                        >
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'up'); }}
                              disabled={index === 0}
                              className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); moveStep(step.id, 'down'); }}
                              disabled={index === steps.length - 1}
                              className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                            {step.order}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900">{step.name}</h4>
                            <p className="text-sm text-slate-500">
                              {step.approvers.length > 0 ? step.approvers.join(', ') : 'No approvers assigned'}
                              {step.slaHours && ` • ${step.slaHours}h SLA`}
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">{step.approvalType}</Badge>
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                            className="p-2 hover:bg-red-100 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronDown className={`w-5 h-5 transition-transform ${expandedStep === step.id ? 'rotate-180' : ''}`} />
                        </div>

                        {/* Expanded Step Details */}
                        {expandedStep === step.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="p-4 border-t border-slate-200 space-y-4"
                          >
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Step Name</Label>
                                <Input
                                  value={step.name}
                                  onChange={(e) => updateStep(step.id, { name: e.target.value })}
                                  placeholder="Step name"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Approver Type</Label>
                                <Select
                                  value={step.approverType}
                                  onValueChange={(value: 'user' | 'role' | 'group') => updateStep(step.id, { approverType: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="role">By Role</SelectItem>
                                    <SelectItem value="user">Specific User</SelectItem>
                                    <SelectItem value="group">User Group</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                value={step.description || ''}
                                onChange={(e) => updateStep(step.id, { description: e.target.value })}
                                placeholder="Describe what this step involves..."
                                rows={2}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Approvers</Label>
                              <Select
                                value={step.approvers[0] || ''}
                                onValueChange={(value) => updateStep(step.id, { approvers: [value] })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select approver" />
                                </SelectTrigger>
                                <SelectContent>
                                  {step.approverType === 'role' ? (
                                    approverRoles.map(role => (
                                      <SelectItem key={role} value={role}>{role}</SelectItem>
                                    ))
                                  ) : (
                                    availableApprovers.map(user => (
                                      <SelectItem key={user.id} value={user.name}>{user.name} - {user.role}</SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Approval Type</Label>
                                <Select
                                  value={step.approvalType}
                                  onValueChange={(value: 'any' | 'all') => updateStep(step.id, { approvalType: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="any">Any Approver</SelectItem>
                                    <SelectItem value="all">All Approvers</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>SLA (hours)</Label>
                                <Input
                                  type="number"
                                  value={step.slaHours}
                                  onChange={(e) => updateStep(step.id, { slaHours: parseInt(e.target.value) || 24 })}
                                  min={1}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-medium">Escalation</span>
                              </div>
                              <Switch
                                checked={step.escalationEnabled}
                                onCheckedChange={(checked) => updateStep(step.id, { escalationEnabled: checked })}
                              />
                            </div>

                            {step.escalationEnabled && (
                              <div className="space-y-2 pl-6">
                                <Label>Escalate to</Label>
                                <Select
                                  value={step.escalateTo || ''}
                                  onValueChange={(value) => updateStep(step.id, { escalateTo: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select escalation target" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {approverRoles.map(role => (
                                      <SelectItem key={role} value={role}>{role}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </motion.div>
                    ))}

                    {/* Workflow Flow Visualization */}
                    <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                      <h4 className="text-sm font-medium text-slate-700 mb-3">Workflow Flow</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        {steps.map((step, index) => (
                          <React.Fragment key={step.id}>
                            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
                              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                                {index + 1}
                              </div>
                              <span className="text-sm font-medium">{step.name}</span>
                            </div>
                            {index < steps.length - 1 && (
                              <ChevronDown className="w-4 h-4 text-slate-400 rotate-[-90deg]" />
                            )}
                          </React.Fragment>
                        ))}
                        {steps.length > 0 && (
                          <>
                            <ChevronDown className="w-4 h-4 text-slate-400 rotate-[-90deg]" />
                            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-700">Approved</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <Link href={`/contracts/${contractId}`}>
                <Button variant="outline">Cancel</Button>
              </Link>
              {!isActive && steps.length > 0 && (
                <Button variant="outline" onClick={activateWorkflow} className="gap-2">
                  <Play className="w-4 h-4" />
                  Save & Activate
                </Button>
              )}
              <Button 
                onClick={saveWorkflow} 
                disabled={saving}
                className="bg-gradient-to-r from-purple-600 to-pink-600 gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Workflow
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
