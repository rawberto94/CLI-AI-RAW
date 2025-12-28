'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  Zap,
  GitBranch,
  RefreshCw,
  Shield,
  DollarSign,
  Clock,
  Users,
  FileText,
  Star,
  Search,
  Filter,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'procurement' | 'legal' | 'finance' | 'compliance' | 'hr' | 'general';
  icon: React.ElementType;
  color: string;
  steps: Array<{
    name: string;
    type: string;
    assigneeType: string;
    slaHours: number;
  }>;
  estimatedDuration: string;
  complexity: 'simple' | 'moderate' | 'complex';
  popular?: boolean;
  recommended?: boolean;
  usageCount?: number;
}

const templates: WorkflowTemplate[] = [
  {
    id: 'standard-approval',
    name: 'Standard Contract Approval',
    description: 'Multi-stage approval with Legal, Finance, and Management review',
    category: 'procurement',
    icon: CheckCircle,
    color: 'from-blue-500 to-indigo-600',
    steps: [
      { name: 'Legal Review', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 48 },
      { name: 'Finance Review', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 24 },
      { name: 'Management Approval', type: 'APPROVAL', assigneeType: 'USER', slaHours: 24 },
    ],
    estimatedDuration: '3-5 days',
    complexity: 'moderate',
    popular: true,
    usageCount: 156,
  },
  {
    id: 'quick-approval',
    name: 'Quick Approval',
    description: 'Single manager approval for low-value, low-risk contracts',
    category: 'procurement',
    icon: Zap,
    color: 'from-green-500 to-emerald-600',
    steps: [{ name: 'Manager Approval', type: 'APPROVAL', assigneeType: 'USER', slaHours: 24 }],
    estimatedDuration: '1 day',
    complexity: 'simple',
    recommended: true,
    usageCount: 243,
  },
  {
    id: 'comprehensive-review',
    name: 'Comprehensive Review',
    description: 'Full review with Legal, Security, Finance, Compliance, and Executive sign-off',
    category: 'legal',
    icon: Shield,
    color: 'from-purple-500 to-fuchsia-600',
    steps: [
      { name: 'Legal Review', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 48 },
      { name: 'Security Assessment', type: 'REVIEW', assigneeType: 'ROLE', slaHours: 24 },
      { name: 'Finance Review', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 24 },
      { name: 'Compliance Check', type: 'REVIEW', assigneeType: 'ROLE', slaHours: 24 },
      { name: 'Executive Approval', type: 'APPROVAL', assigneeType: 'USER', slaHours: 48 },
    ],
    estimatedDuration: '7-10 days',
    complexity: 'complex',
    usageCount: 67,
  },
  {
    id: 'renewal-workflow',
    name: 'Contract Renewal',
    description: 'Automated renewal review with performance evaluation and budget check',
    category: 'finance',
    icon: RefreshCw,
    color: 'from-amber-500 to-orange-600',
    steps: [
      { name: 'Performance Review', type: 'REVIEW', assigneeType: 'USER', slaHours: 24 },
      { name: 'Budget Verification', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 24 },
    ],
    estimatedDuration: '2-3 days',
    complexity: 'simple',
    popular: true,
    usageCount: 189,
  },
  {
    id: 'high-value-approval',
    name: 'High-Value Contract',
    description: 'Multi-tier approval for contracts above threshold with CFO sign-off',
    category: 'finance',
    icon: DollarSign,
    color: 'from-rose-500 to-pink-600',
    steps: [
      { name: 'Procurement Review', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 24 },
      { name: 'Legal Review', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 48 },
      { name: 'Finance Director', type: 'APPROVAL', assigneeType: 'USER', slaHours: 24 },
      { name: 'CFO Approval', type: 'APPROVAL', assigneeType: 'USER', slaHours: 48 },
    ],
    estimatedDuration: '5-7 days',
    complexity: 'complex',
    usageCount: 92,
  },
  {
    id: 'vendor-onboarding',
    name: 'Vendor Onboarding',
    description: 'Complete vendor verification and onboarding workflow',
    category: 'procurement',
    icon: Users,
    color: 'from-cyan-500 to-blue-600',
    steps: [
      { name: 'Documentation Check', type: 'REVIEW', assigneeType: 'USER', slaHours: 24 },
      { name: 'Compliance Screening', type: 'REVIEW', assigneeType: 'ROLE', slaHours: 48 },
      { name: 'Finance Approval', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 24 },
    ],
    estimatedDuration: '4-5 days',
    complexity: 'moderate',
    usageCount: 78,
  },
  {
    id: 'amendment-approval',
    name: 'Contract Amendment',
    description: 'Fast-track approval for contract amendments and addendums',
    category: 'legal',
    icon: FileText,
    color: 'from-indigo-500 to-violet-600',
    steps: [
      { name: 'Legal Review', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 24 },
      { name: 'Stakeholder Approval', type: 'APPROVAL', assigneeType: 'USER', slaHours: 24 },
    ],
    estimatedDuration: '2 days',
    complexity: 'simple',
    recommended: true,
    usageCount: 134,
  },
  {
    id: 'compliance-audit',
    name: 'Compliance Audit',
    description: 'Thorough compliance review for regulated industries',
    category: 'compliance',
    icon: Shield,
    color: 'from-teal-500 to-green-600',
    steps: [
      { name: 'Initial Screening', type: 'REVIEW', assigneeType: 'ROLE', slaHours: 24 },
      { name: 'Compliance Officer', type: 'APPROVAL', assigneeType: 'USER', slaHours: 48 },
      { name: 'Legal Review', type: 'APPROVAL', assigneeType: 'ROLE', slaHours: 48 },
      { name: 'Final Certification', type: 'APPROVAL', assigneeType: 'USER', slaHours: 24 },
    ],
    estimatedDuration: '6-8 days',
    complexity: 'complex',
    usageCount: 45,
  },
];

