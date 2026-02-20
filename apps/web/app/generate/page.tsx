'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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
  Bot,
  Scale,
  Loader2,
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
import type { ContractDraft, DraftStatus, DraftSourceType, TemplateCategory, Template } from '@/types/contract-generation';

// ====================
// STATUS CONFIGURATION
// ====================

const statusConfig: Record<DraftStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: <Edit3 className="h-3 w-3" /> },
  IN_REVIEW: { label: 'In Review', color: 'bg-violet-100 text-violet-700', icon: <Eye className="h-3 w-3" /> },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3 w-3" /> },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-3 w-3" /> },
  PENDING_SIGNATURE: { label: 'Pending Signature', color: 'bg-violet-100 text-violet-700', icon: <FileSignature className="h-3 w-3" /> },
  EXECUTED: { label: 'Executed', color: 'bg-violet-100 text-violet-700', icon: <CheckCircle2 className="h-3 w-3" /> },
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
// DATA FETCHING HOOKS
// ====================

interface DraftsMetrics {
  total: number;
  draft: number;
  inReview: number;
  pendingApproval: number;
  approved: number;
  finalized: number;
}

interface DraftsResponse {
  success: boolean;
  data?: {
    drafts: ContractDraft[];
    total: number;
    metrics: DraftsMetrics;
  };
  error?: string;
}

interface TemplatesResponse {
  success: boolean;
  templates?: Template[];
  total?: number;
  error?: string;
}

