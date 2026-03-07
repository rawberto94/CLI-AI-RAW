'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface ComparisonData {
  name: string;
  value: number;
  baseline?: number;
  category?: string;
}

interface ComparisonBarChartProps {
  data: ComparisonData[];
  title?: string;
  description?: string;
  valueLabel?: string;
  showVariance?: boolean;
  sortBy?: 'name' | 'value' | 'variance';
  sortOrder?: 'asc' | 'desc';
}

export function ComparisonBarChart({
  data,
  title = 'Rate Comparison',
  description = 'Compare rates across different categories',
  valueLabel = 'Rate ($/hr)',
  showVariance = true,
  sortBy = 'value',
  sortOrder = 'desc',
}: ComparisonBarChartProps) {
  const processedData = useMemo(() => {
    const withVariance = data.map((item) => ({
      ...item,
      variance: item.baseline ? ((item.value - item.baseline) / item.baseline) * 100 : 0,
      varianceAbs: item.baseline ? item.value - item.baseline : 0,
    }));

    // Sort data
    const sorted = [...withVariance].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'value') {
        comparison = a.value - b.value;
      } else if (sortBy === 'variance') {
        comparison = a.variance - b.variance;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [data, sortBy, sortOrder]);

  const getBarColor = (item: any) => {
    if (!showVariance || !item.baseline) return '#7c3aed'; // violet-500
    
    if (item.variance > 10) return '#ef4444'; // red-500
    if (item.variance > 0) return '#f59e0b'; // amber-500
    if (item.variance > -10) return '#10b981'; // green-500
    return '#059669'; // green-600
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 space-y-1">
        <div className="font-semibold">{data.name}</div>
        <div className="text-sm">
          <span className="text-muted-foreground">Rate: </span>
          <span className="font-medium">${data.value.toFixed(2)}/hr</span>
        </div>
        {data.baseline && (
          <>
            <div className="text-sm">
              <span className="text-muted-foreground">Baseline: </span>
              <span className="font-medium">${data.baseline.toFixed(2)}/hr</span>
            </div>
            <div className="text-sm flex items-center gap-1">
              <span className="text-muted-foreground">Variance: </span>
              <span
                className={`font-medium flex items-center gap-1 ${
                  data.variance > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {data.variance > 0 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : data.variance < 0 ? (
                  <ArrowDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {Math.abs(data.variance).toFixed(1)}% (${Math.abs(data.varianceAbs).toFixed(2)})
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  const avgValue = processedData.reduce((sum, d) => sum + d.value, 0) / processedData.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                className="text-xs"
              />
              <YAxis label={{ value: valueLabel, angle: -90, position: 'insideLeft' }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={avgValue} stroke="#94a3b8" strokeDasharray="3 3" label="Avg" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Variance Summary */}
          {showVariance && processedData.some((d) => d.baseline) && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Above Baseline</div>
                <div className="text-lg font-semibold text-red-600">
                  {processedData.filter((d) => d.variance > 0).length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">At Baseline</div>
                <div className="text-lg font-semibold text-gray-600">
                  {processedData.filter((d) => d.variance === 0).length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Below Baseline</div>
                <div className="text-lg font-semibold text-green-600">
                  {processedData.filter((d) => d.variance < 0).length}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
