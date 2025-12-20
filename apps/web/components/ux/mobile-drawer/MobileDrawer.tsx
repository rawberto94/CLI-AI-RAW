'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  memo,
  useRef,
  ReactNode,
} from 'react';
import { motion, AnimatePresence, PanInfo, useDragControls } from 'framer-motion';
import { X, ChevronLeft, GripHorizontal, Menu } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type DrawerPosition = 'left' | 'right' | 'bottom' | 'top';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: DrawerPosition;
  size?: DrawerSize;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  showHandle?: boolean;
  showCloseButton?: boolean;
  showOverlay?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  swipeToClose?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footer?: ReactNode;
  preventScroll?: boolean;
}

// ============================================================================
// Size Mappings
// ============================================================================

const sizeClasses: Record<DrawerPosition, Record<DrawerSize, string>> = {
  left: {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[28rem]',
    full: 'w-full',
  },
  right: {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
    xl: 'w-[28rem]',
    full: 'w-full',
  },
  bottom: {
    sm: 'h-1/4',
    md: 'h-1/2',
    lg: 'h-3/4',
    xl: 'h-[85vh]',
    full: 'h-full',
  },
  top: {
    sm: 'h-1/4',
    md: 'h-1/2',
    lg: 'h-3/4',
    xl: 'h-[85vh]',
    full: 'h-full',
  },
};

// ============================================================================
// Animation Variants
// ============================================================================

const getVariants = (position: DrawerPosition) => {
  const variants = {
    left: {
      hidden: { x: '-100%', opacity: 0 },
      visible: { x: 0, opacity: 1 },
      exit: { x: '-100%', opacity: 0 },
    },
    right: {
      hidden: { x: '100%', opacity: 0 },
      visible: { x: 0, opacity: 1 },
      exit: { x: '100%', opacity: 0 },
    },
    bottom: {
      hidden: { y: '100%', opacity: 0 },
      visible: { y: 0, opacity: 1 },
      exit: { y: '100%', opacity: 0 },
    },
    top: {
      hidden: { y: '-100%', opacity: 0 },
      visible: { y: 0, opacity: 1 },
      exit: { y: '-100%', opacity: 0 },
    },
  };
  return variants[position];
};

// ============================================================================
// Position Classes
// ============================================================================

const getPositionClasses = (position: DrawerPosition) => {
  const classes = {
    left: 'left-0 top-0 h-full',
    right: 'right-0 top-0 h-full',
    bottom: 'bottom-0 left-0 w-full rounded-t-3xl',
    top: 'top-0 left-0 w-full rounded-b-3xl',
  };
  return classes[position];
};

// ============================================================================
// Mobile Drawer Component
// ============================================================================

