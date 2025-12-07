# Data Security & Privacy Architecture

## PactumAI - Swiss Data Protection & Client Data Ownership

This document outlines how client data is protected, who owns what, and how to use AI without clients claiming you're "stealing" their data.

---

## Table of Contents

1. [Data Ownership Model](#1-data-ownership-model)
2. [Legal Framework for Data Usage](#2-legal-framework-for-data-usage)
3. [Swiss FADP Compliance](#3-swiss-fadp-compliance)
4. [AI Processing Without Data Ownership Issues](#4-ai-processing-without-data-ownership-issues)
   - [4.5 EU/Swiss-Compliant OCR](#45-euswiss-compliant-ocr)
5. [Encryption & Security Architecture](#5-encryption--security-architecture)
6. [Multi-Tenant Isolation](#6-multi-tenant-isolation)
7. [Kubernetes Security (Without OpenShift)](#7-kubernetes-security-without-openshift)
8. [Data Residency & Swiss Hosting](#8-data-residency--swiss-hosting)
9. [Client-Facing Data Policy Templates](#9-client-facing-data-policy-templates)
10. [Implementation Checklist](#10-implementation-checklist)
11. [Infrastructure Security Architecture](#11-infrastructure-security-architecture)

---

## 1. Data Ownership Model

### The Golden Rule: Clients Own Their Data, Period.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATA OWNERSHIP HIERARCHY                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    CLIENT DATA (100% Client-Owned)               │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  • Original contract documents (PDF, DOCX)              │    │    │
│  │  │  • Extracted text and content                           │    │    │
│  │  │  • Client-provided metadata                             │    │    │
│  │  │  • Party information (names, addresses)                 │    │    │
│  │  │  • Financial terms and values                           │    │    │
│  │  │  • All PII and business-sensitive data                  │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              DERIVED DATA (Client-Owned, Licensed to Us)         │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  • AI-generated summaries                               │    │    │
│  │  │  • Extracted clauses and artifacts                      │    │    │
│  │  │  • Risk assessments                                     │    │    │
│  │  │  • Contract metadata (dates, types)                     │    │    │
│  │  │  • Embeddings (vector representations)                  │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │  We have LIMITED LICENSE to process, NOT ownership              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │               PLATFORM DATA (We Own)                             │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  • Aggregated, anonymized statistics                    │    │    │
│  │  │  • Platform usage metrics                               │    │    │
│  │  │  • AI model improvements (trained on anonymized data)   │    │    │
│  │  │  • Benchmark data (no client identifiers)               │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │  ONLY if explicitly permitted in Terms of Service               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Categories and Ownership

| Data Type | Owner | Our Rights | Client Rights |
|-----------|-------|------------|---------------|
| Original contracts | **Client** | Process only | Full ownership, export, delete |
| Extracted text | **Client** | Process only | Full ownership, export, delete |
| AI summaries | **Client** | Process only | Full ownership, export, delete |
| Artifacts (clauses, terms) | **Client** | Process only | Full ownership, export, delete |
| Embeddings | **Client** | Process only | Delete on request |
| Usage analytics | **Us** (anonymized) | Own | Opt-out available |
| Aggregated benchmarks | **Us** (anonymized) | Own | Opt-out available |

---

## 2. Legal Framework for Data Usage

### Terms of Service - Key Clauses

```markdown
## Data Ownership and Rights

### 2.1 Client Data Ownership
You retain all ownership rights to your data, including but not limited to:
- Original documents uploaded to the platform
- Extracted content and text
- AI-generated summaries, analyses, and artifacts
- All metadata associated with your contracts

We claim NO ownership over your data or any derivatives created from it.

### 2.2 Limited License Grant
By using our service, you grant us a LIMITED, NON-EXCLUSIVE, REVOCABLE license to:
- Process your data to provide the contracted services
- Store your data on secure infrastructure
- Create derived artifacts (summaries, extractions) FOR YOUR BENEFIT ONLY
- Use AI models to analyze your contracts

This license:
- Is AUTOMATICALLY REVOKED upon contract termination
- Does NOT include rights to sell, share, or transfer your data
- Does NOT include rights to use your data for training AI models
- Does NOT survive beyond your subscription period

### 2.3 Data Portability
You may export ALL your data at any time in standard formats (JSON, CSV, PDF).
Upon account termination, you have 30 days to export your data.
After 30 days, all your data will be permanently deleted.

### 2.4 No Training on Client Data
We DO NOT use your data to train AI models.
We DO NOT use your data to improve our algorithms.
We DO NOT share your data with AI providers for training purposes.
All AI processing uses zero-data-retention (ZDR) configurations.

### 2.5 Anonymized Analytics (Opt-Out Available)
With your EXPLICIT CONSENT, we may use anonymized, aggregated statistics to:
- Improve platform performance
- Generate industry benchmarks (no client identification possible)
- Publish research reports (fully anonymized)

You may opt-out of anonymized analytics at any time via Settings > Privacy.
```

### Data Processing Agreement (DPA) - Required for Swiss/EU Clients

```markdown
## Data Processing Agreement

### Article 1: Definitions
"Controller" means the Client who determines the purposes and means of processing.
"Processor" means PactumAI who processes data on behalf of the Controller.

### Article 2: Processing Instructions
The Processor shall only process personal data:
(a) On documented instructions from the Controller
(b) For the sole purpose of providing the contracted services
(c) In accordance with Swiss FADP and EU GDPR requirements

### Article 3: Sub-Processors
Current sub-processors:
- Cloud Infrastructure: [Exoscale/Azure Switzerland] - Swiss data residency
- AI Processing: [OpenAI/Azure OpenAI] - Zero data retention enabled
- Backup Storage: [Swiss provider] - Encrypted, Swiss location

The Processor shall inform the Controller of any intended changes.

### Article 4: Data Subject Rights
The Processor shall assist the Controller in responding to:
- Access requests (Art. 15 GDPR / Art. 25 FADP)
- Rectification requests (Art. 16 GDPR / Art. 32 FADP)
- Erasure requests (Art. 17 GDPR / Art. 32 FADP)
- Data portability requests (Art. 20 GDPR / Art. 28 FADP)

### Article 5: Security Measures
The Processor implements:
- AES-256 encryption at rest
- TLS 1.3 encryption in transit
- Multi-tenant isolation with row-level security
- Regular security audits and penetration testing

### Article 6: Data Return and Deletion
Upon termination:
- All Client data exported within 30 days upon request
- All Client data permanently deleted within 60 days
- Deletion certificate provided upon request
- Backups purged within 90 days
```

---

## 3. Swiss FADP Compliance

### New Swiss Data Protection Act (nDSG/FADP) - Effective Sept 2023

| Requirement | Implementation |
|-------------|----------------|
| **Art. 6** - Lawfulness | Processing only with valid legal basis (contract, consent) |
| **Art. 7** - Purpose Limitation | Data used only for contracted services |
| **Art. 8** - Data Security | AES-256 encryption, access controls, audit logs |
| **Art. 12** - Record of Processing | Maintained in compliance dashboard |
| **Art. 16** - Cross-border Transfer | Data stays in Switzerland (or adequate countries) |
| **Art. 25** - Right of Access | Self-service data export available |
| **Art. 32** - Right to Deletion | Self-service account deletion + data purge |

### Processing Activities Register

```typescript
// filepath: apps/api/src/lib/compliance/processing-register.ts

export const PROCESSING_ACTIVITIES = {
  'contract-upload': {
    purpose: 'Store and process client contracts',
    legalBasis: 'Contract performance (Art. 6.1.b GDPR)',
    dataCategories: ['contracts', 'business-data'],
    retention: 'Duration of subscription + 30 days',
    recipients: ['Internal processing systems'],
    crossBorder: false,
  },
  
  'ai-analysis': {
    purpose: 'Generate contract summaries and extract key terms',
    legalBasis: 'Contract performance (Art. 6.1.b GDPR)',
    dataCategories: ['contracts', 'derived-artifacts'],
    retention: 'Duration of subscription + 30 days',
    recipients: ['AI Provider (Azure OpenAI - ZDR enabled)'],
    crossBorder: false, // Using Azure Switzerland or EU region
    safeguards: 'Zero Data Retention agreement with AI provider',
  },
  
  'anonymized-benchmarks': {
    purpose: 'Generate industry benchmarks (optional, consent-based)',
    legalBasis: 'Explicit consent (Art. 6.1.a GDPR)',
    dataCategories: ['anonymized-statistics'],
    retention: 'Indefinite (fully anonymized)',
    recipients: ['Internal analytics'],
    crossBorder: false,
    optOut: true, // User can opt-out
  },
};
```

---

## 4. AI Processing Without Data Ownership Issues

### The Problem with AI

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT CONCERNS ABOUT AI                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  😰 "Is OpenAI training on my contracts?"                       │
│  😰 "Will my competitors see my data?"                          │
│  😰 "Who owns the AI-generated summaries?"                      │
│  😰 "Can you sell insights from my contracts?"                  │
│  😰 "What happens to my data after I cancel?"                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Solution: AI Processing Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SECURE AI PROCESSING PIPELINE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐        │
│   │ Client      │    │  Anonymization   │    │   AI Provider   │        │
│   │ Contract    │───▶│     Layer        │───▶│   (ZDR Mode)    │        │
│   │             │    │                  │    │                 │        │
│   └─────────────┘    └──────────────────┘    └─────────────────┘        │
│         │                    │                       │                   │
│         │                    │                       │                   │
│         │             ┌──────▼──────┐               │                   │
│         │             │ Anonymized  │               │                   │
│         │             │   Prompt:   │               │                   │
│         │             │             │               │                   │
│         │             │ "Analyze    │               │                   │
│         │             │  contract   │               │                   │
│         │             │  between    │               │                   │
│         │             │ [COMPANY_1] │               │                   │
│         │             │  and        │               │                   │
│         │             │ [COMPANY_2] │               │                   │
│         │             │  for CHF    │               │                   │
│         │             │ [AMOUNT_1]" │               │                   │
│         │             └──────┬──────┘               │                   │
│         │                    │                       │                   │
│         │                    └───────────────────────┘                   │
│         │                              │                                 │
│         │                    ┌─────────▼─────────┐                      │
│         │                    │   AI Response     │                      │
│         │                    │  (Still anonymized)│                     │
│         │                    └─────────┬─────────┘                      │
│         │                              │                                 │
│         │                    ┌─────────▼─────────┐                      │
│         │                    │ De-Anonymization  │                      │
│         │                    │     Layer         │                      │
│         │                    └─────────┬─────────┘                      │
│         │                              │                                 │
│         ▼                              ▼                                 │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │                    FINAL ARTIFACT                            │       │
│   │  Client-owned summary with real company names restored       │       │
│   │  AI provider NEVER saw actual client data                    │       │
│   │  Nothing retained by AI provider (ZDR)                       │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation: Data Anonymization

```typescript
// filepath: apps/api/src/lib/ai/anonymizer.ts
import { v4 as uuid } from 'uuid';
import { redis } from '../redis';
import { encryptField, decryptField } from '../encryption';

interface AnonymizationMapping {
  placeholder: string;
  original: string;
  type: 'company' | 'person' | 'amount' | 'date' | 'address' | 'taxId' | 'iban' | 'email' | 'phone';
}

/**
 * Anonymize sensitive data before AI processing
 * This ensures AI providers NEVER see real client data
 */
export class ContractAnonymizer {
  private mappings: Map<string, AnonymizationMapping> = new Map();
  
  // Swiss-specific patterns
  private patterns = {
    // Swiss company names (AG, GmbH, SA, Sàrl)
    company: /\b[A-Z][a-zA-ZÀ-ÿ\s&.-]+\s+(AG|GmbH|SA|Sàrl|Ltd\.?|Inc\.?|Corp\.?|S\.?A\.?)\b/g,
    
    // Person names (Title + Name pattern)
    person: /\b(Herr|Frau|Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\s+[A-ZÀ-Ÿ][a-zà-ÿ]+\s+[A-ZÀ-Ÿ][a-zà-ÿ]+\b/g,
    
    // Swiss phone numbers
    phone: /(\+41|0041|0)\s?(\d{2})\s?(\d{3})\s?(\d{2})\s?(\d{2})/g,
    
    // Swiss postal codes + cities
    address: /\b\d{4}\s+[A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)?\b/g,
    
    // AHV/AVS numbers (Swiss social security)
    ahvNumber: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g,
    
    // Swiss VAT numbers
    taxId: /CHE-\d{3}\.\d{3}\.\d{3}\s?(MWST|TVA|IVA)?/g,
    
    // Currency amounts (CHF, EUR, USD)
    amount: /(CHF|EUR|USD|€|\$)\s?[\d',]+(\.\d{2})?/g,
    
    // Swiss IBAN
    iban: /CH\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{1}/g,
    
    // Email addresses
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    
    // Dates (various formats)
    date: /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g,
  };

  /**
   * Anonymize contract text before sending to AI
   * Returns anonymized text and a mapping ID for de-anonymization
   */
  async anonymize(text: string, tenantId: string): Promise<{ 
    anonymizedText: string; 
    mappingId: string;
  }> {
    let anonymizedText = text;
    const mappingId = uuid();
    let counter = 1;
    
    // Process each pattern type
    for (const [type, pattern] of Object.entries(this.patterns)) {
      anonymizedText = anonymizedText.replace(pattern, (match) => {
        const placeholder = `[${type.toUpperCase()}_${counter++}]`;
        
        this.mappings.set(placeholder, {
          placeholder,
          original: match,
          type: type as AnonymizationMapping['type'],
        });
        
        return placeholder;
      });
    }
    
    // Store mappings securely (encrypted, with TTL)
    await this.storeMappings(mappingId, tenantId);
    
    return { anonymizedText, mappingId };
  }

  /**
   * Restore original values in AI response
   */
  async deAnonymize(text: string, mappingId: string, tenantId: string): Promise<string> {
    await this.loadMappings(mappingId, tenantId);
    
    let result = text;
    for (const [placeholder, mapping] of this.mappings) {
      result = result.replace(new RegExp(escapeRegex(placeholder), 'g'), mapping.original);
    }
    
    // Clear mappings after use (security: minimize data exposure)
    await this.clearMappings(mappingId);
    
    return result;
  }

  private async storeMappings(mappingId: string, tenantId: string): Promise<void> {
    const encrypted = await encryptField(
      JSON.stringify(Array.from(this.mappings.entries())),
      tenantId
    );
    // Store for 1 hour max (AI processing should be fast)
    await redis.setex(`anon:${mappingId}`, 3600, JSON.stringify(encrypted));
  }

  private async loadMappings(mappingId: string, tenantId: string): Promise<void> {
    const data = await redis.get(`anon:${mappingId}`);
    if (data) {
      const encrypted = JSON.parse(data);
      const decrypted = await decryptField(encrypted, tenantId);
      this.mappings = new Map(JSON.parse(decrypted));
    }
  }

  private async clearMappings(mappingId: string): Promise<void> {
    await redis.del(`anon:${mappingId}`);
    this.mappings.clear();
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### AI Provider Configuration: Zero Data Retention

```typescript
// filepath: apps/api/src/lib/ai/providers.ts
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AI Provider options with data protection levels
 */
export enum AISecurityLevel {
  STANDARD = 'standard',        // Cloud AI with anonymization
  ENHANCED = 'enhanced',        // Cloud AI + ZDR + EU region
  MAXIMUM = 'maximum',          // Self-hosted LLM only
}

/**
 * Configure OpenAI with Zero Data Retention
 * Requires OpenAI Enterprise agreement
 */
export function createSecureOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // For Azure OpenAI (data stays in Azure region)
    // baseURL: 'https://your-resource.openai.azure.com/openai/deployments/gpt-4',
    // defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_KEY },
  });
}

/**
 * OpenAI API Request with ZDR headers
 */
export async function secureOpenAIRequest(
  client: OpenAI,
  messages: OpenAI.ChatCompletionMessageParam[],
  options: {
    model?: string;
    temperature?: number;
  } = {}
): Promise<string> {
  const response = await client.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    messages,
    temperature: options.temperature || 0.3,
    // These don't directly control ZDR but document intent
    // ZDR is enabled at the organization/API key level
    user: 'anonymized-request', // Don't send real user IDs
  });
  
  return response.choices[0].message.content || '';
}

/**
 * Azure OpenAI - Data stays in specified region
 * Swiss clients should use West Europe or Switzerland North
 */
export function createAzureOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.AZURE_OPENAI_KEY,
    baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
    defaultQuery: { 'api-version': '2024-02-01' },
    defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_KEY },
  });
}

/**
 * Self-hosted LLM for maximum security
 * No data ever leaves your infrastructure
 */
export async function selfHostedLLMRequest(
  prompt: string,
  options: { model?: string } = {}
): Promise<string> {
  // Ollama (easiest)
  const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || 'mistral',
      prompt,
      stream: false,
    }),
  });
  
  const data = await response.json();
  return data.response;
}
```

### Complete AI Processing Pipeline

```typescript
// filepath: apps/api/src/lib/ai/secure-processor.ts
import { ContractAnonymizer } from './anonymizer';
import { createSecureOpenAIClient, secureOpenAIRequest, selfHostedLLMRequest } from './providers';
import { prisma } from '../prisma';

