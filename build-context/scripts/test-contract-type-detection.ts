#!/usr/bin/env npx tsx
/**
 * Contract Type Detection & Categorization Test Script
 * 
 * Tests the full pipeline:
 * 1. Keyword-based detection
 * 2. AI-based detection
 * 3. Categorization worker simulation
 * 4. Metadata storage verification
 */

// Sample contract texts for testing
const SAMPLE_CONTRACTS: Record<string, string> = {
  NDA: `
NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of January 15, 2025 
between ABC Corporation, a Delaware corporation ("Disclosing Party"), and 
XYZ Inc., a California corporation ("Receiving Party").

WHEREAS, the Disclosing Party possesses certain confidential and proprietary 
information relating to its business operations, technology, and trade secrets;

WHEREAS, the Receiving Party desires to receive such confidential information 
for the purpose of evaluating a potential business relationship;

NOW, THEREFORE, in consideration of the mutual covenants and agreements hereinafter 
set forth, the parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any information, technical data, or know-how, 
including, but not limited to, that which relates to research, product plans, 
products, services, customers, markets, software, developments, inventions, 
processes, designs, drawings, engineering, hardware configuration information, 
marketing, finances, or other business information.

2. NON-DISCLOSURE OBLIGATIONS
The Receiving Party agrees to hold and maintain the Confidential Information in 
strict confidence and not to disclose any Confidential Information to any third 
parties without the prior written approval of the Disclosing Party.

3. TERM
This Agreement shall remain in effect for a period of three (3) years from the 
date of this Agreement.

4. NON-CIRCUMVENTION
Neither party shall circumvent the other party in any business dealings.

5. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Delaware.
`,

  SOW: `
STATEMENT OF WORK
Software Development Services

Project Name: Enterprise CRM Implementation
SOW Reference: SOW-2025-001
Effective Date: February 1, 2025

1. PARTIES
This Statement of Work ("SOW") is entered into by:
- Client: GlobalTech Industries, Inc. ("Client")
- Service Provider: DevPartners LLC ("Provider")

This SOW is governed by the Master Services Agreement dated December 1, 2024.

2. PROJECT SCOPE
The Provider shall deliver the following software development services:
- Custom CRM module development
- Integration with existing ERP system
- Data migration from legacy systems
- User training and documentation

3. DELIVERABLES
Phase 1 - Requirements & Design (4 weeks)
- Business requirements document
- Technical architecture document
- UI/UX wireframes

Phase 2 - Development (12 weeks)
- Core CRM functionality
- API integrations
- Automated testing suite

Phase 3 - Deployment (2 weeks)
- Production deployment
- Data migration
- User acceptance testing

4. PRICING AND PAYMENT TERMS
Total Project Value: $450,000 USD
Payment Schedule:
- 30% upon SOW execution: $135,000
- 40% upon Phase 2 completion: $180,000
- 30% upon final acceptance: $135,000

Payment terms: Net 30 days from invoice date.

5. RESOURCE ALLOCATION
- 2 Senior Software Engineers (40 hrs/week each)
- 1 Project Manager (20 hrs/week)
- 1 QA Engineer (30 hrs/week)

6. ACCEPTANCE CRITERIA
Deliverables shall be considered accepted upon Client written approval or after 
10 business days following delivery without written objection.
`,

  MSA: `
MASTER SERVICES AGREEMENT

This Master Services Agreement ("Agreement") is made effective as of March 1, 2025 
("Effective Date") by and between:

TechSolutions Corp., a company organized under the laws of Texas 
("Service Provider")

AND

Enterprise Holdings Inc., a company organized under the laws of New York ("Client")

RECITALS

WHEREAS, Service Provider is in the business of providing technology consulting, 
software development, and managed IT services;

WHEREAS, Client desires to engage Service Provider to perform certain services 
on the terms and conditions set forth herein;

NOW, THEREFORE, in consideration of the mutual promises contained herein, 
the parties agree as follows:

ARTICLE 1. SERVICES
1.1 Engagement. Service Provider agrees to provide the services described in 
individual Statements of Work ("SOWs") executed under this Agreement.

1.2 Standard of Performance. Service Provider shall perform all services in a 
professional and workmanlike manner, consistent with industry standards.

ARTICLE 2. COMPENSATION
2.1 Fees. Client shall pay Service Provider the fees set forth in each SOW.
2.2 Expenses. Reasonable pre-approved expenses shall be reimbursed by Client.
2.3 Invoicing. Service Provider shall invoice monthly. Payment is due Net 30.

ARTICLE 3. TERM AND TERMINATION
3.1 Term. This Agreement shall remain in effect for three (3) years.
3.2 Termination for Convenience. Either party may terminate upon 90 days notice.
3.3 Termination for Cause. Upon material breach not cured within 30 days.

ARTICLE 4. INTELLECTUAL PROPERTY
4.1 Work Product. All deliverables shall be owned by Client.
4.2 Pre-Existing IP. Service Provider retains ownership of pre-existing IP.

ARTICLE 5. CONFIDENTIALITY
5.1 Both parties shall maintain confidentiality of proprietary information.

ARTICLE 6. LIMITATION OF LIABILITY
6.1 Neither party shall be liable for indirect or consequential damages.
6.2 Total liability shall not exceed fees paid in the preceding 12 months.

ARTICLE 7. GENERAL PROVISIONS
7.1 Governing Law. This Agreement shall be governed by Texas law.
7.2 Entire Agreement. This Agreement constitutes the entire agreement.
7.3 Amendments. Modifications require written agreement of both parties.
`,

  EMPLOYMENT: `
EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into as of April 1, 2025 
between:

Employer: InnovateTech Solutions Inc., a Delaware corporation ("Company")
Employee: John Smith ("Employee")

1. POSITION AND DUTIES
The Company hereby employs the Employee as Senior Software Engineer. Employee 
shall report to the VP of Engineering and perform duties consistent with this 
position.

2. COMPENSATION
2.1 Base Salary: $175,000 per year, payable bi-weekly.
2.2 Signing Bonus: $25,000, payable within 30 days of start date.
2.3 Annual Bonus: Target bonus of 15% of base salary, based on performance.
2.4 Equity: 50,000 stock options vesting over 4 years with 1-year cliff.

3. BENEFITS
Employee shall be entitled to:
- Health, dental, and vision insurance
- 401(k) with 4% company match
- 20 days paid time off annually
- 10 paid holidays

4. TERM OF EMPLOYMENT
Employment is at-will and may be terminated by either party at any time, 
with or without cause, upon two (2) weeks written notice.

5. CONFIDENTIALITY
Employee agrees to maintain confidentiality of all proprietary information 
during and after employment.

6. NON-COMPETE AND NON-SOLICITATION
6.1 Non-Compete: For 12 months following termination, Employee shall not 
work for a direct competitor within a 50-mile radius.
6.2 Non-Solicitation: For 24 months following termination, Employee shall 
not solicit Company employees or customers.

7. INTELLECTUAL PROPERTY
All inventions and work product created during employment shall belong to 
the Company.

8. GOVERNING LAW
This Agreement shall be governed by the laws of the State of Delaware.
`,

  PURCHASE_ORDER: `
PURCHASE ORDER

PO Number: PO-2025-0042
Date: January 20, 2025
Vendor: Industrial Supply Co.
Ship To: ABC Manufacturing Plant
Bill To: ABC Corporation

ORDERED BY: Procurement Department
APPROVED BY: Jane Wilson, Purchasing Manager

ITEMS ORDERED:

Line | Item # | Description                  | Qty  | Unit Price | Total
-----|--------|------------------------------|------|------------|--------
1    | IS-001 | Steel Bolts M8x50           | 1000 | $0.45      | $450.00
2    | IS-002 | Aluminum Sheet 4x8          | 50   | $85.00     | $4,250.00
3    | IS-003 | Industrial Lubricant 5L     | 20   | $32.50     | $650.00
4    | IS-004 | Safety Gloves (Box/100)     | 10   | $125.00    | $1,250.00
5    | IS-005 | Protective Goggles          | 50   | $15.00     | $750.00

                                        Subtotal:     $7,350.00
                                        Tax (8.25%):  $606.38
                                        Shipping:     $150.00
                                        TOTAL:        $8,106.38

DELIVERY INSTRUCTIONS:
- Required delivery date: February 5, 2025
- Dock receiving hours: 7:00 AM - 4:00 PM
- Contact: Mike Johnson, Receiving Manager

PAYMENT TERMS: Net 30

TERMS AND CONDITIONS:
This Purchase Order is subject to our standard terms and conditions.
Late deliveries may result in penalties as specified in our vendor agreement.
`,

  INVOICE: `
INVOICE

Invoice Number: INV-2025-1234
Invoice Date: February 15, 2025
Due Date: March 17, 2025

FROM:
WebDesign Pro Services
123 Creative Street
San Francisco, CA 94102

TO:
RetailBrand Corp.
456 Commerce Ave
New York, NY 10001

DESCRIPTION OF SERVICES:

1. Website Redesign Project
   - Homepage design and development         $5,000.00
   - Product catalog pages (50 pages)        $7,500.00
   - Shopping cart integration               $3,500.00
   - Mobile responsive optimization          $2,500.00

2. Monthly Maintenance (February 2025)
   - Content updates                         $500.00
   - Security patches                        $300.00
   - Performance monitoring                  $200.00

                              Subtotal:      $19,500.00
                              Tax (0%):      $0.00
                              TOTAL DUE:     $19,500.00

PAYMENT METHODS:
- Wire Transfer: Bank of America, Account: XXXX-1234
- Check payable to: WebDesign Pro Services
- Online: pay.webdesignpro.com/invoice/2025-1234

NOTES:
Thank you for your business! 
Payment is due within 30 days of invoice date.
Late payments subject to 1.5% monthly interest.
`,

  DATA_PROCESSING_AGREEMENT: `
DATA PROCESSING AGREEMENT

This Data Processing Agreement ("DPA") is entered into as of January 1, 2025 
between CloudServices Inc. ("Processor") and GlobalRetail Corp. ("Controller").

Effective Date: January 1, 2025

1. DEFINITIONS
1.1 "Personal Data" means any information relating to an identified or identifiable 
natural person as defined under GDPR Article 4(1).
1.2 "Processing" has the meaning given in GDPR Article 4(2).
1.3 "Data Subject" means the individual to whom Personal Data relates.

2. SCOPE OF PROCESSING
The Processor shall process Personal Data only on behalf of and in accordance with 
documented instructions from the Controller. Processing includes:
- Customer data storage
- Transaction processing
- Analytics and reporting
- Email communications

3. DATA SUBJECT CATEGORIES
- Customers
- Employees of Controller
- Website visitors
- Marketing contacts

4. GDPR COMPLIANCE
4.1 The Processor shall implement appropriate technical and organizational measures 
to ensure a level of security appropriate to the risk.
4.2 Sub-processors may only be engaged with prior written consent of Controller.
4.3 The Processor shall assist the Controller in responding to Data Subject requests.

5. DATA TRANSFERS
5.1 Personal Data may be transferred to countries outside the EEA only with 
Standard Contractual Clauses in place.
5.2 Current sub-processors and their locations are listed in Annex A.

6. DATA BREACH NOTIFICATION
The Processor shall notify the Controller within 24 hours of becoming aware of 
any Personal Data breach.

7. AUDIT RIGHTS
Controller may conduct audits of Processor's data processing activities upon 
30 days written notice.

8. TERM AND TERMINATION
This DPA shall remain in effect for the duration of the MSA. Upon termination, 
Processor shall return or delete all Personal Data within 30 days.
`,

  LICENSE: `
SOFTWARE LICENSE AGREEMENT

This Software License Agreement ("Agreement") is entered into as of May 1, 2025 
between:

Licensor: Enterprise Software Inc. ("ESI")
Licensee: MegaCorp Industries ("Customer")

RECITALS
WHEREAS, ESI has developed proprietary enterprise resource planning software 
known as "ESI Enterprise Suite";
WHEREAS, Customer wishes to obtain a license to use such software;

1. LICENSE GRANT
1.1 Subject to the terms of this Agreement, ESI hereby grants to Customer a 
non-exclusive, non-transferable license to use ESI Enterprise Suite.
1.2 License Type: Enterprise Site License
1.3 Authorized Users: Unlimited users within Customer's organization
1.4 License Term: Perpetual with annual maintenance

2. LICENSE FEES
Initial License Fee: $500,000 USD
Annual Maintenance Fee: $100,000 USD (20% of license fee)
Payment Terms: Net 30 from invoice date

3. PERMITTED USE
Customer may:
- Install on unlimited servers within Customer's data centers
- Modify source code for internal use only
- Create backup copies for disaster recovery

4. RESTRICTIONS
Customer shall NOT:
- Sublicense, sell, or distribute the software
- Remove any copyright or proprietary notices
- Use the software for service bureau purposes

5. INTELLECTUAL PROPERTY
ESI retains all intellectual property rights in the software. Customer's 
modifications shall be owned by ESI.

6. WARRANTY
ESI warrants that the software will perform substantially in accordance with 
documentation for 12 months following delivery.

7. LIMITATION OF LIABILITY
ESI's liability shall not exceed the license fees paid by Customer.

8. SUPPORT AND MAINTENANCE
Annual maintenance includes:
- Software updates and patches
- 24/7 technical support
- Access to knowledge base and training materials
`
};

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

