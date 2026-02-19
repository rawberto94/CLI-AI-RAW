'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  X,
  Plus,
  GripVertical,
  CheckCircle2,
  FileText,
  Calendar,
  DollarSign,
  Shield,
  Tag,
  AlertTriangle,
  Sparkles,
  Copy,
  Trash2,
  Save,
  Wand2,
  Filter,
  Link2,
  Zap,
  Building2,
  UserCircle,
  MapPin,
  CreditCard,
  FileStack,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterBlock {
  id: string;
  type: 'status' | 'date' | 'value' | 'risk' | 'category' | 'role' | 'expiration' | 'supplier' | 'client' | 'jurisdiction' | 'payment' | 'contractType' | 'currency';
  label: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between' | 'in';
  value: any;
  color: string;
  icon: any;
}

interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  filters: FilterBlock[];
}

interface DragDropFilterBuilderProps {
  onApply: (groups: FilterGroup[], interGroupLogic?: 'AND' | 'OR') => void;
  onClose: () => void;
  initialGroups?: FilterGroup[];
  /** Dynamic options derived from contract data */
  availableSuppliers?: string[];
  availableClients?: string[];
  availableContractTypes?: string[];
}

const FILTER_TEMPLATES = [
  {
    type: 'status',
    label: 'Status',
    icon: CheckCircle2,
    color: 'blue',
    options: ['Draft', 'Pending', 'Active', 'Completed', 'Expired'],
  },
  {
    type: 'date',
    label: 'Date Range',
    icon: Calendar,
    color: 'purple',
    options: ['Last 7 days', 'Last 30 days', 'Last 90 days', 'Custom'],
  },
  {
    type: 'value',
    label: 'Contract Value',
    icon: DollarSign,
    color: 'violet',
    options: ['< $10K', '$10K - $100K', '$100K - $1M', '> $1M'],
  },
  {
    type: 'risk',
    label: 'Risk Level',
    icon: Shield,
    color: 'amber',
    options: ['Low', 'Medium', 'High', 'Critical'],
  },
  {
    type: 'category',
    label: 'Category',
    icon: Tag,
    color: 'indigo',
    options: ['SaaS', 'Services', 'Equipment', 'License'],
  },
  {
    type: 'role',
    label: 'Document Role',
    icon: FileText,
    color: 'cyan',
    options: ['New Contract', 'Existing', 'Amendment', 'Renewal'],
  },
  {
    type: 'expiration',
    label: 'Expiration',
    icon: AlertTriangle,
    color: 'red',
    options: ['Expired', 'Expiring Soon', 'Active', 'No Expiry'],
  },
  {
    type: 'supplier',
    label: 'Supplier',
    icon: Building2,
    color: 'teal',
    options: ['Acme Corp', 'TechVendor Inc', 'Global Solutions', 'Custom'],
  },
  {
    type: 'client',
    label: 'Client',
    icon: UserCircle,
    color: 'pink',
    options: ['Enterprise A', 'Company B', 'Partner C', 'Custom'],
  },
  {
    type: 'jurisdiction',
    label: 'Jurisdiction',
    icon: MapPin,
    color: 'orange',
    options: ['US', 'UK', 'EU', 'APAC', 'Global'],
  },
  {
    type: 'payment',
    label: 'Payment Terms',
    icon: CreditCard,
    color: 'green',
    options: ['Net 30', 'Net 60', 'Net 90', 'Immediate', 'Custom'],
  },
  {
    type: 'contractType',
    label: 'Contract Type',
    icon: FileStack,
    color: 'violet',
    options: ['MSA', 'SOW', 'NDA', 'SLA', 'Purchase Order'],
  },
  {
    type: 'currency',
    label: 'Currency',
    icon: Coins,
    color: 'slate',
    options: ['CHF', 'USD', 'EUR', 'GBP', 'JPY', 'AUD'],
  },
] as const;

