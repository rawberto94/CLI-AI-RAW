/**
 * Rate Validation Service
 *
 * Provides comprehensive validation for enhanced rate card data including:
 * - Rate consistency validation across different formats
 * - Geographic data validation
 * - Skill and certification requirement validation
 * - Seniority alignment validation
 * - Auto-correction suggestions
 */

import {
  EnhancedRateCard,
  EnhancedRate,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  CorrectionSuggestion,
  Location,
  Skill,
  SeniorityLevel,
  EngagementModel,
  ApprovalStatus,
} from "../types/enhanced-rate-card.types";
import { dbAdaptor } from "../dal/database.adaptor";
import { rateCalculationEngine } from "./rate-calculation.engine";
import pino from "pino";

const logger = pino({ name: "rate-validation-service" });

export class RateValidationService {
  private static instance: RateValidationService;

  // Validation constants
  private readonly VALID_COUNTRIES = [
    "USA",
    "CAN",
    "GBR",
    "AUS",
    "IND",
    "DEU",
    "FRA",
    "JPN",
  ]; // ISO 3166-1 alpha-3
  private readonly VALID_CURRENCIES = [
    "USD",
    "CAD",
    "GBP",
    "AUD",
    "INR",
    "EUR",
    "JPY",
  ];
  private readonly VALID_SENIORITY_LEVELS: SeniorityLevel[] = [
    "Junior",
    "Mid-Level",
    "Senior",
    "Lead",
    "Principal",
    "Director",
  ];
  private readonly VALID_ENGAGEMENT_MODELS: EngagementModel[] = [
    "Staff Augmentation",
    "Project",
    "Outcome",
  ];
  private readonly VALID_APPROVAL_STATUS: ApprovalStatus[] = [
    "pending",
    "approved",
    "rejected",
    "under_review",
  ];

  private constructor() {}

  static getInstance(): RateValidationService {
    if (!RateValidationService.instance) {
      RateValidationService.instance = new RateValidationService();
    }
    return RateValidationService.instance;
  }

  // ============================================================================
  // MAIN VALIDATION METHODS
  // ============================================================================

  /**
   * Validate complete rate card with all rates
   */
  async validateRateCard(
    rateCard: EnhancedRateCard,
    rates: EnhancedRate[]
  ): Promise<ValidationResult> {
    try {
      logger.info(
        { rateCardId: rateCard.id, rateCount: rates.length },
        "Validating rate card"
      );

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const suggestions: CorrectionSuggestion[] = [];

      // Validate rate card fields
      const rateCardValidation = await this.validateRateCardFields(rateCard);
      errors.push(...rateCardValidation.errors);
      warnings.push(...rateCardValidation.warnings);
      suggestions.push(...rateCardValidation.suggestions);

      // Validate each rate
      for (const rate of rates) {
        const rateValidation = await this.validateRate(rate);
        errors.push(...rateValidation.errors);
        warnings.push(...rateValidation.warnings);
        suggestions.push(...rateValidation.suggestions);
      }

      // Cross-validation between rate card and rates
      const crossValidation = await this.validateRateCardRateConsistency(
        rateCard,
        rates
      );
      errors.push(...crossValidation.errors);
      warnings.push(...crossValidation.warnings);
      suggestions.push(...crossValidation.suggestions);

      const result: ValidationResult = {
        isValid: errors.filter((e) => e.severity === "error").length === 0,
        errors,
        warnings,
        suggestions,
      };

      logger.info(
        {
          rateCardId: rateCard.id,
          isValid: result.isValid,
          errorCount: errors.length,
          warningCount: warnings.length,
        },
        "Completed rate card validation"
      );

      return result;
    } catch (error) {
      logger.error(
        { error, rateCardId: rateCard.id },
        "Failed to validate rate card"
      );
      throw error;
    }
  }

