/**
 * Data Visualization Components Stub
 */

import React from 'react';

export interface ChartProps {
  data: any[];
  className?: string;
}

export function LineChart({ data, className }: ChartProps) {
  return <div className={className}>Line Chart: {data.length} data points</div>;
}

export function BarChart({ data, className }: ChartProps) {
  return <div className={className}>Bar Chart: {data.length} data points</div>;
}

export function PieChart({ data, className }: ChartProps) {
  return <div className={className}>Pie Chart: {data.length} data points</div>;
}

export function AreaChart({ data, className }: ChartProps) {
  return <div className={className}>Area Chart: {data.length} data points</div>;
}

export function ScatterChart({ data, className }: ChartProps) {
  return <div className={className}>Scatter Chart: {data.length} data points</div>;
}

export function DataTable({ data, columns, className }: any) {
  return (
    <div className={className}>
      <table className="w-full">
        <thead>
          <tr>
            {columns?.map((col: any, i: number) => (
              <th key={i}>{col.header || col.key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.map((row: any, i: number) => (
            <tr key={i}>
              {columns?.map((col: any, j: number) => (
                <td key={j}>{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ScoreGauge component for displaying scores/metrics
export interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function ScoreGauge({ 
  score, 
  maxScore = 100, 
  label, 
  size = 'md',
  color = 'blue'
}: ScoreGaugeProps) {
  const percentage = (score / maxScore) * 100;
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${sizeClasses[size]}`}>
        <svg className="transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={`var(--${color}-600, #3b82f6)`}
            strokeWidth="10"
            strokeDasharray={`${percentage * 2.827} 283`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{score}</span>
        </div>
      </div>
      {label && <span className="text-sm text-gray-600">{label}</span>}
    </div>
  );
}
