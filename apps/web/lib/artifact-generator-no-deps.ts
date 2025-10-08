/**
 * Real LLM-Powered Artifact Generation Service (No Dependencies Version)
 * Uses direct HTTP calls to OpenAI API instead of SDK
 * Uses Prisma for database persistence
 */

import { readFile } from "fs/promises";
import { prisma } from "./prisma";

const MODEL = "gpt-4o-mini";

type ArtifactType =
  | "OVERVIEW"
  | "CLAUSES"
  | "FINANCIAL"
  | "RISK"
  | "COMPLIANCE";

interface ArtifactGenerationResult {
  type: ArtifactType;
  data: any;
  confidence: number;
  processingTime: number;
}

/**
 * Strip markdown code blocks from JSON responses
 */
function stripMarkdownJson(content: string): string {
  // Remove ```json and ``` markers
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Call OpenAI API directly using fetch (no SDK needed)
 */
async function callOpenAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    tokens: data.usage.total_tokens,
  };
}

/**
 * Extract text from PDF file
 */
async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string> {
  try {
    // For PDFs - using pdf-parse
    if (mimeType === "application/pdf") {
      // Dynamically require pdf-parse only when needed
      let pdfParse;
      try {
        pdfParse = require("pdf-parse");
      } catch (requireError) {
        console.error("❌ Failed to load pdf-parse:", requireError);
        throw new Error("PDF parsing library not available");
      }

      const dataBuffer = await readFile(filePath);

      // Parse the PDF with pdf-parse
      const pdfData = await pdfParse(dataBuffer);

      const textLength = pdfData.text?.length || 0;
      console.log(
        `📄 PDF parsed successfully: ${pdfData.numpages} pages, ${textLength} characters extracted`
      );

      return pdfData.text || "";
    }

    // For plain text
    if (mimeType === "text/plain") {
      const text = await readFile(filePath, "utf-8");
      console.log(`📄 Text file read: ${text.length} characters`);
      return text;
    }

    // Default: try to read as text
    const text = await readFile(filePath, "utf-8");
    console.log(`📄 File read as text: ${text.length} characters`);
    return text;
  } catch (error) {
    console.error("❌ Text extraction failed:", error);
    console.error("   File path:", filePath);
    console.error("   MIME type:", mimeType);

    if (error instanceof Error) {
      console.error("   Error message:", error.message);
      console.error("   Error stack:", error.stack?.substring(0, 500));
    }

    // Re-throw the error so we can handle it properly upstream
    throw new Error(
      `Failed to extract text from file: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Generate OVERVIEW artifact using OpenAI
 */
async function generateOverviewArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  console.log("📝 Generating OVERVIEW artifact...");
  const startTime = Date.now();

  try {
    const result = await callOpenAI([
      {
        role: "system",
        content:
          "You are a legal document analyst. Extract key information from contracts and return it as valid JSON only, with no additional text.",
      },
      {
        role: "user",
        content: `Analyze this contract and extract:
- summary (2-3 sentence overview)
- parties (array of party names)
- effectiveDate (YYYY-MM-DD format if found)
- expirationDate (YYYY-MM-DD format if found)
- contractType (e.g., "Service Agreement", "NDA", etc.)

Return ONLY valid JSON with these fields. If a field is not found, use null.

Contract text:
${text.substring(0, 8000)}`,
      },
    ]);

    const processingTime = Date.now() - startTime;

    // Parse the JSON response (strip markdown if present)
    let data;
    try {
      const cleanedContent = stripMarkdownJson(result.content);
      data = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("Failed to parse overview response:", result.content);
      data = {
        summary: "Failed to parse AI response",
        parties: [],
        contractType: "Unknown",
      };
    }

    console.log(
      `✅ OVERVIEW generated in ${processingTime}ms (${result.tokens} tokens)`
    );

    return {
      type: "OVERVIEW",
      data,
      confidence: 0.85,
      processingTime,
    };
  } catch (error) {
    console.error("Error generating overview:", error);
    throw error;
  }
}

/**
 * Generate CLAUSES artifact using OpenAI
 */
async function generateClausesArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  console.log("📋 Generating CLAUSES artifact...");
  const startTime = Date.now();

  try {
    const result = await callOpenAI([
      {
        role: "system",
        content:
          "You are a legal clause extraction specialist. Identify and classify contract clauses. Return valid JSON only.",
      },
      {
        role: "user",
        content: `Extract all major clauses from this contract. For each clause return:
- title (clause name/heading)
- content (brief summary or key points)
- riskLevel ("low", "medium", "high")
- category (e.g., "payment", "termination", "liability", "confidentiality")

Return JSON array with field "clauses". Example:
{"clauses": [{"title": "Payment Terms", "content": "...", "riskLevel": "low", "category": "payment"}]}

Contract text:
${text.substring(0, 8000)}`,
      },
    ]);

    const processingTime = Date.now() - startTime;

    let data;
    try {
      const cleanedContent = stripMarkdownJson(result.content);
      data = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("Failed to parse clauses response:", result.content);
      data = { clauses: [] };
    }

    console.log(
      `✅ CLAUSES generated in ${processingTime}ms (${result.tokens} tokens)`
    );

    return {
      type: "CLAUSES",
      data,
      confidence: 0.82,
      processingTime,
    };
  } catch (error) {
    console.error("Error generating clauses:", error);
    throw error;
  }
}

/**
 * Generate FINANCIAL artifact using OpenAI
 */
async function generateFinancialArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  console.log("💰 Generating FINANCIAL artifact...");
  const startTime = Date.now();

  try {
    const result = await callOpenAI([
      {
        role: "system",
        content:
          "You are a financial contract analyst. Extract all monetary terms, payment schedules, rate cards, and tables. Return valid JSON only.",
      },
      {
        role: "user",
        content: `Extract comprehensive financial information from this contract:

1. totalValue: Total contract value as string with currency (e.g., "$750,000 USD")
2. currency: ISO code like "USD", "EUR"
3. paymentTerms: Array of payment milestones with:
   - milestone: description
   - amount: payment amount
   - dueDate: when payment is due
   - percentage: percentage of total
4. rateCards: Array of rate card tables found in the contract, each with:
   - title: rate card name
   - currency: currency code
   - rates: array of rate entries with {role, level, hourlyRate, dailyRate, category}
5. extractedTables: Array of financial tables found, each with:
   - title: table title
   - type: "payment_schedule", "rate_card", or "other"
   - headers: array of column headers
   - rows: array of row objects
6. penalties: Array of penalty/fee descriptions

If the contract contains rate cards or pricing tables, extract ALL roles and rates.
Return JSON with these fields. Use empty arrays [] if sections not found.

Contract text:
${text.substring(0, 12000)}`,
      },
    ]);

    const processingTime = Date.now() - startTime;

    let data;
    try {
      const cleanedContent = stripMarkdownJson(result.content);
      data = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("Failed to parse financial response:", result.content);
      data = { totalValue: null, currency: "USD", paymentTerms: [] };
    }

    console.log(
      `✅ FINANCIAL generated in ${processingTime}ms (${result.tokens} tokens)`
    );

    return {
      type: "FINANCIAL",
      data,
      confidence: 0.88,
      processingTime,
    };
  } catch (error) {
    console.error("Error generating financial:", error);
    throw error;
  }
}

/**
 * Generate RISK artifact using OpenAI
 */
async function generateRiskArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  console.log("⚠️  Generating RISK artifact...");
  const startTime = Date.now();

  try {
    const result = await callOpenAI([
      {
        role: "system",
        content:
          "You are a legal risk analyst. Identify potential risks in contracts. Return valid JSON only.",
      },
      {
        role: "user",
        content: `Analyze this contract for risks. For each risk return:
- description (what the risk is)
- severity ("low", "medium", "high", "critical")
- category (e.g., "financial", "legal", "operational", "reputational")
- mitigation (suggested mitigation strategy)

Return JSON with field "risks" as an array.

Contract text:
${text.substring(0, 8000)}`,
      },
    ]);

    const processingTime = Date.now() - startTime;

    let data;
    try {
      const cleanedContent = stripMarkdownJson(result.content);
      data = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("Failed to parse risk response:", result.content);
      data = { risks: [] };
    }

    console.log(
      `✅ RISK generated in ${processingTime}ms (${result.tokens} tokens)`
    );

    return {
      type: "RISK",
      data,
      confidence: 0.8,
      processingTime,
    };
  } catch (error) {
    console.error("Error generating risk:", error);
    throw error;
  }
}

/**
 * Generate COMPLIANCE artifact using OpenAI
 */
async function generateComplianceArtifact(
  text: string
): Promise<ArtifactGenerationResult> {
  console.log("✅ Generating COMPLIANCE artifact...");
  const startTime = Date.now();

  try {
    const result = await callOpenAI([
      {
        role: "system",
        content:
          "You are a compliance specialist. Identify regulatory and compliance requirements in contracts. Return valid JSON only.",
      },
      {
        role: "user",
        content: `Analyze this contract for compliance requirements:
- regulations (relevant laws/regulations mentioned)
- dataProtection (GDPR, privacy requirements)
- industryStandards (ISO, SOC2, etc.)
- auditRequirements (audit rights, frequency)
- certifications (required certifications)

Return JSON with these fields as arrays. Use empty arrays if not found.

Contract text:
${text.substring(0, 8000)}`,
      },
    ]);

    const processingTime = Date.now() - startTime;

    let data;
    try {
      const cleanedContent = stripMarkdownJson(result.content);
      data = JSON.parse(cleanedContent);
    } catch (e) {
      console.error("Failed to parse compliance response:", result.content);
      data = {
        regulations: [],
        dataProtection: [],
        industryStandards: [],
        auditRequirements: [],
        certifications: [],
      };
    }

    console.log(
      `✅ COMPLIANCE generated in ${processingTime}ms (${result.tokens} tokens)`
    );

    return {
      type: "COMPLIANCE",
      data,
      confidence: 0.78,
      processingTime,
    };
  } catch (error) {
    console.error("Error generating compliance:", error);
    throw error;
  }
}

/**
 * Main function: Generate all artifacts using real LLM
 */
export async function generateArtifactsNoDeps(
  contractId: string,
  processingJobId: string,
  filePath: string,
  mimeType: string
): Promise<void> {
  console.log(
    `🧠 Starting REAL LLM artifact generation (no SDK version) for contract ${contractId}`
  );
  const overallStart = Date.now();

  try {
    // Step 1: Extract text from file
    console.log(`📄 Extracting text from ${filePath}...`);
    const extractedText = await extractTextFromFile(filePath, mimeType);

    console.log(`✅ Extracted ${extractedText.length} characters`);
    console.log(`📝 First 200 chars: ${extractedText.substring(0, 200)}`);

    if (!extractedText || extractedText.length < 20) {
      throw new Error(
        `Insufficient text extracted from file. Got ${extractedText.length} characters, need at least 20.`
      );
    }

    // Step 2: Generate all artifacts in parallel
    console.log("🔄 Generating 5 artifact types in parallel...");
    const [overview, clauses, financial, risk, compliance] = await Promise.all([
      generateOverviewArtifact(extractedText),
      generateClausesArtifact(extractedText),
      generateFinancialArtifact(extractedText),
      generateRiskArtifact(extractedText),
      generateComplianceArtifact(extractedText),
    ]);

    // Step 3: Save all artifacts to database
    console.log("💾 Saving artifacts to database...");
    const artifacts = [overview, clauses, financial, risk, compliance];

    // Get contract to verify it exists
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Save artifacts using Prisma
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
          tenantId: contract.tenantId,
          type: artifact.type,
          data: {
            ...artifact.data,
            _meta: {
              processingTime: artifact.processingTime,
              generatedAt: new Date().toISOString(),
              model: MODEL,
            },
          },
          confidence: artifact.confidence,
          processingTime: artifact.processingTime,
        },
        update: {
          data: {
            ...artifact.data,
            _meta: {
              processingTime: artifact.processingTime,
              generatedAt: new Date().toISOString(),
              model: MODEL,
            },
          },
          confidence: artifact.confidence,
          processingTime: artifact.processingTime,
        },
      });
    }

    // Step 4: Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        lastAnalyzedAt: new Date(),
      },
    });

    const totalTime = Date.now() - overallStart;
    console.log(`\n✅ REAL LLM artifact generation complete!`);
    console.log(
      `   📊 Generated ${artifacts.length} artifacts in ${totalTime}ms`
    );
    console.log(`   💰 Contract ${contractId} marked as COMPLETED\n`);
  } catch (error) {
    console.error("❌ Artifact generation failed:", error);

    // Mark contract as failed
    try {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "FAILED" },
      });
    } catch (updateError) {
      console.error("Failed to update contract status:", updateError);
    }

    throw error;
  }
}