  /**
   * Validate rate consistency across different formats
   */
  validateRateConsistency(rate: EnhancedRate): ValidationResult {
    try {
      logger.info({ rateId: rate.id }, "Validating rate consistency");

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const suggestions: CorrectionSuggestion[] = [];

      // Check if at least one rate format is provided
      if (
        !rate.hourlyRate &&
        !rate.dailyRate &&
        !rate.weeklyRate &&
        !rate.monthlyRate &&
        !rate.annualRate
      ) {
        errors.push({
          field: "rates",
          message: "At least one rate format must be specified",
          code: "MISSING_RATE",
          severity: "error",
        });
        return { isValid: false, errors, warnings, suggestions };
      }

      // Use rate calculation engine to validate consistency
      const consistencyCheck =
        rateCalculationEngine.validateRateConsistency(rate);

      if (!consistencyCheck.isConsistent) {
        consistencyCheck.discrepancies.forEach((discrepancy) => {
          errors.push({
            field: "rate_consistency",
            message: discrepancy,
            code: "RATE_INCONSISTENCY",
            severity: "error",
          });
        });

        // Suggest corrections
        if (rate.hourlyRate) {
          const correctedRates = rateCalculationEngine.calculateEquivalentRates(
            rate.hourlyRate,
            "hourly",
            rate.billableHours
          );

          if (
            rate.dailyRate &&
            Math.abs(rate.dailyRate - correctedRates.dailyRate) > 0.01
          ) {
            suggestions.push({
              field: "dailyRate",
              currentValue: rate.dailyRate,
              suggestedValue: correctedRates.dailyRate,
              reason: "Calculated from hourly rate",
              confidence: 0.95,
            });
          }

          if (
            rate.monthlyRate &&
            Math.abs(rate.monthlyRate - correctedRates.monthlyRate) > 0.01
          ) {
            suggestions.push({
              field: "monthlyRate",
              currentValue: rate.monthlyRate,
              suggestedValue: correctedRates.monthlyRate,
              reason: "Calculated from hourly rate",
              confidence: 0.95,
            });
          }
        }
      }

      // Validate rate ranges
      const hourlyRate =
        rate.hourlyRate ||
        (rate.dailyRate ? rate.dailyRate / rate.billableHours : 0);
      if (hourlyRate > 0) {
        if (hourlyRate < 10) {
          warnings.push({
            field: "hourlyRate",
            message: "Hourly rate seems unusually low",
            recommendation:
              "Verify rate is correct or consider minimum wage requirements",
          });
        }

        if (hourlyRate > 500) {
          warnings.push({
            field: "hourlyRate",
            message: "Hourly rate seems unusually high",
            recommendation:
              "Verify rate is correct for the role and seniority level",
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };
    } catch (error) {
      logger.error(
        { error, rateId: rate.id },
        "Failed to validate rate consistency"
      );
      return {
        isValid: false,
        errors: [
          {
            field: "validation",
            message: "Validation error occurred",
            code: "VALIDATION_ERROR",
            severity: "error",
          },
        ],
        warnings: [],
        suggestions: [],
      };
    }
  }

  /**
   * Validate geographic data
   */
  async validateGeographicData(location: Location): Promise<ValidationResult> {
    try {
      logger.info({ location }, "Validating geographic data");

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const suggestions: CorrectionSuggestion[] = [];

      // Validate country code
      if (!location.country) {
        errors.push({
          field: "country",
          message: "Country is required",
          code: "MISSING_COUNTRY",
          severity: "error",
        });
      } else if (!this.VALID_COUNTRIES.includes(location.country)) {
        errors.push({
          field: "country",
          message: `Invalid country code: ${location.country}`,
          code: "INVALID_COUNTRY",
          severity: "error",
        });

        // Suggest similar country codes
        const suggestion = this.findSimilarCountryCode(location.country);
        if (suggestion) {
          suggestions.push({
            field: "country",
            currentValue: location.country,
            suggestedValue: suggestion,
            reason: "Similar country code found",
            confidence: 0.8,
          });
        }
      }

      // Validate geographic consistency
      if (location.country && location.stateProvince) {
        const isValidCombination = await this.validateCountryStateCombo(
          location.country,
          location.stateProvince
        );
        if (!isValidCombination) {
          warnings.push({
            field: "stateProvince",
            message: `State/Province ${location.stateProvince} may not be valid for country ${location.country}`,
            recommendation: "Verify geographic data accuracy",
          });
        }
      }

      // Validate cost of living index
      if (location.costOfLivingIndex !== undefined) {
        if (
          location.costOfLivingIndex < 20 ||
          location.costOfLivingIndex > 300
        ) {
          warnings.push({
            field: "costOfLivingIndex",
            message: "Cost of living index seems unusual",
            recommendation:
              "Verify cost of living data (typical range: 20-300, base 100)",
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };
    } catch (error) {
      logger.error({ error, location }, "Failed to validate geographic data");
      throw error;
    }
  }

  /**
   * Validate skill requirements
   */
  async validateSkillRequirements(
    skills: Skill[],
    role: string
  ): Promise<ValidationResult> {
    try {
      logger.info(
        { skillCount: skills.length, role },
        "Validating skill requirements"
      );

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const suggestions: CorrectionSuggestion[] = [];

      // Validate each skill
      for (const skill of skills) {
        // Check if skill exists in registry
        const skillExists = await this.checkSkillInRegistry(skill.name);
        if (!skillExists) {
          warnings.push({
            field: "requiredSkills",
            message: `Skill "${skill.name}" not found in skills registry`,
            recommendation: "Add skill to registry or verify spelling",
          });

          // Suggest similar skills
          const similarSkill = await this.findSimilarSkill(skill.name);
          if (similarSkill) {
            suggestions.push({
              field: "requiredSkills",
              currentValue: skill.name,
              suggestedValue: similarSkill,
              reason: "Similar skill found in registry",
              confidence: 0.7,
            });
          }
        }

        // Validate skill level progression
        if (
          skill.level &&
          !["Basic", "Intermediate", "Advanced", "Expert"].includes(skill.level)
        ) {
          errors.push({
            field: "skillLevel",
            message: `Invalid skill level: ${skill.level}`,
            code: "INVALID_SKILL_LEVEL",
            severity: "error",
          });
        }
      }

      // Check for role-skill alignment
      const roleSkillAlignment = await this.validateRoleSkillAlignment(
        role,
        skills
      );
      if (!roleSkillAlignment.isAligned) {
        warnings.push({
          field: "requiredSkills",
          message: "Some skills may not be typical for this role",
          recommendation: "Review skill requirements for role alignment",
        });
      }

      // Check for skill redundancy
      const duplicateSkills = this.findDuplicateSkills(skills);
      if (duplicateSkills.length > 0) {
        warnings.push({
          field: "requiredSkills",
          message: `Duplicate skills found: ${duplicateSkills.join(", ")}`,
          recommendation: "Remove duplicate skill requirements",
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };
    } catch (error) {
      logger.error(
        { error, skills, role },
        "Failed to validate skill requirements"
      );
      throw error;
    }
  }

  /**
   * Validate seniority alignment with role and experience
   */
  validateSeniorityAlignment(
    seniority: SeniorityLevel,
    role: string,
    experience?: number
  ): ValidationResult {
    try {
      logger.info(
        { seniority, role, experience },
        "Validating seniority alignment"
      );

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const suggestions: CorrectionSuggestion[] = [];

      // Validate seniority level
      if (!this.VALID_SENIORITY_LEVELS.includes(seniority)) {
        errors.push({
          field: "seniorityLevel",
          message: `Invalid seniority level: ${seniority}`,
          code: "INVALID_SENIORITY",
          severity: "error",
        });
        return { isValid: false, errors, warnings, suggestions };
      }

      // Validate experience alignment
      if (experience !== undefined) {
        const expectedExperience = this.getExpectedExperienceRange(seniority);

        if (experience < expectedExperience.min) {
          warnings.push({
            field: "minimumExperienceYears",
            message: `Experience (${experience} years) seems low for ${seniority} level`,
            recommendation: `Typical range for ${seniority}: ${expectedExperience.min}-${expectedExperience.max} years`,
          });

          // Suggest appropriate seniority level
          const appropriateSeniority =
            this.suggestSeniorityForExperience(experience);
          if (appropriateSeniority !== seniority) {
            suggestions.push({
              field: "seniorityLevel",
              currentValue: seniority,
              suggestedValue: appropriateSeniority,
              reason: `Better match for ${experience} years experience`,
              confidence: 0.8,
            });
          }
        }

        if (experience > expectedExperience.max + 5) {
          warnings.push({
            field: "minimumExperienceYears",
            message: `Experience (${experience} years) seems high for ${seniority} level`,
            recommendation:
              "Consider higher seniority level or verify experience requirement",
          });
        }
      }

      // Validate role-seniority alignment
      const roleSeniorityAlignment = this.validateRoleSeniorityAlignment(
        role,
        seniority
      );
      if (!roleSeniorityAlignment.isValid) {
        warnings.push({
          field: "seniorityLevel",
          message:
            roleSeniorityAlignment.message || "Role and seniority mismatch",
          recommendation: "Review role and seniority level combination",
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };
    } catch (error) {
      logger.error(
        { error, seniority, role, experience },
        "Failed to validate seniority alignment"
      );
      throw error;
    }
  }

  /**
   * Generate correction suggestions for validation errors
   */
  suggestCorrections(
    validationErrors: ValidationError[]
  ): CorrectionSuggestion[] {
    try {
      logger.info(
        { errorCount: validationErrors.length },
        "Generating correction suggestions"
      );

      const suggestions: CorrectionSuggestion[] = [];

      validationErrors.forEach((error) => {
        switch (error.code) {
          case "MISSING_RATE":
            suggestions.push({
              field: "hourlyRate",
              currentValue: null,
              suggestedValue: 100, // Default suggestion
              reason: "Provide at least one rate format",
              confidence: 0.5,
            });
            break;

          case "INVALID_COUNTRY":
            const suggestion = this.findSimilarCountryCode(error.field);
            if (suggestion) {
              suggestions.push({
                field: "country",
                currentValue: error.field,
                suggestedValue: suggestion,
                reason: "Corrected country code",
                confidence: 0.8,
              });
            }
            break;

          case "INVALID_SENIORITY":
            suggestions.push({
              field: "seniorityLevel",
              currentValue: error.field,
              suggestedValue: "Mid-Level",
              reason: "Default seniority level",
              confidence: 0.6,
            });
            break;

          default:
            // Generic suggestion based on field type
            const genericSuggestion = this.generateGenericSuggestion(error);
            if (genericSuggestion) {
              suggestions.push(genericSuggestion);
            }
        }
      });

      logger.info(
        { suggestionCount: suggestions.length },
        "Generated correction suggestions"
      );
      return suggestions;
    } catch (error) {
      logger.error(
        { error, validationErrors },
        "Failed to generate correction suggestions"
      );
      return [];
    }
  }

  // ============================================================================
  // PRIVATE VALIDATION METHODS
  // ============================================================================

  private async validateRateCardFields(
    rateCard: EnhancedRateCard
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: CorrectionSuggestion[] = [];

    // Required fields validation
    if (!rateCard.contractId) {
      errors.push({
        field: "contractId",
        message: "Contract ID is required",
        code: "MISSING_CONTRACT_ID",
        severity: "error",
      });
    }

    if (!rateCard.supplierId) {
      errors.push({
        field: "supplierId",
        message: "Supplier ID is required",
        code: "MISSING_SUPPLIER_ID",
        severity: "error",
      });
    }

    if (!rateCard.currency) {
      errors.push({
        field: "currency",
        message: "Currency is required",
        code: "MISSING_CURRENCY",
        severity: "error",
      });
    } else if (!this.VALID_CURRENCIES.includes(rateCard.currency)) {
      errors.push({
        field: "currency",
        message: `Invalid currency code: ${rateCard.currency}`,
        code: "INVALID_CURRENCY",
        severity: "error",
      });
    }

    // Engagement model validation
    if (
      rateCard.engagementModel &&
      !this.VALID_ENGAGEMENT_MODELS.includes(rateCard.engagementModel)
    ) {
      errors.push({
        field: "engagementModel",
        message: `Invalid engagement model: ${rateCard.engagementModel}`,
        code: "INVALID_ENGAGEMENT_MODEL",
        severity: "error",
      });
    }

    // Approval status validation
    if (
      rateCard.approvalStatus &&
      !this.VALID_APPROVAL_STATUS.includes(rateCard.approvalStatus)
    ) {
      errors.push({
        field: "approvalStatus",
        message: `Invalid approval status: ${rateCard.approvalStatus}`,
        code: "INVALID_APPROVAL_STATUS",
        severity: "error",
      });
    }

    // Date validation
    if (rateCard.effectiveDate > new Date()) {
      warnings.push({
        field: "effectiveDate",
        message: "Effective date is in the future",
        recommendation: "Verify effective date is correct",
      });
    }

    // Geographic validation
    if (rateCard.country || rateCard.stateProvince || rateCard.city) {
      const location: Location = {
        country: rateCard.country || "",
        stateProvince: rateCard.stateProvince,
        city: rateCard.city,
        costOfLivingIndex: rateCard.costOfLivingIndex,
      };

      const geoValidation = await this.validateGeographicData(location);
      errors.push(...geoValidation.errors);
      warnings.push(...geoValidation.warnings);
      suggestions.push(...geoValidation.suggestions);
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  private async validateRate(rate: EnhancedRate): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: CorrectionSuggestion[] = [];

    // Rate consistency validation
    const consistencyValidation = this.validateRateConsistency(rate);
    errors.push(...consistencyValidation.errors);
    warnings.push(...consistencyValidation.warnings);
    suggestions.push(...consistencyValidation.suggestions);

    // Seniority validation
    if (rate.seniorityLevel) {
      const seniorityValidation = this.validateSeniorityAlignment(
        rate.seniorityLevel,
        rate.role,
        rate.minimumExperienceYears
      );
      errors.push(...seniorityValidation.errors);
      warnings.push(...seniorityValidation.warnings);
      suggestions.push(...seniorityValidation.suggestions);
    }

    // Skills validation
    if (rate.requiredSkills && rate.requiredSkills.length > 0) {
      const skillsValidation = await this.validateSkillRequirements(
        rate.requiredSkills,
        rate.role
      );
      errors.push(...skillsValidation.errors);
      warnings.push(...skillsValidation.warnings);
      suggestions.push(...skillsValidation.suggestions);
    }

    // Business logic validation
    if (rate.travelPercentage > 100) {
      errors.push({
        field: "travelPercentage",
        message: "Travel percentage cannot exceed 100%",
        code: "INVALID_TRAVEL_PERCENTAGE",
        severity: "error",
      });
    }

    if (rate.overtimeMultiplier < 1) {
      warnings.push({
        field: "overtimeMultiplier",
        message: "Overtime multiplier less than 1.0 is unusual",
        recommendation: "Verify overtime multiplier (typical: 1.5)",
      });
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  private async validateRateCardRateConsistency(
    rateCard: EnhancedRateCard,
    rates: EnhancedRate[]
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: CorrectionSuggestion[] = [];

    // Check if rates exist
    if (rates.length === 0) {
      warnings.push({
        field: "rates",
        message: "No rates defined for this rate card",
        recommendation: "Add at least one rate to make the rate card useful",
      });
    }

    // Check currency consistency
    rates.forEach((rate, index) => {
      // All rates should be in the same currency as the rate card
      // This is implicit since rates don't have their own currency field
      // but we can validate related fields

      if (
        rate.effectiveStartDate &&
        rate.effectiveStartDate < rateCard.effectiveDate
      ) {
        warnings.push({
          field: `rates[${index}].effectiveStartDate`,
          message:
            "Rate effective start date is before rate card effective date",
          recommendation: "Align rate and rate card effective dates",
        });
      }
    });

    // Check for duplicate roles at same seniority level
    const roleMap = new Map<string, EnhancedRate[]>();
    rates.forEach((rate) => {
      const key = `${rate.role}-${rate.seniorityLevel}`;
      if (!roleMap.has(key)) {
        roleMap.set(key, []);
      }
      roleMap.get(key)!.push(rate);
    });

    roleMap.forEach((duplicates, key) => {
      if (duplicates.length > 1) {
        warnings.push({
          field: "rates",
          message: `Multiple rates found for ${key}`,
          recommendation:
            "Consider consolidating or differentiating duplicate rates",
        });
      }
    });

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private findSimilarCountryCode(country: string): string | null {
    // Simple similarity matching - in production, use more sophisticated matching
    const similarities: Record<string, string> = {
      US: "USA",
      UK: "GBR",
      CA: "CAN",
      AU: "AUS",
      IN: "IND",
      DE: "DEU",
      FR: "FRA",
      JP: "JPN",
    };

    return similarities[country.toUpperCase()] || null;
  }

  private async validateCountryStateCombo(
    country: string,
    state: string
  ): Promise<boolean> {
    // In production, this would check against a geographic database
    // For now, simple validation for common countries
    const validCombos: Record<string, string[]> = {
      USA: ["CA", "NY", "TX", "FL", "WA", "IL"], // Sample states
      CAN: ["ON", "BC", "AB", "QC"], // Sample provinces
      AUS: ["NSW", "VIC", "QLD", "WA"], // Sample states
    };

    return validCombos[country]?.includes(state) ?? true; // Default to valid if not in our list
  }

  private async checkSkillInRegistry(skillName: string): Promise<boolean> {
    try {
      const query =
        "SELECT 1 FROM skills_registry WHERE skill_name = ? LIMIT 1";
      const result = await dbAdaptor.prisma.$queryRawUnsafe(query, skillName);
      return Array.isArray(result) && result.length > 0;
    } catch (error) {
      logger.warn({ error, skillName }, "Failed to check skill in registry");
      return true; // Default to valid if check fails
    }
  }

  private async findSimilarSkill(skillName: string): Promise<string | null> {
    try {
      // Simple similarity search - in production, use fuzzy matching
      const query = `
        SELECT skill_name FROM skills_registry 
        WHERE skill_name LIKE ? 
        ORDER BY LENGTH(skill_name) 
        LIMIT 1
      `;
      const [result] = (await dbAdaptor.prisma.$queryRawUnsafe(
        query,
        `%${skillName}%`
      )) as any[];
      return result?.skill_name || null;
    } catch (error) {
      logger.warn({ error, skillName }, "Failed to find similar skill");
      return null;
    }
  }

  private async validateRoleSkillAlignment(
    role: string,
    skills: Skill[]
  ): Promise<{ isAligned: boolean; message?: string }> {
    // Simplified role-skill alignment check
    // In production, this would use ML or comprehensive mapping

    const technicalRoles = ["Developer", "Engineer", "Architect", "Analyst"];
    const managementRoles = ["Manager", "Director", "Lead"];

    const hasTechnicalSkills = skills.some((s) => s.category === "Technical");
    const hasLeadershipSkills = skills.some((s) => s.category === "Leadership");

    const isTechnicalRole = technicalRoles.some((tr) => role.includes(tr));
    const isManagementRole = managementRoles.some((mr) => role.includes(mr));

    if (isTechnicalRole && !hasTechnicalSkills) {
      return {
        isAligned: false,
        message: "Technical role should have technical skills",
      };
    }

    if (isManagementRole && !hasLeadershipSkills) {
      return {
        isAligned: false,
        message: "Management role should have leadership skills",
      };
    }

    return { isAligned: true };
  }

  private findDuplicateSkills(skills: Skill[]): string[] {
    const skillNames = skills.map((s) => s.name.toLowerCase());
    const duplicates = skillNames.filter(
      (name, index) => skillNames.indexOf(name) !== index
    );
    return [...new Set(duplicates)];
  }

  private getExpectedExperienceRange(seniority: SeniorityLevel): {
    min: number;
    max: number;
  } {
    const ranges: Record<SeniorityLevel, { min: number; max: number }> = {
      Junior: { min: 0, max: 3 },
      "Mid-Level": { min: 2, max: 6 },
      Senior: { min: 5, max: 10 },
      Lead: { min: 8, max: 15 },
      Principal: { min: 12, max: 20 },
      Director: { min: 15, max: 25 },
    };

    return ranges[seniority] || { min: 0, max: 50 };
  }

  private suggestSeniorityForExperience(experience: number): SeniorityLevel {
    if (experience <= 2) return "Junior";
    if (experience <= 5) return "Mid-Level";
    if (experience <= 8) return "Senior";
    if (experience <= 12) return "Lead";
    if (experience <= 18) return "Principal";
    return "Director";
  }

  private validateRoleSeniorityAlignment(
    role: string,
    seniority: SeniorityLevel
  ): { isValid: boolean; message?: string } {
    // Simplified validation - in production, use comprehensive role taxonomy
    const seniorRoles = ["Architect", "Principal", "Director", "VP"];
    const juniorRoles = ["Intern", "Associate", "Assistant"];

    const isSeniorRole = seniorRoles.some((sr) => role.includes(sr));
    const isJuniorRole = juniorRoles.some((jr) => role.includes(jr));

    if (isSeniorRole && ["Junior", "Mid-Level"].includes(seniority)) {
      return {
        isValid: false,
        message: "Senior role title with junior seniority level",
      };
    }

    if (isJuniorRole && ["Lead", "Principal", "Director"].includes(seniority)) {
      return {
        isValid: false,
        message: "Junior role title with senior seniority level",
      };
    }

    return { isValid: true };
  }

  private generateGenericSuggestion(
    error: ValidationError
  ): CorrectionSuggestion | null {
    // Generate generic suggestions based on field patterns
    if (error.field.includes("rate") || error.field.includes("Rate")) {
      return {
        field: error.field,
        currentValue: null,
        suggestedValue: 100,
        reason: "Default rate suggestion",
        confidence: 0.3,
      };
    }

    return null;
  }

  /**
   * Health check for the validation service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic validation functionality
      const testRate: Partial<EnhancedRate> = {
        id: "test",
        rateCardId: "test",
        role: "Test Role",
        seniorityLevel: "Mid-Level",
        hourlyRate: 100,
        billableHours: 8,
        requiredSkills: [],
        requiredCertifications: [],
        securityClearanceRequired: false,
        remoteWorkAllowed: true,
        travelPercentage: 0,
        rateType: "standard",
        overtimeMultiplier: 1.5,
        createdAt: new Date(),
      };

      const validation = this.validateRateConsistency(testRate as EnhancedRate);
      return validation.isValid;
    } catch (error) {
      logger.error({ error }, "Rate validation service health check failed");
      return false;
    }
  }
}

export const rateValidationService = RateValidationService.getInstance();
