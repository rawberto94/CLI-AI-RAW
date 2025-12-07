/**
 * Contract Type Templates
 * 
 * Pre-configured extraction templates for common contract types.
 * Each template defines expected fields, extraction hints, and validation rules
 * specific to that contract type.
 */

import type { MetadataFieldDefinition } from '@/lib/services/metadata-schema.service';

// ============================================================================
// Types
// ============================================================================

export interface ContractTypeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'services' | 'employment' | 'licensing' | 'commercial' | 'legal' | 'other';
  
  // Detection patterns to identify this contract type
  detectionPatterns: string[];
  detectionKeywords: string[];
  
  // Fields that are typically present in this contract type
  expectedFields: TemplateField[];
  
  // Fields that are critical for this contract type
  criticalFields: string[];
  
  // Extraction hints specific to this contract type
  extractionHints: Record<string, string>;
  
  // Validation rules specific to this contract type
  validationRules: TemplateValidationRule[];
}

export interface TemplateField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  extractionHint: string;
  defaultValue?: any;
}

export interface TemplateValidationRule {
  field: string;
  rule: string;
  message: string;
}

// ============================================================================
// Contract Type Templates
// ============================================================================

export const CONTRACT_TEMPLATES: ContractTypeTemplate[] = [
  // -------------------------------------------------------------------------
  // Master Service Agreement (MSA)
  // -------------------------------------------------------------------------
  {
    id: 'msa',
    name: 'Master Service Agreement',
    description: 'Framework agreement for ongoing service relationships',
    category: 'services',
    detectionPatterns: [
      'master service agreement',
      'master services agreement',
      'framework agreement',
      'general terms and conditions',
    ],
    detectionKeywords: ['MSA', 'master', 'framework', 'general terms', 'services'],
    expectedFields: [
      { name: 'client_name', label: 'Client', type: 'text', required: true, extractionHint: 'Look for the party receiving services' },
      { name: 'supplier_name', label: 'Service Provider', type: 'text', required: true, extractionHint: 'Look for the party providing services' },
      { name: 'effective_date', label: 'Effective Date', type: 'date', required: true, extractionHint: 'When the agreement becomes effective' },
      { name: 'term_length', label: 'Initial Term', type: 'duration', required: false, extractionHint: 'Duration of initial term in months/years' },
      { name: 'auto_renewal', label: 'Auto Renewal', type: 'boolean', required: false, extractionHint: 'Does the agreement auto-renew?' },
      { name: 'notice_period', label: 'Termination Notice Period', type: 'duration', required: false, extractionHint: 'Notice required for termination' },
      { name: 'governing_law', label: 'Governing Law', type: 'text', required: false, extractionHint: 'Jurisdiction or governing law' },
      { name: 'liability_cap', label: 'Liability Cap', type: 'currency', required: false, extractionHint: 'Maximum liability amount' },
    ],
    criticalFields: ['client_name', 'supplier_name', 'effective_date'],
    extractionHints: {
      parties: 'In MSAs, parties are typically defined in the preamble with "Party A" and "Party B" or similar designations',
      dates: 'Look for "Effective Date", "Commencement Date", or signature dates',
      term: 'Term is usually in a dedicated section called "Term" or "Duration"',
    },
    validationRules: [
      { field: 'term_length', rule: 'min:30', message: 'MSA term should be at least 30 days' },
      { field: 'notice_period', rule: 'min:30', message: 'Notice period should be at least 30 days' },
    ],
  },

  // -------------------------------------------------------------------------
  // Statement of Work (SOW)
  // -------------------------------------------------------------------------
  {
    id: 'sow',
    name: 'Statement of Work',
    description: 'Specific project or deliverable scope under an MSA',
    category: 'services',
    detectionPatterns: [
      'statement of work',
      'scope of work',
      'work order',
      'task order',
      'project agreement',
    ],
    detectionKeywords: ['SOW', 'scope', 'deliverables', 'milestones', 'project'],
    expectedFields: [
      { name: 'project_name', label: 'Project Name', type: 'text', required: true, extractionHint: 'Project or engagement name' },
      { name: 'sow_number', label: 'SOW Number', type: 'text', required: false, extractionHint: 'SOW reference number' },
      { name: 'parent_msa', label: 'Related MSA', type: 'text', required: false, extractionHint: 'Reference to parent MSA' },
      { name: 'start_date', label: 'Start Date', type: 'date', required: true, extractionHint: 'Project start date' },
      { name: 'end_date', label: 'End Date', type: 'date', required: false, extractionHint: 'Project end or delivery date' },
      { name: 'total_value', label: 'Total Value', type: 'currency', required: true, extractionHint: 'Total project value or fees' },
      { name: 'payment_terms', label: 'Payment Terms', type: 'text', required: false, extractionHint: 'Payment schedule or milestones' },
      { name: 'hourly_rate', label: 'Hourly Rate', type: 'currency', required: false, extractionHint: 'Hourly or day rate if applicable' },
      { name: 'project_manager', label: 'Project Manager', type: 'text', required: false, extractionHint: 'Primary contact or PM' },
    ],
    criticalFields: ['project_name', 'start_date', 'total_value'],
    extractionHints: {
      value: 'SOW value is often in a pricing section or fee schedule',
      deliverables: 'Look for numbered deliverables or milestone tables',
      timeline: 'Timeline often in a Gantt chart or milestone schedule',
    },
    validationRules: [
      { field: 'total_value', rule: 'min:0', message: 'Total value must be positive' },
      { field: 'end_date', rule: 'after:start_date', message: 'End date must be after start date' },
    ],
  },

  // -------------------------------------------------------------------------
  // Non-Disclosure Agreement (NDA)
  // -------------------------------------------------------------------------
  {
    id: 'nda',
    name: 'Non-Disclosure Agreement',
    description: 'Confidentiality agreement between parties',
    category: 'legal',
    detectionPatterns: [
      'non-disclosure agreement',
      'nondisclosure agreement',
      'confidentiality agreement',
      'confidential information agreement',
      'secrecy agreement',
    ],
    detectionKeywords: ['NDA', 'confidential', 'non-disclosure', 'proprietary', 'secret'],
    expectedFields: [
      { name: 'disclosing_party', label: 'Disclosing Party', type: 'text', required: true, extractionHint: 'Party sharing confidential information' },
      { name: 'receiving_party', label: 'Receiving Party', type: 'text', required: true, extractionHint: 'Party receiving confidential information' },
      { name: 'effective_date', label: 'Effective Date', type: 'date', required: true, extractionHint: 'When NDA becomes effective' },
      { name: 'term_length', label: 'Confidentiality Period', type: 'duration', required: false, extractionHint: 'How long information must be kept confidential' },
      { name: 'nda_type', label: 'NDA Type', type: 'select', required: false, extractionHint: 'Mutual or one-way NDA' },
      { name: 'purpose', label: 'Purpose', type: 'textarea', required: false, extractionHint: 'Purpose of the disclosure' },
      { name: 'exclusions', label: 'Exclusions', type: 'textarea', required: false, extractionHint: 'What is not covered by confidentiality' },
    ],
    criticalFields: ['disclosing_party', 'receiving_party', 'effective_date'],
    extractionHints: {
      parties: 'NDAs clearly identify disclosing and receiving parties',
      type: 'Look for "mutual" or "one-way" / "unilateral" designation',
      term: 'Confidentiality obligations often survive the agreement term',
    },
    validationRules: [
      { field: 'term_length', rule: 'min:365', message: 'Confidentiality period is typically at least 1 year' },
    ],
  },

  // -------------------------------------------------------------------------
  // SaaS Agreement
  // -------------------------------------------------------------------------
  {
    id: 'saas',
    name: 'SaaS Agreement',
    description: 'Software as a Service subscription agreement',
    category: 'licensing',
    detectionPatterns: [
      'saas agreement',
      'software as a service',
      'subscription agreement',
      'cloud services agreement',
      'online services agreement',
    ],
    detectionKeywords: ['SaaS', 'subscription', 'cloud', 'software', 'license', 'users', 'seats'],
    expectedFields: [
      { name: 'customer_name', label: 'Customer', type: 'text', required: true, extractionHint: 'Subscribing customer' },
      { name: 'provider_name', label: 'Provider', type: 'text', required: true, extractionHint: 'SaaS provider' },
      { name: 'service_name', label: 'Service/Product Name', type: 'text', required: false, extractionHint: 'Name of the SaaS product' },
      { name: 'start_date', label: 'Subscription Start', type: 'date', required: true, extractionHint: 'When subscription begins' },
      { name: 'subscription_term', label: 'Subscription Term', type: 'duration', required: false, extractionHint: 'Initial subscription period' },
      { name: 'monthly_fee', label: 'Monthly Fee', type: 'currency', required: false, extractionHint: 'Monthly subscription cost' },
      { name: 'annual_fee', label: 'Annual Fee', type: 'currency', required: false, extractionHint: 'Annual subscription cost' },
      { name: 'user_count', label: 'Licensed Users', type: 'number', required: false, extractionHint: 'Number of user seats/licenses' },
      { name: 'sla_uptime', label: 'SLA Uptime', type: 'percentage', required: false, extractionHint: 'Guaranteed uptime percentage' },
      { name: 'data_location', label: 'Data Location', type: 'text', required: false, extractionHint: 'Where data is stored/processed' },
    ],
    criticalFields: ['customer_name', 'provider_name', 'start_date'],
    extractionHints: {
      pricing: 'Look for pricing tables, subscription tiers, or order forms',
      sla: 'SLA details often in a separate section or attachment',
      users: 'User counts may be in an order form or license schedule',
    },
    validationRules: [
      { field: 'sla_uptime', rule: 'min:99', message: 'SLA uptime typically 99% or higher' },
      { field: 'user_count', rule: 'min:1', message: 'At least 1 user required' },
    ],
  },

  // -------------------------------------------------------------------------
  // Employment Contract
  // -------------------------------------------------------------------------
  {
    id: 'employment',
    name: 'Employment Contract',
    description: 'Agreement between employer and employee',
    category: 'employment',
    detectionPatterns: [
      'employment agreement',
      'employment contract',
      'offer letter',
      'employment offer',
      'contract of employment',
    ],
    detectionKeywords: ['employee', 'employer', 'salary', 'compensation', 'benefits', 'position', 'role'],
    expectedFields: [
      { name: 'employer_name', label: 'Employer', type: 'text', required: true, extractionHint: 'Employing company' },
      { name: 'employee_name', label: 'Employee', type: 'text', required: true, extractionHint: 'Employee name' },
      { name: 'job_title', label: 'Job Title', type: 'text', required: true, extractionHint: 'Position or role title' },
      { name: 'start_date', label: 'Start Date', type: 'date', required: true, extractionHint: 'Employment start date' },
      { name: 'salary', label: 'Base Salary', type: 'currency', required: true, extractionHint: 'Annual or monthly salary' },
      { name: 'salary_frequency', label: 'Pay Frequency', type: 'select', required: false, extractionHint: 'Monthly, bi-weekly, etc.' },
      { name: 'bonus_target', label: 'Bonus Target', type: 'percentage', required: false, extractionHint: 'Target bonus percentage' },
      { name: 'notice_period', label: 'Notice Period', type: 'duration', required: false, extractionHint: 'Required notice for termination' },
      { name: 'probation_period', label: 'Probation Period', type: 'duration', required: false, extractionHint: 'Initial probationary period' },
      { name: 'vacation_days', label: 'Annual Leave', type: 'number', required: false, extractionHint: 'Days of annual leave' },
      { name: 'work_location', label: 'Work Location', type: 'text', required: false, extractionHint: 'Primary work location' },
    ],
    criticalFields: ['employer_name', 'employee_name', 'job_title', 'start_date', 'salary'],
    extractionHints: {
      salary: 'Salary may be listed as annual, monthly, or hourly - note the frequency',
      benefits: 'Benefits often in a separate section or reference to company policy',
      location: 'Look for office location, remote work provisions, or "principal place of work"',
    },
    validationRules: [
      { field: 'salary', rule: 'min:0', message: 'Salary must be positive' },
      { field: 'vacation_days', rule: 'min:0', message: 'Vacation days must be positive' },
    ],
  },

  // -------------------------------------------------------------------------
  // License Agreement
  // -------------------------------------------------------------------------
  {
    id: 'license',
    name: 'License Agreement',
    description: 'Software or intellectual property license',
    category: 'licensing',
    detectionPatterns: [
      'license agreement',
      'software license',
      'end user license',
      'eula',
      'licensing agreement',
    ],
    detectionKeywords: ['license', 'licensed', 'licensor', 'licensee', 'intellectual property', 'rights'],
    expectedFields: [
      { name: 'licensor_name', label: 'Licensor', type: 'text', required: true, extractionHint: 'Party granting the license' },
      { name: 'licensee_name', label: 'Licensee', type: 'text', required: true, extractionHint: 'Party receiving the license' },
      { name: 'product_name', label: 'Licensed Product', type: 'text', required: true, extractionHint: 'Name of licensed software/IP' },
      { name: 'license_type', label: 'License Type', type: 'select', required: false, extractionHint: 'Perpetual, subscription, etc.' },
      { name: 'effective_date', label: 'Effective Date', type: 'date', required: true, extractionHint: 'When license becomes effective' },
      { name: 'license_fee', label: 'License Fee', type: 'currency', required: false, extractionHint: 'One-time or recurring fee' },
      { name: 'maintenance_fee', label: 'Maintenance Fee', type: 'currency', required: false, extractionHint: 'Annual maintenance/support' },
      { name: 'scope', label: 'License Scope', type: 'textarea', required: false, extractionHint: 'Permitted use and restrictions' },
    ],
    criticalFields: ['licensor_name', 'licensee_name', 'product_name'],
    extractionHints: {
      type: 'Look for "perpetual", "term", "subscription", "site license", "per-seat"',
      restrictions: 'Check for use limitations, territory restrictions, sublicensing rights',
      ip: 'IP ownership clauses are critical in license agreements',
    },
    validationRules: [],
  },

  // -------------------------------------------------------------------------
  // Vendor Agreement
  // -------------------------------------------------------------------------
  {
    id: 'vendor',
    name: 'Vendor Agreement',
    description: 'Agreement with a supplier or vendor',
    category: 'commercial',
    detectionPatterns: [
      'vendor agreement',
      'supplier agreement',
      'purchase agreement',
      'procurement agreement',
      'supply agreement',
    ],
    detectionKeywords: ['vendor', 'supplier', 'purchase', 'supply', 'goods', 'procurement'],
    expectedFields: [
      { name: 'buyer_name', label: 'Buyer', type: 'text', required: true, extractionHint: 'Purchasing party' },
      { name: 'vendor_name', label: 'Vendor', type: 'text', required: true, extractionHint: 'Supplying party' },
      { name: 'effective_date', label: 'Effective Date', type: 'date', required: true, extractionHint: 'Agreement start date' },
      { name: 'products_services', label: 'Products/Services', type: 'textarea', required: false, extractionHint: 'What is being purchased' },
      { name: 'contract_value', label: 'Contract Value', type: 'currency', required: false, extractionHint: 'Total or estimated value' },
      { name: 'payment_terms', label: 'Payment Terms', type: 'text', required: false, extractionHint: 'Net 30, 60, etc.' },
      { name: 'delivery_terms', label: 'Delivery Terms', type: 'text', required: false, extractionHint: 'Delivery schedule or incoterms' },
      { name: 'warranty_period', label: 'Warranty Period', type: 'duration', required: false, extractionHint: 'Product warranty duration' },
    ],
    criticalFields: ['buyer_name', 'vendor_name', 'effective_date'],
    extractionHints: {
      pricing: 'Look for pricing schedules, rate cards, or order forms',
      delivery: 'Check for delivery schedules, shipping terms, or lead times',
      warranty: 'Warranty terms often in a specific section or product specifications',
    },
    validationRules: [],
  },
];

