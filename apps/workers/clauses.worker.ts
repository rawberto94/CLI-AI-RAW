/**
 * Clauses Analysis Worker
 * Extracts and analyzes contract clauses
 */

export interface ContractClause {
  id: string;
  type: string;
  title: string;
  content: string;
  position: number;
  importance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  completeness: number;
  issues?: string[];
}

export interface ClauseCompleteness {
  score: number;
  missing: string[];
  present: string[];
  recommendations: string[];
}

export interface ClausesResult {
  clauses: ContractClause[];
  completeness: ClauseCompleteness;
  standardClauses: string[];
  customClauses: string[];
  error?: string;
}

export class ClausesWorker {
  private readonly standardClauseTypes = [
    'PAYMENT',
    'TERMINATION',
    'LIABILITY',
    'INTELLECTUAL_PROPERTY',
    'CONFIDENTIALITY',
    'FORCE_MAJEURE',
    'GOVERNING_LAW',
    'DISPUTE_RESOLUTION',
    'INDEMNIFICATION',
    'WARRANTIES'
  ];

  async process(contract: any): Promise<ClausesResult> {
    try {
      const text = contract.content || '';
      
      const clauses = this.extractClauses(text);
      const completeness = this.assessCompleteness(clauses);
      const standardClauses = this.identifyStandardClauses(clauses);
      const customClauses = this.identifyCustomClauses(clauses);

      return {
        clauses,
        completeness,
        standardClauses,
        customClauses
      };
    } catch (error) {
      return {
        clauses: [],
        completeness: {
          score: 0,
          missing: this.standardClauseTypes,
          present: [],
          recommendations: []
        },
        standardClauses: [],
        customClauses: [],
        error: error.message
      };
    }
  }

  private extractClauses(text: string): ContractClause[] {
    const clauses: ContractClause[] = [];
    
    // Split text into sections based on numbered headings
    const sections = text.split(/\n\s*\d+\.\s+/);
    
    sections.forEach((section, index) => {
      if (section.trim()) {
        const clause = this.analyzeClause(section, index);
        if (clause) {
          clauses.push(clause);
        }
      }
    });

    // If no numbered sections found, analyze by keywords
    if (clauses.length === 0) {
      clauses.push(...this.extractClausesByKeywords(text));
    }

    return clauses;
  }

