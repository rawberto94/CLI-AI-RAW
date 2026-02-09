'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
// import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Bell,
  BellOff,
  BellRing,
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  Slack,
  Loader2,
  Settings,
  Trash2,
  Plus,
  AlertTriangle,
} from 'lucide-react';

interface NotificationSettings {
  emailEnabled: boolean;
  slackEnabled: boolean;
  inAppEnabled: boolean;
  reminderDays: number[];
  escalationEnabled: boolean;
  escalationDays: number;
  escalationRecipients: string[];
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly';
}

interface ScheduledNotification {
  id: string;
  obligationId: string;
  obligationTitle: string;
  type: 'reminder' | 'escalation' | 'overdue';
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled';
  channel: 'email' | 'slack' | 'in_app';
}

interface ObligationNotificationSettingsProps {
  obligationId?: string;
  obligationTitle?: string;
  dueDate?: string;
  onSettingsChange?: (settings: NotificationSettings) => void;
  defaultSettings?: Partial<NotificationSettings>;
  compact?: boolean;
}

const defaultNotificationSettings: NotificationSettings = {
  emailEnabled: true,
  slackEnabled: false,
  inAppEnabled: true,
  reminderDays: [14, 7, 3, 1],
  escalationEnabled: false,
  escalationDays: 1,
  escalationRecipients: [],
  digestEnabled: true,
  digestFrequency: 'daily',
};