// ============================================================================
// Template Functions
// ============================================================================

/**
 * Detect contract type from document text
 */
export function detectContractType(documentText: string): ContractTypeTemplate | null {
  const text = documentText.toLowerCase();
  
  // Score each template
  const scores = CONTRACT_TEMPLATES.map(template => {
    let score = 0;
    
    // Check detection patterns (highest weight)
    for (const pattern of template.detectionPatterns) {
      if (text.includes(pattern.toLowerCase())) {
        score += 10;
      }
    }
    
    // Check keywords
    for (const keyword of template.detectionKeywords) {
      const keywordLower = keyword.toLowerCase();
      const matches = (text.match(new RegExp(keywordLower, 'g')) || []).length;
      score += Math.min(matches, 5); // Cap at 5 matches per keyword
    }
    
    return { template, score };
  });
  
  // Sort by score and return best match if above threshold
  scores.sort((a, b) => b.score - a.score);
  
  const topScore = scores[0];
  if (topScore && topScore.score >= 15) {
    return topScore.template;
  }
  
  return null;
}

/**
 * Get extraction hints for a specific contract type
 */
export function getExtractionHintsForType(
  contractTypeId: string
): Record<string, string> {
  const template = CONTRACT_TEMPLATES.find(t => t.id === contractTypeId);
  if (!template) return {};
  
  const hints: Record<string, string> = { ...template.extractionHints };
  
  // Add field-specific hints
  for (const field of template.expectedFields) {
    hints[field.name] = field.extractionHint;
  }
  
  return hints;
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): ContractTypeTemplate | undefined {
  return CONTRACT_TEMPLATES.find(t => t.id === id);
}