export const MobileDrawer = memo(function MobileDrawer({
  isOpen,
  onClose,
  position = 'right',
  size = 'md',
  title,
  subtitle,
  children,
  showHandle = position === 'bottom',
  showCloseButton = true,
  showOverlay = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  swipeToClose = true,
  className = '',
  headerClassName = '',
  contentClassName = '',
  footer,
  preventScroll = true,
}: MobileDrawerProps) {
  const dragControls = useDragControls();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (preventScroll && isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, preventScroll]);

  // Close on Escape key
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Handle swipe to close
  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (!swipeToClose) return;

      const threshold = 100;
      const velocity = 500;

      const shouldClose =
        (position === 'left' && (info.offset.x < -threshold || info.velocity.x < -velocity)) ||
        (position === 'right' && (info.offset.x > threshold || info.velocity.x > velocity)) ||
        (position === 'bottom' && (info.offset.y > threshold || info.velocity.y > velocity)) ||
        (position === 'top' && (info.offset.y < -threshold || info.velocity.y < -velocity));

      if (shouldClose) {
        onClose();
      }
    },
    [swipeToClose, position, onClose]
  );

  const getDragConstraints = () => {
    const constraints = {
      left: { left: -200, right: 0, top: 0, bottom: 0 },
      right: { left: 0, right: 200, top: 0, bottom: 0 },
      bottom: { left: 0, right: 0, top: 0, bottom: 200 },
      top: { left: 0, right: 0, top: -200, bottom: 0 },
    };
    return constraints[position];
  };

  const getDragDirection = () => {
    if (position === 'left' || position === 'right') return 'x';
    return 'y';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          {showOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeOnOverlayClick ? onClose : undefined}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            />
          )}

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            variants={getVariants(position)}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag={swipeToClose ? getDragDirection() : false}
            dragControls={dragControls}
            dragConstraints={getDragConstraints()}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className={`fixed z-50 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col ${getPositionClasses(
              position
            )} ${sizeClasses[position][size]} ${className}`}
            style={{
              maxHeight: position === 'bottom' || position === 'top' ? '90vh' : '100vh',
              maxWidth: position === 'left' || position === 'right' ? '90vw' : '100vw',
            }}
          >
            {/* Handle for bottom drawer */}
            {showHandle && (position === 'bottom' || position === 'top') && (
              <div
                className={`flex justify-center py-3 cursor-grab active:cursor-grabbing ${
                  position === 'bottom' ? '' : 'order-last'
                }`}
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div
                className={`flex items-center justify-between px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 ${headerClassName}`}
              >
                <div className="flex items-center gap-3">
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="p-2 -ml-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                      aria-label="Close drawer"
                    >
                      {position === 'right' ? (
                        <X className="w-5 h-5" />
                      ) : (
                        <ChevronLeft className="w-5 h-5" />
                      )}
                    </button>
                  )}
                  <div>
                    {title && (
                      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
                    )}
                  </div>
                </div>

                {/* Handle for side drawers */}
                {showHandle && (position === 'left' || position === 'right') && (
                  <div
                    className="p-2 cursor-grab active:cursor-grabbing"
                    onPointerDown={(e) => dragControls.start(e)}
                  >
                    <GripHorizontal className="w-5 h-5 text-zinc-400" />
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div
              className={`flex-1 overflow-y-auto overscroll-contain ${contentClassName}`}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// Drawer Context for App-wide Control
// ============================================================================

interface DrawerState {
  id: string;
  isOpen: boolean;
  content: ReactNode;
  props: Partial<MobileDrawerProps>;
}

interface DrawerContextType {
  drawers: DrawerState[];
  openDrawer: (id: string, content: ReactNode, props?: Partial<MobileDrawerProps>) => void;
  closeDrawer: (id: string) => void;
  closeAllDrawers: () => void;
}

const DrawerContext = createContext<DrawerContextType | null>(null);

export const useDrawer = () => {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within DrawerProvider');
  }
  return context;
};

// ============================================================================
// Drawer Provider
// ============================================================================

interface DrawerProviderProps {
  children: ReactNode;
}

export const DrawerProvider = memo(function DrawerProvider({
  children,
}: DrawerProviderProps) {
  const [drawers, setDrawers] = useState<DrawerState[]>([]);

  const openDrawer = useCallback(
    (id: string, content: ReactNode, props: Partial<MobileDrawerProps> = {}) => {
      setDrawers((prev) => {
        const existing = prev.find((d) => d.id === id);
        if (existing) {
          return prev.map((d) =>
            d.id === id ? { ...d, isOpen: true, content, props } : d
          );
        }
        return [...prev, { id, isOpen: true, content, props }];
      });
    },
    []
  );

  const closeDrawer = useCallback((id: string) => {
    setDrawers((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isOpen: false } : d))
    );
  }, []);

  const closeAllDrawers = useCallback(() => {
    setDrawers((prev) => prev.map((d) => ({ ...d, isOpen: false })));
  }, []);

  const value = useMemo(
    () => ({ drawers, openDrawer, closeDrawer, closeAllDrawers }),
    [drawers, openDrawer, closeDrawer, closeAllDrawers]
  );

  return (
    <DrawerContext.Provider value={value}>
      {children}
      {drawers.map((drawer) => (
        <MobileDrawer
          key={drawer.id}
          isOpen={drawer.isOpen}
          onClose={() => closeDrawer(drawer.id)}
          {...drawer.props}
        >
          {drawer.content}
        </MobileDrawer>
      ))}
    </DrawerContext.Provider>
  );
});

// ============================================================================
// Responsive Drawer Component
// ============================================================================

interface ResponsiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  desktopPosition?: 'left' | 'right';
  mobilePosition?: 'bottom' | 'right';
  desktopSize?: DrawerSize;
  mobileSize?: DrawerSize;
  breakpoint?: number;
  className?: string;
  footer?: ReactNode;
}

export const ResponsiveDrawer = memo(function ResponsiveDrawer({
  isOpen,
  onClose,
  title,
  children,
  desktopPosition = 'right',
  mobilePosition = 'bottom',
  desktopSize = 'lg',
  mobileSize = 'lg',
  breakpoint = 768,
  className = '',
  footer,
}: ResponsiveDrawerProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      position={isMobile ? mobilePosition : desktopPosition}
      size={isMobile ? mobileSize : desktopSize}
      showHandle={isMobile && mobilePosition === 'bottom'}
      swipeToClose={isMobile}
      className={className}
      footer={footer}
    >
      {children}
    </MobileDrawer>
  );
});

// ============================================================================
// Menu Drawer Trigger
// ============================================================================

interface DrawerTriggerProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

export const DrawerTrigger = memo(function DrawerTrigger({
  onClick,
  className = '',
  label = 'Menu',
}: DrawerTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors ${className}`}
      aria-label={label}
    >
      <Menu className="w-5 h-5" />
    </button>
  );
});

// ============================================================================
// Action Sheet (iOS-style bottom drawer)
// ============================================================================

export interface ActionSheetAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

export const ActionSheet = memo(function ActionSheet({
  isOpen,
  onClose,
  title,
  message,
  actions,
  cancelLabel = 'Cancel',
}: ActionSheetProps) {
  return (
    <MobileDrawer
      isOpen={isOpen}
      onClose={onClose}
      position="bottom"
      size="sm"
      showHandle={true}
      showCloseButton={false}
      className="rounded-t-3xl"
    >
      <div className="p-4">
        {(title || message) && (
          <div className="text-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
            {title && (
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {title}
              </h3>
            )}
            {message && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {message}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                action.onClick();
                onClose();
              }}
              disabled={action.disabled}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                action.disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : action.destructive
                  ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {action.icon && <action.icon className="w-5 h-5" />}
              <span className="font-medium">{action.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          {cancelLabel}
        </button>
      </div>
    </MobileDrawer>
  );
});