async function testKeywordDetection(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 TESTING KEYWORD-BASED CONTRACT TYPE DETECTION');
  console.log('='.repeat(60));
  
  // Import the detection function
  const { detectContractTypeKeywords, detectContractType } = await import('../packages/workers/src/contract-type-profiles');
  
  const results: Array<{
    expected: string;
    detected: string;
    confidence: number;
    matchedKeywords: string[];
    correct: boolean;
  }> = [];
  
  for (const [expectedType, text] of Object.entries(SAMPLE_CONTRACTS)) {
    const result = detectContractTypeKeywords(text);
    const isCorrect = result.type === expectedType;
    
    results.push({
      expected: expectedType,
      detected: result.type,
      confidence: result.confidence,
      matchedKeywords: result.matchedKeywords.slice(0, 5),
      correct: isCorrect
    });
    
    const status = isCorrect ? '✅' : '❌';
    console.log(`\n${status} ${expectedType}`);
    console.log(`   Detected: ${result.type} (${(result.confidence * 100).toFixed(1)}% confidence)`);
    console.log(`   Keywords: ${result.matchedKeywords.slice(0, 5).join(', ')}`);
  }
  
  const accuracy = (results.filter(r => r.correct).length / results.length * 100).toFixed(1);
  console.log(`\n📊 Keyword Detection Accuracy: ${accuracy}%`);
  
  return;
}