/**
 * Get all templates
 */
export function getAllTemplates(): ContractTypeTemplate[] {
  return CONTRACT_TEMPLATES;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): ContractTypeTemplate[] {
  return CONTRACT_TEMPLATES.filter(t => t.category === category);
}

/**
 * Merge template fields with tenant's custom schema
 */
export function mergeTemplateWithSchema(
  template: ContractTypeTemplate,
  schemaFields: MetadataFieldDefinition[]
): MetadataFieldDefinition[] {
  const mergedFields: MetadataFieldDefinition[] = [...schemaFields];
  
  // For each template field, update the extraction hint if not set
  for (const templateField of template.expectedFields) {
    const existingField = mergedFields.find(f => f.name === templateField.name);
    
    if (existingField && !existingField.aiExtractionHint) {
      existingField.aiExtractionHint = templateField.extractionHint;
    }
  }
  
  return mergedFields;
}

/**
 * Validate extracted data against template rules
 */
export function validateAgainstTemplate(
  template: ContractTypeTemplate,
  extractedData: Record<string, any>
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  
  // Check critical fields
  for (const fieldName of template.criticalFields) {
    const value = extractedData[fieldName];
    if (value === null || value === undefined || value === '') {
      const field = template.expectedFields.find(f => f.name === fieldName);
      errors.push({
        field: fieldName,
        message: `Missing critical field: ${field?.label || fieldName}`,
      });
    }
  }
  
  // Apply template validation rules
  for (const rule of template.validationRules) {
    const value = extractedData[rule.field];
    if (value === null || value === undefined) continue;
    
    const ruleParts = rule.rule.split(':');
    const ruleType = ruleParts[0] ?? '';
    const ruleValue = ruleParts[1] ?? '';
    let isValid = true;
    
    switch (ruleType) {
      case 'min':
        isValid = typeof value === 'number' && value >= parseFloat(ruleValue);
        break;
      case 'max':
        isValid = typeof value === 'number' && value <= parseFloat(ruleValue);
        break;
      case 'after':
        if (ruleValue) {
          const compareValue = extractedData[ruleValue];
          if (value && compareValue) {
            isValid = new Date(value) > new Date(compareValue);
          }
        }
        break;
    }
    
    if (!isValid) {
      errors.push({ field: rule.field, message: rule.message });
    }
  }
  
  return errors;
}
