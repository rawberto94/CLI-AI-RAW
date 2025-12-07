/**
 * Benchmark Visualization Component
 * Full implementation with interactive charts for rate benchmarking
 */

'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Filter,
  Download,
  Maximize2,
  Info,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BenchmarkDataPoint {
  category: string;
  yourRate: number;
  marketP25: number;
  marketP50: number;
  marketP75: number;
  industryAvg: number;
  trend: 'up' | 'down' | 'stable';
  percentile?: number;
}

export interface BenchmarkVisualizationProps {
  data?: BenchmarkDataPoint[];
  className?: string;
  onExport?: () => void;
  onExpand?: () => void;
  title?: string;
}

const defaultData: BenchmarkDataPoint[] = [
  { category: 'Software Development', yourRate: 125, marketP25: 95, marketP50: 120, marketP75: 150, industryAvg: 118, trend: 'up', percentile: 55 },
  { category: 'Data Engineering', yourRate: 145, marketP25: 110, marketP50: 140, marketP75: 175, industryAvg: 138, trend: 'stable', percentile: 52 },
  { category: 'Cloud Architecture', yourRate: 175, marketP25: 140, marketP50: 180, marketP75: 220, industryAvg: 178, trend: 'up', percentile: 45 },
  { category: 'DevOps', yourRate: 130, marketP25: 100, marketP50: 125, marketP75: 160, industryAvg: 128, trend: 'down', percentile: 60 },
  { category: 'UI/UX Design', yourRate: 95, marketP25: 80, marketP50: 100, marketP75: 125, industryAvg: 98, trend: 'stable', percentile: 48 },
  { category: 'Project Management', yourRate: 110, marketP25: 85, marketP50: 105, marketP75: 135, industryAvg: 108, trend: 'up', percentile: 58 },
];

type ViewMode = 'comparison' | 'distribution' | 'percentile';

