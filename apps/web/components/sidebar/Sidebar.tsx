'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  User,
  LogOut,
  Search,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SidebarContextValue {
  isOpen: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleCollapse: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  badgeColor?: 'gray' | 'blue' | 'green' | 'red' | 'yellow';
  children?: NavItem[];
  disabled?: boolean;
}

interface NavGroup {
  id: string;
  label?: string;
  items: NavItem[];
}

// ============================================================================
// Context
// ============================================================================

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface SidebarProviderProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  defaultCollapsed?: boolean;
  breakpoint?: number;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  defaultCollapsed = false,
  breakpoint = 768,
}: SidebarProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < breakpoint;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
        setIsCollapsed(false);
      } else {
        setIsOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggleCollapse = useCallback(() => setIsCollapsed(prev => !prev), []);

  return (
    <SidebarContext.Provider 
      value={{ isOpen, isCollapsed, isMobile, toggle, open, close, toggleCollapse }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

// ============================================================================
// Sidebar Container
// ============================================================================

interface SidebarContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function SidebarContainer({ children, className = '' }: SidebarContainerProps) {
  const { isOpen, isCollapsed, isMobile, close } = useSidebar();

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed && !isMobile ? 64 : 256,
          x: isMobile && !isOpen ? -256 : 0,
        }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={`
          fixed top-0 left-0 h-full z-50
          bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-800
          flex flex-col
          ${isMobile ? 'shadow-2xl' : ''}
          ${className}
        `}
      >
        {children}
      </motion.aside>

      {/* Spacer for content */}
      {!isMobile && (
        <motion.div
          initial={false}
          animate={{ width: isCollapsed ? 64 : 256 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="flex-shrink-0"
        />
      )}
    </>
  );
}

// ============================================================================
// Sidebar Header
// ============================================================================

interface SidebarHeaderProps {
  logo?: React.ReactNode;
  title?: string;
  className?: string;
}

export function SidebarHeader({ logo, title, className = '' }: SidebarHeaderProps) {
  const { isCollapsed, isMobile, close } = useSidebar();

  return (
    <div className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 ${className}`}>
      <div className="flex items-center gap-3 overflow-hidden">
        {logo && <div className="flex-shrink-0">{logo}</div>}
        <AnimatePresence>
          {(!isCollapsed || isMobile) && title && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="font-semibold text-gray-900 dark:text-white whitespace-nowrap"
            >
              {title}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {isMobile && (
        <button
          onClick={close}
          className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Sidebar Content
// ============================================================================

interface SidebarContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SidebarContent({ children, className = '' }: SidebarContentProps) {
  return (
    <div className={`flex-1 overflow-y-auto py-4 ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// Sidebar Footer
// ============================================================================

interface SidebarFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function SidebarFooter({ children, className = '' }: SidebarFooterProps) {
  return (
    <div className={`mt-auto border-t border-gray-200 dark:border-gray-800 p-4 ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// Navigation Group
// ============================================================================

interface NavGroupProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function NavGroup({ label, children, className = '' }: NavGroupProps) {
  const { isCollapsed, isMobile } = useSidebar();

  return (
    <div className={`px-3 mb-4 ${className}`}>
      <AnimatePresence>
        {label && (!isCollapsed || isMobile) && (
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          >
            {label}
          </motion.h3>
        )}
      </AnimatePresence>
      <nav className="space-y-1">{children}</nav>
    </div>
  );
}

// ============================================================================
// Navigation Item
// ============================================================================

interface NavItemProps {
  icon?: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  badge?: string | number;
  badgeColor?: 'gray' | 'blue' | 'green' | 'red' | 'yellow';
  disabled?: boolean;
  children?: React.ReactNode;
}

export function NavItem({
  icon,
  label,
  href,
  onClick,
  isActive = false,
  badge,
  badgeColor = 'gray',
  disabled = false,
  children,
}: NavItemProps) {
  const { isCollapsed, isMobile, close } = useSidebar();
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = Boolean(children);
  const showLabel = !isCollapsed || isMobile;

  const badgeColors = {
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    blue: 'bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300',
    green: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300',
    red: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300',
  };

  const handleClick = () => {
    if (disabled) return;
    
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else {
      onClick?.();
      if (isMobile) close();
    }
  };

  const Component = href && !hasChildren ? 'a' : 'button';

  return (
    <div>
      <Component
        href={href}
        onClick={handleClick}
        disabled={disabled}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
          transition-colors relative group
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800'
          }
          ${isActive 
            ? 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400' 
            : 'text-gray-700 dark:text-gray-300'
          }
        `}
      >
        {icon && (
          <span className="flex-shrink-0 w-5 h-5">{icon}</span>
        )}

        <AnimatePresence>
          {showLabel && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex-1 text-left text-sm font-medium truncate"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>

        {badge !== undefined && showLabel && (
          <span className={`px-2 py-0.5 text-xs rounded-full ${badgeColors[badgeColor]}`}>
            {badge}
          </span>
        )}

        {hasChildren && showLabel && (
          <ChevronDown 
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        )}

        {/* Tooltip for collapsed state */}
        {isCollapsed && !isMobile && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
            {label}
            {badge !== undefined && (
              <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${badgeColors[badgeColor]}`}>
                {badge}
              </span>
            )}
          </div>
        )}
      </Component>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && isExpanded && showLabel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-6 mt-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Sidebar Toggle Button
// ============================================================================

interface SidebarToggleProps {
  className?: string;
}

export function SidebarToggle({ className = '' }: SidebarToggleProps) {
  const { toggle, isMobile } = useSidebar();

  if (!isMobile) return null;

  return (
    <button
      onClick={toggle}
      className={`p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ${className}`}
    >
      <Menu className="w-6 h-6" />
    </button>
  );
}

// ============================================================================
// Collapse Toggle
// ============================================================================

interface CollapseToggleProps {
  className?: string;
}

export function CollapseToggle({ className = '' }: CollapseToggleProps) {
  const { isCollapsed, toggleCollapse, isMobile } = useSidebar();

  if (isMobile) return null;

  return (
    <button
      onClick={toggleCollapse}
      className={`
        p-2 rounded-lg
        text-gray-500 hover:text-gray-700 hover:bg-gray-100
        dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800
        ${className}
      `}
    >
      {isCollapsed ? (
        <ChevronRight className="w-5 h-5" />
      ) : (
        <ChevronLeft className="w-5 h-5" />
      )}
    </button>
  );
}

// ============================================================================
// User Menu
// ============================================================================

interface UserMenuProps {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  onProfile?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
}

export function UserMenu({ user, onProfile, onSettings, onLogout }: UserMenuProps) {
  const { isCollapsed, isMobile } = useSidebar();
  const [isOpen, setIsOpen] = useState(false);
  const showFull = !isCollapsed || isMobile;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {user.avatar ? (
          
          <img src={user.avatar} alt={`${user.name}'s profile photo`} className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
            <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
              {user.name.charAt(0)}
            </span>
          </div>
        )}

        <AnimatePresence>
          {showFull && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex-1 text-left overflow-hidden"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`
              absolute bottom-full mb-2 
              ${isCollapsed && !isMobile ? 'left-full ml-2' : 'left-0 right-0'}
              bg-white dark:bg-gray-800 
              border border-gray-200 dark:border-gray-700 
              rounded-lg shadow-lg overflow-hidden z-50
              min-w-[180px]
            `}
          >
            {onProfile && (
              <button
                onClick={() => { onProfile(); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <User className="w-4 h-4" />
                Profile
              </button>
            )}
            {onSettings && (
              <button
                onClick={() => { onSettings(); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            )}
            {onLogout && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700" />
                <button
                  onClick={() => { onLogout(); setIsOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Sidebar Search
// ============================================================================

interface SidebarSearchProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

export function SidebarSearch({ 
  placeholder = 'Search...', 
  onSearch,
  className = '',
}: SidebarSearchProps) {
  const { isCollapsed, isMobile } = useSidebar();
  const [query, setQuery] = useState('');
  const showFull = !isCollapsed || isMobile;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  if (!showFull) {
    return (
      <button className="mx-auto p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <Search className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className={`px-3 mb-4 ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border-0 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
        />
      </div>
    </div>
  );
}
