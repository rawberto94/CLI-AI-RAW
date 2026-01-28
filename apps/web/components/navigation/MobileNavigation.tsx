'use client';

/**
 * Mobile Navigation
 * Responsive navigation drawer for mobile devices
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  Home,
  FileText,
  Upload,
  Settings,
  Bell,
  Search,
  User,
  ChevronRight,
  LogOut,
  HelpCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

// ============================================================================
// Navigation Config
// ============================================================================

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home },
      { label: 'Contracts', href: '/contracts', icon: FileText },
      { label: 'Upload', href: '/upload', icon: Upload },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'AI Assistant', href: '/assistant', icon: Sparkles },
      { label: 'Search', href: '/search', icon: Search },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell, badge: 3 },
      { label: 'Settings', href: '/settings', icon: Settings },
      { label: 'Help', href: '/help', icon: HelpCircle },
    ],
  },
];

// ============================================================================
// Components
// ============================================================================

interface MobileNavButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function MobileNavButton({ isOpen, onClick }: MobileNavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl',
        'bg-white/90 backdrop-blur-sm border border-slate-200 shadow-lg',
        'text-slate-600 hover:text-slate-900 hover:bg-white',
        'transition-all duration-200',
        isOpen && 'bg-slate-100'
      )}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <X className="w-5 h-5" />
          </motion.div>
        ) : (
          <motion.div
            key="menu"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Menu className="w-5 h-5" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

interface NavItemProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}

function NavItemComponent({ item, isActive, onClick }: NavItemProps) {
  const Icon = item.icon;
  
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl',
        'transition-all duration-200',
        isActive
          ? 'bg-gradient-to-r from-purple-500 to-purple-500 text-white shadow-lg shadow-purple-500/25'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      )}
    >
      <Icon className={cn('w-5 h-5', isActive && 'text-white')} />
      <span className="font-medium">{item.label}</span>
      {item.badge && (
        <span className={cn(
          'ml-auto px-2 py-0.5 text-xs font-semibold rounded-full',
          isActive
            ? 'bg-white/20 text-white'
            : 'bg-red-100 text-red-600'
        )}>
          {item.badge}
        </span>
      )}
      {!item.badge && <ChevronRight className="w-4 h-4 ml-auto opacity-40" />}
    </Link>
  );
}

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ isOpen, onClose }: MobileNavDrawerProps) {
  const pathname = usePathname();
  
  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);
  
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white z-40 lg:hidden shadow-2xl"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900">ContractAI</h1>
                  <p className="text-xs text-slate-500">Contract Intelligence</p>
                </div>
              </div>
              
              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-6">
                  {NAV_SECTIONS.map((section, sectionIndex) => (
                    <div key={sectionIndex}>
                      {section.title && (
                        <h3 className="px-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          {section.title}
                        </h3>
                      )}
                      <div className="space-y-1">
                        {section.items.map((item) => (
                          <NavItemComponent
                            key={item.href}
                            item={item}
                            isActive={pathname === item.href}
                            onClick={onClose}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </nav>
              
              {/* Footer / User */}
              <div className="border-t border-slate-100 p-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">John Doe</p>
                    <p className="text-xs text-slate-500 truncate">john@company.com</p>
                  </div>
                  <button 
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Combined Provider Component
// ============================================================================

export function MobileNavigationProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <MobileNavButton isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
      <MobileNavDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
      {children}
    </>
  );
}

// ============================================================================
// Bottom Navigation (Alternative)
// ============================================================================

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Contracts', href: '/contracts', icon: FileText },
  { label: 'Upload', href: '/upload', icon: Upload },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function BottomNavigation() {
  const pathname = usePathname();
  
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 z-40 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full',
                'transition-all duration-200',
                isActive ? 'text-purple-600' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-lg transition-colors',
                isActive && 'bg-purple-100'
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={cn(
                'text-[10px] font-medium mt-0.5',
                isActive && 'text-purple-600'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
