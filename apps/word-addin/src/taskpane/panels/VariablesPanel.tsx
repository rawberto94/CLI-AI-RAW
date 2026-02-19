/**
 * Variables Panel - Manage and replace contract variables
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
  Input,
  Spinner,
  Badge,
  Divider,
  MessageBar,
  MessageBarBody,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import {
  ArrowSyncRegular,
  PersonRegular,
  BuildingRegular,
  CalendarRegular,
  MoneyRegular,
  DocumentRegular,
} from '../../utils/icons';
import { wordService, Variable } from '../../services/word-service';
import { apiClient } from '../../services/api-client';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  variableCard: {
    padding: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  variableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalS,
  },
  variableName: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  partySection: {
    marginTop: tokens.spacingVerticalM,
  },
  partyCard: {
    padding: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  partyFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXL,
  },
  empty: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXL,
    color: tokens.colorNeutralForeground3,
  },
  stats: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalM,
  },
  stat: {
    textAlign: 'center',
  },
});

interface PartyInfo {
  name: string;
  address: string;
  contact: string;
  email: string;
  title?: string;
}

const getVariableIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('party') || lower.includes('buyer') || lower.includes('seller')) {
    return <PersonRegular />;
  }
  if (lower.includes('company') || lower.includes('organization')) {
    return <BuildingRegular />;
  }
  if (lower.includes('date') || lower.includes('effective') || lower.includes('term')) {
    return <CalendarRegular />;
  }
  if (lower.includes('amount') || lower.includes('value') || lower.includes('price') || lower.includes('fee')) {
    return <MoneyRegular />;
  }
  return <DocumentRegular />;
};

export const VariablesPanel: React.FC = () => {
  const styles = useStyles();
  
  const [variables, setVariables] = useState<Variable[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceCount, setReplaceCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Party information
  const [buyerInfo, setBuyerInfo] = useState<PartyInfo>({
    name: '',
    address: '',
    contact: '',
    email: '',
    title: '',
  });
  const [sellerInfo, setSellerInfo] = useState<PartyInfo>({
    name: '',
    address: '',
    contact: '',
    email: '',
    title: '',
  });
  
  const [showSaveParty, setShowSaveParty] = useState(false);
  const [savePartyType, setSavePartyType] = useState<'buyer' | 'seller'>('buyer');

  // Scan document for variables
  const handleScanDocument = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    
    try {
      const foundVariables = await wordService.findVariables();
      const vars: Variable[] = foundVariables.map((name) => ({
        name,
        value: values[name] || '',
        placeholder: `{{${name}}}`,
      }));
      setVariables(vars);
    } catch (err) {
      setError('Failed to scan document for variables');
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  }, [values]);

  // Update variable value
  const handleValueChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setVariables((prev) =>
      prev.map((v) => (v.name === name ? { ...v, value } : v))
    );
  }, []);

  // Replace all variables in document
  const handleReplaceAll = useCallback(async () => {
    const varsToReplace = variables.filter((v) => v.value);
    if (varsToReplace.length === 0) {
      setError('No variables have values to replace');
      return;
    }

    setIsReplacing(true);
    setError(null);
    setReplaceCount(null);

    try {
      const count = await wordService.replaceVariables(varsToReplace);
      setReplaceCount(count);
      
      // Rescan to see remaining variables
      setTimeout(() => handleScanDocument(), 500);
    } catch (err) {
      setError('Failed to replace variables');
      console.error(err);
    } finally {
      setIsReplacing(false);
    }
  }, [variables, handleScanDocument]);

  // Load party defaults
  const handleLoadPartyDefaults = useCallback(async (type: 'buyer' | 'seller') => {
    try {
      const result = await apiClient.getPartyDefaults(type);
      if (result.success && result.data) {
        if (type === 'buyer') {
          setBuyerInfo(result.data as PartyInfo);
        } else {
          setSellerInfo(result.data as PartyInfo);
        }
      }
    } catch (err) {
      console.error('Failed to load party defaults:', err);
    }
  }, []);

  // Save party defaults
  const handleSavePartyDefaults = useCallback(async () => {
    const info = savePartyType === 'buyer' ? buyerInfo : sellerInfo;
    try {
      await apiClient.savePartyDefaults(savePartyType, { ...info } as Record<string, string>);
      setShowSaveParty(false);
    } catch (err) {
      console.error('Failed to save party defaults:', err);
    }
  }, [savePartyType, buyerInfo, sellerInfo]);

  // Apply party info to variables
  const handleApplyPartyInfo = useCallback((type: 'buyer' | 'seller') => {
    const info = type === 'buyer' ? buyerInfo : sellerInfo;
    const prefix = type === 'buyer' ? 'buyer' : 'seller';
    
    setValues((prev) => ({
      ...prev,
      [`${prefix}Name`]: info.name,
      [`${prefix}Address`]: info.address,
      [`${prefix}Contact`]: info.contact,
      [`${prefix}Email`]: info.email,
      [`${prefix}Title`]: info.title || '',
      // Also try common variations
      [`${type}Name`]: info.name,
      [`${type}_name`]: info.name,
      [`${type.charAt(0).toUpperCase() + type.slice(1)}Name`]: info.name,
    }));
  }, [buyerInfo, sellerInfo]);

  // Initial scan
  useEffect(() => {
    handleScanDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleScanDocument]);

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <Title2>Variables</Title2>
        <Button
          icon={<ArrowSyncRegular />}
          onClick={handleScanDocument}
          disabled={isScanning}
        >
          {isScanning ? <Spinner size="tiny" /> : 'Scan'}
        </Button>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <Body2>Found</Body2>
          <Body1 style={{ fontWeight: 600 }}>{variables.length}</Body1>
        </div>
        <div className={styles.stat}>
          <Body2>Filled</Body2>
          <Body1 style={{ fontWeight: 600 }}>
            {variables.filter((v) => v.value).length}
          </Body1>
        </div>
        <div className={styles.stat}>
          <Body2>Remaining</Body2>
          <Body1 style={{ fontWeight: 600 }}>
            {variables.filter((v) => !v.value).length}
          </Body1>
        </div>
      </div>

      {/* Success message */}
      {replaceCount !== null && (
        <MessageBar intent="success">
          <MessageBarBody>
            Replaced {replaceCount} variable{replaceCount !== 1 ? 's' : ''} in document
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Error */}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {/* Party Information */}
      <div className={styles.partySection}>
        <Body2 style={{ fontWeight: 600 }}>Quick Fill - Party Information</Body2>
        
        {/* Buyer */}
        <div className={styles.partyCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Body1 style={{ fontWeight: 600 }}>Buyer / Client</Body1>
            <div>
              <Button
                size="small"
                appearance="subtle"
                onClick={() => handleLoadPartyDefaults('buyer')}
              >
                Load Saved
              </Button>
              <Button
                size="small"
                appearance="subtle"
                onClick={() => {
                  setSavePartyType('buyer');
                  setShowSaveParty(true);
                }}
              >
                Save
              </Button>
            </div>
          </div>
          <div className={styles.partyFields}>
            <Input
              placeholder="Company Name"
              value={buyerInfo.name}
              onChange={(e, d) => setBuyerInfo((p) => ({ ...p, name: d.value }))}
            />
            <Input
              placeholder="Address"
              value={buyerInfo.address}
              onChange={(e, d) => setBuyerInfo((p) => ({ ...p, address: d.value }))}
            />
            <Input
              placeholder="Contact Person"
              value={buyerInfo.contact}
              onChange={(e, d) => setBuyerInfo((p) => ({ ...p, contact: d.value }))}
            />
            <Input
              placeholder="Email"
              value={buyerInfo.email}
              onChange={(e, d) => setBuyerInfo((p) => ({ ...p, email: d.value }))}
            />
          </div>
          <Button
            appearance="secondary"
            size="small"
            onClick={() => handleApplyPartyInfo('buyer')}
            style={{ marginTop: 8 }}
          >
            Apply to Variables
          </Button>
        </div>

        {/* Seller */}
        <div className={styles.partyCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Body1 style={{ fontWeight: 600 }}>Seller / Vendor</Body1>
            <div>
              <Button
                size="small"
                appearance="subtle"
                onClick={() => handleLoadPartyDefaults('seller')}
              >
                Load Saved
              </Button>
              <Button
                size="small"
                appearance="subtle"
                onClick={() => {
                  setSavePartyType('seller');
                  setShowSaveParty(true);
                }}
              >
                Save
              </Button>
            </div>
          </div>
          <div className={styles.partyFields}>
            <Input
              placeholder="Company Name"
              value={sellerInfo.name}
              onChange={(e, d) => setSellerInfo((p) => ({ ...p, name: d.value }))}
            />
            <Input
              placeholder="Address"
              value={sellerInfo.address}
              onChange={(e, d) => setSellerInfo((p) => ({ ...p, address: d.value }))}
            />
            <Input
              placeholder="Contact Person"
              value={sellerInfo.contact}
              onChange={(e, d) => setSellerInfo((p) => ({ ...p, contact: d.value }))}
            />
            <Input
              placeholder="Email"
              value={sellerInfo.email}
              onChange={(e, d) => setSellerInfo((p) => ({ ...p, email: d.value }))}
            />
          </div>
          <Button
            appearance="secondary"
            size="small"
            onClick={() => handleApplyPartyInfo('seller')}
            style={{ marginTop: 8 }}
          >
            Apply to Variables
          </Button>
        </div>
      </div>

      <Divider />

      {/* Variables List */}
      <Body2 style={{ fontWeight: 600 }}>Document Variables</Body2>
      
      {isScanning ? (
        <div className={styles.loading}>
          <Spinner label="Scanning document..." />
        </div>
      ) : variables.length > 0 ? (
        <>
          {variables.map((variable) => (
            <div key={variable.name} className={styles.variableCard}>
              <div className={styles.variableHeader}>
                <div className={styles.variableName}>
                  {getVariableIcon(variable.name)}
                  <Body1 style={{ fontWeight: 600 }}>{variable.name}</Body1>
                </div>
                <Badge
                  appearance={variable.value ? 'filled' : 'outline'}
                  color={variable.value ? 'success' : 'warning'}
                >
                  {variable.value ? 'Filled' : 'Empty'}
                </Badge>
              </div>
              <Input
                placeholder={`Enter ${variable.name}...`}
                value={variable.value}
                onChange={(e, d) => handleValueChange(variable.name, d.value)}
              />
            </div>
          ))}
        </>
      ) : (
        <div className={styles.empty}>
          <DocumentRegular fontSize={48} />
          <Body1>No variables found in document</Body1>
          <Body2>
            Variables should be formatted as {'{{variableName}}'}
          </Body2>
        </div>
      )}

      {/* Actions */}
      {variables.length > 0 && (
        <div className={styles.actions}>
          <Button
            appearance="primary"
            icon={<ArrowSyncRegular />}
            onClick={handleReplaceAll}
            disabled={isReplacing || variables.filter((v) => v.value).length === 0}
          >
            {isReplacing ? <Spinner size="tiny" /> : 'Replace All'}
          </Button>
        </div>
      )}

      {/* Save Party Dialog */}
      <Dialog open={showSaveParty} onOpenChange={(e, d) => setShowSaveParty(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Save {savePartyType === 'buyer' ? 'Buyer' : 'Seller'} Info</DialogTitle>
            <DialogContent>
              <Body1>
                Save this party information as your default for future contracts?
              </Body1>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowSaveParty(false)}>Cancel</Button>
              <Button appearance="primary" onClick={handleSavePartyDefaults}>
                Save as Default
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
