'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts'
import { motion } from 'framer-motion'

interface RateDataPoint {
  timestamp: string
  dailyRateCHF: number
  forecastRate?: number
  label?: string
}

interface InteractiveRateChartProps {
  data: RateDataPoint[]
  currentRate?: number
  targetRate?: number
  onDataPointClick?: (point: RateDataPoint) => void
  showForecast?: boolean
  animationDuration?: number
  height?: number
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-3 rounded-lg shadow-lg border border-gray-200"
      >
        <p className="text-sm font-semibold text-gray-900 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: CHF {entry.value.toLocaleString()}
          </p>
        ))}
      </motion.div>
    )
  }
  return null
}

export function InteractiveRateChart({
  data,
  currentRate,
  targetRate,
  onDataPointClick,
  showForecast = false,
  animationDuration = 1000,
  height = 400
}: InteractiveRateChartProps) {
  const handleClick = (data: any) => {
    if (onDataPointClick && data && data.activePayload) {
      onDataPointClick(data.activePayload[0].payload)
    }
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          onClick={handleClick}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => {
              const date = new Date(value)
              return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
            }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => `CHF ${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
            iconType="line"
          />

          {/* Current Rate Reference Line */}
          {currentRate && (
            <ReferenceLine
              y={currentRate}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{
                value: `Current: CHF ${currentRate.toLocaleString()}`,
                position: 'right',
                fill: '#ef4444',
                fontSize: 12
              }}
            />
          )}

          {/* Target Rate Reference Line */}
          {targetRate && (
            <ReferenceLine
              y={targetRate}
              stroke="#10b981"
              strokeDasharray="5 5"
              label={{
                value: `Target: CHF ${targetRate.toLocaleString()}`,
                position: 'right',
                fill: '#10b981',
                fontSize: 12
              }}
            />
          )}

          {/* Actual Rate Line */}
          <Line
            type="monotone"
            dataKey="dailyRateCHF"
            name="Market Rate"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{
              fill: '#3b82f6',
              strokeWidth: 2,
              r: 4,
              cursor: onDataPointClick ? 'pointer' : 'default'
            }}
            activeDot={{
              r: 6,
              stroke: '#3b82f6',
              strokeWidth: 2,
              fill: '#fff',
              cursor: onDataPointClick ? 'pointer' : 'default'
            }}
            animationDuration={animationDuration}
            animationEasing="ease-in-out"
          />

          {/* Forecast Line */}
          {showForecast && (
            <Line
              type="monotone"
              dataKey="forecastRate"
              name="Forecast"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{
                fill: '#10b981',
                strokeWidth: 2,
                r: 3
              }}
              animationDuration={animationDuration}
              animationEasing="ease-in-out"
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Chart Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-blue-500"></div>
          <span>Historical Market Rate</span>
        </div>
        {showForecast && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-500 border-dashed border-t-2 border-green-500"></div>
            <span>Projected Trend</span>
          </div>
        )}
        {currentRate && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-red-500 border-dashed border-t-2 border-red-500"></div>
            <span>Your Current Rate</span>
          </div>
        )}
        {targetRate && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-600 border-dashed border-t-2 border-green-600"></div>
            <span>Target Rate</span>
          </div>
        )}
      </div>
    </div>
  )
}