const categories = [
  { id: 'all', label: 'All Templates', icon: GitBranch },
  { id: 'procurement', label: 'Procurement', icon: CheckCircle },
  { id: 'legal', label: 'Legal', icon: Shield },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'compliance', label: 'Compliance', icon: FileText },
  { id: 'general', label: 'General', icon: Star },
];

interface WorkflowTemplatesGalleryProps {
  onSelectTemplate: (template: WorkflowTemplate) => void;
  className?: string;
}

export function WorkflowTemplatesGallery({
  onSelectTemplate,
  className,
}: WorkflowTemplatesGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePreview = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const handleUseTemplate = (template: WorkflowTemplate) => {
    onSelectTemplate(template);
    setPreviewOpen(false);
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'moderate':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'complex':
        return 'bg-rose-100 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Workflow Templates</h2>
          <p className="text-sm text-slate-600 mt-1">
            Choose from pre-built templates or create a custom workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 bg-indigo-50 text-indigo-700 border-indigo-200">
            <TrendingUp className="w-3 h-3" />
            {templates.length} templates
          </Badge>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                'gap-2 whitespace-nowrap',
                selectedCategory === category.id &&
                  'bg-gradient-to-r from-indigo-500 to-purple-600'
              )}
            >
              <category.icon className="w-4 h-4" />
              {category.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="group hover:shadow-2xl transition-all duration-300 cursor-pointer h-full flex flex-col hover:scale-[1.02] focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 dark:bg-slate-800 dark:border-slate-700 dark:hover:shadow-slate-900/50">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={cn(
                        'p-3 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform',
                        template.color
                      )}
                    >
                      <template.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                      {template.popular && (
                        <Badge className="bg-amber-500 text-white border-amber-600 text-xs">
                          <Star className="w-3 h-3 mr-1 fill-current" />
                          Popular
                        </Badge>
                      )}
                      {template.recommended && (
                        <Badge className="bg-indigo-500 text-white border-indigo-600 text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Recommended
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors dark:text-slate-100">
                    {template.name}
                  </CardTitle>
                  <CardDescription className="text-sm line-clamp-2">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <GitBranch className="w-4 h-4" />
                      <span>{template.steps.length} steps</span>
                      <span className="text-slate-400 dark:text-slate-600">•</span>
                      <Clock className="w-4 h-4" />
                      <span>{template.estimatedDuration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('text-xs capitalize', getComplexityColor(template.complexity))}
                      >
                        {template.complexity}
                      </Badge>
                      {template.usageCount && (
                        <Badge variant="secondary" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {template.usageCount} uses
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 pt-2">
                      {template.steps.slice(0, 3).map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span className="truncate">{step.name}</span>
                          <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1.5">
                            {step.type}
                          </Badge>
                        </div>
                      ))}
                      {template.steps.length > 3 && (
                        <div className="text-xs text-slate-500 pl-3.5">
                          +{template.steps.length - 3} more steps
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePreview(template)}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                      onClick={() => handleUseTemplate(template)}
                    >
                      Use Template
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No templates found</h3>
          <p className="text-sm text-slate-500">Try adjusting your search or filter</p>
        </div>
      )}

      {/* Preview Dialog */}
      {selectedTemplate && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <div className="flex items-center gap-4 mb-2">
                <div
                  className={cn(
                    'p-3 rounded-xl bg-gradient-to-br shadow-lg',
                    selectedTemplate.color
                  )}
                >
                  <selectedTemplate.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl">{selectedTemplate.name}</DialogTitle>
                  <DialogDescription>{selectedTemplate.description}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 my-6">
              <div className="flex items-center gap-4">
                <Badge
                  variant="outline"
                  className={cn('capitalize', getComplexityColor(selectedTemplate.complexity))}
                >
                  {selectedTemplate.complexity}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4" />
                  {selectedTemplate.estimatedDuration}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <GitBranch className="w-4 h-4" />
                  {selectedTemplate.steps.length} steps
                </div>
                {selectedTemplate.usageCount && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Users className="w-4 h-4" />
                    {selectedTemplate.usageCount} uses
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-sm text-slate-700 mb-3">Workflow Steps</h4>
                <div className="space-y-3">
                  {selectedTemplate.steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-slate-900">{step.name}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {step.assigneeType} • {step.slaHours}h SLA
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {step.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
              <Button
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                onClick={() => handleUseTemplate(selectedTemplate)}
              >
                Use This Template
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
