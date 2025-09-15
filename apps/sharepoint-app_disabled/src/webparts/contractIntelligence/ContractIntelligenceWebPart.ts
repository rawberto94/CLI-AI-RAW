/**
 * Contract Intelligence SharePoint Web Part
 * Main entry point for the SharePoint Framework application
 */

import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle,
  PropertyPaneDropdown,
  IPropertyPaneDropdownOption
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

import * as strings from 'ContractIntelligenceWebPartStrings';
import ContractIntelligence from './components/ContractIntelligence';
import { IContractIntelligenceProps } from './components/IContractIntelligenceProps';

export interface IContractIntelligenceWebPartProps {
  title: string;
  apiBaseUrl: string;
  tenantId: string;
  enableRealTimeSync: boolean;
  defaultView: string;
  showFinancialMetrics: boolean;
  sharePointSiteUrl: string;
  documentLibraryName: string;
}

export default class ContractIntelligenceWebPart extends BaseClientSideWebPart<IContractIntelligenceWebPartProps> {

  protected async onInit(): Promise<void> {
    // Initialize SharePoint context and authenticate
    await super.onInit();
    
    // Set default values if not configured
    if (!this.properties.apiBaseUrl) {
      this.properties.apiBaseUrl = 'https://api.contract-intelligence.com';
    }
    
    if (!this.properties.tenantId) {
      this.properties.tenantId = this.context.pageContext.aadInfo?.tenantId?.toString() || 'default';
    }

    if (!this.properties.sharePointSiteUrl) {
      this.properties.sharePointSiteUrl = this.context.pageContext.web.absoluteUrl;
    }

    // Initialize document library monitoring
    if (this.properties.enableRealTimeSync) {
      await this.initializeDocumentMonitoring();
    }
  }

  public render(): void {
    const element: React.ReactElement<IContractIntelligenceProps> = React.createElement(
      ContractIntelligence,
      {
        title: this.properties.title,
        apiBaseUrl: this.properties.apiBaseUrl,
        tenantId: this.properties.tenantId,
        enableRealTimeSync: this.properties.enableRealTimeSync,
        defaultView: this.properties.defaultView,
        showFinancialMetrics: this.properties.showFinancialMetrics,
        sharePointSiteUrl: this.properties.sharePointSiteUrl,
        documentLibraryName: this.properties.documentLibraryName,
        context: this.context,
        httpClient: this.context.spHttpClient,
        displayMode: this.displayMode,
        updateProperty: (value: string) => {
          this.properties.title = value;
        }
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  /**
   * Property pane configuration
   */
  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('title', {
                  label: strings.TitleFieldLabel,
                  value: this.properties.title
                }),
                PropertyPaneTextField('apiBaseUrl', {
                  label: 'API Base URL',
                  description: 'Base URL for the Contract Intelligence API',
                  value: this.properties.apiBaseUrl
                }),
                PropertyPaneTextField('tenantId', {
                  label: 'Tenant ID',
                  description: 'Your organization tenant identifier',
                  value: this.properties.tenantId
                })
              ]
            },
            {
              groupName: 'SharePoint Integration',
              groupFields: [
                PropertyPaneTextField('sharePointSiteUrl', {
                  label: 'SharePoint Site URL',
                  description: 'URL of the SharePoint site containing contracts',
                  value: this.properties.sharePointSiteUrl
                }),
                PropertyPaneTextField('documentLibraryName', {
                  label: 'Document Library Name',
                  description: 'Name of the document library to monitor',
                  value: this.properties.documentLibraryName || 'Contracts'
                }),
                PropertyPaneToggle('enableRealTimeSync', {
                  label: 'Enable Real-time Sync',
                  description: 'Automatically sync new documents from SharePoint',
                  checked: this.properties.enableRealTimeSync
                })
              ]
            },
            {
              groupName: 'Display Options',
              groupFields: [
                PropertyPaneDropdown('defaultView', {
                  label: 'Default View',
                  description: 'Choose the default view for the web part',
                  options: [
                    { key: 'dashboard', text: 'Dashboard Overview' },
                    { key: 'documents', text: 'Document List' },
                    { key: 'analytics', text: 'Analytics' },
                    { key: 'financial', text: 'Financial Metrics' }
                  ],
                  selectedKey: this.properties.defaultView || 'dashboard'
                }),
                PropertyPaneToggle('showFinancialMetrics', {
                  label: 'Show Financial Metrics',
                  description: 'Display financial analysis and cost information',
                  checked: this.properties.showFinancialMetrics
                })
              ]
            }
          ]
        }
      ]
    };
  }

  /**
   * Initialize document library monitoring for real-time sync
   */
  private async initializeDocumentMonitoring(): Promise<void> {
    if (!this.properties.documentLibraryName) {
      return;
    }

    try {
      // Get document library information
      const libraryUrl = `${this.properties.sharePointSiteUrl}/_api/web/lists/getbytitle('${this.properties.documentLibraryName}')`;
      
      const response: SPHttpClientResponse = await this.context.spHttpClient.get(
        libraryUrl,
        SPHttpClient.configurations.v1
      );

      if (response.ok) {
        const library = await response.json();
        console.log('Contract Intelligence: Connected to document library', library.Title);
        
        // Set up webhook for document changes (would require additional setup)
        await this.setupDocumentWebhook(library.Id);
      }
    } catch (error) {
      console.error('Contract Intelligence: Failed to initialize document monitoring', error);
    }
  }

  /**
   * Set up webhook for document library changes
   */
  private async setupDocumentWebhook(libraryId: string): Promise<void> {
    // This would require a webhook endpoint on your contract intelligence API
    const webhookUrl = `${this.properties.apiBaseUrl}/api/sharepoint/webhook`;
    
    const subscriptionData = {
      resource: `web/lists('${libraryId}')`,
      notificationUrl: webhookUrl,
      expirationDateTime: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days
      clientState: this.properties.tenantId
    };

    try {
      const response: SPHttpClientResponse = await this.context.spHttpClient.post(
        `${this.properties.sharePointSiteUrl}/_api/web/lists('${libraryId}')/subscriptions`,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(subscriptionData)
        }
      );

      if (response.ok) {
        const subscription = await response.json();
        console.log('Contract Intelligence: Webhook subscription created', subscription.id);
      }
    } catch (error) {
      console.error('Contract Intelligence: Failed to create webhook subscription', error);
    }
  }

  /**
   * Handle property changes
   */
  protected onPropertyPaneFieldChanged(propertyPath: string, oldValue: any, newValue: any): void {
    if (propertyPath === 'enableRealTimeSync' && newValue && !oldValue) {
      // Real-time sync was enabled
      this.initializeDocumentMonitoring();
    }

    super.onPropertyPaneFieldChanged(propertyPath, oldValue, newValue);
  }
}