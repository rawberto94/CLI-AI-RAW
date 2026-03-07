'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  LayoutGrid, Plus, Trash2, GripVertical, Settings, Save, Undo2,
  BarChart3, TrendingUp, FileText, Clock, DollarSign, Shield,
  AlertTriangle, Users, Activity, Eye, EyeOff, Maximize2, Minimize2,
  ChevronUp, ChevronDown, Columns, Rows, Palette
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Widget types available for the dashboard
interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  size: 'sm' | 'md' | 'lg' | 'full';
  order: number;
  visible: boolean;
  config: Record<string, any>;
}

interface WidgetTemplate {
  type: string;
  label: string;
  description: string;
  icon: React.ElementType;
  defaultSize: 'sm' | 'md' | 'lg' | 'full';
  category: string;
}

const WIDGET_TEMPLATES: WidgetTemplate[] = [
  { type: 'kpi_cards', label: 'KPI Cards', description: 'Key performance indicators row', icon: BarChart3, defaultSize: 'full', category: 'overview' },
  { type: 'lifecycle_pipeline', label: 'Lifecycle Pipeline', description: 'Contract stage visualization', icon: Activity, defaultSize: 'full', category: 'overview' },
  { type: 'quick_actions', label: 'Quick Actions', description: 'Shortcut action buttons', icon: LayoutGrid, defaultSize: 'full', category: 'overview' },
  { type: 'recent_contracts', label: 'Recent Contracts', description: 'Latest contract activity', icon: FileText, defaultSize: 'md', category: 'contracts' },
  { type: 'ai_assistant', label: 'AI Assistant', description: 'AI chat preview', icon: Activity, defaultSize: 'md', category: 'intelligence' },
  { type: 'contract_overview', label: 'Contract Overview', description: 'Status breakdown chart', icon: BarChart3, defaultSize: 'full', category: 'contracts' },
  { type: 'renewal_tracker', label: 'Renewal Tracker', description: 'Upcoming renewals timeline', icon: Clock, defaultSize: 'md', category: 'contracts' },
  { type: 'spend_summary', label: 'Spend Summary', description: 'Financial overview', icon: DollarSign, defaultSize: 'md', category: 'finance' },
  { type: 'compliance_score', label: 'Compliance Score', description: 'Compliance gauge and trends', icon: Shield, defaultSize: 'sm', category: 'governance' },
  { type: 'risk_alerts', label: 'Risk Alerts', description: 'Active risk notifications', icon: AlertTriangle, defaultSize: 'md', category: 'governance' },
  { type: 'sla_status', label: 'SLA Status', description: 'SLA compliance overview', icon: TrendingUp, defaultSize: 'sm', category: 'governance' },
  { type: 'team_activity', label: 'Team Activity', description: 'Recent team actions feed', icon: Users, defaultSize: 'md', category: 'overview' },
  { type: 'vendor_risk', label: 'Vendor Risk Map', description: 'Vendor risk heat map', icon: AlertTriangle, defaultSize: 'md', category: 'governance' },
  { type: 'expiring_contracts', label: 'Expiring Soon', description: 'Contracts expiring within 90 days', icon: Clock, defaultSize: 'md', category: 'contracts' },
];

const SIZE_CLASSES: Record<string, string> = {
  sm: 'col-span-1',
  md: 'col-span-1 md:col-span-2',
  lg: 'col-span-1 md:col-span-3',
  full: 'col-span-1 md:col-span-4',
};

const STORAGE_KEY = 'contigo_dashboard_layout';

function getDefaultWidgets(): DashboardWidget[] {
  return [
    { id: 'w1', type: 'kpi_cards', title: 'KPI Cards', size: 'full', order: 0, visible: true, config: {} },
    { id: 'w2', type: 'lifecycle_pipeline', title: 'Lifecycle Pipeline', size: 'full', order: 1, visible: true, config: {} },
    { id: 'w3', type: 'quick_actions', title: 'Quick Actions', size: 'full', order: 2, visible: true, config: {} },
    { id: 'w4', type: 'recent_contracts', title: 'Recent Contracts', size: 'md', order: 3, visible: true, config: {} },
    { id: 'w5', type: 'ai_assistant', title: 'AI Assistant', size: 'md', order: 4, visible: true, config: {} },
    { id: 'w6', type: 'contract_overview', title: 'Contract Overview', size: 'full', order: 5, visible: true, config: {} },
  ];
}

interface CustomDashboardBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (widgets: DashboardWidget[]) => void;
  currentWidgets?: DashboardWidget[];
}

