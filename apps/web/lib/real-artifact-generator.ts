/**
 * Real LLM-Powered Artifact Generation Service
 * Phase 2: Replaces mock artifacts with actual OpenAI analysis
 */

import { PrismaClient, ArtifactType } from "@prisma/client";
import { readFile } from "fs/promises";

// Dynamic import for OpenAI to avoid build issues
let OpenAI: any = null;

async function getOpenAI() {
  if (!OpenAI) {
    try {
      const module = await import("openai");
      OpenAI = module.default;
    } catch (error) {
      console.error("Failed to import OpenAI:", error);
      throw new Error("OpenAI SDK not available. Run: pnpm add openai");
    }
  }
  return OpenAI;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

interface ArtifactGenerationResult {
  type: ArtifactType;
  data: any;
  confidence: number;
  processingTime: number;
}

/**
 * Extract text from PDF file
 */
async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string> {
  try {
    // For PDFs
    if (mimeType === "application/pdf") {
      const pdfParse = require("pdf-parse");
      const dataBuffer = await readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text;
    }

    // For DOCX
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    // For plain text
    if (mimeType === "text/plain") {
      return await readFile(filePath, "utf-8");
    }

    // Fallback
    return await readFile(filePath, "utf-8").catch(() => "");
  } catch (error) {
    console.error("Text extraction failed:", error);
    return "";
  }
}

/**
 * Generate OVERVIEW artifact using LLM
 */
async function generateOverviewArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `Analyze this contract and extract key information.

Contract Text:
${text.substring(0, 8000)}

Extract and return JSON with:
1. summary: A concise 2-3 sentence summary of the contract
2. contractType: The type of contract (e.g., "MSA", "SOW", "NDA", "SLA", "Employment")
3. parties: Array of involved parties with their roles
4. effectiveDate: Effective date if mentioned (ISO format or null)
5. expirationDate: Expiration date if mentioned (ISO format or null)
6. keyTerms: Array of important terms/obligations (max 5)
7. jurisdiction: Legal jurisdiction if mentioned

Return ONLY valid JSON, no markdown or explanation.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a legal contract analyst. Extract structured information from contracts. Always return valid JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const data = JSON.parse(response.choices[0].message.content || "{}");
  const processingTime = Date.now() - startTime;

  return {
    type: "OVERVIEW",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
    },
    confidence: 0.92,
    processingTime,
  };
}

/**
 * Generate CLAUSES artifact using LLM
 */
async function generateClausesArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `Extract and classify contract clauses from this text.

Contract Text:
${text.substring(0, 10000)}

Identify up to 10 important clauses and return JSON with array of:
{
  "clauses": [
    {
      "type": "payment|termination|liability|confidentiality|intellectual_property|indemnification|other",
      "title": "Brief clause title",
      "content": "Clause text (max 200 chars)",
      "riskLevel": "low|medium|high",
      "pageReference": "estimated page number or section",
      "summary": "1-sentence summary"
    }
  ]
}

Return ONLY valid JSON.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a contract clause analyst. Extract and classify contract clauses with risk assessment.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const data = JSON.parse(
    response.choices[0].message.content || '{"clauses":[]}'
  );
  const processingTime = Date.now() - startTime;

  return {
    type: "CLAUSES",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
    },
    confidence: 0.88,
    processingTime,
  };
}

/**
 * Generate FINANCIAL artifact using LLM
 */
async function generateFinancialArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `Extract financial information from this contract.

Contract Text:
${text.substring(0, 10000)}

Return JSON with:
{
  "totalValue": {
    "amount": number or null,
    "currency": "USD|EUR|GBP|etc" or null,
    "confidence": "high|medium|low"
  },
  "paymentTerms": "Description of payment terms",
  "paymentSchedule": "When payments are due",
  "rates": [
    {
      "role": "Role/service name",
      "rate": number,
      "unit": "hourly|daily|monthly|fixed",
      "currency": "USD|EUR|etc"
    }
  ],
  "discounts": "Any discount terms",
  "penalties": "Late payment or other penalties",
  "financialRisks": ["List of identified financial risks"]
}

Return ONLY valid JSON. Use null for missing values.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a financial contract analyst. Extract all financial terms, costs, and payment information.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const data = JSON.parse(response.choices[0].message.content || "{}");
  const processingTime = Date.now() - startTime;

  return {
    type: "FINANCIAL",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
    },
    confidence: 0.85,
    processingTime,
  };
}

/**
 * Generate RISK artifact using LLM
 */
async function generateRiskArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `Analyze risks in this contract.

Contract Text:
${text.substring(0, 10000)}

