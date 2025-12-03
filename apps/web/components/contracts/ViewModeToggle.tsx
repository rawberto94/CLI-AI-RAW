/**
 * View Mode Toggle Component
 * 
 * Allows switching between different contract list view modes:
 * - Compact (list view)
 * - Cards (grid view)
 * - Timeline (chronological view)
 * - Kanban (board view by status)
 * - Calendar (monthly calendar view)
 */

'use client';

import React, { memo } from 'react';
import {
  List,
  LayoutGrid,
  GitBranch,
  Columns3,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ViewMode } from './ContractsList';

// ============================================================================
// Types
// ============================================================================

export interface ViewModeOption {
  value: ViewMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
}

export interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  variant?: 'toggle' | 'dropdown' | 'buttons';
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

// ============================================================================
// View Mode Options
// ============================================================================

export const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  {
    value: 'compact',
    label: 'List',
    description: 'Compact list view',
    icon: <List className="h-4 w-4" />,
    shortcut: '1',
  },
  {
    value: 'cards',
    label: 'Cards',
    description: 'Grid of cards',
    icon: <LayoutGrid className="h-4 w-4" />,
    shortcut: '2',
  },
  {
    value: 'timeline',
    label: 'Timeline',
    description: 'Chronological timeline',
    icon: <GitBranch className="h-4 w-4" />,
    shortcut: '3',
  },
  {
    value: 'kanban',
    label: 'Board',
    description: 'Kanban board by status',
    icon: <Columns3 className="h-4 w-4" />,
    shortcut: '4',
  },
  {
    value: 'calendar',
    label: 'Calendar',
    description: 'Monthly calendar view',
    icon: <Calendar className="h-4 w-4" />,
    shortcut: '5',
  },
];

// ============================================================================
// Toggle Variant (default)
// ============================================================================

const ToggleVariant = memo(function ToggleVariant({
  value,
  onChange,
  size = 'md',
  className,
}: ViewModeToggleProps) {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-9',
    lg: 'h-10',
  };

  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as ViewMode)}
        className={cn('bg-muted rounded-lg p-1', className)}
      >
        {VIEW_MODE_OPTIONS.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={option.value}
                aria-label={option.label}
                className={cn(
                  sizeClasses[size],
                  'data-[state=on]:bg-background data-[state=on]:shadow-sm'
                )}
              >
                {option.icon}
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              <span>{option.label}</span>
              {option.shortcut && (
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">
                  {option.shortcut}
                </kbd>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
});

// ============================================================================
// Dropdown Variant
// ============================================================================

const DropdownVariant = memo(function DropdownVariant({
  value,
  onChange,
  size = 'md',
  showLabels = true,
  className,
}: ViewModeToggleProps) {
  const currentOption = VIEW_MODE_OPTIONS.find((o) => o.value === value) || VIEW_MODE_OPTIONS[0];

  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-9 text-sm',
    lg: 'h-10 text-base',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(sizeClasses[size], 'gap-2', className)}
        >
          {currentOption?.icon}
          {showLabels && <span>{currentOption?.label}</span>}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>View Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {VIEW_MODE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center justify-between',
              value === option.value && 'bg-accent'
            )}
          >
            <div className="flex items-center gap-2">
              {option.icon}
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </div>
            {option.shortcut && (
              <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">
                {option.shortcut}
              </kbd>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ============================================================================
// Buttons Variant (with labels)
// ============================================================================

const ButtonsVariant = memo(function ButtonsVariant({
  value,
  onChange,
  size = 'md',
  className,
}: ViewModeToggleProps) {
  const sizeClasses = {
    sm: 'h-7 text-xs px-2',
    md: 'h-8 text-sm px-3',
    lg: 'h-9 text-base px-4',
  };

  return (
    <div className={cn('flex items-center gap-1 bg-muted p-1 rounded-lg', className)}>
      {VIEW_MODE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            sizeClasses[size],
            value === option.value
              ? 'shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span className="ml-1.5 hidden sm:inline">{option.label}</span>
        </Button>
      ))}
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const ViewModeToggle = memo(function ViewModeToggle(props: ViewModeToggleProps) {
  const { variant = 'toggle', ...rest } = props;

  switch (variant) {
    case 'dropdown':
      return <DropdownVariant {...rest} variant={variant} />;
    case 'buttons':
      return <ButtonsVariant {...rest} variant={variant} />;
    case 'toggle':
    default:
      return <ToggleVariant {...rest} variant={variant} />;
  }
});

export default ViewModeToggle;
