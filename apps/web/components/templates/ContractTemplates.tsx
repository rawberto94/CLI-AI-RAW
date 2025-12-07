/**
 * Contract Templates Manager
 * Create and manage contract templates for standardized document generation
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { 
  FileText, 
  Plus,
  Search,
  Edit,
  Copy,
  Trash2,
  Star,
  StarOff,
  MoreVertical,
  Loader2,
  Eye,
  Download,
  Upload,
  Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  content: string;
  variables: TemplateVariable[];
  isFavorite: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: string[];
}

interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'currency' | 'select';
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

interface ContractTemplatesProps {
  className?: string;
  onSelectTemplate?: (template: ContractTemplate) => void;
}

const contractTypes = ['MSA', 'NDA', 'SOW', 'Amendment', 'License', 'Service Agreement', 'Purchase Order'];
const categories = ['Legal', 'Sales', 'HR', 'Vendor', 'Customer', 'Internal'];

// Mock data
function generateMockTemplates(): ContractTemplate[] {
  const templates: ContractTemplate[] = [
    {
      id: 'tpl_1',
      name: 'Standard NDA',
      description: 'Non-disclosure agreement for general business purposes',
      type: 'NDA',
      category: 'Legal',
      content: 'This Non-Disclosure Agreement ("Agreement") is entered into as of {{effective_date}} between {{party_a}} ("Disclosing Party") and {{party_b}} ("Receiving Party")...',
      variables: [
        { name: 'effective_date', label: 'Effective Date', type: 'date', required: true },
        { name: 'party_a', label: 'Disclosing Party', type: 'text', required: true },
        { name: 'party_b', label: 'Receiving Party', type: 'text', required: true },
        { name: 'term_months', label: 'Term (months)', type: 'number', required: true, defaultValue: '24' },
      ],
      isFavorite: true,
      usageCount: 156,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      createdBy: 'John Doe',
      tags: ['standard', 'legal', 'confidential'],
    },
    {
      id: 'tpl_2',
      name: 'Master Service Agreement',
      description: 'Comprehensive MSA for ongoing service relationships',
      type: 'MSA',
      category: 'Sales',
      content: 'This Master Service Agreement ("Agreement") is made effective {{effective_date}} between {{company_name}} and {{client_name}}...',
      variables: [
        { name: 'effective_date', label: 'Effective Date', type: 'date', required: true },
        { name: 'company_name', label: 'Company Name', type: 'text', required: true },
        { name: 'client_name', label: 'Client Name', type: 'text', required: true },
        { name: 'jurisdiction', label: 'Jurisdiction', type: 'select', required: true, options: ['Delaware', 'California', 'New York', 'Texas'] },
      ],
      isFavorite: true,
      usageCount: 89,
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      createdBy: 'Jane Smith',
      tags: ['services', 'enterprise'],
    },
    {
      id: 'tpl_3',
      name: 'Statement of Work Template',
      description: 'Project-specific SOW linked to MSA',
      type: 'SOW',
      category: 'Sales',
      content: 'This Statement of Work ("SOW") is issued pursuant to the MSA dated {{msa_date}}...',
      variables: [
        { name: 'msa_date', label: 'MSA Date', type: 'date', required: true },
        { name: 'project_name', label: 'Project Name', type: 'text', required: true },
        { name: 'project_value', label: 'Project Value', type: 'currency', required: true },
        { name: 'start_date', label: 'Start Date', type: 'date', required: true },
        { name: 'end_date', label: 'End Date', type: 'date', required: true },
      ],
      isFavorite: false,
      usageCount: 67,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      createdBy: 'John Doe',
      tags: ['project', 'scope'],
    },
    {
      id: 'tpl_4',
      name: 'Software License Agreement',
      description: 'Standard software licensing terms',
      type: 'License',
      category: 'Legal',
      content: 'This Software License Agreement ("Agreement") grants {{licensee}} a {{license_type}} license...',
      variables: [
        { name: 'licensee', label: 'Licensee', type: 'text', required: true },
        { name: 'license_type', label: 'License Type', type: 'select', required: true, options: ['Perpetual', 'Annual', 'Monthly', 'Enterprise'] },
        { name: 'seats', label: 'Number of Seats', type: 'number', required: true },
        { name: 'fee', label: 'License Fee', type: 'currency', required: true },
      ],
      isFavorite: false,
      usageCount: 45,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      createdBy: 'Bob Wilson',
      tags: ['software', 'licensing'],
    },
  ];

  return templates;
}

export const ContractTemplates = memo(function ContractTemplates({
  className,
  onSelectTemplate,
}: ContractTemplatesProps) {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    type: 'NDA',
    category: 'Legal',
    content: '',
    tags: '',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates.map((t: ContractTemplate) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        })));
      } else {
        setTemplates(generateMockTemplates());
      }
    } catch {
      setTemplates(generateMockTemplates());
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    if (typeFilter !== 'all' && template.type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleCreate = async () => {
    if (!newTemplate.name || !newTemplate.content) {
      toast.error('Please fill in required fields');
      return;
    }

    setCreating(true);
    try {
      await new Promise(r => setTimeout(r, 1000));

      const template: ContractTemplate = {
        id: `tpl_${Date.now()}`,
        ...newTemplate,
        variables: [],
        isFavorite: false,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'Current User',
        tags: newTemplate.tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      setTemplates(prev => [template, ...prev]);
      setShowCreateDialog(false);
      setNewTemplate({ name: '', description: '', type: 'NDA', category: 'Legal', content: '', tags: '' });
      toast.success('Template created successfully');
    } catch {
      toast.error('Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  const toggleFavorite = (templateId: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === templateId ? { ...t, isFavorite: !t.isFavorite } : t
    ));
  };

  const duplicateTemplate = (template: ContractTemplate) => {
    const duplicate: ContractTemplate = {
      ...template,
      id: `tpl_${Date.now()}`,
      name: `${template.name} (Copy)`,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'Current User',
    };
    setTemplates(prev => [duplicate, ...prev]);
    toast.success('Template duplicated');
  };

  const deleteTemplate = (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    toast.success('Template deleted');
  };

  const handlePreview = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setShowPreviewDialog(true);
  };

  const handleUseTemplate = (template: ContractTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    } else {
      toast.success(`Using template: ${template.name}`);
    }
  };

  const favorites = filteredTemplates.filter(t => t.isFavorite);
  const others = filteredTemplates.filter(t => !t.isFavorite);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Contract Templates
            </CardTitle>
            <CardDescription>
              Manage reusable contract templates
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>
                  Create a reusable contract template
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tpl-name">Template Name *</Label>
                    <Input
                      id="tpl-name"
                      placeholder="e.g., Standard NDA"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contract Type</Label>
                    <Select
                      value={newTemplate.type}
                      onValueChange={(value) => setNewTemplate(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {contractTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={newTemplate.category}
                      onValueChange={(value) => setNewTemplate(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tpl-tags">Tags</Label>
                    <Input
                      id="tpl-tags"
                      placeholder="comma, separated, tags"
                      value={newTemplate.tags}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, tags: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpl-desc">Description</Label>
                  <Textarea
                    id="tpl-desc"
                    placeholder="Brief description of the template"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpl-content">Template Content *</Label>
                  <Textarea
                    id="tpl-content"
                    placeholder="Enter your contract template content. Use {{variable_name}} for dynamic fields..."
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Tip: Use {"{{variable_name}}"} syntax for dynamic fields like dates, names, amounts, etc.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating} className="gap-2">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Template'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {contractTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span>Loading templates...</span>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            {/* Favorites */}
            {favorites.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-500 mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  Favorites
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {favorites.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onToggleFavorite={toggleFavorite}
                      onDuplicate={duplicateTemplate}
                      onDelete={deleteTemplate}
                      onPreview={handlePreview}
                      onUse={handleUseTemplate}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Templates */}
            <div>
              {favorites.length > 0 && others.length > 0 && (
                <h3 className="text-sm font-medium text-slate-500 mb-3">All Templates</h3>
              )}
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No templates found
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {others.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onToggleFavorite={toggleFavorite}
                      onDuplicate={duplicateTemplate}
                      onDelete={deleteTemplate}
                      onPreview={handlePreview}
                      onUse={handleUseTemplate}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Preview Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{selectedTemplate?.name}</DialogTitle>
              <DialogDescription>{selectedTemplate?.description}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[400px] mt-4">
              <pre className="text-sm whitespace-pre-wrap font-mono bg-slate-50 p-4 rounded-lg">
                {selectedTemplate?.content}
              </pre>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                Close
              </Button>
              <Button onClick={() => {
                if (selectedTemplate) handleUseTemplate(selectedTemplate);
                setShowPreviewDialog(false);
              }}>
                Use Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
});

