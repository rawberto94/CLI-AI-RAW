/**
 * Intelligent Document Analysis API
 * 
 * Provides comprehensive AI-powered document analysis that goes beyond
 * standard template-based extraction to discover all important information.
 * 
 * Enhanced with:
 * - Multi-pass extraction (pattern → AI → validation)
 * - Confidence calibration with evidence
 * - Cross-field validation
 * - Self-correction mechanism
 * - Contract-type aware extraction
 * - Industry benchmark comparison
 * - Extraction learning from feedback
 * - Smart fallback chain
 * - Clause-level extraction and analysis
 * - Template detection and optimization
 * - Smart auto-correction of values
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Import advanced intelligence services (lazy loaded for edge compatibility)
let advancedIntelligence: any = null;
let extractionLearning: any = null;
let clauseLevelExtraction: any = null;
let templateDetection: any = null;
let smartAutoCorrection: any = null;

async function getAdvancedIntelligence() {
  if (!advancedIntelligence) {
    try {
      const services = await import('data-orchestration/services');
      advancedIntelligence = services.advancedExtractionIntelligence;
    } catch {
      // Service not available
    }
  }
  return advancedIntelligence;
}

async function getExtractionLearning() {
  if (!extractionLearning) {
    try {
      const services = await import('data-orchestration/services');
      extractionLearning = services.extractionLearning;
    } catch {
      // Service not available
    }
  }
  return extractionLearning;
}

async function getClauseLevelExtraction() {
  if (!clauseLevelExtraction) {
    try {
      const services = await import('data-orchestration/services');
      clauseLevelExtraction = services.clauseLevelExtractionService;
    } catch {
      // Service not available
    }
  }
  return clauseLevelExtraction;
}

async function getTemplateDetection() {
  if (!templateDetection) {
    try {
      const services = await import('data-orchestration/services');
      templateDetection = services.templateDetectionService;
    } catch {
      // Service not available
    }
  }
  return templateDetection;
}

async function getSmartAutoCorrection() {
  if (!smartAutoCorrection) {
    try {
      const services = await import('data-orchestration/services');
      smartAutoCorrection = services.smartAutoCorrectionService;
    } catch {
      // Service not available
    }
  }
  return smartAutoCorrection;
}

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisRequest {
  documentText: string;
  contractId?: string;
  contractType?: string; // Optional hint for contract type
  industry?: string; // Optional industry context
  options?: {
    skipRiskAnalysis?: boolean;
    skipNegotiationAnalysis?: boolean;
    skipComplianceCheck?: boolean;
    maxFieldsToDiscover?: number;
    targetConfidence?: number;
    enableBenchmarking?: boolean; // Compare to industry benchmarks
    enableLearning?: boolean; // Track for learning
    enableClauseAnalysis?: boolean; // Perform clause-level extraction
    enableTemplateDetection?: boolean; // Detect contract templates
    enableAutoCorrection?: boolean; // Apply smart auto-correction
  };
}

interface DiscoveredField {
  fieldName: string;
  displayName: string;
  value: any;
  valueType: string;
  confidence: number;
  source: string;
  sourceSection: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  isStandardField: boolean;
  suggestedMetadataField?: string;
  explanation: string;
}

interface DocumentInsight {
  id: string;
  type: 'observation' | 'warning' | 'opportunity' | 'recommendation' | 'question';
  category: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  actionable: boolean;
  suggestedAction?: string;
  confidence: number;
}

interface RiskSignal {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  likelihood: string;
  financialImpact?: {
    amount?: number;
    type: string;
    currency?: string;
  };
  sourceClause: string;
  mitigationSuggestion: string;
  requiresReview: boolean;
}

interface NegotiationOpportunity {
  id: string;
  type: string;
  title: string;
  description: string;
  currentTerm: string;
  suggestedAlternative: string;
  priority: 'high' | 'medium' | 'low';
  potentialBenefit: string;
  negotiationTip: string;
}

// ============================================================================
// INTELLIGENT ANALYSIS PROMPTS
// ============================================================================

const COMPREHENSIVE_ANALYSIS_PROMPT = `You are an expert contract analyst with deep expertise in legal document analysis, risk assessment, and contract management.

Your task is to perform a COMPREHENSIVE analysis of this contract document. Go beyond standard templates - discover ALL important information that would be valuable for managing this contract.

## Analysis Requirements:

### 1. Document Understanding
- Identify the exact contract type and subtype
- Detect if this is a template, amendment, or exhibit
- Identify the industry and jurisdiction
- Assess document quality and completeness

### 2. Intelligent Field Discovery
Extract ALL important data points including but not limited to:
- Every date, deadline, and milestone
- All monetary values, fees, rates, and financial terms
- Specific performance metrics and SLAs
- Named individuals and their roles
- Products, services, or deliverables mentioned
- Thresholds, limits, caps, and minimums
- Locations and jurisdictions
- Unique or unusual terms
- Key performance indicators
- Pricing tiers or volume discounts
- Penalty clauses and triggers
- Insurance requirements
- Specific compliance requirements
- Renewal and termination conditions
- Change control procedures
- Escalation paths

### 3. Risk Analysis
Identify ALL risks including:
- Liability exposure (unlimited, capped, uncapped)
- One-sided terms
- Hidden auto-renewals
- Unfavorable termination conditions
- IP ownership issues
- Data handling risks
- Compliance gaps
- Vendor lock-in provisions
- Performance penalty triggers
- Force majeure limitations

### 4. Strategic Insights
Provide insights on:
- What makes this contract unique
- Hidden obligations
- Potential cost savings
- Negotiation leverage points
- Missing protections
- Industry standard comparisons

### 5. Recommendations
Generate actionable recommendations prioritized by urgency.

Return a comprehensive JSON analysis.`;

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: AnalysisRequest = await request.json();
    const { documentText, contractId, contractType: hintedContractType, industry, options = {} } = body;

    if (!documentText || documentText.trim().length < 100) {
      return NextResponse.json(
        { error: 'Document text is required and must be at least 100 characters' },
        { status: 400 }
      );
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Load advanced services
    const intelligence = await getAdvancedIntelligence();
    const learning = options.enableLearning !== false ? await getExtractionLearning() : null;
    const clauseExtractor = options.enableClauseAnalysis !== false ? await getClauseLevelExtraction() : null;
    const templateDetector = options.enableTemplateDetection !== false ? await getTemplateDetection() : null;
    const autoCorrector = options.enableAutoCorrection !== false ? await getSmartAutoCorrection() : null;

    // Start learning session if available
    let learningSessionId: string | undefined;
    if (learning && contractId) {
      learningSessionId = learning.startSession(contractId, hintedContractType);
    }

    // Truncate document if too long
    const maxLength = 80000;
    const textToAnalyze = documentText.length > maxLength 
      ? documentText.substring(0, maxLength) + '\n\n[Document truncated for analysis]'
      : documentText;

    // Phase 0: Template Detection (if available)
    let templateMatch: any = null;
    let extractionOptimization: any = null;
    if (templateDetector) {
      try {
        const templateResult = templateDetector.detectTemplate(textToAnalyze);
        if (templateResult.detected) {
          templateMatch = {
            detected: true,
            templateId: templateResult.match?.signature.id,
            templateName: templateResult.match?.signature.name,
            templateFamily: templateResult.match?.signature.family,
            confidence: templateResult.match?.confidence,
            deviations: templateResult.match?.deviations,
            customizations: templateResult.match?.customizations,
            isModified: templateResult.isModified,
          };
          extractionOptimization = templateDetector.getExtractionOptimization(templateResult.match!);
        } else {
          templateMatch = {
            detected: false,
            alternativeMatches: templateResult.alternativeMatches.slice(0, 3).map((m: any) => ({
              name: m.signature.name,
              confidence: m.confidence,
            })),
          };
        }
      } catch {
        // Template detection failed
      }
    }

    // Phase 1: Document Type Detection
    const documentTypeResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Analyze this document and determine its type. Return JSON:
{
  "primaryType": "Contract type name",
  "subType": "More specific type",
  "confidence": 0.0-1.0,
  "industry": "Industry if detectable",
  "jurisdiction": "Governing law if stated",
  "isTemplate": boolean,
  "isAmendment": boolean,
  "isExhibit": boolean,
  "formality": "formal|semi-formal|informal",
  "estimatedComplexity": "simple|moderate|complex"
}`
        },
        {
          role: 'user',
          content: `Analyze:\n\n${textToAnalyze.substring(0, 8000)}`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 500
    });

    const documentType = JSON.parse(documentTypeResponse.choices[0]?.message?.content || '{}');

    // Get contract type profile and extraction hints
    let extractionHints: any = null;
    let contractTypeProfile: any = null;
    const detectedContractType = hintedContractType || documentType.primaryType;
    
    if (intelligence && detectedContractType) {
      contractTypeProfile = intelligence.getContractTypeProfile(detectedContractType);
      extractionHints = intelligence.getExtractionHints(detectedContractType);
    }

    // Phase 2: Comprehensive Field Discovery (enhanced with type-specific hints)
    const typeSpecificPrompt = extractionHints ? `
IMPORTANT: This is a ${detectedContractType}. Pay special attention to these critical fields:
${extractionHints.criticalFields?.map((f: string) => `- ${f}`).join('\n') || ''}

Expected sections to look for:
${extractionHints.expectedSections?.map((s: string) => `- ${s}`).join('\n') || ''}
` : '';

    const fieldsResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert contract analyst. Extract ALL important data points from this ${documentType.primaryType || 'contract'}.
${typeSpecificPrompt}
Go beyond standard fields - discover EVERYTHING valuable for contract management:
- All dates, deadlines, milestones
- All monetary values and financial terms
- Performance metrics and SLAs
- Named individuals and roles
- Products, services, deliverables
- Thresholds, limits, caps
- Unique terms and conditions
- Penalty clauses
- Insurance requirements
- Compliance requirements

Return JSON:
{
  "fields": [
    {
      "fieldName": "snake_case_id",
      "displayName": "Human Name",
      "value": "extracted value",
      "valueType": "string|number|date|currency|duration|percentage|boolean|list",
      "confidence": 0.0-1.0,
      "source": "exact quote from document",
      "sourceSection": "section name",
      "importance": "critical|high|medium|low",
      "category": "financial|dates|parties|obligations|compliance|sla|deliverables|terms|other",
      "isStandardField": true/false,
      "explanation": "why this is important"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Extract all important data from:\n\n${textToAnalyze}`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 4000
    });

    const discoveredFields: DiscoveredField[] = JSON.parse(
      fieldsResponse.choices[0]?.message?.content || '{"fields":[]}'
    ).fields || [];

    // Phase 2.5: Enhanced Pattern-Based Extraction for Reliability
    const enhancedFields = enhanceWithPatternMatching(textToAnalyze, discoveredFields);
    
    // Phase 2.6: Cross-Validation of Extracted Fields
    const validatedFields = crossValidateFields(enhancedFields);

    // Phase 2.7: Smart Auto-Correction
    let correctionResult: any = null;
    let correctedFields = validatedFields;
    if (autoCorrector) {
      try {
        // Convert fields to a data object for correction
        const fieldData: Record<string, unknown> = {};
        for (const field of validatedFields) {
          fieldData[field.fieldName] = field.value;
        }
        
        correctionResult = autoCorrector.applyCorrections(fieldData, {
          contractType: detectedContractType,
          industry,
          documentText: textToAnalyze,
        });
        
        if (correctionResult.corrected) {
          // Update fields with corrections
          correctedFields = validatedFields.map((field: DiscoveredField) => {
            const correction = correctionResult.corrections.find((c: any) => c.field === field.fieldName);
            if (correction) {
              return {
                ...field,
                value: correction.correctedValue,
                originalValue: correction.originalValue,
                correctionApplied: {
                  type: correction.type,
                  explanation: correction.explanation,
                  confidence: correction.confidence,
                  requiresReview: correction.requiresReview,
                },
              };
            }
            return field;
          });
        }
      } catch {
        // Auto-correction failed
      }
    }

    // Phase 2.8: Clause-Level Extraction
    let clauseAnalysis: any = null;
    if (clauseExtractor) {
      try {
        const clauseResult = clauseExtractor.extractClauses(textToAnalyze, detectedContractType);
        if (clauseResult.success) {
          clauseAnalysis = {
            totalClauses: clauseResult.clauses.length,
            clauses: clauseResult.clauses.map((c: any) => ({
              id: c.id,
              number: c.number,
              title: c.title,
              type: c.type,
              importance: c.importance,
              riskLevel: c.riskLevel,
              riskFactors: c.riskFactors,
              summary: c.summary,
              extractedFields: c.extractedFields,
              confidence: c.confidence,
            })),
            hierarchy: {
              rootClauses: clauseResult.hierarchy.rootClauses.length,
              maxDepth: clauseResult.hierarchy.depth,
            },
            summary: clauseResult.summary,
            crossReferences: Object.keys(clauseResult.crossReferenceMap || {}).length,
            definedTerms: clauseResult.definedTerms?.length || 0,
            byRiskLevel: {
              high: clauseResult.clauses.filter((c: any) => c.riskLevel === 'high').length,
              medium: clauseResult.clauses.filter((c: any) => c.riskLevel === 'medium').length,
              low: clauseResult.clauses.filter((c: any) => c.riskLevel === 'low').length,
            },
            byType: clauseResult.clauses.reduce((acc: Record<string, number>, c: any) => {
              acc[c.type] = (acc[c.type] || 0) + 1;
              return acc;
            }, {}),
          };
        }
      } catch {
        // Clause extraction failed
      }
    }

    // Phase 3: Risk Analysis (unless skipped)
    let riskSignals: RiskSignal[] = [];
    if (!options.skipRiskAnalysis) {
      const riskResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a contract risk analyst. Identify ALL risks in this ${documentType.primaryType || 'contract'}.

Look for:
- Unlimited liability exposure
- One-sided indemnification
- Auto-renewal traps
- Short termination notice
- Unfavorable IP clauses
- Data handling risks
- Compliance gaps
- Vendor lock-in
- Penalty triggers
- Missing protections

Return JSON:
{
  "risks": [
    {
      "id": "risk-1",
      "category": "financial|liability|termination|ip|confidentiality|compliance|operational|vendor_lock_in|performance",
      "title": "Risk title",
      "description": "What the risk is",
      "severity": "critical|high|medium|low",
      "likelihood": "very_likely|likely|possible|unlikely",
      "financialImpact": {"amount": null, "type": "uncapped|fixed|percentage", "currency": "USD"},
      "sourceClause": "exact quote",
      "mitigationSuggestion": "how to fix",
      "requiresReview": true/false
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Identify risks in:\n\n${textToAnalyze.substring(0, 25000)}`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
        max_tokens: 3000
      });

      riskSignals = JSON.parse(
        riskResponse.choices[0]?.message?.content || '{"risks":[]}'
      ).risks || [];
    }

    // Phase 4: Negotiation Opportunities (unless skipped)
    let negotiationOpportunities: NegotiationOpportunity[] = [];
    if (!options.skipNegotiationAnalysis) {
      const negotiationResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a contract negotiation expert. Identify opportunities to negotiate better terms.

Look for:
- Unfavorable terms vs industry standards
- Missing protections
- One-sided clauses
- Payment terms to improve
- Liability caps to adjust
- Warranty periods
- Notice period issues

Return JSON:
{
  "opportunities": [
    {
      "id": "opp-1",
      "type": "unfavorable_term|missing_protection|one_sided|industry_standard",
      "title": "Opportunity title",
      "description": "What to negotiate",
      "currentTerm": "current contract language",
      "suggestedAlternative": "improved language",
      "priority": "high|medium|low",
      "potentialBenefit": "what you gain",
      "negotiationTip": "how to approach"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Find negotiation opportunities in:\n\n${textToAnalyze.substring(0, 25000)}`
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 3000
      });

      negotiationOpportunities = JSON.parse(
        negotiationResponse.choices[0]?.message?.content || '{"opportunities":[]}'
      ).opportunities || [];
    }

    // Phase 5: Key Insights
    const insightsResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior contract analyst. Generate key insights valuable for managing this contract.

Consider:
- What are the most important things to know?
- What might someone miss on first read?
- Critical deadlines or dates?
- Potential problems if overlooked?
- What makes this contract unique?

Return JSON:
{
  "insights": [
    {
      "id": "insight-1",
      "type": "observation|warning|opportunity|recommendation|question",
      "category": "financial|legal|operational|compliance|risk|strategic",
      "title": "Brief title",
      "description": "Detailed insight",
      "severity": "critical|high|medium|low|info",
      "actionable": true/false,
      "suggestedAction": "what to do",
      "confidence": 0.0-1.0
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Generate insights for:\n\n${textToAnalyze.substring(0, 20000)}`
        }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: 2000
    });

    const keyInsights: DocumentInsight[] = JSON.parse(
      insightsResponse.choices[0]?.message?.content || '{"insights":[]}'
    ).insights || [];

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Generate recommendations from analysis
    const recommendations = generateRecommendations({
      documentType,
      riskSignals,
      negotiationOpportunities,
      keyInsights
    });

    // Calculate validation stats
    const highConfidenceFields = validatedFields.filter(f => f.confidence >= 0.85);
    const warningFields = validatedFields.filter(f => 
      f.explanation?.includes('⚠️') || f.explanation?.includes('❌')
    );

    // Advanced Analysis: Industry Benchmarking
    let benchmarkComparisons: any[] = [];
    if (options.enableBenchmarking !== false && intelligence && detectedContractType) {
      try {
        benchmarkComparisons = intelligence.compareToIndustryBenchmarks(
          validatedFields.map((f: DiscoveredField) => ({
            fieldName: f.fieldName,
            value: f.value,
            valueType: f.valueType
          })),
          detectedContractType,
          industry
        );
      } catch {
        // Benchmarking failed
      }
    }

    // Advanced Analysis: Missing Field Prediction
    let missingFieldPredictions: any[] = [];
    if (intelligence && detectedContractType) {
      try {
        missingFieldPredictions = intelligence.predictMissingFields(
          validatedFields.map((f: DiscoveredField) => f.fieldName),
          detectedContractType
        );
      } catch {
        // Missing field prediction failed
      }
    }

    // Advanced Analysis: Calibrated Confidence
    // Use correctedFields (which may have auto-corrections applied) instead of validatedFields
    let calibratedFields = correctedFields;
    if (learning) {
      calibratedFields = correctedFields.map((field: DiscoveredField) => {
        try {
          const calibrated = learning.getCalibratedConfidence(
            field.fieldName,
            field.confidence,
            field.source,
            detectedContractType
          );
          return {
            ...field,
            originalConfidence: field.confidence,
            confidence: calibrated.calibratedConfidence,
            calibrationNote: calibrated.adjustmentReason !== 'No adjustment needed' 
              ? calibrated.adjustmentReason 
              : undefined
          };
        } catch {
          return field;
        }
      });
    }

    // Advanced Analysis: Improvement Suggestions
    let improvementSuggestions: any[] = [];
    if (intelligence) {
      try {
        improvementSuggestions = intelligence.suggestImprovements(
          validatedFields.map((f: DiscoveredField) => ({
            fieldName: f.fieldName,
            value: f.value,
            confidence: f.confidence
          })),
          detectedContractType,
          textToAnalyze
        );
      } catch {
        // Improvement suggestions failed
      }
    }

    // End learning session
    if (learning && learningSessionId) {
      learning.updateSession(learningSessionId, {
        fieldsExtracted: validatedFields.length,
        averageConfidence: validatedFields.length > 0 
          ? validatedFields.reduce((sum: number, f: DiscoveredField) => sum + f.confidence, 0) / validatedFields.length 
          : 0
      });
      learning.endSession(learningSessionId);
    }

    // Build comprehensive response
    const analysisResult = {
      success: true,
      documentType,
      contractTypeProfile: contractTypeProfile ? {
        type: contractTypeProfile.type,
        displayName: contractTypeProfile.displayName,
        criticalFields: contractTypeProfile.criticalFields,
        riskCategories: contractTypeProfile.riskCategories
      } : null,
      
      // NEW: Template detection results
      templateDetection: templateMatch,
      extractionOptimization: extractionOptimization ? {
        fieldPriority: extractionOptimization.fieldPriority,
        expectedFields: extractionOptimization.expectedFields,
        defaultValues: extractionOptimization.defaultValues,
      } : null,
      
      discoveredFields: {
        total: calibratedFields.length,
        highConfidence: highConfidenceFields.length,
        needsReview: warningFields.length,
        byImportance: {
          critical: calibratedFields.filter((f: DiscoveredField) => f.importance === 'critical').length,
          high: calibratedFields.filter((f: DiscoveredField) => f.importance === 'high').length,
          medium: calibratedFields.filter((f: DiscoveredField) => f.importance === 'medium').length,
          low: calibratedFields.filter((f: DiscoveredField) => f.importance === 'low').length,
        },
        byCategory: groupByCategory(calibratedFields),
        fields: calibratedFields
      },
      
      // NEW: Auto-correction results
      autoCorrections: correctionResult ? {
        applied: correctionResult.corrected,
        totalCorrections: correctionResult.corrections?.length || 0,
        corrections: correctionResult.corrections?.map((c: any) => ({
          field: c.field,
          type: c.type,
          from: c.originalValue,
          to: c.correctedValue,
          explanation: c.explanation,
          confidence: c.confidence,
          requiresReview: c.requiresReview,
        })),
        suggestedReviews: correctionResult.suggestedReviews,
        confidenceAdjustments: correctionResult.confidenceAdjustments,
      } : null,
      
      // NEW: Clause-level analysis
      clauseAnalysis: clauseAnalysis,
      
      extractionQuality: {
        averageConfidence: calibratedFields.length > 0 
          ? calibratedFields.reduce((sum: number, f: DiscoveredField) => sum + f.confidence, 0) / calibratedFields.length 
          : 0,
        patternVerified: calibratedFields.filter((f: DiscoveredField) => f.explanation?.includes('Pattern-verified')).length,
        crossValidated: calibratedFields.filter((f: DiscoveredField) => !f.explanation?.includes('⚠️')).length,
        needsHumanReview: warningFields.map((f: DiscoveredField) => f.fieldName),
        correctionsApplied: correctionResult?.corrections?.length || 0,
      },
      industryBenchmarks: benchmarkComparisons.length > 0 ? {
        comparisons: benchmarkComparisons,
        fieldsCompared: benchmarkComparisons.length,
        outliers: benchmarkComparisons.filter((c: any) => c.position === 'outlier').length,
        aboveMarket: benchmarkComparisons.filter((c: any) => c.position === 'above_market').length,
        belowMarket: benchmarkComparisons.filter((c: any) => c.position === 'below_market').length
      } : null,
      missingFields: missingFieldPredictions.length > 0 ? {
        predictions: missingFieldPredictions,
        criticalMissing: missingFieldPredictions.filter((p: any) => p.likelihood > 0.9).length,
        likelyMissing: missingFieldPredictions.filter((p: any) => p.likelihood > 0.6).length
      } : null,
      improvementSuggestions: improvementSuggestions.length > 0 ? {
        total: improvementSuggestions.length,
        suggestions: improvementSuggestions
      } : null,
      riskAnalysis: {
        totalRisks: riskSignals.length,
        criticalRisks: riskSignals.filter(r => r.severity === 'critical').length,
        highRisks: riskSignals.filter(r => r.severity === 'high').length,
        overallRiskLevel: calculateOverallRiskLevel(riskSignals),
        risks: riskSignals
      },
      negotiationOpportunities: {
        total: negotiationOpportunities.length,
        highPriority: negotiationOpportunities.filter(o => o.priority === 'high').length,
        opportunities: negotiationOpportunities
      },
      keyInsights: {
        total: keyInsights.length,
        actionable: keyInsights.filter(i => i.actionable).length,
        insights: keyInsights
      },
      recommendations: {
        total: recommendations.length,
        urgent: recommendations.filter(r => r.priority === 'urgent').length,
        recommendations
      },
      metadata: {
        processingTime,
        modelUsed: 'gpt-4o',
        analysisVersion: '3.0.0',
        timestamp: new Date().toISOString(),
        documentLength: documentText.length,
        contractId,
        featuresEnabled: {
          templateDetection: !!templateMatch,
          clauseAnalysis: !!clauseAnalysis,
          autoCorrection: !!correctionResult,
          benchmarking: benchmarkComparisons.length > 0,
          learning: !!learning,
        },
      }
    };

    return NextResponse.json(analysisResult);

  } catch (error: unknown) {
    return NextResponse.json(
      { 
        error: 'Analysis failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function groupByCategory(fields: DiscoveredField[]): Record<string, number> {
  return fields.reduce((acc, field) => {
    const category = field.category || 'other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function calculateOverallRiskLevel(risks: RiskSignal[]): string {
  if (risks.some(r => r.severity === 'critical')) return 'critical';
  if (risks.filter(r => r.severity === 'high').length >= 3) return 'high';
  if (risks.filter(r => r.severity === 'high').length >= 1) return 'medium';
  if (risks.length > 0) return 'low';
  return 'minimal';
}

function generateRecommendations(context: {
  documentType: any;
  riskSignals: RiskSignal[];
  negotiationOpportunities: NegotiationOpportunity[];
  keyInsights: DocumentInsight[];
}): Array<{
  id: string;
  category: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reason: string;
}> {
  const recommendations: Array<{
    id: string;
    category: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    reason: string;
  }> = [];
  let id = 0;

  // From critical/high risks
  for (const risk of context.riskSignals.filter(r => 
    r.severity === 'critical' || r.severity === 'high'
  )) {
    recommendations.push({
      id: `rec-${id++}`,
      category: 'risk',
      priority: risk.severity === 'critical' ? 'urgent' : 'high',
      title: `Address: ${risk.title}`,
      description: risk.mitigationSuggestion,
      reason: risk.description
    });
  }

  // From high-priority negotiation opportunities
  for (const opp of context.negotiationOpportunities.filter(o => o.priority === 'high')) {
    recommendations.push({
      id: `rec-${id++}`,
      category: 'negotiation',
      priority: 'medium',
      title: opp.title,
      description: opp.negotiationTip,
      reason: opp.potentialBenefit
    });
  }

  // From actionable insights
  for (const insight of context.keyInsights.filter(i => 
    i.actionable && (i.severity === 'critical' || i.severity === 'high')
  )) {
    recommendations.push({
      id: `rec-${id++}`,
      category: 'action',
      priority: insight.severity === 'critical' ? 'urgent' : 'high',
      title: insight.title,
      description: insight.suggestedAction || insight.description,
      reason: insight.description
    });
  }

  return recommendations;
}

// ============================================================================
// ENHANCED PATTERN MATCHING FOR RELIABILITY
// ============================================================================

interface ExtractionPattern {
  name: string;
  category: string;
  patterns: RegExp[];
  importance: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // Dates
  {
    name: 'effective_date',
    category: 'dates',
    patterns: [
      /effective\s+(?:date|as\s+of)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /effective\s+(?:date|as\s+of)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /this\s+agreement\s+is\s+effective\s+(?:as\s+of\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    ],
    importance: 'critical',
    confidence: 0.92
  },
  {
    name: 'expiration_date',
    category: 'dates',
    patterns: [
      /(?:expiration|expiry|end)\s+date[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /(?:terminates?|expires?|ends?)\s+(?:on|upon)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    ],
    importance: 'critical',
    confidence: 0.9
  },
  // Financial
  {
    name: 'total_contract_value',
    category: 'financial',
    patterns: [
      /total\s+(?:contract\s+)?value[:\s]+[$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:aggregate|maximum)\s+amount[:\s]+[$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
      /not\s+(?:to\s+)?exceed[:\s]+[$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
    ],
    importance: 'critical',
    confidence: 0.88
  },
  {
    name: 'payment_terms',
    category: 'financial',
    patterns: [
      /payment\s+(?:terms?|due)[:\s]+(?:net\s+)?(\d+)\s*(?:days?)?/i,
      /(?:net\s+)?(\d+)\s*days?\s+(?:from\s+)?(?:receipt|invoice)/i,
      /payable\s+within\s+(\d+)\s*days?/i,
    ],
    importance: 'high',
    confidence: 0.85
  },
  // Term/Duration
  {
    name: 'initial_term',
    category: 'terms',
    patterns: [
      /(?:initial\s+)?term\s+(?:of|is|shall\s+be)[:\s]+(\d+)\s*(year|month|day)s?/i,
      /(?:for\s+a\s+)?(?:period|term)\s+of\s+(\d+)\s*(year|month|day)s?/i,
    ],
    importance: 'high',
    confidence: 0.87
  },
  {
    name: 'renewal_term',
    category: 'terms',
    patterns: [
      /(?:auto(?:matic)?(?:ally)?|successive)\s+renew(?:al)?(?:s)?\s+(?:of|for)\s+(\d+)\s*(year|month|day)s?/i,
      /renew(?:al)?(?:s)?\s+for\s+(?:additional|successive)\s+(\d+)\s*(year|month|day)s?\s+(?:term|period)s?/i,
    ],
    importance: 'high',
    confidence: 0.82
  },
  {
    name: 'notice_period',
    category: 'terms',
    patterns: [
      /(?:prior\s+)?(?:written\s+)?notice\s+(?:of\s+)?(?:at\s+least\s+)?(\d+)\s*(?:calendar\s+|business\s+)?(days?|months?)/i,
      /(\d+)\s*(?:calendar\s+|business\s+)?(days?|months?)\s+(?:prior\s+)?(?:written\s+)?notice/i,
    ],
    importance: 'high',
    confidence: 0.83
  },
  // Liability
  {
    name: 'liability_cap',
    category: 'legal',
    patterns: [
      /(?:total|aggregate)\s+liability\s+(?:shall\s+)?(?:not\s+)?exceed\s+[$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:capped|limited)\s+(?:at|to)\s+[$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
      /liability\s+(?:cap|limit)[:\s]+[$€£]?\s*([\d,]+(?:\.\d{2})?)/i,
    ],
    importance: 'critical',
    confidence: 0.86
  },
  // SLA
  {
    name: 'sla_uptime',
    category: 'sla',
    patterns: [
      /(?:uptime|availability)[:\s]+(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s+(?:uptime|availability)/i,
    ],
    importance: 'high',
    confidence: 0.9
  },
  // Jurisdiction
  {
    name: 'governing_law',
    category: 'legal',
    patterns: [
      /govern(?:ed|ing)\s+(?:by\s+)?(?:the\s+)?(?:laws?\s+of\s+)?(?:the\s+)?(?:State\s+of\s+)?([A-Za-z\s]+)/i,
    ],
    importance: 'high',
    confidence: 0.78
  },
];

/**
 * Enhance AI-extracted fields with pattern matching for reliability
 */
