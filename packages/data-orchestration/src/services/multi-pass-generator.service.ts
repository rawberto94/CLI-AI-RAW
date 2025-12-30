
/**
 * Multi-Pass Generator Service
 * 
 * Implements iterative refinement through multiple passes:
 * - Pass 1: Quick rule-based extraction
 * - Pass 2: AI enhancement with Pass 1 context
 * - Pass 3: Validation and gap-filling
 */

import { createLogger } from '../utils/logger';
import { ArtifactType, GenerationResult } from './ai-artifact-generator.service';
import { aiArtifactGeneratorService } from './ai-artifact-generator.service';
import { artifactValidationService } from './artifact-validation.service';

const logger = createLogger('multi-pass-generator');

export interface MultiPassOptions {
  maxPasses?: number;
  targetCompleteness?: number; // 0-100
  targetConfidence?: number; // 0-1
  enablePass1?: boolean; // Rule-based
  enablePass2?: boolean; // AI enhancement
  enablePass3?: boolean; // Validation & refinement
}

export interface PassResult {
  passNumber: number;
  method: 'rule-based' | 'ai' | 'validation';
  data: any;
  confidence?: number;
  completeness?: number;
  improvements: string[];
  processingTime: number;
}

export interface MultiPassResult {
  success: boolean;
  finalData: any;
  passes: PassResult[];
  totalProcessingTime: number;
  finalConfidence?: number;
  finalCompleteness?: number;
  improvementSummary: {
    initialCompleteness: number;
    finalCompleteness: number;
    improvement: number;
    passesExecuted: number;
  };
}

export class MultiPassGeneratorService {
  private static instance: MultiPassGeneratorService;

  private constructor() {}

  static getInstance(): MultiPassGeneratorService {
    if (!MultiPassGeneratorService.instance) {
      MultiPassGeneratorService.instance = new MultiPassGeneratorService();
    }
    return MultiPassGeneratorService.instance;
  }

  /**
   * Generate artifact with multi-pass refinement
   */
  async generateMultiPass(
    artifactType: ArtifactType,
    contractText: string,
    contractId: string,
    tenantId: string,
    options: MultiPassOptions = {}
  ): Promise<MultiPassResult> {
    const startTime = Date.now();
    const passes: PassResult[] = [];
    
    const {
      maxPasses = 3,
      targetCompleteness = 85,
      targetConfidence = 0.85,
      enablePass1 = true,
      enablePass2 = true,
      enablePass3 = true
    } = options;

    logger.info(
      { artifactType, contractId, maxPasses, targetCompleteness, targetConfidence },
      'Starting multi-pass generation'
    );

    let currentData: any = null;
    let currentCompleteness = 0;
    let currentConfidence = 0;
    const initialCompleteness = 0;

    // Pass 1: Quick rule-based extraction
    if (enablePass1) {
      const pass1Result = await this.executePass1(artifactType, contractText);
      passes.push(pass1Result);
      currentData = pass1Result.data;
      currentCompleteness = pass1Result.completeness || 0;
      
      logger.info(
        { passNumber: 1, completeness: currentCompleteness },
        'Pass 1 completed'
      );
    }

    // Pass 2: AI enhancement
    if (enablePass2 && currentCompleteness < targetCompleteness) {
      const pass2Result = await this.executePass2(
        artifactType,
        contractText,
        contractId,
        tenantId,
        currentData
      );
      passes.push(pass2Result);
      currentData = pass2Result.data;
      currentCompleteness = pass2Result.completeness || 0;
      currentConfidence = pass2Result.confidence || 0;
      
      logger.info(
        { passNumber: 2, completeness: currentCompleteness, confidence: currentConfidence },
        'Pass 2 completed'
      );
    }

    // Pass 3: Validation and gap-filling
    if (enablePass3 && (currentCompleteness < targetCompleteness || currentConfidence < targetConfidence)) {
      const pass3Result = await this.executePass3(
        artifactType,
        currentData,
        contractText,
        contractId,
        tenantId
      );
      passes.push(pass3Result);
      currentData = pass3Result.data;
      currentCompleteness = pass3Result.completeness || 0;
      currentConfidence = pass3Result.confidence || 0;
      
      logger.info(
        { passNumber: 3, completeness: currentCompleteness, confidence: currentConfidence },
        'Pass 3 completed'
      );
    }

    const totalProcessingTime = Date.now() - startTime;

    const result: MultiPassResult = {
      success: true,
      finalData: currentData,
      passes,
      totalProcessingTime,
      finalConfidence: currentConfidence,
      finalCompleteness: currentCompleteness,
      improvementSummary: {
        initialCompleteness,
        finalCompleteness: currentCompleteness,
        improvement: currentCompleteness - initialCompleteness,
        passesExecuted: passes.length
      }
    };

    logger.info(
      {
        artifactType,
        passesExecuted: passes.length,
        finalCompleteness: currentCompleteness,
        improvement: result.improvementSummary.improvement,
        totalTime: totalProcessingTime
      },
      'Multi-pass generation completed'
    );

    return result;
  }

