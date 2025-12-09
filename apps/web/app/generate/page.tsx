'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  Edit3,
  Copy,
  Trash2,
  MoreHorizontal,
  ArrowRight,
  Sparkles,
  RefreshCw,
  FileSignature,
  GitBranch,
  Calendar,
  DollarSign,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageBreadcrumb } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import type { ContractDraft, DraftStatus, TemplateCategory, Template } from '@/types/contract-generation';

// ====================
// STATUS CONFIGURATION
// ====================

const statusConfig: Record<DraftStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: <Edit3 className="h-3 w-3" /> },
  IN_REVIEW: { label: 'In Review', color: 'bg-blue-100 text-blue-700', icon: <Eye className="h-3 w-3" /> },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3 w-3" /> },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-3 w-3" /> },
  PENDING_SIGNATURE: { label: 'Pending Signature', color: 'bg-purple-100 text-purple-700', icon: <FileSignature className="h-3 w-3" /> },
  EXECUTED: { label: 'Executed', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: <Trash2 className="h-3 w-3" /> },
  ARCHIVED: { label: 'Archived', color: 'bg-slate-100 text-slate-600', icon: <Clock className="h-3 w-3" /> },
};

const categoryLabels: Record<TemplateCategory, string> = {
  MSA: 'Master Service Agreement',
  SOW: 'Statement of Work',
  NDA: 'Non-Disclosure Agreement',
  AMENDMENT: 'Amendment',
  RENEWAL: 'Renewal',
  ORDER_FORM: 'Order Form',
  SLA: 'Service Level Agreement',
  DPA: 'Data Processing Agreement',
  SUBCONTRACT: 'Subcontractor Agreement',
  CONSULTING: 'Consulting Agreement',
  LICENSE: 'License Agreement',
  OTHER: 'Other',
};

// ====================
// MOCK DATA
// ====================

const mockDrafts: ContractDraft[] = [
  {
    id: '1',
    tenantId: 'demo',
    title: 'Accenture Consulting MSA 2025',
    type: 'MSA',
    description: 'Master Service Agreement for consulting services',
    sourceType: 'TEMPLATE',
    templateId: 't1',
    status: 'IN_REVIEW',
    version: 3,
    content: { sections: [] },
    variables: {},
    isLocked: false,
    currency: 'USD',
    estimatedValue: 2500000,
    proposedStartDate: new Date('2025-02-01'),
    proposedEndDate: new Date('2027-01-31'),
    createdBy: 'user1',
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-01-15'),
    externalParties: [{ name: 'Accenture', type: 'SUPPLIER', signatories: [] }],
  },
  {
    id: '2',
    tenantId: 'demo',
    title: 'Deloitte SOW - Digital Transformation',
    type: 'SOW',
    description: 'Statement of Work for digital transformation project',
    sourceType: 'TEMPLATE',
    templateId: 't2',
    status: 'PENDING_APPROVAL',
    version: 5,
    content: { sections: [] },
    variables: {},
    isLocked: true,
    lockedBy: 'approver1',
    currency: 'USD',
    estimatedValue: 850000,
    proposedStartDate: new Date('2025-03-01'),
    proposedEndDate: new Date('2025-08-31'),
    createdBy: 'user2',
    createdAt: new Date('2025-01-08'),
    updatedAt: new Date('2025-01-14'),
    externalParties: [{ name: 'Deloitte', type: 'SUPPLIER', signatories: [] }],
  },
  {
    id: '3',
    tenantId: 'demo',
    title: 'TCS NDA - Project Phoenix',
    type: 'NDA',
    description: 'Mutual NDA for Project Phoenix discussions',
    sourceType: 'TEMPLATE',
    status: 'DRAFT',
    version: 1,
    content: { sections: [] },
    variables: {},
    isLocked: false,
    currency: 'USD',
    createdBy: 'user1',
    createdAt: new Date('2025-01-14'),
    updatedAt: new Date('2025-01-14'),
    externalParties: [{ name: 'TCS', type: 'SUPPLIER', signatories: [] }],
  },
  {
    id: '4',
    tenantId: 'demo',
    title: 'Infosys Amendment #3 - Rate Revision',
    type: 'AMENDMENT',
    description: 'Rate card amendment for existing MSA',
    sourceType: 'AMENDMENT',
    sourceContractId: 'c1',
    status: 'APPROVED',
    version: 2,
    content: { sections: [] },
    variables: {},
    isLocked: false,
    currency: 'CHF',
    estimatedValue: 150000,
    createdBy: 'user3',
    createdAt: new Date('2025-01-05'),
    updatedAt: new Date('2025-01-12'),
    approvedAt: new Date('2025-01-12'),
    externalParties: [{ name: 'Infosys', type: 'SUPPLIER', signatories: [] }],
  },
  {
    id: '5',
    tenantId: 'demo',
    title: 'Cognizant MSA Renewal 2025',
    type: 'RENEWAL',
    description: 'Annual renewal for existing master agreement',
    sourceType: 'RENEWAL',
    sourceContractId: 'c2',
    status: 'PENDING_SIGNATURE',
    version: 4,
    content: { sections: [] },
    variables: {},
    isLocked: true,
    currency: 'EUR',
    estimatedValue: 3200000,
    proposedStartDate: new Date('2025-04-01'),
    proposedEndDate: new Date('2028-03-31'),
    createdBy: 'user1',
    createdAt: new Date('2025-01-02'),
    updatedAt: new Date('2025-01-13'),
    submittedAt: new Date('2025-01-10'),
    externalParties: [{ name: 'Cognizant', type: 'SUPPLIER', signatories: [] }],
  },
];

