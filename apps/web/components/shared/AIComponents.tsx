// Shared AI Intelligence Platform Components

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { aiStyles, getIconContainerClass, getStatusClass } from '@/lib/theme';
import { Brain, Sparkles, Zap, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

// AI Status Indicator
interface AIStatusProps {
  status: 'online' | 'processing' | 'warning' | 'error';
  label?: string;
}

export function AIStatus({ status, label }: AIStatusProps) {
  const statusConfig = {
    online: { icon: CheckCircle, text: label || 'AI Online', color: 'text-green-600' },
    processing: { icon: Zap, text: label || 'Processing', color: 'text-blue-600' },
    warning: { icon: AlertTriangle, text: label || 'Warning', color: 'text-yellow-600' },
    error: { icon: AlertTriangle, text: label || 'Error', color: 'text-red-600' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={getStatusClass(status)}>
      <div className="w-2 h-2 bg-current rounded-full animate-pulse"></div>
      <Icon className={`w-4 h-4 ${config.color}`} />
      <span className={`text-sm font-medium ${config.color}`}>{config.text}</span>
    </div>
  );
}

// Executive Header Card
interface ExecutiveHeaderProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function ExecutiveHeader({ title, subtitle, icon, children }: ExecutiveHeaderProps) {
  return (
    <Card className={aiStyles.executiveHeader}>
      <div className="absolute inset-0 bg-black/10"></div>
      <CardContent className="p-8 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {icon && (
              <div className={getIconContainerClass('large')}>
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold mb-2">{title}</h1>
              <p className="text-blue-100 text-lg">{subtitle}</p>
            </div>
          </div>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

// Metric Card
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
}

export function MetricCard({ title, value, change, icon, trend = 'neutral', description }: MetricCardProps) {
  const trendColor = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
  };

  return (
    <Card className={aiStyles.metricCard}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={getIconContainerClass('small')}>
            {icon}
          </div>
          {change !== undefined && (
            <Badge variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'}>
              {change > 0 ? '+' : ''}{change}%
            </Badge>
          )}
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// AI Insight Card
interface AIInsightProps {
  title: string;
  description: string;
  confidence?: number;
  category?: string;
  impact?: 'high' | 'medium' | 'low';
}

export function AIInsight({ title, description, confidence, category, impact = 'medium' }: AIInsightProps) {
  const impactColors = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-yellow-200 bg-yellow-50',
    low: 'border-green-200 bg-green-50',
  };

  return (
    <Card className={`${impactColors[impact]} border-2`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900">{title}</h4>
              {confidence && (
                <Badge variant="outline" className="text-xs">
                  {confidence}% confidence
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-700 mb-2">{description}</p>
            {category && (
              <Badge variant="secondary" className="text-xs">
                {category}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Processing Stage Indicator
interface ProcessingStageProps {
  stages: Array<{
    name: string;
    status: 'completed' | 'processing' | 'pending';
    progress?: number;
  }>;
}

export function ProcessingStages({ stages }: ProcessingStageProps) {
  return (
    <div className="space-y-3">
      {stages.map((stage, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            stage.status === 'completed' ? 'bg-green-100 text-green-600' :
            stage.status === 'processing' ? 'bg-blue-100 text-blue-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            {stage.status === 'completed' ? (
              <CheckCircle className="w-4 h-4" />
            ) : stage.status === 'processing' ? (
              <Zap className="w-4 h-4 animate-pulse" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${
                stage.status === 'completed' ? 'text-green-700' :
                stage.status === 'processing' ? 'text-blue-700' :
                'text-gray-500'
              }`}>
                {stage.name}
              </span>
              {stage.progress !== undefined && (
                <span className="text-xs text-gray-500">{stage.progress}%</span>
              )}
            </div>
            {stage.progress !== undefined && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    stage.status === 'completed' ? 'bg-green-500' :
                    stage.status === 'processing' ? 'bg-blue-500' :
                    'bg-gray-300'
                  }`}
                  style={{ width: `${stage.progress}%` }}
                ></div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Quick Action Button
interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
}

export function QuickAction({ title, description, icon, onClick, variant = 'primary' }: QuickActionProps) {
  const variantStyles = {
    primary: 'bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-800 border-blue-200',
    secondary: 'bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 text-purple-800 border-purple-200',
    success: 'bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 text-green-800 border-green-200',
    warning: 'bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 text-orange-800 border-orange-200',
  };

  return (
    <Button 
      onClick={onClick}
      className={`h-auto p-6 flex-col items-start ${variantStyles[variant]}`}
    >
      <div className="w-8 h-8 mb-3">
        {icon}
      </div>
      <div className="text-left">
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-xs opacity-80">{description}</div>
      </div>
    </Button>
  );
}

// Demo Navigation Badge
interface DemoNavBadgeProps {
  type: 'live' | 'demo' | 'beta' | 'new';
  children: React.ReactNode;
}

export function DemoNavBadge({ type, children }: DemoNavBadgeProps) {
  const badgeStyles = {
    live: 'bg-green-100 text-green-800 animate-pulse',
    demo: 'bg-blue-100 text-blue-800',
    beta: 'bg-purple-100 text-purple-800',
    new: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="relative">
      {children}
      <Badge className={`absolute -top-2 -right-2 text-xs px-2 py-1 ${badgeStyles[type]}`}>
        {type.toUpperCase()}
      </Badge>
    </div>
  );
}