interface ProcessingOptions {
  tenantId: string;
  contractId: string;
  userId: string;
  securityLevel: 'standard' | 'enhanced' | 'maximum';
}

/**
 * Securely process contract with AI
 * 
 * Security guarantees:
 * 1. Client data is ALWAYS anonymized before AI processing
 * 2. AI provider NEVER sees real company names, amounts, etc.
 * 3. Zero Data Retention - nothing stored by AI provider
 * 4. Full audit trail maintained
 * 5. Client owns all outputs
 */
export async function processContractSecurely(
  contractText: string,
  prompt: string,
  options: ProcessingOptions
): Promise<{ result: string; auditId: string }> {
  const { tenantId, contractId, userId, securityLevel } = options;
  
  // 1. Create audit record BEFORE processing
  const auditRecord = await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: 'AI_PROCESSING_START',
      resourceType: 'Contract',
      resourceId: contractId,
      metadata: {
        securityLevel,
        timestamp: new Date().toISOString(),
        dataOwnership: 'CLIENT', // Explicitly document ownership
      },
    },
  });
  
  try {
    // 2. Anonymize contract text
    const anonymizer = new ContractAnonymizer();
    const { anonymizedText, mappingId } = await anonymizer.anonymize(
      contractText, 
      tenantId
    );
    
    // 3. Anonymize the prompt as well (in case it references client data)
    const { anonymizedText: anonymizedPrompt, mappingId: promptMappingId } = 
      await anonymizer.anonymize(prompt, tenantId);
    
    // 4. Process with appropriate AI based on security level
    let aiResponse: string;
    
    switch (securityLevel) {
      case 'maximum':
        // Self-hosted LLM - data never leaves infrastructure
        aiResponse = await selfHostedLLMRequest(
          `${anonymizedPrompt}\n\nContract:\n${anonymizedText}`
        );
        break;
        
      case 'enhanced':
        // Azure OpenAI in EU/CH region with ZDR
        const azureClient = createAzureOpenAIClient();
        aiResponse = await secureOpenAIRequest(azureClient, [
          { role: 'system', content: 'You are a contract analysis assistant.' },
          { role: 'user', content: `${anonymizedPrompt}\n\nContract:\n${anonymizedText}` },
        ]);
        break;
        
      default:
        // Standard OpenAI with ZDR
        const client = createSecureOpenAIClient();
        aiResponse = await secureOpenAIRequest(client, [
          { role: 'system', content: 'You are a contract analysis assistant.' },
          { role: 'user', content: `${anonymizedPrompt}\n\nContract:\n${anonymizedText}` },
        ]);
    }
    
    // 5. De-anonymize the response
    let result = await anonymizer.deAnonymize(aiResponse, mappingId, tenantId);
    result = await anonymizer.deAnonymize(result, promptMappingId, tenantId);
    
    // 6. Update audit record
    await prisma.auditLog.update({
      where: { id: auditRecord.id },
      data: {
        action: 'AI_PROCESSING_COMPLETE',
        metadata: {
          securityLevel,
          timestamp: new Date().toISOString(),
          dataOwnership: 'CLIENT',
          success: true,
          // Don't log the actual content for security
          resultLength: result.length,
        },
      },
    });
    
    return { result, auditId: auditRecord.id };
    
  } catch (error) {
    // Log failure
    await prisma.auditLog.update({
      where: { id: auditRecord.id },
      data: {
        action: 'AI_PROCESSING_FAILED',
        metadata: {
          securityLevel,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    });
    throw error;
  }
}
```

---

## 4.5 EU/Swiss-Compliant OCR

### Why OCR Data Residency Matters

Standard OCR services (AWS Textract, Google Vision) may process documents in US data centers. For Swiss FADP and GDPR compliance, you need OCR services that guarantee EU/Swiss data residency.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OCR DATA RESIDENCY OPTIONS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ❌ NOT COMPLIANT (for Swiss/EU clients)                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  • AWS Textract (default US regions)                            │    │
│  │  • Google Cloud Vision (default global)                         │    │
│  │  • OpenAI Vision API (US servers)                               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ✅ COMPLIANT - Swiss Data Residency                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  • Azure Document Intelligence (Switzerland North - Zurich)     │    │
│  │  • Google Cloud Vision (europe-west6 - Zurich)                  │    │
│  │  • Infomaniak AI (Swiss provider, Swiss data centers)           │    │
│  │  • Self-hosted Tesseract (your infrastructure)                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ✅ COMPLIANT - EU Data Residency                                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  • Azure Document Intelligence (West Europe - Netherlands)      │    │
│  │  • Google Cloud Vision (europe-west1 - Belgium)                 │    │
│  │  • OVHcloud AI (France - SecNumCloud certified)                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Provider Comparison

| Provider | Region | Data Residency | Accuracy | Cost/Page | Setup |
|----------|--------|----------------|----------|-----------|-------|
| **Azure CH** | Switzerland North | 🇨🇭 Swiss | 95-99% | ~$0.015 | Easy |
| **Azure EU** | West Europe | 🇪🇺 EU | 95-99% | ~$0.015 | Easy |
| **Google EU** | europe-west6 | 🇨🇭 Swiss | 93-97% | ~$0.015 | Medium |
| **OVHcloud** | France | 🇫🇷 EU (SecNumCloud) | 90-95% | ~$0.01 | Medium |
| **Infomaniak** | Switzerland | 🇨🇭 Swiss | 85-90% | Variable | Easy |
| **Tesseract** | Your servers | 🏠 Local | 80-90% | Free | Hard |

### Implementation: EU-Compliant OCR

```typescript
// filepath: apps/web/lib/ai/eu-compliant-ocr.ts
import {
  performEUCompliantOCR,
  getAvailableProviders,
  logProviderStatus,
} from './eu-compliant-ocr';

// Check configured providers
logProviderStatus();
// Output:
// 🇪🇺 EU/Swiss-Compliant OCR Providers:
//
// ✅ azure-ch      | Switzerland North (Zurich)     | Switzerland
// ✅ azure-eu      | West Europe (Netherlands)      | EU
// ❌ google-eu     | europe-west6                   | EU/Switzerland
// ❌ ovh           | France (Gravelines)            | EU (France)
// ✅ infomaniak    | Switzerland                    | Switzerland
// ✅ tesseract     | Local                          | Your infrastructure

// Process document with automatic provider selection
const result = await performEUCompliantOCR(fileBuffer, {
  provider: 'azure-ch',  // Force Swiss provider
  language: 'de',        // German contract
  extractTables: true,   // Extract tables too
});

console.log(`OCR completed with ${result.provider}`);
console.log(`Data residency: ${result.dataResidency}`);
console.log(`Confidence: ${result.confidence * 100}%`);
```

### Environment Variables for EU/Swiss OCR

```bash
# Azure Switzerland (Recommended for Swiss clients)
AZURE_VISION_ENDPOINT_CH=https://your-swiss-resource.cognitiveservices.azure.com
AZURE_VISION_KEY_CH=your-swiss-api-key

# Azure EU (For EU clients)
AZURE_VISION_ENDPOINT_EU=https://your-eu-resource.cognitiveservices.azure.com
AZURE_VISION_KEY_EU=your-eu-api-key

# Google Cloud (with EU region policy)
GOOGLE_VISION_CREDENTIALS_EU=/path/to/eu-service-account.json
GOOGLE_CLOUD_REGION=europe-west6

# OVHcloud (French sovereignty)
OVH_APPLICATION_KEY=your-app-key
OVH_APPLICATION_SECRET=your-secret
OVH_CONSUMER_KEY=your-consumer-key

# Infomaniak (Swiss provider)
INFOMANIAK_API_TOKEN=your-token
INFOMANIAK_ACCOUNT_ID=your-account-id
```

### Complete Document Processing Pipeline

```typescript
// filepath: apps/web/lib/ai/secure-ai-processor.ts
import { processDocumentSecurely } from './secure-ai-processor';

// Full pipeline: OCR + Anonymize + AI Analysis + De-anonymize
const result = await processDocumentSecurely(fileBuffer, {
  provider: 'azure-ch',      // Swiss OCR
  language: 'de',            // German
  model: 'gpt-4o-mini',      // AI model
  tenantId: 'tenant-123',
});

// Result contains:
// - ocrResult: { provider, region, dataResidency, confidence }
// - client: { name: 'Real Company AG' }  // De-anonymized
// - clauses: [...]                       // Real data restored
```

---

## 5. Encryption & Security Architecture

### Encryption at Rest

```typescript
// filepath: apps/api/src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scrypt, createHmac } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const ALGORITHM = 'aes-256-gcm';

/**
 * Tenant-specific encryption key derivation
 * Each tenant has their own encryption key derived from master key
 * This ensures data isolation even if master key is compromised
 */
async function deriveTenantKey(masterKey: string, tenantId: string): Promise<Buffer> {
  const salt = `pactum-tenant-${tenantId}-v1`;
  return (await scryptAsync(masterKey, salt, 32)) as Buffer;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

/**
 * Encrypt sensitive field with AES-256-GCM
 * Used for: PII, financial data, contract content
 */
export async function encryptField(
  plaintext: string, 
  tenantId: string
): Promise<EncryptedData> {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY!;
  const tenantKey = await deriveTenantKey(masterKey, tenantId);
  const iv = randomBytes(16);
  
  const cipher = createCipheriv(ALGORITHM, tenantKey, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: 1,
  };
}

/**
 * Decrypt sensitive field
 */
export async function decryptField(
  data: EncryptedData, 
  tenantId: string
): Promise<string> {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY!;
  const tenantKey = await deriveTenantKey(masterKey, tenantId);
  
  const decipher = createDecipheriv(
    ALGORITHM,
    tenantKey,
    Buffer.from(data.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(data.authTag, 'base64'));
  
  let decrypted = decipher.update(data.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash for searchable encryption (one-way)
 * Allows searching encrypted fields without decryption
 */
export function hashForSearch(value: string, tenantId: string): string {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY!;
  const hmac = createHmac('sha256', `${masterKey}-${tenantId}`);
  hmac.update(value.toLowerCase().trim());
  return hmac.digest('hex');
}
```

### Database Model with Encryption

```prisma
// filepath: packages/clients/db/schema.prisma

model Contract {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  
  // Encrypted fields (stored as JSON with iv, encrypted, authTag)
  titleEncrypted     Json?    @map("title_encrypted")
  contentEncrypted   Json?    @map("content_encrypted")
  partiesEncrypted   Json?    @map("parties_encrypted")
  
  // Searchable hashes (for finding contracts without decryption)
  titleHash          String?  @map("title_hash")
  
  // Non-sensitive metadata (not encrypted)
  status             String
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  // Ownership tracking
  dataOwner          String   @default("CLIENT") @map("data_owner")
  
  @@index([tenantId])
  @@index([titleHash])
  @@map("contracts")
}

model Artifact {
  id           String   @id @default(cuid())
  tenantId     String   @map("tenant_id")
  contractId   String   @map("contract_id")
  
  // All AI-generated content is CLIENT-OWNED
  dataOwner    String   @default("CLIENT") @map("data_owner")
  
  // Encrypted artifact data
  dataEncrypted Json    @map("data_encrypted")
  
  type         String   // 'summary', 'clauses', 'risk-assessment', etc.
  createdAt    DateTime @default(now())
  
  contract     Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  
  @@index([tenantId])
  @@index([contractId])
  @@map("artifacts")
}
```

---

## 6. Multi-Tenant Isolation

### Row-Level Security (PostgreSQL)

```sql
-- Enable RLS on all tenant tables
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Tenants can only see their own data
CREATE POLICY tenant_isolation ON contracts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::text);

CREATE POLICY tenant_isolation ON artifacts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::text);

-- Application sets tenant context on each request
-- SET app.current_tenant_id = 'tenant-uuid';
```

### Application-Level Middleware

```typescript
// filepath: apps/api/src/middleware/tenant-isolation.ts

export async function tenantIsolationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tenantId = req.user?.tenantId;
  
  if (!tenantId) {
    return res.status(401).json({ error: 'Tenant context required' });
  }
  
  // Set PostgreSQL session variable for RLS
  await prisma.$executeRaw`SET app.current_tenant_id = ${tenantId}`;
  
  // Also filter at ORM level for defense in depth
  req.prismaWithTenant = prisma.$extends({
    query: {
      $allOperations({ args, query, model }) {
        // Automatically inject tenantId into all queries
        if (args.where) {
          args.where.tenantId = tenantId;
        } else {
          args.where = { tenantId };
        }
        return query(args);
      },
    },
  });
  
  next();
}
```

---

## 7. Kubernetes Security (Without OpenShift)

### Yes, You Can Be Just as Secure!

| Security Feature | OpenShift | Kubernetes + Tools |
|------------------|-----------|-------------------|
| Pod Security | Built-in SCC | ✅ Pod Security Standards |
| Network Policies | Built-in | ✅ Calico/Cilium |
| Secrets Management | Built-in | ✅ External Secrets Operator |
| Runtime Security | Built-in | ✅ Falco |
| Image Scanning | Built-in | ✅ Trivy |
| Service Mesh | Built-in Istio | ✅ Istio/Linkerd |

### Pod Security Standards

```yaml
# kubernetes/security/pod-security.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: pactum
  labels:
    pod-security.kubernetes.io/enforce: restricted
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pactum-api
  namespace: pactum
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: api
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
```

### Network Policies (Zero Trust)

```yaml
# kubernetes/security/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: pactum
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-to-database-only
  namespace: pactum
spec:
  podSelector:
    matchLabels:
      app: pactum-api
  policyTypes: [Egress]
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
```

---

## 8. Data Residency & Swiss Hosting

### Swiss Cloud Providers

| Provider | Location | Certifications |
|----------|----------|----------------|
| **Exoscale** | Geneva, Zurich | ISO 27001, Swiss company |
| **Infomaniak** | Geneva | ISO 27001, Swiss company |
| **Azure Switzerland** | Zurich, Geneva | ISO 27001, SOC 2, FINMA |

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA RESIDENCY: SWITZERLAND                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User (Switzerland)                                            │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────────┐                                          │
│   │   Cloudflare    │ ◄── CDN/WAF (Edge in Zurich)             │
│   │   (CH Edge)     │                                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────────────────────────────────────────┐      │
│   │            SWISS DATA CENTER                         │      │
│   │   ┌─────────────┐  ┌─────────────┐  ┌───────────┐   │      │
│   │   │ Kubernetes  │  │ PostgreSQL  │  │   MinIO   │   │      │
│   │   │   Cluster   │  │  (Primary)  │  │ (Storage) │   │      │
│   │   │  (Exoscale) │  │             │  │           │   │      │
│   │   └─────────────┘  └─────────────┘  └───────────┘   │      │
│   │                                                      │      │
│   │   ┌─────────────────────────────────────────────┐   │      │
│   │   │           AI Processing Options              │   │      │
│   │   │                                             │   │      │
│   │   │  Option A: Azure OpenAI (Switzerland North) │   │      │
│   │   │  Option B: Self-hosted Ollama (in cluster)  │   │      │
│   │   │                                             │   │      │
│   │   │  ⚠️ Data NEVER sent to US-based AI         │   │      │
│   │   └─────────────────────────────────────────────┘   │      │
│   │                                                      │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                  │
│   ALL DATA STAYS IN SWITZERLAND                                 │
│   No cross-border transfers                                     │
│   FADP / GDPR compliant                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Client-Facing Data Policy Templates

### Privacy Policy Extract

```markdown
## Your Data, Your Ownership

### What We Store
- Your uploaded contract documents
- AI-generated analyses and summaries
- Your user preferences and settings

### What We DON'T Do
❌ We do NOT own your data
❌ We do NOT sell your data
❌ We do NOT share your data with third parties
❌ We do NOT use your data to train AI models
❌ We do NOT retain your data after you leave

### Your Rights
✅ Export all your data at any time (JSON, PDF, CSV)
✅ Delete your account and all data instantly
✅ Opt-out of anonymized analytics
✅ Request a copy of all data we hold about you
✅ Know exactly how your data is processed

### AI Processing
When we use AI to analyze your contracts:
- Your data is anonymized BEFORE being sent to AI
- We use Zero Data Retention (ZDR) - nothing is stored by AI
- Company names, amounts, dates are replaced with placeholders
- The AI never sees your actual business information

### Data Location
All data is stored in Switzerland 🇨🇭
- Primary: Geneva/Zurich data centers
- Backups: Swiss-only locations
- No data transfer outside Switzerland
```

### FAQ for Sales Team

```markdown
## Handling Client Data Concerns

### "Do you own our data?"
**NO.** You own 100% of your data. We only have a license to process it 
while you're our customer. When you leave, you take everything with you.

### "What about the AI-generated summaries?"
**You own those too.** Everything we create from your data belongs to you.
We just help you generate insights - we don't claim any rights to them.

### "Will you train AI on our contracts?"
**Absolutely not.** We use AI in "zero retention" mode. Your contracts 
are anonymized, processed, and immediately forgotten by the AI.

### "Where is our data stored?"
**Switzerland only.** Geneva and Zurich data centers. We never transfer 
your data outside Swiss borders.

### "What if we cancel?"
**You have 30 days to export everything.** After that, we permanently 
delete all your data. We provide a deletion certificate upon request.

### "Can we audit your security?"
**Yes.** We provide SOC 2 reports and can arrange security assessments 
for enterprise clients.
```

---

## 10. Implementation Checklist

### Legal & Contracts ✓

- [ ] Update Terms of Service with clear data ownership language
- [ ] Create Data Processing Agreement (DPA) template
- [ ] Document all processing activities (FADP Art. 12)
- [ ] Create privacy policy with plain-language explanations
- [ ] Prepare standard responses for data ownership questions

### Technical Security ✓

- [ ] Implement field-level encryption (AES-256-GCM)
- [ ] Enable tenant-specific encryption keys
- [ ] Configure Row-Level Security in PostgreSQL
- [ ] Set up data anonymization pipeline for AI
- [ ] Enable Zero Data Retention with AI provider
- [ ] Implement comprehensive audit logging

### Infrastructure ✓

- [ ] Deploy to Swiss data center (Exoscale/Infomaniak/Azure CH)
- [ ] Configure Pod Security Standards
- [ ] Enable Network Policies (zero-trust)
- [ ] Set up External Secrets Operator
- [ ] Deploy Falco for runtime security

### Client Features ✓

- [ ] Build self-service data export (JSON, CSV, PDF)
- [ ] Create one-click account deletion
- [ ] Add opt-out toggle for anonymized analytics
- [ ] Build DSAR (Data Subject Access Request) automation
- [ ] Create data deletion confirmation/certificate

### Documentation ✓

- [ ] Security whitepaper for enterprise clients
- [ ] SOC 2 readiness documentation
- [ ] Sales team FAQ on data ownership
- [ ] Technical architecture document for auditors

---

## Summary: How to Use Client Data Without Complaints

| Concern | Solution |
|---------|----------|
| "You own my data" | Clear ToS: Client owns ALL data including AI artifacts |
| "AI training on my contracts" | Anonymization + Zero Data Retention + audit proof |
| "Data leaving Switzerland" | Swiss-only hosting, no cross-border transfers |
| "Can't export my data" | Self-service export in multiple formats |
| "What happens when I leave" | 30-day export window + permanent deletion + certificate |
| "No transparency" | Comprehensive audit logs + processing register |

### The Key Message

> **"Your data is YOUR data. We're just a secure tool to help you work with it. 
> When you leave, you take everything. We keep nothing."**

---

*Document Version: 1.1*  
*Last Updated: December 2024*  
*Classification: INTERNAL*

---

## 11. Infrastructure Security Architecture

This section documents the comprehensive security infrastructure implemented to protect client data at every layer.

### 11.1 Security Components Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECURITY ARCHITECTURE LAYERS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ LAYER 1: EDGE SECURITY                                             │     │
│  │  • Web Application Firewall (WAF)                                  │     │
│  │  • Security Headers (CSP, HSTS, X-Frame-Options)                   │     │
│  │  • Rate Limiting & DDoS Protection                                 │     │
│  │  • TLS 1.3 Termination                                             │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                               ↓                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ LAYER 2: APPLICATION SECURITY                                      │     │
│  │  • CSRF Protection                                                 │     │
│  │  • Input Sanitization                                              │     │
│  │  • Intrusion Detection System (IDS)                                │     │
│  │  • AI Data Anonymization                                           │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                               ↓                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ LAYER 3: DATA SECURITY                                             │     │
│  │  • Row-Level Security (RLS)                                        │     │
│  │  • Column-Level Encryption (AES-256-GCM)                           │     │
│  │  • Encrypted Backups                                               │     │
│  │  • Audit Logging                                                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                               ↓                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ LAYER 4: INFRASTRUCTURE SECURITY                                   │     │
│  │  • Pod Security Standards (Restricted)                             │     │
│  │  • Network Policies (Microsegmentation)                            │     │
│  │  • Secrets Rotation                                                │     │
│  │  • RBAC Least Privilege                                            │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Web Application Firewall (WAF)

**Location:** `/apps/web/lib/security/waf.ts`

The WAF middleware provides first-line defense against common web attacks:

| Attack Type | Detection Method | Response |
|-------------|------------------|----------|
| SQL Injection | Pattern matching + semantic analysis | Block + Log |
| XSS (Cross-Site Scripting) | Script tag detection + encoding checks | Block + Sanitize |
| SSRF (Server-Side Request Forgery) | URL validation + allowlist | Block + Alert |
| Path Traversal | Path pattern detection | Block + Log |
| Command Injection | Shell metacharacter detection | Block + Alert |
| Payload Size Attacks | Size limits (10MB default) | Reject |

```typescript
// Usage in Next.js API routes
import { createWAFMiddleware } from '@/lib/security';

const waf = createWAFMiddleware({
  enableSQLInjection: true,
  enableXSS: true,
  enableSSRF: true,
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  logBlocked: true,
  alertOnBlock: true,
});

export default waf.protect(async (req, res) => {
  // Your API logic here
});
```

### 11.3 Security Headers

**Location:** `/apps/web/lib/security/security-headers.ts`

Swiss-compliant security headers configuration:

```typescript
// Swiss/EU compliance headers
{
  csp: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'strict-dynamic'"],
      'connect-src': [
        "'self'",
        'https://*.exoscale.com',      // Swiss cloud
        'https://*.infomaniak.com',     // Swiss cloud
        'https://switzerlandnorth.api.cognitive.microsoft.com',
      ],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': true,
    },
  },
  hsts: {
    maxAge: 63072000, // 2 years
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: 'no-referrer', // Maximum privacy
}
```

### 11.4 Intrusion Detection System (IDS)

**Location:** `/apps/web/lib/security/intrusion-detection.ts`

Real-time detection of suspicious activity patterns:

| Pattern | Indicators | Threshold | Action |
|---------|------------|-----------|--------|
| Brute Force | Failed login attempts | 5 in 5 min | Block IP |
| Credential Stuffing | Different users, same IP | 10 in 10 min | Block + Alert |
| API Abuse | Request rate anomaly | 100 in 1 min | Rate limit |
| Data Exfiltration | Large downloads | 100MB in 5 min | Block + Alert |
| Privilege Escalation | Admin access attempts | Any unauthorized | Block + Alert |

```typescript
// IDS integration
import { IntrusionDetector } from '@/lib/security';

const ids = new IntrusionDetector({
  alertWebhook: process.env.SECURITY_WEBHOOK_URL,
  autoBlock: true,
  blockDuration: 3600, // 1 hour
});

// In your request handler
await ids.analyzeRequest({
  userId,
  ipAddress: req.ip,
  endpoint: req.url,
  method: req.method,
  responseSize: response.length,
  statusCode: res.statusCode,
});
```

### 11.5 Secrets Rotation

**Location:** `/apps/web/lib/security/secrets-rotation.ts`

Automatic rotation of sensitive credentials:

| Secret Type | Rotation Schedule | Provider Options |
|-------------|-------------------|------------------|
| Database credentials | Weekly | AWS, Azure, Vault |
| API keys | Monthly | AWS, Azure, Vault |
| JWT secrets | Daily | Local |
| Encryption keys | Quarterly | AWS KMS, Azure Key Vault |

```typescript
// Secrets rotation configuration
const rotator = new SecretsRotationService({
  provider: 'azure-keyvault', // or 'aws', 'vault'
  schedules: [
    { secretName: 'database-url', rotateEvery: '7d' },
    { secretName: 'jwt-secret', rotateEvery: '1d' },
    { secretName: 'api-keys', rotateEvery: '30d' },
  ],
  notifications: {
    onRotation: async (secret) => notifyOps(secret),
    onFailure: async (error) => alertSecurity(error),
  },
});
```

### 11.6 Database Security Hardening

**Location:** `/apps/web/lib/security/database-security.ts`

PostgreSQL security features:

**Row-Level Security (RLS):**
```sql
-- Tenant isolation policy
CREATE POLICY tenant_isolation ON contracts
  USING (organization_id = current_setting('app.current_tenant')::uuid);

-- Admin bypass
CREATE POLICY admin_bypass ON contracts
  TO app_admin
  USING (current_setting('app.is_admin')::boolean = true);
```

**Column-Level Encryption:**
```typescript
// Encrypt sensitive fields
const dbSecurity = new DatabaseSecurityService(prisma);

// Encrypt before storing
const encrypted = dbSecurity.encryptValue(sensitiveData);

// Decrypt when reading
const decrypted = dbSecurity.decryptValue(encrypted);

// Search on encrypted data (using hash)
const hash = dbSecurity.hashForSearch(searchTerm);
```

**Audit Triggers:**
```sql
-- Automatic audit logging for all changes
CREATE TRIGGER audit_contracts
  AFTER INSERT OR UPDATE OR DELETE ON contracts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

### 11.7 Backup Encryption

**Location:** `/apps/web/lib/security/backup-encryption.ts`

Encrypted backup storage with Swiss-compliant providers:

| Provider | Region | Encryption | Compliance |
|----------|--------|------------|------------|
| Exoscale | Geneva | AES-256-GCM | FADP, GDPR |
| Infomaniak | Winterthur | AES-256-GCM | FADP, GDPR |
| Azure Switzerland | Zurich/Geneva | AES-256 | FADP, GDPR |

```typescript
// Backup encryption setup
const backupService = new BackupEncryptionService({
  storageProvider: new SwissBackupStorageProvider({
    provider: 'exoscale',
    bucket: 'encrypted-backups',
  }),
  keyProvider: 'azure-keyvault',
});

// Create encrypted backup
const metadata = await backupService.createBackup({
  type: 'database',
  tables: ['contracts', 'artifacts'],
});

// Schedule automatic backups
backupService.scheduleBackups({
  schedule: 'daily',
  retentionDays: 90,
  keepMinimum: 7,
});
```

### 11.8 Kubernetes Security Policies

**Location:** `/kubernetes/security-policies.yaml`

Pod Security Standards (Restricted Level):
- No privileged containers
- No host network/PID/IPC access
- Read-only root filesystem
- Non-root user required
- Limited capabilities

Network Policies:
```yaml
# Database only accessible from app pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-access
spec:
  podSelector:
    matchLabels:
      app: postgres
  ingress:
    - from:
        - podSelector:
            matchLabels:
              access: database
      ports:
        - port: 5432
```

RBAC:
```yaml
# Least privilege for worker processes
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: worker-role
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
    resourceNames: ["worker-secrets"]
```

### 11.9 Security Monitoring Dashboard

Key metrics to monitor:

| Metric | Warning | Critical |
|--------|---------|----------|
| WAF blocked requests | >100/min | >500/min |
| Failed login attempts | >50/min | >200/min |
| IDS alerts | Any high severity | Any critical |
| Unauthorized access | Any | Any |
| SSL certificate expiry | <30 days | <7 days |
| Key rotation status | >80% of period | Overdue |

### 11.10 Security Implementation Files

| File | Purpose |
|------|---------|
| `/apps/web/lib/security/waf.ts` | Web Application Firewall |
| `/apps/web/lib/security/security-headers.ts` | CSP, HSTS, etc. |
| `/apps/web/lib/security/intrusion-detection.ts` | IDS patterns |
| `/apps/web/lib/security/secrets-rotation.ts` | Key rotation |
| `/apps/web/lib/security/backup-encryption.ts` | Encrypted backups |
| `/apps/web/lib/security/database-security.ts` | RLS, encryption |
| `/apps/web/lib/security/audit.ts` | Audit logging |
| `/apps/web/lib/security/rate-limiter.ts` | Rate limiting |
| `/apps/web/lib/security/csrf.ts` | CSRF protection |
| `/apps/web/lib/security/sanitize.ts` | Input sanitization |
| `/kubernetes/security-policies.yaml` | K8s policies |

---

*Document Version: 1.1*  
*Last Updated: December 2024*  
*Classification: INTERNAL*