export function ObligationNotificationSettings({
  obligationId,
  obligationTitle,
  dueDate,
  onSettingsChange,
  defaultSettings,
  compact = false,
}: ObligationNotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettings>({
    ...defaultNotificationSettings,
    ...defaultSettings,
  });
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [newReminderDays, setNewReminderDays] = useState('');
  const [newEscalationRecipient, setNewEscalationRecipient] = useState('');

  // Fetch existing notifications if obligationId provided
  useEffect(() => {
    if (obligationId) {
      fetchNotifications();
    }
  }, [obligationId]);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(`/api/obligations/notifications?obligationId=${obligationId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setScheduledNotifications(data.data.notifications || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [obligationId]);

  const handleSettingChange = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  const addReminderDay = () => {
    const days = parseInt(newReminderDays);
    if (isNaN(days) || days <= 0) {
      toast.error('Please enter a valid number of days');
      return;
    }
    if (settings.reminderDays.includes(days)) {
      toast.warning('This reminder already exists');
      return;
    }
    handleSettingChange('reminderDays', [...settings.reminderDays, days].sort((a, b) => b - a));
    setNewReminderDays('');
  };

  const removeReminderDay = (day: number) => {
    handleSettingChange('reminderDays', settings.reminderDays.filter((d) => d !== day));
  };

  const addEscalationRecipient = () => {
    if (!newEscalationRecipient || !newEscalationRecipient.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    if (settings.escalationRecipients.includes(newEscalationRecipient)) {
      toast.warning('This recipient already exists');
      return;
    }
    handleSettingChange('escalationRecipients', [...settings.escalationRecipients, newEscalationRecipient]);
    setNewEscalationRecipient('');
  };

  const removeEscalationRecipient = (email: string) => {
    handleSettingChange('escalationRecipients', settings.escalationRecipients.filter((e) => e !== email));
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/obligations/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obligationId,
          settings,
        }),
      });

      if (response.ok) {
        toast.success('Notification settings saved');
        setShowDialog(false);
        fetchNotifications();
      } else {
        toast.error('Failed to save settings');
      }
    } catch (_error) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const cancelNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/obligations/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success('Notification cancelled');
        fetchNotifications();
      }
    } catch (_error) {
      toast.error('Failed to cancel notification');
    }
  };

  // Compact view for inline use
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Bell className="h-4 w-4" />
              Reminders
              {settings.reminderDays.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {settings.reminderDays.length}
                </Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-violet-600" />
                Notification Settings
              </DialogTitle>
              {obligationTitle && (
                <DialogDescription>
                  Configure reminders for: <strong>{obligationTitle}</strong>
                  {dueDate && (
                    <span className="ml-2 text-amber-600">
                      (Due: {new Date(dueDate).toLocaleDateString()})
                    </span>
                  )}
                </DialogDescription>
              )}
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Notification Channels */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Notification Channels
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center justify-between space-x-2 p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-violet-600" />
                      <Label htmlFor="email-notif">Email</Label>
                    </div>
                    <Switch
                      id="email-notif"
                      checked={settings.emailEnabled}
                      onCheckedChange={(v) => handleSettingChange('emailEnabled', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between space-x-2 p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-violet-600" />
                      <Label htmlFor="inapp-notif">In-App</Label>
                    </div>
                    <Switch
                      id="inapp-notif"
                      checked={settings.inAppEnabled}
                      onCheckedChange={(v) => handleSettingChange('inAppEnabled', v)}
                    />
                  </div>
                  <div className="flex items-center justify-between space-x-2 p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Slack className="h-4 w-4 text-green-600" />
                      <Label htmlFor="slack-notif">Slack</Label>
                    </div>
                    <Switch
                      id="slack-notif"
                      checked={settings.slackEnabled}
                      onCheckedChange={(v) => handleSettingChange('slackEnabled', v)}
                    />
                  </div>
                </div>
              </div>

              {/* Reminder Schedule */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Reminder Schedule
                </h4>
                <p className="text-sm text-slate-500">
                  Send reminders this many days before due date
                </p>
                <div className="flex flex-wrap gap-2">
                  {settings.reminderDays.map((day) => (
                    <Badge
                      key={day}
                      variant="secondary"
                      className="flex items-center gap-1 px-3 py-1 cursor-pointer hover:bg-red-100 transition-colors"
                      onClick={() => removeReminderDay(day)}
                    >
                      {day} {day === 1 ? 'day' : 'days'} before
                      <Trash2 className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Days"
                      className="w-20 h-8"
                      value={newReminderDays}
                      onChange={(e) => setNewReminderDays(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addReminderDay()}
                    />
                    <Button size="sm" variant="outline" onClick={addReminderDay}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Escalation Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Escalation
                  </h4>
                  <Switch
                    checked={settings.escalationEnabled}
                    onCheckedChange={(v) => handleSettingChange('escalationEnabled', v)}
                  />
                </div>
                {settings.escalationEnabled && (
                  <div className="pl-6 space-y-4 border-l-2 border-amber-200">
                    <div className="flex items-center gap-4">
                      <Label>Escalate if not completed within</Label>
                      <Select
                        value={settings.escalationDays.toString()}
                        onValueChange={(v) => handleSettingChange('escalationDays', parseInt(v))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 day</SelectItem>
                          <SelectItem value="2">2 days</SelectItem>
                          <SelectItem value="3">3 days</SelectItem>
                          <SelectItem value="7">1 week</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-slate-500">after due date</span>
                    </div>
                    <div className="space-y-2">
                      <Label>Escalation Recipients</Label>
                      <div className="flex flex-wrap gap-2">
                        {settings.escalationRecipients.map((email) => (
                          <Badge
                            key={email}
                            variant="outline"
                            className="flex items-center gap-1 px-3 py-1 cursor-pointer hover:bg-red-100 transition-colors"
                            onClick={() => removeEscalationRecipient(email)}
                          >
                            {email}
                            <Trash2 className="h-3 w-3 ml-1" />
                          </Badge>
                        ))}
                        <div className="flex items-center gap-2">
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            className="w-48 h-8"
                            value={newEscalationRecipient}
                            onChange={(e) => setNewEscalationRecipient(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addEscalationRecipient()}
                          />
                          <Button size="sm" variant="outline" onClick={addEscalationRecipient}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Daily Digest */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Summary Digest
                  </h4>
                  <Switch
                    checked={settings.digestEnabled}
                    onCheckedChange={(v) => handleSettingChange('digestEnabled', v)}
                  />
                </div>
                {settings.digestEnabled && (
                  <div className="pl-6 border-l-2 border-violet-200">
                    <Select
                      value={settings.digestFrequency}
                      onValueChange={(v: 'daily' | 'weekly') =>
                        handleSettingChange('digestFrequency', v)
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily digest</SelectItem>
                        <SelectItem value="weekly">Weekly digest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Scheduled Notifications Preview */}
              {scheduledNotifications.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Scheduled Notifications</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {scheduledNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              notif.type === 'overdue'
                                ? 'destructive'
                                : notif.type === 'escalation'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {notif.type}
                          </Badge>
                          <span>{new Date(notif.scheduledFor).toLocaleDateString()}</span>
                          <span className="text-slate-400">via {notif.channel}</span>
                        </div>
                        {notif.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6"
                            onClick={() => cancelNotification(notif.id)}
                          >
                            <BellOff className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={saveSettings}
                disabled={loading}
                className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Full card view
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-violet-600" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Configure how and when you receive obligation reminders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Content same as dialog, but in card format */}
        {/* Notification Channels */}
        <div className="space-y-4">
          <h4 className="font-medium">Notification Channels</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-violet-600" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-slate-500">Receive reminders via email</p>
                </div>
              </div>
              <Switch
                checked={settings.emailEnabled}
                onCheckedChange={(v) => handleSettingChange('emailEnabled', v)}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-violet-600" />
                <div>
                  <p className="font-medium">In-App</p>
                  <p className="text-sm text-slate-500">Notifications in dashboard</p>
                </div>
              </div>
              <Switch
                checked={settings.inAppEnabled}
                onCheckedChange={(v) => handleSettingChange('inAppEnabled', v)}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Slack className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Slack</p>
                  <p className="text-sm text-slate-500">Get alerts in Slack</p>
                </div>
              </div>
              <Switch
                checked={settings.slackEnabled}
                onCheckedChange={(v) => handleSettingChange('slackEnabled', v)}
              />
            </div>
          </div>
        </div>

        {/* Reminder Schedule */}
        <div className="space-y-4">
          <h4 className="font-medium">Reminder Schedule (days before due date)</h4>
          <div className="flex flex-wrap gap-2">
            {settings.reminderDays.map((day) => (
              <Badge
                key={day}
                variant="secondary"
                className="flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer hover:bg-red-100 transition-colors"
                onClick={() => removeReminderDay(day)}
              >
                {day} {day === 1 ? 'day' : 'days'}
                <Trash2 className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Add days"
                className="w-24"
                value={newReminderDays}
                onChange={(e) => setNewReminderDays(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addReminderDay()}
              />
              <Button size="sm" variant="outline" onClick={addReminderDay}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Escalation */}
        <div className="p-4 border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Escalation
              </h4>
              <p className="text-sm text-slate-500">
                Notify managers when obligations are overdue
              </p>
            </div>
            <Switch
              checked={settings.escalationEnabled}
              onCheckedChange={(v) => handleSettingChange('escalationEnabled', v)}
            />
          </div>
          {settings.escalationEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-4">
                <Label>Escalate after</Label>
                <Select
                  value={settings.escalationDays.toString()}
                  onValueChange={(v) => handleSettingChange('escalationDays', parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="2">2 days</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="7">1 week</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-slate-500">past due date</span>
              </div>
              <div className="space-y-2">
                <Label>Escalation Recipients</Label>
                <div className="flex flex-wrap gap-2">
                  {settings.escalationRecipients.map((email) => (
                    <Badge
                      key={email}
                      variant="outline"
                      className="flex items-center gap-1 px-3 py-1 cursor-pointer hover:bg-red-100"
                      onClick={() => removeEscalationRecipient(email)}
                    >
                      {email}
                      <Trash2 className="h-3 w-3" />
                    </Badge>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="manager@example.com"
                      className="w-56"
                      value={newEscalationRecipient}
                      onChange={(e) => setNewEscalationRecipient(e.target.value)}
                    />
                    <Button size="sm" variant="outline" onClick={addEscalationRecipient}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={saveSettings}
            disabled={loading}
            className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Save Notification Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ObligationNotificationSettings;
