/**
 * ConnectionStatusIndicator Component
 * Displays real-time connection status with reconnection progress
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRealTime } from '@/contexts/RealTimeContext';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface ConnectionStatusIndicatorProps {
  showLabel?: boolean;
  variant?: 'badge' | 'icon' | 'full';
  position?: 'header' | 'footer' | 'inline';
}

export function ConnectionStatusIndicator({
  showLabel = true,
  variant = 'badge',
}: ConnectionStatusIndicatorProps) {
  const { isConnected, error, reconnect, connectionAttempts } = useRealTime();
  const [showReconnecting, setShowReconnecting] = useState(false);

  useEffect(() => {
    if (!isConnected && connectionAttempts > 0) {
      setShowReconnecting(true);
    } else {
      setShowReconnecting(false);
    }
  }, [isConnected, connectionAttempts]);

  const getStatusColor = () => {
    if (isConnected) return 'text-green-600';
    if (showReconnecting) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBgColor = () => {
    if (isConnected) return 'bg-green-100';
    if (showReconnecting) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getStatusText = () => {
    if (isConnected) return 'Connected';
    if (showReconnecting) return `Reconnecting... (${connectionAttempts})`;
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (isConnected) {
      return <Wifi className="h-4 w-4" />;
    }
    if (showReconnecting) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    return <WifiOff className="h-4 w-4" />;
  };

  const getTooltipContent = () => {
    if (isConnected) {
      return 'Real-time updates are active';
    }
    if (showReconnecting) {
      return `Attempting to reconnect (attempt ${connectionAttempts})`;
    }
    if (error) {
      return `Connection error: ${error.message}`;
    }
    return 'Real-time updates are unavailable';
  };

  // Badge variant
  if (variant === 'badge') {
    return (
      <Badge
        variant="outline"
        className={`${getStatusBgColor()} ${getStatusColor()} border-current cursor-help`}
        title={getTooltipContent()}
      >
        {getStatusIcon()}
        {showLabel && <span className="ml-2">{getStatusText()}</span>}
      </Badge>
    );
  }

  // Icon only variant
  if (variant === 'icon') {
    return (
      <div className={`${getStatusColor()} cursor-help`} title={getTooltipContent()}>
        {getStatusIcon()}
      </div>
    );
  }

  // Full variant with reconnect button
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 ${getStatusColor()}`}>
        {getStatusIcon()}
        {showLabel && <span className="text-sm font-medium">{getStatusText()}</span>}
      </div>
      
      {!isConnected && !showReconnecting && (
        <Button
          size="sm"
          variant="outline"
          onClick={reconnect}
          className="h-7 text-xs"
        >
          Reconnect
        </Button>
      )}

      {error && (
        <div className="cursor-help" title={error.message}>
          <AlertCircle className="h-4 w-4 text-red-600" />
        </div>
      )}
    </div>
  );
}

/**
 * Compact connection status for header/footer
 */
export function CompactConnectionStatus() {
  return (
    <ConnectionStatusIndicator
      showLabel={false}
      variant="icon"
    />
  );
}

/**
 * Full connection status with controls
 */
export function FullConnectionStatus() {
  return (
    <ConnectionStatusIndicator
      showLabel={true}
      variant="full"
    />
  );
}
