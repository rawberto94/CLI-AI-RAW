'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Database, TestTube, AlertCircle, CheckCircle } from 'lucide-react';

export type DataMode = 'real' | 'mock' | 'fallback';

interface DataModeToggleProps {
  currentMode: DataMode;
  onModeChange: (mode: DataMode) => void;
  showBadge?: boolean;
  className?: string;
}

/**
 * Data Mode Toggle Component
 * Allows users to switch between real and mock data sources
 */
export function DataModeToggle({
  currentMode,
  onModeChange,
  showBadge = true,
  className = ''
}: DataModeToggleProps) {
  const getModeIcon = (mode: DataMode) => {
    switch (mode) {
      case 'real':
        return <Database className="h-4 w-4" />;
      case 'mock':
        return <TestTube className="h-4 w-4" />;
      case 'fallback':
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getModeColor = (mode: DataMode) => {
    switch (mode) {
      case 'real':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'mock':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'fallback':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    }
  };

  const getModeLabel = (mode: DataMode) => {
    switch (mode) {
      case 'real':
        return 'Real Data';
      case 'mock':
        return 'Mock Data';
      case 'fallback':
        return 'Fallback';
    }
  };

  const getModeDescription = (mode: DataMode) => {
    switch (mode) {
      case 'real':
        return 'Live data from database';
      case 'mock':
        return 'Simulated test data';
      case 'fallback':
        return 'Static fallback data';
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showBadge && (
        <Badge 
          variant="outline" 
          className={`${getModeColor(currentMode)} flex items-center gap-1.5 px-2.5 py-1`}
        >
          {getModeIcon(currentMode)}
          <span className="text-xs font-medium">{getModeLabel(currentMode)}</span>
        </Badge>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            Switch Mode
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Data Source</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => onModeChange('real')}
            className="flex items-start gap-3 py-2.5"
          >
            <Database className="h-4 w-4 mt-0.5 text-green-600" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Real Data</span>
                {currentMode === 'real' && (
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getModeDescription('real')}
              </p>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => onModeChange('mock')}
            className="flex items-start gap-3 py-2.5"
          >
            <TestTube className="h-4 w-4 mt-0.5 text-blue-600" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Mock Data</span>
                {currentMode === 'mock' && (
                  <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getModeDescription('mock')}
              </p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Compact Data Mode Indicator
 * Shows just the badge without the dropdown
 */
export function DataModeIndicator({ mode }: { mode: DataMode }) {
  const getModeIcon = (mode: DataMode) => {
    switch (mode) {
      case 'real':
        return <Database className="h-3.5 w-3.5" />;
      case 'mock':
        return <TestTube className="h-3.5 w-3.5" />;
      case 'fallback':
        return <AlertCircle className="h-3.5 w-3.5" />;
    }
  };

  const getModeColor = (mode: DataMode) => {
    switch (mode) {
      case 'real':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'mock':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'fallback':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    }
  };

  const getModeLabel = (mode: DataMode) => {
    switch (mode) {
      case 'real':
        return 'Real';
      case 'mock':
        return 'Mock';
      case 'fallback':
        return 'Fallback';
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={`${getModeColor(mode)} flex items-center gap-1 px-2 py-0.5`}
    >
      {getModeIcon(mode)}
      <span className="text-xs">{getModeLabel(mode)}</span>
    </Badge>
  );
}
