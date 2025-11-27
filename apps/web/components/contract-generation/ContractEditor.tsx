'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save,
  Undo,
  Redo,
  Eye,
  EyeOff,
  Settings,
  Send,
  Download,
  Share2,
  MessageSquare,
  History,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  Sparkles,
  FileText,
  Users,
  X,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  BookOpen,
  Lightbulb,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useDataMode } from '@/contexts/DataModeContext';
import { useToast } from '@/hooks/use-toast';
import type { 
  ContractDraft, 
  DraftClause, 
  LibraryClause, 
  TemplateVariable,
  RiskLevel 
} from '@/types/contract-generation';

// ====================
// TYPES
// ====================

interface EditorProps {
  draft: ContractDraft;
  onSave: (draft: ContractDraft) => void;
  onSubmit: () => void;
}

interface ClauseInsertPosition {
  sectionId: string;
  afterClauseId?: string;
}

// ====================
// MOCK DATA
// ====================

const mockClauses: DraftClause[] = [
  {
    id: 'c1',
    draftId: 'd1',
    title: 'Definitions',
    content: `For purposes of this Agreement, the following terms shall have the meanings set forth below:\n\n"Affiliate" means any entity that directly or indirectly controls, is controlled by, or is under common control with a party.\n\n"Confidential Information" means all non-public information disclosed by one party to the other...\n\n"Services" means the consulting services to be provided by Supplier as described in Exhibit A.`,
    isModified: false,
    order: 1,
    status: 'INCLUDED',
    riskLevel: 'LOW',
    isNegotiated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'c2',
    draftId: 'd1',
    title: 'Scope of Services',
    content: `Supplier agrees to provide the Services as described in Exhibit A, attached hereto and incorporated by reference. The Services shall be performed in accordance with the highest professional standards and in compliance with all applicable laws and regulations.\n\nSupplier shall assign qualified personnel to perform the Services and shall ensure that such personnel have the necessary skills, training, and experience.`,
    isModified: true,
    originalContent: `Supplier agrees to provide the Services as described in Exhibit A.`,
    order: 2,
    status: 'NEGOTIATING',
    riskLevel: 'MEDIUM',
    isNegotiated: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'c3',
    draftId: 'd1',
    title: 'Term and Termination',
    content: `This Agreement shall commence on the Effective Date and shall continue for an initial term of three (3) years ("Initial Term"), unless earlier terminated in accordance with this Section.\n\nEither party may terminate this Agreement:\n(a) For cause, upon thirty (30) days written notice if the other party materially breaches this Agreement...\n(b) For convenience, upon ninety (90) days prior written notice...`,
    isModified: false,
    order: 3,
    status: 'INCLUDED',
    riskLevel: 'MEDIUM',
    isNegotiated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'c4',
    draftId: 'd1',
    title: 'Limitation of Liability',
    content: `EXCEPT FOR BREACHES OF CONFIDENTIALITY OBLIGATIONS, INDEMNIFICATION OBLIGATIONS, OR WILLFUL MISCONDUCT:\n\n(a) NEITHER PARTY SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES...\n\n(b) SUPPLIER'S TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY CLIENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.`,
    isModified: false,
    order: 4,
    status: 'PENDING_REVIEW',
    riskLevel: 'HIGH',
    riskNotes: 'Standard liability cap may need adjustment based on contract value',
    isNegotiated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockLibraryClauses: LibraryClause[] = [
  {
    id: 'lib1',
    tenantId: 'demo',
    name: 'standard_indemnification',
    title: 'Standard Indemnification',
    category: 'INDEMNIFICATION',
    content: 'Each party shall indemnify, defend, and hold harmless the other party...',
    riskLevel: 'MEDIUM',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['indemnification', 'standard'],
    usageCount: 45,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lib2',
    tenantId: 'demo',
    name: 'data_protection',
    title: 'Data Protection & GDPR',
    category: 'DATA_PROTECTION',
    content: 'The parties agree to comply with all applicable data protection laws...',
    riskLevel: 'HIGH',
    isStandard: true,
    isMandatory: true,
    isNegotiable: false,
    tags: ['gdpr', 'data', 'privacy', 'mandatory'],
    usageCount: 78,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lib3',
    tenantId: 'demo',
    name: 'force_majeure',
    title: 'Force Majeure',
    category: 'FORCE_MAJEURE',
    content: 'Neither party shall be liable for any failure or delay in performing...',
    riskLevel: 'LOW',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['force majeure', 'acts of god'],
    usageCount: 56,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockVariables: TemplateVariable[] = [
  { id: 'v1', name: 'client_name', displayName: 'Client Name', type: 'text', required: true },
  { id: 'v2', name: 'supplier_name', displayName: 'Supplier Name', type: 'text', required: true },
  { id: 'v3', name: 'effective_date', displayName: 'Effective Date', type: 'date', required: true },
  { id: 'v4', name: 'contract_value', displayName: 'Contract Value', type: 'currency', required: true },
  { id: 'v5', name: 'payment_terms', displayName: 'Payment Terms (Days)', type: 'number', required: true, defaultValue: 30 },
  { id: 'v6', name: 'governing_law', displayName: 'Governing Law', type: 'select', required: true, options: [
    { value: 'swiss', label: 'Swiss Law' },
    { value: 'english', label: 'English Law' },
    { value: 'german', label: 'German Law' },
    { value: 'new_york', label: 'New York Law' },
  ]},
];

// ====================
// RISK INDICATOR
// ====================

const riskColors: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  HIGH: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
};

function RiskIndicator({ level }: { level: RiskLevel }) {
  const colors = riskColors[level];
  return (
    <Badge className={cn('gap-1', colors.bg, colors.text, colors.border)} variant="outline">
      {level === 'HIGH' || level === 'CRITICAL' ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <CheckCircle2 className="h-3 w-3" />
      )}
      {level}
    </Badge>
  );
}

// ====================
// CLAUSE EDITOR BLOCK
// ====================

interface ClauseBlockProps {
  clause: DraftClause;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (content: string) => void;
  onDelete: () => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}

function ClauseBlock({
  clause,
  isSelected,
  onSelect,
  onChange,
  onDelete,
  isEditing,
  onStartEdit,
  onEndEdit,
}: ClauseBlockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [isEditing]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'group relative border rounded-lg transition-all',
        isSelected ? 'border-primary shadow-md' : 'border-transparent hover:border-muted-foreground/30',
        clause.isModified && 'ring-1 ring-amber-300'
      )}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Main Content */}
      <div className="ml-8 p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{clause.title}</h4>
            <RiskIndicator level={clause.riskLevel} />
            {clause.isModified && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                Modified
              </Badge>
            )}
            {clause.status === 'NEGOTIATING' && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                Negotiating
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>AI Suggestions</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <History className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View History</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Clause</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <Textarea
            ref={textareaRef}
            value={clause.content}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onEndEdit}
            className="min-h-[150px] font-mono text-sm resize-none"
          />
        ) : (
          <div
            className="prose prose-sm max-w-none text-sm whitespace-pre-wrap cursor-text hover:bg-muted/30 rounded p-2 -m-2 transition-colors"
            onDoubleClick={onStartEdit}
          >
            {clause.content}
          </div>
        )}

        {/* Risk Notes */}
        {clause.riskNotes && (
          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">{clause.riskNotes}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ====================
// CLAUSE LIBRARY SIDEBAR
// ====================

interface ClauseLibrarySidebarProps {
  onInsert: (clause: LibraryClause) => void;
  libraryClauses: LibraryClause[];
}

function ClauseLibrarySidebar({ onInsert, libraryClauses }: ClauseLibrarySidebarProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [...new Set(libraryClauses.map(c => c.category))];
  
  const filteredClauses = libraryClauses.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
                          c.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Clause Library</h3>
        </div>
        <Input
          placeholder="Search clauses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8"
        />
        <div className="flex flex-wrap gap-1">
          <Badge
            variant={selectedCategory === null ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Badge>
          {categories.map(cat => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.replace('_', ' ')}
            </Badge>
          ))}
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredClauses.map(clause => (
            <Card
              key={clause.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => onInsert(clause)}
            >
              <CardHeader className="p-3 pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">{clause.title}</CardTitle>
                  <RiskIndicator level={clause.riskLevel} />
                </div>
                <CardDescription className="text-xs flex items-center gap-2">
                  {clause.isMandatory && (
                    <Badge variant="destructive" className="text-xs h-4">Required</Badge>
                  )}
                  <span>{clause.usageCount} uses</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {clause.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ====================
// VARIABLES SIDEBAR
// ====================

interface VariablesSidebarProps {
  variables: TemplateVariable[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
}

function VariablesSidebar({ variables, values, onChange }: VariablesSidebarProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Contract Variables</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Fill in the variables used throughout the contract
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {variables.map(variable => (
            <div key={variable.id} className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1">
                {variable.displayName}
                {variable.required && <span className="text-destructive">*</span>}
              </label>
              {variable.type === 'text' && (
                <Input
                  value={values[variable.name] || ''}
                  onChange={(e) => onChange(variable.name, e.target.value)}
                  placeholder={variable.placeholder}
                  className="h-8"
                />
              )}
              {variable.type === 'number' && (
                <Input
                  type="number"
                  value={values[variable.name] || variable.defaultValue || ''}
                  onChange={(e) => onChange(variable.name, Number(e.target.value))}
                  className="h-8"
                />
              )}
              {variable.type === 'date' && (
                <Input
                  type="date"
                  value={values[variable.name] || ''}
                  onChange={(e) => onChange(variable.name, e.target.value)}
                  className="h-8"
                />
              )}
              {variable.type === 'currency' && (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={values[variable.name] || ''}
                    onChange={(e) => onChange(variable.name, Number(e.target.value))}
                    placeholder="Amount"
                    className="h-8 flex-1"
                  />
                  <select className="h-8 px-2 border rounded-md text-sm">
                    <option>USD</option>
                    <option>EUR</option>
                    <option>CHF</option>
                    <option>GBP</option>
                  </select>
                </div>
              )}
              {variable.type === 'select' && (
                <select
                  value={values[variable.name] || ''}
                  onChange={(e) => onChange(variable.name, e.target.value)}
                  className="w-full h-8 px-2 border rounded-md text-sm"
                >
                  <option value="">Select...</option>
                  {variable.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              {variable.helpText && (
                <p className="text-xs text-muted-foreground">{variable.helpText}</p>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ====================
// AI SUGGESTIONS PANEL
// ====================

function AISuggestionsPanel() {
  const suggestions = [
    {
      id: 's1',
      type: 'risk',
      title: 'High Liability Exposure',
      description: 'The liability cap is set at 12 months of fees. Consider adding a floor amount.',
      clauseId: 'c4',
      action: 'Review Clause',
    },
    {
      id: 's2',
      type: 'improvement',
      title: 'Add Data Protection Clause',
      description: 'This contract involves data processing. Consider adding GDPR-compliant clause.',
      clauseId: null,
      action: 'Add Clause',
    },
    {
      id: 's3',
      type: 'negotiation',
      title: 'Payment Terms',
      description: 'Standard payment terms are Net 30. Current contract has Net 45.',
      clauseId: null,
      action: 'View Options',
    },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-600" />
        <h3 className="font-semibold">AI Insights</h3>
      </div>
      
      <div className="space-y-2">
        {suggestions.map(suggestion => (
          <Card key={suggestion.id} className={cn(
            'transition-colors hover:border-primary cursor-pointer',
            suggestion.type === 'risk' && 'border-l-4 border-l-red-500',
            suggestion.type === 'improvement' && 'border-l-4 border-l-blue-500',
            suggestion.type === 'negotiation' && 'border-l-4 border-l-amber-500',
          )}>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {suggestion.type === 'risk' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                {suggestion.type === 'improvement' && <Lightbulb className="h-4 w-4 text-blue-500" />}
                {suggestion.type === 'negotiation' && <Users className="h-4 w-4 text-amber-500" />}
                {suggestion.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-xs text-muted-foreground mb-2">{suggestion.description}</p>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                {suggestion.action}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ====================
// MAIN EDITOR COMPONENT
// ====================

export function ContractEditor({ draft, onSave, onSubmit }: EditorProps) {
  const { useRealData } = useDataMode();
  const { toast } = useToast();
  
  const [clauses, setClauses] = useState<DraftClause[]>([]);
  const [libraryClauses, setLibraryClauses] = useState<LibraryClause[]>(mockLibraryClauses);
  const [variables, setVariables] = useState<TemplateVariable[]>(mockVariables);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, unknown>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [sidebarView, setSidebarView] = useState<'library' | 'variables' | 'ai'>('library');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch clauses from database
  const fetchClauses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clauses?draftId=${draft.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.clauses?.length > 0) {
          setClauses(data.clauses);
          toast({
            title: 'Clauses loaded',
            description: `${data.clauses.length} clause(s) loaded from database`,
          });
        } else {
          setClauses(mockClauses);
        }
      } else {
        setClauses(mockClauses);
      }
    } catch (error) {
      console.error('Failed to fetch clauses:', error);
      setClauses(mockClauses);
    } finally {
      setLoading(false);
    }
  }, [draft.id, toast]);

  // Fetch library clauses
  const fetchLibraryClauses = useCallback(async () => {
    try {
      const response = await fetch('/api/clauses/library');
      if (response.ok) {
        const data = await response.json();
        if (data.clauses?.length > 0) {
          setLibraryClauses(data.clauses);
        }
      }
    } catch (error) {
      console.error('Failed to fetch library clauses:', error);
    }
  }, []);

  // Fetch template variables
  const fetchVariables = useCallback(async () => {
    try {
      const response = await fetch(`/api/templates/${draft.templateId}/variables`);
      if (response.ok) {
        const data = await response.json();
        if (data.variables?.length > 0) {
          setVariables(data.variables);
        }
      }
    } catch (error) {
      console.error('Failed to fetch variables:', error);
    }
  }, [draft.templateId]);

  useEffect(() => {
    fetchClauses();
    fetchLibraryClauses();
    fetchVariables();
  }, [fetchClauses, fetchLibraryClauses, fetchVariables]);

  const handleClauseChange = useCallback((clauseId: string, content: string) => {
    setClauses(prev => prev.map(c => 
      c.id === clauseId 
        ? { ...c, content, isModified: true, updatedAt: new Date() }
        : c
    ));
  }, []);

  const handleDeleteClause = useCallback((clauseId: string) => {
    setClauses(prev => prev.filter(c => c.id !== clauseId));
  }, []);

  const handleInsertClause = useCallback((libraryClause: LibraryClause) => {
    const newClause: DraftClause = {
      id: `c${Date.now()}`,
      draftId: draft.id,
      clauseId: libraryClause.id,
      title: libraryClause.title,
      content: libraryClause.content,
      isModified: false,
      order: clauses.length + 1,
      status: 'INCLUDED',
      riskLevel: libraryClause.riskLevel,
      isNegotiated: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setClauses(prev => [...prev, newClause]);
  }, [draft.id, clauses.length]);

  const handleVariableChange = useCallback((name: string, value: any) => {
    setVariableValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    onSave(draft);
  }, [draft, onSave]);

  // Calculate risk score
  const riskScore = clauses.reduce((acc, c) => {
    const weights = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    return acc + weights[c.riskLevel];
  }, 0) / clauses.length * 33;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{draft.title}</h2>
              <Badge variant={useRealData ? "default" : "secondary"} className="text-xs">
                {useRealData ? "Live" : "Mock"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Version {draft.version} • Last saved 2 min ago</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Undo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Redo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-2">
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            Preview
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" onClick={onSubmit} className="gap-2">
            <Send className="h-4 w-4" />
            Submit for Approval
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Risk Score Bar */}
          <div className="px-6 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Risk Score</span>
              <div className="flex-1 max-w-xs">
                <Progress 
                  value={riskScore} 
                  className={cn(
                    'h-2',
                    riskScore < 33 && '[&>div]:bg-green-500',
                    riskScore >= 33 && riskScore < 66 && '[&>div]:bg-amber-500',
                    riskScore >= 66 && '[&>div]:bg-red-500',
                  )}
                />
              </div>
              <Badge variant="outline" className={cn(
                riskScore < 33 && 'bg-green-50 text-green-700 border-green-200',
                riskScore >= 33 && riskScore < 66 && 'bg-amber-50 text-amber-700 border-amber-200',
                riskScore >= 66 && 'bg-red-50 text-red-700 border-red-200',
              )}>
                {riskScore < 33 ? 'Low Risk' : riskScore < 66 ? 'Medium Risk' : 'High Risk'}
              </Badge>
              <span className="text-xs text-muted-foreground">{clauses.length} clauses</span>
            </div>
          </div>

          {/* Document Content */}
          <ScrollArea className="flex-1">
            <div className="max-w-4xl mx-auto py-8 px-6 space-y-4">
              <AnimatePresence mode="popLayout">
                {clauses.map(clause => (
                  <ClauseBlock
                    key={clause.id}
                    clause={clause}
                    isSelected={selectedClauseId === clause.id}
                    onSelect={() => setSelectedClauseId(clause.id)}
                    onChange={(content) => handleClauseChange(clause.id, content)}
                    onDelete={() => handleDeleteClause(clause.id)}
                    isEditing={editingClauseId === clause.id}
                    onStartEdit={() => setEditingClauseId(clause.id)}
                    onEndEdit={() => setEditingClauseId(null)}
                  />
                ))}
              </AnimatePresence>

              {/* Add Clause Button */}
              <Button
                variant="outline"
                className="w-full h-16 border-dashed border-2"
                onClick={() => setSidebarView('library')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Clause from Library
              </Button>
            </div>
          </ScrollArea>
        </div>

        {/* Sidebar */}
        <div className={cn(
          'border-l transition-all duration-300 bg-muted/30',
          sidebarCollapsed ? 'w-12' : 'w-80'
        )}>
          {sidebarCollapsed ? (
            <div className="p-2 space-y-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(false)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Separator />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sidebarView === 'library' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => { setSidebarView('library'); setSidebarCollapsed(false); }}
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Clause Library</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sidebarView === 'variables' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => { setSidebarView('variables'); setSidebarCollapsed(false); }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Variables</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={sidebarView === 'ai' ? 'secondary' : 'ghost'}
                      size="icon"
                      onClick={() => { setSidebarView('ai'); setSidebarCollapsed(false); }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">AI Insights</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-2 border-b">
                <div className="flex">
                  <Button
                    variant={sidebarView === 'library' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSidebarView('library')}
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={sidebarView === 'variables' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSidebarView('variables')}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={sidebarView === 'ai' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSidebarView('ai')}
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSidebarCollapsed(true)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-hidden">
                {sidebarView === 'library' && (
                  <ClauseLibrarySidebar onInsert={handleInsertClause} libraryClauses={libraryClauses} />
                )}
                {sidebarView === 'variables' && (
                  <VariablesSidebar
                    variables={variables}
                    values={variableValues}
                    onChange={handleVariableChange}
                  />
                )}
                {sidebarView === 'ai' && <AISuggestionsPanel />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContractEditor;
