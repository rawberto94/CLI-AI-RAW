/**
 * Tooltip Content Library
 * Centralized tooltip content for the application
 */

import { TooltipStep } from '@/components/ui/tooltip-enhanced';

export const tooltipContent = {
  // Upload Zone
  uploadZone: {
    simple: 'Drag and drop your rate card file here, or click to browse. Supported formats: .xlsx, .xls, .csv (max 10MB)',
    steps: [
      {
        title: 'Supported File Types',
        content: 'We accept Excel (.xlsx, .xls) and CSV (.csv) files.',
        example: 'rate-card-2024.xlsx',
      },
      {
        title: 'File Size Limit',
        content: 'Maximum file size is 10MB. For larger files, split them or export as CSV.',
      },
      {
        title: 'What Happens Next',
        content: 'After upload, we'll analyze your file and help you map columns to our system.',
      },
    ] as TooltipStep[],
  },

  // Column Mapping
  confidenceScore: {
    simple: 'Confidence score shows how sure we are about this column mapping. Review anything below 70%.',
    steps: [
      {
        title: 'What is Confidence Score?',
        content: 'A percentage showing how confident we are that this column mapping is correct.',
      },
      {
        title: 'Score Ranges',
        content: '90-100%: Very confident\n70-89%: Confident\n50-69%: Uncertain\nBelow 50%: Needs review',
      },
      {
        title: 'What to Do',
        content: 'Green scores (70%+) are usually correct. Yellow/red scores need your review.',
      },
    ] as TooltipStep[],
  },

  columnMapping: {
    simple: 'Match your file's columns to our system fields. We've suggested mappings based on column names.',
  },

  fuzzyMatching: {
    simple: 'We use smart matching to find similar column names, even with typos or different formats.',
    steps: [
      {
        title: 'How It Works',
        content: 'Our system compares your column names to standard field names, accounting for variations.',
        example: '"Daily Rate" matches "Rate (Daily)"',
      },
      {
        title: 'Common Variations',
        content: 'We recognize: Rate/Cost/Price, Role/Position/Title, Location/Site/Office',
      },
    ] as TooltipStep[],
  },

  // Validation
  validationErrors: {
    simple: 'Issues found in your data. Fix them in your source file or use inline editing.',
  },

  requiredFields: {
    simple: 'These fields must have values for every row. Empty cells will cause errors.',
  },

  rateValidation: {
    simple: 'Rates must be positive numbers without currency symbols.',
    steps: [
      {
        title: 'Valid Formats',
        content: 'Use numbers only, with decimal point if needed.',
        example: '150.50 or 1500',
      },
      {
        title: 'Invalid Formats',
        content: 'Don't use: $150, £150, 150,50 (comma), or negative numbers',
      },
    ] as TooltipStep[],
  },

  duplicateDetection: {
    simple: 'We found entries with the same role and location. Review to keep the most recent or merge them.',
  },

  // Rate Normalization
  ratePeriods: {
    simple: 'We'll convert all rates to your preferred period (daily, monthly, or annual).',
    steps: [
      {
        title: 'Automatic Conversion',
        content: 'Rates are automatically converted based on standard working days.',
        example: 'Daily → Monthly: × 21 days\nMonthly → Annual: × 12 months',
      },
      {
        title: 'Why Normalize?',
        content: 'Consistent periods make it easy to compare rates across suppliers.',
      },
    ] as TooltipStep[],
  },

  currencyConversion: {
    simple: 'All rates will be converted to your base currency using current exchange rates.',
  },

  // Templates
  templates: {
    simple: 'Save your column mappings as a template to reuse for future imports from the same supplier.',
    steps: [
      {
        title: 'What Are Templates?',
        content: 'Templates remember how you mapped columns, so you don't have to do it again.',
      },
      {
        title: 'When to Use',
        content: 'Create a template after successfully importing from a supplier for the first time.',
      },
      {
        title: 'Reusing Templates',
        content: 'Next time you import from the same supplier, select their template to auto-map columns.',
      },
    ] as TooltipStep[],
  },

  templateUsage: {
    simple: 'This template has been used X times. Templates improve accuracy over time.',
  },

  // Data Quality
  dataQuality: {
    simple: 'Overall quality score based on completeness, accuracy, and consistency of your data.',
  },

  outlierDetection: {
    simple: 'Rates that are significantly higher or lower than similar roles. Review for accuracy.',
  },

  // Import History
  importStatus: {
    simple: 'Track the status of your imports: pending, processing, complete, or failed.',
  },

  importStats: {
    simple: 'Summary of records imported, validation errors, and processing time.',
  },

  // General
  helpIcon: {
    simple: 'Click for more information about this feature.',
  },

  beta: {
    simple: 'This feature is in beta. We're actively improving it based on your feedback.',
  },
};

/**
 * Get tooltip content by key
 */
export function getTooltip(key: string): string | TooltipStep[] {
  const keys = key.split('.');
  let content: any = tooltipContent;
  
  for (const k of keys) {
    content = content[k];
    if (!content) return 'No tooltip available';
  }
  
  return content.simple || content.steps || content;
}

/**
 * Get multi-step tooltip
 */
export function getMultiStepTooltip(key: string): TooltipStep[] | null {
  const keys = key.split('.');
  let content: any = tooltipContent;
  
  for (const k of keys) {
    content = content[k];
    if (!content) return null;
  }
  
  return content.steps || null;
}
