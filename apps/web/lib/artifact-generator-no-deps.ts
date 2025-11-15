/**
 * Real LLM-Powered Artifact Generation Service
 * Now with State-of-the-Art OCR:
 * - Hybrid OCR strategy (fast/balanced/high quality)
 * - GPT-4 Vision for complex documents
 * - AWS Textract for enterprise-grade table extraction
 * - Document preprocessing for 30-50% accuracy improvement
 * 
 * @see UPLOAD_OCR_AUDIT_REPORT.md for details
 */

import { readFile } from "fs/promises";
import { prisma } from "./prisma";
import { extractDocumentData, HybridOcrResult } from "./hybrid-ocr";

const MODEL = "gpt-4o-mini";

// OCR quality mode (can be configured per contract or globally)
const OCR_QUALITY_MODE = (process.env.OCR_QUALITY_MODE || 'balanced') as 'fast' | 'balanced' | 'high';

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
 * Extract text and data from file using Hybrid OCR
 * 
 * Now uses state-of-the-art extraction:
 * - Intelligent complexity assessment
 * - GPT-4 Vision for complex documents
 * - AWS Textract for tables
 * - Document preprocessing
 */
async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<{ text: string; ocrResult?: HybridOcrResult }> {
  try {
    console.log(`🔍 Extracting document with ${OCR_QUALITY_MODE} quality OCR...`);
    
    // Use hybrid OCR for intelligent extraction
    const ocrResult = await extractDocumentData(filePath, {
      quality: OCR_QUALITY_MODE,
      usePreprocessing: true,
      visionModel: 'gpt-4o',
      awsRegion: process.env.AWS_REGION || 'us-east-1',
    });

    // Build comprehensive text from OCR result
    const textParts: string[] = [];
    
    // Add overview
    if (ocrResult.analysis.overview.summary) {
      textParts.push(`SUMMARY: ${ocrResult.analysis.overview.summary}`);
    }
    
    // Add parties
    if (ocrResult.analysis.overview.parties.length > 0) {
      textParts.push('\nPARTIES:');
      ocrResult.analysis.overview.parties.forEach(party => {
        textParts.push(`- ${party.name} (${party.role})`);
      });
    }
    
    // Add clauses
    if (ocrResult.analysis.clauses.length > 0) {
      textParts.push('\nKEY CLAUSES:');
      ocrResult.analysis.clauses.forEach(clause => {
        textParts.push(`\n${clause.title}:`);
        textParts.push(clause.content);
      });
    }
    
    // Add tables
    if (ocrResult.analysis.tables.length > 0) {
      textParts.push('\nTABLES:');
      ocrResult.analysis.tables.forEach((table, i) => {
        textParts.push(`\nTable ${i + 1}${table.title ? `: ${table.title}` : ''}:`);
        textParts.push(table.headers.join(' | '));
        table.rows.forEach(row => {
          textParts.push(row.join(' | '));
        });
      });
    }
    
    // Add financial info
    if (ocrResult.analysis.financial.ratecards.length > 0) {
      textParts.push('\nRATE CARDS:');
      ocrResult.analysis.financial.ratecards.forEach(rc => {
        textParts.push(`- ${rc.role}: ${rc.rate} ${rc.currency}/${rc.unit}`);
      });
    }
    
    // If we have Textract data, add it too
    if (ocrResult.textractData?.text) {
      textParts.push('\nFULL TEXT:');
      textParts.push(ocrResult.textractData.text);
    }

    const text = textParts.join('\n');
    
    console.log(`✅ Document extracted using ${ocrResult.metadata.methodUsed}`);
    console.log(`   Quality: ${ocrResult.metadata.quality}`);
    console.log(`   Confidence: ${(ocrResult.metadata.confidence * 100).toFixed(1)}%`);
    console.log(`   Processing time: ${ocrResult.metadata.timing.total}ms`);
    console.log(`   Cost: $${ocrResult.metadata.costs.total.toFixed(4)}`);
    console.log(`   Text length: ${text.length} characters`);
    
    if (ocrResult.analysis.tables.length > 0) {
      console.log(`   Extracted ${ocrResult.analysis.tables.length} tables`);
    }

    return { text, ocrResult };
  } catch (error) {
    console.error("❌ Hybrid OCR extraction failed, falling back to basic extraction:", error);
    
    // Fallback to basic extraction if hybrid OCR fails
    try {
      // For PDFs - using pdf-parse as fallback
      if (mimeType === "application/pdf") {
        const pdfParse = require("pdf-parse");
        const dataBuffer = await readFile(filePath);
        const pdfData = await pdfParse(dataBuffer);
        
        console.log(`📄 Fallback: PDF parsed with pdf-parse (${pdfData.numpages} pages)`);
        return { text: pdfData.text || "" };
      }

      // For plain text
      if (mimeType === "text/plain") {
        const text = await readFile(filePath, "utf-8");
        console.log(`📄 Fallback: Text file read (${text.length} characters)`);
        return { text };
      }

      // Default: try to read as text
      const text = await readFile(filePath, "utf-8");
      console.log(`📄 Fallback: File read as text (${text.length} characters)`);
      return { text };
    } catch (fallbackError) {
      console.error("❌ Fallback extraction also failed:", fallbackError);
      throw new Error(
        `Failed to extract text from file: ${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }`
      );
    }
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
        content: `Analyze this contract and extract comprehensive overview information:

1. summary: 3-4 sentence executive summary covering purpose, key terms, and significance
2. detailedDescription: Longer description (2-3 paragraphs) explaining what this contract is about
3. parties: Array of parties with:
   - name: party name
   - role: their role (e.g., "Client", "Service Provider", "Vendor")
   - address: address if mentioned
   - contact: contact information if provided
   - obligations: brief summary of main obligations
4. effectiveDate: Start date (YYYY-MM-DD format if found)
5. expirationDate: End date (YYYY-MM-DD format if found)
6. duration: Contract duration (e.g., "12 months", "3 years")
7. renewalTerms: Renewal provisions (automatic renewal, notice period, etc.)
8. contractType: Type (e.g., "Service Agreement", "NDA", "MSA", "SoW", "License Agreement")
9. governingLaw: Jurisdiction and governing law
10. scope: Description of scope of work/services
11. deliverables: Array of key deliverables with:
    - name: deliverable name
    - description: what it is
    - deadline: when it's due
    - acceptanceCriteria: how it will be accepted
12. keyDates: Array of important dates with:
    - date: YYYY-MM-DD
    - description: what happens
    - type: "milestone", "deadline", "review", etc.
13. terminationRights: Summary of termination provisions
14. noticePeriod: Required notice period for termination
15. jurisdiction: Legal jurisdiction for disputes
16. signatories: Array of people who must sign with their titles
17. amendments: How amendments must be made
18. entireAgreement: If this is the entire agreement clause present
19. executionMethod: How contract is executed (electronic, physical, etc.)

Return ONLY valid JSON with these fields. If a field is not found, use null or empty array.

Contract text:
${text.substring(0, 10000)}`,
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
- content (brief summary or key points, 2-3 sentences)
- fullText (complete clause text if available, otherwise summary)
- riskLevel ("low", "medium", "high", "critical")
- category (e.g., "payment", "termination", "liability", "confidentiality", "intellectual_property", "warranties", "indemnification", "dispute_resolution", "force_majeure")
- obligations: array of specific obligations with:
  - party: which party has the obligation ("client", "supplier", "both")
  - description: what must be done
  - deadline: any timeframes specified
  - consequence: what happens if not fulfilled
- recommendations: array of recommended actions or concerns

Focus on these critical clause types:
1. Termination clauses (notice periods, conditions, consequences)
2. Liability and indemnification (caps, exclusions, insurance requirements)
3. Intellectual property rights (ownership, licenses, restrictions)
4. Confidentiality and data protection (scope, duration, exceptions)
5. Warranties and representations (what is guaranteed)
6. Change management (how changes are requested and approved)
7. Dispute resolution (arbitration, jurisdiction, governing law)
8. Force majeure (what events excuse performance)
9. Assignment and subcontracting (restrictions, approvals needed)
10. Service levels and performance standards (SLAs, KPIs, remedies)

Return JSON object with field "clauses" as an array. Example:
{"clauses": [{"title": "Payment Terms", "content": "...", "fullText": "...", "riskLevel": "low", "category": "payment", "obligations": [...], "recommendations": [...]}]}

Contract text:
${text.substring(0, 10000)}`,
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
   - conditions: any conditions for payment
4. rateCards: Array of rate card tables found in the contract, each with:
   - title: rate card name
   - currency: currency code
   - rates: array of rate entries with {role, level, hourlyRate, dailyRate, category}
5. extractedTables: Array of financial tables found, each with:
   - title: table title
   - type: "payment_schedule", "rate_card", or "other"
   - headers: array of column headers
   - rows: array of row objects
6. penalties: Array of penalty/fee descriptions with:
   - description: what triggers the penalty
   - amount: penalty amount or formula
   - type: "late_payment", "termination", "performance", "other"
7. bonuses: Array of bonus/incentive provisions with:
   - description: what triggers the bonus
   - amount: bonus amount or formula
   - criteria: specific criteria to achieve
8. paymentSchedule: Detailed payment schedule with:
   - frequency: "monthly", "quarterly", "milestone-based", etc.
   - method: payment method if specified
   - terms: net payment terms (e.g., "Net 30", "Net 60")
   - lateFees: late payment fees if specified
9. budgetAllocation: Budget breakdown by category if available, array of:
   - category: budget category name
   - amount: allocated amount
   - percentage: percentage of total budget
10. expenses: Reimbursable expenses information:
   - reimbursable: boolean if expenses are reimbursable
   - categories: array of reimbursable expense categories
   - limits: any limits on reimbursements
   - approvalRequired: if approval is needed
11. priceAdjustments: Price adjustment clauses:
   - inflationAdjustment: if prices adjust for inflation
   - formula: adjustment formula if specified
   - frequency: how often adjustments occur
   - indices: any indices used (CPI, etc.)

If the contract contains rate cards or pricing tables, extract ALL roles and rates.
Return JSON with these fields. Use empty arrays [] or null if sections not found.

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
        content: `Analyze this contract comprehensively for risks. For each risk return:
- id: unique identifier (e.g., "RISK-001")
- title: short risk title
- description: detailed description of what the risk is
- severity: "low", "medium", "high", "critical"
- probability: "low", "medium", "high" (likelihood of occurrence)
- impact: detailed impact if risk materializes
- category: "financial", "legal", "operational", "reputational", "compliance", "strategic", "technical"
- affectedParties: array of parties affected ("client", "supplier", "both")
- triggers: array of conditions or events that could trigger this risk
- mitigation: array of mitigation strategies with:
  - action: what to do
  - responsibility: who should do it
  - priority: "immediate", "high", "medium", "low"
  - cost: estimated cost/effort if known
- residualRisk: risk level after mitigation ("low", "medium", "high")
- relatedClauses: array of clause titles this risk relates to

Analyze these risk categories:
1. Financial risks (payment defaults, cost overruns, penalties, exchange rates)
2. Legal risks (liability exposure, non-compliance, jurisdiction issues, enforceability)
3. Operational risks (delivery failures, resource constraints, dependencies, force majeure)
4. Reputational risks (brand damage, confidentiality breaches, quality issues)
5. Compliance risks (regulatory violations, data protection, industry standards)
6. Strategic risks (scope creep, changing requirements, market conditions)
7. Technical risks (technology dependencies, IP issues, security vulnerabilities)

Also calculate an overall risk score (0-100) and provide a risk matrix summary.

Return JSON with:
- risks: array of detailed risk objects
- overallScore: 0-100 risk score
- riskMatrix: object with counts for each severity level
- summary: brief executive summary of key risks
- recommendations: top 3-5 priority actions

Contract text:
${text.substring(0, 10000)}`,
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
        content: `Analyze this contract for comprehensive compliance requirements:

1. regulations: Array of relevant laws/regulations with:
   - name: regulation name (e.g., "GDPR", "SOX", "HIPAA")
   - jurisdiction: applicable jurisdiction
   - requirements: array of specific requirements
   - penalties: potential penalties for non-compliance
   - references: where mentioned in contract

2. dataProtection: Data protection and privacy requirements:
   - gdprCompliant: boolean if GDPR requirements are met
   - dataTypes: types of data handled (PII, sensitive, etc.)
   - dataProcessing: how data is processed
   - dataRetention: retention policies
   - dataSubjects: whose data is involved
   - transferMechanisms: international data transfer mechanisms
   - breachNotification: breach notification requirements
   - dpoRequired: if Data Protection Officer is required
   - rights: data subject rights that must be supported

3. industryStandards: Industry standards and certifications:
   - name: standard name (ISO 27001, SOC 2, PCI-DSS, etc.)
   - required: if it's required or recommended
   - scope: what it applies to
   - evidence: evidence requirements
   - timeline: when compliance must be achieved

4. auditRequirements: Audit and inspection rights:
   - frequency: how often audits can occur
   - notice: notice period required
   - scope: what can be audited
   - costs: who bears audit costs
   - remediation: remediation timeline if issues found
   - thirdParty: if third-party audits are allowed

5. certifications: Required certifications and qualifications:
   - type: certification type
   - holder: who must hold it (company, personnel)
   - validity: how long it's valid
   - renewal: renewal requirements
   - verification: how it's verified

6. recordKeeping: Documentation and record retention:
   - documents: types of records to maintain
   - duration: how long to keep records
   - format: required format (electronic, paper, etc.)
   - access: who has access rights
   - destruction: secure destruction requirements

7. reporting: Compliance reporting obligations:
   - type: type of report required
   - frequency: reporting frequency
   - recipients: who receives reports
   - content: what must be included
   - deadline: reporting deadlines

8. insuranceRequirements: Insurance and bonding requirements:
   - types: types of insurance required
   - coverage: minimum coverage amounts
   - providers: any requirements on insurance providers
   - certificates: certificate of insurance requirements
   - beneficiaries: who must be named as beneficiaries

9. complianceScore: Overall compliance score (0-100)
10. gaps: Array of compliance gaps or concerns
11. recommendations: Priority recommendations to ensure compliance

Return JSON with all these fields. Use empty arrays/null if sections not found.

Contract text:
${text.substring(0, 10000)}`,
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
    // Step 1: Extract text from file using Hybrid OCR
    console.log(`📄 Extracting text from ${filePath}...`);
    const extractionResult = await extractTextFromFile(filePath, mimeType);
    const extractedText = extractionResult.text;
    const ocrResult = extractionResult.ocrResult;

    console.log(`✅ Extracted ${extractedText.length} characters`);
    console.log(`📝 First 200 chars: ${extractedText.substring(0, 200)}`);
    
    if (ocrResult) {
      console.log(`📊 OCR Stats:`);
      console.log(`   - Method: ${ocrResult.metadata.methodUsed}`);
      console.log(`   - Confidence: ${(ocrResult.metadata.confidence * 100).toFixed(1)}%`);
      console.log(`   - Tables: ${ocrResult.analysis.tables.length}`);
      console.log(`   - Clauses: ${ocrResult.analysis.clauses.length}`);
      console.log(`   - Cost: $${ocrResult.metadata.costs.total.toFixed(4)}`);
    }

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