function enhanceWithPatternMatching(
  documentText: string, 
  aiFields: DiscoveredField[]
): DiscoveredField[] {
  const enhanced = [...aiFields];
  const existingFieldNames = new Set(aiFields.map(f => f.fieldName.toLowerCase()));

  for (const pattern of EXTRACTION_PATTERNS) {
    // Skip if AI already found this field with good confidence
    const aiField = aiFields.find(f => 
      f.fieldName.toLowerCase().includes(pattern.name.replace(/_/g, '')) ||
      pattern.name.includes(f.fieldName.toLowerCase().replace(/_/g, ''))
    );
    
    if (aiField && aiField.confidence >= 0.8) {
      continue;
    }

    for (const regex of pattern.patterns) {
      const match = documentText.match(regex);
      if (match && match[1]) {
        const value = match[1].trim();
        
        if (aiField) {
          // Boost confidence if pattern matches AI extraction
          if (aiField.value?.toString().includes(value) || value.includes(aiField.value?.toString() || '')) {
            aiField.confidence = Math.min(1.0, aiField.confidence + 0.15);
            aiField.explanation = `${aiField.explanation} [Pattern-verified]`;
          }
        } else {
          // Add pattern-extracted field
          enhanced.push({
            fieldName: pattern.name,
            displayName: pattern.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            value,
            valueType: inferValueType(value, pattern.category),
            confidence: pattern.confidence,
            source: match[0],
            sourceSection: 'Pattern extraction',
            importance: pattern.importance,
            category: pattern.category,
            isStandardField: true,
            explanation: `Extracted via reliable pattern matching`
          });
        }
        break;
      }
    }
  }

  return enhanced;
}

