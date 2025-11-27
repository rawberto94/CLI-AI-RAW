'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  Activity,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  TrendingUp,
  FileText,
  Building2,
  Zap,
  Shield,
  Eye,
  ArrowRight,
  Clock,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ContextualItem {
  id: string;
  type: 'contract' | 'approval' | 'renewal' | 'alert' | 'insight';
  title: string;
  subtitle?: string;
  status?: 'urgent' | 'warning' | 'info' | 'success';
  path: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

interface ContextualSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  items: ContextualItem[];
  sourceModule?: string;
}

// ============================================================================
// Item Type Configuration
// ============================================================================

const getItemConfig = (type: ContextualItem['type']) => {
  switch (type) {
    case 'contract':
      return { icon: FileText, color: 'bg-blue-100 text-blue-600' };
    case 'approval':
      return { icon: CheckCircle2, color: 'bg-amber-100 text-amber-600' };
    case 'renewal':
      return { icon: Calendar, color: 'bg-green-100 text-green-600' };
    case 'alert':
      return { icon: AlertTriangle, color: 'bg-red-100 text-red-600' };
    case 'insight':
      return { icon: Zap, color: 'bg-purple-100 text-purple-600' };
    default:
      return { icon: Activity, color: 'bg-slate-100 text-slate-600' };
  }
};

const getStatusBadge = (status?: ContextualItem['status']) => {
  switch (status) {
    case 'urgent':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'warning':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'success':
      return 'bg-green-100 text-green-700 border-green-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

// ============================================================================
// Contextual Sidebar Component
// ============================================================================

export function ContextualSidebar({
  isOpen,
  onClose,
  title = 'Related Items',
  items,
  sourceModule,
}: ContextualSidebarProps) {
  // Group items by type
  const groupedItems = useMemo(() => {
    const groups: Record<ContextualItem['type'], ContextualItem[]> = {
      contract: [],
      approval: [],
      renewal: [],
      alert: [],
      insight: [],
    };
    
    items.forEach(item => {
      if (groups[item.type]) {
        groups[item.type].push(item);
      }
    });
    
    return groups;
  }, [items]);

  const groupLabels: Record<ContextualItem['type'], string> = {
    contract: 'Related Contracts',
    approval: 'Pending Approvals',
    renewal: 'Upcoming Renewals',
    alert: 'Active Alerts',
    insight: 'AI Insights',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          
          {/* Sidebar */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l border-slate-200 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex-none p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">{title}</h2>
                  {sourceModule && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      From {sourceModule}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {Object.entries(groupedItems).map(([type, typeItems]) => {
                if (typeItems.length === 0) return null;
                
                const config = getItemConfig(type as ContextualItem['type']);
                const Icon = config.icon;
                
                return (
                  <div key={type}>
                    <h3 className="text-xs font-medium text-slate-500 uppercase mb-2 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {groupLabels[type as ContextualItem['type']]} ({typeItems.length})
                    </h3>
                    <div className="space-y-2">
                      {typeItems.map((item) => {
                        const itemConfig = getItemConfig(item.type);
                        const ItemIcon = itemConfig.icon;
                        
                        return (
                          <Link
                            key={item.id}
                            href={item.path}
                            onClick={onClose}
                            className="block p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors group"
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${itemConfig.color}`}>
                                <ItemIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-900 truncate">{item.title}</span>
                                  {item.status && (
                                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getStatusBadge(item.status)}`}>
                                      {item.status}
                                    </span>
                                  )}
                                </div>
                                {item.subtitle && (
                                  <p className="text-sm text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                                )}
                                {item.timestamp && (
                                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                    <Clock className="h-3 w-3" />
                                    {item.timestamp}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {items.length === 0 && (
                <div className="text-center py-12">
                  <Activity className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No related items found</p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {items.length > 0 && (
              <div className="flex-none p-4 border-t border-slate-200 bg-slate-50">
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                    <Eye className="h-4 w-4" />
                    View All
                  </button>
                  <button className="flex-1 px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                    Take Action
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Quick Context Button (toggles sidebar)
// ============================================================================

interface QuickContextButtonProps {
  count?: number;
  onClick: () => void;
}

export function QuickContextButton({ count, onClick }: QuickContextButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-white border border-slate-200 rounded-full shadow-lg hover:shadow-xl hover:border-blue-300 transition-all group"
      title="View related items"
    >
      <Activity className="h-5 w-5 text-slate-600 group-hover:text-blue-500 transition-colors" />
      {count !== undefined && count > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 bg-blue-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

export default ContextualSidebar;