// Template Card Component
interface TemplateCardProps {
  template: ContractTemplate;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (template: ContractTemplate) => void;
  onDelete: (id: string) => void;
  onPreview: (template: ContractTemplate) => void;
  onUse: (template: ContractTemplate) => void;
}

const TemplateCard = memo(function TemplateCard({
  template,
  onToggleFavorite,
  onDuplicate,
  onDelete,
  onPreview,
  onUse,
}: TemplateCardProps) {
  return (
    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{template.type}</Badge>
          <Badge variant="secondary" className="text-xs">{template.category}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onToggleFavorite(template.id)}
          >
            {template.isFavorite ? (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            ) : (
              <StarOff className="h-4 w-4 text-slate-300" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPreview(template)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(template)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(template.id)} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <h4 className="font-medium mb-1">{template.name}</h4>
      <p className="text-sm text-slate-500 mb-3 line-clamp-2">{template.description}</p>
      <div className="flex items-center gap-2 mb-3">
        {template.tags.slice(0, 3).map(tag => (
          <Badge key={tag} variant="outline" className="text-xs">
            <Tag className="h-3 w-3 mr-1" />
            {tag}
          </Badge>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Used {template.usageCount} times</span>
        <span>Updated {formatDistanceToNow(template.updatedAt, { addSuffix: true })}</span>
      </div>
      <Button 
        className="w-full mt-3" 
        size="sm"
        onClick={() => onUse(template)}
      >
        Use Template
      </Button>
    </div>
  );
});
