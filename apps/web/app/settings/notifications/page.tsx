"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageBreadcrumb } from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/toggle";
import { toast } from "sonner";
import {
  Bell,
  ArrowLeft,
  Save,
  Loader2,
  Mail,
  Shield,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Upload,
  Share2,
  Users,
} from "lucide-react";

interface ChannelPreference {
  enabled: boolean;
  channels: string[];
  quietHours?: { start: string; end: string };
  batchDigest?: boolean;
}

interface NotificationPreferences {
  channels: Record<string, ChannelPreference>;
  globalQuietHours: { start: string; end: string; timezone: string } | null;
  emailDigestFrequency: "instant" | "hourly" | "daily" | "weekly";
}

const EVENT_CATEGORIES = [
  {
    label: "Contracts",
    icon: FileText,
    events: [
      { key: "contract_uploaded", label: "Contract Uploaded", icon: Upload },
      { key: "contract_shared", label: "Contract Shared", icon: Share2 },
      { key: "contract_expiring", label: "Expiring Soon", icon: Clock },
      { key: "contract_expired", label: "Expired", icon: AlertTriangle },
      { key: "contract_approved", label: "Approved", icon: CheckCircle },
      { key: "contract_rejected", label: "Rejected", icon: AlertTriangle },
    ],
  },
  {
    label: "Collaboration",
    icon: Users,
    events: [
      { key: "comment_added", label: "New Comment", icon: MessageSquare },
      { key: "mention", label: "Mentioned", icon: Users },
      { key: "task_assigned", label: "Task Assigned", icon: FileText },
      { key: "task_completed", label: "Task Completed", icon: CheckCircle },
      { key: "reminder", label: "Reminders", icon: Clock },
    ],
  },
  {
    label: "System",
    icon: Shield,
    events: [
      { key: "sync_completed", label: "Sync Completed", icon: CheckCircle },
      { key: "sync_failed", label: "Sync Failed", icon: AlertTriangle },
      { key: "system_update", label: "System Updates", icon: Bell },
      { key: "security_alert", label: "Security Alerts", icon: Shield },
    ],
  },
];

const DEFAULT_PREFERENCES: NotificationPreferences = {
  channels: {},
  globalQuietHours: null,
  emailDigestFrequency: "daily",
};

export default function NotificationsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res = await fetch("/api/notifications/preferences");
        if (res.ok) {
          const data = await res.json();
          setPreferences(data.data || data || DEFAULT_PREFERENCES);
        }
      } catch {
        toast.error("Failed to load notification preferences");
      } finally {
        setLoading(false);
      }
    }
    fetchPreferences();
  }, []);

  const getChannelPref = useCallback(
    (eventKey: string): ChannelPreference => {
      return (
        preferences.channels[eventKey] || {
          enabled: true,
          channels: ["in_app", "email"],
        }
      );
    },
    [preferences.channels]
  );

  const updateChannelPref = useCallback(
    (eventKey: string, updates: Partial<ChannelPreference>) => {
      setPreferences((prev) => ({
        ...prev,
        channels: {
          ...prev.channels,
          [eventKey]: {
            ...getChannelPref(eventKey),
            ...updates,
          },
        },
      }));
      setDirty(true);
    },
    [getChannelPref]
  );

  const toggleChannel = useCallback(
    (eventKey: string, channel: string) => {
      const pref = getChannelPref(eventKey);
      const channels = pref.channels.includes(channel)
        ? pref.channels.filter((c) => c !== channel)
        : [...pref.channels, channel];
      updateChannelPref(eventKey, { channels });
    },
    [getChannelPref, updateChannelPref]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (res.ok) {
        toast.success("Notification preferences saved");
        setDirty(false);
      } else {
        toast.error("Failed to save preferences");
      }
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <PageBreadcrumb
          items={[
            { label: "Settings", href: "/settings" },
            { label: "Notifications" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between mt-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Notification Settings
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure how you receive notifications
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-500">
                Loading preferences...
              </span>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Global Settings */}
            <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-violet-600" />
                  Email Digest
                </CardTitle>
                <CardDescription>
                  How often to receive email digest summaries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <select
                  value={preferences.emailDigestFrequency}
                  onChange={(e) => {
                    setPreferences((prev) => ({
                      ...prev,
                      emailDigestFrequency: e.target.value as NotificationPreferences["emailDigestFrequency"],
                    }));
                    setDirty(true);
                  }}
                  className="w-full max-w-xs px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500"
                >
                  <option value="instant">Instant</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </CardContent>
            </Card>

            {/* Event Categories */}
            {EVENT_CATEGORIES.map((category) => {
              const CategoryIcon = category.icon;
              return (
                <Card
                  key={category.label}
                  className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CategoryIcon className="w-5 h-5 text-violet-600" />
                      {category.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider px-1">
                        <span>Event</span>
                        <span className="text-center">App</span>
                        <span className="text-center">Email</span>
                        <span className="text-center">On/Off</span>
                      </div>

                      {category.events.map((event) => {
                        const pref = getChannelPref(event.key);
                        const EventIcon = event.icon;
                        return (
                          <div
                            key={event.key}
                            className="grid grid-cols-[1fr_60px_60px_60px] gap-2 items-center py-2 px-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          >
                            <div className="flex items-center gap-2">
                              <EventIcon className="w-4 h-4 text-slate-400" />
                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                {event.label}
                              </span>
                            </div>
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={pref.channels.includes("in_app")}
                                onChange={() =>
                                  toggleChannel(event.key, "in_app")
                                }
                                disabled={!pref.enabled}
                                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                              />
                            </div>
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={pref.channels.includes("email")}
                                onChange={() =>
                                  toggleChannel(event.key, "email")
                                }
                                disabled={!pref.enabled}
                                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                              />
                            </div>
                            <div className="flex justify-center">
                              <Toggle
                                checked={pref.enabled}
                                onChange={(checked) =>
                                  updateChannelPref(event.key, {
                                    enabled: checked,
                                  })
                                }
                                size="sm"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
