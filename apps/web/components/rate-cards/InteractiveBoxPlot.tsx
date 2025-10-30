'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

interface BoxPlotData {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  outliers?: number[];
  count: number;
}

interface InteractiveBoxPlotProps {
  data: BoxPlotData[];
  title?: string;
  yAxisLabel?: string;
  height?: number;
}

export function InteractiveBoxPlot({
  data,
  title,
  yAxisLabel = 'Rate (USD)',
  height = 400,
}: InteractiveBoxPlotProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Transform data for Recharts
  const chartData = data.map((item) => ({
    name: item.category,
    min: item.min,
    q1: item.q1,
    median: item.median,
    q3: item.q3,
    max: item.max,
    mean: item.mean,
    iqr: item.q3 - item.q1,
    lowerWhisker: item.min,
    upperWhisker: item.max,
    count: item.count,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{data.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Max:</span>
            <span className="font-medium">${data.max.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Q3 (75%):</span>
            <span className="font-medium">${data.q3.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Median:</span>
            <span className="font-medium text-blue-600">${data.median.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Mean:</span>
            <span className="font-medium text-green-600">${data.mean.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Q1 (25%):</span>
            <span className="font-medium">${data.q1.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600">Min:</span>
            <span className="font-medium">${data.min.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4 pt-2 border-t border-gray-200">
            <span className="text-gray-600">Sample Size:</span>
            <span className="font-medium">{data.count}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />

          {/* Box plot visualization using bars */}
          {/* Lower whisker to Q1 */}
          <Bar
            dataKey="q1"
            stackId="box"
            fill="transparent"
            stroke="transparent"
          />
          
          {/* IQR box (Q1 to Q3) */}
          <Bar
            dataKey="iqr"
            stackId="box"
            fill="#3b82f6"
            fillOpacity={0.3}
            stroke="#3b82f6"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
          />

          {/* Median line */}
          <Line
            type="monotone"
            dataKey="median"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 4, fill: '#2563eb' }}
            name="Median"
          />

          {/* Mean line */}
          <Line
            type="monotone"
            dataKey="mean"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4, fill: '#10b981' }}
            name="Mean"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend explanation */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        <p className="font-medium text-gray-900 mb-2">How to read this chart:</p>
        <ul className="space-y-1">
          <li>• The blue box shows the interquartile range (IQR) - where 50% of rates fall</li>
          <li>• The solid blue line shows the median (50th percentile)</li>
          <li>• The dashed green line shows the mean (average)</li>
          <li>• Hover over each category to see detailed statistics</li>
        </ul>
      </div>
    </div>
  );
}
