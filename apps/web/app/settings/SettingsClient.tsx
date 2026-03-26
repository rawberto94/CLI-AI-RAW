"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageBreadcrumb } from '@/components/navigation';
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
  Eye,
  EyeOff,
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
    sessionTimeout: 480,
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

export default function SettingsClient() {
  const [activeTab, setActiveTab] = React.useState("general");
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  
  // Real settings state fetched from API
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
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

  // Fetch settings from API on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          const settings = data.data?.settings || data.settings || DEFAULT_SETTINGS;
          const user = data.data?.user || data.user;
          if (user) setUserInfo(user);
          if (settings.system) setSystemSettings(s => ({ ...s, ...settings.system }));
          if (settings.notifications) setNotificationSettings(s => ({ ...s, ...settings.notifications }));
          if (settings.security) setSecuritySettings(s => ({ ...s, ...settings.security }));
          if (settings.display) setDisplaySettings(s => ({ ...s, ...settings.display }));
        }
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

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
        { section: 'security', updates: securitySettings },
        { section: 'display', updates: displaySettings },
        { section: 'processing', updates: processingSettings },
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
        toast.error('Some settings failed to save');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [systemSettings, notificationSettings, securitySettings, displaySettings, processingSettings]);

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
                    <div className="p-2 bg-gradient-to-br from-violet-500 to-violet-500 rounded-lg shadow-lg shadow-green-500/25">
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
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-200">
                    <div>
                      <h4 className="font-medium text-violet-900">App Tour & Learning Center</h4>
                      <p className="text-sm text-violet-700">
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
                        Session Timeout (minutes)
                      </label>
                      <select
                        value={securitySettings.sessionTimeout}
                        onChange={(e) => updateSecurity({ sessionTimeout: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value={60}>1 hour</option>
                        <option value={240}>4 hours</option>
                        <option value={480}>8 hours</option>
                        <option value={1440}>24 hours</option>
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

                  <Button
                    variant="outline"
                    onClick={() => toast.info('Password change is available in Profile Settings → /settings/profile')}
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
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
                  <div className="flex items-center justify-between p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
                    <div>
                      <h4 className="font-medium text-violet-800 dark:text-violet-300">
                        API Tokens
                      </h4>
                      <p className="text-sm text-violet-600 dark:text-violet-400">
                        Manage API keys for programmatic access
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info('API token management coming soon')}
                    >
                      Manage Tokens
                    </Button>
                  </div>

                  <div>
                    <label htmlFor="primaryApiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Primary API Key
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="primaryApiKey"
                        type={showApiKey ? "text" : "password"}
                        value="Contact admin to generate API keys"
                        disabled
                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowApiKey(!showApiKey)}
                        aria-label={showApiKey ? "Hide API key" : "Show API key"}
                      >
                        {showApiKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
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
                      ['contractUpdates', 'Contract Updates'],
                      ['renewalReminders', 'Renewal Reminders'],
                      ['complianceAlerts', 'Compliance Alerts'],
                      ['systemUpdates', 'System Updates'],
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
                      ['browserNotifications', 'Browser Notifications'],
                      ['desktopNotifications', 'Desktop Notifications'],
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
                  For more granular notification settings, visit{' '}
                  <Link href="/settings/notifications" className="text-violet-500 hover:underline">
                    Notification Settings →
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Processing Settings */}
          {activeTab === "processing" && (
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
                            checked={(processingSettings as Record<string, boolean>)[key] ?? true}
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
                          value={(processingSettings as Record<string, string>).retentionPeriod ?? '7'}
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
                          value={(processingSettings as Record<string, string>).backupFrequency ?? 'daily'}
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
          )}

          {/* Integrations Settings */}
          {activeTab === "integrations" && (
            <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-violet-500 rounded-lg shadow-lg shadow-green-500/25">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  Third-Party Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {([
                    { key: 'sharepoint', label: 'SharePoint', icon: FileText, description: 'Document management' },
                    { key: 'salesforce', label: 'Salesforce', icon: BarChart3, description: 'CRM integration' },
                    { key: 'slack', label: 'Slack', icon: Bell, description: 'Team notifications' },
                    { key: 'teams', label: 'Microsoft Teams', icon: Users, description: 'Collaboration' },
                    { key: 'webhook', label: 'Webhooks', icon: Globe, description: 'Custom integrations' },
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
                          onClick={() => toast.info(`${integration.label} integration coming soon`)}
                        >
                          Setup
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
    </div>
  );
}