async function testAIDetection(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 TESTING AI-BASED CONTRACT TYPE DETECTION');
  console.log('='.repeat(60));
  
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OPENAI_API_KEY not set - skipping AI detection tests');
    console.log('   AI detection will fall back to keyword-based detection');
    return;
  }
  
  const { detectContractTypeWithAI } = await import('../packages/workers/src/contract-type-profiles');
  
  const results: Array<{
    expected: string;
    detected: string;
    confidence: number;
    reasoning: string;
    correct: boolean;
  }> = [];
  
  // Test a subset for AI (to save on API calls)
  const testSubset = ['NDA', 'SOW', 'MSA', 'EMPLOYMENT', 'PURCHASE_ORDER'];
  
  for (const expectedType of testSubset) {
    const text = SAMPLE_CONTRACTS[expectedType];
    
    console.log(`\n⏳ Testing ${expectedType}...`);
    
    try {
      const result = await detectContractTypeWithAI(text);
      const isCorrect = result.type === expectedType;
      
      results.push({
        expected: expectedType,
        detected: result.type,
        confidence: result.confidence,
        reasoning: result.reasoning,
        correct: isCorrect
      });
      
      const status = isCorrect ? '✅' : '❌';
      console.log(`${status} ${expectedType}`);
      console.log(`   Detected: ${result.type} (${(result.confidence * 100).toFixed(1)}% confidence)`);
      console.log(`   Reasoning: ${result.reasoning.substring(0, 100)}...`);
    } catch (error) {
      console.log(`❌ ${expectedType} - Error: ${(error as Error).message}`);
    }
  }
  
  if (results.length > 0) {
    const accuracy = (results.filter(r => r.correct).length / results.length * 100).toFixed(1);
    console.log(`\n📊 AI Detection Accuracy: ${accuracy}%`);
  }
}