function useDrafts() {
  const [drafts, setDrafts] = useState<ContractDraft[]>([]);
  const [metrics, setMetrics] = useState<DraftsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/drafts?limit=100&sortBy=updatedAt&sortOrder=desc');
      const json: DraftsResponse = await response.json();
      
      if (json.success && json.data) {
        // Map API response to ContractDraft format
        const mappedDrafts = json.data.drafts.map((d) => ({
          id: d.id,
          tenantId: d.tenantId,
          title: d.title,
          type: (d.type as TemplateCategory) || 'MSA',
          description: d.content ? String(d.content).substring(0, 100) : undefined,
          sourceType: (d.sourceType as DraftSourceType) || 'NEW',
          templateId: d.templateId,
          sourceContractId: d.sourceContractId,
          status: (d.status as DraftStatus) || 'DRAFT',
          version: (d.version as number) || 1,
          content: (d as any).clauses || { sections: [] },
          variables: (d.variables as Record<string, unknown>) || {},
          isLocked: (d.isLocked as boolean) || false,
          lockedBy: d.lockedBy,
          currency: (d.currency as string) || 'USD',
          estimatedValue: d.estimatedValue ? Number(d.estimatedValue) : undefined,
          proposedStartDate: d.proposedStartDate ? new Date(d.proposedStartDate) : undefined,
          proposedEndDate: d.proposedEndDate ? new Date(d.proposedEndDate) : undefined,
          createdBy: d.createdBy,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
          externalParties: (d.externalParties as Array<{ name: string; type: string; signatories: unknown[] }>) || [],
        }));
        setDrafts(mappedDrafts as ContractDraft[]);
        setMetrics(json.data.metrics);
        setError(null);
      } else {
        setDrafts([]);
        setError(json.error || 'Failed to fetch drafts');
      }
    } catch (err) {
      console.error('Error fetching drafts:', err);
      setDrafts([]);
      setError('Failed to fetch drafts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  return { drafts, metrics, loading, error, refetch: fetchDrafts };
}

function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates?limit=100&isActive=true');
      const json: TemplatesResponse = await response.json();
      
      if (json.success && json.templates) {
        // Map API response to Template format
        const mappedTemplates = json.templates.map((t) => ({
          id: t.id,
          tenantId: t.tenantId,
          name: t.name,
          description: t.description,
          category: (t.category as TemplateCategory) || 'OTHER',
          content: (t as any).structure || { sections: [] },
          variables: [],
          defaultClauses: ((t as any).clauses as unknown[]) || [],
          version: (t.version as number) || 1,
          isActive: (t.isActive as boolean) ?? true,
          isPublic: false,
          usageCount: (t.usageCount as number) || 0,
          estimatedTime: 15, // Default estimate
          createdBy: t.createdBy,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
          complexity: 'moderate' as const,
          tags: [],
        }));
        setTemplates(mappedTemplates as Template[]);
        setError(null);
      } else {
        setTemplates([]);
        setError(json.error || 'Failed to fetch templates');
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      setTemplates([]);
      setError('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, error, refetch: fetchTemplates };
}

// ====================
// COMPONENTS
// ====================

function QuickStats({ metrics, drafts }: { metrics: DraftsMetrics | null; drafts: ContractDraft[] }) {
  // Calculate total value from drafts
  const totalValue = drafts.reduce((sum, d) => sum + (d.estimatedValue || 0), 0);
  const formattedValue = totalValue >= 1000000 
    ? `$${(totalValue / 1000000).toFixed(1)}M` 
    : totalValue >= 1000 
      ? `$${(totalValue / 1000).toFixed(0)}K` 
      : `$${totalValue}`;

  const stats = [
    { 
      label: 'Active Drafts', 
      value: metrics?.draft || 0, 
      change: `${metrics?.total || 0} total`, 
      icon: FileText, 
      color: 'text-violet-600' 
    },
    { 
      label: 'Pending Approval', 
      value: (metrics?.pendingApproval || 0) + (metrics?.inReview || 0), 
      change: `${metrics?.inReview || 0} in review`, 
      icon: Clock, 
      color: 'text-amber-600' 
    },
    { 
      label: 'Approved', 
      value: metrics?.approved || 0, 
      change: `${metrics?.finalized || 0} finalized`, 
      icon: CheckCircle2, 
      color: 'text-green-600' 
    },
    { 
      label: 'Total Value', 
      value: formattedValue, 
      change: `${drafts.length} contracts`, 
      icon: DollarSign, 
      color: 'text-violet-600' 
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </CardTitle>
            <div className={cn(
              'p-2 rounded-lg bg-gradient-to-br text-white shadow-lg group-hover:scale-110 transition-transform duration-300',
              stat.color === 'text-violet-600' ? 'from-violet-400 to-purple-600 shadow-violet-500/30' :
              stat.color === 'text-amber-600' ? 'from-amber-400 to-amber-600 shadow-amber-500/30' :
              stat.color === 'text-green-600' ? 'from-violet-400 to-violet-600 shadow-green-500/30' :
              'from-violet-400 to-purple-600 shadow-violet-500/30'
            )}>
              <stat.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.change}</p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-30" 
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
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      id: 'renewal',
      title: 'Contract Renewal',
      description: 'Renew an existing contract',
      icon: RefreshCw,
      gradient: 'from-violet-500 to-violet-600',
    },
    {
      id: 'amendment',
      title: 'Amendment',
      description: 'Create an amendment to existing contract',
      icon: GitBranch,
      gradient: 'from-violet-500 to-purple-600',
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
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Draft actions">
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('drafts');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [createType, setCreateType] = useState<'new' | 'template' | 'renewal' | 'amendment' | null>(null);

  // Fetch real data
  const { drafts, metrics, loading: draftsLoading, error: draftsError, refetch: refetchDrafts } = useDrafts();
  const { templates, loading: templatesLoading, error: templatesError, refetch: refetchTemplates } = useTemplates();

  // Handle URL params for direct create links
  useEffect(() => {
    const create = searchParams?.get('create');
    const fromContractId = searchParams?.get('from') || searchParams?.get('source');
    if (create) {
      // Store the source contract ID for renewal/amendment flows
      if (fromContractId) {
        sessionStorage.setItem('renewal_source_contract', fromContractId);
      }
      handleCreateSelect(create as 'new' | 'template' | 'renewal' | 'amendment');
    }
  }, [searchParams]);

  const handleCreateSelect = useCallback((type: 'new' | 'template' | 'renewal' | 'amendment') => {
    setCreateType(type);
    const fromContractId = sessionStorage.getItem('renewal_source_contract');
    switch (type) {
      case 'new':
        // Navigate to AI Copilot for blank document
        router.push('/drafting/copilot?mode=blank');
        break;
      case 'template':
        setShowTemplateDialog(true);
        setActiveTab('templates');
        break;
      case 'renewal': {
        // Navigate to AI Copilot with renewal mode and source contract
        const renewalParams = new URLSearchParams({ mode: 'renewal' });
        if (fromContractId) renewalParams.set('from', fromContractId);
        router.push(`/drafting/copilot?${renewalParams.toString()}`);
        break;
      }
      case 'amendment': {
        // Navigate to AI Copilot with amendment mode and source contract
        const amendParams = new URLSearchParams({ mode: 'amendment' });
        if (fromContractId) amendParams.set('from', fromContractId);
        router.push(`/drafting/copilot?${amendParams.toString()}`);
        break;
      }
    }
  }, [router]);

  const handleTemplateSelect = useCallback((template: Template) => {
    // Template selected for generation - navigate to drafting with template
    setShowTemplateDialog(false);
    router.push(`/drafting/copilot?template=${template.id}&name=${encodeURIComponent(template.name)}`);
  }, [router]);

  const handleDraftAction = useCallback(async (draftId: string, action: 'view' | 'edit' | 'submit' | 'delete') => {
    switch (action) {
      case 'view':
        router.push(`/drafting/${draftId}`);
        break;
      case 'edit':
        router.push(`/drafting/copilot?draft=${draftId}`);
        break;
      case 'submit':
        // Submit for approval
        try {
          const response = await fetch(`/api/drafts/${draftId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PENDING_APPROVAL' }),
          });
          if (response.ok) {
            toast.success('Draft submitted for approval');
            refetchDrafts();
          }
        } catch {
          toast.error('Failed to submit draft');
        }
        break;
      case 'delete':
        // Delete draft
        try {
          const response = await fetch(`/api/drafts/${draftId}`, {
            method: 'DELETE',
          });
          if (response.ok) {
            toast.success('Draft deleted');
            refetchDrafts();
          }
        } catch {
          toast.error('Failed to delete draft');
        }
        break;
    }
  }, [router, refetchDrafts]);

  const filteredDrafts = drafts.filter(draft => 
    draft.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    draft.externalParties?.[0]?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = draftsLoading || templatesLoading;

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
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => { refetchDrafts(); refetchTemplates(); }} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button size="lg" className="gap-2" onClick={() => handleCreateSelect('template')}>
            <Plus className="h-4 w-4" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats metrics={metrics} drafts={drafts} />

      {/* AI Assistant Banner */}
      <AIAssistantBanner />

      {/* Create Contract Options */}
      <CreateContractCard onSelect={handleCreateSelect} />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl">
            <TabsTrigger value="drafts" className="gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/30 transition-all duration-300">
              <FileText className="h-4 w-4" />
              My Drafts
              {metrics && metrics.draft > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{metrics.draft}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-amber-500/30 transition-all duration-300">
              <Clock className="h-4 w-4" />
              Pending Approval
              {metrics && (metrics.pendingApproval + metrics.inReview) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{metrics.pendingApproval + metrics.inReview}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/30 transition-all duration-300">
              <Copy className="h-4 w-4" />
              Templates
              {templates.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{templates.length}</Badge>
              )}
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
            <Button variant="outline" size="icon" aria-label="Filter drafts">
              <Filter className="h-4 w-4" />
            </Button>
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-r-none"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="drafts" className="space-y-4">
          {draftsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : draftsError ? (
            <Card className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h3 className="font-semibold mb-2">Failed to load drafts</h3>
              <p className="text-sm text-muted-foreground mb-4">{draftsError}</p>
              <Button onClick={refetchDrafts}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </Card>
          ) : (
            <>
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
            </>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {draftsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className={cn(
              'grid gap-4',
              viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'
            )}>
              {drafts
                .filter(d => d.status === 'PENDING_APPROVAL' || d.status === 'IN_REVIEW')
                .map((draft) => (
                  <DraftCard key={draft.id} draft={draft} />
                ))}
            </div>
          )}
          {!draftsLoading && drafts.filter(d => d.status === 'PENDING_APPROVAL' || d.status === 'IN_REVIEW').length === 0 && (
            <Card className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="font-semibold mb-2">All caught up!</h3>
              <p className="text-sm text-muted-foreground">No drafts pending approval at the moment.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {templatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templatesError ? (
            <Card className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h3 className="font-semibold mb-2">Failed to load templates</h3>
              <p className="text-sm text-muted-foreground mb-4">{templatesError}</p>
              <Button onClick={refetchTemplates}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </Card>
          ) : templates.length === 0 ? (
            <Card className="p-12 text-center">
              <Copy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No templates available</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Contact your administrator to add contract templates.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onSelect={handleTemplateSelect}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