// Color mapping for consistent styling
const getColorClasses = (color: string) => {
  const colorMap: Record<string, { border: string; bg: string; hover: string; icon: string; text: string }> = {
    blue: { border: 'border-violet-200', bg: 'bg-violet-50', hover: 'hover:bg-violet-100', icon: 'text-violet-600', text: 'text-violet-700' },
    purple: { border: 'border-violet-200', bg: 'bg-violet-50', hover: 'hover:bg-violet-100', icon: 'text-violet-600', text: 'text-violet-700' },
    emerald: { border: 'border-violet-200', bg: 'bg-violet-50', hover: 'hover:bg-violet-100', icon: 'text-violet-600', text: 'text-violet-700' },
    amber: { border: 'border-amber-200', bg: 'bg-amber-50', hover: 'hover:bg-amber-100', icon: 'text-amber-600', text: 'text-amber-700' },
    indigo: { border: 'border-indigo-200', bg: 'bg-violet-50', hover: 'hover:bg-violet-100', icon: 'text-violet-600', text: 'text-violet-700' },
    cyan: { border: 'border-cyan-200', bg: 'bg-violet-50', hover: 'hover:bg-violet-100', icon: 'text-violet-600', text: 'text-violet-700' },
    red: { border: 'border-red-200', bg: 'bg-red-50', hover: 'hover:bg-red-100', icon: 'text-red-600', text: 'text-red-700' },
    teal: { border: 'border-violet-200', bg: 'bg-violet-50', hover: 'hover:bg-violet-100', icon: 'text-violet-600', text: 'text-violet-700' },
    pink: { border: 'border-pink-200', bg: 'bg-pink-50', hover: 'hover:bg-pink-100', icon: 'text-pink-600', text: 'text-pink-700' },
    orange: { border: 'border-orange-200', bg: 'bg-orange-50', hover: 'hover:bg-orange-100', icon: 'text-orange-600', text: 'text-orange-700' },
    green: { border: 'border-green-200', bg: 'bg-green-50', hover: 'hover:bg-green-100', icon: 'text-green-600', text: 'text-green-700' },
    violet: { border: 'border-violet-200', bg: 'bg-violet-50', hover: 'hover:bg-violet-100', icon: 'text-violet-600', text: 'text-violet-700' },
    slate: { border: 'border-slate-200', bg: 'bg-slate-50', hover: 'hover:bg-slate-100', icon: 'text-slate-600', text: 'text-slate-700' },
  };
  
  return colorMap[color] || colorMap.blue;
};

const SAVED_TEMPLATES_KEY = 'contigo-filter-templates';