Return JSON with:
{
  "overallRiskScore": number (1-10, where 10 is highest risk),
  "riskLevel": "low|medium|high|critical",
  "identifiedRisks": [
    {
      "category": "legal|financial|operational|compliance|reputation",
      "description": "Risk description",
      "severity": "low|medium|high|critical",
      "likelihood": "low|medium|high",
      "mitigation": "Suggested mitigation strategy"
    }
  ],
  "redFlags": ["List of critical issues"],
  "recommendations": ["List of risk mitigation recommendations"]
}

Return ONLY valid JSON.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a contract risk analyst. Identify and assess all potential risks in contracts.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const data = JSON.parse(response.choices[0].message.content || "{}");
  const processingTime = Date.now() - startTime;

  return {
    type: "RISK",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
    },
    confidence: 0.87,
    processingTime,
  };
}

/**
 * Generate COMPLIANCE artifact using LLM
 */
async function generateComplianceArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  const startTime = Date.now();

  const OpenAIClass = await getOpenAI();
  const openai = new OpenAIClass({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `Analyze compliance aspects of this contract.

Contract Text:
${text.substring(0, 10000)}

Return JSON with:
{
  "complianceScore": number (1-10, where 10 is fully compliant),
  "applicableRegulations": ["List of relevant regulations/standards"],
  "complianceIssues": [
    {
      "regulation": "Regulation name",
      "issue": "Description of issue",
      "severity": "low|medium|high|critical",
      "recommendation": "How to address"
    }
  ],
  "dataProtection": {
    "hasDataClauses": boolean,
    "gdprCompliant": "yes|no|partial|unknown",
    "dataRetention": "Description if found"
  },
  "missingClauses": ["Important clauses that should be included"],
  "recommendations": ["Compliance improvement recommendations"]
}

Return ONLY valid JSON.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a compliance officer. Analyze contracts for regulatory compliance and identify gaps.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const data = JSON.parse(response.choices[0].message.content || "{}");
  const processingTime = Date.now() - startTime;

  return {
    type: "COMPLIANCE",
    data: {
      ...data,
      generatedAt: new Date().toISOString(),
      model: MODEL,
      tokensUsed: response.usage?.total_tokens || 0,
    },
    confidence: 0.83,
    processingTime,
  };
}

/**
 * Main function to generate all artifacts for a contract
 */
export async function generateRealArtifacts(
  contractId: string,
  tenantId: string,
  filePath: string,
  mimeType: string,
  prisma: PrismaClient
): Promise<void> {
  console.log(
    `🤖 Starting REAL LLM artifact generation for contract ${contractId}`
  );

  try {
    // Step 1: Extract text from file
    console.log(`📄 Extracting text from ${filePath}...`);
    const extractedText = await extractTextFromFile(filePath, mimeType);

    if (!extractedText || extractedText.length < 100) {
      throw new Error("Text extraction failed or yielded insufficient content");
    }

    console.log(`✅ Extracted ${extractedText.length} characters`);

    // Step 2: Generate artifacts in parallel for speed
    console.log(`🧠 Generating artifacts with ${MODEL}...`);

    const [overview, clauses, financial, risk, compliance] = await Promise.all([
      generateOverviewArtifact(extractedText),
      generateClausesArtifact(extractedText),
      generateFinancialArtifact(extractedText),
      generateRiskArtifact(extractedText),
      generateComplianceArtifact(extractedText),
    ]);

    // Step 3: Save all artifacts to database
    console.log(`💾 Saving artifacts to database...`);

    const artifacts = [overview, clauses, financial, risk, compliance];
    let totalTokens = 0;

    for (const artifact of artifacts) {
      await prisma.artifact.upsert({
        where: {
          contractId_type: {
            contractId,
            type: artifact.type,
          },
        },
        create: {
          contractId,
          tenantId,
          type: artifact.type,
          data: artifact.data,
          confidence: artifact.confidence,
          processingTime: artifact.processingTime,
          schemaVersion: "v1",
        },
        update: {
          data: artifact.data,
          confidence: artifact.confidence,
          processingTime: artifact.processingTime,
        },
      });

      totalTokens += artifact.data.tokensUsed || 0;
      console.log(
        `  ✅ ${artifact.type}: ${artifact.processingTime}ms, confidence: ${artifact.confidence}`
      );
    }

    console.log(
      `🎉 All artifacts generated! Total tokens used: ${totalTokens}`
    );
    console.log(
      `💰 Estimated cost: $${((totalTokens * 0.00015) / 1000).toFixed(4)}`
    );
  } catch (error) {
    console.error(`❌ Real artifact generation failed:`, error);
    throw error;
  }
}
