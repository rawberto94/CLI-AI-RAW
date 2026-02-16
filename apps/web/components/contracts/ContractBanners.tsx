/**
 * Contract Notifications & Banners
 * 
 * Alert banners and notification components for the contracts page
 */

"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Tag,
  Clock,
  Shield,
  ChevronRight,
  X,
  Sparkles,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// UNCATEGORIZED CONTRACTS BANNER
// ============================================================================

interface UncategorizedBannerProps {
  count: number;
  onDismiss?: () => void;
  onCategorizeAll?: () => void;
  onViewUncategorized?: () => void;
  isCategorizing?: boolean;
  isDismissed?: boolean;
}

export const UncategorizedBanner = memo(function UncategorizedBanner({
  count,
  onDismiss,
  onCategorizeAll,
  onViewUncategorized,
  isCategorizing = false,
  isDismissed = false,
}: UncategorizedBannerProps) {
  if (count === 0 || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div key="ContractBanners-ap-1"
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Tag className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-900">
                    {count} contract{count !== 1 ? 's' : ''} need{count === 1 ? 's' : ''} categorizing
                  </p>
                  <p className="text-sm text-amber-700">
                    Categorize your contracts for better organization and searchability
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onCategorizeAll && (
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg shadow-amber-500/25"
                    onClick={onCategorizeAll}
                    disabled={isCategorizing}
                  >
                    {isCategorizing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Auto-categorize All
                  </Button>
                )}
                {onViewUncategorized && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={onViewUncategorized}
                  >
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {onDismiss && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-amber-500 hover:text-amber-700 hover:bg-amber-100"
                    onClick={onDismiss}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
});

// ============================================================================
// EXPIRING CONTRACTS BANNER
// ============================================================================

interface ExpiringBannerProps {
  count: number;
  urgentCount?: number; // Expiring in 7 days
  onDismiss?: () => void;
  onViewExpiring?: () => void;
  isDismissed?: boolean;
}

export const ExpiringBanner = memo(function ExpiringBanner({
  count,
  urgentCount = 0,
  onDismiss,
  onViewExpiring,
  isDismissed = false,
}: ExpiringBannerProps) {
  if (count === 0 || isDismissed) return null;

  const isUrgent = urgentCount > 0;

  return (
    <AnimatePresence>
      <motion.div key="ContractBanners-ap-2"
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className={cn(
          "border",
          isUrgent 
            ? "bg-gradient-to-r from-red-50 to-orange-50 border-red-200" 
            : "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200"
        )}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  isUrgent ? "bg-red-100" : "bg-yellow-100"
                )}>
                  <Clock className={cn("h-5 w-5", isUrgent ? "text-red-600" : "text-yellow-600")} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={cn("font-medium", isUrgent ? "text-red-900" : "text-yellow-900")}>
                      {count} contract{count !== 1 ? 's' : ''} expiring soon
                    </p>
                    {urgentCount > 0 && (
                      <Badge className="bg-red-100 text-red-700 border-0">
                        {urgentCount} urgent
                      </Badge>
                    )}
                  </div>
                  <p className={cn("text-sm", isUrgent ? "text-red-700" : "text-yellow-700")}>
                    {isUrgent 
                      ? `${urgentCount} contract${urgentCount !== 1 ? 's' : ''} expire within 7 days!`
                      : "Review and renew contracts before expiration"
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onViewExpiring && (
                  <Button
                    size="sm"
                    className={cn(
                      "text-white border-0 shadow-lg",
                      isUrgent 
                        ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-red-500/25"
                        : "bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 shadow-yellow-500/25"
                    )}
                    onClick={onViewExpiring}
                  >
                    View Expiring
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {onDismiss && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8 p-0",
                      isUrgent 
                        ? "text-red-500 hover:text-red-700 hover:bg-red-100"
                        : "text-yellow-500 hover:text-yellow-700 hover:bg-yellow-100"
                    )}
                    onClick={onDismiss}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
});

// ============================================================================
// HIGH RISK CONTRACTS BANNER
// ============================================================================

interface HighRiskBannerProps {
  count: number;
  onDismiss?: () => void;
  onViewHighRisk?: () => void;
  isDismissed?: boolean;
}

export const HighRiskBanner = memo(function HighRiskBanner({
  count,
  onDismiss,
  onViewHighRisk,
  isDismissed = false,
}: HighRiskBannerProps) {
  if (count === 0 || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div key="ContractBanners-ap-3"
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="bg-gradient-to-r from-red-50 to-rose-50 border-red-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Shield className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-red-900">
                    {count} high-risk contract{count !== 1 ? 's' : ''} detected
                  </p>
                  <p className="text-sm text-red-700">
                    Review these contracts for potential issues and risks
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onViewHighRisk && (
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white border-0 shadow-lg shadow-red-500/25"
                    onClick={onViewHighRisk}
                  >
                    Review Risks
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {onDismiss && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                    onClick={onDismiss}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
});

// ============================================================================
// SUCCESS BANNER
// ============================================================================

interface SuccessBannerProps {
  message: string;
  description?: string;
  onDismiss?: () => void;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const SuccessBanner = memo(function SuccessBanner({
  message,
  description,
  onDismiss,
  autoHide = true,
  autoHideDelay = 5000,
}: SuccessBannerProps) {
  return (
    <AnimatePresence>
      <motion.div key="ContractBanners-ap-4"
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-medium text-violet-900">{message}</p>
                  {description && (
                    <p className="text-sm text-violet-700">{description}</p>
                  )}
                </div>
              </div>
              {onDismiss && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-violet-500 hover:text-violet-700 hover:bg-violet-100"
                  onClick={onDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
});

// ============================================================================
// NOTIFICATION STACK
// ============================================================================

interface Notification {
  id: string;
  type: 'uncategorized' | 'expiring' | 'high-risk' | 'success' | 'info';
  message: string;
  count?: number;
  urgentCount?: number;
  description?: string;
}

interface NotificationStackProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onAction?: (id: string, action: string) => void;
}

export const NotificationStack = memo(function NotificationStack({
  notifications,
  onDismiss,
  onAction,
}: NotificationStackProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((notification) => {
        switch (notification.type) {
          case 'uncategorized':
            return (
              <UncategorizedBanner
                key={notification.id}
                count={notification.count || 0}
                onDismiss={() => onDismiss(notification.id)}
                onViewUncategorized={() => onAction?.(notification.id, 'view')}
                onCategorizeAll={() => onAction?.(notification.id, 'categorize')}
              />
            );
          case 'expiring':
            return (
              <ExpiringBanner
                key={notification.id}
                count={notification.count || 0}
                urgentCount={notification.urgentCount}
                onDismiss={() => onDismiss(notification.id)}
                onViewExpiring={() => onAction?.(notification.id, 'view')}
              />
            );
          case 'high-risk':
            return (
              <HighRiskBanner
                key={notification.id}
                count={notification.count || 0}
                onDismiss={() => onDismiss(notification.id)}
                onViewHighRisk={() => onAction?.(notification.id, 'view')}
              />
            );
          case 'success':
            return (
              <SuccessBanner
                key={notification.id}
                message={notification.message}
                description={notification.description}
                onDismiss={() => onDismiss(notification.id)}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
});
