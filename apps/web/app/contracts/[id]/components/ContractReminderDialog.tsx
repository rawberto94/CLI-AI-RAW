'use client'

import React, { memo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format, addDays } from 'date-fns'
import {
  Bell,
  Calendar as CalendarIcon,
  Loader2,
  Mail,
  Clock,
  AlertTriangle,
} from 'lucide-react'

interface ReminderConfig {
  enabled: boolean
  daysBeforeExpiry: number
  reminderDate?: Date
  notificationChannels: ('email' | 'in-app' | 'slack')[]
  message?: string
}

interface ContractReminderDialogProps {
  isOpen: boolean
  onClose: () => void
  contractId: string
  contractName: string
  expirationDate?: string | null
  currentConfig?: ReminderConfig
  onSave: (config: ReminderConfig) => Promise<void>
}

export const ContractReminderDialog = memo(function ContractReminderDialog({
  isOpen,
  onClose,
  contractId,
  contractName,
  expirationDate,
  currentConfig,
  onSave,
}: ContractReminderDialogProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [config, setConfig] = useState<ReminderConfig>({
    enabled: currentConfig?.enabled ?? true,
    daysBeforeExpiry: currentConfig?.daysBeforeExpiry ?? 30,
    reminderDate: currentConfig?.reminderDate,
    notificationChannels: currentConfig?.notificationChannels ?? ['email', 'in-app'],
    message: currentConfig?.message,
  })

  const expiryDate = expirationDate ? new Date(expirationDate) : null
  const calculatedReminderDate = expiryDate 
    ? addDays(expiryDate, -config.daysBeforeExpiry) 
    : null

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(config)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const toggleChannel = (channel: 'email' | 'in-app' | 'slack') => {
    setConfig(prev => ({
      ...prev,
      notificationChannels: prev.notificationChannels.includes(channel)
        ? prev.notificationChannels.filter(c => c !== channel)
        : [...prev.notificationChannels, channel]
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-500" />
            Contract Reminder
          </DialogTitle>
          <DialogDescription>
            Set up automatic reminders for "{contractName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="reminder-enabled" className="text-sm font-medium">
                Enable Reminder
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified before contract expires
              </p>
            </div>
            <Switch
              id="reminder-enabled"
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, enabled }))}
            />
          </div>

          {config.enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {/* Expiration Date Info */}
              {expiryDate ? (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <CalendarIcon className="h-4 w-4 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Expires on {format(expiryDate, 'PPP')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      No expiration date set
                    </p>
                    <p className="text-xs text-amber-600">
                      You can set a custom reminder date below
                    </p>
                  </div>
                </div>
              )}

              {/* Days Before Expiry */}
              <div className="space-y-2">
                <Label htmlFor="days-before" className="text-sm font-medium">
                  Remind me
                </Label>
                <Select
                  value={config.daysBeforeExpiry.toString()}
                  onValueChange={(value) => setConfig(prev => ({ 
                    ...prev, 
                    daysBeforeExpiry: parseInt(value) 
                  }))}
                >
                  <SelectTrigger id="days-before">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">1 week before</SelectItem>
                    <SelectItem value="14">2 weeks before</SelectItem>
                    <SelectItem value="30">1 month before</SelectItem>
                    <SelectItem value="60">2 months before</SelectItem>
                    <SelectItem value="90">3 months before</SelectItem>
                  </SelectContent>
                </Select>
                {calculatedReminderDate && (
                  <p className="text-xs text-muted-foreground">
                    You'll be reminded on {format(calculatedReminderDate, 'PPP')}
                  </p>
                )}
              </div>

              {/* Custom Date (if no expiry) */}
              {!expiryDate && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Or set a specific date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !config.reminderDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {config.reminderDate ? format(config.reminderDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={config.reminderDate}
                        onSelect={(date) => setConfig(prev => ({ ...prev, reminderDate: date as Date | undefined }))}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Notification Channels */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Notification channels
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleChannel('email')}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors",
                      config.notificationChannels.includes('email')
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <Mail className="h-4 w-4" />
                    <span className="text-xs font-medium">Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleChannel('in-app')}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors",
                      config.notificationChannels.includes('in-app')
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <Bell className="h-4 w-4" />
                    <span className="text-xs font-medium">In-app</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleChannel('slack')}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors",
                      config.notificationChannels.includes('slack')
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium">Slack</span>
                  </button>
                </div>
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <Label htmlFor="reminder-message" className="text-sm font-medium">
                  Custom message (optional)
                </Label>
                <Input
                  id="reminder-message"
                  placeholder="Add a note to the reminder..."
                  value={config.message || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, message: e.target.value }))}
                />
              </div>
            </motion.div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Reminder'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