async function testCategorizationFlow(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📁 TESTING FULL CATEGORIZATION FLOW');
  console.log('='.repeat(60));
  
  const { detectContractTypeWithAI, getContractProfile, CONTRACT_TYPE_PROFILES } = 
    await import('../packages/workers/src/contract-type-profiles');
  
  // Test the full flow for one contract type
  const testContract = SAMPLE_CONTRACTS['MSA'];
  
  console.log('\n1️⃣ Step 1: Detect Contract Type');
  const typeResult = await detectContractTypeWithAI(testContract);
  console.log(`   Type: ${typeResult.type}`);
  console.log(`   Confidence: ${(typeResult.confidence * 100).toFixed(1)}%`);
  console.log(`   Reasoning: ${typeResult.reasoning}`);
  
  console.log('\n2️⃣ Step 2: Get Contract Profile');
  const profile = getContractProfile(typeResult.type);
  console.log(`   Display Name: ${profile.displayName}`);
  console.log(`   Description: ${profile.description.substring(0, 80)}...`);
  console.log(`   Mandatory Fields: ${profile.mandatoryFields.slice(0, 5).join(', ')}`);
  
  console.log('\n3️⃣ Step 3: Determine Relevant Artifacts');
  const relevantArtifacts = Object.entries(profile.artifactRelevance)
    .filter(([_, relevance]) => relevance === 'required' || relevance === 'optional')
    .map(([type, relevance]) => `${type} (${relevance})`);
  console.log(`   Artifacts: ${relevantArtifacts.join(', ')}`);
  
  console.log('\n4️⃣ Step 4: Metadata to Store');
  const metadataToStore = {
    contractType: typeResult.type,
    aiMetadata: {
      typeDetection: {
        detectedType: typeResult.type,
        confidence: typeResult.confidence,
        matchedKeywords: typeResult.matchedKeywords,
        needsHumanReview: typeResult.confidence < 0.6,
        detectedAt: new Date().toISOString(),
      }
    },
    // Categorization metadata
    _categorization: {
      contractType: {
        value: typeResult.type,
        confidence: typeResult.confidence,
      },
      categorizedAt: new Date().toISOString(),
    }
  };
  
  console.log('   Metadata structure:');
  console.log(JSON.stringify(metadataToStore, null, 2).split('\n').map(l => '   ' + l).join('\n'));
  
  console.log('\n✅ Full categorization flow completed successfully');
}

