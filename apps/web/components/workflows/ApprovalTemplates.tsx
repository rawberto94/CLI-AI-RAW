'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Copy, 
  Trash2, 
  Edit2, 
  Save,
  X,
  FileText,
  Users,
  Clock,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Layers,
  Building2,
  Briefcase,
  Receipt,
  Shield,
  Zap,
  ArrowRight,
  GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

// Types
export type TemplateCategory = 'vendor' | 'client' | 'internal' | 'compliance' | 'financial';

export interface ApprovalStep {
  id: string;
  name: string;
  role: string;
  order: number;
  isRequired: boolean;
  autoApproveBelow?: number;
  escalateAfterDays?: number;
  notifyOnAssign?: boolean;
  notifyOnDeadline?: boolean;
  allowDelegation?: boolean;
  allowSkip?: boolean;
  conditions?: StepCondition[];
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: string | number;
}

export interface ApprovalTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon?: string;
  isDefault?: boolean;
  isActive: boolean;
  steps: ApprovalStep[];
  defaultDeadlineDays: number;
  requireComments: boolean;
  requireAttachments: boolean;
  autoStart: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

// Default templates
export const DEFAULT_TEMPLATES: ApprovalTemplate[] = [
  {
    id: 'template-1',
    name: 'Standard Vendor Contract',
    description: 'Standard 3-step approval workflow for vendor contracts under $50,000',
    category: 'vendor',
    isDefault: true,
    isActive: true,
    steps: [
      {
        id: 'step-1',
        name: 'Department Review',
        role: 'department_manager',
        order: 1,
        isRequired: true,
        notifyOnAssign: true,
        notifyOnDeadline: true,
        allowDelegation: true,
        allowSkip: false
      },
      {
        id: 'step-2',
        name: 'Legal Review',
        role: 'legal_team',
        order: 2,
        isRequired: true,
        escalateAfterDays: 3,
        notifyOnAssign: true,
        notifyOnDeadline: true,
        allowDelegation: false,
        allowSkip: false
      },
      {
        id: 'step-3',
        name: 'Finance Approval',
        role: 'finance_manager',
        order: 3,
        isRequired: true,
        autoApproveBelow: 5000,
        notifyOnAssign: true,
        notifyOnDeadline: true,
        allowDelegation: true,
        allowSkip: false
      }
    ],
    defaultDeadlineDays: 7,
    requireComments: false,
    requireAttachments: false,
    autoStart: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    usageCount: 145
  },
  {
    id: 'template-2',
    name: 'High-Value Contract',
    description: 'Extended approval workflow for contracts over $50,000 with executive sign-off',
    category: 'vendor',
    isDefault: false,
    isActive: true,
    steps: [
      {
        id: 'step-1',
        name: 'Department Review',
        role: 'department_manager',
        order: 1,
        isRequired: true,
        notifyOnAssign: true,
        allowDelegation: true
      },
      {
        id: 'step-2',
        name: 'Legal Review',
        role: 'legal_team',
        order: 2,
        isRequired: true,
        escalateAfterDays: 5,
        notifyOnAssign: true
      },
      {
        id: 'step-3',
        name: 'Finance Review',
        role: 'finance_director',
        order: 3,
        isRequired: true,
        notifyOnAssign: true
      },
      {
        id: 'step-4',
        name: 'Executive Approval',
        role: 'executive',
        order: 4,
        isRequired: true,
        notifyOnAssign: true,
        allowDelegation: false
      }
    ],
    defaultDeadlineDays: 14,
    requireComments: true,
    requireAttachments: true,
    autoStart: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-02-01'),
    usageCount: 32
  },
  {
    id: 'template-3',
    name: 'Quick Internal Approval',
    description: 'Streamlined single-step approval for internal requests',
    category: 'internal',
    isDefault: true,
    isActive: true,
    steps: [
      {
        id: 'step-1',
        name: 'Manager Approval',
        role: 'department_manager',
        order: 1,
        isRequired: true,
        autoApproveBelow: 1000,
        notifyOnAssign: true,
        allowDelegation: true,
        allowSkip: false
      }
    ],
    defaultDeadlineDays: 2,
    requireComments: false,
    requireAttachments: false,
    autoStart: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    usageCount: 523
  },
  {
    id: 'template-4',
    name: 'Compliance Review',
    description: 'Multi-department compliance workflow for regulated contracts',
    category: 'compliance',
    isDefault: true,
    isActive: true,
    steps: [
      {
        id: 'step-1',
        name: 'Compliance Check',
        role: 'compliance_officer',
        order: 1,
        isRequired: true,
        notifyOnAssign: true,
        allowDelegation: false
      },
      {
        id: 'step-2',
        name: 'Security Review',
        role: 'security_team',
        order: 2,
        isRequired: true,
        escalateAfterDays: 2,
        notifyOnAssign: true
      },
      {
        id: 'step-3',
        name: 'Legal Compliance',
        role: 'legal_team',
        order: 3,
        isRequired: true,
        notifyOnAssign: true
      },
      {
        id: 'step-4',
        name: 'Final Sign-off',
        role: 'compliance_director',
        order: 4,
        isRequired: true,
        notifyOnAssign: true,
        allowDelegation: false
      }
    ],
    defaultDeadlineDays: 10,
    requireComments: true,
    requireAttachments: true,
    autoStart: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-20'),
    usageCount: 67
  }
];

