'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import {
  Plus,
  Settings,
  Trash2,
  Copy,
  Download,
  Upload,
  GripVertical,
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  Table,
  Hash,
  FileText,
  MoreVertical,
  ChevronRight,
  Save,
  Eye,
  Layout,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type WidgetType = 'metric' | 'chart' | 'table' | 'text' | 'list';
type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'donut';
type WidgetSize = '1x1' | '2x1' | '1x2' | '2x2' | '3x2' | '4x2';

interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  position: { x: number; y: number };
  config: {
    metricId?: string;
    chartType?: ChartType;
    dataSource?: string;
    refreshInterval?: number;
    filters?: Record<string, unknown>;
    format?: string;
    showTrend?: boolean;
    showLegend?: boolean;
    colors?: string[];
    thresholds?: Array<{ value: number; color: string; label: string }>;
  };
}

interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  widgets: WidgetConfig[];
  layout: 'grid' | 'free';
  refreshInterval: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DashboardBuilderProps {
  initialConfig?: DashboardConfig;
  onSave?: (config: DashboardConfig) => void;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WIDGET_TYPES = [
  { type: 'metric' as WidgetType, label: 'Metric Card', icon: Hash, description: 'Single value with trend' },
  { type: 'chart' as WidgetType, label: 'Chart', icon: BarChart3, description: 'Visual data representation' },
  { type: 'table' as WidgetType, label: 'Data Table', icon: Table, description: 'Tabular data view' },
  { type: 'text' as WidgetType, label: 'Text Block', icon: FileText, description: 'Static or dynamic text' },
  { type: 'list' as WidgetType, label: 'List Widget', icon: Layout, description: 'Ordered list of items' },
];

const CHART_TYPES = [
  { type: 'line' as ChartType, label: 'Line Chart', icon: LineChart },
  { type: 'bar' as ChartType, label: 'Bar Chart', icon: BarChart3 },
  { type: 'pie' as ChartType, label: 'Pie Chart', icon: PieChart },
  { type: 'area' as ChartType, label: 'Area Chart', icon: TrendingUp },
];

const WIDGET_SIZES: Array<{ size: WidgetSize; label: string; cols: number; rows: number }> = [
  { size: '1x1', label: 'Small (1×1)', cols: 1, rows: 1 },
  { size: '2x1', label: 'Wide (2×1)', cols: 2, rows: 1 },
  { size: '1x2', label: 'Tall (1×2)', cols: 1, rows: 2 },
  { size: '2x2', label: 'Medium (2×2)', cols: 2, rows: 2 },
  { size: '3x2', label: 'Large (3×2)', cols: 3, rows: 2 },
  { size: '4x2', label: 'Full Width (4×2)', cols: 4, rows: 2 },
];

const DATA_SOURCES = [
  { id: 'contracts.total', label: 'Total Contracts' },
  { id: 'contracts.value', label: 'Contract Value' },
  { id: 'contracts.by_status', label: 'Contracts by Status' },
  { id: 'contracts.by_type', label: 'Contracts by Type' },
  { id: 'contracts.expiring', label: 'Expiring Contracts' },
  { id: 'approvals.pending', label: 'Pending Approvals' },
  { id: 'approvals.processing_time', label: 'Approval Processing Time' },
  { id: 'approvals.by_step', label: 'Approvals by Step' },
  { id: 'extraction.success_rate', label: 'Extraction Success Rate' },
  { id: 'extraction.by_field', label: 'Extraction by Field' },
  { id: 'users.active', label: 'Active Users' },
  { id: 'users.sessions', label: 'User Sessions' },
  { id: 'system.api_latency', label: 'API Latency' },
  { id: 'system.error_rate', label: 'Error Rate' },
  { id: 'system.throughput', label: 'System Throughput' },
];

const DEFAULT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface WidgetPreviewProps {
  widget: WidgetConfig;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
}

function WidgetPreview({ widget, isSelected, onSelect, onDelete, onDuplicate, onEdit }: WidgetPreviewProps) {
  const sizeConfig = WIDGET_SIZES.find(s => s.size === widget.size);
  const Icon = WIDGET_TYPES.find(t => t.type === widget.type)?.icon || Hash;

  return (
    <Card
      className={cn(
        'relative cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        `col-span-${sizeConfig?.cols || 1} row-span-${sizeConfig?.rows || 1}`
      )}
      style={{
        gridColumn: `span ${sizeConfig?.cols || 1}`,
        gridRow: `span ${sizeConfig?.rows || 1}`,
      }}
      onClick={onSelect}
    >
      <div className="absolute top-2 left-2 cursor-grab opacity-50 hover:opacity-100">
        <GripVertical className="h-4 w-4" />
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit?.()}>
            <Settings className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate?.()}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete?.()} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CardContent className="flex flex-col items-center justify-center h-full p-4 pt-10">
        <div className="p-3 rounded-lg bg-muted mb-2">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-center">{widget.title}</p>
        <p className="text-xs text-muted-foreground">{widget.size}</p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DashboardBuilder({
  initialConfig,
  onSave,
  className,
}: DashboardBuilderProps) {
  const [config, setConfig] = useState<DashboardConfig>(() => initialConfig || {
    id: `dashboard-${Date.now()}`,
    name: 'New Dashboard',
    description: '',
    widgets: [],
    layout: 'grid',
    refreshInterval: 30000,
    isPublic: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Widget management
  const addWidget = useCallback((type: WidgetType) => {
    const newWidget: WidgetConfig = {
      id: `widget-${Date.now()}`,
      type,
      title: `New ${WIDGET_TYPES.find(t => t.type === type)?.label || 'Widget'}`,
      size: type === 'metric' ? '1x1' : '2x2',
      position: { x: 0, y: 0 },
      config: {
        showTrend: type === 'metric',
        showLegend: type === 'chart',
        chartType: type === 'chart' ? 'bar' : undefined,
        refreshInterval: 30000,
        colors: DEFAULT_COLORS,
      },
    };

    setConfig(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
      updatedAt: new Date().toISOString(),
    }));
    setShowAddWidget(false);
    setEditingWidget(newWidget);
  }, []);

  const updateWidget = useCallback((id: string, updates: Partial<WidgetConfig>) => {
    setConfig(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => 
        w.id === id ? { ...w, ...updates } : w
      ),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const deleteWidget = useCallback((id: string) => {
    setConfig(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== id),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedWidget(null);
  }, []);

  const duplicateWidget = useCallback((id: string) => {
    const widget = config.widgets.find(w => w.id === id);
    if (widget) {
      const newWidget: WidgetConfig = {
        ...widget,
        id: `widget-${Date.now()}`,
        title: `${widget.title} (Copy)`,
        position: { x: widget.position.x + 1, y: widget.position.y },
      };
      setConfig(prev => ({
        ...prev,
        widgets: [...prev.widgets, newWidget],
        updatedAt: new Date().toISOString(),
      }));
    }
  }, [config.widgets]);

  // Save dashboard
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave({
        ...config,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [config, onSave]);

  // Export/Import
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [config]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          setConfig({
            ...imported,
            id: `dashboard-${Date.now()}`,
            updatedAt: new Date().toISOString(),
          });
        } catch {
          // Handle error
          console.error('Failed to import dashboard');
        }
      };
      reader.readAsText(file);
    }
  }, []);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{config.name}</h2>
            {config.isPublic && <Badge>Public</Badge>}
          </div>
          {config.description && (
            <p className="text-muted-foreground">{config.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {isPreviewMode ? 'Edit' : 'Preview'}
          </Button>
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dashboard Settings</DialogTitle>
                <DialogDescription>
                  Configure your dashboard settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="dashboard-name">Name</Label>
                  <Input
                    id="dashboard-name"
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dashboard-desc">Description</Label>
                  <Textarea
                    id="dashboard-desc"
                    value={config.description || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Refresh Interval</Label>
                  <Select
                    value={config.refreshInterval.toString()}
                    onValueChange={(v) => setConfig(prev => ({ ...prev, refreshInterval: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10000">10 seconds</SelectItem>
                      <SelectItem value="30000">30 seconds</SelectItem>
                      <SelectItem value="60000">1 minute</SelectItem>
                      <SelectItem value="300000">5 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="public">Make Public</Label>
                  <Switch
                    id="public"
                    checked={config.isPublic}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, isPublic: checked }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setShowSettings(false)}>
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImport}
                  />
                </label>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      {!isPreviewMode && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Widget
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Widget</DialogTitle>
                    <DialogDescription>
                      Choose a widget type to add to your dashboard
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2 py-4">
                    {WIDGET_TYPES.map((widgetType) => {
                      const Icon = widgetType.icon;
                      return (
                        <Card
                          key={widgetType.type}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => addWidget(widgetType.type)}
                        >
                          <CardContent className="flex items-center gap-4 p-4">
                            <div className="p-3 rounded-lg bg-muted">
                              <Icon className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="font-medium">{widgetType.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {widgetType.description}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 ml-auto text-muted-foreground" />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{config.widgets.length} widgets</span>
                <span>•</span>
                <span>Layout: {config.layout}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widget Grid */}
      <div
        className={cn(
          'grid gap-4',
          config.layout === 'grid' ? 'grid-cols-4 auto-rows-[150px]' : ''
        )}
      >
        {config.widgets.length === 0 ? (
          <Card className="col-span-4">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Layout className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-1">No widgets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start building your dashboard by adding widgets
              </p>
              <Button onClick={() => setShowAddWidget(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>
            </CardContent>
          </Card>
        ) : (
          config.widgets.map((widget) => (
            <WidgetPreview
              key={widget.id}
              widget={widget}
              isSelected={selectedWidget === widget.id}
              onSelect={() => !isPreviewMode && setSelectedWidget(widget.id)}
              onDelete={() => deleteWidget(widget.id)}
              onDuplicate={() => duplicateWidget(widget.id)}
              onEdit={() => setEditingWidget(widget)}
            />
          ))
        )}
      </div>

      {/* Widget Editor Dialog */}
      {editingWidget && (
        <Dialog open={!!editingWidget} onOpenChange={() => setEditingWidget(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Widget</DialogTitle>
              <DialogDescription>
                Configure your widget settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="widget-title">Title</Label>
                <Input
                  id="widget-title"
                  value={editingWidget.title}
                  onChange={(e) => setEditingWidget({ ...editingWidget, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Widget Type</Label>
                  <Select
                    value={editingWidget.type}
                    onValueChange={(value) => setEditingWidget({ 
                      ...editingWidget, 
                      type: value as WidgetType 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WIDGET_TYPES.map((t) => (
                        <SelectItem key={t.type} value={t.type}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Size</Label>
                  <Select
                    value={editingWidget.size}
                    onValueChange={(value) => setEditingWidget({ 
                      ...editingWidget, 
                      size: value as WidgetSize 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WIDGET_SIZES.map((s) => (
                        <SelectItem key={s.size} value={s.size}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data Source</Label>
                <Select
                  value={editingWidget.config.dataSource || ''}
                  onValueChange={(value) => setEditingWidget({
                    ...editingWidget,
                    config: { ...editingWidget.config, dataSource: value },
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a data source" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_SOURCES.map((ds) => (
                      <SelectItem key={ds.id} value={ds.id}>
                        {ds.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editingWidget.type === 'chart' && (
                <div className="space-y-2">
                  <Label>Chart Type</Label>
                  <Select
                    value={editingWidget.config.chartType || 'bar'}
                    onValueChange={(value) => setEditingWidget({
                      ...editingWidget,
                      config: { ...editingWidget.config, chartType: value as ChartType },
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHART_TYPES.map((ct) => (
                        <SelectItem key={ct.type} value={ct.type}>
                          {ct.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Display Options</h4>
                
                {editingWidget.type === 'metric' && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-trend">Show Trend</Label>
                    <Switch
                      id="show-trend"
                      checked={editingWidget.config.showTrend}
                      onCheckedChange={(checked) => setEditingWidget({
                        ...editingWidget,
                        config: { ...editingWidget.config, showTrend: checked },
                      })}
                    />
                  </div>
                )}

                {editingWidget.type === 'chart' && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-legend">Show Legend</Label>
                    <Switch
                      id="show-legend"
                      checked={editingWidget.config.showLegend}
                      onCheckedChange={(checked) => setEditingWidget({
                        ...editingWidget,
                        config: { ...editingWidget.config, showLegend: checked },
                      })}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Refresh Interval</Label>
                  <Select
                    value={(editingWidget.config.refreshInterval || 30000).toString()}
                    onValueChange={(value) => setEditingWidget({
                      ...editingWidget,
                      config: { ...editingWidget.config, refreshInterval: parseInt(value) },
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10000">10 seconds</SelectItem>
                      <SelectItem value="30000">30 seconds</SelectItem>
                      <SelectItem value="60000">1 minute</SelectItem>
                      <SelectItem value="300000">5 minutes</SelectItem>
                      <SelectItem value="0">Manual only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingWidget(null)}>
                Cancel
              </Button>
              <Button onClick={() => {
                updateWidget(editingWidget.id, editingWidget);
                setEditingWidget(null);
              }}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default DashboardBuilder;
