'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
}

interface TimeSeriesSeries {
  name: string;
  data: TimeSeriesDataPoint[];
  color: string;
  showArea?: boolean;
}

interface TimeSeriesChartProps {
  series: TimeSeriesSeries[];
  title?: string;
  yAxisLabel?: string;
  height?: number;
  showBrush?: boolean;
  showZoomControls?: boolean;
}

export function TimeSeriesChart({
  series,
  title,
  yAxisLabel = 'Value',
  height = 400,
  showBrush = true,
  showZoomControls = true,
}: TimeSeriesChartProps) {
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  // Merge all series data by date
  const mergedData = mergeSeries(series);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">
          {new Date(label).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-600">{entry.name}:</span>
              </div>
              <span className="text-sm font-medium">${entry.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleZoomIn = () => {
    if (!zoomDomain) {
      const dataLength = mergedData.length;
      const start = Math.floor(dataLength * 0.25);
      const end = Math.floor(dataLength * 0.75);
      setZoomDomain([start, end]);
    } else {
      const [start, end] = zoomDomain;
      const range = end - start;
      const newStart = start + Math.floor(range * 0.1);
      const newEnd = end - Math.floor(range * 0.1);
      if (newEnd > newStart) {
        setZoomDomain([newStart, newEnd]);
      }
    }
  };

  const handleZoomOut = () => {
    if (zoomDomain) {
      const [start, end] = zoomDomain;
      const range = end - start;
      const newStart = Math.max(0, start - Math.floor(range * 0.2));
      const newEnd = Math.min(mergedData.length - 1, end + Math.floor(range * 0.2));
      
      if (newStart === 0 && newEnd === mergedData.length - 1) {
        setZoomDomain(null);
      } else {
        setZoomDomain([newStart, newEnd]);
      }
    }
  };

  const handleResetZoom = () => {
    setZoomDomain(null);
  };

  const displayData = zoomDomain
    ? mergedData.slice(zoomDomain[0], zoomDomain[1] + 1)
    : mergedData;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        
        {showZoomControls && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Zoom Out"
              disabled={!zoomDomain}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title="Reset Zoom"
              disabled={!zoomDomain}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={displayData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            }
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />

          {series.map((s, index) => (
            s.showArea ? (
              <Area
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.2}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ) : (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            )
          ))}

          {showBrush && !zoomDomain && (
            <Brush
              dataKey="date"
              height={30}
              stroke="#3b82f6"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString('en-US', {
                  month: 'short',
                })
              }
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Chart info */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span>
            Showing {displayData.length} data points
            {zoomDomain && ' (zoomed)'}
          </span>
          {showBrush && !zoomDomain && (
            <span>Drag the brush below to zoom into a specific time range</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Merge multiple series into a single dataset
 */
function mergeSeries(series: TimeSeriesSeries[]): any[] {
  const dateMap = new Map<string, any>();

  series.forEach((s) => {
    s.data.forEach((point) => {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, { date: point.date });
      }
      dateMap.get(point.date)![s.name] = point.value;
    });
  });

  return Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