const mockTemplates: Template[] = [
  {
    id: 't1',
    tenantId: 'demo',
    name: 'Standard MSA',
    description: 'Master Service Agreement template for consulting services',
    category: 'MSA',
    content: { sections: [] },
    variables: [],
    defaultClauses: [],
    version: 2,
    isActive: true,
    isPublic: false,
    usageCount: 45,
    estimatedTime: 30,
    createdBy: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-15'),
    complexity: 'moderate',
    tags: ['consulting', 'services', 'standard'],
  },
  {
    id: 't2',
    tenantId: 'demo',
    name: 'Project SOW',
    description: 'Statement of Work for project-based engagements',
    category: 'SOW',
    content: { sections: [] },
    variables: [],
    defaultClauses: [],
    version: 3,
    isActive: true,
    isPublic: false,
    usageCount: 78,
    estimatedTime: 20,
    createdBy: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-08-20'),
    complexity: 'simple',
    tags: ['project', 'deliverables'],
  },
  {
    id: 't3',
    tenantId: 'demo',
    name: 'Mutual NDA',
    description: 'Standard mutual non-disclosure agreement',
    category: 'NDA',
    content: { sections: [] },
    variables: [],
    defaultClauses: [],
    version: 1,
    isActive: true,
    isPublic: false,
    usageCount: 156,
    estimatedTime: 10,
    createdBy: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-03-10'),
    complexity: 'simple',
    tags: ['confidentiality', 'mutual'],
  },
];

// ====================
// COMPONENTS
// ====================

function QuickStats() {
  const stats = [
    { label: 'Active Drafts', value: 12, change: '+3 this week', icon: FileText, color: 'text-blue-600' },
    { label: 'Pending Approval', value: 5, change: '2 urgent', icon: Clock, color: 'text-amber-600' },
    { label: 'Avg. Cycle Time', value: '4.2d', change: '-12% vs last month', icon: Zap, color: 'text-green-600' },
    { label: 'This Month Value', value: '$6.7M', change: '23 contracts', icon: DollarSign, color: 'text-purple-600' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </CardTitle>
            <stat.icon className={cn('h-4 w-4', stat.color)} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.change}</p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20" 
               style={{ color: stat.color.replace('text-', '').replace('-600', '') }} />
        </Card>
      ))}
    </div>
  );
}

