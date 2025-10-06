'use client'

/**
 * Professional loading skeleton components for Rate Benchmarking
 * Provides smooth, content-aware loading states
 */

export function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-6 bg-gray-200 rounded w-48"></div>
        <div className="h-10 bg-gray-200 rounded w-32"></div>
      </div>
      
      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 border-b p-4 flex gap-4">
          <div className="h-4 bg-gray-200 rounded flex-1"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
        
        {/* Table Rows */}
        {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-b p-4 flex gap-4 items-center">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-6 bg-gray-200 rounded-full w-16"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="border rounded-lg p-6 space-y-4">
        {/* Chart Title */}
        <div className="flex items-center justify-between">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="h-8 bg-gray-200 rounded w-24"></div>
        </div>
        
        {/* Chart Area */}
        <div className="h-64 bg-gradient-to-t from-gray-100 to-gray-50 rounded-lg flex items-end justify-around p-4 gap-2">
          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-200 rounded-t"
              style={{
                width: '10%',
                height: `${Math.random() * 60 + 40}%`
              }}
            ></div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex gap-4 justify-center">
          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MetricCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="border rounded-lg p-4 space-y-2">
            <div className="h-8 bg-gray-200 rounded w-16 mx-auto"></div>
            <div className="h-3 bg-gray-100 rounded w-24 mx-auto"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ConfigPanelSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="border rounded-lg p-6 space-y-6">
        {/* Section 1 */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-10 bg-gray-100 rounded"></div>
          <div className="grid grid-cols-2 gap-2">
            {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
        
        {/* Section 2 */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-100 rounded"></div>
        </div>
        
        {/* Section 3 */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-28"></div>
          <div className="h-10 bg-gray-100 rounded"></div>
        </div>
      </div>
    </div>
  )
}