  private analyzeClause(content: string, position: number): ContractClause | null {
    const trimmedContent = content.trim();
    if (trimmedContent.length < 20) return null;

    const type = this.classifyClause(trimmedContent);
    const title = this.extractClauseTitle(trimmedContent);
    const importance = this.assessImportance(type);
    const completeness = this.assessClauseCompleteness(trimmedContent, type);
    const issues = this.identifyClauseIssues(trimmedContent, type);

    return {
      id: `clause_${position}`,
      type,
      title,
      content: trimmedContent.substring(0, 500) + (trimmedContent.length > 500 ? '...' : ''),
      position,
      importance,
      completeness,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  private extractClausesByKeywords(text: string): ContractClause[] {
    const clauses: ContractClause[] = [];
    const keywordPatterns = [
      { type: 'PAYMENT', pattern: /payment|compensation|fee|invoice/i },
      { type: 'TERMINATION', pattern: /termination|terminate|end|expire/i },
      { type: 'LIABILITY', pattern: /liability|liable|damages|loss/i },
      { type: 'INTELLECTUAL_PROPERTY', pattern: /intellectual\s+property|copyright|patent|trademark/i },
      { type: 'CONFIDENTIALITY', pattern: /confidential|non.disclosure|proprietary/i },
      { type: 'FORCE_MAJEURE', pattern: /force\s+majeure|act\s+of\s+god|unforeseeable/i },
      { type: 'GOVERNING_LAW', pattern: /governing\s+law|jurisdiction|governed\s+by/i },
      { type: 'DISPUTE_RESOLUTION', pattern: /dispute|arbitration|mediation|litigation/i },
      { type: 'INDEMNIFICATION', pattern: /indemnif|hold\s+harmless/i },
      { type: 'WARRANTIES', pattern: /warrant|guarantee|represent/i }
    ];

    keywordPatterns.forEach((pattern, index) => {
      if (pattern.pattern.test(text)) {
        const match = text.match(new RegExp(`([^.]*${pattern.pattern.source}[^.]*\\.?)`, 'i'));
        if (match) {
          clauses.push({
            id: `keyword_clause_${index}`,
            type: pattern.type,
            title: this.getClauseTitle(pattern.type),
            content: match[1].trim(),
            position: index,
            importance: this.assessImportance(pattern.type),
            completeness: this.assessClauseCompleteness(match[1], pattern.type)
          });
        }
      }
    });

    return clauses;
  }

  private classifyClause(content: string): string {
    const classifications = [
      { pattern: /payment|compensation|fee|invoice|billing/i, type: 'PAYMENT' },
      { pattern: /termination|terminate|end|expire|cancel/i, type: 'TERMINATION' },
      { pattern: /liability|liable|damages|loss|harm/i, type: 'LIABILITY' },
      { pattern: /intellectual\s+property|copyright|patent|trademark|ip/i, type: 'INTELLECTUAL_PROPERTY' },
      { pattern: /confidential|non.disclosure|proprietary|secret/i, type: 'CONFIDENTIALITY' },
      { pattern: /force\s+majeure|act\s+of\s+god|unforeseeable|beyond.*control/i, type: 'FORCE_MAJEURE' },
      { pattern: /governing\s+law|jurisdiction|governed\s+by|applicable\s+law/i, type: 'GOVERNING_LAW' },
      { pattern: /dispute|arbitration|mediation|litigation|resolution/i, type: 'DISPUTE_RESOLUTION' },
      { pattern: /indemnif|hold\s+harmless|defend/i, type: 'INDEMNIFICATION' },
      { pattern: /warrant|guarantee|represent|assure/i, type: 'WARRANTIES' },
      { pattern: /service|perform|deliver|provide/i, type: 'SERVICES' },
      { pattern: /compliance|regulatory|law|regulation/i, type: 'COMPLIANCE' }
    ];

    for (const { pattern, type } of classifications) {
      if (pattern.test(content)) {
        return type;
      }
    }

    return 'GENERAL';
  }

  private extractClauseTitle(content: string): string {
    // Try to extract title from first line or sentence
    const firstLine = content.split('\n')[0].trim();
    const firstSentence = content.split('.')[0].trim();
    
    // Use the shorter one as title, but cap at reasonable length
    const title = firstLine.length < firstSentence.length ? firstLine : firstSentence;
    return title.length > 100 ? title.substring(0, 100) + '...' : title;
  }

  private getClauseTitle(type: string): string {
    const titles = {
      'PAYMENT': 'Payment Terms',
      'TERMINATION': 'Termination Clause',
      'LIABILITY': 'Liability and Damages',
      'INTELLECTUAL_PROPERTY': 'Intellectual Property Rights',
      'CONFIDENTIALITY': 'Confidentiality Agreement',
      'FORCE_MAJEURE': 'Force Majeure',
      'GOVERNING_LAW': 'Governing Law',
      'DISPUTE_RESOLUTION': 'Dispute Resolution',
      'INDEMNIFICATION': 'Indemnification',
      'WARRANTIES': 'Warranties and Representations',
      'SERVICES': 'Service Provisions',
      'COMPLIANCE': 'Compliance Requirements'
    };

    return titles[type] || 'General Clause';
  }

  private assessImportance(type: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    const importance = {
      'PAYMENT': 'CRITICAL',
      'TERMINATION': 'CRITICAL',
      'LIABILITY': 'CRITICAL',
      'INTELLECTUAL_PROPERTY': 'HIGH',
      'CONFIDENTIALITY': 'HIGH',
      'GOVERNING_LAW': 'HIGH',
      'DISPUTE_RESOLUTION': 'HIGH',
      'INDEMNIFICATION': 'MEDIUM',
      'WARRANTIES': 'MEDIUM',
      'FORCE_MAJEURE': 'MEDIUM',
      'SERVICES': 'HIGH',
      'COMPLIANCE': 'HIGH'
    };

    return importance[type] as any || 'LOW';
  }

  private assessClauseCompleteness(content: string, type: string): number {
    let score = 50; // Base score

    // Type-specific completeness checks
    switch (type) {
      case 'PAYMENT':
        if (/amount|fee|cost/i.test(content)) score += 15;
        if (/due|payment\s+date|schedule/i.test(content)) score += 15;
        if (/late|penalty|interest/i.test(content)) score += 10;
        if (/method|wire|check|electronic/i.test(content)) score += 10;
        break;

      case 'TERMINATION':
        if (/notice|days|period/i.test(content)) score += 20;
        if (/cause|breach|default/i.test(content)) score += 15;
        if (/effect|consequence|survival/i.test(content)) score += 15;
        break;

      case 'LIABILITY':
        if (/limit|cap|maximum/i.test(content)) score += 20;
        if (/exclude|disclaim/i.test(content)) score += 15;
        if (/consequential|indirect|incidental/i.test(content)) score += 15;
        break;

      case 'INTELLECTUAL_PROPERTY':
        if (/ownership|own|belong/i.test(content)) score += 20;
        if (/license|right\s+to\s+use/i.test(content)) score += 15;
        if (/pre.existing|prior/i.test(content)) score += 15;
        break;

      default:
        // General completeness indicators
        if (content.length > 100) score += 10;
        if (content.length > 300) score += 10;
        if (/shall|must|will/i.test(content)) score += 10;
        if (/party|parties/i.test(content)) score += 10;
    }

    return Math.min(100, score);
  }

  private identifyClauseIssues(content: string, type: string): string[] {
    const issues: string[] = [];

    // General issues
    if (content.length < 50) {
      issues.push('Clause appears to be too brief');
    }

    if (!/shall|must|will|agree/i.test(content)) {
      issues.push('Clause lacks clear obligations or commitments');
    }

    // Type-specific issues
    switch (type) {
      case 'PAYMENT':
        if (!/\$|\d+|amount/i.test(content)) {
          issues.push('Payment amount not clearly specified');
        }
        if (!/due|date|schedule/i.test(content)) {
          issues.push('Payment timing not clearly specified');
        }
        break;

      case 'TERMINATION':
        if (!/\d+\s+days?/i.test(content)) {
          issues.push('Notice period not clearly specified');
        }
        break;

      case 'LIABILITY':
        if (/unlimited|no\s+limit/i.test(content)) {
          issues.push('Unlimited liability exposure');
        }
        break;

      case 'INTELLECTUAL_PROPERTY':
        if (!/ownership|own|belong/i.test(content)) {
          issues.push('IP ownership not clearly defined');
        }
        break;
    }

    return issues;
  }

  private assessCompleteness(clauses: ContractClause[]): ClauseCompleteness {
    const presentTypes = clauses.map(c => c.type);
    const missing = this.standardClauseTypes.filter(type => !presentTypes.includes(type));
    const present = this.standardClauseTypes.filter(type => presentTypes.includes(type));
    
    const score = Math.round((present.length / this.standardClauseTypes.length) * 100);
    
    const recommendations = missing.map(type => 
      `Consider adding ${this.getClauseTitle(type).toLowerCase()}`
    );

    return {
      score,
      missing,
      present,
      recommendations
    };
  }

  private identifyStandardClauses(clauses: ContractClause[]): string[] {
    return clauses
      .filter(clause => this.standardClauseTypes.includes(clause.type))
      .map(clause => clause.title);
  }

  private identifyCustomClauses(clauses: ContractClause[]): string[] {
    return clauses
      .filter(clause => !this.standardClauseTypes.includes(clause.type))
      .map(clause => clause.title);
  }
}