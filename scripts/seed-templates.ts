import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default contract template content
const defaultTemplates = [
  {
    name: 'Master Service Agreement (MSA)',
    description: 'Standard master service agreement template for ongoing service relationships',
    category: 'Services',
    clauses: [],
    structure: {},
    metadata: {
      status: 'active',
      language: 'en-US',
      content: `# {{contractTitle}}

## MASTER SERVICE AGREEMENT

This Master Service Agreement ("Agreement") is entered into as of {{effectiveDate}} by and between:

**{{clientName}}** ("Client")
Address: {{clientAddress}}

and

**{{supplierName}}** ("Service Provider")
Address: {{supplierAddress}}

## 1. SCOPE OF SERVICES
Service Provider agrees to provide the services described in {{scopeOfWork}}.

## 2. TERM
This Agreement begins on {{startDate}} and continues until {{endDate}}, unless earlier terminated.

## 3. COMPENSATION
Client agrees to pay Service Provider {{totalValue}} {{currency}} for services rendered.
Payment terms: {{paymentTerms}}

## 4. CONFIDENTIALITY
Both parties agree to maintain confidentiality of proprietary information for {{confidentialityYears}} years.

## 5. TERMINATION
Either party may terminate with {{noticeDays}} days written notice.

## 6. GOVERNING LAW
This Agreement shall be governed by the laws of {{jurisdiction}}.

---
**IN WITNESS WHEREOF**, the parties have executed this Agreement as of the date first written above.

**CLIENT:** {{clientName}}
Signature: _______________________  Date: ____________

**SERVICE PROVIDER:** {{supplierName}}
Signature: _______________________  Date: ____________
`,
      variables: [
        { name: 'contractTitle', label: 'Contract Title', type: 'text', required: true },
        { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
        { name: 'clientName', label: 'Client Name', type: 'text', required: true },
        { name: 'clientAddress', label: 'Client Address', type: 'text', required: true },
        { name: 'supplierName', label: 'Service Provider Name', type: 'text', required: true },
        { name: 'supplierAddress', label: 'Service Provider Address', type: 'text', required: true },
        { name: 'scopeOfWork', label: 'Scope of Work', type: 'text', required: true },
        { name: 'startDate', label: 'Start Date', type: 'date', required: true },
        { name: 'endDate', label: 'End Date', type: 'date', required: true },
        { name: 'totalValue', label: 'Total Value', type: 'currency', required: true },
        { name: 'currency', label: 'Currency', type: 'text', required: true, defaultValue: 'USD' },
        { name: 'paymentTerms', label: 'Payment Terms', type: 'text', required: false, defaultValue: 'Net 30' },
        { name: 'confidentialityYears', label: 'Confidentiality Period (Years)', type: 'number', required: false, defaultValue: '2' },
        { name: 'noticeDays', label: 'Notice Days', type: 'number', required: false, defaultValue: '30' },
        { name: 'jurisdiction', label: 'Jurisdiction', type: 'text', required: false, defaultValue: 'State of Delaware' },
      ],
      tags: ['msa', 'services', 'standard'],
    },
    isActive: true,
  },
  {
    name: 'Statement of Work (SOW)',
    description: 'Project-specific statement of work template with deliverables and milestones',
    category: 'Services',
    clauses: [],
    structure: {},
    metadata: {
      status: 'active',
      language: 'en-US',
      content: `# STATEMENT OF WORK

## Project: {{projectName}}
**SOW Number:** {{sowNumber}}
**Effective Date:** {{effectiveDate}}

This Statement of Work is issued pursuant to the Master Service Agreement dated {{msaDate}} between {{clientName}} ("Client") and {{supplierName}} ("Service Provider").

## 1. PROJECT OVERVIEW
{{projectDescription}}

## 2. SCOPE OF WORK
### 2.1 In-Scope Services
{{inScopeServices}}

### 2.2 Out of Scope
{{outOfScopeItems}}

## 3. DELIVERABLES
| Deliverable | Description | Due Date |
|-------------|-------------|----------|
{{deliverablesList}}

## 4. MILESTONES AND TIMELINE
**Project Start Date:** {{startDate}}
**Project End Date:** {{endDate}}
**Total Duration:** {{projectDuration}}

### Key Milestones:
{{milestones}}

## 5. PROJECT TEAM
### Client Team:
- Project Sponsor: {{clientSponsor}}
- Project Manager: {{clientPM}}

### Service Provider Team:
- Project Manager: {{supplierPM}}
- Technical Lead: {{technicalLead}}

## 6. PRICING AND PAYMENT
**Total Project Value:** {{totalValue}} {{currency}}
**Payment Schedule:**
{{paymentSchedule}}

## 7. ASSUMPTIONS AND DEPENDENCIES
{{assumptions}}

## 8. ACCEPTANCE CRITERIA
{{acceptanceCriteria}}

---
**AGREED AND ACCEPTED:**

**Client:** {{clientName}}
Name: _______________________
Title: _______________________
Date: _______________________

**Service Provider:** {{supplierName}}
Name: _______________________
Title: _______________________
Date: _______________________
`,
      variables: [
        { name: 'projectName', label: 'Project Name', type: 'text', required: true },
        { name: 'sowNumber', label: 'SOW Number', type: 'text', required: true },
        { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
        { name: 'msaDate', label: 'MSA Date', type: 'date', required: true },
        { name: 'clientName', label: 'Client Name', type: 'text', required: true },
        { name: 'supplierName', label: 'Service Provider Name', type: 'text', required: true },
        { name: 'projectDescription', label: 'Project Description', type: 'text', required: true },
        { name: 'inScopeServices', label: 'In-Scope Services', type: 'text', required: true },
        { name: 'outOfScopeItems', label: 'Out of Scope Items', type: 'text', required: false },
        { name: 'deliverablesList', label: 'Deliverables List', type: 'text', required: true },
        { name: 'startDate', label: 'Start Date', type: 'date', required: true },
        { name: 'endDate', label: 'End Date', type: 'date', required: true },
        { name: 'projectDuration', label: 'Project Duration', type: 'text', required: false },
        { name: 'milestones', label: 'Milestones', type: 'text', required: true },
        { name: 'clientSponsor', label: 'Client Sponsor', type: 'text', required: false },
        { name: 'clientPM', label: 'Client Project Manager', type: 'text', required: false },
        { name: 'supplierPM', label: 'Supplier Project Manager', type: 'text', required: false },
        { name: 'technicalLead', label: 'Technical Lead', type: 'text', required: false },
        { name: 'totalValue', label: 'Total Value', type: 'currency', required: true },
        { name: 'currency', label: 'Currency', type: 'text', required: true, defaultValue: 'USD' },
        { name: 'paymentSchedule', label: 'Payment Schedule', type: 'text', required: false },
        { name: 'assumptions', label: 'Assumptions', type: 'text', required: false },
        { name: 'acceptanceCriteria', label: 'Acceptance Criteria', type: 'text', required: false },
      ],
      tags: ['sow', 'project', 'deliverables'],
    },
    isActive: true,
  },
  {
    name: 'Non-Disclosure Agreement (NDA)',
    description: 'Mutual non-disclosure agreement for protecting confidential information',
    category: 'Legal',
    clauses: [],
    structure: {},
    metadata: {
      status: 'active',
      language: 'en-US',
      content: `# MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of {{effectiveDate}} by and between:

**{{partyAName}}** ("Party A")
Address: {{partyAAddress}}

and

**{{partyBName}}** ("Party B")
Address: {{partyBAddress}}

(collectively referred to as the "Parties")

## 1. PURPOSE
The Parties wish to explore {{purposeDescription}} and in connection with this Purpose, each Party may disclose certain confidential and proprietary information to the other.

## 2. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any information disclosed by either Party that is marked as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure.

## 3. OBLIGATIONS
Each Party agrees to:
- Hold the other Party's Confidential Information in strict confidence
- Not disclose Confidential Information to any third parties without prior written consent
- Use Confidential Information only for the Purpose described above
- Protect Confidential Information using the same degree of care used to protect its own confidential information (but not less than reasonable care)

## 4. EXCLUSIONS
Confidential Information does not include information that:
- Is or becomes publicly available through no fault of the receiving Party
- Was rightfully known prior to disclosure
- Is independently developed without use of Confidential Information
- Is rightfully obtained from a third party without restriction

## 5. TERM
This Agreement shall remain in effect for {{agreementTermYears}} years from the Effective Date. The confidentiality obligations shall survive for {{confidentialityYears}} years after disclosure of each piece of Confidential Information.

## 6. RETURN OF INFORMATION
Upon termination or written request, each Party shall return or destroy all Confidential Information received from the other Party.

## 7. NO LICENSE
Nothing in this Agreement grants any rights to either Party in the other's Confidential Information except as expressly stated herein.

## 8. GOVERNING LAW
This Agreement shall be governed by the laws of {{jurisdiction}}.

## 9. ENTIRE AGREEMENT
This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof.

---
**IN WITNESS WHEREOF**, the Parties have executed this Agreement as of the date first written above.

**{{partyAName}}**
Signature: _______________________
Name: _______________________
Title: _______________________
Date: _______________________

**{{partyBName}}**
Signature: _______________________
Name: _______________________
Title: _______________________
Date: _______________________
`,
      variables: [
        { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
        { name: 'partyAName', label: 'Party A Name', type: 'text', required: true },
        { name: 'partyAAddress', label: 'Party A Address', type: 'text', required: true },
        { name: 'partyBName', label: 'Party B Name', type: 'text', required: true },
        { name: 'partyBAddress', label: 'Party B Address', type: 'text', required: true },
        { name: 'purposeDescription', label: 'Purpose Description', type: 'text', required: true },
        { name: 'agreementTermYears', label: 'Agreement Term (Years)', type: 'number', required: true, defaultValue: '2' },
        { name: 'confidentialityYears', label: 'Confidentiality Period (Years)', type: 'number', required: true, defaultValue: '5' },
        { name: 'jurisdiction', label: 'Governing Jurisdiction', type: 'text', required: false, defaultValue: 'State of Delaware' },
      ],
      tags: ['nda', 'confidentiality', 'legal'],
    },
    isActive: true,
  },
  {
    name: 'Software License Agreement',
    description: 'Standard SaaS/software licensing agreement template',
    category: 'Technology',
    clauses: [],
    structure: {},
    metadata: {
      status: 'active',
      language: 'en-US',
      content: `# SOFTWARE LICENSE AGREEMENT

This Software License Agreement ("Agreement") is entered into as of {{effectiveDate}} by and between:

**{{licensorName}}** ("Licensor")
Address: {{licensorAddress}}

and

**{{licenseeName}}** ("Licensee")
Address: {{licenseeAddress}}

## 1. GRANT OF LICENSE
Subject to the terms of this Agreement, Licensor grants to Licensee a non-exclusive, non-transferable license to use {{softwareName}} ("Software") in accordance with the terms set forth herein.

### 1.1 License Type: {{licenseType}}
### 1.2 Number of Users: {{numberOfUsers}}
### 1.3 License Scope: {{licenseScope}}

## 2. TERM
This Agreement begins on {{startDate}} and continues until {{endDate}}, unless earlier terminated.

## 3. LICENSE FEES
Licensee agrees to pay the following fees:
- **License Fee:** {{totalValue}} {{currency}} per {{billingCycle}}
- **Payment Terms:** {{paymentTerms}}

## 4. SUPPORT AND MAINTENANCE
{{supportTerms}}

## 5. RESTRICTIONS
Licensee shall NOT:
- Sublicense, sell, or transfer the Software
- Reverse engineer, decompile, or disassemble the Software
- Remove any proprietary notices from the Software
- Use the Software in excess of the licensed capacity

## 6. INTELLECTUAL PROPERTY
All intellectual property rights in the Software remain with Licensor. Licensee receives only the rights expressly granted herein.

## 7. WARRANTY
Licensor warrants that the Software will perform substantially in accordance with its documentation for a period of {{warrantyDays}} days from delivery.

## 8. LIMITATION OF LIABILITY
IN NO EVENT SHALL LICENSOR'S LIABILITY EXCEED THE FEES PAID BY LICENSEE UNDER THIS AGREEMENT DURING THE {{liabilityPeriod}} MONTHS PRECEDING THE CLAIM.

## 9. CONFIDENTIALITY
Both parties agree to maintain confidentiality of all proprietary information for {{confidentialityYears}} years.

## 10. TERMINATION
Either party may terminate this Agreement with {{noticeDays}} days written notice for material breach that remains uncured.

## 11. GOVERNING LAW
This Agreement shall be governed by the laws of {{jurisdiction}}.

---
**IN WITNESS WHEREOF**, the parties have executed this Agreement as of the date first written above.

**{{licensorName}}**
Signature: _______________________
Name: _______________________
Title: _______________________
Date: _______________________

**{{licenseeName}}**
Signature: _______________________
Name: _______________________
Title: _______________________
Date: _______________________
`,
      variables: [
        { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
        { name: 'licensorName', label: 'Licensor Name', type: 'text', required: true },
        { name: 'licensorAddress', label: 'Licensor Address', type: 'text', required: true },
        { name: 'licenseeName', label: 'Licensee Name', type: 'text', required: true },
        { name: 'licenseeAddress', label: 'Licensee Address', type: 'text', required: true },
        { name: 'softwareName', label: 'Software Name', type: 'text', required: true },
        { name: 'licenseType', label: 'License Type', type: 'text', required: true, defaultValue: 'Subscription' },
        { name: 'numberOfUsers', label: 'Number of Users', type: 'number', required: true, defaultValue: '10' },
        { name: 'licenseScope', label: 'License Scope', type: 'text', required: false },
        { name: 'startDate', label: 'Start Date', type: 'date', required: true },
        { name: 'endDate', label: 'End Date', type: 'date', required: true },
        { name: 'totalValue', label: 'License Fee', type: 'currency', required: true },
        { name: 'currency', label: 'Currency', type: 'text', required: true, defaultValue: 'USD' },
        { name: 'billingCycle', label: 'Billing Cycle', type: 'text', required: true, defaultValue: 'year' },
        { name: 'paymentTerms', label: 'Payment Terms', type: 'text', required: false, defaultValue: 'Net 30' },
        { name: 'supportTerms', label: 'Support Terms', type: 'text', required: false },
        { name: 'warrantyDays', label: 'Warranty Period (Days)', type: 'number', required: false, defaultValue: '90' },
        { name: 'liabilityPeriod', label: 'Liability Period (Months)', type: 'number', required: false, defaultValue: '12' },
        { name: 'confidentialityYears', label: 'Confidentiality Period (Years)', type: 'number', required: false, defaultValue: '3' },
        { name: 'noticeDays', label: 'Termination Notice (Days)', type: 'number', required: false, defaultValue: '30' },
        { name: 'jurisdiction', label: 'Governing Jurisdiction', type: 'text', required: false, defaultValue: 'State of Delaware' },
      ],
      tags: ['software', 'license', 'saas', 'technology'],
    },
    isActive: true,
  },
  {
    name: 'Employment Agreement',
    description: 'Standard employment contract template with compensation and benefits',
    category: 'HR',
    clauses: [],
    structure: {},
    metadata: {
      status: 'active',
      language: 'en-US',
      content: `# EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into as of {{effectiveDate}} by and between:

**{{companyName}}** ("Employer")
Address: {{companyAddress}}

and

**{{employeeName}}** ("Employee")
Address: {{employeeAddress}}

## 1. POSITION AND DUTIES
Employer agrees to employ Employee as {{jobTitle}} in the {{department}} department.
Employee shall report to {{reportsTo}} and perform duties as assigned.

## 2. EMPLOYMENT TYPE
- Employment Type: {{employmentType}}
- Work Location: {{workLocation}}
- Start Date: {{startDate}}

## 3. COMPENSATION
### 3.1 Base Salary
Employee shall receive a base salary of {{baseSalary}} {{currency}} per {{payPeriod}}, payable in accordance with Employer's standard payroll practices.

### 3.2 Bonus
{{bonusStructure}}

### 3.3 Equity/Stock Options
{{equityDetails}}

## 4. BENEFITS
Employee shall be entitled to participate in Employer's benefit programs, including:
- Health Insurance: {{healthBenefits}}
- Paid Time Off: {{ptoPolicy}}
- Retirement Plan: {{retirementPlan}}
- Other Benefits: {{otherBenefits}}

## 5. CONFIDENTIALITY
Employee agrees to maintain confidentiality of all proprietary information during and after employment for {{confidentialityYears}} years.

## 6. NON-COMPETE
{{nonCompeteClause}}

## 7. INTELLECTUAL PROPERTY
All work product created during employment shall be owned by Employer as work for hire.

## 8. TERMINATION
This Agreement may be terminated:
- By either party with {{noticeDays}} days written notice
- By Employer immediately for cause
- Severance (if applicable): {{severanceTerms}}

## 9. AT-WILL EMPLOYMENT
This Agreement does not guarantee employment for any specific duration. {{atWillStatement}}

## 10. GOVERNING LAW
This Agreement shall be governed by the laws of {{jurisdiction}}.

---
**IN WITNESS WHEREOF**, the parties have executed this Agreement as of the date first written above.

**{{companyName}}**
Signature: _______________________
Name: _______________________
Title: _______________________
Date: _______________________

**{{employeeName}}**
Signature: _______________________
Date: _______________________
`,
      variables: [
        { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
        { name: 'companyName', label: 'Company Name', type: 'text', required: true },
        { name: 'companyAddress', label: 'Company Address', type: 'text', required: true },
        { name: 'employeeName', label: 'Employee Name', type: 'text', required: true },
        { name: 'employeeAddress', label: 'Employee Address', type: 'text', required: true },
        { name: 'jobTitle', label: 'Job Title', type: 'text', required: true },
        { name: 'department', label: 'Department', type: 'text', required: true },
        { name: 'reportsTo', label: 'Reports To', type: 'text', required: false },
        { name: 'employmentType', label: 'Employment Type', type: 'text', required: true, defaultValue: 'Full-time' },
        { name: 'workLocation', label: 'Work Location', type: 'text', required: false },
        { name: 'startDate', label: 'Start Date', type: 'date', required: true },
        { name: 'baseSalary', label: 'Base Salary', type: 'currency', required: true },
        { name: 'currency', label: 'Currency', type: 'text', required: true, defaultValue: 'USD' },
        { name: 'payPeriod', label: 'Pay Period', type: 'text', required: true, defaultValue: 'year' },
        { name: 'bonusStructure', label: 'Bonus Structure', type: 'text', required: false },
        { name: 'equityDetails', label: 'Equity Details', type: 'text', required: false },
        { name: 'healthBenefits', label: 'Health Benefits', type: 'text', required: false },
        { name: 'ptoPolicy', label: 'PTO Policy', type: 'text', required: false },
        { name: 'retirementPlan', label: 'Retirement Plan', type: 'text', required: false },
        { name: 'otherBenefits', label: 'Other Benefits', type: 'text', required: false },
        { name: 'confidentialityYears', label: 'Confidentiality Period (Years)', type: 'number', required: false, defaultValue: '2' },
        { name: 'nonCompeteClause', label: 'Non-Compete Clause', type: 'text', required: false },
        { name: 'noticeDays', label: 'Notice Period (Days)', type: 'number', required: false, defaultValue: '14' },
        { name: 'severanceTerms', label: 'Severance Terms', type: 'text', required: false },
        { name: 'atWillStatement', label: 'At-Will Statement', type: 'text', required: false },
        { name: 'jurisdiction', label: 'Governing Jurisdiction', type: 'text', required: false, defaultValue: 'State of California' },
      ],
      tags: ['employment', 'hr', 'hiring'],
    },
    isActive: true,
  },
];

async function main() {
  console.log('🌱 Seeding contract templates...\n');

  // Get or create demo tenant (used in development)
  let tenant = await prisma.tenant.findFirst({
    where: { id: 'demo' }
  });
  
  if (!tenant) {
    // Try to find any existing tenant
    tenant = await prisma.tenant.findFirst();
  }
  
  if (!tenant) {
    // Create demo tenant if none exists
    console.log('📁 Creating demo tenant...');
    tenant = await prisma.tenant.create({
      data: {
        id: 'demo',
        name: 'Demo Organization',
        slug: 'demo',
        status: 'ACTIVE',
      }
    });
    console.log(`   ✅ Created tenant: ${tenant.name}\n`);
  } else {
    console.log(`📁 Using tenant: ${tenant.name} (${tenant.id})\n`);
  }
  
  // Use 'demo' tenant ID if it exists, otherwise use the found tenant
  const tenantId = tenant.id === 'demo' ? 'demo' : tenant.id;

  // Check existing templates
  const existingCount = await prisma.contractTemplate.count({
    where: { tenantId },
  });

  if (existingCount > 0) {
    console.log(`ℹ️  Found ${existingCount} existing templates. Skipping seed to avoid duplicates.`);
    console.log('   To re-seed, delete existing templates first.\n');
    return;
  }

  // Create templates
  console.log('📝 Creating templates...');
  
  for (const template of defaultTemplates) {
    const created = await prisma.contractTemplate.create({
      data: {
        tenantId,
        name: template.name,
        description: template.description,
        category: template.category,
        clauses: template.clauses,
        structure: template.structure,
        metadata: template.metadata,
        isActive: template.isActive,
        createdBy: 'system',
      },
    });
    console.log(`   ✅ Created: ${created.name}`);
  }

  console.log(`\n✨ Successfully seeded ${defaultTemplates.length} templates!\n`);

  // Show summary
  const finalCount = await prisma.contractTemplate.count({
    where: { tenantId },
  });
  console.log(`📊 Total templates in database: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
