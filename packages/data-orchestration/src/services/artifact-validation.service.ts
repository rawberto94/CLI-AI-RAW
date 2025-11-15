/**
 * Artifact Validation Service
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues?: any[];
  criticalIssues?: number;
  canAutoFix?: boolean;
  confidence?: number;
}

class ArtifactValidationService {
  private static instance: ArtifactValidationService;

  private constructor() {}

  public static getInstance(): ArtifactValidationService {
    if (!ArtifactValidationService.instance) {
      ArtifactValidationService.instance = new ArtifactValidationService();
    }
    return ArtifactValidationService.instance;
  }

  async validateArtifact(artifact: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const issues: any[] = [];

    if (!artifact.type) {
      errors.push('Artifact type is required');
      issues.push({ field: 'type', message: 'Artifact type is required', severity: 'error' });
    }

    if (!artifact.data) {
      errors.push('Artifact data is required');
      issues.push({ field: 'data', message: 'Artifact data is required', severity: 'error' });
    }

    const criticalIssues = issues.filter(i => i.severity === 'error').length;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      issues,
      criticalIssues,
      canAutoFix: issues.some(i => i.severity === 'warning'),
      confidence: errors.length === 0 ? 1.0 : 0.5,
    };
  }

  async validateStructure(artifact: any): Promise<ValidationResult> {
    return this.validateArtifact(artifact);
  }

  async validateContent(artifact: any): Promise<ValidationResult> {
    return this.validateArtifact(artifact);
  }

  async validateConsistency(artifact: any): Promise<ValidationResult> {
    return this.validateArtifact(artifact);
  }

  async autoFix(artifact: any, issues: any[]): Promise<any> {
    return artifact;
  }
}

export const artifactValidationService = ArtifactValidationService.getInstance();