  /**
   * Pass 1: Quick rule-based extraction
   */
  private async executePass1(
    artifactType: ArtifactType,
    contractText: string
  ): Promise<PassResult> {
    const startTime = Date.now();
    const improvements: string[] = [];

    // Simple pattern-based extraction
    const data = this.extractWithRules(artifactType, contractText, improvements);

    // Validate to get completeness
    const validation = await artifactValidationService.validateArtifact(artifactType, data);

    return {
      passNumber: 1,
      method: 'rule-based',
      data,
      completeness: validation.completeness,
      improvements,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Pass 2: AI enhancement with Pass 1 context
   */
  private async executePass2(
    artifactType: ArtifactType,
    contractText: string,
    contractId: string,
    tenantId: string,
    pass1Data: any
  ): Promise<PassResult> {
    const startTime = Date.now();
    const improvements: string[] = [];

    // Use AI generator with Pass 1 data as context
    const result = await aiArtifactGeneratorService.generateArtifact(
      artifactType,
      contractText,
      contractId,
      tenantId,
      {
        preferredMethod: 'ai',
        enableFallback: true,
        enrichedContext: {
          pass1Data,
          instruction: 'Enhance and complete the following initial extraction'
        }
      }
    );

    if (result.success && result.data) {
      // Merge Pass 1 and Pass 2 data
      const mergedData = this.mergeData(pass1Data, result.data, improvements);

      return {
        passNumber: 2,
        method: 'ai',
        data: mergedData,
        confidence: result.confidence,
        completeness: result.completeness,
        improvements,
        processingTime: Date.now() - startTime
      };
    }

    // If AI fails, return Pass 1 data
    return {
      passNumber: 2,
      method: 'ai',
      data: pass1Data,
      completeness: 0,
      improvements: ['AI enhancement failed, using Pass 1 data'],
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Pass 3: Validation and gap-filling
   */
  private async executePass3(
    artifactType: ArtifactType,
    pass2Data: any,
    contractText: string,
    contractId: string,
    tenantId: string
  ): Promise<PassResult> {
    const startTime = Date.now();
    const improvements: string[] = [];

    // Validate current data
    const validation = await artifactValidationService.validateArtifact(artifactType, pass2Data);

    let finalData = pass2Data;

    // Auto-fix issues
    if (!validation.valid && validation.canAutoFix) {
      const fixResult = await artifactValidationService.autoFix(pass2Data, validation.issues);
      if (fixResult.fixed) {
        finalData = fixResult.artifact;
        improvements.push(`Auto-fixed ${fixResult.changes.length} issues`);
      }
    }

    // Identify gaps
    const gaps = this.identifyGaps(artifactType, finalData, validation);
    
    if (gaps.length > 0) {
      improvements.push(`Identified ${gaps.length} gaps to fill`);
      
      // Try to fill gaps with targeted AI extraction
      const filledData = await this.fillGaps(
        artifactType,
        finalData,
        gaps,
        contractText,
        contractId,
        tenantId
      );
      
      if (filledData) {
        finalData = filledData;
        improvements.push('Filled gaps with targeted extraction');
      }
    }

    // Final validation
    const finalValidation = await artifactValidationService.validateArtifact(artifactType, finalData);

    return {
      passNumber: 3,
      method: 'validation',
      data: finalData,
      completeness: finalValidation.completeness,
      confidence: 0.9, // High confidence after validation
      improvements,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Extract data using simple rules
   */
  private extractWithRules(
    artifactType: ArtifactType,
    contractText: string,
    improvements: string[]
  ): any {
    const data: any = {};

    switch (artifactType) {
      case 'OVERVIEW':
        // Extract parties
        const partyMatches = contractText.match(/between\s+([^(]+)\s*\(/gi);
        if (partyMatches) {
          data.parties = partyMatches.map(match => ({
            name: match.replace(/between\s+/i, '').replace(/\s*\(/, '').trim(),
            role: 'party'
          }));
          improvements.push('Extracted parties from text');
        }

        // Extract dates
        const dateMatches = contractText.match(/\d{4}-\d{2}-\d{2}/g);
        if (dateMatches && dateMatches.length > 0) {
          data.effectiveDate = dateMatches[0];
          improvements.push('Extracted effective date');
        }
        break;

      case 'FINANCIAL':
        // Extract amounts
        const amountMatches = contractText.match(/\$[\d,]+/g);
        if (amountMatches && amountMatches.length > 0) {
          const amounts = amountMatches.map(m => parseInt(m.replace(/[$,]/g, '')));
          data.totalValue = Math.max(...amounts);
          data.currency = 'USD';
          improvements.push('Extracted financial amounts');
        }
        break;

      case 'RATES':
        // Extract hourly rates
        const rateMatches = contractText.match(/\$(\d+)\/hour/gi);
        if (rateMatches) {
          data.rateCards = rateMatches.map(match => ({
            rate: parseInt(match.replace(/[$\/hour]/gi, '')),
            unit: 'hour',
            currency: 'USD'
          }));
          improvements.push('Extracted rate cards');
        }
        break;
    }

    return data;
  }

  /**
   * Merge data from two passes
   */
  private mergeData(pass1Data: any, pass2Data: any, improvements: string[]): any {
    const merged = { ...pass1Data };

    for (const key in pass2Data) {
      if (pass2Data[key] !== null && pass2Data[key] !== undefined) {
        if (!merged[key] || this.isEmpty(merged[key])) {
          merged[key] = pass2Data[key];
          improvements.push(`Added ${key} from AI`);
        } else if (Array.isArray(merged[key]) && Array.isArray(pass2Data[key])) {
          // Merge arrays
          merged[key] = [...merged[key], ...pass2Data[key]];
          improvements.push(`Merged ${key} arrays`);
        }
      }
    }

    return merged;
  }

  /**
   * Identify gaps in data
   */
  private identifyGaps(artifactType: ArtifactType, data: any, validation: any): string[] {
    const gaps: string[] = [];

    if (validation.issues) {
      for (const issue of validation.issues) {
        if (issue.severity === 'critical' && !issue.autoFixable) {
          gaps.push(issue.field);
        }
      }
    }

    return gaps;
  }

  /**
   * Fill gaps with targeted extraction
   */
  private async fillGaps(
    artifactType: ArtifactType,
    data: any,
    gaps: string[],
    contractText: string,
    contractId: string,
    tenantId: string
  ): Promise<any | null> {
    // In production, this would use targeted AI prompts for each gap
    // For now, return null to indicate no gaps were filled
    logger.debug({ gaps }, 'Gap filling not yet implemented');
    return null;
  }

  /**
   * Check if value is empty
   */
  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
  }
}

export const multiPassGeneratorService = MultiPassGeneratorService.getInstance();
