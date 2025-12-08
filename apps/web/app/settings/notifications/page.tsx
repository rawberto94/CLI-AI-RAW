/**
 * Notification Settings Page
 * Configure notification preferences and channels
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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

// Default notification settings
const DEFAULT_CATEGORIES: NotificationCategory[] = [
  {
    id: "renewals",
    name: "Contract Renewals",
    description: "Notifications about upcoming contract expirations and renewals",
    icon: Calendar,
    color: "text-orange-500",
    email: true,
    push: true,
    inApp: true,
  },
  {
    id: "risks",
    name: "Risk Alerts",
    description: "Alerts about high-risk clauses and compliance issues",
    icon: AlertTriangle,
    color: "text-red-500",
    email: true,
    push: true,
    inApp: true,
  },
  {
    id: "savings",
    name: "Savings Opportunities",
    description: "Notifications about potential cost savings and optimizations",
    icon: DollarSign,
    color: "text-green-500",
    email: true,
    push: false,
    inApp: true,
  },
  {
    id: "deadlines",
    name: "Payment Deadlines",
    description: "Reminders about upcoming payment due dates",
    icon: Clock,
    color: "text-blue-500",
    email: true,
    push: true,
    inApp: true,
  },
  {
    id: "contracts",
    name: "Contract Updates",
    description: "Updates about new contracts, amendments, and status changes",
    icon: FileText,
    color: "text-purple-500",
    email: false,
    push: false,
    inApp: true,
  },
  {
    id: "security",
    name: "Security Alerts",
    description: "Important security notifications and login alerts",
    icon: Shield,
    color: "text-slate-500",
    email: true,
    push: true,
    inApp: true,
  },
  {
    id: "ai",
    name: "AI Insights",
    description: "AI-generated insights and recommendations",
    icon: MessageSquare,
    color: "text-pink-500",
    email: false,
    push: false,
    inApp: true,
  },
];

export default function NotificationSettingsPage() {
  const [categories, setCategories] = useState<NotificationCategory[]>(DEFAULT_CATEGORIES);
  const [globalEmail, setGlobalEmail] = useState(true);
  const [globalPush, setGlobalPush] = useState(true);
  const [globalInApp, setGlobalInApp] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("08:00");
  const [digestFrequency, setDigestFrequency] = useState("daily");
  const [advanceNotice, setAdvanceNotice] = useState([30]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const toggleCategory = (categoryId: string, channel: "email" | "push" | "inApp") => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, [channel]: !cat[channel] } : cat
      )
    );
  };

  const toggleAllForChannel = (channel: "email" | "push" | "inApp", enabled: boolean) => {
    setCategories((prev) =>
      prev.map((cat) => ({ ...cat, [channel]: enabled }))
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mr-2"
                  >
                    <Save className="h-4 w-4" />
                  </motion.div>
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  Saved!
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
                  checked={globalEmail}
                  onCheckedChange={(checked) => {
                    setGlobalEmail(checked);
                    toggleAllForChannel("email", checked);
                  }}
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
                  checked={globalPush}
                  onCheckedChange={(checked) => {
                    setGlobalPush(checked);
                    toggleAllForChannel("push", checked);
                  }}
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
                  checked={globalInApp}
                  onCheckedChange={(checked) => {
                    setGlobalInApp(checked);
                    toggleAllForChannel("inApp", checked);
                  }}
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
              <div className="grid grid-cols-[1fr,80px,80px,80px] gap-2 py-2 px-3 text-xs font-medium text-muted-foreground border-b">
                <span>Category</span>
                <span className="text-center">Email</span>
                <span className="text-center">Push</span>
                <span className="text-center">In-App</span>
              </div>

              {/* Categories */}
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <div
                    key={category.id}
                    className="grid grid-cols-[1fr,80px,80px,80px] gap-2 items-center py-3 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
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
                        checked={category.email}
                        onCheckedChange={() => toggleCategory(category.id, "email")}
                        disabled={!globalEmail}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={category.push}
                        onCheckedChange={() => toggleCategory(category.id, "push")}
                        disabled={!globalPush}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Switch
                        checked={category.inApp}
                        onCheckedChange={() => toggleCategory(category.id, "inApp")}
                        disabled={!globalInApp}
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
                  checked={quietHoursEnabled}
                  onCheckedChange={setQuietHoursEnabled}
                />
              </div>

              {quietHoursEnabled && (
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
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet-end">End Time</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd(e.target.value)}
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
              <Select value={digestFrequency} onValueChange={setDigestFrequency}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Real-time (no digest)</SelectItem>
                  <SelectItem value="hourly">Hourly digest</SelectItem>
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
                  value={advanceNotice}
                  onValueChange={setAdvanceNotice}
                  min={7}
                  max={90}
                  step={1}
                  className="flex-1"
                />
                <Badge variant="secondary" className="w-20 justify-center">
                  {advanceNotice[0]} days
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
                {soundEnabled ? (
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
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
