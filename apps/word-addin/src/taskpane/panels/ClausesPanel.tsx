/**
 * Clauses Panel - Browse and insert pre-approved clauses
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Title2,
  Body1,
  Body2,
  Button,
  Spinner,
  Input,
  Select,
  Badge,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  MessageBar,
  MessageBarBody,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import {
  SearchRegular,
  AddRegular,
  DocumentCopyRegular,
  InfoRegular,
  WarningRegular,
  ErrorCircleRegular,
  CheckmarkCircleRegular,
  MoreHorizontalRegular,
  ArrowSwapRegular,
} from '@fluentui/react-icons';
import { apiClient, Clause, ClauseAlternative } from '../../services/api-client';
import { wordService } from '../../services/word-service';

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
  filters: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '150px',
  },
  clauseCard: {
    marginBottom: tokens.spacingVerticalS,
  },
  clauseHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    width: '100%',
  },
  clauseTitle: {
    flex: 1,
  },
  clauseContent: {
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    marginTop: tokens.spacingVerticalS,
    fontFamily: 'Georgia, serif',
    lineHeight: '1.6',
  },
  clauseActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
  riskBadge: {
    marginLeft: 'auto',
  },
  tags: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalS,
  },
  alternativeList: {
    marginTop: tokens.spacingVerticalM,
  },
  alternativeItem: {
    padding: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
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
  guidance: {
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    marginTop: tokens.spacingVerticalS,
  },
});

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'liability', label: 'Liability & Indemnification' },
  { value: 'termination', label: 'Termination' },
  { value: 'payment', label: 'Payment Terms' },
  { value: 'confidentiality', label: 'Confidentiality' },
  { value: 'ip', label: 'Intellectual Property' },
  { value: 'warranty', label: 'Warranties' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'data-protection', label: 'Data Protection' },
  { value: 'force-majeure', label: 'Force Majeure' },
  { value: 'dispute', label: 'Dispute Resolution' },
];

const RISK_LEVELS = [
  { value: '', label: 'All Risk Levels' },
  { value: 'LOW', label: 'Low Risk' },
  { value: 'MEDIUM', label: 'Medium Risk' },
  { value: 'HIGH', label: 'High Risk' },
  { value: 'CRITICAL', label: 'Critical Risk' },
];

const getRiskIcon = (level: string) => {
  switch (level) {
    case 'LOW':
      return <CheckmarkCircleRegular />;
    case 'MEDIUM':
      return <InfoRegular />;
    case 'HIGH':
      return <WarningRegular />;
    case 'CRITICAL':
      return <ErrorCircleRegular />;
    default:
      return <InfoRegular />;
  }
};

const getRiskColor = (level: string): 'success' | 'warning' | 'danger' | 'informative' => {
  switch (level) {
    case 'LOW':
      return 'success';
    case 'MEDIUM':
      return 'informative';
    case 'HIGH':
      return 'warning';
    case 'CRITICAL':
      return 'danger';
    default:
      return 'informative';
  }
};

export const ClausesPanel: React.FC = () => {
  const styles = useStyles();
  
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<ClauseAlternative[]>([]);
  const [isInserting, setIsInserting] = useState(false);
  const [insertSuccess, setInsertSuccess] = useState(false);

  // Fetch clauses
  const { data: clauses, isLoading, error: fetchError } = useQuery({
    queryKey: ['clauses', category, riskLevel, search],
    queryFn: async () => {
      const result = await apiClient.getClauses({
        category: category || undefined,
        riskLevel: riskLevel || undefined,
        search: search || undefined,
      });
      if (result.success) return result.data;
      throw new Error(result.error?.message || 'Failed to fetch clauses');
    },
  });

  // Insert clause into document
  const handleInsertClause = useCallback(async (clause: Clause) => {
    setIsInserting(true);
    setInsertSuccess(false);
    
    try {
      await wordService.insertClause({
        title: clause.name,
        content: clause.content,
      });
      setInsertSuccess(true);
      setTimeout(() => setInsertSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to insert clause:', error);
    } finally {
      setIsInserting(false);
    }
  }, []);

  // View alternatives
  const handleViewAlternatives = useCallback(async (clause: Clause) => {
    setSelectedClause(clause);
    setShowAlternatives(true);
    
    const result = await apiClient.getClauseAlternatives(clause.id);
    if (result.success && result.data) {
      setAlternatives(result.data);
    }
  }, []);

  // Render loading state
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading clauses..." />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <Title2>Clause Library</Title2>
        <Button icon={<AddRegular />} appearance="subtle">
          New
        </Button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <Input
          className={styles.searchInput}
          contentBefore={<SearchRegular />}
          placeholder="Search clauses..."
          value={search}
          onChange={(e, data) => setSearch(data.value)}
        />
        <Select
          value={category}
          onChange={(e, data) => setCategory(data.value)}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </Select>
        <Select
          value={riskLevel}
          onChange={(e, data) => setRiskLevel(data.value)}
        >
          {RISK_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Success message */}
      {insertSuccess && (
        <MessageBar intent="success">
          <MessageBarBody>Clause inserted successfully!</MessageBarBody>
        </MessageBar>
      )}

      {/* Error message */}
      {fetchError && (
        <MessageBar intent="error">
          <MessageBarBody>
            {fetchError instanceof Error ? fetchError.message : 'Failed to load clauses'}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Clauses list */}
      {clauses && clauses.length > 0 ? (
        <Accordion collapsible>
          {clauses.map((clause) => (
            <AccordionItem key={clause.id} value={clause.id}>
              <AccordionHeader>
                <div className={styles.clauseHeader}>
                  <span className={styles.clauseTitle}>{clause.name}</span>
                  <Badge
                    className={styles.riskBadge}
                    appearance="filled"
                    color={getRiskColor(clause.riskLevel)}
                    icon={getRiskIcon(clause.riskLevel)}
                  >
                    {clause.riskLevel}
                  </Badge>
                </div>
              </AccordionHeader>
              <AccordionPanel>
                <Body2>{clause.category}</Body2>
                
                <div className={styles.clauseContent}>
                  {clause.content}
                </div>

                {clause.guidance && (
                  <div className={styles.guidance}>
                    <Body2 weight="semibold">Usage Guidance:</Body2>
                    <Body1>{clause.guidance}</Body1>
                  </div>
                )}

                <div className={styles.tags}>
                  {clause.tags.map((tag) => (
                    <Badge key={tag} appearance="outline" size="small">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className={styles.clauseActions}>
                  <Button
                    appearance="primary"
                    icon={<DocumentCopyRegular />}
                    onClick={() => handleInsertClause(clause)}
                    disabled={isInserting}
                  >
                    Insert
                  </Button>
                  {clause.alternatives && clause.alternatives.length > 0 && (
                    <Button
                      appearance="secondary"
                      icon={<ArrowSwapRegular />}
                      onClick={() => handleViewAlternatives(clause)}
                    >
                      Alternatives ({clause.alternatives.length})
                    </Button>
                  )}
                  <Menu>
                    <MenuTrigger>
                      <Button
                        appearance="subtle"
                        icon={<MoreHorizontalRegular />}
                      />
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem>Copy to clipboard</MenuItem>
                        <MenuItem>View history</MenuItem>
                        <MenuItem>Report issue</MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                </div>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className={styles.empty}>
          <DocumentCopyRegular fontSize={48} />
          <Body1>No clauses found</Body1>
        </div>
      )}

      {/* Alternatives Dialog */}
      <Dialog
        open={showAlternatives}
        onOpenChange={(e, data) => !data.open && setShowAlternatives(false)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              Alternative Clauses: {selectedClause?.name}
            </DialogTitle>
            <DialogContent>
              <div className={styles.alternativeList}>
                {alternatives.map((alt) => (
                  <div key={alt.id} className={styles.alternativeItem}>
                    <div className={styles.clauseHeader}>
                      <Body1 weight="semibold">{alt.name}</Body1>
                      <Badge
                        appearance="filled"
                        color={getRiskColor(alt.riskLevel)}
                      >
                        {alt.riskLevel}
                      </Badge>
                    </div>
                    <Body2>{alt.useCase}</Body2>
                    <div className={styles.clauseContent}>
                      {alt.content}
                    </div>
                    <Button
                      appearance="secondary"
                      icon={<DocumentCopyRegular />}
                      onClick={() => {
                        wordService.insertText(alt.content);
                        setShowAlternatives(false);
                      }}
                      style={{ marginTop: 8 }}
                    >
                      Insert This Version
                    </Button>
                  </div>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowAlternatives(false)}>
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};