export function BenchmarkVisualization({ 
  data = defaultData, 
  className,
  onExport,
  onExpand,
  title = "Rate Benchmark Analysis"
}: BenchmarkVisualizationProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('comparison');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const avgPercentile = data.reduce((sum, d) => sum + (d.percentile || 50), 0) / data.length;
    const aboveMarket = data.filter(d => d.yourRate > d.marketP50).length;
    const belowMarket = data.filter(d => d.yourRate < d.marketP50).length;
    const upTrends = data.filter(d => d.trend === 'up').length;
    const downTrends = data.filter(d => d.trend === 'down').length;

    return {
      avgPercentile: Math.round(avgPercentile),
      aboveMarket,
      belowMarket,
      atMarket: data.length - aboveMarket - belowMarket,
      upTrends,
      downTrends,
      stableTrends: data.length - upTrends - downTrends
    };
  }, [data]);

  // Calculate max value for scaling
  const maxValue = useMemo(() => {
    return Math.max(...data.flatMap(d => [d.yourRate, d.marketP75, d.industryAvg])) * 1.1;
  }, [data]);

  const getBarWidth = (value: number) => `${(value / maxValue) * 100}%`;

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPositionIndicator = (yourRate: number, p25: number, p50: number, p75: number) => {
    if (yourRate < p25) return { text: 'Below P25', color: 'text-green-600', icon: ArrowDownRight };
    if (yourRate < p50) return { text: 'P25-P50', color: 'text-blue-600', icon: ArrowDownRight };
    if (yourRate < p75) return { text: 'P50-P75', color: 'text-orange-600', icon: ArrowUpRight };
    return { text: 'Above P75', color: 'text-red-600', icon: ArrowUpRight };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("bg-white rounded-xl border border-gray-200 shadow-sm", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">Compare your rates against market benchmarks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showFilters ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-500"
            )}
          >
            <Filter className="h-4 w-4" />
          </button>
          {onExport && (
            <button
              onClick={onExport}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-100 bg-gray-50">
        {(['comparison', 'distribution', 'percentile'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              viewMode === mode
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 p-4 border-b border-gray-100">
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-600 font-medium">Average Percentile</p>
          <p className="text-2xl font-bold text-blue-700">{summary.avgPercentile}%</p>
          <p className="text-xs text-blue-500">vs market median</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-xs text-green-600 font-medium">Below Market</p>
          <p className="text-2xl font-bold text-green-700">{summary.belowMarket}</p>
          <p className="text-xs text-green-500">competitive rates</p>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg">
          <p className="text-xs text-orange-600 font-medium">Trending Up</p>
          <p className="text-2xl font-bold text-orange-700">{summary.upTrends}</p>
          <p className="text-xs text-orange-500">categories rising</p>
        </div>
      </div>

      {/* Visualization Area */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {viewMode === 'comparison' && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {data.map((item, index) => {
                const position = getPositionIndicator(item.yourRate, item.marketP25, item.marketP50, item.marketP75);
                const isSelected = selectedCategory === item.category;

                return (
                  <motion.div
                    key={item.category}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedCategory(isSelected ? null : item.category)}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      isSelected 
                        ? "border-blue-300 bg-blue-50" 
                        : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    {/* Category Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.category}</span>
                        {getTrendIcon(item.trend)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium", position.color)}>
                          {position.text}
                        </span>
                        <ChevronDown className={cn(
                          "h-4 w-4 text-gray-400 transition-transform",
                          isSelected && "rotate-180"
                        )} />
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                      {/* Market Range (P25-P75) */}
                      <div
                        className="absolute h-full bg-blue-100"
                        style={{
                          left: getBarWidth(item.marketP25),
                          width: `${((item.marketP75 - item.marketP25) / maxValue) * 100}%`
                        }}
                      />
                      {/* Your Rate */}
                      <div
                        className="absolute h-full w-1 bg-blue-600"
                        style={{ left: getBarWidth(item.yourRate) }}
                      />
                      {/* Industry Avg */}
                      <div
                        className="absolute h-full w-0.5 bg-orange-400"
                        style={{ left: getBarWidth(item.industryAvg) }}
                      />
                      {/* P50 Marker */}
                      <div
                        className="absolute h-full w-0.5 bg-gray-400 opacity-50"
                        style={{ left: getBarWidth(item.marketP50) }}
                      />
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>${item.marketP25}/hr</span>
                      <span className="font-medium text-blue-600">${item.yourRate}/hr (You)</span>
                      <span>${item.marketP75}/hr</span>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 pt-3 border-t border-blue-200 overflow-hidden"
                        >
                          <div className="grid grid-cols-4 gap-3">
                            <div className="text-center">
                              <p className="text-xs text-gray-500">P25</p>
                              <p className="font-medium text-gray-700">${item.marketP25}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Median</p>
                              <p className="font-medium text-gray-700">${item.marketP50}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500">P75</p>
                              <p className="font-medium text-gray-700">${item.marketP75}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Industry Avg</p>
                              <p className="font-medium text-orange-600">${item.industryAvg}</p>
                            </div>
                          </div>
                          <div className="mt-3 p-2 bg-white rounded-lg">
                            <p className="text-xs text-gray-500">
                              Your rate is at the <span className="font-medium text-blue-600">{item.percentile}th percentile</span> of market rates.
                              {item.yourRate < item.marketP50 
                                ? " You're priced competitively below the median."
                                : item.yourRate > item.marketP75
                                  ? " Consider if premium pricing is justified."
                                  : " You're within the expected market range."
                              }
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {viewMode === 'distribution' && (
            <motion.div
              key="distribution"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <Info className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-blue-700">
                  Distribution view shows how your rates compare to the market spread
                </span>
              </div>
              
              {data.map((item, index) => (
                <div key={item.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{item.category}</span>
                    <span className="text-gray-500">${item.yourRate}/hr</span>
                  </div>
                  <div className="relative h-6 bg-gray-100 rounded">
                    {/* Full range background */}
                    <div 
                      className="absolute h-full bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded"
                      style={{ width: '100%' }}
                    />
                    {/* Your position marker */}
                    <div
                      className="absolute top-0 h-full flex items-center"
                      style={{ left: `calc(${(item.yourRate / maxValue) * 100}% - 8px)` }}
                    >
                      <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md" />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {viewMode === 'percentile' && (
            <motion.div
              key="percentile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-4"
            >
              {data.map((item, index) => {
                const percentile = item.percentile || 50;
                const circumference = 2 * Math.PI * 40;
                const offset = circumference - (percentile / 100) * circumference;

                return (
                  <motion.div
                    key={item.category}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20">
                        <svg className="w-full h-full -rotate-90">
                          <circle
                            cx="40"
                            cy="40"
                            r="40"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="8"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="40"
                            fill="none"
                            stroke={percentile < 40 ? '#22c55e' : percentile > 60 ? '#ef4444' : '#f59e0b'}
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-gray-700">{percentile}%</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.category}</p>
                        <p className="text-sm text-gray-500">${item.yourRate}/hr</p>
                        <div className="flex items-center gap-1 mt-1">
                          {getTrendIcon(item.trend)}
                          <span className="text-xs text-gray-400">
                            {item.trend === 'up' ? 'Rising' : item.trend === 'down' ? 'Falling' : 'Stable'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Legend */}
      <div className="flex items-center justify-center gap-6 p-3 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-600 rounded" />
          <span className="text-xs text-gray-600">Your Rate</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-100 rounded" />
          <span className="text-xs text-gray-600">P25-P75 Range</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 bg-orange-400" />
          <span className="text-xs text-gray-600">Industry Avg</span>
        </div>
      </div>
    </motion.div>
  );
}

export default BenchmarkVisualization;
