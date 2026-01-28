/**
 * Stage Indicator Component
 * Shows current stage in a multi-step process
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, AlertCircle } from 'lucide-react';

export interface Stage {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

export interface StageIndicatorProps {
  stages: Stage[];
  currentStage: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function StageIndicator({
  stages,
  currentStage,
  orientation = 'horizontal',
  className = '',
}: StageIndicatorProps) {
  const getStageIcon = (status: Stage['status']) => {
    switch (status) {
      case 'complete':
        return <Check className="w-4 h-4" />;
      case 'active':
        return <Clock className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-current" />;
    }
  };

  const getStageColors = (status: Stage['status']) => {
    switch (status) {
      case 'complete':
        return {
          bg: 'bg-green-100',
          border: 'border-green-500',
          text: 'text-green-700',
          icon: 'text-green-600',
        };
      case 'active':
        return {
          bg: 'bg-violet-100',
          border: 'border-violet-500',
          text: 'text-violet-700',
          icon: 'text-violet-600',
        };
      case 'error':
        return {
          bg: 'bg-red-100',
          border: 'border-red-500',
          text: 'text-red-700',
          icon: 'text-red-600',
        };
      default:
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-300',
          text: 'text-gray-500',
          icon: 'text-gray-400',
        };
    }
  };

  const isHorizontal = orientation === 'horizontal';

  return (
    <div className={`${isHorizontal ? 'flex items-center' : 'flex flex-col'} ${className}`}>
      {stages.map((stage, index) => {
        const colors = getStageColors(stage.status);
        const isLast = index === stages.length - 1;
        const isActive = stage.id === currentStage;

        return (
          <div key={stage.id} className={`flex ${isHorizontal ? 'items-center' : 'flex-col'}`}>
            <div className={`flex ${isHorizontal ? 'items-center gap-3' : 'flex-col items-center gap-2'}`}>
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full border-2
                  ${colors.bg} ${colors.border} ${colors.icon}
                  ${isActive ? 'ring-2 ring-offset-2 ring-violet-500' : ''}
                `}
              >
                {getStageIcon(stage.status)}
              </div>

              <div className={`${isHorizontal ? 'text-left' : 'text-center'}`}>
                <p className={`text-sm font-medium ${colors.text}`}>
                  {stage.label}
                </p>
              </div>
            </div>

            {!isLast && (
              <div
                className={`
                  ${isHorizontal 
                    ? 'flex-1 h-px bg-gray-300 mx-4' 
                    : 'w-px h-8 bg-gray-300 my-2 ml-4'
                  }
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
