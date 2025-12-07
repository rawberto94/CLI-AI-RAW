/**
 * System Status Badge
 * Real-time indicator showing system health in sidebar/header
 */

'use client';

import { useState, useEffect, memo } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Loader2,
  Server,
  Database,
  HardDrive,
  Cpu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency?: number;
  }[];
  timestamp: string;
  uptime?: string;
}

const statusConfig = {
  healthy: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200',
    pulseColor: 'bg-green-500',
    icon: CheckCircle2,
    label: 'All Systems Operational',
  },
  degraded: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-200',
    pulseColor: 'bg-amber-500',
    icon: AlertTriangle,
    label: 'Degraded Performance',
  },
  unhealthy: {
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-200',
    pulseColor: 'bg-red-500',
    icon: XCircle,
    label: 'System Issues Detected',
  },
};

const serviceIcons: Record<string, React.ElementType> = {
  database: Database,
  redis: Server,
  storage: HardDrive,
  api: Cpu,
};

export const SystemStatusBadge = memo(function SystemStatusBadge({
  className,
  showDetails = false,
}: {
  className?: string;
  showDetails?: boolean;
}) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/health', {
          cache: 'no-store',
        });
        
        if (!response.ok) {
          throw new Error('Health check failed');
        }
        
        const data = await response.json();
        setHealth({
          status: data.status || 'healthy',
          services: data.services || [
            { name: 'database', status: 'healthy', latency: 5 },
            { name: 'redis', status: 'healthy', latency: 2 },
            { name: 'storage', status: 'healthy', latency: 10 },
            { name: 'api', status: 'healthy', latency: 3 },
          ],
          timestamp: data.timestamp || new Date().toISOString(),
          uptime: data.uptime,
        });
        setError(null);
      } catch (err) {
        setError('Unable to check system status');
        setHealth({
          status: 'unhealthy',
          services: [],
          timestamp: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1.5 px-2 py-1', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        <span className="text-xs text-slate-500">Checking...</span>
      </div>
    );
  }

  const status = health?.status || 'unhealthy';
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const badge = (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer',
        config.bgColor,
        config.borderColor,
        'hover:shadow-sm',
        className
      )}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            config.pulseColor
          )}
        />
        <span
          className={cn(
            'relative inline-flex rounded-full h-2.5 w-2.5',
            config.pulseColor
          )}
        />
      </span>
      <span className={cn('text-xs font-medium', config.color)}>
        {status === 'healthy' ? 'Online' : status === 'degraded' ? 'Degraded' : 'Offline'}
      </span>
    </div>
  );

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{config.label}</p>
              {health?.uptime && (
                <p className="text-xs text-muted-foreground">Uptime: {health.uptime}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent side="right" className="w-72" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('h-5 w-5', config.color)} />
            <div>
              <p className="font-semibold text-sm">{config.label}</p>
              {health?.uptime && (
                <p className="text-xs text-muted-foreground">Uptime: {health.uptime}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Services
            </p>
            <div className="space-y-1.5">
              {health?.services.map((service) => {
                const ServiceIcon = serviceIcons[service.name] || Server;
                const serviceStatus = statusConfig[service.status];
                return (
                  <div
                    key={service.name}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <ServiceIcon className="h-3.5 w-3.5 text-slate-500" />
                      <span className="text-sm capitalize">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {service.latency !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {service.latency}ms
                        </span>
                      )}
                      <Badge
                        variant="secondary"
                        className={cn(
                          'h-5 text-[10px]',
                          serviceStatus.bgColor,
                          serviceStatus.color
                        )}
                      >
                        {service.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground border-t pt-2">
            Last checked: {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : 'Unknown'}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
