'use client';

/**
 * Contextual Help Components
 * Inline help, hints, and interactive tooltips for guidance
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  HelpCircle, 
  Info, 
  Lightbulb, 
  X,
  ChevronRight,
  ExternalLink,
  PlayCircle,
  BookOpen,
  type LucideIcon
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface HelpTopic {
  id: string;
  title: string;
  content: string;
  category?: string;
  learnMoreUrl?: string;
  videoUrl?: string;
}

// ============================================================================
// Help Tooltip
// ============================================================================

interface HelpTooltipProps {
  content: string;
  title?: string;
  learnMoreUrl?: string;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  children?: ReactNode;
  className?: string;
}

export function HelpTooltip({
  content,
  title,
  learnMoreUrl,
  placement = 'top',
  children,
  className,
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const placements = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  };

  const arrows = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-slate-800 border-l-transparent border-r-transparent border-b-transparent',
    right: 'left-[-6px] top-1/2 -translate-y-1/2 border-r-slate-800 border-t-transparent border-b-transparent border-l-transparent',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-b-slate-800 border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-6px] top-1/2 -translate-y-1/2 border-l-slate-800 border-t-transparent border-b-transparent border-r-transparent',
  };

  return (
    <div 
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {children || (
        <button 
          type="button"
          className="text-slate-400 hover:text-slate-600 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 w-64 p-3 bg-slate-800 rounded-lg shadow-lg',
              placements[placement]
            )}
          >
            {/* Arrow */}
            <div className={cn('absolute w-0 h-0 border-[6px]', arrows[placement])} />

            {title && (
              <p className="font-medium text-white text-sm mb-1">{title}</p>
            )}
            <p className="text-sm text-slate-300">{content}</p>
            
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300"
              >
                Learn more
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Inline Hint
// ============================================================================

interface InlineHintProps {
  children: ReactNode;
  variant?: 'info' | 'tip' | 'warning';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function InlineHint({
  children,
  variant = 'info',
  dismissible = false,
  onDismiss,
  className,
}: InlineHintProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const variants = {
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-500',
      text: 'text-blue-800',
      Icon: Info,
    },
    tip: {
      bg: 'bg-amber-50 border-amber-200',
      icon: 'text-amber-500',
      text: 'text-amber-800',
      Icon: Lightbulb,
    },
    warning: {
      bg: 'bg-orange-50 border-orange-200',
      icon: 'text-orange-500',
      text: 'text-orange-800',
      Icon: Info,
    },
  };

  const v = variants[variant];

  if (isDismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border',
        v.bg,
        className
      )}
    >
      <v.Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', v.icon)} />
      <div className={cn('flex-1 text-sm', v.text)}>
        {children}
      </div>
      {dismissible && (
        <button
          onClick={() => {
            setIsDismissed(true);
            onDismiss?.();
          }}
          className={cn('text-slate-400 hover:text-slate-600', v.icon)}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}

// ============================================================================
// Field Help
// ============================================================================

interface FieldHelpProps {
  children: ReactNode;
  className?: string;
}

export function FieldHelp({ children, className }: FieldHelpProps) {
  return (
    <p className={cn('text-xs text-slate-500 mt-1.5', className)}>
      {children}
    </p>
  );
}

// ============================================================================
// Help Card
// ============================================================================

interface HelpCardProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  learnMoreUrl?: string;
  className?: string;
}

