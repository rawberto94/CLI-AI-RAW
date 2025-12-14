'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Plus, 
  Upload, 
  Search, 
  FileText, 
  BarChart3, 
  X,
  Sparkles,
  Keyboard,
  Zap,
  CheckCircle2,
  Calendar,
  TrendingUp,
  Edit3,
  Building2,
  Link2,
  Shield,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  shortcut?: string;
  color: string;
  category?: 'core' | 'intelligence' | 'workflow' | 'collaboration';
  badge?: number;
}

// Core navigation actions
const coreActions: QuickAction[] = [
  {
    id: 'upload',
    label: 'Upload Contract',
    icon: <Upload className="h-5 w-5" />,
    href: '/upload',
    shortcut: 'U',
    color: 'bg-blue-500 hover:bg-blue-600',
    category: 'core',
  },
  {
    id: 'search',
    label: 'AI Search',
    icon: <Search className="h-5 w-5" />,
    href: '/intelligence/search',
    shortcut: '/',
    color: 'bg-purple-500 hover:bg-purple-600',
    category: 'intelligence',
  },
  {
    id: 'contracts',
    label: 'View Contracts',
    icon: <FileText className="h-5 w-5" />,
    href: '/contracts',
    shortcut: 'C',
    color: 'bg-green-500 hover:bg-green-600',
    category: 'core',
  },
  {
    id: 'generate',
    label: 'Generate Contract',
    icon: <Sparkles className="h-5 w-5" />,
    href: '/generate',
    shortcut: 'G',
    color: 'bg-indigo-500 hover:bg-indigo-600',
    category: 'core',
  },
];

// Intelligence & Analytics actions
const intelligenceActions: QuickAction[] = [
  {
    id: 'intelligence',
    label: 'Intelligence Hub',
    icon: <Zap className="h-5 w-5" />,
    href: '/intelligence',
    shortcut: 'I',
    color: 'bg-amber-500 hover:bg-amber-600',
    category: 'intelligence',
  },
  {
    id: 'health',
    label: 'Health Scores',
    icon: <Activity className="h-5 w-5" />,
    href: '/intelligence/health',
    shortcut: 'H',
    color: 'bg-emerald-500 hover:bg-emerald-600',
    category: 'intelligence',
  },
  {
    id: 'forecast',
    label: 'Forecast',
    icon: <TrendingUp className="h-5 w-5" />,
    href: '/forecast',
    shortcut: 'F',
    color: 'bg-cyan-500 hover:bg-cyan-600',
    category: 'intelligence',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    href: '/dashboard',
    shortcut: 'A',
    color: 'bg-orange-500 hover:bg-orange-600',
    category: 'intelligence',
  },
];

// Workflow actions
const workflowActions: QuickAction[] = [
  {
    id: 'approvals',
    label: 'Approvals',
    icon: <CheckCircle2 className="h-5 w-5" />,
    href: '/approvals',
    shortcut: 'P',
    color: 'bg-yellow-500 hover:bg-yellow-600',
    category: 'workflow',
    badge: 4,
  },
  {
    id: 'renewals',
    label: 'Renewals',
    icon: <Calendar className="h-5 w-5" />,
    href: '/renewals',
    shortcut: 'R',
    color: 'bg-rose-500 hover:bg-rose-600',
    category: 'workflow',
    badge: 2,
  },
  {
    id: 'drafting',
    label: 'Drafting Canvas',
    icon: <Edit3 className="h-5 w-5" />,
    href: '/drafting',
    shortcut: 'D',
    color: 'bg-teal-500 hover:bg-teal-600',
    category: 'workflow',
  },
  {
    id: 'governance',
    label: 'Governance',
    icon: <Shield className="h-5 w-5" />,
    href: '/governance',
    shortcut: 'V',
    color: 'bg-slate-600 hover:bg-slate-700',
    category: 'workflow',
  },
];

// Collaboration actions
const collaborationActions: QuickAction[] = [
  {
    id: 'portal',
    label: 'Supplier Portal',
    icon: <Building2 className="h-5 w-5" />,
    href: '/portal',
    shortcut: 'S',
    color: 'bg-violet-500 hover:bg-violet-600',
    category: 'collaboration',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: <Link2 className="h-5 w-5" />,
    href: '/integrations',
    shortcut: 'N',
    color: 'bg-pink-500 hover:bg-pink-600',
    category: 'collaboration',
  },
];

