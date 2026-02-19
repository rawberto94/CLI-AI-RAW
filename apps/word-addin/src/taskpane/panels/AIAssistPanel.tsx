/**
 * AI Assist Panel - AI-powered contract suggestions and analysis
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Title2,
  Body1,
  Body2,
  Button,
  Spinner,
  Textarea,
  Select,
  Badge,
  Divider,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Tooltip,
} from '@fluentui/react-components';
import {
  SparkleRegular,
  LightbulbRegular,
  ShieldCheckmarkRegular,
  DocumentTextRegular,
  TextGrammarArrowLeftRegular,
  CheckmarkCircleRegular,
  WarningRegular,
  ErrorCircleRegular,
  ArrowDownloadRegular,
  CopyRegular,
} from '../../utils/icons';
import { apiClient, AIAssistResponse } from '../../services/api-client';
import { wordService } from '../../services/word-service';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  actionButtons: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: '1 1 calc(50% - 8px)',
    minWidth: '120px',
  },
  contextArea: {
    minHeight: '100px',
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalM,
  },
  suggestionCard: {
    padding: tokens.spacingVerticalS,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  suggestionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalS,
  },
  suggestionText: {
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: 'Georgia, serif',
    lineHeight: '1.6',
    marginBottom: tokens.spacingVerticalS,
  },
  suggestionActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  riskCard: {
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalS,
  },
  riskHigh: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    borderLeft: `4px solid ${tokens.colorPaletteRedBorder1}`,
  },
  riskMedium: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    borderLeft: `4px solid ${tokens.colorPaletteYellowBorder1}`,
  },
  riskLow: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    borderLeft: `4px solid ${tokens.colorPaletteGreenBorder1}`,
  },
  confidenceBar: {
    marginTop: tokens.spacingVerticalS,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalXL,
  },
  empty: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXL,
    color: tokens.colorNeutralForeground3,
  },
});

type AIAction = 'suggest' | 'improve' | 'simplify' | 'risk-check' | 'complete';

const AI_ACTIONS = [
  {
    id: 'suggest' as AIAction,
    label: 'Suggest Clause',
    icon: <LightbulbRegular />,
    description: 'Get AI suggestions for clauses based on context',
  },
  {
    id: 'improve' as AIAction,
    label: 'Improve Text',
    icon: <TextGrammarArrowLeftRegular />,
    description: 'Enhance selected text for clarity and legal precision',
  },
  {
    id: 'risk-check' as AIAction,
    label: 'Check Risks',
    icon: <ShieldCheckmarkRegular />,
    description: 'Analyze text for potential legal risks',
  },
  {
    id: 'complete' as AIAction,
    label: 'Auto-Complete',
    icon: <DocumentTextRegular />,
    description: 'Complete partially written clauses',
  },
];

export const AIAssistPanel: React.FC = () => {
  const styles = useStyles();
  
  const [context, setContext] = useState('');
  const [selectedAction, setSelectedAction] = useState<AIAction | null>(null);
  const [contractType, setContractType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIAssistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get selected text from document
  const handleGetSelection = useCallback(async () => {
    try {
      const selection = await wordService.getSelection();
      if (selection) {
        setContext(selection);
      }
    } catch (err) {
      console.error('Failed to get selection:', err);
    }
  }, []);

  // Execute AI action
  const handleExecuteAction = useCallback(async (action: AIAction) => {
    if (!context.trim()) {
      setError('Please enter or select some text to analyze');
      return;
    }

    setSelectedAction(action);
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.getAIAssist({
        context,
        action,
        contractType: contractType || undefined,
      });

      if (response.success && response.data) {
        setResult(response.data);
      } else {
        throw new Error(response.error?.message || 'AI request failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setIsLoading(false);
    }
  }, [context, contractType]);

  // Insert suggestion into document
  const handleInsertSuggestion = useCallback(async (text: string) => {
    try {
      await wordService.insertText(text);
    } catch (err) {
      console.error('Failed to insert text:', err);
    }
  }, []);

  // Copy to clipboard
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const getRiskStyle = (level: string) => {
    switch (level) {
      case 'HIGH':
      case 'CRITICAL':
        return styles.riskHigh;
      case 'MEDIUM':
        return styles.riskMedium;
      default:
        return styles.riskLow;
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'HIGH':
      case 'CRITICAL':
        return <ErrorCircleRegular />;
      case 'MEDIUM':
        return <WarningRegular />;
      default:
        return <CheckmarkCircleRegular />;
    }
  };

  return (
    <div className={styles.root}>
      {/* Header */}
      <Title2>AI Assistant</Title2>
      <Body1>
        Get AI-powered suggestions, improvements, and risk analysis for your contracts.
      </Body1>

      <Divider />

      {/* Context Input */}
      <div className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Body2 style={{ fontWeight: 600 }}>Context / Selected Text</Body2>
          <Button
            appearance="subtle"
            size="small"
            onClick={handleGetSelection}
          >
            Get Selection
          </Button>
        </div>
        <Textarea
          className={styles.contextArea}
          placeholder="Enter text or select from document..."
          value={context}
          onChange={(e, data) => setContext(data.value)}
          resize="vertical"
        />
      </div>

      {/* Contract Type (optional) */}
      <Select
        value={contractType}
        onChange={(e, data) => setContractType(data.value)}
      >
        <option value="">Contract Type (optional)</option>
        <option value="MSA">Master Service Agreement</option>
        <option value="SOW">Statement of Work</option>
        <option value="NDA">Non-Disclosure Agreement</option>
        <option value="SLA">Service Level Agreement</option>
        <option value="LICENSE">License Agreement</option>
      </Select>

      {/* Action Buttons */}
      <div className={styles.section}>
        <Body2 style={{ fontWeight: 600 }}>What would you like to do?</Body2>
        <div className={styles.actionButtons}>
          {AI_ACTIONS.map((action) => (
            <Tooltip
              key={action.id}
              content={action.description}
              relationship="description"
            >
              <Button
                className={styles.actionButton}
                appearance={selectedAction === action.id ? 'primary' : 'secondary'}
                icon={action.icon}
                onClick={() => handleExecuteAction(action.id)}
                disabled={isLoading}
              >
                {action.label}
              </Button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {/* Loading */}
      {isLoading && (
        <div className={styles.loading}>
          <Spinner label="AI is analyzing..." />
          <Body2>This may take a few seconds</Body2>
        </div>
      )}

      {/* Results */}
      {result && !isLoading && (
        <div className={styles.results}>
          {/* Confidence indicator */}
          <div>
            <Body2>AI Confidence: {Math.round(result.confidence * 100)}%</Body2>
            <ProgressBar
              className={styles.confidenceBar}
              value={result.confidence}
              max={1}
              color={result.confidence > 0.8 ? 'success' : result.confidence > 0.5 ? 'warning' : 'error'}
            />
          </div>

          {/* Risk flags */}
          {result.riskFlags && result.riskFlags.length > 0 && (
            <div className={styles.section}>
              <Body2 style={{ fontWeight: 600 }}>Risk Flags</Body2>
              {result.riskFlags.map((risk, index) => (
                <div
                  key={index}
                  className={`${styles.riskCard} ${getRiskStyle(risk.risk)}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {getRiskIcon(risk.risk)}
                    <Badge
                      appearance="filled"
                      color={risk.risk === 'HIGH' || risk.risk === 'CRITICAL' ? 'danger' : risk.risk === 'MEDIUM' ? 'warning' : 'success'}
                    >
                      {risk.risk}
                    </Badge>
                  </div>
                  <Body1 style={{ fontWeight: 600 }}>{risk.text}</Body1>
                  <Body2>{risk.explanation}</Body2>
                  {risk.suggestion && (
                    <div style={{ marginTop: 8 }}>
                      <Body2 style={{ fontWeight: 600 }}>Suggestion:</Body2>
                      <Body2>{risk.suggestion}</Body2>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions && result.suggestions.length > 0 && (
            <div className={styles.section}>
              <Body2 style={{ fontWeight: 600 }}>Suggestions</Body2>
              {result.suggestions.map((suggestion) => (
                <div key={suggestion.id} className={styles.suggestionCard}>
                  <div className={styles.suggestionHeader}>
                    <Badge appearance="outline">{suggestion.type}</Badge>
                    <Body2>{Math.round(suggestion.confidence * 100)}% match</Body2>
                  </div>
                  <div className={styles.suggestionText}>
                    {suggestion.text}
                  </div>
                  <Body2>{suggestion.explanation}</Body2>
                  <div className={styles.suggestionActions}>
                    <Button
                      appearance="primary"
                      icon={<ArrowDownloadRegular />}
                      onClick={() => handleInsertSuggestion(suggestion.text)}
                      size="small"
                    >
                      Insert
                    </Button>
                    <Button
                      appearance="subtle"
                      icon={<CopyRegular />}
                      onClick={() => handleCopy(suggestion.text)}
                      size="small"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !result && !error && (
        <div className={styles.empty}>
          <SparkleRegular fontSize={48} />
          <Body1>
            Select some text or enter context above, then choose an action to get AI assistance.
          </Body1>
        </div>
      )}
    </div>
  );
};