export function DragDropFilterBuilder({
  onApply,
  onClose,
  initialGroups = [],
  availableSuppliers = [],
  availableClients = [],
  availableContractTypes = [],
}: DragDropFilterBuilderProps) {
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>(
    initialGroups.length > 0
      ? initialGroups
      : [{ id: 'group-1', logic: 'AND', filters: [] }]
  );
  const [draggedTemplate, setDraggedTemplate] = useState<(typeof FILTER_TEMPLATES)[number] | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<Array<{ name: string; groups: FilterGroup[] }>>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(SAVED_TEMPLATES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  // Inter-group connector logic: how groups combine at the top level
  const [interGroupLogic, setInterGroupLogic] = useState<'AND' | 'OR'>('AND');

  // Build effective filter templates with dynamic options
  const effectiveTemplates = FILTER_TEMPLATES.map(t => {
    if (t.type === 'supplier' && availableSuppliers.length > 0) {
      return { ...t, options: availableSuppliers.slice(0, 6) as unknown as typeof t.options };
    }
    if (t.type === 'client' && availableClients.length > 0) {
      return { ...t, options: availableClients.slice(0, 6) as unknown as typeof t.options };
    }
    if (t.type === 'contractType' && availableContractTypes.length > 0) {
      return { ...t, options: availableContractTypes.slice(0, 6) as unknown as typeof t.options };
    }
    return t;
  });

  const addFilterToGroup = useCallback((groupId: string, template: (typeof FILTER_TEMPLATES)[number], overrideValue?: string) => {
    const newFilter: FilterBlock = {
      id: `filter-${Date.now()}`,
      type: template.type,
      label: template.label,
      operator: 'equals',
      value: overrideValue ?? template.options[0],
      color: template.color,
      icon: template.icon,
    };

    setFilterGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? { ...group, filters: [...group.filters, newFilter] }
          : group
      )
    );
  }, []);

  const removeFilter = useCallback((groupId: string, filterId: string) => {
    setFilterGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? { ...group, filters: group.filters.filter(f => f.id !== filterId) }
          : group
      )
    );
  }, []);

  const updateFilter = useCallback((groupId: string, filterId: string, updates: Partial<FilterBlock>) => {
    setFilterGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? {
              ...group,
              filters: group.filters.map(f =>
                f.id === filterId ? { ...f, ...updates } : f
              ),
            }
          : group
      )
    );
  }, []);

  const addGroup = useCallback(() => {
    const newGroup: FilterGroup = {
      id: `group-${Date.now()}`,
      logic: 'AND',
      filters: [],
    };
    setFilterGroups(groups => [...groups, newGroup]);
  }, []);

  const removeGroup = useCallback((groupId: string) => {
    setFilterGroups(groups => groups.filter(g => g.id !== groupId));
  }, []);

  const duplicateGroup = useCallback((groupId: string) => {
    setFilterGroups(groups => {
      const groupToDuplicate = groups.find(g => g.id === groupId);
      if (!groupToDuplicate) return groups;
      
      const newGroup: FilterGroup = {
        id: `group-${Date.now()}`,
        logic: groupToDuplicate.logic,
        filters: groupToDuplicate.filters.map(f => ({
          ...f,
          id: `filter-${Date.now()}-${Math.random()}`,
        })),
      };
      
      return [...groups, newGroup];
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterGroups([{ id: 'group-1', logic: 'AND', filters: [] }]);
    setInterGroupLogic('AND');
  }, []);

  const toggleGroupLogic = useCallback((groupId: string) => {
    setFilterGroups(groups =>
      groups.map(group =>
        group.id === groupId
          ? { ...group, logic: group.logic === 'AND' ? 'OR' : 'AND' }
          : group
      )
    );
  }, []);

  const handleDragStart = (template: (typeof FILTER_TEMPLATES)[number]) => {
    setDraggedTemplate(template);
  };

  const handleDragEnd = () => {
    setDraggedTemplate(null);
    setHoveredGroup(null);
  };

  const handleDrop = (groupId: string) => {
    if (draggedTemplate) {
      addFilterToGroup(groupId, draggedTemplate);
    }
    handleDragEnd();
  };

  const totalFilters = filterGroups.reduce((sum, group) => sum + group.filters.length, 0);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && totalFilters > 0) {
        onApply(filterGroups, interGroupLogic);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onApply, filterGroups, totalFilters, interGroupLogic]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-violet-50 to-purple-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Visual Filter Builder</h2>
                <p className="text-sm text-slate-600">
                  Drag filters to create powerful queries
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1">
                <Filter className="h-3 w-3 mr-1" />
                {totalFilters} {totalFilters === 1 ? 'filter' : 'filters'}
              </Badge>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Filter Palette */}
            <div className="w-64 border-r bg-slate-50 overflow-y-auto flex-shrink-0">
              <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h3 className="font-semibold text-sm text-slate-900">Filter Library</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Drag filters into the canvas to build your query
              </p>
              
              {/* Search Filters */}
              <div className="mb-4">
                <Input
                  placeholder="Search filters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-2">
                {effectiveTemplates
                  .filter(template => 
                    template.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    template.type.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .length === 0 ? (
                  <div className="text-center py-8">
                    <Filter className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No filters found</p>
                    <p className="text-xs text-slate-400">Try a different search</p>
                  </div>
                ) : (
                  effectiveTemplates
                    .filter(template => 
                      template.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      template.type.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((template) => {
                    const Icon = template.icon;
                    const colors = getColorClasses(template.color);
                    return (
                    <motion.div
                      key={template.type}
                      draggable
                      onDragStart={() => handleDragStart(template)}
                      onDragEnd={handleDragEnd}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all',
                        colors.border,
                        colors.bg,
                        colors.hover
                      )}
                    >
                      <Icon className={cn('h-4 w-4', colors.icon)} />
                      <span className="text-sm font-medium text-slate-900">
                        {template.label}
                      </span>
                      <GripVertical className="h-4 w-4 text-slate-400 ml-auto" />
                    </motion.div>
                  );
                })
              )}
              </div>

              <Separator className="my-4" />
              
              {/* Quick Presets */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Quick Presets</h4>
                <div className="space-y-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => {
                      // Active contracts
                      addFilterToGroup(filterGroups[0].id, effectiveTemplates.find(t => t.type === 'status')!, 'Active');
                    }}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-2 text-violet-600" />
                    Active Contracts
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => {
                      // Expiring soon
                      addFilterToGroup(filterGroups[0].id, effectiveTemplates.find(t => t.type === 'expiration')!, 'Expiring Soon');
                    }}
                  >
                    <AlertTriangle className="h-3 w-3 mr-2 text-red-600" />
                    Expiring Soon
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => {
                      // High value
                      addFilterToGroup(filterGroups[0].id, effectiveTemplates.find(t => t.type === 'value')!, '> $1M');
                    }}
                  >
                    <DollarSign className="h-3 w-3 mr-2 text-violet-600" />
                    High Value (&gt;$100K)
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowTemplateList(!showTemplateList)}
                >
                  <Save className="h-3.5 w-3.5" />
                  Load Template
                  {savedTemplates.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">{savedTemplates.length}</Badge>
                  )}
                </Button>
                {showTemplateList && savedTemplates.length > 0 && (
                  <div className="space-y-1 pl-2 border-l-2 border-slate-200 ml-2">
                    {savedTemplates.map((tmpl, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 justify-start text-xs h-7 truncate"
                          onClick={() => {
                            setFilterGroups(tmpl.groups);
                            setShowTemplateList(false);
                          }}
                        >
                          {tmpl.name}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                          onClick={() => {
                            const updated = savedTemplates.filter((_, i) => i !== idx);
                            setSavedTemplates(updated);
                            localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(updated));
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {showTemplateList && savedTemplates.length === 0 && (
                  <p className="text-xs text-slate-400 pl-4">No saved templates yet</p>
                )}
                {showSaveInput ? (
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="Template name..."
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="h-7 text-xs flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && templateName.trim()) {
                          const updated = [...savedTemplates, { name: templateName.trim(), groups: filterGroups }];
                          setSavedTemplates(updated);
                          localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(updated));
                          setTemplateName('');
                          setShowSaveInput(false);
                        }
                        if (e.key === 'Escape') setShowSaveInput(false);
                      }}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={!templateName.trim()}
                      onClick={() => {
                        if (templateName.trim()) {
                          const updated = [...savedTemplates, { name: templateName.trim(), groups: filterGroups }];
                          setSavedTemplates(updated);
                          localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(updated));
                          setTemplateName('');
                          setShowSaveInput(false);
                        }
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => setShowSaveInput(true)}
                    disabled={filterGroups.every(g => g.filters.length === 0)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Save as Template
                  </Button>
                )}
              </div>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 p-6 overflow-y-auto bg-gradient-to-br from-slate-50 to-purple-50/30">
              <div className="space-y-4">
                {filterGroups.map((group, groupIndex) => (
                  <div key={group.id}>
                    {/* Group Connector */}
                    {groupIndex > 0 && (
                      <div className="flex items-center justify-center py-2 gap-2">
                        <div className="flex-1 h-px bg-slate-300" />
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "border-2 font-semibold shadow-sm z-10 transition-colors",
                            interGroupLogic === 'OR'
                              ? "bg-amber-50 border-amber-400 hover:border-amber-500 text-amber-700"
                              : "bg-white border-slate-300 hover:border-indigo-400"
                          )}
                          onClick={() => setInterGroupLogic(prev => prev === 'AND' ? 'OR' : 'AND')}
                          title={`Click to toggle: groups are combined with ${interGroupLogic}. ${interGroupLogic === 'AND' ? 'All groups must match.' : 'Any group can match.'}`}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          {interGroupLogic}
                        </Button>
                        <div className="flex-1 h-px bg-slate-300" />
                      </div>
                    )}

                    {/* Filter Group */}
                    <motion.div
                      layout
                      className={cn(
                        'relative rounded-xl border-2 border-dashed transition-all',
                        hoveredGroup === group.id
                          ? 'border-indigo-400 bg-violet-50/50'
                          : 'border-slate-300 bg-white'
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setHoveredGroup(group.id);
                      }}
                      onDragLeave={() => setHoveredGroup(null)}
                      onDrop={() => handleDrop(group.id)}
                    >
                      {/* Group Header */}
                      <div className="flex items-center justify-between p-3 border-b">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 font-semibold"
                            onClick={() => toggleGroupLogic(group.id)}
                          >
                            {group.logic}
                          </Button>
                          <span className="text-xs text-slate-500">
                            Match {group.logic === 'AND' ? 'all' : 'any'} conditions
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {group.filters.length}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => duplicateGroup(group.id)}
                            title="Duplicate group"
                          >
                            <Copy className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                          {filterGroups.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removeGroup(group.id)}
                              title="Delete group"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Filters */}
                      <div className="p-3 min-h-[100px]">
                        {group.filters.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="p-4 rounded-full bg-slate-100 mb-3"
                            >
                              <Filter className="h-6 w-6 text-slate-400" />
                            </motion.div>
                            <p className="text-sm font-medium text-slate-600">
                              Drop filters here
                            </p>
                            <p className="text-xs text-slate-400">
                              Or click + to add manually
                            </p>
                          </div>
                        ) : (
                          <Reorder.Group
                            axis="y"
                            values={group.filters}
                            onReorder={(newOrder) => {
                              setFilterGroups(groups =>
                                groups.map(g =>
                                  g.id === group.id ? { ...g, filters: newOrder } : g
                                )
                              );
                            }}
                            className="space-y-2"
                          >
                            {group.filters.map((filter, filterIndex) => {
                              const Icon = filter.icon;
                              const template = effectiveTemplates.find(t => t.type === filter.type);
                              const colors = getColorClasses(filter.color);

                              return (
                                <Reorder.Item
                                  key={filter.id}
                                  value={filter}
                                  className="relative"
                                >
                                  {/* Filter Connector */}
                                  {filterIndex > 0 && (
                                    <div className="flex items-center justify-center -mt-1 mb-1">
                                      <Badge
                                        variant="secondary"
                                        className="text-xs font-semibold px-2 py-0.5"
                                      >
                                        {group.logic}
                                      </Badge>
                                    </div>
                                  )}

                                  <motion.div
                                    layout
                                    whileHover={{ scale: 1.01 }}
                                    className={cn(
                                      'flex items-center gap-3 p-3 rounded-lg border-2 bg-white shadow-sm transition-shadow hover:shadow-md',
                                      colors.border
                                    )}
                                  >
                                    <GripVertical className="h-4 w-4 text-slate-400 cursor-grab active:cursor-grabbing" />
                                    <div
                                      className={cn(
                                        'p-2 rounded-lg',
                                        colors.bg
                                      )}
                                    >
                                      <Icon className={cn('h-4 w-4', colors.icon)} />
                                    </div>
                                    <div className="flex-1 grid grid-cols-3 gap-2">
                                      <div>
                                        <Label className="text-xs text-slate-500">Field</Label>
                                        <p className="text-sm font-medium">{filter.label}</p>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-slate-500">Operator</Label>
                                        <Select
                                          value={filter.operator}
                                          onValueChange={(value) =>
                                            updateFilter(group.id, filter.id, {
                                              operator: value as any,
                                            })
                                          }
                                        >
                                          <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="equals">Equals</SelectItem>
                                            <SelectItem value="contains">Contains</SelectItem>
                                            <SelectItem value="greater">Greater than</SelectItem>
                                            <SelectItem value="less">Less than</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-slate-500">Value</Label>
                                        {template && (
                                          <Select
                                            value={filter.value}
                                            onValueChange={(value) =>
                                              updateFilter(group.id, filter.id, { value })
                                            }
                                          >
                                            <SelectTrigger className="h-8 text-sm">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {template.options.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                  {option}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        )}
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => removeFilter(group.id, filter.id)}
                                    >
                                      <X className="h-4 w-4 text-slate-400" />
                                    </Button>
                                  </motion.div>
                                </Reorder.Item>
                              );
                            })}
                          </Reorder.Group>
                        )}
                      </div>
                    </motion.div>
                  </div>
                ))}

                {/* Add Group Button */}
                <Button
                  variant="outline"
                  className="w-full border-dashed border-2 h-12"
                  onClick={addGroup}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Filter Group
                </Button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t bg-slate-50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>
                  {totalFilters === 0
                    ? 'No filters applied'
                    : `Filtering ${totalFilters} condition${totalFilters !== 1 ? 's' : ''}`}
                </span>
              </div>
              {totalFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Clear All
                </Button>
              )}
              <span className="text-xs text-slate-400">Press ESC to close</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => onApply(filterGroups, interGroupLogic)}
                disabled={totalFilters === 0}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
