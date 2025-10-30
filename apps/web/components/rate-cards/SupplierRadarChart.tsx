'use client';

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
} from 'recharts';

interface SupplierScore {
  supplierId: string;
  supplierName: string;
  priceCompetitiveness: number;
  geographicCoverage: number;
  rateStability: number;
  growthTrajectory: number;
  qualityScore?: number;
  responseTime?: number;
}

interface SupplierRadarChartProps {
  suppliers: SupplierScore[];
  height?: number;
  maxSuppliers?: number;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
];

const DIMENSIONS = [
  { key: 'priceCompetitiveness', label: 'Price' },
  { key: 'geographicCoverage', label: 'Coverage' },
  { key: 'rateStability', label: 'Stability' },
  { key: 'growthTrajectory', label: 'Growth' },
  { key: 'qualityScore', label: 'Quality' },
  { key: 'responseTime', label: 'Response' },
];

export function SupplierRadarChart({
  suppliers,
  height = 400,
  maxSuppliers = 3,
}: SupplierRadarChartProps) {
  // Limit to max suppliers
  const displaySuppliers = suppliers.slice(0, maxSuppliers);

  // Transform data for radar chart
  const chartData = DIMENSIONS.map((dim) => {
    const dataPoint: any = { dimension: dim.label };
    
    displaySuppliers.forEach((supplier) => {
      const value = (supplier as any)[dim.key];
      if (value !== undefined && value !== null) {
        dataPoint[supplier.supplierName] = value;
      }
    });

    return dataPoint;
  }).filter((point) => {
    // Only include dimensions that have data for at least one supplier
    return Object.keys(point).length > 1;
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{payload[0].payload.dimension}</p>
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
              <span className="text-sm font-medium">{entry.value.toFixed(1)}/100</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Supplier Comparison</h3>
        <p className="text-sm text-gray-600">
          Multi-dimensional performance analysis (scores out of 100)
        </p>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />

          {displaySuppliers.map((supplier, index) => (
            <Radar
              key={supplier.supplierId}
              name={supplier.supplierName}
              dataKey={supplier.supplierName}
              stroke={COLORS[index % COLORS.length]}
              fill={COLORS[index % COLORS.length]}
              fillOpacity={0.2}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>

      {/* Supplier details */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {displaySuppliers.map((supplier, index) => (
          <div
            key={supplier.supplierId}
            className="p-4 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <h4 className="font-semibold text-gray-900">{supplier.supplierName}</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Price:</span>
                <span className="font-medium">{supplier.priceCompetitiveness.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Coverage:</span>
                <span className="font-medium">{supplier.geographicCoverage.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Stability:</span>
                <span className="font-medium">{supplier.rateStability.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Growth:</span>
                <span className="font-medium">{supplier.growthTrajectory.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {suppliers.length > maxSuppliers && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          Showing top {maxSuppliers} suppliers. {suppliers.length - maxSuppliers} more available.
        </div>
      )}
    </div>
  );
}