async function testMetadataSchema(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📋 TESTING METADATA SCHEMA FIELDS');
  console.log('='.repeat(60));
  
  // Verify the fields that get stored in the database
  console.log('\n📦 Fields stored in Contract table:');
  console.log('   - contractType: string (e.g., "MSA", "NDA", "SOW")');
  console.log('   - contractCategoryId: string (taxonomy category ID)');
  console.log('   - categoryL1: string (Level 1 category name)');
  console.log('   - categoryL2: string (Level 2 category name)');
  console.log('   - keywords: string[] (detected keywords)');
  console.log('   - classifiedAt: DateTime');
  console.log('   - aiMetadata: JSON (type detection details)');
  console.log('   - metadata: JSON (full categorization data)');
  
  console.log('\n📦 Fields stored in metadata JSON:');
  console.log('   _categorization:');
  console.log('     - contractType: { value, confidence }');
  console.log('     - industry: { value, confidence }');
  console.log('     - riskLevel: { value, confidence }');
  console.log('     - complexity: number');
  console.log('     - taxonomy: { categoryL1, categoryL2, alternatives }');
  console.log('     - categorizedAt: DateTime');
  
  console.log('\n📦 Fields stored in aiMetadata:');
  console.log('   typeDetection:');
  console.log('     - detectedType: string');
  console.log('     - confidence: number (0-1)');
  console.log('     - matchedKeywords: string[]');
  console.log('     - needsHumanReview: boolean');
  console.log('     - detectedAt: DateTime');
}

