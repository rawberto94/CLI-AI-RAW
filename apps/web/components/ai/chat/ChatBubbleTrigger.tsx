'use client';

/**
 * Chat Bubble Trigger
 * Floating button to open the AI chatbot with notifications
 */

import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Sparkles,
  X,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnhancedChatbot } from './EnhancedChatbot';

interface ChatBubbleTriggerProps {
  contractContext?: { id: string; name: string } | null;
  position?: 'bottom-right' | 'bottom-left';
  showProactiveMessage?: boolean;
  proactiveMessage?: string;
  proactiveDelay?: number;
  className?: string;
}

export const ChatBubbleTrigger = memo(({
  contractContext,
  position = 'bottom-right',
  showProactiveMessage = true,
  proactiveMessage = "👋 Need help with contracts? Ask me anything!",
  proactiveDelay = 5000,
  className,
}: ChatBubbleTriggerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showProactive, setShowProactive] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Check if user has interacted before
  useEffect(() => {
    const interacted = localStorage.getItem('chat-bubble-interacted');
    if (interacted) {
      setHasInteracted(true);
    }
  }, []);

  // Show proactive message after delay
  useEffect(() => {
    if (!showProactiveMessage || hasInteracted || isOpen) return;

    const timer = setTimeout(() => {
      setShowProactive(true);
    }, proactiveDelay);

    return () => clearTimeout(timer);
  }, [showProactiveMessage, proactiveDelay, hasInteracted, isOpen]);

  // Dismiss proactive message after 10 seconds
  useEffect(() => {
    if (!showProactive) return;

    const timer = setTimeout(() => {
      setShowProactive(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, [showProactive]);

  // Handle open
  const handleOpen = () => {
    setIsOpen(true);
    setShowProactive(false);
    setUnreadCount(0);
    setHasInteracted(true);
    localStorage.setItem('chat-bubble-interacted', 'true');
  };

  // Handle close
  const handleClose = () => {
    setIsOpen(false);
  };

  // Dismiss proactive
  const dismissProactive = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProactive(false);
    setHasInteracted(true);
    localStorage.setItem('chat-bubble-interacted', 'true');
  };

  const positionClasses = position === 'bottom-right'
    ? 'right-6 bottom-6'
    : 'left-6 bottom-6';

  return (
    <>
      {/* Floating bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              "fixed z-40",
              positionClasses,
              className
            )}
          >
            {/* Proactive message */}
            <AnimatePresence>
              {showProactive && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  className={cn(
                    "absolute bottom-full mb-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 max-w-[280px]",
                    position === 'bottom-right' ? 'right-0' : 'left-0'
                  )}
                >
                  <button
                    onClick={dismissProactive}
                    className="absolute -top-2 -right-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <X className="h-3 w-3 text-slate-500" />
                  </button>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {proactiveMessage}
                  </p>
                  <div className={cn(
                    "absolute bottom-0 translate-y-full border-8 border-transparent border-t-white dark:border-t-slate-800",
                    position === 'bottom-right' ? 'right-6' : 'left-6'
                  )} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpen}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="relative p-4 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-shadow"
            >
              {/* Pulse animation */}
              <motion.div
                className="absolute inset-0 rounded-full bg-indigo-500"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Icon */}
              <AnimatePresence mode="wait">
                {isHovered ? (
                  <motion.div
                    key="sparkles"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Sparkles className="h-6 w-6 relative z-10" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="message"
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: -180 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MessageCircle className="h-6 w-6 relative z-10" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Unread badge */}
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold px-1.5"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Keyboard shortcut hint */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className={cn(
                    "absolute bottom-full mb-2 whitespace-nowrap px-2 py-1 bg-slate-900 text-white text-xs rounded-md",
                    position === 'bottom-right' ? 'right-0' : 'left-0'
                  )}
                >
                  Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] ml-1">⌘</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] ml-0.5">K</kbd> to search
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chatbot */}
      <AnimatePresence>
        {isOpen && (
          <EnhancedChatbot
            isOpen={isOpen}
            onClose={handleClose}
            contractContext={contractContext}
          />
        )}
      </AnimatePresence>
    </>
  );
});

ChatBubbleTrigger.displayName = 'ChatBubbleTrigger';

export default ChatBubbleTrigger;
