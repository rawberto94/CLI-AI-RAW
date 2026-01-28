'use client'

import React from 'react'
import { useDataMode } from '@/contexts/DataModeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Database, Sparkles, TestTube, Check } from 'lucide-react'

export function EnhancedDataModeToggle() {
  const { dataMode, setDataMode, isRealData, isMockData, isAIGenerated } = useDataMode()

  const modes = [
    {
      value: 'real' as const,
      label: 'Real Data',
      description: 'Production database',
      icon: Database,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      active: isRealData
    },
    {
      value: 'mock' as const,
      label: 'Mock Data',
      description: 'Sample test data',
      icon: TestTube,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      active: isMockData
    },
    {
      value: 'ai-generated' as const,
      label: 'AI Generated',
      description: 'AI-created samples',
      icon: Sparkles,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      active: isAIGenerated
    }
  ]

  const currentMode = modes.find(m => m.active)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentMode && <currentMode.icon className={`h-4 w-4 ${currentMode.color}`} />}
          <span className="hidden sm:inline">{currentMode?.label}</span>
          <Badge variant="secondary" className="ml-1">
            {dataMode}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Data Source</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {modes.map((mode) => (
          <DropdownMenuItem
            key={mode.value}
            onClick={() => setDataMode(mode.value)}
            className="flex items-start gap-3 p-3 cursor-pointer"
          >
            <div className={`p-2 rounded-lg ${mode.bgColor}`}>
              <mode.icon className={`h-4 w-4 ${mode.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{mode.label}</span>
                {mode.active && <Check className="h-4 w-4 text-green-600" />}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{mode.description}</p>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="p-2 text-xs text-gray-500">
          Switch between real production data, mock test data, or AI-generated samples
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
