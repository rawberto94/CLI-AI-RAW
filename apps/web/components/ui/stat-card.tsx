"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  description?: string;
  loading?: boolean;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      title,
      value,
      change,
      changeLabel = "vs last period",
      icon,
      trend,
      description,
      loading = false,
      className,
      ...props
    },
    ref
  ) => {
    const getTrendIcon = () => {
      if (!trend) return null;
      
      switch (trend) {
        case "up":
          return <TrendingUp className="h-4 w-4" />;
        case "down":
          return <TrendingDown className="h-4 w-4" />;
        case "neutral":
          return <Minus className="h-4 w-4" />;
        default:
          return null;
      }
    };

    const getTrendColor = () => {
      if (!trend) return "text-muted-foreground";
      
      switch (trend) {
        case "up":
          return "text-success";
        case "down":
          return "text-destructive";
        case "neutral":
          return "text-muted-foreground";
        default:
          return "text-muted-foreground";
      }
    };

    if (loading) {
      return (
        <Card ref={ref} className={cn("overflow-hidden", className)} {...props}>
          <CardContent className="p-6">
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-8 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card ref={ref} className={cn("overflow-hidden", className)} {...props}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </p>
              <p className="text-3xl font-bold mt-2 tracking-tight">{value}</p>
              
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
              
              {change !== undefined && (
                <div className="flex items-center gap-1 mt-3">
                  <span className={cn("flex items-center gap-1", getTrendColor())}>
                    {getTrendIcon()}
                    <span className="text-sm font-medium">
                      {change > 0 ? "+" : ""}
                      {change}%
                    </span>
                  </span>
                  {changeLabel && (
                    <span className="text-sm text-muted-foreground">{changeLabel}</span>
                  )}
                </div>
              )}
            </div>
            
            {icon && (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 ml-4">
                <div className="text-primary">{icon}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

StatCard.displayName = "StatCard";

export { StatCard };
