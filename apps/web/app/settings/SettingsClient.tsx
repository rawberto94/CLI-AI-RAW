"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageBreadcrumb } from '@/components/navigation';
import { unwrapApiResponseData } from '@/lib/api-fetch';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Toggle } from "@/components/toggle";
import { Alert } from "@/components/alert";
import {
  Settings,
  User,
  Shield,
  Bell,
  Zap,
  Globe,
  Key,
  Mail,
  Smartphone,
  FileText,
  Users,
  BarChart3,
  Lock,
  Save,
  RefreshCw,
  Tag,
  FolderTree,
  HelpCircle,
  Play,
  FolderSync,
  Loader2,
} from "lucide-react";

// Default settings matching the API defaults
const DEFAULT_SETTINGS = {
  system: {
    timezone: 'America/New_York',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    theme: 'system',
  },
  notifications: {
    emailEnabled: true,
    pushEnabled: true,
    contractAlerts: true,
    renewalReminders: true,
    complianceAlerts: true,
    weeklyDigest: true,
  },
  security: {
    sessionTimeout: 8,
    requireMFA: false,
    passwordMinLength: 8,
  },
  display: {
    defaultDashboard: 'overview',
    contractsPerPage: 25,
    showWelcomeScreen: true,
    compactMode: false,
  },
};

interface UserInfo {
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}

interface OutboundOverview {
  webhooks: {
    total: number;
    active: number;
  };
  deliveries: {
    pending: number;
    success: number;
    failed: number;
    dead: number;
  };
  apiTokens: {
    active: number;
    requestsLast24h: number;
  };
  events: {
    last24h: number;
    lastAt: string | null;
  };
  recentIssues: Array<{
    id: string;
    webhookId: string;
    webhookName: string;
    event: string;
    status: string;
    error: string | null;
    statusCode: number | null;
    lastAttemptAt: string | null;
    dispatchId: string | null;
  }>;
}

