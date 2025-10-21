/**
 * Data Mode Toggle Component
 * 
 * Beautiful toggle to switch between mock and real data
 * Shows data source indicator and statistics
 */

'use client';

import { useDataMode } from '@/hooks/useDataMode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Database, Sparkles, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DataModeToggleProps {
  showLabel?: boolean;
  showStats?: boolean;
  className?: string;
}

export function DataModeToggle({ 
  showLabel = true, 
  showStats = false,
  className = '' 
}: DataModeToggleProps) {
  const { mode, toggleMode } = useDataMode();
  const isMock = mode === 'mock';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLabel && (
        <span className="text-sm font-medium text-gray-700">Data Source:</span>
      )}
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMode}
              className={`
                relative overflow-hidden transition-all duration-300
                ${isMock 
                  ? 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700' 
                  : 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700'
                }
              `}
            >
              {isMock ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  <span className="font-medium">Mock Data</span>
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  <span className="font-medium">Real Data</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <p className="font-semibold">
                {isMock ? '🎭 Demo Mode' : '🔴 Live Mode'}
              </p>
              <p className="text-sm">
                {isMock 
                  ? 'Using curated mock data for demonstrations. Perfect for showcasing features without real contracts.'
                  : 'Using real data from your uploaded contracts. Shows actual AI-extracted insights and benchmarks.'
                }
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Click to switch to {isMock ? 'real' : 'mock'} data
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Badge 
        variant="outline" 
        className={`
          ${isMock 
            ? 'border-purple-300 bg-purple-100 text-purple-700' 
            : 'border-blue-300 bg-blue-100 text-blue-700'
          }
        `}
      >
        {isMock ? 'Demo' : 'Live'}
      </Badge>

      {showStats && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Info className="h-4 w-4 text-gray-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Data Statistics</p>
                {isMock ? (
                  <>
                    <p>• 50+ mock suppliers</p>
                    <p>• 200+ rate cards</p>
                    <p>• 6 geographies</p>
                    <p>• 100% data quality</p>
                  </>
                ) : (
                  <>
                    <p>• Real uploaded contracts</p>
                    <p>• AI-extracted rates</p>
                    <p>• Live benchmarks</p>
                    <p>• Actual insights</p>
                  </>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

/**
 * Compact version for headers/toolbars
 */
export function DataModeToggleCompact() {
  const { mode, toggleMode } = useDataMode();
  const isMock = mode === 'mock';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleMode}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all duration-300 hover:scale-105
              ${isMock 
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }
            `}
          >
            {isMock ? (
              <>
                <Sparkles className="h-3 w-3" />
                <span>Demo</span>
              </>
            ) : (
              <>
                <Database className="h-3 w-3" />
                <span>Live</span>
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to switch to {isMock ? 'real' : 'mock'} data</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Banner version for prominent display
 */
export function DataModeBanner() {
  const { mode } = useDataMode();
  const isMock = mode === 'mock';

  if (!isMock) return null; // Only show banner in mock mode

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 p-4 rounded-lg">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-purple-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-purple-900">
            Demo Mode Active
          </h4>
          <p className="text-sm text-purple-700 mt-1">
            You're viewing curated mock data. Switch to "Real Data" to see insights from your uploaded contracts.
          </p>
        </div>
        <DataModeToggleCompact />
      </div>
    </div>
  );
}
