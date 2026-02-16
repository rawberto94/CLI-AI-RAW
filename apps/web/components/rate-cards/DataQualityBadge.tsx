'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface DataQualityBadgeProps {
  score: number;
  showIcon?: boolean;
  className?: string;
}

export function DataQualityBadge({ score, showIcon = true, className = '' }: DataQualityBadgeProps) {
  const getQualityLevel = (score: number) => {
    if (score >= 90) return { label: 'Excellent', variant: 'default' as const, color: 'bg-green-100 text-green-800', icon: CheckCircle };
    if (score >= 75) return { label: 'Good', variant: 'secondary' as const, color: 'bg-violet-100 text-violet-800', icon: CheckCircle };
    if (score >= 60) return { label: 'Fair', variant: 'outline' as const, color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
    return { label: 'Poor', variant: 'destructive' as const, color: 'bg-red-100 text-red-800', icon: XCircle };
  };

  const quality = getQualityLevel(score);
  const Icon = quality.icon;

  return (
    <Badge variant={quality.variant} className={`${quality.color} ${className}`}>
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {quality.label} ({score.toFixed(0)}%)
    </Badge>
  );
}
