'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

export interface QuickAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action?: string;
  message?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

interface QuickActionsProps {
  actions: QuickAction[];
  onAction?: (action: QuickAction) => void;
  onSendMessage?: (message: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'inline' | 'grid';
}

export function QuickActions({
  actions,
  onAction,
  onSendMessage,
  size = 'sm',
  variant = 'inline',
}: QuickActionsProps) {
  const handleClick = (action: QuickAction) => {
    if (onAction) {
      onAction(action);
    } else if (onSendMessage && (action.message || action.label)) {
      onSendMessage(action.message || action.label);
    }
  };

  return (
    <div
      className={`flex flex-wrap gap-1.5 mt-2 ${
        variant === 'grid' ? 'grid grid-cols-2' : ''
      }`}
    >
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size={size === 'sm' ? 'sm' : 'default'}
          className="text-xs h-7 px-2.5 rounded-full"
          onClick={() => handleClick(action)}
        >
          {action.icon && <span className="mr-1">{action.icon}</span>}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
