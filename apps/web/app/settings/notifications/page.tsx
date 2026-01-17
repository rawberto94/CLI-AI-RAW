/**
 * Notification Settings Page
 * Configure notification preferences and channels
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageBreadcrumb } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Bell,
  Mail,
  Smartphone,
  Monitor,
  Calendar,
  AlertTriangle,
  DollarSign,
  Clock,
  FileText,
  Shield,
  Save,
  CheckCircle2,
  Volume2,
  VolumeX,
  MessageSquare,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Notification category type
interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

// Category metadata (icons, colors, descriptions)
const CATEGORY_METADATA: Record<string, { name: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  renewals: {
    name: "Contract Renewals",
    description: "Notifications about upcoming contract expirations and renewals",
    icon: Calendar,
    color: "text-orange-500",
  },
  risks: {
    name: "Risk Alerts",
    description: "Alerts about high-risk clauses and compliance issues",
    icon: AlertTriangle,
    color: "text-red-500",
  },
  savings: {
    name: "Savings Opportunities",
    description: "Notifications about potential cost savings and optimizations",
    icon: DollarSign,
    color: "text-green-500",
  },
  deadlines: {
    name: "Payment Deadlines",
    description: "Reminders about upcoming payment due dates",
    icon: Clock,
    color: "text-blue-500",
  },
  contracts: {
    name: "Contract Updates",
    description: "Updates about new contracts, amendments, and status changes",
    icon: FileText,
    color: "text-purple-500",
  },
  security: {
    name: "Security Alerts",
    description: "Important security notifications and login alerts",
    icon: Shield,
    color: "text-slate-500",
  },
  ai: {
    name: "AI Insights",
    description: "AI-generated insights and recommendations",
    icon: MessageSquare,
    color: "text-pink-500",
  },
  expirations: {
    name: "Expirations",
    description: "Notifications about expiring contracts and documents",
    icon: Calendar,
    color: "text-amber-500",
  },
  approvals: {
    name: "Approval Requests",
    description: "Notifications about pending approvals and reviews",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
  mentions: {
    name: "Mentions",
    description: "Notifications when you are mentioned in comments",
    icon: MessageSquare,
    color: "text-cyan-500",
  },
  updates: {
    name: "General Updates",
    description: "General system updates and announcements",
    icon: Bell,
    color: "text-indigo-500",
  },
};

// Preferences API response type
interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  digest: 'none' | 'daily' | 'weekly';
  categories: Record<string, boolean>;
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
  advanceNotice?: number;
  soundEnabled?: boolean;
}

// Custom hook to fetch and update notification preferences
function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/user/preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      const data = await response.json();
      setPreferences(data.preferences?.notifications || {
        email: true,
        push: true,
        inApp: true,
        digest: 'daily',
        categories: {},
        quietHours: { enabled: false, start: '22:00', end: '08:00' },
        advanceNotice: 30,
        soundEnabled: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, []);

  const savePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    setSaving(true);
    setError(null);
    try {
      const newPreferences = { ...preferences, ...updates };
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: newPreferences }),
      });
      if (!response.ok) throw new Error('Failed to save preferences');
      setPreferences(newPreferences);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return { preferences, loading, error, saving, saveSuccess, savePreferences, refresh: fetchPreferences };
}

// Build categories from preferences
function buildCategories(preferences: NotificationPreferences | null): NotificationCategory[] {
  const categoryIds = Object.keys(CATEGORY_METADATA);
  return categoryIds.map(id => {
    const meta = CATEGORY_METADATA[id];
    const catEnabled = preferences?.categories?.[id] ?? true;
    return {
      id,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      color: meta.color,
      email: catEnabled && (preferences?.email ?? true),
      push: catEnabled && (preferences?.push ?? true),
      inApp: catEnabled && (preferences?.inApp ?? true),
    };
  });
}

export default function NotificationSettingsPage() {
  const { preferences, loading, error, saving, saveSuccess, savePreferences, refresh } = useNotificationPreferences();
  
  // Local state for form editing
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);
  
  // Sync local state when preferences load
  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  const handleSave = async () => {
    if (localPrefs) {
      await savePreferences(localPrefs);
    }
  };

  const updateLocalPref = <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
    setLocalPrefs(prev => prev ? { ...prev, [key]: value } : null);
  };

  const toggleCategory = (categoryId: string, enabled: boolean) => {
    setLocalPrefs(prev => {
      if (!prev) return null;
      return {
        ...prev,
        categories: {
          ...prev.categories,
          [categoryId]: enabled,
        },
      };
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <PageBreadcrumb />
        </div>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !preferences) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <PageBreadcrumb />
        </div>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <div>
                  <h3 className="font-semibold text-lg">Failed to load preferences</h3>
                  <p className="text-muted-foreground">{error}</p>
                </div>
                <Button onClick={refresh} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const categories = buildCategories(localPrefs);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Breadcrumb */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <PageBreadcrumb />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">Notification Settings</h1>
                  <p className="text-xs text-muted-foreground">
                    Configure how you receive notifications
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  Saved!
                </>
              ) : error ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
                  Save Changes
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Global Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Channels</CardTitle>
            <CardDescription>
              Enable or disable notification channels globally.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">Email</p>
                    <p className="text-xs text-muted-foreground">Receive email notifications</p>
                  </div>
                </div>
                <Switch
                  checked={localPrefs?.email ?? true}
                  onCheckedChange={(checked) => updateLocalPref('email', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">Push</p>
                    <p className="text-xs text-muted-foreground">Mobile push notifications</p>
                  </div>
                </div>
                <Switch
                  checked={localPrefs?.push ?? true}
                  onCheckedChange={(checked) => updateLocalPref('push', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="font-medium text-sm">In-App</p>
                    <p className="text-xs text-muted-foreground">Desktop notifications</p>
                  </div>
                </div>
                <Switch
                  checked={localPrefs?.inApp ?? true}
                  onCheckedChange={(checked) => updateLocalPref('inApp', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Categories</CardTitle>
            <CardDescription>
              Fine-tune notifications for each category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[1fr,100px] gap-2 py-2 px-3 text-xs font-medium text-muted-foreground border-b">
                <span>Category</span>
                <span className="text-center">Enabled</span>
              </div>

              {/* Categories */}
              {categories.map((category) => {
                const Icon = category.icon;
                const isEnabled = localPrefs?.categories?.[category.id] ?? true;
                return (
                  <div
                    key={category.id}
                    className="grid grid-cols-[1fr,100px] gap-2 items-center py-3 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("h-5 w-5", category.color)} />
                      <div>
                        <p className="font-medium text-sm">{category.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => toggleCategory(category.id, checked)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Timing & Frequency */}
        <Card>
          <CardHeader>
            <CardTitle>Timing & Frequency</CardTitle>
            <CardDescription>
              Control when and how often you receive notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quiet Hours */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Quiet Hours</p>
                  <p className="text-xs text-muted-foreground">
                    Pause non-urgent notifications during specified hours
                  </p>
                </div>
                <Switch
                  checked={localPrefs?.quietHours?.enabled ?? false}
                  onCheckedChange={(checked) => updateLocalPref('quietHours', {
                    ...localPrefs?.quietHours,
                    enabled: checked,
                    start: localPrefs?.quietHours?.start || '22:00',
                    end: localPrefs?.quietHours?.end || '08:00',
                  })}
                />
              </div>

              {localPrefs?.quietHours?.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700"
                >
                  <div className="space-y-2">
                    <Label htmlFor="quiet-start">Start Time</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={localPrefs?.quietHours?.start || '22:00'}
                      onChange={(e) => updateLocalPref('quietHours', {
                        ...localPrefs?.quietHours,
                        enabled: true,
                        start: e.target.value,
                        end: localPrefs?.quietHours?.end || '08:00',
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet-end">End Time</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={localPrefs?.quietHours?.end || '08:00'}
                      onChange={(e) => updateLocalPref('quietHours', {
                        ...localPrefs?.quietHours,
                        enabled: true,
                        start: localPrefs?.quietHours?.start || '22:00',
                        end: e.target.value,
                      })}
                    />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Email Digest */}
            <div className="space-y-3">
              <div>
                <p className="font-medium text-sm">Email Digest</p>
                <p className="text-xs text-muted-foreground">
                  Receive a summary of notifications instead of individual emails
                </p>
              </div>
              <Select 
                value={localPrefs?.digest || 'daily'} 
                onValueChange={(value: 'none' | 'daily' | 'weekly') => updateLocalPref('digest', value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Real-time (no digest)</SelectItem>
                  <SelectItem value="daily">Daily digest</SelectItem>
                  <SelectItem value="weekly">Weekly digest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Advance Notice */}
            <div className="space-y-3">
              <div>
                <p className="font-medium text-sm">Renewal Advance Notice</p>
                <p className="text-xs text-muted-foreground">
                  How many days before expiration to receive renewal reminders
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Slider
                  value={[localPrefs?.advanceNotice ?? 30]}
                  onValueChange={(value) => updateLocalPref('advanceNotice', value[0])}
                  min={7}
                  max={90}
                  step={1}
                  className="flex-1"
                />
                <Badge variant="secondary" className="w-20 justify-center">
                  {localPrefs?.advanceNotice ?? 30} days
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sound Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Sound Settings</CardTitle>
            <CardDescription>
              Configure notification sounds and alerts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(localPrefs?.soundEnabled ?? true) ? (
                  <Volume2 className="h-5 w-5 text-blue-500" />
                ) : (
                  <VolumeX className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-sm">Notification Sounds</p>
                  <p className="text-xs text-muted-foreground">
                    Play sounds for in-app notifications
                  </p>
                </div>
              </div>
              <Switch
                checked={localPrefs?.soundEnabled ?? true}
                onCheckedChange={(checked) => updateLocalPref('soundEnabled', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