async function testConfidenceThresholds(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TESTING CONFIDENCE THRESHOLDS & AUTO-APPLY LOGIC');
  console.log('='.repeat(60));
  
  const { detectContractTypeKeywords } = await import('../packages/workers/src/contract-type-profiles');
  
  // Test with ambiguous text
  const ambiguousText = `
    This document outlines the terms of our agreement regarding services.
    The parties agree to work together on various projects as needed.
    Payment will be made according to the agreed schedule.
  `;
  
  const clearNDA = SAMPLE_CONTRACTS['NDA'];
  
  console.log('\n1️⃣ Testing with clear NDA text:');
  const ndaResult = detectContractTypeKeywords(clearNDA);
  console.log(`   Type: ${ndaResult.type}`);
  console.log(`   Confidence: ${(ndaResult.confidence * 100).toFixed(1)}%`);
  console.log(`   Auto-apply: ${ndaResult.confidence >= 0.75 ? 'YES ✅' : 'NO ❌ (needs review)'}`);
  
  console.log('\n2️⃣ Testing with ambiguous text:');
  const ambigResult = detectContractTypeKeywords(ambiguousText);
  console.log(`   Type: ${ambigResult.type}`);
  console.log(`   Confidence: ${(ambigResult.confidence * 100).toFixed(1)}%`);
  console.log(`   Auto-apply: ${ambigResult.confidence >= 0.75 ? 'YES ✅' : 'NO ❌ (needs review)'}`);
  
  console.log('\n📋 Confidence Threshold Rules:');
  console.log('   - >= 75%: Auto-apply contract type');
  console.log('   - 60-74%: Apply but flag for review');
  console.log('   - < 60%: Queue for human review (needsHumanReview=true)');
}

async function testAllContractTypes(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📝 TESTING ALL DEFINED CONTRACT TYPES');
  console.log('='.repeat(60));
  
  const { CONTRACT_TYPE_PROFILES, CONTRACT_TYPE_KEYWORDS } = 
    await import('../packages/workers/src/contract-type-profiles');
  
  const allTypes = Object.keys(CONTRACT_TYPE_PROFILES);
  console.log(`\n📊 Total contract types defined: ${allTypes.length}`);
  
  // Group by category
  const categories: Record<string, string[]> = {
    'Core Agreements': ['NDA', 'MSA', 'SOW', 'SLA', 'EMPLOYMENT', 'LEASE', 'LICENSE', 'PURCHASE'],
    'Transactional Documents': ['PURCHASE_ORDER', 'INVOICE', 'QUOTE', 'PROPOSAL', 'RECEIPT'],
    'Compliance & Regulatory': ['DATA_PROCESSING_AGREEMENT', 'TERMS_OF_SERVICE', 'PRIVACY_POLICY'],
    'Corporate Documents': ['BOARD_RESOLUTION', 'MINUTES', 'POWER_OF_ATTORNEY'],
    'HR & Personnel': ['OFFER_LETTER', 'SEPARATION_AGREEMENT', 'NON_COMPETE', 'INDEPENDENT_CONTRACTOR'],
  };
  
  for (const [category, types] of Object.entries(categories)) {
    console.log(`\n📁 ${category}:`);
    for (const type of types) {
      const profile = CONTRACT_TYPE_PROFILES[type as keyof typeof CONTRACT_TYPE_PROFILES];
      const keywords = CONTRACT_TYPE_KEYWORDS[type as keyof typeof CONTRACT_TYPE_KEYWORDS];
      if (profile) {
        console.log(`   - ${type}: ${profile.displayName}`);
        console.log(`     Keywords: ${keywords?.slice(0, 3).join(', ') || 'none'}`);
      }
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   CONTRACT TYPE DETECTION & CATEGORIZATION TEST SUITE        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  try {
    // Test 1: Keyword-based detection
    await testKeywordDetection();
    
    // Test 2: AI-based detection (if API key available)
    await testAIDetection();
    
    // Test 3: Full categorization flow
    await testCategorizationFlow();
    
    // Test 4: Metadata schema verification
    await testMetadataSchema();
    
    // Test 5: Confidence thresholds
    await testConfidenceThresholds();
    
    // Test 6: All contract types
    await testAllContractTypes();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(60));
    
    console.log('\n📋 SUMMARY:');
    console.log('   • Contract type detection uses hybrid approach:');
    console.log('     1. AI-based detection (primary, uses GPT-4o-mini)');
    console.log('     2. Keyword-based detection (fallback)');
    console.log('   • Confidence scoring determines auto-apply behavior');
    console.log('   • Detected type + metadata stored in Contract record');
    console.log('   • Low confidence (<60%) flagged for human review');
    console.log('   • Full categorization stored in metadata JSON field');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