export function HelpCard({
  icon: Icon = BookOpen,
  title,
  description,
  action,
  learnMoreUrl,
  className,
}: HelpCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-slate-900">{title}</h4>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
          
          <div className="flex items-center gap-4 mt-3">
            {action && (
              <button
                onClick={action.onClick}
                className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                {action.label}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <BookOpen className="w-4 h-4" />
                Docs
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Video Help
// ============================================================================

interface VideoHelpProps {
  thumbnailUrl?: string;
  videoUrl: string;
  title: string;
  duration?: string;
  className?: string;
}

export function VideoHelp({
  thumbnailUrl,
  videoUrl,
  title,
  duration,
  className,
}: VideoHelpProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <motion.div
      className={cn('rounded-xl overflow-hidden border border-slate-200', className)}
      whileHover={{ scale: 1.02 }}
    >
      {!isPlaying ? (
        <button
          onClick={() => setIsPlaying(true)}
          className="relative w-full aspect-video bg-slate-100"
        >
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg"
            >
              <PlayCircle className="w-8 h-8 text-indigo-600" />
            </motion.div>
          </div>
          {duration && (
            <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded">
              {duration}
            </span>
          )}
        </button>
      ) : (
        <iframe
          src={videoUrl}
          title={title}
          className="w-full aspect-video"
          allowFullScreen
        />
      )}
      <div className="p-3 bg-white">
        <p className="font-medium text-slate-900 text-sm">{title}</p>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Contextual Help Panel
// ============================================================================

interface HelpPanelContextValue {
  isOpen: boolean;
  currentTopic: HelpTopic | null;
  openPanel: (topic?: HelpTopic) => void;
  closePanel: () => void;
  setTopic: (topic: HelpTopic) => void;
}

const HelpPanelContext = createContext<HelpPanelContextValue | null>(null);

export function useHelpPanel() {
  const context = useContext(HelpPanelContext);
  if (!context) {
    throw new Error('useHelpPanel must be used within a HelpPanelProvider');
  }
  return context;
}

interface HelpPanelProviderProps {
  children: ReactNode;
  topics?: HelpTopic[];
}

export function HelpPanelProvider({ children, topics = [] }: HelpPanelProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<HelpTopic | null>(null);

  const openPanel = useCallback((topic?: HelpTopic) => {
    if (topic) setCurrentTopic(topic);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setTopic = useCallback((topic: HelpTopic) => {
    setCurrentTopic(topic);
  }, []);

  return (
    <HelpPanelContext.Provider value={{ isOpen, currentTopic, openPanel, closePanel, setTopic }}>
      {children}
      <HelpPanel topics={topics} />
    </HelpPanelContext.Provider>
  );
}

interface HelpPanelProps {
  topics: HelpTopic[];
}

function HelpPanel({ topics }: HelpPanelProps) {
  const { isOpen, currentTopic, closePanel, setTopic } = useHelpPanel();

  // Group topics by category
  const groupedTopics = topics.reduce((acc, topic) => {
    const cat = topic.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(topic);
    return acc;
  }, {} as Record<string, HelpTopic[]>);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePanel}
            className="fixed inset-0 bg-black/20 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900">Help Center</h3>
              </div>
              <button
                onClick={closePanel}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {currentTopic ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setTopic(null as unknown as HelpTopic)}
                    className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    ← Back to all topics
                  </button>
                  <h4 className="text-lg font-semibold text-slate-900">{currentTopic.title}</h4>
                  <p className="text-slate-600">{currentTopic.content}</p>
                  
                  {currentTopic.learnMoreUrl && (
                    <a
                      href={currentTopic.learnMoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
                    >
                      <BookOpen className="w-4 h-4" />
                      Read documentation
                    </a>
                  )}
                  
                  {currentTopic.videoUrl && (
                    <VideoHelp
                      videoUrl={currentTopic.videoUrl}
                      title={`Tutorial: ${currentTopic.title}`}
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedTopics).map(([category, categoryTopics]) => (
                    <div key={category}>
                      <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        {category}
                      </h5>
                      <div className="space-y-1">
                        {categoryTopics.map((topic) => (
                          <button
                            key={topic.id}
                            onClick={() => setTopic(topic)}
                            className="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            <Info className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-700">{topic.title}</span>
                            <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500 text-center">
                Need more help? <a href="#" className="text-indigo-600 hover:underline">Contact support</a>
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Floating Help Button
// ============================================================================

interface FloatingHelpButtonProps {
  onClick?: () => void;
  className?: string;
}

export function FloatingHelpButton({ onClick, className }: FloatingHelpButtonProps) {
  let helpPanel: HelpPanelContextValue | null = null;
  try {
    helpPanel = useHelpPanel();
  } catch {
    // Not in provider context
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (helpPanel) {
      helpPanel.openPanel();
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      className={cn(
        'fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-500/30',
        'flex items-center justify-center z-40',
        className
      )}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <HelpCircle className="w-6 h-6" />
    </motion.button>
  );
}
