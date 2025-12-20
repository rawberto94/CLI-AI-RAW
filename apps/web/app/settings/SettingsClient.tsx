"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { PageBreadcrumb } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Toggle } from "@/components/toggle";
import { Alert, InlineAlert } from "@/components/alert";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/accordion";
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
  CheckCircle,
  Tag,
  FolderTree,
  HelpCircle,
  Play,
} from "lucide-react";

// Mock settings data (kept local to the client component)
const settingsData = {
  user: {
    name: "Roberto Ostojic",
    email: "roberto@company.com",
    role: "System Administrator",
    lastLogin: "2024-01-20 09:30:00",
    avatar: null,
  },
  system: {
    timezone: "UTC-8 (Pacific)",
    language: "English (US)",
    dateFormat: "MM/DD/YYYY",
    currency: "USD",
    theme: "Light",
  },
  security: {
    twoFactorEnabled: true,
    sessionTimeout: 8, // hours
    passwordPolicy: "Strong",
    apiTokens: 3,
    lastPasswordChange: "2024-01-10",
  },
  notifications: {
    email: {
      contractUploaded: true,
      processingComplete: true,
      riskAlerts: true,
      complianceIssues: true,
      systemMaintenance: false,
      weeklyReports: true,
    },
    push: {
      enabled: true,
      criticalAlerts: true,
      processingUpdates: false,
      weeklyDigest: true,
    },
  },
  processing: {
    autoProcessing: true,
    aiAnalysis: true,
    riskAssessment: true,
    complianceCheck: true,
    ocrEnabled: true,
    retentionPeriod: 7, // years
    backupFrequency: "Daily",
  },
  integrations: {
    sharepoint: { enabled: false, configured: false },
    salesforce: { enabled: true, configured: true },
    slack: { enabled: true, configured: true },
    teams: { enabled: false, configured: false },
    webhook: { enabled: true, configured: true },
  },
};