export default function CustomDashboardBuilder({ open, onOpenChange, onSave, currentWidgets }: CustomDashboardBuilderProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    if (currentWidgets?.length) return currentWidgets;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return getDefaultWidgets();
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dragSourceIdx, setDragSourceIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<DashboardWidget[][]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), widgets.map(w => ({ ...w }))]);
  }, [widgets]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    setWidgets(undoStack[undoStack.length - 1]);
    setUndoStack(s => s.slice(0, -1));
  }, [undoStack]);

  const addWidget = (template: WidgetTemplate) => {
    pushUndo();
    const newWidget: DashboardWidget = {
      id: 'w_' + Date.now().toString(36),
      type: template.type,
      title: template.label,
      size: template.defaultSize,
      order: widgets.length,
      visible: true,
      config: {},
    };
    setWidgets(prev => [...prev, newWidget]);
    setAddDialogOpen(false);
    toast.success(`Added ${template.label}`);
  };

  const removeWidget = (id: string) => {
    pushUndo();
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const toggleVisibility = (id: string) => {
    pushUndo();
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const changeSize = (id: string, size: DashboardWidget['size']) => {
    pushUndo();
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, size } : w));
  };

  const moveWidget = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    pushUndo();
    setWidgets(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next.map((w, i) => ({ ...w, order: i }));
    });
  };

  const moveUp = (idx: number) => { if (idx > 0) moveWidget(idx, idx - 1); };
  const moveDown = (idx: number) => { if (idx < widgets.length - 1) moveWidget(idx, idx + 1); };

  const handleSave = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets)); } catch { /* ignore */ }
    onSave(widgets);
    onOpenChange(false);
    toast.success('Dashboard layout saved');
  };

  const handleReset = () => {
    pushUndo();
    setWidgets(getDefaultWidgets());
    toast.info('Reset to default layout');
  };

  const categories = useMemo(() => {
    const cats = new Set(WIDGET_TEMPLATES.map(t => t.category));
    return ['all', ...cats];
  }, []);

  const filteredTemplates = WIDGET_TEMPLATES.filter(t =>
    categoryFilter === 'all' || t.category === categoryFilter
  );

  const usedTypes = new Set(widgets.map(w => w.type));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" /> Customize Dashboard
            </DialogTitle>
            <DialogDescription>
              Drag to reorder, resize widgets, and toggle visibility. Changes are saved per user.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-2">
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Widget
            </Button>
            <Button size="sm" variant="outline" onClick={undo} disabled={undoStack.length === 0}>
              <Undo2 className="h-3 w-3 mr-1" /> Undo
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReset}>Reset to Default</Button>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <span>{widgets.length} widgets</span>
              <span>·</span>
              <span>{widgets.filter(w => w.visible).length} visible</span>
            </div>
          </div>

          <Separator />

          <ScrollArea className="flex-1 max-h-[55vh]">
            <div className="space-y-2 py-2">
              {widgets.map((widget, idx) => {
                const template = WIDGET_TEMPLATES.find(t => t.type === widget.type);
                const Icon = template?.icon || LayoutGrid;
                const isDragOver = dragOverIdx === idx && dragSourceIdx !== idx;

                return (
                  <div key={widget.id}>
                    {isDragOver && <div className="h-0.5 bg-primary rounded-full mb-1" />}
                    <div
                      draggable
                      onDragStart={() => setDragSourceIdx(idx)}
                      onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={() => { if (dragSourceIdx !== null) moveWidget(dragSourceIdx, idx); setDragSourceIdx(null); setDragOverIdx(null); }}
                      onDragEnd={() => { setDragSourceIdx(null); setDragOverIdx(null); }}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-all group',
                        widget.visible ? 'bg-card' : 'bg-muted/50 opacity-60',
                        dragSourceIdx === idx && 'opacity-40'
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />

                      <div className={cn('p-2 rounded-lg', widget.visible ? 'bg-primary/10' : 'bg-muted')}>
                        <Icon className={cn('h-4 w-4', widget.visible ? 'text-primary' : 'text-muted-foreground')} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{widget.title}</span>
                          {!widget.visible && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{template?.description}</p>
                      </div>

                      {/* Size selector */}
                      <Select value={widget.size} onValueChange={(v) => changeSize(widget.id, v as DashboardWidget['size'])}>
                        <SelectTrigger className="w-20 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sm">Small</SelectItem>
                          <SelectItem value="md">Medium</SelectItem>
                          <SelectItem value="lg">Large</SelectItem>
                          <SelectItem value="full">Full</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveUp(idx)} disabled={idx === 0}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveDown(idx)} disabled={idx === widgets.length - 1}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleVisibility(widget.id)}>
                          {widget.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeWidget(widget.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {widgets.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No widgets. Click &quot;Add Widget&quot; to get started.</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Preview grid */}
          <Separator />
          <div className="pt-2">
            <Label className="text-xs text-muted-foreground mb-2 block">Layout Preview</Label>
            <div className="grid grid-cols-4 gap-1 p-2 bg-muted/30 rounded-lg max-h-20 overflow-hidden">
              {widgets.filter(w => w.visible).map(w => (
                <div
                  key={w.id}
                  className={cn(
                    'h-4 rounded bg-primary/20 border border-primary/30',
                    w.size === 'sm' && 'col-span-1',
                    w.size === 'md' && 'col-span-2',
                    w.size === 'lg' && 'col-span-3',
                    w.size === 'full' && 'col-span-4',
                  )}
                  title={w.title}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" /> Save Layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Widget Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>Choose a widget to add to your dashboard</DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={categoryFilter === cat ? 'default' : 'outline'}
                onClick={() => setCategoryFilter(cat)}
                className="capitalize text-xs"
              >
                {cat}
              </Button>
            ))}
          </div>

          <ScrollArea className="flex-1 max-h-[40vh]">
            <div className="space-y-2 py-2">
              {filteredTemplates.map(t => {
                const Icon = t.icon;
                const alreadyAdded = usedTypes.has(t.type);
                return (
                  <button
                    key={t.type}
                    onClick={() => !alreadyAdded && addWidget(t)}
                    disabled={alreadyAdded}
                    className={cn(
                      'flex items-center gap-3 w-full p-3 rounded-lg border text-left transition-all',
                      alreadyAdded ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50 hover:shadow-sm cursor-pointer'
                    )}
                  >
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{t.label}</span>
                        {alreadyAdded && <Badge variant="outline" className="text-[10px]">Added</Badge>}
                        <Badge variant="secondary" className="text-[10px] capitalize">{t.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{t.defaultSize}</Badge>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export helpers for the dashboard page
export { WIDGET_TEMPLATES, SIZE_CLASSES, STORAGE_KEY, getDefaultWidgets };
export type { DashboardWidget };
