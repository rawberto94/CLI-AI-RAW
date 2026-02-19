/**
 * AI Assist Panel — Agentic contract drafting assistant
 *
 * Key capabilities:
 *   1. "Review Document" — reads the entire document, detects contract type,
 *      analyzes structure, flags risks, suggests improvements.
 *   2. Quick actions — suggest/improve/risk-check/complete on selected text.
 *   3. Auto-context — on mount, scans the document to pre-fill context.
 *   4. One-click apply — insert suggestions directly into the document.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  makeStyles,
  tokens,
  Title2,
  Body1,
  Body2,
  Caption1,
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
  Card,
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
  DocumentSearchRegular,
  BotSparkleRegular,
} from '../../utils/icons';
import { apiClient, AIAssistResponse, DocumentReview } from '../../services/api-client';
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
  agentBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorBrandStroke1}`,
  },
  reviewButton: {
    width: '100%',
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
    minHeight: '80px',
  },
  contextHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalM,
  },
  scoreCard: {
    padding: tokens.spacingVerticalM,
    textAlign: 'center' as const,
  },
  scoreValue: {
    fontSize: '36px',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  structureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  missingSection: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorPaletteYellowBackground1,
    borderRadius: tokens.borderRadiusSmall,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    textAlign: 'center' as const,
    padding: tokens.spacingVerticalXL,
    color: tokens.colorNeutralForeground3,
  },
  docInfo: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  tabBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    paddingBottom: tokens.spacingVerticalXS,
  },
});

type AIAction = 'suggest' | 'improve' | 'simplify' | 'risk-check' | 'complete';
type ViewMode = 'agent' | 'quick';

const AI_ACTIONS: Array<{
  id: AIAction;
  label: string;
  icon: React.ReactElement;
  description: string;
}> = [
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

  // --- View mode ---
  const [viewMode, setViewMode] = useState<ViewMode>('agent');

  // --- Document context (auto-detected) ---
  const [docStats, setDocStats] = useState<{ wordCount: number; paragraphCount: number; pageCount: number } | null>(null);
  const [detectedType, setDetectedType] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // --- Quick-action state ---
  const [context, setContext] = useState('');
  const [selectedAction, setSelectedAction] = useState<AIAction | null>(null);
  const [contractType, setContractType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AIAssistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Full-document review state ---
  const [isReviewing, setIsReviewing] = useState(false);
  const [review, setReview] = useState<DocumentReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // --- Auto-scan on mount ---
  useEffect(() => {
    let cancelled = false;
    const scan = async () => {
      setIsScanning(true);
      try {
        const stats = await wordService.getDocumentStats();
        if (cancelled) return;
        setDocStats(stats);

        // Try to detect contract type from headings
        if (stats.wordCount > 10) {
          const headings = await wordService.getDocumentHeadings();
          if (cancelled) return;
          const headingText = headings.map((h) => h.text).join(' ').toLowerCase();
          if (headingText.includes('non-disclosure') || headingText.includes('confidential')) {
            setDetectedType('NDA');
          } else if (headingText.includes('service agreement') || headingText.includes('master agreement')) {
            setDetectedType('MSA');
          } else if (headingText.includes('statement of work') || headingText.includes('scope of work')) {
            setDetectedType('SOW');
          } else if (headingText.includes('service level') || headingText.includes('sla')) {
            setDetectedType('SLA');
          } else if (headingText.includes('employment') || headingText.includes('offer letter')) {
            setDetectedType('EMPLOYMENT');
          } else if (headingText.includes('license')) {
            setDetectedType('LICENSE');
          }
        }
      } catch (err) {
        console.error('Auto-scan failed:', err);
      } finally {
        if (!cancelled) setIsScanning(false);
      }
    };
    scan();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync detected type to quick-action dropdown
  useEffect(() => {
    if (detectedType && !contractType) {
      setContractType(detectedType);
    }
  }, [detectedType, contractType]);

  // --- Handlers: Quick Actions ---
  const handleGetSelection = useCallback(async () => {
    try {
      const selection = await wordService.getSelection();
      if (selection) setContext(selection);
    } catch (err) {
      console.error('Failed to get selection:', err);
    }
  }, []);

  const handleGetFullDocument = useCallback(async () => {
    try {
      const body = await wordService.getDocumentBody();
      if (body) setContext(body.slice(0, 5000));
    } catch (err) {
      console.error('Failed to get document body:', err);
    }
  }, []);

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

  const handleInsertSuggestion = useCallback(async (text: string) => {
    try {
      await wordService.insertText(text);
    } catch (err) {
      console.error('Failed to insert text:', err);
    }
  }, []);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // --- Handler: Full Document Review (the agentic part) ---
  const handleReviewDocument = useCallback(async () => {
    setIsReviewing(true);
    setReviewError(null);
    setReview(null);

    try {
      const [body, headings, stats] = await Promise.all([
        wordService.getDocumentBody(),
        wordService.getDocumentHeadings(),
        wordService.getDocumentStats(),
      ]);

      setDocStats(stats);

      if (!body || body.trim().length < 20) {
        throw new Error('Document is too short to review. Write or paste a contract first.');
      }

      const response = await apiClient.reviewDocument({
        documentText: body,
        headings,
        contractType: contractType || detectedType || undefined,
        wordCount: stats.wordCount,
      });

      if (response.success && response.data) {
        setReview(response.data);
        if (response.data.detectedType) {
          setDetectedType(response.data.detectedType);
        }
      } else {
        throw new Error(response.error?.message || 'Review failed');
      }
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setIsReviewing(false);
    }
  }, [contractType, detectedType]);

  // --- Helpers ---
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return tokens.colorPaletteGreenForeground1;
    if (score >= 60) return tokens.colorPaletteYellowForeground1;
    return tokens.colorPaletteRedForeground1;
  };

  return (
    <div className={styles.root}>
      {/* Header */}
      <Title2>AI Drafting Agent</Title2>

      {/* Agent banner */}
      <div className={styles.agentBanner}>
        <BotSparkleRegular />
        <div>
          <Body2 style={{ fontWeight: 600 }}>Agentic Contract Assistant</Body2>
          <Caption1>Reads your entire document, detects issues, suggests improvements</Caption1>
        </div>
      </div>

      {/* Document context info (auto-scanned) */}
      {docStats && (
        <div className={styles.docInfo}>
          <Caption1>{docStats.wordCount} words</Caption1>
          <Caption1>{docStats.paragraphCount} paragraphs</Caption1>
          <Caption1>~{docStats.pageCount} pages</Caption1>
          {detectedType && (
            <Badge appearance="outline" color="informative" size="small">
              {detectedType}
            </Badge>
          )}
          {isScanning && <Spinner size="extra-tiny" />}
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <Button
          appearance={viewMode === 'agent' ? 'primary' : 'subtle'}
          size="small"
          icon={<DocumentSearchRegular />}
          onClick={() => setViewMode('agent')}
        >
          Full Review
        </Button>
        <Button
          appearance={viewMode === 'quick' ? 'primary' : 'subtle'}
          size="small"
          icon={<SparkleRegular />}
          onClick={() => setViewMode('quick')}
        >
          Quick Actions
        </Button>
      </div>

      <Divider />

      {/* ================================================================= */}
      {/* AGENT MODE — Full Document Review */}
      {/* ================================================================= */}
      {viewMode === 'agent' && (
        <>
          {/* Contract type selector */}
          <Select
            value={contractType}
            onChange={(_, data) => setContractType(data.value)}
          >
            <option value="">Contract Type ({detectedType || 'auto-detect'})</option>
            <option value="MSA">Master Service Agreement</option>
            <option value="SOW">Statement of Work</option>
            <option value="NDA">Non-Disclosure Agreement</option>
            <option value="SLA">Service Level Agreement</option>
            <option value="LICENSE">License Agreement</option>
            <option value="EMPLOYMENT">Employment Agreement</option>
            <option value="AMENDMENT">Amendment</option>
          </Select>

          {/* Review button */}
          <Tooltip
            content="Reads your entire Word document and performs a comprehensive AI review"
            relationship="description"
          >
            <Button
              className={styles.reviewButton}
              appearance="primary"
              icon={isReviewing ? <Spinner size="tiny" /> : <DocumentSearchRegular />}
              onClick={handleReviewDocument}
              disabled={isReviewing}
              size="large"
            >
              {isReviewing ? 'Reviewing document...' : 'Review Entire Document'}
            </Button>
          </Tooltip>

          {/* Review loading */}
          {isReviewing && (
            <div className={styles.loading}>
              <Spinner label="AI is reading your entire document..." />
              <Body2>Analyzing structure, risks, and completeness...</Body2>
            </div>
          )}

          {/* Review error */}
          {reviewError && (
            <MessageBar intent="error">
              <MessageBarBody>{reviewError}</MessageBarBody>
            </MessageBar>
          )}

          {/* Review results */}
          {review && !isReviewing && (
            <div className={styles.results}>
              {/* Completeness score */}
              <Card className={styles.scoreCard}>
                <div
                  className={styles.scoreValue}
                  style={{ color: getScoreColor(review.completenessScore) }}
                >
                  {review.completenessScore}/100
                </div>
                <Body2>Completeness Score</Body2>
                <ProgressBar
                  value={review.completenessScore}
                  max={100}
                  color={review.completenessScore >= 80 ? 'success' : review.completenessScore >= 60 ? 'warning' : 'error'}
                  style={{ marginTop: 8 }}
                />
                <div style={{ marginTop: 8 }}>
                  <Badge appearance="outline" color="informative">
                    Detected: {review.detectedType}
                  </Badge>
                </div>
              </Card>

              {/* Executive summary */}
              <div className={styles.section}>
                <Body2 style={{ fontWeight: 600 }}>Summary</Body2>
                <Body1>{review.summary}</Body1>
              </div>

              {/* Missing sections */}
              {review.structure.missingRecommended.length > 0 && (
                <div className={styles.section}>
                  <Body2 style={{ fontWeight: 600 }}>
                    Missing Sections ({review.structure.missingRecommended.length})
                  </Body2>
                  <div className={styles.structureList}>
                    {review.structure.missingRecommended.map((section, idx) => (
                      <div key={idx} className={styles.missingSection}>
                        <Body2>{section}</Body2>
                        <Tooltip content={`Ask AI to generate a "${section}" clause`} relationship="label">
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<SparkleRegular />}
                            onClick={() => {
                              setContext(`Generate a "${section}" section for a ${review.detectedType || 'contract'}`);
                              setSelectedAction('suggest');
                              setViewMode('quick');
                            }}
                          >
                            Generate
                          </Button>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sections found */}
              {review.structure.sectionsFound.length > 0 && (
                <div className={styles.section}>
                  <Body2 style={{ fontWeight: 600 }}>
                    Sections Found ({review.structure.sectionsFound.length})
                  </Body2>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {review.structure.sectionsFound.map((section, idx) => (
                      <Badge key={idx} appearance="outline" color="subtle" size="small">
                        {section}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk flags */}
              {review.risks.length > 0 && (
                <div className={styles.section}>
                  <Body2 style={{ fontWeight: 600 }}>
                    Risk Flags ({review.risks.length})
                  </Body2>
                  {review.risks.map((risk, index) => (
                    <div
                      key={index}
                      className={`${styles.riskCard} ${getRiskStyle(risk.risk)}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {getRiskIcon(risk.risk)}
                        <Badge
                          appearance="filled"
                          color={
                            risk.risk === 'HIGH' || risk.risk === 'CRITICAL'
                              ? 'danger'
                              : risk.risk === 'MEDIUM'
                                ? 'warning'
                                : 'success'
                          }
                          size="small"
                        >
                          {risk.risk}
                        </Badge>
                        {risk.section && (
                          <Caption1>{risk.section}</Caption1>
                        )}
                      </div>
                      <Body2 style={{ fontWeight: 600 }}>{risk.text}</Body2>
                      <Body2>{risk.explanation}</Body2>
                      {risk.suggestion && (
                        <div style={{ marginTop: 6 }}>
                          <Caption1 style={{ fontWeight: 600 }}>Fix:</Caption1>
                          <Body2> {risk.suggestion}</Body2>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Improvement suggestions */}
              {review.suggestions.length > 0 && (
                <div className={styles.section}>
                  <Body2 style={{ fontWeight: 600 }}>
                    Improvements ({review.suggestions.length})
                  </Body2>
                  {review.suggestions.map((suggestion) => (
                    <div key={suggestion.id} className={styles.suggestionCard}>
                      <div className={styles.suggestionHeader}>
                        <Badge appearance="outline" size="small">
                          {suggestion.type}
                        </Badge>
                        <Caption1>{suggestion.section}</Caption1>
                      </div>
                      {suggestion.text && (
                        <div className={styles.suggestionText}>
                          {suggestion.text}
                        </div>
                      )}
                      <Body2>{suggestion.explanation}</Body2>
                      <div className={styles.suggestionActions}>
                        {suggestion.text && (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isReviewing && !review && !reviewError && (
            <div className={styles.empty}>
              <DocumentSearchRegular />
              <Body1>
                Click &ldquo;Review Entire Document&rdquo; to have the AI agent read your contract
                and provide a comprehensive analysis.
              </Body1>
              <Caption1 style={{ marginTop: 8 }}>
                The agent will auto-detect the contract type, flag risks, identify missing sections,
                and suggest improvements.
              </Caption1>
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* QUICK MODE — Selection-based actions */}
      {/* ================================================================= */}
      {viewMode === 'quick' && (
        <>
          {/* Context Input */}
          <div className={styles.section}>
            <div className={styles.contextHeader}>
              <Body2 style={{ fontWeight: 600 }}>Context / Selected Text</Body2>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button appearance="subtle" size="small" onClick={handleGetSelection}>
                  Selection
                </Button>
                <Button appearance="subtle" size="small" onClick={handleGetFullDocument}>
                  Full Doc
                </Button>
              </div>
            </div>
            <Textarea
              className={styles.contextArea}
              placeholder="Enter text, get selection, or pull full document..."
              value={context}
              onChange={(_, data) => setContext(data.value)}
              resize="vertical"
            />
            {context && (
              <Caption1>{context.split(/\s+/).filter(Boolean).length} words loaded</Caption1>
            )}
          </div>

          {/* Contract Type */}
          <Select
            value={contractType}
            onChange={(_, data) => setContractType(data.value)}
          >
            <option value="">Contract Type ({detectedType || 'optional'})</option>
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

          {/* Quick Results */}
          {result && !isLoading && (
            <div className={styles.results}>
              {/* Confidence */}
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
                          color={
                            risk.risk === 'HIGH' || risk.risk === 'CRITICAL'
                              ? 'danger'
                              : risk.risk === 'MEDIUM'
                                ? 'warning'
                                : 'success'
                          }
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
              <SparkleRegular />
              <Body1>
                Select some text or enter context above, then choose an action.
              </Body1>
            </div>
          )}
        </>
      )}
    </div>
  );
};
