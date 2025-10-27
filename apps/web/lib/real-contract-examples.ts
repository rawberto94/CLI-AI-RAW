/**
 * Real contract examples extracted from /data/contracts
 * 
 * These examples are used to improve LLM prompt accuracy with
 * domain-specific, real-world contract data.
 * 
 * Generated: 2025-10-25T12:13:44.075Z
 * Source files: 4
 */

export const REAL_CONTRACT_EXAMPLES = {
  "OVERVIEW": [
    {
      "input": "Contract header: \nSERVICE AGREEMENT\n\nThis Service Agreement (\"Agreement\") is entered into on January 1, 2024, between:\n\nCLIENT: TechCorp Industries Inc.\nAddress: 123 Business Ave, San Francisco, CA 94105\nContact: John Smith, CTO\n\nPROVIDER: AI Solutions LLC\nAddress: 456 Innovation Blvd, Austin, TX 78701\nContact: Sara...",
      "output": {
        "contractTitle": "\nSERVICE AGREEMENT",
        "parties": [
          {
            "name": "TechCorp Industries Inc.",
            "role": "client"
          },
          {
            "name": "AI Solutions LLC",
            "role": "provider"
          }
        ],
        "effectiveDate": null,
        "expirationDate": null,
        "summary": "AI-powered service agreement"
      }
    }
  ],
  "CLAUSES": [
    {
      "input": "Identify key clauses in: \nSERVICE AGREEMENT\n\nThis Service Agreement (\"Agreement\") is entered into on January 1, 2024, between:\n\nCLIENT: TechCorp Industries Inc.\nAddress: 123 Business Ave, San Francisco, CA 94105\nContact: John...",
      "output": {
        "clauses": [
          {
            "title": "1. SERVICES",
            "type": "general"
          },
          {
            "title": "2. FINANCIAL TERMS",
            "type": "general"
          },
          {
            "title": "3. PERFORMANCE METRICS",
            "type": "general"
          },
          {
            "title": "4. TERM AND TERMINATION",
            "type": "general"
          },
          {
            "title": "5. LIABILITY AND INDEMNIFICATION",
            "type": "general"
          }
        ],
        "totalCount": 5
      }
    }
  ],
  "FINANCIAL": [
    {
      "input": "Extract financial terms from: \nSERVICE AGREEMENT\n\nThis Service Agreement (\"Agreement\") is entered into on January 1, 2024, between:\n\nCLIENT: TechCorp Industries Inc.\nAddress: 123 Business Ave, San Francisco, CA 94105\nContact: John...",
      "output": {
        "totalValue": 1500000,
        "currency": "USD",
        "paymentTerms": "Net 30",
        "monthlyPayment": 125000,
        "riskScore": 25,
        "profitability": "HIGH",
        "cashFlowImpact": "POSITIVE",
        "roi": 0.23
      }
    }
  ],
  "RISK": [
    {
      "input": "Assess risks from contract: \nSERVICE AGREEMENT\n\nThis Service Agreement (\"Agreement\") is entered into on January 1, 2024, between:\n\nCLIENT: TechCorp Industries Inc.\nAddress: 123 Business Ave, San Francisco, CA 94105\nContact: John...",
      "output": {
        "riskScore": 35,
        "riskLevel": "MEDIUM",
        "factors": [
          {
            "type": "HIGH_VALUE",
            "severity": "MEDIUM",
            "description": "High contract value increases financial risk"
          },
          {
            "type": "TECHNOLOGY_DEPENDENCY",
            "severity": "LOW",
            "description": "Dependency on AI technology"
          }
        ],
        "recommendations": [
          "Add performance guarantees with specific SLA metrics",
          "Include penalty clauses for service downtime",
          "Consider escrow arrangement for large payments"
        ],
        "mitigationStrategies": [
          "Insurance coverage",
          "Performance bonds"
        ]
      }
    }
  ],
  "COMPLIANCE": [
    {
      "input": "Check compliance requirements: \nSERVICE AGREEMENT\n\nThis Service Agreement (\"Agreement\") is entered into on January 1, 2024, between:\n\nCLIENT: TechCorp Industries Inc.\nAddress: 123 Business Ave, San Francisco, CA 94105\nContact: John...",
      "output": {
        "complianceScore": 92,
        "regulations": [
          {
            "name": "GDPR",
            "status": "COMPLIANT",
            "score": 95
          },
          {
            "name": "SOX",
            "status": "COMPLIANT",
            "score": 88
          },
          {
            "name": "SOC 2",
            "status": "COMPLIANT",
            "score": 93
          }
        ],
        "issues": [],
        "recommendations": [
          "Add explicit data retention policy",
          "Include right to deletion clause",
          "Specify data processing locations"
        ]
      }
    }
  ],
  "RATES": []
};

export function getRealExamples(artifactType: string, count: number = 2) {
  const examples = REAL_CONTRACT_EXAMPLES[artifactType] || [];
  return examples.slice(0, count);
}