// Helper functions
const getCategoryIcon = (category: TemplateCategory) => {
  const icons = {
    vendor: Building2,
    client: Users,
    internal: Briefcase,
    compliance: Shield,
    financial: Receipt
  };
  return icons[category] || FileText;
};

const getCategoryColor = (category: TemplateCategory) => {
  const colors = {
    vendor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    client: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    internal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    compliance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    financial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  };
  return colors[category] || 'bg-gray-100 text-gray-700';
};

const getRoleLabel = (role: string) => {
  const roleLabels: Record<string, string> = {
    department_manager: 'Department Manager',
    legal_team: 'Legal Team',
    finance_manager: 'Finance Manager',
    finance_director: 'Finance Director',
    compliance_officer: 'Compliance Officer',
    security_team: 'Security Team',
    compliance_director: 'Compliance Director',
    executive: 'Executive',
    ceo: 'CEO',
    cfo: 'CFO'
  };
  return roleLabels[role] || role;
};

// Template Card Component
interface TemplateCardProps {
  template: ApprovalTemplate;
  onEdit?: (template: ApprovalTemplate) => void;
  onDuplicate?: (template: ApprovalTemplate) => void;
  onDelete?: (template: ApprovalTemplate) => void;
  onSelect?: (template: ApprovalTemplate) => void;
  selectable?: boolean;
  selected?: boolean;
  compact?: boolean;
}