export default function SettingsClient() {
  const [activeTab, setActiveTab] = React.useState("general");
  const [showApiKey, setShowApiKey] = React.useState(false);
  
  // State for toggles
  const [emailNotifications, setEmailNotifications] = useState(settingsData.notifications.email);
  const [pushNotifications, setPushNotifications] = useState(settingsData.notifications.push);
  const [processingSettings, setProcessingSettings] = useState(settingsData.processing);
  const [integrationSettings, setIntegrationSettings] = useState(settingsData.integrations);

  // Handle save changes
  const handleSaveChanges = useCallback(async () => {
    toast.info('Saving settings...');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData),
      });
      if (res.ok) {
        toast.success('Settings saved successfully');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    }
  }, []);

  // Handle reset to defaults
  const handleResetDefaults = useCallback(() => {
    toast.info('Resetting settings to defaults...');
    setTimeout(() => {
      toast.success('Settings reset to defaults');
    }, 1000);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/50 to-gray-50/30">
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
              <p className="text-slate-600 mt-1">
                Configure system parameters and preferences
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetDefaults}
                className="bg-white/80 backdrop-blur-sm border-slate-200/60 hover:bg-white shadow-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset to Defaults
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                onClick={handleSaveChanges}
                className="bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 shadow-lg shadow-slate-500/25"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
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
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardContent className="p-4">
                <nav className="space-y-2">
                  {tabs.map((tab, index) => {
                    // External link tabs (like Taxonomy)
                    if ('href' in tab && tab.href) {
                      return (
                        <motion.div
                          key={tab.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                        >
                          <Link
                            href={tab.href}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all duration-200 text-slate-600 hover:bg-slate-100/80"
                          >
                            {tab.icon}
                            {tab.name}
                            <span className="ml-auto text-xs text-slate-400">→</span>
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
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all duration-200 ${
                          activeTab === tab.id
                            ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-lg shadow-slate-500/25"
                            : "text-slate-600 hover:bg-slate-100/80"
                        }`}
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
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-lg shadow-blue-500/25">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    User Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        defaultValue={settingsData.user.name}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        defaultValue={settingsData.user.email}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <input
                      type="text"
                      value={settingsData.user.role}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-lg">
                    <span className="text-sm text-slate-600">Last Login:</span>
                    <span className="text-sm font-medium text-slate-900">
                      {settingsData.user.lastLogin}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg shadow-lg shadow-green-500/25">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    System Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timezone
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="UTC-8">UTC-8 (Pacific)</option>
                        <option value="UTC-5">UTC-5 (Eastern)</option>
                        <option value="UTC+0">UTC+0 (GMT)</option>
                        <option value="UTC+1">UTC+1 (CET)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Language
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date Format
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Currency
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="JPY">JPY (¥)</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Help & Support Card with Restart Tour */}
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg shadow-purple-500/25">
                      <HelpCircle className="w-5 h-5 text-white" />
                    </div>
                    Help & Support
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div>
                      <h4 className="font-medium text-purple-900">Guided Tour</h4>
                      <p className="text-sm text-purple-700">
                        Take a quick tour of the main features
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        localStorage.removeItem('onboarding-completed');
                        window.location.href = '/';
                      }}
                      className="bg-white border-purple-300 text-purple-700 hover:bg-purple-100"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Restart Tour
                    </Button>
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

          {/* Security Settings */}
          {activeTab === "security" && (
            <>
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-red-500 to-rose-500 rounded-lg shadow-lg shadow-red-500/25">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                    Authentication & Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <h4 className="font-medium text-green-800">
                          Two-Factor Authentication
                        </h4>
                        <p className="text-sm text-green-600">
                          Your account is protected with 2FA
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Session Timeout
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="1">1 hour</option>
                        <option value="4">4 hours</option>
                        <option value="8">8 hours</option>
                        <option value="24">24 hours</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password Policy
                      </label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="basic">Basic</option>
                        <option value="strong">Strong</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">
                      Last Password Change:
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {settingsData.security.lastPasswordChange}
                    </span>
                  </div>

                  <Button variant="outline">
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/25">
                      <Key className="w-5 h-5 text-white" />
                    </div>
                    API Access
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <h4 className="font-medium text-blue-800">
                        Active API Tokens
                      </h4>
                      <p className="text-sm text-blue-600">
                        {settingsData.security.apiTokens} tokens currently
                        active
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Manage Tokens
                    </Button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primary API Key
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value="sk-1234567890abcdef..."
                        disabled
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowApiKey(!showApiKey)}
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
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
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
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-600" />
                    Email Notifications
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(emailNotifications).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-700 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <Toggle
                            checked={value as boolean}
                            onChange={(checked) => setEmailNotifications(prev => ({ ...prev, [key]: checked }))}
                            size="sm"
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-green-600" />
                    Push Notifications
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(pushNotifications).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-700 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <Toggle
                            checked={value as boolean}
                            onChange={(checked) => setPushNotifications(prev => ({ ...prev, [key]: checked }))}
                            size="sm"
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Settings */}
          {activeTab === "processing" && (
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg shadow-purple-500/25">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  Processing Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">
                      Automated Processing
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          Auto-process uploads
                        </span>
                        <Toggle
                          checked={processingSettings.autoProcessing}
                          onChange={(checked) => setProcessingSettings(prev => ({ ...prev, autoProcessing: checked }))}
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          AI Analysis
                        </span>
                        <Toggle
                          checked={processingSettings.aiAnalysis}
                          onChange={(checked) => setProcessingSettings(prev => ({ ...prev, aiAnalysis: checked }))}
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          Risk Assessment
                        </span>
                        <Toggle
                          checked={processingSettings.riskAssessment}
                          onChange={(checked) => setProcessingSettings(prev => ({ ...prev, riskAssessment: checked }))}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">
                      Data Management
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Retention Period
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                          <option value="1">1 year</option>
                          <option value="3">3 years</option>
                          <option value="7">7 years</option>
                          <option value="10">10 years</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Backup Frequency
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
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
            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg shadow-lg shadow-green-500/25">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  Third-Party Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(settingsData.integrations).map(
                    ([key, integration]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              (integration as { enabled: boolean }).enabled
                                ? "bg-green-100"
                                : "bg-gray-100"
                            }`}
                          >
                            {key === "sharepoint" && (
                              <FileText className="w-5 h-5 text-blue-600" />
                            )}
                            {key === "salesforce" && (
                              <BarChart3 className="w-5 h-5 text-blue-600" />
                            )}
                            {key === "slack" && (
                              <Bell className="w-5 h-5 text-purple-600" />
                            )}
                            {key === "teams" && (
                              <Users className="w-5 h-5 text-blue-600" />
                            )}
                            {key === "webhook" && (
                              <Globe className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 capitalize">
                              {key}
                            </h4>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  (integration as { enabled: boolean }).enabled
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }
                              >
                                {(integration as { enabled: boolean }).enabled
                                  ? "Enabled"
                                  : "Disabled"}
                              </Badge>
                              {(integration as { configured?: boolean })
                                .configured && (
                                <Badge variant="outline">Configured</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            {(integration as { configured?: boolean })
                              .configured
                              ? "Configure"
                              : "Setup"}
                          </Button>
                          <Toggle
                            checked={(integration as { enabled: boolean }).enabled}
                            onChange={(checked) => {
                              setIntegrationSettings(prev => ({
                                ...prev,
                                [key]: { ...prev[key as keyof typeof prev], enabled: checked }
                              }));
                            }}
                            size="sm"
                          />
                        </div>
                      </div>
                    )
                  )}
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
