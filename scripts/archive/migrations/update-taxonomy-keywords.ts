/**
 * Update Taxonomy Keywords for Better Auto-Categorization
 * 
 * This script adds keywords to existing taxonomy categories to improve
 * AI-based contract categorization accuracy.
 * 
 * Usage: source .env && npx tsx scripts/update-taxonomy-keywords.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Keywords map: category name -> keywords array
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // L1 Categories
  "Information Technology": [
    "technology", "IT", "software", "hardware", "cloud", "saas", "infrastructure",
    "network", "cybersecurity", "data center", "computing", "digital", "api", "platform"
  ],
  "Human Resources": [
    "HR", "human resources", "recruitment", "staffing", "employee", "hiring",
    "benefits", "compensation", "training", "workforce", "talent", "onboarding"
  ],
  "Legal & Compliance": [
    "legal", "compliance", "regulatory", "law", "attorney", "counsel", "litigation",
    "contract", "governance", "audit", "policy", "nda", "confidentiality"
  ],
  "Finance & Accounting": [
    "finance", "accounting", "financial", "audit", "tax", "treasury", "banking",
    "budgeting", "reporting", "payment", "invoice", "accounts payable"
  ],
  "Procurement": [
    "procurement", "purchasing", "vendor", "supplier", "sourcing", "supply chain",
    "rfp", "rfq", "msa", "contract management", "spend", "category management"
  ],
  "Marketing & Communications": [
    "marketing", "advertising", "communications", "branding", "PR", "public relations",
    "media", "creative", "content", "digital marketing", "social media", "events"
  ],
  "Operations": [
    "operations", "operational", "manufacturing", "logistics", "supply chain",
    "production", "warehouse", "distribution", "quality", "process"
  ],
  "Sales & Revenue": [
    "sales", "revenue", "customer", "client", "commercial", "business development",
    "account management", "partnerships", "deals", "pricing"
  ],
  "Research & Development": [
    "R&D", "research", "development", "innovation", "engineering", "product",
    "clinical trials", "laboratory", "testing", "prototype"
  ],
  "Real Estate & Facilities": [
    "real estate", "facilities", "property", "lease", "office", "building",
    "construction", "maintenance", "janitorial", "HVAC", "space planning"
  ],
  "Corporate Development": [
    "corporate development", "M&A", "mergers", "acquisitions", "investment",
    "joint venture", "partnership", "strategic", "divestiture"
  ],
  "Risk Management": [
    "risk", "risk management", "insurance", "liability", "compliance",
    "audit", "internal controls", "business continuity", "disaster recovery"
  ],
  "Professional Services": [
    "professional services", "consulting", "advisory", "consulting services",
    "management consulting", "staffing", "augmentation", "outsourcing"
  ],

  // L2 Categories - Information Technology
  "Software & Applications": [
    "software", "application", "SaaS", "license", "subscription", "ERP", "CRM",
    "Microsoft", "Oracle", "SAP", "Salesforce", "productivity", "enterprise"
  ],
  "Cloud & Infrastructure": [
    "cloud", "AWS", "Azure", "GCP", "hosting", "IaaS", "PaaS", "infrastructure",
    "data center", "server", "virtual", "container", "kubernetes"
  ],
  "Cybersecurity": [
    "cybersecurity", "security", "infosec", "SIEM", "firewall", "antivirus",
    "identity", "access management", "penetration testing", "SOC"
  ],
  "Data & Analytics": [
    "data", "analytics", "BI", "business intelligence", "reporting", "dashboard",
    "data warehouse", "big data", "machine learning", "AI"
  ],
  "Telecommunications": [
    "telecom", "telecommunications", "phone", "VoIP", "internet", "WAN",
    "connectivity", "mobile", "wireless", "carrier", "network"
  ],

  // L2 Categories - Human Resources
  "Recruitment & Staffing": [
    "recruitment", "staffing", "hiring", "talent acquisition", "headhunter",
    "job placement", "temporary", "contract labor", "workforce"
  ],
  "Training & Development": [
    "training", "development", "learning", "education", "e-learning",
    "professional development", "certification", "workshop", "coaching"
  ],
  "Benefits Administration": [
    "benefits", "health insurance", "401k", "retirement", "wellness",
    "employee benefits", "perks", "compensation"
  ],
  "Payroll Services": [
    "payroll", "salary", "wages", "compensation", "pay", "timekeeping",
    "paycheck", "deductions", "W2"
  ],
  "HRIS Systems": [
    "HRIS", "HCM", "Workday", "ADP", "human capital", "HR system",
    "employee management", "workforce management"
  ],

  // L2 Categories - Legal & Compliance
  "Outside Counsel": [
    "law firm", "outside counsel", "attorney", "lawyer", "litigation",
    "legal services", "legal representation", "legal advice"
  ],
  "Compliance Services": [
    "compliance", "regulatory", "audit", "GDPR", "HIPAA", "SOX",
    "regulatory compliance", "risk assessment", "policy"
  ],
  "IP & Patents": [
    "intellectual property", "IP", "patent", "trademark", "copyright",
    "licensing", "royalty", "invention"
  ],

  // L2 Categories - Finance & Accounting
  "Audit Services": [
    "audit", "auditing", "internal audit", "external audit", "financial audit",
    "compliance audit", "SOX", "attestation"
  ],
  "Tax Services": [
    "tax", "taxation", "tax planning", "tax compliance", "tax advisory",
    "transfer pricing", "tax return", "IRS"
  ],
  "Banking & Treasury": [
    "banking", "treasury", "cash management", "bank", "credit",
    "lending", "financing", "foreign exchange"
  ],

  // L2 Categories - Procurement
  "Strategic Vendors": [
    "strategic vendor", "key supplier", "MSA", "master agreement",
    "strategic partnership", "preferred vendor", "enterprise vendor"
  ],
  "Commodity Vendors": [
    "commodity", "office supplies", "MRO", "indirect materials",
    "transactional", "catalog", "spot buy"
  ],
  "Prof. Service Vendors": [
    "professional services vendor", "consulting vendor", "advisory vendor",
    "contractor", "service provider"
  ],

  // L2 Categories - Professional Services
  "Consulting": [
    "consulting", "consultant", "advisory", "management consulting",
    "strategy consulting", "business consulting", "implementation"
  ],
  "Advisory": [
    "advisory", "advisor", "financial advisory", "strategic advisory",
    "expert", "specialist"
  ],
  "Staffing & Augmentation": [
    "staffing", "staff augmentation", "contract staffing", "temporary staffing",
    "contingent workforce", "contractors", "body shop"
  ],
  "Outsourced Services": [
    "outsourcing", "BPO", "business process outsourcing", "managed services",
    "offshore", "nearshore"
  ],
  "Technical Services": [
    "technical services", "engineering services", "technical support",
    "implementation services", "integration services"
  ],

  // L2 Categories - Real Estate & Facilities
  "Office Leases": [
    "office lease", "commercial lease", "rental", "rent", "tenant",
    "landlord", "property lease", "workspace"
  ],
  "Construction": [
    "construction", "building", "renovation", "contractor", "general contractor",
    "project management", "development"
  ],
  "Facility Services": [
    "facility", "janitorial", "cleaning", "maintenance", "HVAC",
    "security", "landscaping", "property management"
  ],
};

async function main() {
  console.log("🔧 Updating taxonomy keywords for better categorization accuracy...\n");

  const tenantId = "demo";
  let updated = 0;
  let notFound = 0;

  for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const category = await prisma.taxonomyCategory.findFirst({
      where: { tenantId, name: categoryName },
    });

    if (category) {
      // Merge existing keywords with new ones
      const existingKeywords = category.keywords || [];
      const mergedKeywords = [...new Set([...existingKeywords, ...keywords])];

      await prisma.taxonomyCategory.update({
        where: { id: category.id },
        data: { keywords: mergedKeywords },
      });

      console.log(`✅ ${categoryName}: ${mergedKeywords.length} keywords`);
      updated++;
    } else {
      console.log(`⚠️  ${categoryName}: not found`);
      notFound++;
    }
  }

  console.log(`\n📊 Summary: ${updated} categories updated, ${notFound} not found`);
}

main()
  .then(() => {
    console.log("\n✨ Keywords update complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error updating keywords:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
