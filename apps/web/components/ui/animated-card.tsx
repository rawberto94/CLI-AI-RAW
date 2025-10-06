/**
 * Animated Card Component
 * Card with hover effects and interactions
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { animationConfig } from '@/lib/animations/config';

export interface AnimatedCardProps {
  children: React.ReactNode;
  hover?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  title?: string;
  className?: string;
}

export function AnimatedCard({
  children,
  hover = true,
  selectable = false,
  selected = false,
  onSelect,
  collapsible = false,
  defaultExpanded = true,
  title,
  className = '',
}: AnimatedCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const cardVariants = {
    rest: {
      scale: 1,
      boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
    },
    hover: {
      scale: 1.02,
      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      transition: {
        duration: animationConfig.duration.fast,
        ease: animationConfig.easing.easeOut,
      },
    },
    selected: {
      scale: 1,
      boxShadow: '0 0 0 2px rgb(59 130 246)',
    },
  };

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect();
    }
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="rest"
      whileHover={hover && !selected ? 'hover' : undefined}
      animate={selected ? 'selected' : 'rest'}
      onClick={handleClick}
      className={`
        bg-white rounded-lg border border-gray-200 overflow-hidden
        ${selectable || collapsible ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {collapsible && title ? (
        <>
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: animationConfig.duration.fast }}
            >
              <ChevronDown className="w-5 h-5 text-gray-500" />
            </motion.div>
          </div>
          
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  duration: animationConfig.duration.normal,
                  ease: animationConfig.easing.easeInOut,
                }}
              >
                <div className="p-4">{children}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="p-4">{children}</div>
      )}
    </motion.div>
  );
}

/**
 * Card Grid - for displaying cards in a grid
 */
export function CardGrid({
  children,
  columns = 3,
  gap = 4,
  className = '',
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 2 | 4 | 6 | 8;
  className?: string;
}) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const gapClasses = {
    2: 'gap-2',
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: animationConfig.duration.normal }}
      className={`grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: animationConfig.duration.normal,
            delay: index * animationConfig.stagger.fast,
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

/**
 * Draggable Card - for drag-and-drop interfaces
 */
export function DraggableCard({
  children,
  onDragStart,
  onDragEnd,
  className = '',
}: {
  children: React.ReactNode;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
}) {
  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{
        scale: 1.05,
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        cursor: 'grabbing',
      }}
      className={`
        bg-white rounded-lg border border-gray-200 p-4 cursor-grab
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}

/**
 * Flip Card - card that flips to show back content
 */
export function FlipCard({
  front,
  back,
  className = '',
}: {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className={`perspective-1000 ${className}`}>
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front */}
        <div
          className="absolute inset-0 backface-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <AnimatedCard hover>{front}</AnimatedCard>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 backface-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <AnimatedCard hover>{back}</AnimatedCard>
        </div>
      </motion.div>
    </div>
  );
}
