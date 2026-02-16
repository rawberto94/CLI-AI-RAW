'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Plus, X, GripVertical, MessageCircle, Edit, Share2, Trash2, MoreVertical, ChevronUp } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface FABAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

// ============================================================================
// Floating Action Button
// ============================================================================

interface FloatingActionButtonProps {
  /** Primary action when FAB is clicked */
  onClick?: () => void;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Extended label (optional) */
  label?: string;
  /** Color variant */
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Position on screen */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  /** Allow dragging to reposition */
  draggable?: boolean;
  /** Additional class names */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Pulse animation */
  pulse?: boolean;
  /** Hide when scrolling down */
  hideOnScroll?: boolean;
}

export function FloatingActionButton({
  onClick,
  icon = <Plus className="w-6 h-6" />,
  label,
  variant = 'primary',
  size = 'md',
  position = 'bottom-right',
  draggable = false,
  className = '',
  disabled = false,
  pulse = false,
  hideOnScroll = false,
}: FloatingActionButtonProps) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const dragControls = useDragControls();

  // Hide on scroll
  useEffect(() => {
    if (!hideOnScroll) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hideOnScroll]);

  const variantStyles = {
    primary: 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/30',
    secondary: 'bg-gray-700 hover:bg-gray-800 text-white shadow-gray-500/30',
    success: 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/30',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30',
  };

  const sizeStyles = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  const positionStyles = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
  };

  const buttonContent = (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={`
        fixed z-50 rounded-full flex items-center justify-center
        shadow-lg transition-colors
        ${variantStyles[variant]}
        ${label ? 'px-5 gap-2' : sizeStyles[size]}
        ${positionStyles[position]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {pulse && !disabled && (
        <span className="absolute inset-0 rounded-full bg-current opacity-30 animate-ping" />
      )}
      {icon}
      {label && <span className="font-medium">{label}</span>}
    </motion.button>
  );

  if (draggable) {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div key="visible"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            drag
            dragControls={dragControls}
            dragMomentum={false}
            className={`fixed z-50 ${positionStyles[position]}`}
          >
            {buttonContent}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div key="visible"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
        >
          {buttonContent}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Expandable FAB
// ============================================================================

interface ExpandableFABProps {
  actions: FABAction[];
  mainIcon?: React.ReactNode;
  openIcon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  position?: 'bottom-right' | 'bottom-left';
  direction?: 'up' | 'left';
  showLabels?: boolean;
  className?: string;
}

export function ExpandableFAB({
  actions,
  mainIcon = <Plus className="w-6 h-6" />,
  openIcon = <X className="w-6 h-6" />,
  variant = 'primary',
  position = 'bottom-right',
  direction = 'up',
  showLabels = true,
  className = '',
}: ExpandableFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const variantStyles = {
    primary: 'bg-violet-600 hover:bg-violet-700 text-white',
    secondary: 'bg-gray-700 hover:bg-gray-800 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };

  const positionStyles = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
  };

  const getActionPosition = (index: number) => {
    const spacing = 60;
    if (direction === 'up') {
      return { y: -(index + 1) * spacing };
    }
    return { x: position === 'bottom-right' ? -(index + 1) * spacing : (index + 1) * spacing };
  };

  return (
    <div className={`fixed z-50 ${positionStyles[position]} ${className}`}>
      {/* Action Buttons */}
      <AnimatePresence>
        {isOpen && (
          <div key="open" className="contents">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/20 -z-10"
            />

            {/* Actions */}
            {actions.map((action, index) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, scale: 0.3, ...getActionPosition(0) }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  ...getActionPosition(index),
                  transition: { delay: index * 0.05 }
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.3, 
                  ...getActionPosition(0),
                  transition: { delay: (actions.length - index) * 0.03 }
                }}
                className="absolute bottom-0 right-0 flex items-center gap-3"
              >
                {showLabels && position === 'bottom-right' && (
                  <span className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap">
                    {action.label}
                  </span>
                )}
                <button
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  disabled={action.disabled}
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center shadow-lg
                    ${action.color || 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
                    ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    transition-colors
                  `}
                >
                  {action.icon}
                </button>
                {showLabels && position === 'bottom-left' && (
                  <span className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap">
                    {action.label}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        animate={{ rotate: isOpen ? 45 : 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={`
          w-14 h-14 rounded-full flex items-center justify-center shadow-lg
          ${variantStyles[variant]}
          transition-colors
        `}
      >
        {isOpen ? openIcon : mainIcon}
      </motion.button>
    </div>
  );
}

// ============================================================================
// Speed Dial FAB
// ============================================================================

interface SpeedDialFABProps {
  actions: FABAction[];
  mainIcon?: React.ReactNode;
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

export function SpeedDialFAB({
  actions,
  mainIcon = <Plus className="w-6 h-6" />,
  position = 'bottom-right',
  className = '',
}: SpeedDialFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const positionStyles = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
  };

  return (
    <div 
      className={`fixed z-50 ${positionStyles[position]} ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Speed Dial Items */}
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-16 flex flex-col gap-2 items-center">
            {actions.map((action, index) => (
              <motion.div
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
                  transition: { delay: (actions.length - index - 1) * 0.03 }
                }}
                className="group relative"
              >
                <button
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  disabled={action.disabled}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center shadow-md
                    bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    transition-colors
                  `}
                >
                  {action.icon}
                </button>
                
                {/* Tooltip */}
                <span 
                  className={`
                    absolute top-1/2 -translate-y-1/2 whitespace-nowrap
                    px-2 py-1 bg-gray-900 text-white text-xs rounded
                    opacity-0 group-hover:opacity-100 pointer-events-none
                    transition-opacity
                    ${position === 'bottom-right' ? 'right-full mr-2' : 'left-full ml-2'}
                  `}
                >
                  {action.label}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main Button */}
      <motion.button
        animate={{ rotate: isOpen ? 45 : 0 }}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors"
      >
        {mainIcon}
      </motion.button>
    </div>
  );
}

// ============================================================================
// Context Menu FAB
// ============================================================================

interface ContextMenuFABProps {
  actions: FABAction[];
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

export function ContextMenuFAB({
  actions,
  position = 'bottom-right',
  className = '',
}: ContextMenuFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClick);
    }

    return () => document.removeEventListener('click', handleClick);
  }, [isOpen]);

  const positionStyles = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
  };

  return (
    <div ref={menuRef} className={`fixed z-50 ${positionStyles[position]} ${className}`}>
      {/* Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div key="open"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`
              absolute bottom-16 ${position === 'bottom-right' ? 'right-0' : 'left-0'}
              bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden
              min-w-[200px] border border-gray-200 dark:border-gray-700
            `}
          >
            {actions.map((action, index) => (
              <React.Fragment key={action.id}>
                {index > 0 && <div className="h-px bg-gray-100 dark:bg-gray-700" />}
                <button
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  disabled={action.disabled}
                  className={`
                    w-full px-4 py-3 flex items-center gap-3 text-left
                    hover:bg-gray-50 dark:hover:bg-gray-700/50
                    ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    transition-colors
                  `}
                >
                  <span className="text-gray-500 dark:text-gray-400">
                    {action.icon}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {action.label}
                  </span>
                </button>
              </React.Fragment>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors"
      >
        <MoreVertical className="w-6 h-6" />
      </motion.button>
    </div>
  );
}

// ============================================================================
// Scroll to Top FAB
// ============================================================================

interface ScrollToTopFABProps {
  threshold?: number;
  smooth?: boolean;
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

export function ScrollToTopFAB({
  threshold = 300,
  smooth = true,
  position = 'bottom-right',
  className = '',
}: ScrollToTopFABProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  const positionStyles = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button key="visible"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          onClick={scrollToTop}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={`
            fixed z-50 w-12 h-12 rounded-full flex items-center justify-center
            bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800
            shadow-lg hover:bg-gray-700 dark:hover:bg-gray-300
            transition-colors
            ${positionStyles[position]}
            ${className}
          `}
        >
          <ChevronUp className="w-6 h-6" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Preset Actions Factory
// ============================================================================

export function createFABActions(options: {
  onAdd?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onMessage?: () => void;
  onDelete?: () => void;
}): FABAction[] {
  const actions: FABAction[] = [];

  if (options.onAdd) {
    actions.push({
      id: 'add',
      label: 'Add',
      icon: <Plus className="w-5 h-5" />,
      onClick: options.onAdd,
    });
  }

  if (options.onEdit) {
    actions.push({
      id: 'edit',
      label: 'Edit',
      icon: <Edit className="w-5 h-5" />,
      onClick: options.onEdit,
    });
  }

  if (options.onShare) {
    actions.push({
      id: 'share',
      label: 'Share',
      icon: <Share2 className="w-5 h-5" />,
      onClick: options.onShare,
    });
  }

  if (options.onMessage) {
    actions.push({
      id: 'message',
      label: 'Message',
      icon: <MessageCircle className="w-5 h-5" />,
      onClick: options.onMessage,
    });
  }

  if (options.onDelete) {
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-5 h-5" />,
      onClick: options.onDelete,
      color: 'bg-red-500 text-white hover:bg-red-600',
    });
  }

  return actions;
}
