/**
 * ConTigo Word Add-in - Main App Component
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  Tab,
  TabList,
  TabValue,
  SelectTabData,
  SelectTabEvent,
  makeStyles,
  tokens,
  Title1,
  Body1,
  Spinner,
} from '@fluentui/react-components';
import {
  DocumentRegular,
  TextBulletListSquareRegular,
  SparkleRegular,
  PersonRegular,
  SettingsRegular,
} from '@fluentui/react-icons';
import { TemplatesPanel } from './panels/TemplatesPanel';
import { ClausesPanel } from './panels/ClausesPanel';
import { AIAssistPanel } from './panels/AIAssistPanel';
import { VariablesPanel } from './panels/VariablesPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/LoginScreen';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    padding: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  tabList: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: tokens.spacingVerticalM,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
});

type TabId = 'templates' | 'clauses' | 'ai' | 'variables' | 'settings';

const AppContent: React.FC = () => {
  const styles = useStyles();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedTab, setSelectedTab] = useState<TabId>('templates');

  const onTabSelect = useCallback(
    (_event: SelectTabEvent, data: SelectTabData) => {
      setSelectedTab(data.value as TabId);
    },
    []
  );

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading ConTigo..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.logo}>
          <img src="/icons/logo.svg" alt="ConTigo" width={24} height={24} />
          <Title1>ConTigo</Title1>
        </div>
        <Body1>Contract Generation</Body1>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabList}>
        <TabList selectedValue={selectedTab} onTabSelect={onTabSelect}>
          <Tab value="templates" icon={<DocumentRegular />}>
            Templates
          </Tab>
          <Tab value="clauses" icon={<TextBulletListSquareRegular />}>
            Clauses
          </Tab>
          <Tab value="ai" icon={<SparkleRegular />}>
            AI Assist
          </Tab>
          <Tab value="variables" icon={<PersonRegular />}>
            Variables
          </Tab>
          <Tab value="settings" icon={<SettingsRegular />}>
            Settings
          </Tab>
        </TabList>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {selectedTab === 'templates' && <TemplatesPanel />}
        {selectedTab === 'clauses' && <ClausesPanel />}
        {selectedTab === 'ai' && <AIAssistPanel />}
        {selectedTab === 'variables' && <VariablesPanel />}
        {selectedTab === 'settings' && <SettingsPanel />}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};
