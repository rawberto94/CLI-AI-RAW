/**
 * Notification Preferences Settings Page
 * 
 * Allows users to configure their notification preferences including:
 * - Channel preferences per notification type
 * - Quiet hours
 * - Email digest frequency
 * - Push notification management
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Users,
  Clock,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Share2,
  Calendar,
  CheckSquare,
  AlertCircle,
  RefreshCw,
  Shield,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

interface NotificationChannel {
  enabled: boolean;
  channels: ("in_app" | "email" | "push" | "slack" | "teams")[];
  quietHours?: { start: string; end: string };
  batchDigest?: boolean;
}

interface NotificationPreferences {
  channels: Record<string, NotificationChannel>;
  globalQuietHours?: { start: string; end: string; timezone: string } | null;
  emailDigestFrequency?: "instant" | "hourly" | "daily" | "weekly";
}

interface PushConfig {
  enabled: boolean;
  vapidPublicKey?: string;
  hasSubscription?: boolean;
}

const NOTIFICATION_TYPES = [
  { key: "contract_uploaded", label: "Contract Uploaded", icon: FileText, category: "Contracts" },
  { key: "contract_shared", label: "Contract Shared", icon: Share2, category: "Contracts" },
  { key: "contract_expiring", label: "Contract Expiring", icon: Calendar, category: "Contracts" },
  { key: "contract_expired", label: "Contract Expired", icon: AlertCircle, category: "Contracts" },
  { key: "contract_approved", label: "Contract Approved", icon: CheckCircle2, category: "Workflow" },
  { key: "contract_rejected", label: "Contract Rejected", icon: AlertTriangle, category: "Workflow" },
  { key: "comment_added", label: "Comment Added", icon: MessageSquare, category: "Collaboration" },
  { key: "mention", label: "@Mention", icon: Users, category: "Collaboration" },
  { key: "task_assigned", label: "Task Assigned", icon: CheckSquare, category: "Tasks" },
  { key: "task_completed", label: "Task Completed", icon: CheckCircle2, category: "Tasks" },
  { key: "reminder", label: "Reminder", icon: Bell, category: "Tasks" },
  { key: "sync_completed", label: "Sync Completed", icon: RefreshCw, category: "Integrations" },
  { key: "sync_failed", label: "Sync Failed", icon: AlertTriangle, category: "Integrations" },
  { key: "system_update", label: "System Update", icon: Settings, category: "System" },
  { key: "security_alert", label: "Security Alert", icon: Shield, category: "Security" },
];

const CHANNELS = [
  { key: "in_app" as const, label: "In-App", icon: Bell },
  { key: "email" as const, label: "Email", icon: Mail },
  { key: "push" as const, label: "Push", icon: Smartphone },
  { key: "slack" as const, label: "Slack", icon: MessageSquare },
  { key: "teams" as const, label: "Teams", icon: Users },
];

const CATEGORIES = ["Contracts", "Workflow", "Collaboration", "Tasks", "Integrations", "System", "Security"];

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [pushConfig, setPushConfig] = useState<PushConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      const [prefsRes, pushRes] = await Promise.all([
        fetch("/api/notifications/preferences"),
        fetch("/api/notifications/push-subscription"),
      ]);

      const prefsData = await prefsRes.json();
      const pushData = await pushRes.json();

      if (prefsData.success) {
        setPreferences(prefsData.data);
      }
      if (pushData.success) {
        setPushConfig(pushData.data);
      }
    } catch (error) {
      toast.error("Failed to load notification preferences");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const handleChannelToggle = (typeKey: string, channel: string) => {
    if (!preferences) return;

    const typePrefs = preferences.channels[typeKey] || {
      enabled: true,
      channels: ["in_app"],
    };

    const newChannels = typePrefs.channels.includes(channel as any)
      ? typePrefs.channels.filter((c) => c !== channel)
      : [...typePrefs.channels, channel as any];

    setPreferences({
      ...preferences,
      channels: {
        ...preferences.channels,
        [typeKey]: {
          ...typePrefs,
          channels: newChannels,
        },
      },
    });
    setHasChanges(true);
  };

  const handleTypeToggle = (typeKey: string) => {
    if (!preferences) return;

    const typePrefs = preferences.channels[typeKey] || {
      enabled: true,
      channels: ["in_app"],
    };

    setPreferences({
      ...preferences,
      channels: {
        ...preferences.channels,
        [typeKey]: {
          ...typePrefs,
          enabled: !typePrefs.enabled,
        },
      },
    });
    setHasChanges(true);
  };

  const handleQuietHoursToggle = () => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      globalQuietHours: preferences.globalQuietHours
        ? null
        : { start: "22:00", end: "08:00", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    setHasChanges(true);
  };

  const handleQuietHoursChange = (field: "start" | "end", value: string) => {
    if (!preferences?.globalQuietHours) return;

    setPreferences({
      ...preferences,
      globalQuietHours: {
        ...preferences.globalQuietHours,
        [field]: value,
      },
    });
    setHasChanges(true);
  };

  const handleDigestFrequencyChange = (value: string) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      emailDigestFrequency: value as any,
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Preferences saved successfully");
        setHasChanges(false);
      } else {
        toast.error(data.error || "Failed to save preferences");
      }
    } catch (error) {
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnablePush = async () => {
    if (!pushConfig?.vapidPublicKey) {
      toast.error("Push notifications are not configured on this server");
      return;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      // Register service worker and get subscription
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushConfig.vapidPublicKey,
      });

      // Send subscription to server
      const res = await fetch("/api/notifications/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      const data = await res.json();
      if (data.success) {
        setPushConfig({ ...pushConfig, hasSubscription: true });
        toast.success("Push notifications enabled");
      } else {
        toast.error(data.error || "Failed to enable push notifications");
      }
    } catch (error) {
      console.error("Push subscription error:", error);
      toast.error("Failed to enable push notifications");
    }
  };

  const handleDisablePush = async () => {
    try {
      const res = await fetch("/api/notifications/push-subscription", {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        setPushConfig(pushConfig ? { ...pushConfig, hasSubscription: false } : null);
        toast.success("Push notifications disabled");
      } else {
        toast.error(data.error || "Failed to disable push notifications");
      }
    } catch (error) {
      toast.error("Failed to disable push notifications");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification Preferences</h1>
          <p className="text-slate-500 mt-1">
            Configure how and when you receive notifications
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications on your device even when the app is closed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pushConfig?.enabled ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {pushConfig.hasSubscription
                    ? "Push notifications are enabled"
                    : "Push notifications are available"}
                </p>
                <p className="text-sm text-slate-500">
                  {pushConfig.hasSubscription
                    ? "You will receive push notifications on this device"
                    : "Click enable to start receiving push notifications"}
                </p>
              </div>
              {pushConfig.hasSubscription ? (
                <Button variant="outline" onClick={handleDisablePush}>
                  Disable
                </Button>
              ) : (
                <Button onClick={handleEnablePush}>Enable</Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-slate-500">
              <AlertTriangle className="w-5 h-5" />
              <span>Push notifications are not configured on this server</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Pause non-urgent notifications during specific hours
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
              <p className="text-sm text-slate-500">
                Notifications will be batched and sent after quiet hours
              </p>
            </div>
            <Switch
              id="quiet-hours"
              checked={!!preferences?.globalQuietHours}
              onCheckedChange={handleQuietHoursToggle}
            />
          </div>

          {preferences?.globalQuietHours && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label htmlFor="quiet-start">Start Time</Label>
                <input
                  type="time"
                  id="quiet-start"
                  value={preferences.globalQuietHours.start}
                  onChange={(e) => handleQuietHoursChange("start", e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label htmlFor="quiet-end">End Time</Label>
                <input
                  type="time"
                  id="quiet-end"
                  value={preferences.globalQuietHours.end}
                  onChange={(e) => handleQuietHoursChange("end", e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Digest */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Digest
          </CardTitle>
          <CardDescription>
            Choose how often you receive email notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={preferences?.emailDigestFrequency || "instant"}
            onValueChange={handleDigestFrequencyChange}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">Instant (as they happen)</SelectItem>
              <SelectItem value="hourly">Hourly Digest</SelectItem>
              <SelectItem value="daily">Daily Digest</SelectItem>
              <SelectItem value="weekly">Weekly Digest</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Notification Types by Category */}
      {CATEGORIES.map((category) => {
        const types = NOTIFICATION_TYPES.filter((t) => t.category === category);
        if (types.length === 0) return null;

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {types.map((type) => {
                const TypeIcon = type.icon;
                const typePrefs = preferences?.channels?.[type.key] || {
                  enabled: true,
                  channels: ["in_app"],
                };

                return (
                  <div
                    key={type.key}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <TypeIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {typePrefs.enabled ? (
                            typePrefs.channels.map((channel) => (
                              <Badge key={channel} variant="secondary" className="text-xs">
                                {channel.replace("_", "-")}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {CHANNELS.map((channel) => {
                        const ChannelIcon = channel.icon;
                        const isActive = typePrefs.channels.includes(channel.key);
                        const isDisabled = !typePrefs.enabled;

                        return (
                          <button
                            key={channel.key}
                            onClick={() => handleChannelToggle(type.key, channel.key)}
                            disabled={isDisabled}
                            className={`p-2 rounded-lg transition-colors ${
                              isActive && !isDisabled
                                ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                            } ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-50"}`}
                            title={channel.label}
                          >
                            <ChannelIcon className="w-4 h-4" />
                          </button>
                        );
                      })}

                      <Switch
                        checked={typePrefs.enabled}
                        onCheckedChange={() => handleTypeToggle(type.key)}
                        className="ml-4"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
