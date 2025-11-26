'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Upload, 
  Search, 
  FileText, 
  BarChart3, 
  X,
  Sparkles,
  Keyboard
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
}

const actions: QuickAction[] = [
  {
    id: 'upload',
    label: 'Upload Contract',
    icon: <Upload className="h-5 w-5" />,
    href: '/upload',
    shortcut: 'U',
    color: 'bg-blue-500 hover:bg-blue-600',
  },
  {
    id: 'search',
    label: 'Search',
    icon: <Search className="h-5 w-5" />,
    href: '/search',
    shortcut: '/',
    color: 'bg-purple-500 hover:bg-purple-600',
  },
  {
    id: 'contracts',
    label: 'View Contracts',
    icon: <FileText className="h-5 w-5" />,
    href: '/contracts',
    shortcut: 'C',
    color: 'bg-green-500 hover:bg-green-600',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    href: '/dashboard',
    shortcut: 'A',
    color: 'bg-orange-500 hover:bg-orange-600',
  },
];

export function QuickActionsFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleAction = (action: QuickAction) => {
    if (action.href) {
      router.push(action.href);
    } else if (action.onClick) {
      action.onClick();
    }
    setIsOpen(false);
  };

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
  }, [isOpen]);

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
                    'transition-colors duration-200',
                    action.color
                  )}
                >
                  {action.icon}
                  <span className="font-medium text-sm whitespace-nowrap">{action.label}</span>
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
            'w-14 h-14 rounded-full shadow-xl flex items-center justify-center',
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