export function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
  onSelect,
  selectable = false,
  selected = false,
  compact = false
}: TemplateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const CategoryIcon = getCategoryIcon(template.category);

  if (compact) {
    return (
      <Card 
        className={cn(
          'cursor-pointer transition-all hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/50',
          selected && 'ring-2 ring-primary border-primary',
          !template.isActive && 'opacity-60'
        )}
        onClick={() => onSelect?.(template)}
        role="option"
        aria-selected={selected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(template);
          }
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', getCategoryColor(template.category))} aria-hidden="true">
              <CategoryIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{template.name}</span>
                {template.isDefault && (
                  <Badge variant="outline" className="text-xs">Default</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {template.steps.length} steps • {template.defaultDeadlineDays} days
              </p>
            </div>
            {selected && (
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'transition-all',
      selected && 'ring-2 ring-primary border-primary',
      !template.isActive && 'opacity-60'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('p-2 rounded-lg', getCategoryColor(template.category))}>
              <CategoryIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                {template.isDefault && (
                  <Badge variant="outline" className="text-xs">Default</Badge>
                )}
                {!template.isActive && (
                  <Badge variant="secondary" className="text-xs">Inactive</Badge>
                )}
              </div>
              <CardDescription className="mt-1">
                {template.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Template actions">
            {onEdit && (
              <Button variant="ghost" size="icon" onClick={() => onEdit(template)} aria-label={`Edit ${template.name}`}>
                <Edit2 size={16} aria-hidden="true" />
              </Button>
            )}
            {onDuplicate && (
              <Button variant="ghost" size="icon" onClick={() => onDuplicate(template)} aria-label={`Duplicate ${template.name}`}>
                <Copy size={16} aria-hidden="true" />
              </Button>
            )}
            {onDelete && !template.isDefault && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(template)}
                aria-label={`Delete ${template.name}`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Layers size={14} />
            <span>{template.steps.length} steps</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock size={14} />
            <span>{template.defaultDeadlineDays} day deadline</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap size={14} />
            <span>{template.usageCount} uses</span>
          </div>
        </div>

        {/* Workflow preview */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <span>Workflow Steps</span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-2">
              {template.steps.map((step, index) => (
                <div 
                  key={step.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{step.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {getRoleLabel(step.role)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {step.isRequired && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="text-xs">Required</Badge>
                          </TooltipTrigger>
                          <TooltipContent>This step cannot be skipped</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {step.autoApproveBelow && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="secondary" className="text-xs">
                              Auto &lt;${step.autoApproveBelow.toLocaleString()}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Auto-approves for amounts below ${step.autoApproveBelow.toLocaleString()}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {index < template.steps.length - 1 && (
                    <ArrowRight size={14} className="text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Settings badges */}
        <div className="flex flex-wrap gap-2">
          {template.requireComments && (
            <Badge variant="outline" className="text-xs">
              Comments Required
            </Badge>
          )}
          {template.requireAttachments && (
            <Badge variant="outline" className="text-xs">
              Attachments Required
            </Badge>
          )}
          {template.autoStart && (
            <Badge variant="outline" className="text-xs">
              Auto-Start
            </Badge>
          )}
        </div>
      </CardContent>

      {selectable && (
        <CardFooter className="pt-4">
          <Button 
            className="w-full"
            variant={selected ? 'secondary' : 'default'}
            onClick={() => onSelect?.(template)}
          >
            {selected ? 'Selected' : 'Use This Template'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// Template Selector Component
interface TemplateSelectorProps {
  templates: ApprovalTemplate[];
  selectedId?: string;
  onSelect: (template: ApprovalTemplate) => void;
  showCreateOption?: boolean;
  onCreateNew?: () => void;
  filterCategory?: TemplateCategory;
  className?: string;
}

export function TemplateSelector({
  templates,
  selectedId,
  onSelect,
  showCreateOption = true,
  onCreateNew,
  filterCategory,
  className
}: TemplateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>(filterCategory || 'all');

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesCategory && t.isActive;
    });
  }, [templates, searchTerm, categoryFilter]);

  const categories: { value: TemplateCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All Categories' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'client', label: 'Client' },
    { value: 'internal', label: 'Internal' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'financial', label: 'Financial' }
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filters */}
      <div className="flex gap-2">
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as TemplateCategory | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {showCreateOption && (
          <Card 
            className="cursor-pointer border-dashed hover:border-primary/50 transition-colors"
            onClick={onCreateNew}
          >
            <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Plus className="h-8 w-8 mb-2" />
              <span className="font-medium">Create Custom Template</span>
              <span className="text-sm">Build a new workflow from scratch</span>
            </CardContent>
          </Card>
        )}
        
        {filteredTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            selectable
            selected={selectedId === template.id}
            onSelect={onSelect}
          />
        ))}
      </div>

      {filteredTemplates.length === 0 && !showCreateOption && (
        <div className="text-center py-8 text-muted-foreground">
          No templates found matching your criteria
        </div>
      )}
    </div>
  );
}

// Template Editor Component
interface TemplateEditorProps {
  template?: ApprovalTemplate;
  onSave: (template: ApprovalTemplate) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  isLoading = false
}: TemplateEditorProps) {
  const [formData, setFormData] = useState<Partial<ApprovalTemplate>>(
    template || {
      name: '',
      description: '',
      category: 'vendor',
      isActive: true,
      steps: [],
      defaultDeadlineDays: 7,
      requireComments: false,
      requireAttachments: false,
      autoStart: true
    }
  );

  const [steps, setSteps] = useState<ApprovalStep[]>(template?.steps || []);

  const handleAddStep = () => {
    const newStep: ApprovalStep = {
      id: `step-${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      role: 'department_manager',
      order: steps.length + 1,
      isRequired: true,
      notifyOnAssign: true,
      allowDelegation: true
    };
    setSteps([...steps, newStep]);
  };

  const handleUpdateStep = (index: number, updates: Partial<ApprovalStep>) => {
    const newSteps = [...steps];
    const existingStep = newSteps[index];
    if (existingStep) {
      newSteps[index] = { ...existingStep, ...updates };
      setSteps(newSteps);
    }
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const templateToSave: ApprovalTemplate = {
      id: template?.id || `template-${Date.now()}`,
      name: formData.name || '',
      description: formData.description || '',
      category: formData.category || 'vendor',
      isActive: formData.isActive ?? true,
      steps: steps.map((s, i) => ({ ...s, order: i + 1 })),
      defaultDeadlineDays: formData.defaultDeadlineDays || 7,
      requireComments: formData.requireComments ?? false,
      requireAttachments: formData.requireAttachments ?? false,
      autoStart: formData.autoStart ?? true,
      createdAt: template?.createdAt || new Date(),
      updatedAt: new Date(),
      usageCount: template?.usageCount || 0
    };
    onSave(templateToSave);
  };

  const roles = [
    { value: 'department_manager', label: 'Department Manager' },
    { value: 'legal_team', label: 'Legal Team' },
    { value: 'finance_manager', label: 'Finance Manager' },
    { value: 'finance_director', label: 'Finance Director' },
    { value: 'compliance_officer', label: 'Compliance Officer' },
    { value: 'security_team', label: 'Security Team' },
    { value: 'executive', label: 'Executive' },
    { value: 'ceo', label: 'CEO' },
    { value: 'cfo', label: 'CFO' }
  ];

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Standard Vendor Contract"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(v) => setFormData({ ...formData, category: v as TemplateCategory })}
          >
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vendor">Vendor</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe when to use this template..."
          rows={2}
        />
      </div>

      <Separator />

      {/* Workflow steps */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Workflow Steps</Label>
          <Button variant="outline" size="sm" onClick={handleAddStep}>
            <Plus size={14} className="mr-1" />
            Add Step
          </Button>
        </div>

        {steps.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No steps defined yet</p>
              <Button variant="link" size="sm" onClick={handleAddStep}>
                Add your first step
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <Card key={step.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="pt-2 cursor-move text-muted-foreground">
                      <GripVertical size={16} />
                    </div>
                    <div className="flex-1 grid gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Step Name</Label>
                        <Input
                          value={step.name}
                          onChange={(e) => handleUpdateStep(index, { name: e.target.value })}
                          placeholder="Step name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Assignee Role</Label>
                        <Select
                          value={step.role}
                          onValueChange={(v) => handleUpdateStep(index, { role: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(role => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Auto-approve below ($)</Label>
                        <Input
                          type="number"
                          value={step.autoApproveBelow || ''}
                          onChange={(e) => handleUpdateStep(index, { 
                            autoApproveBelow: e.target.value ? Number(e.target.value) : undefined 
                          })}
                          placeholder="No auto-approve"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveStep(index)}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                  
                  {/* Step options */}
                  <div className="flex flex-wrap gap-4 mt-3 ml-7">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`required-${step.id}`}
                        checked={step.isRequired}
                        onCheckedChange={(v) => handleUpdateStep(index, { isRequired: v })}
                      />
                      <Label htmlFor={`required-${step.id}`} className="text-sm">Required</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`notify-${step.id}`}
                        checked={step.notifyOnAssign}
                        onCheckedChange={(v) => handleUpdateStep(index, { notifyOnAssign: v })}
                      />
                      <Label htmlFor={`notify-${step.id}`} className="text-sm">Notify</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`delegate-${step.id}`}
                        checked={step.allowDelegation}
                        onCheckedChange={(v) => handleUpdateStep(index, { allowDelegation: v })}
                      />
                      <Label htmlFor={`delegate-${step.id}`} className="text-sm">Allow Delegation</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Settings */}
      <div className="space-y-4">
        <Label>Settings</Label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="deadline">Default Deadline (days)</Label>
            <Input
              id="deadline"
              type="number"
              value={formData.defaultDeadlineDays}
              onChange={(e) => setFormData({ ...formData, defaultDeadlineDays: Number(e.target.value) })}
              min={1}
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="comments">Require Comments</Label>
              <Switch
                id="comments"
                checked={formData.requireComments}
                onCheckedChange={(v) => setFormData({ ...formData, requireComments: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="attachments">Require Attachments</Label>
              <Switch
                id="attachments"
                checked={formData.requireAttachments}
                onCheckedChange={(v) => setFormData({ ...formData, requireAttachments: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="autostart">Auto-Start Workflow</Label>
              <Switch
                id="autostart"
                checked={formData.autoStart}
                onCheckedChange={(v) => setFormData({ ...formData, autoStart: v })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isLoading || !formData.name || steps.length === 0}>
          <Save size={16} className="mr-2" />
          {template ? 'Save Changes' : 'Create Template'}
        </Button>
      </div>
    </div>
  );
}

// Hook for managing templates
export function useApprovalTemplates() {
  const [templates, setTemplates] = useState<ApprovalTemplate[]>(DEFAULT_TEMPLATES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch templates from API on mount
  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/workflows/templates?action=list');
      if (!response.ok) throw new Error('Failed to fetch templates');
      
      const data = await response.json();
      if (data.templates && Array.isArray(data.templates)) {
        // Map backend templates to ApprovalTemplate format
        const mappedTemplates: ApprovalTemplate[] = data.templates.map((t: any, index: number) => ({
          id: t.key || `template-${index}`,
          name: t.name,
          description: t.description,
          category: mapTemplateKeyToCategory(t.key) as TemplateCategory,
          isDefault: t.key === 'standard',
          isActive: true,
          steps: t.steps.map((step: any, stepIndex: number) => ({
            id: `step-${stepIndex}`,
            name: step.name,
            role: step.assigneeRole || step.name.toLowerCase().replace(/\s+/g, '_'),
            order: stepIndex + 1,
            isRequired: step.required !== false,
            escalateAfterDays: step.timeoutHours ? Math.ceil(step.timeoutHours / 24) : undefined,
            notifyOnAssign: true,
            notifyOnDeadline: true,
            allowDelegation: true,
            allowSkip: false,
          })),
          defaultDeadlineDays: Math.ceil((t.totalDurationHours || 72) / 24),
          requireComments: false,
          requireAttachments: false,
          autoStart: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
        }));
        setTemplates(mappedTemplates);
      }
    } catch (err) {
      console.error('Failed to fetch workflow templates:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Keep DEFAULT_TEMPLATES as fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(async (template: ApprovalTemplate) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/workflows/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: template.name,
          description: template.description,
          templateKey: template.id,
          steps: template.steps.map(step => ({
            name: step.name,
            order: step.order,
            required: step.isRequired,
            assigneeRole: step.role,
            timeoutHours: (step.escalateAfterDays || 3) * 24,
          })),
        }),
      });
      if (!response.ok) throw new Error('Failed to create template');
      setTemplates(prev => [...prev, template]);
      return template;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTemplate = useCallback(async (template: ApprovalTemplate) => {
    setIsLoading(true);
    try {
      // In production, this would call an update API
      await new Promise(resolve => setTimeout(resolve, 500));
      setTemplates(prev => prev.map(t => t.id === template.id ? template : t));
      return template;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (templateId: string) => {
    setIsLoading(true);
    try {
      // In production, this would call a delete API
      await new Promise(resolve => setTimeout(resolve, 500));
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const duplicateTemplate = useCallback((template: ApprovalTemplate) => {
    const duplicate: ApprovalTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    };
    setTemplates(prev => [...prev, duplicate]);
    return duplicate;
  }, []);

  const refetch = useCallback(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    refetch,
  };
}

// Helper function to map template key to category
function mapTemplateKeyToCategory(key: string): string {
  const categoryMap: Record<string, TemplateCategory> = {
    standard: 'vendor',
    express: 'vendor',
    legal_review: 'compliance',
    executive: 'internal',
    amendment: 'client',
    nda_fast_track: 'vendor',
    vendor_onboarding: 'vendor',
    termination: 'internal',
    renewal_opt_out: 'client',
    risk_escalation: 'compliance',
    multi_party: 'client',
    procurement: 'vendor',
  };
  return categoryMap[key] || 'vendor';
}

export default TemplateSelector;