// Get contextual actions based on current page
function getContextualActions(pathname: string): QuickAction[] {
  const path = pathname.split('/')[1] || '';
  
  switch (path) {
    case 'contracts':
      return [...coreActions.slice(0, 2), ...intelligenceActions.slice(0, 2), ...workflowActions.slice(0, 2)].filter((a): a is QuickAction => !!a);
    case 'intelligence':
      return [...intelligenceActions, ...workflowActions.slice(0, 2)].filter((a): a is QuickAction => !!a);
    case 'approvals':
    case 'renewals':
      return [...workflowActions, ...intelligenceActions.slice(0, 2)].filter((a): a is QuickAction => !!a);
    case 'drafting':
    case 'generate':
      return [coreActions[3], ...workflowActions.slice(2), ...collaborationActions].filter((a): a is QuickAction => !!a);
    case 'portal':
    case 'integrations':
      return [...collaborationActions, ...coreActions.slice(0, 2)].filter((a): a is QuickAction => !!a);
    case 'governance':
      return [...workflowActions, ...intelligenceActions.slice(0, 2)].filter((a): a is QuickAction => !!a);
    default:
      // Default: show a mix of most useful actions
      return [
        coreActions[0], // Upload
        coreActions[1], // AI Search
        coreActions[3], // Generate
        workflowActions[0], // Approvals
        workflowActions[1], // Renewals
        intelligenceActions[0], // Intelligence
      ].filter((a): a is QuickAction => !!a);
  }
}

export function QuickActionsFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  
  // Get contextual actions based on current page
  const actions = useMemo(() => getContextualActions(pathname), [pathname]);

  const handleAction = (action: QuickAction) => {
    if (action.href) {
      router.push(action.href);
    } else if (action.onClick) {
      action.onClick();
    }
    setIsOpen(false);
  };

  // Calculate total badges
  const totalBadges = actions.reduce((sum, a) => sum + (a.badge || 0), 0);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // CMD/Ctrl + K opens the FAB
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        return;
      }

      // If FAB is open, handle shortcuts
      if (isOpen) {
        const action = actions.find(a => 
          a.shortcut?.toLowerCase() === e.key.toLowerCase()
        );
        if (action) {
          e.preventDefault();
          handleAction(action);
        }
        // Escape closes the FAB
        if (e.key === 'Escape') {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, actions]);

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* FAB Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
        {/* Action Buttons */}
        <AnimatePresence>
          {isOpen && (
            <>
              {actions.map((action, index) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    transition: { delay: index * 0.05 }
                  }}
                  exit={{ 
                    opacity: 0, 
                    y: 10, 
                    scale: 0.8,
                    transition: { delay: (actions.length - index) * 0.03 }
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAction(action)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-full text-white shadow-lg',
                    'transition-colors duration-200 relative',
                    action.color
                  )}
                >
                  {action.icon}
                  <span className="font-medium text-sm whitespace-nowrap">{action.label}</span>
                  {action.badge && action.badge > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 border-2 border-white rounded-full text-xs font-bold flex items-center justify-center">
                      {action.badge}
                    </span>
                  )}
                  {action.shortcut && (
                    <kbd className="px-1.5 py-0.5 text-xs bg-white/20 rounded font-mono">
                      {action.shortcut}
                    </kbd>
                  )}
                </motion.button>
              ))}
              
              {/* Keyboard hint */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-full shadow-md"
              >
                <Keyboard className="h-3 w-3" />
                <span>Press shortcut key or <kbd className="px-1 bg-gray-100 rounded font-mono">Esc</kbd> to close</span>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main FAB Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-14 h-14 rounded-full shadow-xl flex items-center justify-center relative',
            'transition-all duration-300',
            isOpen
              ? 'bg-gray-800 hover:bg-gray-900'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
          )}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {isOpen ? (
              <X className="h-6 w-6 text-white" />
            ) : (
              <Plus className="h-6 w-6 text-white" />
            )}
          </motion.div>
          {/* Badge for pending items */}
          {!isOpen && totalBadges > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 border-2 border-white rounded-full text-xs font-bold text-white flex items-center justify-center">
              {totalBadges}
            </span>
          )}
        </motion.button>
        
        {/* Tooltip when closed */}
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-16 bottom-3 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap"
          >
            Quick Actions <kbd className="ml-1 px-1 bg-gray-700 rounded font-mono">⌘K</kbd>
          </motion.div>
        )}
      </div>
    </>
  );
}
