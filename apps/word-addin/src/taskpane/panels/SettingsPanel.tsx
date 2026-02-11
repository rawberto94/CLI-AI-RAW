/**
 * Settings Panel - User preferences and configuration
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  makeStyles,
  tokens,
  Title2,
  Body1,
  Body2,
  Button,
  Switch,
  Select,
  Input,
  Field,
  Divider,
  MessageBar,
  MessageBarBody,
  Card,
  Badge,
  Spinner,
} from '@fluentui/react-components';
import {
  SettingsRegular,
  PersonRegular,
  KeyRegular,
  ColorRegular,
  DocumentRegular,
  SaveRegular,
  SignOutRegular,
  InfoRegular,
  CheckmarkCircleRegular,
} from '@fluentui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../../services/api-client';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  section: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
  },
  settingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalS} 0`,
  },
  settingLabel: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '70%',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: 20,
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  footer: {
    textAlign: 'center',
    padding: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
});

interface Settings {
  // Document preferences
  autoScan: boolean;
  insertFormat: 'html' | 'text';
  showRiskBadges: boolean;
  
  // AI preferences
  aiModel: 'mistral' | 'openai';
  autoSuggest: boolean;
  
  // Display preferences
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  
  // API settings
  apiUrl: string;
}

const DEFAULT_SETTINGS: Settings = {
  autoScan: true,
  insertFormat: 'html',
  showRiskBadges: true,
  aiModel: 'mistral',
  autoSuggest: false,
  theme: 'system',
  compactMode: false,
  apiUrl: '',
};

export const SettingsPanel: React.FC = () => {
  const styles = useStyles();
  const { user, logout } = useAuth();
  
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('contigo-word-settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

  // Check connection to backend
  useEffect(() => {
    const checkConnection = async () => {
      setConnectionStatus('checking');
      try {
        const result = await apiClient.healthCheck();
        setConnectionStatus(result.success ? 'connected' : 'disconnected');
      } catch (err) {
        setConnectionStatus('disconnected');
      }
    };
    
    checkConnection();
  }, []);

  // Update setting
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  // Save settings
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      localStorage.setItem('contigo-word-settings', JSON.stringify(settings));
      
      // Also sync to backend if connected
      if (connectionStatus === 'connected') {
        await apiClient.saveUserSettings(settings);
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save settings');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }, [settings, connectionStatus]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setSaved(false);
  }, []);

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={styles.root}>
      <Title2>Settings</Title2>

      {/* Success message */}
      {saved && (
        <MessageBar intent="success">
          <MessageBarBody>Settings saved successfully</MessageBarBody>
        </MessageBar>
      )}

      {/* Error */}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {/* User Info */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <PersonRegular />
          <Body1 weight="semibold">Account</Body1>
        </div>
        
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>
            {getInitials(user?.name || 'User')}
          </div>
          <div className={styles.userDetails}>
            <Body1 weight="semibold">{user?.name || 'Guest User'}</Body1>
            <Body2>{user?.email || 'Not signed in'}</Body2>
            {user?.tenantId && (
              <Badge appearance="outline" size="small">
                {user.tenantId}
              </Badge>
            )}
          </div>
        </div>

        <Button
          appearance="secondary"
          icon={<SignOutRegular />}
          onClick={logout}
          style={{ marginTop: 12 }}
        >
          Sign Out
        </Button>
      </div>

      {/* Connection Status */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <KeyRegular />
          <Body1 weight="semibold">Connection</Body1>
        </div>

        <div className={styles.connectionStatus}>
          {connectionStatus === 'checking' ? (
            <>
              <Spinner size="tiny" />
              <Body2>Checking connection...</Body2>
            </>
          ) : connectionStatus === 'connected' ? (
            <>
              <CheckmarkCircleRegular color={tokens.colorPaletteGreenForeground1} />
              <Body2>Connected to ConTigo backend</Body2>
            </>
          ) : (
            <>
              <InfoRegular color={tokens.colorPaletteRedForeground1} />
              <Body2>Not connected</Body2>
            </>
          )}
        </div>

        <Field label="API URL" style={{ marginTop: 12 }}>
          <Input
            placeholder="https://api.contigo.com"
            value={settings.apiUrl}
            onChange={(e, d) => updateSetting('apiUrl', d.value)}
          />
        </Field>
      </div>

      <Divider />

      {/* Document Preferences */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <DocumentRegular />
          <Body1 weight="semibold">Document</Body1>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingLabel}>
            <Body1>Auto-scan variables</Body1>
            <Body2>Automatically scan document when opened</Body2>
          </div>
          <Switch
            checked={settings.autoScan}
            onChange={(e, d) => updateSetting('autoScan', d.checked)}
          />
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingLabel}>
            <Body1>Show risk badges</Body1>
            <Body2>Display risk level badges on clauses</Body2>
          </div>
          <Switch
            checked={settings.showRiskBadges}
            onChange={(e, d) => updateSetting('showRiskBadges', d.checked)}
          />
        </div>

        <Field label="Insert format">
          <Select
            value={settings.insertFormat}
            onChange={(e, d) => updateSetting('insertFormat', d.value as 'html' | 'text')}
          >
            <option value="html">Rich text (HTML)</option>
            <option value="text">Plain text</option>
          </Select>
        </Field>
      </div>

      {/* AI Preferences */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <SettingsRegular />
          <Body1 weight="semibold">AI Assistance</Body1>
        </div>

        <Field label="AI Model">
          <Select
            value={settings.aiModel}
            onChange={(e, d) => updateSetting('aiModel', d.value as 'mistral' | 'openai')}
          >
            <option value="mistral">Mistral AI (Default)</option>
            <option value="openai">OpenAI GPT-4</option>
          </Select>
        </Field>

        <div className={styles.settingRow}>
          <div className={styles.settingLabel}>
            <Body1>Auto-suggest</Body1>
            <Body2>Automatically suggest improvements while typing</Body2>
          </div>
          <Switch
            checked={settings.autoSuggest}
            onChange={(e, d) => updateSetting('autoSuggest', d.checked)}
          />
        </div>
      </div>

      {/* Display Preferences */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <ColorRegular />
          <Body1 weight="semibold">Display</Body1>
        </div>

        <Field label="Theme">
          <Select
            value={settings.theme}
            onChange={(e, d) => updateSetting('theme', d.value as 'light' | 'dark' | 'system')}
          >
            <option value="system">System default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </Field>

        <div className={styles.settingRow}>
          <div className={styles.settingLabel}>
            <Body1>Compact mode</Body1>
            <Body2>Use condensed layout for panels</Body2>
          </div>
          <Switch
            checked={settings.compactMode}
            onChange={(e, d) => updateSetting('compactMode', d.checked)}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
        <Button
          appearance="primary"
          icon={isSaving ? <Spinner size="tiny" /> : <SaveRegular />}
          onClick={handleSave}
          disabled={isSaving}
        >
          Save Settings
        </Button>
        <Button appearance="secondary" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <Body2>ConTigo Word Add-in v1.0.0</Body2>
        <Body2>© 2024 ConTigo CLM</Body2>
      </div>
    </div>
  );
};
