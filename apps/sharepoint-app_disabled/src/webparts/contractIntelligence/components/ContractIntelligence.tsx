/**
 * Contract Intelligence React Component for SharePoint
 * Main dashboard interface for contract analytics
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  DefaultButton,
  PrimaryButton,
  Spinner,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  Card,
  CardHeader,
  CardPreview,
  CardFooter
} from '@fluentui/react';
import { IContractIntelligenceProps } from './IContractIntelligenceProps';

// Sub-components
import { DashboardView } from './views/DashboardView';
import { DocumentsView } from './views/DocumentsView';
import { AnalyticsView } from './views/AnalyticsView';
import { FinancialView } from './views/FinancialView';

export interface IContractIntelligenceState {
  loading: boolean;
  error: string | null;
  connected: boolean;
  documents: any[];
  analytics: any;
  lastSync: Date | null;
}

const ContractIntelligence: React.FC<IContractIntelligenceProps> = (props) => {
  const [state, setState] = useState<IContractIntelligenceState>({
    loading: true,
    error: null,
    connected: false,
    documents: [],
    analytics: null,
    lastSync: null
  });

  const [selectedView, setSelectedView] = useState<string>(props.defaultView || 'dashboard');

  useEffect(() => {
    initializeConnection();
  }, [props.apiBaseUrl, props.tenantId]);

  /**
   * Initialize connection to Contract Intelligence API
   */
  const initializeConnection = async (): Promise<void> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Test API connectivity
      const response = await fetch(`${props.apiBaseUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': props.tenantId
        }
      });

      if (response.ok) {
        setState(prev => ({ 
          ...prev, 
          connected: true, 
          loading: false 
        }));
        
        // Load initial data
        await loadDashboardData();
      } else {
        throw new Error(`API connection failed: ${response.statusText}`);
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: `Failed to connect to Contract Intelligence API: ${error}`,
        loading: false,
        connected: false
      }));
    }
  };

  /**
   * Load dashboard data
   */
  const loadDashboardData = async (): Promise<void> => {
    try {
      const [documentsResponse, analyticsResponse] = await Promise.all([
        fetch(`${props.apiBaseUrl}/api/documents?limit=10`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': props.tenantId
          }
        }),
        fetch(`${props.apiBaseUrl}/api/analytics/overview`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': props.tenantId
          }
        })
      ]);

      const documents = documentsResponse.ok ? await documentsResponse.json() : [];
      const analytics = analyticsResponse.ok ? await analyticsResponse.json() : null;

      setState(prev => ({
        ...prev,
        documents: documents.documents || [],
        analytics,
        lastSync: new Date()
      }));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  /**
   * Sync documents from SharePoint
   */
  const syncSharePointDocuments = async (): Promise<void> => {
    if (!props.documentLibraryName) {
      setState(prev => ({ 
        ...prev, 
        error: 'Document library not configured. Please configure in web part properties.' 
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      // Start sync process
      const response = await fetch(`${props.apiBaseUrl}/api/repositories/sharepoint/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': props.tenantId
        },
        body: JSON.stringify({
          siteUrl: props.sharePointSiteUrl,
          libraryName: props.documentLibraryName
        })
      });

      if (response.ok) {
        const result = await response.json();
        setState(prev => ({ 
          ...prev, 
          loading: false,
          error: null,
          lastSync: new Date()
        }));
        
        // Reload dashboard data
        await loadDashboardData();
      } else {
        throw new Error(`Sync failed: ${response.statusText}`);
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: `SharePoint sync failed: ${error}`,
        loading: false
      }));
    }
  };

  /**
   * Render loading state
   */
  if (state.loading && !state.connected) {
    return (
      <Stack horizontalAlign="center" verticalAlign="center" styles={{ root: { height: 200 } }}>
        <Spinner label="Connecting to Contract Intelligence..." />
      </Stack>
    );
  }

  /**
   * Render error state
   */
  if (state.error) {
    return (
      <Stack tokens={{ childrenGap: 16 }}>
        <MessageBar messageBarType={MessageBarType.error}>
          {state.error}
        </MessageBar>
        <DefaultButton text="Retry Connection" onClick={initializeConnection} />
      </Stack>
    );
  }

  /**
   * Render main interface
   */
  return (
    <Stack tokens={{ childrenGap: 16 }}>
      {/* Header */}
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Text variant="xLarge">{props.title || 'Contract Intelligence'}</Text>
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          {props.enableRealTimeSync && (
            <PrimaryButton 
              text="Sync SharePoint" 
              onClick={syncSharePointDocuments}
              disabled={state.loading}
            />
          )}
          <DefaultButton text="Refresh" onClick={loadDashboardData} />
        </Stack>
      </Stack>

      {/* Connection Status */}
      {state.connected && (
        <MessageBar messageBarType={MessageBarType.success}>
          Connected to Contract Intelligence API
          {state.lastSync && ` • Last sync: ${state.lastSync.toLocaleTimeString()}`}
        </MessageBar>
      )}

      {/* Main Content */}
      <Pivot 
        selectedKey={selectedView} 
        onLinkClick={(item) => setSelectedView(item?.props.itemKey || 'dashboard')}
      >
        <PivotItem headerText="Dashboard" itemKey="dashboard">
          <DashboardView 
            documents={state.documents}
            analytics={state.analytics}
            apiBaseUrl={props.apiBaseUrl}
            tenantId={props.tenantId}
          />
        </PivotItem>

        <PivotItem headerText="Documents" itemKey="documents">
          <DocumentsView 
            documents={state.documents}
            apiBaseUrl={props.apiBaseUrl}
            tenantId={props.tenantId}
            onRefresh={loadDashboardData}
          />
        </PivotItem>

        <PivotItem headerText="Analytics" itemKey="analytics">
          <AnalyticsView 
            analytics={state.analytics}
            apiBaseUrl={props.apiBaseUrl}
            tenantId={props.tenantId}
          />
        </PivotItem>

        {props.showFinancialMetrics && (
          <PivotItem headerText="Financial" itemKey="financial">
            <FinancialView 
              documents={state.documents}
              apiBaseUrl={props.apiBaseUrl}
              tenantId={props.tenantId}
            />
          </PivotItem>
        )}
      </Pivot>
    </Stack>
  );
};

export default ContractIntelligence;