'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, BellOff, Check, ChevronDown, Globe, Lock, Mail, 
  MessageSquare, Settings, Smartphone, Sun, Moon, Monitor,
  Eye, EyeOff, Volume2, VolumeX, Vibrate, Palette
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

interface ThemeOption {
  id: 'light' | 'dark' | 'system';
  name: string;
  icon: React.ReactNode;
}

// ============================================================================
// Toggle Switch
// ============================================================================

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className = '',
}: ToggleSwitchProps) {
  const sizeClasses = {
    sm: { container: 'w-8 h-5', dot: 'w-3 h-3', translate: 'translate-x-3' },
    md: { container: 'w-10 h-6', dot: 'w-4 h-4', translate: 'translate-x-4' },
    lg: { container: 'w-12 h-7', dot: 'w-5 h-5', translate: 'translate-x-5' },
  };

  const { container, dot, translate } = sizeClasses[size];

  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`
        ${container} rounded-full p-1 transition-colors
        ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <motion.div
        animate={{ x: checked ? 16 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`${dot} bg-white rounded-full shadow`}
      />
    </button>
  );
}

// ============================================================================
// Settings Section
// ============================================================================

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  className = '',
}: SettingsSectionProps) {
  return (
    <div className={`${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ============================================================================
// Setting Row
// ============================================================================

interface SettingRowProps {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingRow({
  icon,
  label,
  description,
  children,
  className = '',
}: SettingRowProps) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${className}`}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 text-gray-400">{icon}</div>
        )}
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ============================================================================
// Notification Preferences
// ============================================================================

interface NotificationPreferencesProps {
  categories: NotificationCategory[];
  onChange: (categories: NotificationCategory[]) => void;
  className?: string;
}

export function NotificationPreferences({
  categories,
  onChange,
  className = '',
}: NotificationPreferencesProps) {
  const updateCategory = (id: string, field: 'email' | 'push' | 'inApp', value: boolean) => {
    onChange(
      categories.map(cat =>
        cat.id === id ? { ...cat, [field]: value } : cat
      )
    );
  };

  const toggleAll = (field: 'email' | 'push' | 'inApp', value: boolean) => {
    onChange(categories.map(cat => ({ ...cat, [field]: value })));
  };

  const allEmail = categories.every(c => c.email);
  const allPush = categories.every(c => c.push);
  const allInApp = categories.every(c => c.inApp);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="col-span-1 font-medium text-gray-700 dark:text-gray-300">
          Category
        </div>
        <button
          onClick={() => toggleAll('email', !allEmail)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <Mail className="w-4 h-4" />
          Email
        </button>
        <button
          onClick={() => toggleAll('push', !allPush)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <Smartphone className="w-4 h-4" />
          Push
        </button>
        <button
          onClick={() => toggleAll('inApp', !allInApp)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <Bell className="w-4 h-4" />
          In-App
        </button>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {categories.map(category => (
          <div key={category.id} className="grid grid-cols-4 gap-4 px-4 py-3 items-center">
            <div className="col-span-1">
              <div className="flex items-center gap-2">
                {category.icon}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {category.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {category.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <ToggleSwitch
                checked={category.email}
                onChange={v => updateCategory(category.id, 'email', v)}
                size="sm"
              />
            </div>
            <div className="flex justify-center">
              <ToggleSwitch
                checked={category.push}
                onChange={v => updateCategory(category.id, 'push', v)}
                size="sm"
              />
            </div>
            <div className="flex justify-center">
              <ToggleSwitch
                checked={category.inApp}
                onChange={v => updateCategory(category.id, 'inApp', v)}
                size="sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Theme Selector
// ============================================================================

interface ThemeSelectorProps {
  value: 'light' | 'dark' | 'system';
  onChange: (theme: 'light' | 'dark' | 'system') => void;
  className?: string;
}

export function ThemeSelector({
  value,
  onChange,
  className = '',
}: ThemeSelectorProps) {
  const themes: ThemeOption[] = [
    { id: 'light', name: 'Light', icon: <Sun className="w-5 h-5" /> },
    { id: 'dark', name: 'Dark', icon: <Moon className="w-5 h-5" /> },
    { id: 'system', name: 'System', icon: <Monitor className="w-5 h-5" /> },
  ];

  return (
    <div className={`flex gap-2 ${className}`}>
      {themes.map(theme => (
        <button
          key={theme.id}
          onClick={() => onChange(theme.id)}
          className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
            value === theme.id
              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className={value === theme.id ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}>
            {theme.icon}
          </div>
          <span className={`text-sm font-medium ${
            value === theme.id ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'
          }`}>
            {theme.name}
          </span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Privacy Settings
// ============================================================================

interface PrivacySetting {
  id: string;
  label: string;
  description: string;
  value: 'public' | 'friends' | 'private';
}

interface PrivacySettingsProps {
  settings: PrivacySetting[];
  onChange: (settings: PrivacySetting[]) => void;
  className?: string;
}

export function PrivacySettings({
  settings,
  onChange,
  className = '',
}: PrivacySettingsProps) {
  const options = [
    { value: 'public', label: 'Public', icon: <Globe className="w-4 h-4" /> },
    { value: 'friends', label: 'Friends', icon: <MessageSquare className="w-4 h-4" /> },
    { value: 'private', label: 'Private', icon: <Lock className="w-4 h-4" /> },
  ];

  const updateSetting = (id: string, value: 'public' | 'friends' | 'private') => {
    onChange(
      settings.map(s => (s.id === id ? { ...s, value } : s))
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {settings.map(setting => (
        <div
          key={setting.id}
          className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
        >
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {setting.label}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {setting.description}
            </p>
          </div>
          <div className="relative">
            <select
              value={setting.value}
              onChange={e => updateSetting(setting.id, e.target.value as PrivacySetting['value'])}
              className="appearance-none bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Sound Settings
// ============================================================================

interface SoundSettingsProps {
  soundEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  vibration: boolean;
  onVibrationChange: (enabled: boolean) => void;
  className?: string;
}

export function SoundSettings({
  soundEnabled,
  onSoundChange,
  volume,
  onVolumeChange,
  vibration,
  onVibrationChange,
  className = '',
}: SoundSettingsProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <SettingRow
        icon={soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        label="Sound Effects"
        description="Play sounds for notifications and actions"
      >
        <ToggleSwitch checked={soundEnabled} onChange={onSoundChange} />
      </SettingRow>

      {soundEnabled && (
        <div className="pl-8">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Volume: {volume}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={e => onVolumeChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}

      <SettingRow
        icon={<Vibrate className="w-5 h-5" />}
        label="Vibration"
        description="Vibrate on notifications (mobile only)"
      >
        <ToggleSwitch checked={vibration} onChange={onVibrationChange} />
      </SettingRow>
    </div>
  );
}

// ============================================================================
// Color Picker Setting
// ============================================================================

interface ColorPickerSettingProps {
  label: string;
  description?: string;
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  className?: string;
}

export function ColorPickerSetting({
  label,
  description,
  value,
  onChange,
  presets = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'],
  className = '',
}: ColorPickerSettingProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Palette className="w-5 h-5 text-gray-400" />
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-gray-600 overflow-hidden"
          style={{ backgroundColor: value }}
        />

        <AnimatePresence>
          {showPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50"
            >
              <div className="grid grid-cols-4 gap-2 mb-3">
                {presets.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      onChange(color);
                      setShowPicker(false);
                    }}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                      value === color ? 'border-gray-900 dark:border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full h-8 cursor-pointer"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
