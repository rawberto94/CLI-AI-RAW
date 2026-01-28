'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Settings,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  X,
  ChevronDown,
  Check,
  Layout,
  BarChart3,
  Clock,
  AlertTriangle,
  FileText,
  TrendingUp,
  Users,
  Calendar,
  Shield,
  Zap,
  Bell,
  Activity,
  PieChart,
  Target,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface DashboardWidget {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: 'overview' | 'contracts' | 'workflows' | 'ai' | 'alerts';
  size: 'small' | 'medium' | 'large' | 'full';
  isVisible: boolean;
  order: number;
  isDefault: boolean;
}

interface WidgetCustomizerProps {
  widgets: DashboardWidget[];
  onSave: (widgets: DashboardWidget[]) => void;
  onClose: () => void;
}

// ============================================================================
// Default Widgets Configuration
// ============================================================================

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: 'overview-stats',
    title: 'Quick Stats',
    description: 'Key metrics at a glance',
    icon: BarChart3,
    category: 'overview',
    size: 'full',
    isVisible: true,
    order: 0,
    isDefault: true,
  },
  {
    id: 'pending-approvals',
    title: 'Pending Approvals',
    description: 'Contracts awaiting your action',
    icon: Clock,
    category: 'workflows',
    size: 'medium',
    isVisible: true,
    order: 1,
    isDefault: true,
  },
  {
    id: 'risk-alerts',
    title: 'Risk Alerts',
    description: 'High-priority risk notifications',
    icon: AlertTriangle,
    category: 'alerts',
    size: 'medium',
    isVisible: true,
    order: 2,
    isDefault: true,
  },
  {
    id: 'recent-contracts',
    title: 'Recent Contracts',
    description: 'Recently created or modified contracts',
    icon: FileText,
    category: 'contracts',
    size: 'large',
    isVisible: true,
    order: 3,
    isDefault: true,
  },
  {
    id: 'contract-value-chart',
    title: 'Contract Value Trends',
    description: 'Monthly contract value analysis',
    icon: TrendingUp,
    category: 'overview',
    size: 'medium',
    isVisible: true,
    order: 4,
    isDefault: true,
  },
  {
    id: 'team-activity',
    title: 'Team Activity',
    description: 'Recent team actions and approvals',
    icon: Users,
    category: 'overview',
    size: 'medium',
    isVisible: true,
    order: 5,
    isDefault: true,
  },
  {
    id: 'calendar-deadlines',
    title: 'Upcoming Deadlines',
    description: 'Renewal and expiration dates',
    icon: Calendar,
    category: 'contracts',
    size: 'medium',
    isVisible: false,
    order: 6,
    isDefault: false,
  },
  {
    id: 'compliance-score',
    title: 'Compliance Score',
    description: 'Overall compliance health',
    icon: Shield,
    category: 'alerts',
    size: 'small',
    isVisible: false,
    order: 7,
    isDefault: false,
  },
  {
    id: 'ai-suggestions',
    title: 'AI Suggestions',
    description: 'Smart recommendations from AI',
    icon: Zap,
    category: 'ai',
    size: 'medium',
    isVisible: true,
    order: 8,
    isDefault: true,
  },
  {
    id: 'notifications-feed',
    title: 'Notifications',
    description: 'Recent notifications and updates',
    icon: Bell,
    category: 'alerts',
    size: 'small',
    isVisible: false,
    order: 9,
    isDefault: false,
  },
  {
    id: 'workflow-progress',
    title: 'Workflow Progress',
    description: 'Active workflow status',
    icon: Activity,
    category: 'workflows',
    size: 'medium',
    isVisible: false,
    order: 10,
    isDefault: false,
  },
  {
    id: 'contract-types-chart',
    title: 'Contract Types',
    description: 'Distribution by contract type',
    icon: PieChart,
    category: 'contracts',
    size: 'small',
    isVisible: false,
    order: 11,
    isDefault: false,
  },
  {
    id: 'sla-tracker',
    title: 'SLA Tracker',
    description: 'SLA compliance monitoring',
    icon: Target,
    category: 'workflows',
    size: 'medium',
    isVisible: false,
    order: 12,
    isDefault: false,
  },
];

// ============================================================================
// Components
// ============================================================================

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  overview: { label: 'Overview', color: 'bg-violet-100 text-violet-700' },
  contracts: { label: 'Contracts', color: 'bg-green-100 text-green-700' },
  workflows: { label: 'Workflows', color: 'bg-purple-100 text-purple-700' },
  ai: { label: 'AI', color: 'bg-amber-100 text-amber-700' },
  alerts: { label: 'Alerts', color: 'bg-red-100 text-red-700' },
};

const SIZE_LABELS: Record<string, string> = {
  small: '1/4 width',
  medium: '1/2 width',
  large: '3/4 width',
  full: 'Full width',
};

/**
 * Individual widget item in the customizer list
 */