/**
 * Cross-validate extracted fields for consistency
 */
function crossValidateFields(fields: DiscoveredField[]): DiscoveredField[] {
  const validated = [...fields];
  const fieldMap = new Map(fields.map(f => [f.fieldName.toLowerCase(), f]));

  // Validation 1: Date sequence check
  const effectiveDate = fieldMap.get('effective_date');
  const expirationDate = fieldMap.get('expiration_date');
  
  if (effectiveDate && expirationDate) {
    try {
      const effDate = new Date(effectiveDate.value);
      const expDate = new Date(expirationDate.value);
      
      if (expDate <= effDate) {
        // Flag inconsistency
        const effField = validated.find(f => f.fieldName === 'effective_date');
        const expField = validated.find(f => f.fieldName === 'expiration_date');
        if (effField) {
          effField.confidence = Math.max(0.5, effField.confidence - 0.2);
          effField.explanation = `${effField.explanation} [⚠️ Date sequence issue: expires before/on effective date]`;
        }
        if (expField) {
          expField.confidence = Math.max(0.5, expField.confidence - 0.2);
          expField.explanation = `${expField.explanation} [⚠️ Date sequence issue: expires before/on effective date]`;
        }
      }
    } catch {
      // Skip if dates can't be parsed
    }
  }

  // Validation 2: Term duration vs dates consistency
  const termDuration = fieldMap.get('initial_term') || fieldMap.get('term_duration');
  if (termDuration && effectiveDate && expirationDate) {
    try {
      const effDate = new Date(effectiveDate.value);
      const expDate = new Date(expirationDate.value);
      const monthsDiff = (expDate.getFullYear() - effDate.getFullYear()) * 12 + 
                        (expDate.getMonth() - effDate.getMonth());
      
      const termStr = String(termDuration.value).toLowerCase();
      let expectedMonths = 0;
      const yearMatch = termStr.match(/(\d+)\s*year/);
      const monthMatch = termStr.match(/(\d+)\s*month/);
      if (yearMatch) expectedMonths = parseInt(yearMatch[1]) * 12;
      if (monthMatch) expectedMonths += parseInt(monthMatch[1]);
      
      if (expectedMonths > 0 && Math.abs(monthsDiff - expectedMonths) > 1) {
        const termField = validated.find(f => 
          f.fieldName === 'initial_term' || f.fieldName === 'term_duration'
        );
        if (termField) {
          termField.explanation = `${termField.explanation} [⚠️ Term (${expectedMonths}mo) doesn't match dates (${monthsDiff}mo)]`;
        }
      }
    } catch {
      // Skip if calculation fails
    }
  }

  // Validation 3: Financial reasonability
  const totalValue = fieldMap.get('total_contract_value') || fieldMap.get('total_value');
  if (totalValue) {
    const valueStr = String(totalValue.value).replace(/[^\d.]/g, '');
    const amount = parseFloat(valueStr);
    
    if (amount > 1000000000) { // > $1B
      const field = validated.find(f => 
        f.fieldName === 'total_contract_value' || f.fieldName === 'total_value'
      );
      if (field) {
        field.confidence = Math.max(0.6, field.confidence - 0.15);
        field.explanation = `${field.explanation} [⚠️ Unusually large amount - verify]`;
      }
    }
  }

  // Validation 4: Percentage sanity
  for (const field of validated) {
    if (field.valueType === 'percentage') {
      const pctValue = parseFloat(String(field.value).replace(/[^\d.]/g, ''));
      if (pctValue > 100 || pctValue < 0) {
        field.confidence = 0.3;
        field.explanation = `${field.explanation} [❌ Invalid percentage: ${pctValue}%]`;
      }
    }
  }

  // Sort by importance and confidence
  return validated.sort((a, b) => {
    const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const impDiff = importanceOrder[a.importance] - importanceOrder[b.importance];
    if (impDiff !== 0) return impDiff;
    return b.confidence - a.confidence;
  });
}

/**
 * Infer value type from value and category
 */
function inferValueType(value: string, category: string): string {
  if (/[$€£¥]|USD|EUR|GBP/i.test(value)) return 'currency';
  if (/\d+(?:\.\d+)?%/.test(value)) return 'percentage';
  if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}/i.test(value)) return 'date';
  if (/\d+\s*(year|month|day|week)s?/i.test(value)) return 'duration';
  if (category === 'dates') return 'date';
  if (category === 'financial') return 'currency';
  return 'string';
}
