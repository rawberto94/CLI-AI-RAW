/**
 * Template Engine Service
 * 
 * Comprehensive contract template engine with:
 * - Variable substitution (simple & complex types)
 * - Conditional sections based on variables
 * - Clause library integration
 * - Table generation
 * - Signature block generation
 * - Multi-language support
 * - Validation & error handling
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean' | 'select' | 'party' | 'list';
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: string[]; // For select type
  validation?: VariableValidation;
  format?: string; // Date format, currency format, etc.
  description?: string;
}

export interface VariableValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customValidator?: string; // Function name for custom validation
}

export interface TemplateSection {
  id: string;
  heading: string;
  level: number; // 1-6 for h1-h6
  content: string;
  clauseId?: string;
  isOptional: boolean;
  condition?: SectionCondition;
  subsections?: TemplateSection[];
}

export interface SectionCondition {
  type: 'variable' | 'clause' | 'custom';
  variable?: string;
  operator?: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'exists';
  value?: string | number | boolean;
}

export interface TemplateContent {
  sections: TemplateSection[];
  styles?: TemplateStyles;
  header?: string;
  footer?: string;
}

export interface TemplateStyles {
  headingFont?: string;
  bodyFont?: string;
  fontSize?: number;
  lineHeight?: number;
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface PartyInfo {
  name: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  postalCode: string;
  contact: string;
  email: string;
  phone?: string;
  title?: string;
  taxId?: string;
}

export interface GenerationOptions {
  format: 'html' | 'text' | 'ooxml' | 'docx';
  includeTableOfContents?: boolean;
  includeSignatureBlocks?: boolean;
  includePageNumbers?: boolean;
  signatureParties?: Array<{ name: string; title: string; company: string }>;
  language?: string;
}

export interface GenerationResult {
  success: boolean;
  content: string;
  format: string;
  errors?: string[];
  warnings?: string[];
  metadata: {
    templateId: string;
    variablesUsed: string[];
    clausesIncluded: string[];
    generatedAt: string;
  };
}

// ============================================================================
// TEMPLATE ENGINE CLASS
// ============================================================================

class TemplateEngine {
  private static instance: TemplateEngine;
  
  private variablePattern = /\{\{([^}]+)\}\}/g;
  private conditionalPattern = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  private loopPattern = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  private partialPattern = /\{\{>\s*([^}]+)\}\}/g;

  private constructor() {}

  static getInstance(): TemplateEngine {
    if (!TemplateEngine.instance) {
      TemplateEngine.instance = new TemplateEngine();
    }
    return TemplateEngine.instance;
  }

  // ============================================================================
  // MAIN GENERATION METHOD
  // ============================================================================

  async generateContract(
    templateId: string,
    tenantId: string,
    variables: Record<string, unknown>,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const clausesIncluded: string[] = [];

    try {
      // Fetch template
      const template = await this.fetchTemplate(templateId, tenantId);
      if (!template) {
        return {
          success: false,
          content: '',
          format: options.format,
          errors: ['Template not found'],
          metadata: {
            templateId,
            variablesUsed: [],
            clausesIncluded: [],
            generatedAt: new Date().toISOString(),
          },
        };
      }

      // Parse template content
      const templateContent = template.content as TemplateContent;
      
      // Validate required variables
      const validationResult = this.validateVariables(
        templateContent.sections,
        template.variables as TemplateVariable[],
        variables
      );
      
      if (validationResult.errors.length > 0) {
        errors.push(...validationResult.errors);
      }
      warnings.push(...validationResult.warnings);

      // Process template sections
      let content = '';
      
      // Add header if specified
      if (templateContent.header) {
        content += this.processText(templateContent.header, variables);
      }

      // Add table of contents if requested
      if (options.includeTableOfContents) {
        content += this.generateTableOfContents(templateContent.sections, variables);
      }

      // Process sections
      for (const section of templateContent.sections) {
        const sectionResult = await this.processSection(
          section,
          variables,
          tenantId,
          options.language
        );
        
        if (sectionResult.included) {
          content += sectionResult.content;
          clausesIncluded.push(...sectionResult.clausesUsed);
        }
      }

      // Add signature blocks if requested
      if (options.includeSignatureBlocks && options.signatureParties) {
        content += this.generateSignatureBlocks(options.signatureParties, options.format);
      }

      // Add footer if specified
      if (templateContent.footer) {
        content += this.processText(templateContent.footer, variables);
      }

      // Format output
      const formattedContent = this.formatOutput(content, options.format, templateContent.styles);

      return {
        success: errors.length === 0,
        content: formattedContent,
        format: options.format,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          templateId,
          variablesUsed: Object.keys(variables),
          clausesIncluded,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Template generation error:', error);
      return {
        success: false,
        content: '',
        format: options.format,
        errors: ['Generation failed: ' + (error instanceof Error ? error.message : 'Unknown error')],
        metadata: {
          templateId,
          variablesUsed: [],
          clausesIncluded: [],
          generatedAt: new Date().toISOString(),
        },
      };
    }
  }

  // ============================================================================
  // TEMPLATE & CLAUSE FETCHING
  // ============================================================================

  private async fetchTemplate(templateId: string, tenantId: string) {
    return prisma.contractTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
      },
    });
  }

  private async fetchClause(clauseId: string, tenantId: string) {
    return prisma.clause.findFirst({
      where: {
        id: clauseId,
        tenantId,
      },
    });
  }

  // ============================================================================
  // VARIABLE VALIDATION
  // ============================================================================

  private validateVariables(
    sections: TemplateSection[],
    variableDefinitions: TemplateVariable[] = [],
    providedVariables: Record<string, unknown>
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Extract all variable names used in sections
    const usedVariables = new Set<string>();
    const extractVariables = (text: string) => {
      let match;
      while ((match = this.variablePattern.exec(text)) !== null) {
        usedVariables.add(match[1].trim());
      }
    };

    const processSection = (section: TemplateSection) => {
      extractVariables(section.heading);
      extractVariables(section.content);
      section.subsections?.forEach(processSection);
    };
    
    sections.forEach(processSection);

    // Check required variables
    for (const def of variableDefinitions) {
      if (def.required && !(def.name in providedVariables)) {
        errors.push(`Required variable '${def.name}' is missing`);
      }
      
      if (def.name in providedVariables) {
        const value = providedVariables[def.name];
        const validation = def.validation;
        
        if (validation) {
          if (validation.minLength && typeof value === 'string' && value.length < validation.minLength) {
            errors.push(`Variable '${def.name}' must be at least ${validation.minLength} characters`);
          }
          if (validation.maxLength && typeof value === 'string' && value.length > validation.maxLength) {
            errors.push(`Variable '${def.name}' must be at most ${validation.maxLength} characters`);
          }
          if (validation.min !== undefined && typeof value === 'number' && value < validation.min) {
            errors.push(`Variable '${def.name}' must be at least ${validation.min}`);
          }
          if (validation.max !== undefined && typeof value === 'number' && value > validation.max) {
            errors.push(`Variable '${def.name}' must be at most ${validation.max}`);
          }
          if (validation.pattern && typeof value === 'string') {
            const regex = new RegExp(validation.pattern);
            if (!regex.test(value)) {
              errors.push(`Variable '${def.name}' does not match required pattern`);
            }
          }
        }
      }
    }

    // Warn about unused provided variables
    for (const name of Object.keys(providedVariables)) {
      if (!usedVariables.has(name)) {
        warnings.push(`Variable '${name}' was provided but not used in template`);
      }
    }

    return { errors, warnings };
  }

  // ============================================================================
  // SECTION PROCESSING
  // ============================================================================

  private async processSection(
    section: TemplateSection,
    variables: Record<string, unknown>,
    tenantId: string,
    language?: string
  ): Promise<{ included: boolean; content: string; clausesUsed: string[] }> {
    const clausesUsed: string[] = [];

    // Check condition
    if (section.condition && !this.evaluateCondition(section.condition, variables)) {
      return { included: false, content: '', clausesUsed: [] };
    }

    // Get section content
    let sectionContent = section.content;
    
    // If clause is specified, fetch and use clause content
    if (section.clauseId) {
      const clause = await this.fetchClause(section.clauseId, tenantId);
      if (clause) {
        sectionContent = clause.content;
        clausesUsed.push(section.clauseId);
      }
    }

    // Process text (variable substitution, conditionals, loops)
    const processedContent = this.processText(sectionContent, variables);
    const processedHeading = this.processText(section.heading, variables);

    // Build section output
    let output = this.formatSection(processedHeading, section.level, processedContent);

    // Process subsections
    if (section.subsections) {
      for (const subsection of section.subsections) {
        const subResult = await this.processSection(subsection, variables, tenantId, language);
        if (subResult.included) {
          output += subResult.content;
          clausesUsed.push(...subResult.clausesUsed);
        }
      }
    }

    return { included: true, content: output, clausesUsed };
  }

  // ============================================================================
  // TEXT PROCESSING
  // ============================================================================

  private processText(text: string, variables: Record<string, unknown>): string {
    let result = text;

    // Process conditionals first
    result = this.processConditionals(result, variables);

    // Process loops
    result = this.processLoops(result, variables);

    // Process simple variable substitution
    result = this.processVariables(result, variables);

    return result;
  }

  private processVariables(text: string, variables: Record<string, unknown>): string {
    return text.replace(this.variablePattern, (match, varName) => {
      const name = varName.trim();
      const value = this.getNestedValue(variables, name);
      
      if (value === undefined || value === null) {
        return `[${name}]`; // Placeholder for missing values
      }

      // Format value based on type
      if (value instanceof Date) {
        return this.formatDate(value);
      }
      if (typeof value === 'number') {
        return this.formatNumber(value, name);
      }
      if (typeof value === 'object' && 'name' in value) {
        // Party object
        return (value as PartyInfo).name;
      }

      return String(value);
    });
  }

  private processConditionals(text: string, variables: Record<string, unknown>): string {
    return text.replace(this.conditionalPattern, (match, condition, content) => {
      const shouldInclude = this.evaluateSimpleCondition(condition.trim(), variables);
      return shouldInclude ? content : '';
    });
  }

  private processLoops(text: string, variables: Record<string, unknown>): string {
    return text.replace(this.loopPattern, (match, listName, template) => {
      const list = this.getNestedValue(variables, listName.trim());
      
      if (!Array.isArray(list)) {
        return '';
      }

      return list.map((item, index) => {
        const itemVars = {
          ...variables,
          item,
          index,
          first: index === 0,
          last: index === list.length - 1,
        };
        return this.processText(template, itemVars);
      }).join('');
    });
  }

  // ============================================================================
  // CONDITION EVALUATION
  // ============================================================================

  private evaluateCondition(condition: SectionCondition, variables: Record<string, unknown>): boolean {
    if (condition.type === 'variable' && condition.variable) {
      const value = this.getNestedValue(variables, condition.variable);
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'notEquals':
          return value !== condition.value;
        case 'contains':
          return typeof value === 'string' && value.includes(String(condition.value));
        case 'greaterThan':
          return typeof value === 'number' && value > Number(condition.value);
        case 'lessThan':
          return typeof value === 'number' && value < Number(condition.value);
        case 'exists':
          return value !== undefined && value !== null && value !== '';
        default:
          return !!value;
      }
    }
    
    return true;
  }

  private evaluateSimpleCondition(condition: string, variables: Record<string, unknown>): boolean {
    // Handle negation
    if (condition.startsWith('!')) {
      return !this.evaluateSimpleCondition(condition.slice(1), variables);
    }

    // Handle comparison operators
    const comparisonMatch = condition.match(/(\w+)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)/);
    if (comparisonMatch) {
      const [, varName, operator, compareValue] = comparisonMatch;
      const value = this.getNestedValue(variables, varName);
      let compareWith: unknown = compareValue.trim();
      
      // Parse comparison value
      if (compareWith === 'true') compareWith = true;
      else if (compareWith === 'false') compareWith = false;
      else if (compareWith.startsWith('"') && compareWith.endsWith('"')) {
        compareWith = compareWith.slice(1, -1);
      } else if (!isNaN(Number(compareWith))) {
        compareWith = Number(compareWith);
      }

      switch (operator) {
        case '===':
        case '==':
          return value === compareWith;
        case '!==':
        case '!=':
          return value !== compareWith;
        case '>=':
          return Number(value) >= Number(compareWith);
        case '<=':
          return Number(value) <= Number(compareWith);
        case '>':
          return Number(value) > Number(compareWith);
        case '<':
          return Number(value) < Number(compareWith);
      }
    }

    // Simple truthy check
    const value = this.getNestedValue(variables, condition);
    return !!value;
  }

  // ============================================================================
  // FORMATTING
  // ============================================================================

  private formatSection(heading: string, level: number, content: string): string {
    return `\n<h${level}>${heading}</h${level}>\n${content}\n`;
  }

  private formatOutput(content: string, format: string, styles?: TemplateStyles): string {
    switch (format) {
      case 'html':
        return this.wrapInHtml(content, styles);
      case 'text':
        return this.stripHtml(content);
      case 'ooxml':
        return this.convertToOoxml(content);
      default:
        return content;
    }
  }

  private wrapInHtml(content: string, styles?: TemplateStyles): string {
    const fontFamily = styles?.bodyFont || 'Arial, sans-serif';
    const fontSize = styles?.fontSize || 11;
    const lineHeight = styles?.lineHeight || 1.6;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: ${fontFamily};
      font-size: ${fontSize}pt;
      line-height: ${lineHeight};
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${styles?.headingFont || fontFamily};
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }
    h1 { font-size: 1.5em; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
    h2 { font-size: 1.3em; }
    h3 { font-size: 1.1em; }
    p { margin: 1em 0; }
    .signature-block {
      display: inline-block;
      width: 45%;
      margin: 40px 2.5%;
      vertical-align: top;
    }
    .signature-line {
      border-top: 1px solid #000;
      padding-top: 5px;
      margin-top: 50px;
    }
    .toc { margin: 20px 0; padding: 20px; background: #f5f5f5; }
    .toc a { text-decoration: none; color: #333; }
    .toc li { margin: 5px 0; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/gi, '\n$1\n')
      .replace(/<p[^>]*>([^<]*)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  private convertToOoxml(content: string): string {
    // Basic OOXML conversion - in production would use docx library
    return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${this.escapeXml(this.stripHtml(content))}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
  }

  // ============================================================================
  // SPECIAL CONTENT GENERATION
  // ============================================================================

  private generateTableOfContents(sections: TemplateSection[], variables: Record<string, unknown>): string {
    let toc = '<div class="toc"><h2>Table of Contents</h2><ol>';
    
    const addSection = (section: TemplateSection, depth: number) => {
      const heading = this.processVariables(section.heading, variables);
      const indent = '  '.repeat(depth);
      toc += `${indent}<li><a href="#section-${section.id}">${heading}</a>`;
      
      if (section.subsections && section.subsections.length > 0) {
        toc += '<ol>';
        section.subsections.forEach(sub => addSection(sub, depth + 1));
        toc += '</ol>';
      }
      
      toc += '</li>\n';
    };

    sections.forEach(s => addSection(s, 0));
    toc += '</ol></div>\n\n';
    
    return toc;
  }

  private generateSignatureBlocks(
    parties: Array<{ name: string; title: string; company: string }>,
    format: string
  ): string {
    if (format === 'text') {
      return parties.map(p => `
_____________________________
${p.name}
${p.title}
${p.company}
Date: _______________
`).join('\n\n');
    }

    return `
<div style="margin-top: 50px;">
  <h2>Signatures</h2>
  <p>IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.</p>
  ${parties.map(p => `
  <div class="signature-block">
    <div class="signature-line">
      <strong>${p.name}</strong><br>
      ${p.title}<br>
      ${p.company}
    </div>
    <p>Date: _________________</p>
  </div>
  `).join('')}
</div>`;
  }

  generateTable(
    headers: string[],
    rows: Array<Record<string, unknown>>,
    format: string
  ): string {
    if (format === 'text') {
      const headerRow = headers.join(' | ');
      const separator = headers.map(() => '---').join(' | ');
      const dataRows = rows.map(row => headers.map(h => String(row[h] || '')).join(' | ')).join('\n');
      return `${headerRow}\n${separator}\n${dataRows}`;
    }

    return `
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr>${headers.map(h => `<th style="border: 1px solid #ddd; padding: 10px; background: #f5f5f5;">${h}</th>`).join('')}</tr>
  </thead>
  <tbody>
    ${rows.map(row => `
    <tr>${headers.map(h => `<td style="border: 1px solid #ddd; padding: 10px;">${row[h] || ''}</td>`).join('')}</tr>
    `).join('')}
  </tbody>
</table>`;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  private formatDate(date: Date, format?: string): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  }

  private formatNumber(value: number, varName: string): string {
    const lowerName = varName.toLowerCase();
    
    if (lowerName.includes('amount') || lowerName.includes('value') || lowerName.includes('price')) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    }
    
    if (lowerName.includes('percent') || lowerName.includes('rate')) {
      return `${value}%`;
    }
    
    return new Intl.NumberFormat('en-US').format(value);
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Export singleton instance
export const templateEngine = TemplateEngine.getInstance();