const WidgetItem: React.FC<{
  widget: DashboardWidget;
  onToggleVisibility: (id: string) => void;
  onChangeSize: (id: string, size: DashboardWidget['size']) => void;
}> = ({ widget, onToggleVisibility, onChangeSize }) => {
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const Icon = widget.icon;
  const categoryStyle = CATEGORY_LABELS[widget.category] || CATEGORY_LABELS.overview;

  return (
    <Reorder.Item
      value={widget}
      id={widget.id}
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        widget.isVisible
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-slate-50 border-slate-100 opacity-60'
      }`}
    >
      {/* Drag Handle */}
      <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded transition-colors">
        <GripVertical className="w-5 h-5 text-slate-400" />
      </div>

      {/* Widget Icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        widget.isVisible ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-400'
      }`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Widget Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">{widget.title}</div>
        <div className="text-xs text-slate-500 truncate">{widget.description}</div>
      </div>

      {/* Category Badge */}
      <span className={`hidden sm:inline-flex px-2 py-1 rounded-full text-xs font-medium ${categoryStyle.color}`}>
        {categoryStyle.label}
      </span>

      {/* Size Selector */}
      <div className="relative">
        <button
          onClick={() => setShowSizeDropdown(!showSizeDropdown)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded transition-colors"
        >
          <Layout className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{SIZE_LABELS[widget.size]}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <AnimatePresence>
          {showSizeDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 min-w-[120px]"
            >
              {(['small', 'medium', 'large', 'full'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    onChangeSize(widget.id, size);
                    setShowSizeDropdown(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 flex items-center justify-between ${
                    widget.size === size ? 'text-purple-600 bg-purple-50' : 'text-slate-600'
                  }`}
                >
                  {SIZE_LABELS[size]}
                  {widget.size === size && <Check className="w-3 h-3" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Visibility Toggle */}
      <button
        onClick={() => onToggleVisibility(widget.id)}
        className={`p-2 rounded-lg transition-colors ${
          widget.isVisible
            ? 'text-green-600 hover:bg-green-50'
            : 'text-slate-400 hover:bg-slate-100'
        }`}
        title={widget.isVisible ? 'Hide widget' : 'Show widget'}
      >
        {widget.isVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
      </button>
    </Reorder.Item>
  );
};

/**
 * Category filter tabs
 */
const CategoryTabs: React.FC<{
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}> = ({ activeCategory, onCategoryChange }) => (
  <div className="flex items-center gap-1 overflow-x-auto pb-2">
    <button
      onClick={() => onCategoryChange(null)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
        activeCategory === null
          ? 'bg-purple-100 text-purple-700'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      All
    </button>
    {Object.entries(CATEGORY_LABELS).map(([key, { label, color }]) => (
      <button
        key={key}
        onClick={() => onCategoryChange(key)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
          activeCategory === key ? color : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const DashboardWidgetCustomizer: React.FC<WidgetCustomizerProps> = ({
  widgets: initialWidgets,
  onSave,
  onClose,
}) => {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(initialWidgets);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const filteredWidgets = activeCategory
    ? widgets.filter((w) => w.category === activeCategory)
    : widgets;

  const handleReorder = useCallback((reorderedWidgets: DashboardWidget[]) => {
    // Update order based on new positions
    const updatedWidgets = widgets.map((widget) => {
      const newIndex = reorderedWidgets.findIndex((w) => w.id === widget.id);
      if (newIndex !== -1) {
        return { ...widget, order: newIndex };
      }
      return widget;
    });
    setWidgets(updatedWidgets.sort((a, b) => a.order - b.order));
    setHasChanges(true);
  }, [widgets]);

  const handleToggleVisibility = useCallback((id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isVisible: !w.isVisible } : w))
    );
    setHasChanges(true);
  }, []);

  const handleChangeSize = useCallback((id: string, size: DashboardWidget['size']) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size } : w))
    );
    setHasChanges(true);
  }, []);

  const handleReset = useCallback(() => {
    setWidgets(DEFAULT_DASHBOARD_WIDGETS);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave(widgets);
  }, [widgets, onSave]);

  const visibleCount = widgets.filter((w) => w.isVisible).length;
  const totalCount = widgets.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Settings className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Customize Dashboard</h2>
              <p className="text-sm text-slate-500">
                Drag to reorder • {visibleCount} of {totalCount} widgets visible
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="px-6 py-3 border-b border-slate-100 shrink-0">
          <CategoryTabs
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>

        {/* Widget List */}
        <div className="flex-1 overflow-y-auto p-4">
          <Reorder.Group
            axis="y"
            values={filteredWidgets}
            onReorder={handleReorder}
            className="space-y-2"
          >
            {filteredWidgets.map((widget) => (
              <WidgetItem
                key={widget.id}
                widget={widget}
                onToggleVisibility={handleToggleVisibility}
                onChangeSize={handleChangeSize}
              />
            ))}
          </Reorder.Group>

          {filteredWidgets.length === 0 && (
            <div className="text-center py-12">
              <Layout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No widgets in this category</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/**
 * Button to trigger customizer modal
 */
export const DashboardCustomizeButton: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors ${className || ''}`}
  >
    <Settings className="w-4 h-4" />
    Customize
  </button>
);

/**
 * Hook to manage dashboard widget state
 */
export function useDashboardWidgets() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dashboard-widgets');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return DEFAULT_DASHBOARD_WIDGETS;
        }
      }
    }
    return DEFAULT_DASHBOARD_WIDGETS;
  });

  const [isCustomizing, setIsCustomizing] = useState(false);

  const saveWidgets = useCallback((newWidgets: DashboardWidget[]) => {
    setWidgets(newWidgets);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-widgets', JSON.stringify(newWidgets));
    }
    setIsCustomizing(false);
  }, []);

  const visibleWidgets = widgets
    .filter((w) => w.isVisible)
    .sort((a, b) => a.order - b.order);

  return {
    widgets,
    visibleWidgets,
    isCustomizing,
    setIsCustomizing,
    saveWidgets,
  };
}

export default DashboardWidgetCustomizer;
