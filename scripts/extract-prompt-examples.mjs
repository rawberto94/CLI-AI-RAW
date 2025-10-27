#!/usr/bin/env node

/**
 * Extract real contract examples from /data/contracts for enhanced prompts
 * 
 * This script reads actual contract JSON files and extracts representative
 * examples for each artifact type to improve LLM extraction accuracy.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACTS_DIR = path.join(__dirname, '../data/contracts');
const OUTPUT_FILE = path.join(__dirname, '../apps/web/lib/real-contract-examples.ts');

// Helper functions
function extractParties(text) {
  const parties = [];
  const clientMatch = text.match(/CLIENT:\s*([^\n]+)/i);
  const providerMatch = text.match(/PROVIDER:\s*([^\n]+)/i);
  if (clientMatch) parties.push({ name: clientMatch[1].trim(), role: 'client' });
  if (providerMatch) parties.push({ name: providerMatch[1].trim(), role: 'provider' });
  return parties;
}

function extractDate(text, pattern) {
  const regex = new RegExp(`${pattern}[:\\s]+([A-Za-z]+\\s+\\d{1,2},\\s+\\d{4})`, 'i');
  const match = text.match(regex);
  return match ? match[1] : null;
}

function extractClauses(text) {
  const clauses = [];
  const sections = text.match(/^\d+\.\s+[A-Z\s]+$/gm) || [];
  sections.slice(0, 5).forEach(section => {
    clauses.push({
      title: section.trim(),
      type: 'general'
    });
  });
  return clauses;
}

async function extractExamples() {
  const examples = {
    OVERVIEW: [],
    CLAUSES: [],
    FINANCIAL: [],
    RISK: [],
    COMPLIANCE: [],
    RATES: []
  };

  try {
    const files = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith('.json'));
    
    console.log(`📂 Found ${files.length} contract files`);

    for (const file of files) {
      const filePath = path.join(CONTRACTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      try {
        const contract = JSON.parse(content);
        console.log(`✅ Processing: ${file}`);

        // Get the original text for input examples
        const originalText = contract.originalContent || contract.extractedText || '';
        const textSample = originalText.substring(0, 500); // First 500 chars as context

        // Extract from extractedData artifacts
        const artifacts = contract.extractedData || {};

        // Extract overview examples (from original text analysis)
        if (contract.originalContent && artifacts['text-extraction']) {
          const textSample = artifacts['text-extraction'].extractedText || contract.originalContent;
          // Create a synthetic overview example from contract header
          const lines = textSample.split('\n').slice(0, 30).join('\n');
          if (lines.includes('Agreement') || lines.includes('CONTRACT')) {
            examples.OVERVIEW.push({
              input: `Contract header: ${lines.substring(0, 300)}...`,
              output: {
                contractTitle: lines.match(/([A-Z\s]+AGREEMENT|CONTRACT)/)?.[0] || 'Service Agreement',
                parties: extractParties(lines),
                effectiveDate: extractDate(lines, 'Effective|entered into'),
                expirationDate: extractDate(lines, 'Expiration|End Date'),
                summary: 'AI-powered service agreement'
              }
            });
          }
        }

        // Extract financial examples
        if (artifacts['financial-analysis']) {
          examples.FINANCIAL.push({
            input: `Extract financial terms from: ${textSample.substring(0, 200)}...`,
            output: artifacts['financial-analysis']
          });
        }

        // Extract clauses examples (from text extraction)
        if (artifacts['text-extraction'] && contract.originalContent) {
          const text = contract.originalContent;
          const clauses = extractClauses(text);
          if (clauses.length > 0) {
            examples.CLAUSES.push({
              input: `Identify key clauses in: ${text.substring(0, 200)}...`,
              output: { clauses, totalCount: clauses.length }
            });
          }
        }

        // Extract risk examples
        if (artifacts['risk-analysis']) {
          examples.RISK.push({
            input: `Assess risks from contract: ${textSample.substring(0, 200)}...`,
            output: artifacts['risk-analysis']
          });
        }

        // Extract compliance examples
        if (artifacts['compliance-check']) {
          examples.COMPLIANCE.push({
            input: `Check compliance requirements: ${textSample.substring(0, 200)}...`,
            output: artifacts['compliance-check']
          });
        }

        // Extract rate card examples (from financial data)
        if (artifacts['financial-analysis'] && artifacts['financial-analysis'].paymentSchedule) {
          const financial = artifacts['financial-analysis'];
          if (financial.paymentSchedule && financial.paymentSchedule.length > 0) {
            examples.RATES.push({
              input: `Extract rate information: ${textSample.substring(0, 200)}...`,
              output: {
                rateCards: financial.paymentSchedule,
                currency: financial.currency || 'USD',
                totalValue: financial.totalValue
              }
            });
          }
        }

      } catch (parseError) {
        console.warn(`⚠️  Failed to parse ${file}:`, parseError.message);
      }
    }

    // Generate TypeScript file
    const outputContent = `/**
 * Real contract examples extracted from /data/contracts
 * 
 * These examples are used to improve LLM prompt accuracy with
 * domain-specific, real-world contract data.
 * 
 * Generated: ${new Date().toISOString()}
 * Source files: ${files.length}
 */

export const REAL_CONTRACT_EXAMPLES = ${JSON.stringify(examples, null, 2)};

export function getRealExamples(artifactType: string, count: number = 2) {
  const examples = REAL_CONTRACT_EXAMPLES[artifactType] || [];
  return examples.slice(0, count);
}
`;

    fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf-8');

    console.log(`\n✨ Successfully extracted examples:`);
    Object.entries(examples).forEach(([type, exs]) => {
      console.log(`   ${type}: ${exs.length} examples`);
    });
    console.log(`\n📝 Output written to: ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('❌ Error extracting examples:', error);
    process.exit(1);
  }
}

extractExamples();
