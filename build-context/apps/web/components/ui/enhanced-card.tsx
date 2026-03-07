/**
 * Enhanced Card Component Stub
 */

import React from 'react';

export interface EnhancedCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function EnhancedCard({ children, className = '', title, description }: EnhancedCardProps) {
  return (
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
      {(title || description) && (
        <div className="p-6">
          {title && <h3 className="font-semibold leading-none tracking-tight">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground mt-1.5">{description}</p>}
        </div>
      )}
      <div className="p-6 pt-0">{children}</div>
    </div>
  );
}

export const EnhancedCardHeader = ({ children, className }: any) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>
);

export const EnhancedCardTitle = ({ children, className }: any) => (
  <h3 className={`font-semibold leading-none tracking-tight ${className}`}>{children}</h3>
);

export const EnhancedCardContent = ({ children, className }: any) => (
  <div className={`p-6 pt-0 ${className}`}>{children}</div>
);

// MetricCard component for analytics
export interface MetricCardProps {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  title?: string;
  value: string | number;
  subtitle?: string;
  iconColor?: string;
  bgColor?: string;
  color?: string;
  size?: string;
  alert?: boolean;
}

export function MetricCard({ 
  icon: Icon, 
  label, 
  title,
  value, 
  subtitle, 
  iconColor = 'text-violet-600', 
  bgColor = 'bg-violet-50',
  color,
  size,
  alert 
}: MetricCardProps) {
  return (
    <div className={`p-4 rounded-xl border transition-all hover:shadow-md ${
      alert ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-sm text-gray-600 mb-1">{title || label}</div>
          <div className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</div>
          {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${bgColor}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
}
