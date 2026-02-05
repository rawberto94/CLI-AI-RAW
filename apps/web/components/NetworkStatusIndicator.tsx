"use client";

/**
 * Network Status Indicator
 * 
 * Shows a subtle banner when offline or on slow connection.
 * Auto-hides when connection is restored.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function NetworkStatusIndicator() {
  const { status, isOnline: _isOnline, isSlow: _isSlow, reconnect, reconnectAttempts } = useNetworkStatus();

  const showBanner = status === 'offline' || status === 'slow' || status === 'reconnecting';

  if (!showBanner) return null;

  const getConfig = () => {
    switch (status) {
      case 'offline':
        return {
          icon: WifiOff,
          message: "You're offline. Some features may be unavailable.",
          color: "bg-red-500",
          textColor: "text-white",
        };
      case 'slow':
        return {
          icon: AlertTriangle,
          message: "Slow connection detected. Loading may take longer.",
          color: "bg-amber-500",
          textColor: "text-white",
        };
      case 'reconnecting':
        return {
          icon: RefreshCw,
          message: `Reconnecting... (attempt ${reconnectAttempts})`,
          color: "bg-violet-500",
          textColor: "text-white",
        };
      default:
        return {
          icon: Wifi,
          message: "",
          color: "bg-gray-500",
          textColor: "text-white",
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`${config.color} ${config.textColor} overflow-hidden`}
      >
        <div className="px-4 py-2 flex items-center justify-center gap-3 text-sm">
          <Icon className={`w-4 h-4 ${status === 'reconnecting' ? 'animate-spin' : ''}`} />
          <span>{config.message}</span>
          {status === 'offline' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={reconnect}
              className="h-7 px-3 text-xs bg-white/20 hover:bg-white/30 border-0"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Try Again
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Floating network status badge - shows in corner
 */
export function NetworkStatusBadge() {
  const { status, isOnline } = useNetworkStatus();

  if (isOnline && status !== 'slow') return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      className="fixed bottom-4 right-4 z-50"
    >
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-full shadow-lg
        ${status === 'offline' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}
      `}>
        {status === 'offline' ? (
          <WifiOff className="w-4 h-4" />
        ) : (
          <AlertTriangle className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">
          {status === 'offline' ? 'Offline' : 'Slow Connection'}
        </span>
      </div>
    </motion.div>
  );
}