export default function SettingsClient() {
  const [activeTab, setActiveTab] = React.useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [requeueingIssueId, setRequeueingIssueId] = useState<string | null>(null);
  const [bulkRequeueingIssues, setBulkRequeueingIssues] = useState(false);
  
  // Real settings state fetched from API
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [outboundOverview, setOutboundOverview] = useState<OutboundOverview | null>(null);
  const [systemSettings, setSystemSettings] = useState(DEFAULT_SETTINGS.system);
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_SETTINGS.notifications);
  const [securitySettings, setSecuritySettings] = useState(DEFAULT_SETTINGS.security);
  const [displaySettings, setDisplaySettings] = useState(DEFAULT_SETTINGS.display);
  const [processingSettings, setProcessingSettings] = useState({
    autoProcessing: true,
    aiAnalysis: true,
    riskAssessment: true,
    ocrEnabled: true,
    retentionPeriod: '7',
    backupFrequency: 'daily',
  });
  const canManageTenantSettings = ['admin', 'owner'].includes(userInfo?.role?.toLowerCase() ?? '');

  const loadOutboundOverview = useCallback(async () => {
    try {
      const outboundRes = await fetch('/api/admin/outbound-overview').catch(() => null);
      if (outboundRes?.ok) {
        const outboundJson = await outboundRes.json();
        setOutboundOverview((outboundJson as { data?: OutboundOverview }).data ?? null);
      }
    } catch {
      // Non-fatal on the settings landing page.
    }
  }, []);

  // Fetch settings from API on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const [settingsRes, outboundRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/admin/outbound-overview').catch(() => null),
        ]);
        if (settingsRes.ok) {
          const data = unwrapApiResponseData<{ settings?: typeof DEFAULT_SETTINGS & { processing?: Record<string, unknown> }; user?: UserInfo | null }>(await settingsRes.json());
          const settings = data.settings || DEFAULT_SETTINGS;
          const user = data.user;
          if (user) setUserInfo(user);
          if (settings.system) setSystemSettings(s => ({ ...s, ...settings.system }));
          if (settings.notifications) setNotificationSettings(s => ({ ...s, ...settings.notifications }));
          if (settings.security) setSecuritySettings(s => ({ ...s, ...settings.security }));
          if (settings.display) setDisplaySettings(s => ({ ...s, ...settings.display }));
          if (settings.processing) setProcessingSettings(s => ({ ...s, ...settings.processing }));
        }
        if (outboundRes?.ok) {
          const outboundJson = await outboundRes.json();
          setOutboundOverview((outboundJson as { data?: OutboundOverview }).data ?? null);
        }
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const requeueIssue = useCallback(async (issueId: string) => {
    if (!confirm('Requeue this delivery now? It will be retried on the next cron tick.')) return;
    setRequeueingIssueId(issueId);
    try {
      const res = await fetch(`/api/admin/webhook-deliveries/${issueId}/requeue`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((json as { error?: string }).error || 'Requeue failed');
        return;
      }
      toast.success('Delivery requeued');
      await loadOutboundOverview();
    } catch {
      toast.error('Requeue failed');
    } finally {
      setRequeueingIssueId(null);
    }
  }, [loadOutboundOverview]);

  const requeueDeadIssues = useCallback(async () => {
    if (!confirm('Requeue all dead deliveries now? They will be retried on the next cron tick.')) return;
    setBulkRequeueingIssues(true);
    try {
      const res = await fetch('/api/admin/webhook-deliveries/requeue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((json as { error?: string }).error || 'Bulk requeue failed');
        return;
      }
      const requeued = typeof (json as { requeued?: unknown }).requeued === 'number'
        ? (json as { requeued: number }).requeued
        : 0;
      toast.success(
        requeued > 0
          ? `Requeued ${requeued} dead ${requeued === 1 ? 'delivery' : 'deliveries'}`
          : 'No dead deliveries to requeue',
      );
      await loadOutboundOverview();
    } catch {
      toast.error('Bulk requeue failed');
    } finally {
      setBulkRequeueingIssues(false);
    }
  }, [loadOutboundOverview]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Mark dirty when any setting changes
  const updateSystem = useCallback((updates: Partial<typeof DEFAULT_SETTINGS.system>) => {
    setSystemSettings(prev => ({ ...prev, ...updates }));
    setDirty(true);
  }, []);

  const updateNotifications = useCallback((updates: Partial<typeof DEFAULT_SETTINGS.notifications>) => {
    setNotificationSettings(prev => ({ ...prev, ...updates }));
    setDirty(true);
  }, []);

  const updateSecurity = useCallback((updates: Partial<typeof DEFAULT_SETTINGS.security>) => {
    setSecuritySettings(prev => ({ ...prev, ...updates }));
    setDirty(true);
  }, []);

  const updateDisplay = useCallback((updates: Partial<typeof DEFAULT_SETTINGS.display>) => {
    setDisplaySettings(prev => ({ ...prev, ...updates }));
    setDirty(true);
  }, []);

  const updateProcessing = useCallback((updates: Record<string, boolean | string>) => {
    setProcessingSettings(prev => ({ ...prev, ...updates }));
    setDirty(true);
  }, []);

  // Save settings per-section to the real API
  const handleSaveChanges = useCallback(async () => {
    setSaving(true);
    try {
      const sections = [
        { section: 'system', updates: systemSettings },
        { section: 'notifications', updates: notificationSettings },
        { section: 'display', updates: displaySettings },
        ...(canManageTenantSettings
          ? [
              { section: 'security', updates: securitySettings },
              { section: 'processing', updates: processingSettings },
            ]
          : []),
      ];

      const results = await Promise.all(
        sections.map(({ section, updates }) =>
          fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section, updates }),
          })
        )
      );

      if (results.every(r => r.ok)) {
        toast.success('Settings saved successfully');
        setDirty(false);
      } else {
        const failedSections = sections
          .filter((_, i) => !results[i].ok)
          .map(s => s.section);
        toast.error(`Failed to save: ${failedSections.join(', ')}`);
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [canManageTenantSettings, systemSettings, notificationSettings, securitySettings, displaySettings, processingSettings]);

  // Reset to defaults
  const handleResetDefaults = useCallback(() => {
    setSystemSettings(DEFAULT_SETTINGS.system);
    setNotificationSettings(DEFAULT_SETTINGS.notifications);
    setSecuritySettings(DEFAULT_SETTINGS.security);
    setDisplaySettings(DEFAULT_SETTINGS.display);
    setDirty(true);
    toast.info('Settings reset to defaults. Click Save to apply.');
  }, []);

  const tabs = [
    { id: "general", name: "General", icon: <Settings className="w-4 h-4" /> },
    { id: "security", name: "Security", icon: <Shield className="w-4 h-4" /> },
    {
      id: "notifications",
      name: "Notifications",
      icon: <Bell className="w-4 h-4" />,
    },
    { id: "processing", name: "Processing", icon: <Zap className="w-4 h-4" /> },
    {
      id: "integrations",
      name: "Integrations",
      icon: <Globe className="w-4 h-4" />,
    },
    {
      id: "contract-sources",
      name: "Contract Sources",
      icon: <FolderSync className="w-4 h-4" />,
      href: "/settings/contract-sources",
    },
    {
      id: "metadata",
      name: "Metadata Schema",
      icon: <FileText className="w-4 h-4" />,
      href: "/settings/metadata",
    },
    {
      id: "tags",
      name: "Tags",
      icon: <Tag className="w-4 h-4" />,
      href: "/settings/tags",
    },
    {
      id: "taxonomy",
      name: "Taxonomy",
      icon: <FolderTree className="w-4 h-4" />,
      href: "/settings/taxonomy",
    },
  ];

  const outboundCardBadges = outboundOverview
    ? {
        'webhook-config': [
          { label: `${outboundOverview.webhooks.active} active`, variant: 'outline' as const },
          { label: `${outboundOverview.webhooks.total} total`, variant: 'secondary' as const },
        ],
        'webhook-deliveries': [
          ...(outboundOverview.deliveries.dead > 0
            ? [{ label: `${outboundOverview.deliveries.dead} dead-letter`, variant: 'destructive' as const }]
            : []),
          { label: `${outboundOverview.deliveries.pending} retrying`, variant: 'outline' as const },
        ],
        'integration-events': [
          { label: `${outboundOverview.events.last24h} in 24h`, variant: 'outline' as const },
          ...(outboundOverview.events.lastAt
            ? [{ label: 'live stream active', variant: 'secondary' as const }]
            : []),
        ],
        'api-tokens': [
          { label: `${outboundOverview.apiTokens.active} active`, variant: 'outline' as const },
          { label: `${outboundOverview.apiTokens.requestsLast24h} req / 24h`, variant: 'secondary' as const },
        ],
      }
    : null;

  const deliveryOverviewHref = outboundOverview
    ? outboundOverview.deliveries.dead > 0
      ? '/settings/webhook-deliveries?status=dead'
      : outboundOverview.deliveries.pending > 0
        ? '/settings/webhook-deliveries?status=pending'
        : '/settings/webhook-deliveries'
    : '/settings/webhook-deliveries';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/50 to-gray-50/30 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900/30">
      <div className="p-6 space-y-6">
        <PageBreadcrumb />
        
        {/* Security Notice Banner */}
        <Alert 
          type="info" 
          title="Settings are synced across devices"
          dismissible
        >
          Changes you make here will be reflected on all devices where you&apos;re signed in. Some changes may require a page refresh to take effect.
        </Alert>
        
        {/* Header */}
        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4">
            <motion.div 
              className="p-4 rounded-2xl bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 text-white shadow-xl shadow-slate-500/30"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Settings className="w-8 h-8" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                System Settings
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Configure system parameters and preferences
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="motion-reduce:transform-none">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetDefaults}
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 shadow-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset to Defaults
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="motion-reduce:transform-none">
              <Button 
                onClick={handleSaveChanges}
                disabled={!dirty || saving}
                className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 shadow-lg shadow-slate-500/25 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}
              </Button>
            </motion.div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Settings Navigation */}
          <motion.div 
            className="lg:col-span-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
              <CardContent className="p-4">
                <nav className="space-y-2" aria-label="Settings navigation">
                  {tabs.map((tab, index) => {
                    // External link tabs (like Taxonomy)
                    if ('href' in tab && tab.href) {
                      return (
                        <motion.div
                          key={tab.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                          className="motion-reduce:transition-none"
                        >
                          <Link
                            href={tab.href}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/80"
                          >
                            {tab.icon}
                            {tab.name}
                            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">→</span>
                          </Link>
                        </motion.div>
                      );
                    }
                    
                    // Regular tab buttons
                    return (
                      <motion.button
                        key={tab.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all duration-200 motion-reduce:transition-none ${
                          activeTab === tab.id
                            ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg shadow-slate-500/25"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/80"
                        }`}
                        aria-current={activeTab === tab.id ? 'page' : undefined}
                      >
                        {tab.icon}
                        {tab.name}
                      </motion.button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </motion.div>

          {/* Settings Content */}
          <motion.div 
            className="lg:col-span-3 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
          {/* General Settings */}
          {activeTab === "general" && (
            <>
              {loading ? (
                <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
                  <CardContent className="p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    <span className="ml-2 text-slate-500">Loading settings...</span>
                  </CardContent>
                </Card>
              ) : (
              <>
              <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg shadow-lg shadow-violet-500/25">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    User Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Full Name
                      </label>
                      <input
                        id="fullName"
                        type="text"
                        value={userInfo?.name ?? ''}
                        disabled
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        <Link href="/settings/profile" className="text-violet-500 hover:underline">Edit in Profile Settings →</Link>
                      </p>
                    </div>
                    <div>
                      <label htmlFor="emailAddress" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Email Address
                      </label>
                      <input
                        id="emailAddress"
                        type="email"
                        value={userInfo?.email ?? ''}
                        disabled
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="userRole" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Role
                    </label>
                    <input
                      id="userRole"
                      type="text"
                      value={userInfo?.role ?? ''}
                      disabled
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-lg shadow-blue-500/25">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    System Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Timezone
                      </label>
                      <select
                        value={systemSettings.timezone}
                        onChange={(e) => updateSystem({ timezone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value="America/Los_Angeles">Pacific (PT)</option>
                        <option value="America/Denver">Mountain (MT)</option>
                        <option value="America/Chicago">Central (CT)</option>
                        <option value="America/New_York">Eastern (ET)</option>
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Europe/Zurich">Zurich (CET)</option>
                        <option value="Europe/Berlin">Berlin (CET)</option>
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Language
                      </label>
                      <select
                        value={systemSettings.language}
                        onChange={(e) => updateSystem({ language: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value="en">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="de">German</option>
                        <option value="fr">French</option>
                        <option value="es">Spanish</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Date Format
                      </label>
                      <select
                        value={systemSettings.dateFormat}
                        onChange={(e) => updateSystem({ dateFormat: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Currency
                      </label>
                      <select
                        value={systemSettings.currency}
                        onChange={(e) => updateSystem({ currency: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CHF">CHF (Fr)</option>
                        <option value="JPY">JPY (¥)</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Help & Support Card with Tour Links */}
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg shadow-lg shadow-violet-500/25">
                      <HelpCircle className="w-5 h-5 text-white" />
                    </div>
                    Help & Support
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
                    <div>
                      <h4 className="font-medium text-violet-900 dark:text-violet-200">App Tour & Learning Center</h4>
                      <p className="text-sm text-violet-700 dark:text-violet-400">
                        Interactive walkthrough and feature guides
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/tour">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white border-violet-300 text-violet-700 hover:bg-violet-100"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Open Tour
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          localStorage.removeItem('contigo_tour_progress');
                          localStorage.removeItem('contigo_tour_completed');
                          localStorage.removeItem('contigo-tutorial-completed');
                          localStorage.removeItem('contigo-welcome-banner-dismissed');
                          window.location.href = '/tour';
                        }}
                        className="text-violet-600 hover:text-violet-700 hover:bg-violet-100"
                      >
                        Restart
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>Need more help? Check out:</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside text-slate-500">
                      <li>Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">?</kbd> anytime to see keyboard shortcuts</li>
                      <li>Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">⌘K</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">Ctrl+K</kbd> to open the command palette</li>
                      <li>Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">/</kbd> to focus search</li>
                      <li>Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">⌘/</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">Ctrl+/</kbd> to open the AI Assistant</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
              </>
              )}
            </>
          )}

          {/* Security Settings */}
          {activeTab === "security" && (
            canManageTenantSettings ? (
              <>
                <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-red-500 to-rose-500 rounded-lg shadow-lg shadow-red-500/25">
                        <Lock className="w-5 h-5 text-white" />
                      </div>
                      Authentication & Security
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        <div>
                          <h4 className="font-medium text-slate-800 dark:text-slate-200">
                            Two-Factor Authentication
                          </h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {securitySettings.requireMFA ? 'Required for all users' : 'Optional'}
                          </p>
                        </div>
                      </div>
                      <Toggle
                        checked={securitySettings.requireMFA}
                        onChange={(checked) => updateSecurity({ requireMFA: checked })}
                        size="sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Session Timeout (hours)
                        </label>
                        <select
                          value={securitySettings.sessionTimeout}
                          onChange={(e) => updateSecurity({ sessionTimeout: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                          <option value={1}>1 hour</option>
                          <option value={4}>4 hours</option>
                          <option value={8}>8 hours</option>
                          <option value={24}>24 hours</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Min Password Length
                        </label>
                        <select
                          value={securitySettings.passwordMinLength}
                          onChange={(e) => updateSecurity({ passwordMinLength: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                          <option value={6}>6 characters</option>
                          <option value={8}>8 characters</option>
                          <option value={12}>12 characters</option>
                          <option value={16}>16 characters</option>
                        </select>
                      </div>
                    </div>

                    <Link href="/settings/profile">
                      <Button variant="outline">
                        <Key className="w-4 h-4 mr-2" />
                        Change Password
                      </Button>
                    </Link>

                    <Link href="/admin/security">
                      <Button variant="ghost">
                        <Shield className="w-4 h-4 mr-2" />
                        Advanced Security Policies
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg shadow-lg shadow-violet-500/25">
                        <Key className="w-5 h-5 text-white" />
                      </div>
                      API Access
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div>
                        <h4 className="font-medium text-slate-800 dark:text-slate-200">
                          API Tokens
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Programmatic access to the Contigo API will be available soon.
                        </p>
                      </div>
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
                <CardHeader>
                  <CardTitle>Admin Access Required</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Tenant-wide security policies are managed by organization admins from the admin security surface.
                  </p>
                </CardContent>
              </Card>
            )
          )}

          {/* Notifications Settings */}
          {activeTab === "notifications" && (
            <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-lg shadow-lg shadow-yellow-500/25">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-violet-600" />
                    Email Notifications
                  </h4>
                  <div className="space-y-3">
                    {([
                      ['contractAlerts', 'Contract Updates'],
                      ['renewalReminders', 'Renewal Reminders'],
                      ['complianceAlerts', 'Compliance Alerts'],
                      ['weeklyDigest', 'Weekly Digest'],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                        <Toggle
                          checked={notificationSettings[key] ?? false}
                          onChange={(checked) => updateNotifications({ [key]: checked })}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-green-600" />
                    Push Notifications
                  </h4>
                  <div className="space-y-3">
                    {([
                      ['emailEnabled', 'Email Notifications'],
                      ['pushEnabled', 'Push Notifications'],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                        <Toggle
                          checked={notificationSettings[key] ?? false}
                          onChange={(checked) => updateNotifications({ [key]: checked })}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  Granular notification controls are not exposed on a separate page yet. The toggles above are the supported settings.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Processing Settings */}
          {activeTab === "processing" && (
            canManageTenantSettings ? (
              <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg shadow-lg shadow-violet-500/25">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    Processing Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4">
                        Automated Processing
                      </h4>
                      <div className="space-y-3">
                        {([
                          ['autoProcessing', 'Auto-process uploads'],
                          ['aiAnalysis', 'AI Analysis'],
                          ['riskAssessment', 'Risk Assessment'],
                          ['ocrEnabled', 'OCR Processing'],
                        ] as const).map(([key, label]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                            <Toggle
                              checked={(processingSettings as unknown as Record<string, boolean>)[key] ?? true}
                              onChange={(checked) => updateProcessing({ [key]: checked })}
                              size="sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-4">
                        Data Management
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Retention Period
                          </label>
                          <select
                            value={(processingSettings as unknown as Record<string, string>).retentionPeriod ?? '7'}
                            onChange={(e) => updateProcessing({ retentionPeriod: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          >
                            <option value="1">1 year</option>
                            <option value="3">3 years</option>
                            <option value="7">7 years</option>
                            <option value="10">10 years</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Backup Frequency
                          </label>
                          <select
                            value={(processingSettings as unknown as Record<string, string>).backupFrequency ?? 'daily'}
                            onChange={(e) => updateProcessing({ backupFrequency: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
                <CardHeader>
                  <CardTitle>Admin Access Required</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Processing defaults affect the whole tenant and can only be changed by an organization admin.
                  </p>
                </CardContent>
              </Card>
            )
          )}

          {/* Integrations Settings */}
          {activeTab === "integrations" && (
            <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg shadow-lg shadow-emerald-500/25">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  Third-Party Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {outboundOverview && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Live Outbound Overview</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Current tenant health across webhook subscribers, delivery backlog, event volume, and token traffic.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                        <Link
                          href="/settings/webhooks"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900/50"
                        >
                          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Webhooks</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{outboundOverview.webhooks.active}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{outboundOverview.webhooks.total} total subscribers</div>
                          <div className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400">Open endpoints →</div>
                        </Link>
                        <Link
                          href={deliveryOverviewHref}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900/50"
                        >
                          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Retries / DLQ</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{outboundOverview.deliveries.pending}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{outboundOverview.deliveries.dead} dead-lettered</div>
                          <div className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400">
                            {outboundOverview.deliveries.dead > 0 ? 'Review DLQ →' : 'Open deliveries →'}
                          </div>
                        </Link>
                        <Link
                          href="/settings/integration-events"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900/50"
                        >
                          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Events 24h</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{outboundOverview.events.last24h}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Last event {outboundOverview.events.lastAt ? new Date(outboundOverview.events.lastAt).toLocaleString() : '—'}</div>
                          <div className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400">Open event log →</div>
                        </Link>
                        <Link
                          href="/settings/api-tokens"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-900/50"
                        >
                          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">API Tokens</div>
                          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{outboundOverview.apiTokens.active}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{outboundOverview.apiTokens.requestsLast24h} requests in 24h</div>
                          <div className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400">Open tokens →</div>
                        </Link>
                      </div>

                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Outbound Issues</h5>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Latest failed or dead-lettered deliveries across all webhook subscribers.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={requeueDeadIssues}
                              disabled={bulkRequeueingIssues || outboundOverview.deliveries.dead === 0}
                            >
                              {bulkRequeueingIssues ? 'Requeueing…' : 'Requeue Dead'}
                            </Button>
                            <Button asChild variant="outline" size="sm">
                              <Link href={deliveryOverviewHref}>Open deliveries</Link>
                            </Button>
                          </div>
                        </div>

                        {outboundOverview.recentIssues.length === 0 ? (
                          <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                            No recent failed or dead-lettered deliveries.
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {outboundOverview.recentIssues.map((issue) => {
                              const issueHref = issue.dispatchId
                                ? `/settings/webhook-deliveries?dispatchId=${encodeURIComponent(issue.dispatchId)}`
                                : `/settings/webhook-deliveries?webhookId=${encodeURIComponent(issue.webhookId)}&status=${encodeURIComponent(issue.status)}`;

                              return (
                                <div
                                  key={issue.id}
                                  className="flex flex-col gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/20 px-4 py-3 md:flex-row md:items-center md:justify-between"
                                >
                                  <div className="min-w-0 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant={issue.status === 'dead' ? 'destructive' : 'outline'}>
                                        {issue.status}
                                      </Badge>
                                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{issue.webhookName}</span>
                                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{issue.event}</span>
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                      {issue.error || `HTTP ${issue.statusCode ?? 'unknown error'}`}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      Last attempt {issue.lastAttemptAt ? new Date(issue.lastAttemptAt).toLocaleString() : '—'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button asChild variant="outline" size="sm">
                                      <Link href={issueHref}>Inspect</Link>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={requeueingIssueId === issue.id}
                                      onClick={() => requeueIssue(issue.id)}
                                    >
                                      {requeueingIssueId === issue.id ? 'Requeueing…' : 'Requeue'}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {([
                    { key: 'sharepoint', label: 'SharePoint', icon: FileText, description: 'Document management' },
                    { key: 'salesforce', label: 'Salesforce', icon: BarChart3, description: 'CRM integration' },
                    { key: 'slack', label: 'Slack', icon: Bell, description: 'Team notifications' },
                    { key: 'teams', label: 'Microsoft Teams', icon: Users, description: 'Collaboration' },
                  ] as const).map((integration) => {
                    const Icon = integration.icon;
                    return (
                      <div
                        key={integration.key}
                        className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700">
                            <Icon className="w-5 h-5 text-violet-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-900 dark:text-slate-100">
                              {integration.label}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {integration.description}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="opacity-60"
                        >
                          Coming Soon
                        </Button>
                      </div>
                    );
                  })}

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Outbound Integrations</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Manage webhook subscribers, delivery recovery, durable event replay, and API tokens.
                      </p>
                    </div>
                    {([
                    { key: 'webhook-config', label: 'Webhook Endpoints', icon: Globe, description: 'Manage subscribers and secrets', href: '/settings/webhooks', cta: 'Open' },
                    { key: 'webhook-deliveries', label: 'Webhook Deliveries', icon: RefreshCw, description: 'Inspect retries, DLQ, and requeue', href: '/settings/webhook-deliveries', cta: 'Open' },
                    { key: 'integration-events', label: 'Integration Events', icon: Play, description: 'Browse durable events and replay them', href: '/settings/integration-events', cta: 'Open' },
                    { key: 'api-tokens', label: 'API Tokens', icon: Key, description: 'Issue scoped tokens for /api/v1 access', href: '/settings/api-tokens', cta: 'Open' },
                  ] as const).map((integration) => {
                    const Icon = integration.icon;
                    return (
                      <div
                        key={integration.key}
                        className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-700">
                            <Icon className="w-5 h-5 text-violet-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-900 dark:text-slate-100">
                              {integration.label}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {integration.description}
                            </p>
                            {outboundCardBadges?.[integration.key as keyof typeof outboundCardBadges] && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {outboundCardBadges[integration.key as keyof typeof outboundCardBadges].map((badge) => (
                                  <Badge key={badge.label} variant={badge.variant} className="text-[11px]">
                                    {badge.label}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <Link href={integration.href}>{integration.cta}</Link>
                        </Button>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* Sticky save bar on mobile when dirty */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <span className="text-sm text-slate-600 dark:text-slate-400">Unsaved changes</span>
          <Button
            onClick={handleSaveChanges}
            disabled={saving}
            size="sm"
            className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 shadow-lg"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
    </div>
  );
}
