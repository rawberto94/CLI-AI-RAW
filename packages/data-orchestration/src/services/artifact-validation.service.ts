/**
 * Artifact Validation Service
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
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

    if (!artifact.type) {
      errors.push('Artifact type is required');
    }

    if (!artifact.data) {
      errors.push('Artifact data is required');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
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
