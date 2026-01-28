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
  Star,
  StarOff,
  Copy,
  Edit3,
  Trash2,
  MoreHorizontal,
  Eye,
  Download,
  Upload,
  Tag,
  Folder,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  Settings,
  Lock,
  Unlock,
  Users,
  BarChart3,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import type { Template, TemplateCategory, LibraryClause } from '@/types/contract-generation';

// ====================
// CONFIGURATION
// ====================

const categoryConfig: Record<TemplateCategory, { label: string; icon: string; color: string }> = {
  MSA: { label: 'Master Service Agreement', icon: '📋', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  SOW: { label: 'Statement of Work', icon: '📝', color: 'bg-green-100 text-green-700 border-green-200' },
  NDA: { label: 'Non-Disclosure Agreement', icon: '🔒', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  AMENDMENT: { label: 'Amendment', icon: '📌', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  RENEWAL: { label: 'Renewal', icon: '🔄', color: 'bg-purple-100 text-purple-700 border-cyan-200' },
  ORDER_FORM: { label: 'Order Form', icon: '🛒', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  SLA: { label: 'Service Level Agreement', icon: '⚡', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  DPA: { label: 'Data Processing Agreement', icon: '🛡️', color: 'bg-purple-100 text-purple-700 border-indigo-200' },
  SUBCONTRACT: { label: 'Subcontractor Agreement', icon: '🤝', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  CONSULTING: { label: 'Consulting Agreement', icon: '💼', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  LICENSE: { label: 'License Agreement', icon: '📄', color: 'bg-lime-100 text-lime-700 border-lime-200' },
  OTHER: { label: 'Other', icon: '📁', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

// ====================
// MOCK DATA (fallback when API unavailable)
// ====================

const mockTemplates: Template[] = [
  {
    id: 't1',
    tenantId: 'demo',
    name: 'Standard MSA - Consulting',
    description: 'Master Service Agreement template for consulting engagements. Includes standard terms for professional services.',
    category: 'MSA',
    content: { sections: [] },
    variables: [],
    defaultClauses: ['definitions', 'scope', 'term', 'payment', 'termination', 'liability', 'confidentiality'],
    version: 3,
    isActive: true,
    isPublic: false,
    usageCount: 156,
    estimatedTime: 30,
    lastUsedAt: new Date('2025-01-10'),
    createdBy: 'admin',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-11-20'),
    complexity: 'moderate',
    tags: ['consulting', 'services', 'standard', 'tier-1'],
  },
  {
    id: 't2',
    tenantId: 'demo',
    name: 'IT Services SOW',
    description: 'Statement of Work for IT services and software development projects.',
    category: 'SOW',
    content: { sections: [] },
    variables: [],
    defaultClauses: ['scope', 'deliverables', 'timeline', 'acceptance', 'payment'],
    version: 2,
    isActive: true,
    isPublic: false,
    usageCount: 89,
    estimatedTime: 20,
    lastUsedAt: new Date('2025-01-08'),
    createdBy: 'admin',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-10-15'),
    complexity: 'simple',
    tags: ['IT', 'development', 'project-based'],
  },
  {
    id: 't3',
    tenantId: 'demo',
    name: 'Mutual NDA',
    description: 'Standard mutual non-disclosure agreement for business discussions.',
    category: 'NDA',
    content: { sections: [] },
    variables: [],
    defaultClauses: ['confidentiality', 'term', 'exceptions', 'return'],
    version: 1,
    isActive: true,
    isPublic: true,
    usageCount: 234,
    estimatedTime: 10,
    lastUsedAt: new Date('2025-01-12'),
    createdBy: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    complexity: 'simple',
    tags: ['confidentiality', 'quick', 'mutual'],
  },
  {
    id: 't4',
    tenantId: 'demo',
    name: 'GDPR Data Processing Agreement',
    description: 'Data Processing Agreement compliant with GDPR requirements.',
    category: 'DPA',
    content: { sections: [] },
    variables: [],
    defaultClauses: ['definitions', 'processing', 'security', 'subprocessors', 'audit', 'deletion'],
    version: 2,
    isActive: true,
    isPublic: false,
    usageCount: 67,
    estimatedTime: 25,
    lastUsedAt: new Date('2025-01-05'),
    createdBy: 'admin',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-12-01'),
    complexity: 'complex',
    tags: ['GDPR', 'privacy', 'data', 'EU', 'compliance'],
  },
  {
    id: 't5',
    tenantId: 'demo',
    name: 'Renewal Agreement',
    description: 'Template for renewing existing contracts with updated terms.',
    category: 'RENEWAL',
    content: { sections: [] },
    variables: [],
    defaultClauses: ['reference', 'term_extension', 'updated_terms', 'pricing'],
    version: 1,
    isActive: true,
    isPublic: false,
    usageCount: 45,
    estimatedTime: 15,
    lastUsedAt: new Date('2025-01-02'),
    createdBy: 'admin',
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date('2024-09-15'),
    complexity: 'simple',
    tags: ['renewal', 'extension'],
  },
  {
    id: 't6',
    tenantId: 'demo',
    name: 'Rate Card Amendment',
    description: 'Amendment template for rate card updates and pricing changes.',
    category: 'AMENDMENT',
    content: { sections: [] },
    variables: [],
    defaultClauses: ['reference', 'rate_changes', 'effective_date'],
    version: 1,
    isActive: true,
    isPublic: false,
    usageCount: 78,
    estimatedTime: 10,
    lastUsedAt: new Date('2025-01-11'),
    createdBy: 'admin',
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-08-20'),
    complexity: 'simple',
    tags: ['rates', 'pricing', 'amendment'],
  },
];

// ====================
// API FUNCTIONS
// ====================

async function fetchTemplates(search?: string, category?: string): Promise<Template[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category && category !== 'all') params.set('category', category);

  const response = await fetch(`/api/templates?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch templates');
  const data = await response.json();
  
  return (data.templates || []).map((t: any) => ({
    ...t,
    content: t.structure || { sections: [] },
    variables: [],
    defaultClauses: t.clauses?.defaultClauses || [],
    estimatedTime: t.metadata?.estimatedTime || 20,
    complexity: t.metadata?.complexity || 'moderate',
    tags: t.metadata?.tags || [],
    lastUsedAt: t.lastUsedAt ? new Date(t.lastUsedAt) : undefined,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
    isPublic: t.metadata?.isPublic || false,
    createdBy: t.createdBy || 'admin',
  }));
}

async function createTemplate(template: Partial<Template>): Promise<Template> {
  const response = await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: template.name,
      description: template.description,
      category: template.category,
      clauses: { defaultClauses: template.defaultClauses || [] },
      structure: template.content || { sections: [] },
      metadata: {
        estimatedTime: template.estimatedTime || 20,
        complexity: template.complexity || 'moderate',
        tags: template.tags || [],
        isPublic: template.isPublic || false,
      },
    }),
  });
  if (!response.ok) throw new Error('Failed to create template');
  const data = await response.json();
  return data.template;
}

async function updateTemplate(id: string, template: Partial<Template>): Promise<Template> {
  const response = await fetch(`/api/templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: template.name,
      description: template.description,
      category: template.category,
      clauses: { defaultClauses: template.defaultClauses || [] },
      structure: template.content || { sections: [] },
      metadata: {
        estimatedTime: template.estimatedTime || 20,
        complexity: template.complexity || 'moderate',
        tags: template.tags || [],
        isPublic: template.isPublic || false,
      },
    }),
  });
  if (!response.ok) throw new Error('Failed to update template');
  const data = await response.json();
  return data.template;
}

async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`/api/templates/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete template');
}

// ====================
// TEMPLATE CARD
// ====================

interface TemplateCardProps {
  template: Template;
  onEdit: () => void;
  onDuplicate: () => void;
  onPreview: () => void;
  onUse: () => void;
  onDelete: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  viewMode: 'grid' | 'list';
}

function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onPreview,
  onUse,
  onDelete,
  onToggleFavorite,
  isFavorite = false,
  viewMode,
}: TemplateCardProps) {
  const config = categoryConfig[template.category];

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Card className="hover:shadow-md transition-all">
          <CardContent className="flex items-center gap-4 p-4">
            {/* Icon */}
            <div className="text-3xl">{config.icon}</div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{template.name}</h3>
                <Badge variant="outline" className={cn('text-xs', config.color)}>
                  {config.label}
                </Badge>
                {template.isPublic && (
                  <Badge variant="secondary" className="text-xs">Public</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {template.description}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {template.usageCount}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                ~{template.estimatedTime}m
              </div>
              <Badge variant="outline" className="capitalize">
                {template.complexity}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleFavorite} aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                {isFavorite ? (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </Button>
              <Button variant="default" size="sm" onClick={onUse}>
                Use Template
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Template actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onPreview}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Card className="h-full flex flex-col hover:shadow-lg transition-all border-2 hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="text-4xl">{config.icon}</div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={onToggleFavorite}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                {isFavorite ? (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Template actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onPreview}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="space-y-1 mt-2">
            <CardTitle className="text-lg line-clamp-1">{template.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-xs', config.color)}>
                {config.label}
              </Badge>
              {template.isPublic && (
                <Badge variant="secondary" className="text-xs">
                  <Unlock className="h-3 w-3 mr-1" />
                  Public
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-xs line-clamp-2 mt-2">
            {template.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1">
          {/* Complexity & Time */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ~{template.estimatedTime} min
            </div>
            <Badge
              variant="outline"
              className={cn(
                'capitalize text-xs',
                template.complexity === 'simple' && 'bg-green-50 text-green-700',
                template.complexity === 'moderate' && 'bg-amber-50 text-amber-700',
                template.complexity === 'complex' && 'bg-red-50 text-red-700',
              )}
            >
              {template.complexity}
            </Badge>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {template.tags?.slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs font-normal">
                {tag}
              </Badge>
            ))}
            {template.tags && template.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs font-normal">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-0 flex-col gap-3">
          {/* Stats */}
          <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              {template.usageCount} uses
            </span>
            <span>v{template.version}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1" onClick={onPreview}>
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <Button size="sm" className="flex-1" onClick={onUse}>
              Use
              <ArrowUpRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// ====================
// CATEGORY FILTER
// ====================

interface CategoryFilterProps {
  selectedCategory: TemplateCategory | 'all';
  onSelect: (category: TemplateCategory | 'all') => void;
}

function CategoryFilter({ selectedCategory, onSelect }: CategoryFilterProps) {
  const categories = Object.entries(categoryConfig) as [TemplateCategory, typeof categoryConfig[TemplateCategory]][];

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        <Button
          variant={selectedCategory === 'all' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onSelect('all')}
        >
          All Templates
        </Button>
        {categories.map(([key, config]) => (
          <Button
            key={key}
            variant={selectedCategory === key ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => onSelect(key)}
            className="gap-1"
          >
            <span>{config.icon}</span>
            {config.label}
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}

// ====================
// STATS CARDS
// ====================

interface TemplateStatsProps {
  templates: Template[];
  loading?: boolean;
}

function TemplateStats({ templates, loading }: TemplateStatsProps) {
  const mostUsed = templates.length > 0 
    ? templates.reduce((a, b) => (a.usageCount || 0) > (b.usageCount || 0) ? a : b)
    : null;
  
  const avgTime = templates.length > 0
    ? Math.round(templates.reduce((acc, t) => acc + (t.estimatedTime || 20), 0) / templates.length)
    : 0;

  const stats = [
    { label: 'Total Templates', value: templates.length, change: 'from database' },
    { label: 'Most Used', value: mostUsed?.name || 'N/A', change: `${mostUsed?.usageCount || 0} uses` },
    { label: 'Avg. Completion', value: `${avgTime} min`, change: 'estimated' },
    { label: 'Active Templates', value: templates.filter(t => t.isActive !== false).length, change: 'ready to use' },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="pb-2">
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className={cn("text-2xl", loading && "animate-pulse")}>
              {loading ? '...' : stat.value}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{stat.change}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ====================
// MAIN COMPONENT
// ====================

export function TemplateManager() {
  const { useRealData } = useDataMode();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['t1', 't3']));
  const [activeTab, setActiveTab] = useState('all');

  // Fetch templates from API or use mock data
  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (useRealData) {
          const data = await fetchTemplates(searchQuery, selectedCategory);
          setTemplates(data.length > 0 ? data : mockTemplates);
        } else {
          // Use mock data
          setTemplates(mockTemplates);
        }
      } catch {
        setError('Failed to load templates. Using sample data.');
        setTemplates(mockTemplates);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [useRealData, searchQuery, selectedCategory]);

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          template.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesTab = activeTab === 'all' || 
                       (activeTab === 'favorites' && favorites.has(template.id)) ||
                       (activeTab === 'recent' && template.lastUsedAt);
    return matchesSearch && matchesCategory && matchesTab;
  });

  const handleToggleFavorite = useCallback((templateId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  }, []);

  const handleDuplicate = useCallback(async (template: Template) => {
    try {
      if (useRealData) {
        const duplicated = await createTemplate({
          ...template,
          name: `${template.name} (Copy)`,
          usageCount: 0,
        });
        setTemplates(prev => [...prev, duplicated]);
        toast({
          title: 'Template Duplicated',
          description: `"${template.name}" has been duplicated successfully.`,
        });
      } else {
        const duplicate: Template = {
          ...template,
          id: `t${Date.now()}`,
          name: `${template.name} (Copy)`,
          usageCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setTemplates(prev => [...prev, duplicate]);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to duplicate template.',
        variant: 'destructive',
      });
    }
  }, [useRealData, toast]);

  const handleDelete = useCallback(async (templateId: string) => {
    try {
      if (useRealData) {
        await deleteTemplate(templateId);
        toast({
          title: 'Template Deleted',
          description: 'Template has been deleted successfully.',
        });
      }
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      setFavorites(prev => {
        const next = new Set(prev);
        next.delete(templateId);
        return next;
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete template.',
        variant: 'destructive',
      });
    }
  }, [useRealData, toast]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTemplates(searchQuery, selectedCategory);
      setTemplates(data.length > 0 ? data : mockTemplates);
      setError(null);
      toast({
        title: 'Refreshed',
        description: 'Template list has been refreshed.',
      });
    } catch (err) {
      setError('Failed to refresh templates.');
      toast({
        title: 'Error',
        description: 'Failed to refresh templates.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, toast]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Template Library</h1>
            {useRealData && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Live Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Manage and use pre-approved contract templates
          </p>
          {error && (
            <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh templates"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      {/* Stats */}
      <TemplateStats templates={templates} loading={loading} />

      {/* Filters & Search */}
      <div className="space-y-4">
        <CategoryFilter
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="favorites" className="gap-1">
                <Star className="h-3 w-3" />
                Favorites
              </TabsTrigger>
              <TabsTrigger value="recent" className="gap-1">
                <Clock className="h-3 w-3" />
                Recent
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
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
      </div>

      {/* Template Grid/List */}
      <div className={cn(
        viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-3'
      )}>
        <AnimatePresence mode="popLayout">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              viewMode={viewMode}
              isFavorite={favorites.has(template.id)}
              onToggleFavorite={() => handleToggleFavorite(template.id)}
              onEdit={() => {}}
              onDuplicate={() => handleDuplicate(template)}
              onPreview={() => {}}
              onUse={() => {}}
              onDelete={() => handleDelete(template.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No templates found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery 
              ? 'Try adjusting your search or filters' 
              : 'Create your first template to get started'}
          </p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </Card>
      )}
    </div>
  );
}

export default TemplateManager;