function CreateContractCard({ onSelect }: { onSelect: (type: 'new' | 'template' | 'renewal' | 'amendment') => void }) {
  const options = [
    {
      id: 'new',
      title: 'Blank Contract',
      description: 'Start from scratch with a blank document',
      icon: FileText,
      gradient: 'from-gray-500 to-gray-600',
    },
    {
      id: 'template',
      title: 'From Template',
      description: 'Use a pre-approved template',
      icon: Copy,
      gradient: 'from-blue-500 to-indigo-600',
    },
    {
      id: 'renewal',
      title: 'Contract Renewal',
      description: 'Renew an existing contract',
      icon: RefreshCw,
      gradient: 'from-green-500 to-emerald-600',
    },
    {
      id: 'amendment',
      title: 'Amendment',
      description: 'Create an amendment to existing contract',
      icon: GitBranch,
      gradient: 'from-purple-500 to-violet-600',
    },
  ];

  return (
    <Card className="border-dashed border-2 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Create New Contract
        </CardTitle>
        <CardDescription>
          Choose how you want to start your new contract
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {options.map((option) => (
            <motion.button
              key={option.id}
              onClick={() => onSelect(option.id as 'new' | 'template' | 'renewal' | 'amendment')}
              className={cn(
                'relative overflow-hidden rounded-lg border p-4 text-left transition-all',
                'hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50',
                'bg-white dark:bg-slate-800'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white mb-3',
                option.gradient
              )}>
                <option.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm">{option.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
              <ArrowRight className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DraftCard({ draft }: { draft: ContractDraft }) {
  const status = statusConfig[draft.status];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
    >
      <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-base font-semibold truncate pr-2">
                {draft.title}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-normal">
                  {categoryLabels[draft.type]}
                </Badge>
                {draft.sourceType === 'RENEWAL' && (
                  <Badge variant="secondary" className="font-normal">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Renewal
                  </Badge>
                )}
                {draft.sourceType === 'AMENDMENT' && (
                  <Badge variant="secondary" className="font-normal">
                    <GitBranch className="h-3 w-3 mr-1" />
                    Amendment
                  </Badge>
                )}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Send className="h-4 w-4 mr-2" />
                  Submit for Approval
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Party */}
          {draft.externalParties?.[0] && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{draft.externalParties[0].name}</span>
            </div>
          )}
          
          {/* Value & Dates */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {draft.estimatedValue && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                <span>{new Intl.NumberFormat('en-US', { 
                  style: 'currency', 
                  currency: draft.currency,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(draft.estimatedValue)}</span>
              </div>
            )}
            {draft.proposedEndDate && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{new Date(draft.proposedEndDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          
          {/* Status & Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge className={cn('gap-1', status.color)}>
                {status.icon}
                {status.label}
              </Badge>
              <span className="text-xs text-muted-foreground">v{draft.version}</span>
            </div>
            
            {(draft.status === 'IN_REVIEW' || draft.status === 'PENDING_APPROVAL') && (
              <Progress value={draft.status === 'IN_REVIEW' ? 45 : 75} className="h-1" />
            )}
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
            <span>Updated {formatRelativeTime(draft.updatedAt)}</span>
            {draft.isLocked && (
              <Badge variant="outline" className="text-xs">
                Locked
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TemplateCard({ template, onSelect }: { template: Template; onSelect: (t: Template) => void }) {
  return (
    <motion.button
      onClick={() => onSelect(template)}
      className="text-left w-full"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <Badge variant="outline" className="text-xs">
              {categoryLabels[template.category]}
            </Badge>
            {template.complexity && (
              <Badge variant={template.complexity === 'simple' ? 'secondary' : 'default'} className="text-xs">
                {template.complexity}
              </Badge>
            )}
          </div>
          <CardTitle className="text-base mt-2">{template.name}</CardTitle>
          <CardDescription className="text-xs line-clamp-2">
            {template.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{template.estimatedTime} min
            </span>
            <span>{template.usageCount} uses</span>
          </div>
        </CardContent>
      </Card>
    </motion.button>
  );
}

function AIAssistantBanner() {
  return (
    <Card className="bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border-violet-200 dark:border-violet-800">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">AI Contract Assistant</h3>
          <p className="text-sm text-muted-foreground">
            Get AI-powered suggestions for clauses, risk analysis, and negotiation strategies
          </p>
        </div>
        <Button variant="outline" className="shrink-0">
          Try AI Assistant
        </Button>
      </CardContent>
    </Card>
  );
}

// ====================
// HELPER FUNCTIONS
// ====================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(date).toLocaleDateString();
}

// ====================
// MAIN PAGE COMPONENT
// ====================

export default function ContractGenerationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('drafts');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [createType, setCreateType] = useState<'new' | 'template' | 'renewal' | 'amendment' | null>(null);

  const handleCreateSelect = useCallback((type: 'new' | 'template' | 'renewal' | 'amendment') => {
    setCreateType(type);
    if (type === 'template') {
      setShowTemplateDialog(true);
    }
    // Handle other types...
  }, []);

  const handleTemplateSelect = useCallback((template: Template) => {
    // Template selected for generation
    setShowTemplateDialog(false);
    // Navigate to draft editor with template
  }, []);

  const filteredDrafts = mockDrafts.filter(draft => 
    draft.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    draft.externalParties?.[0]?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageBreadcrumb />
      
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contract Generation</h1>
          <p className="text-muted-foreground">
            Create, manage, and track contract drafts through the approval workflow
          </p>
        </div>
        <Button size="lg" className="gap-2">
          <Plus className="h-4 w-4" />
          New Contract
        </Button>
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* AI Assistant Banner */}
      <AIAssistantBanner />

      {/* Create Contract Options */}
      <CreateContractCard onSelect={handleCreateSelect} />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="drafts" className="gap-2">
              <FileText className="h-4 w-4" />
              My Drafts
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending Approval
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Copy className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search drafts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="drafts" className="space-y-4">
          <div className={cn(
            'grid gap-4',
            viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'
          )}>
            <AnimatePresence mode="popLayout">
              {filteredDrafts.map((draft) => (
                <DraftCard key={draft.id} draft={draft} />
              ))}
            </AnimatePresence>
          </div>
          
          {filteredDrafts.length === 0 && (
            <Card className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No drafts found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Create your first contract draft to get started'}
              </p>
              <Button onClick={() => handleCreateSelect('template')}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Draft
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className={cn(
            'grid gap-4',
            viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'
          )}>
            {mockDrafts
              .filter(d => d.status === 'PENDING_APPROVAL' || d.status === 'IN_REVIEW')
              .map((draft) => (
                <DraftCard key={draft.id} draft={draft} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mockTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={handleTemplateSelect}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
