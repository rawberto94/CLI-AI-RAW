/**
 * Taxonomy Presets API
 * GET /api/taxonomy/presets - Get available preset taxonomies
 * POST /api/taxonomy/presets/apply - Apply a preset taxonomy
 * 
 * Provides industry-standard category templates:
 * - General Business
 * - IT & Technology
 * - Legal & Compliance
 * - Procurement
 * - HR & Employment
 */

import { NextRequest } from "next/server";
import cors from "@/lib/security/cors";
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, withApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { taxonomyService } from 'data-orchestration/services';
// ============================================================================
// PRESET TAXONOMIES
// ============================================================================

const PRESET_TAXONOMIES = {
  general: {
    id: "general",
    name: "General Business",
    description: "Standard categories for most business contracts",
    categories: [
      {
        name: "Services",
        description: "Service agreements and consulting contracts",
        icon: "briefcase",
        color: "#3B82F6",
        keywords: ["service", "consulting", "advisory", "professional services"],
        aiClassificationPrompt: "Contracts for professional services, consulting, or advisory work",
        children: [
          {
            name: "Consulting",
            keywords: ["consultant", "consulting", "advisory"],
            aiClassificationPrompt: "Consulting and advisory service contracts",
          },
          {
            name: "Managed Services",
            keywords: ["managed service", "outsourcing", "maintenance"],
            aiClassificationPrompt: "Ongoing managed service agreements",
          },
          {
            name: "Professional Services",
            keywords: ["professional", "specialist", "expert"],
            aiClassificationPrompt: "Professional service engagements",
          },
        ],
      },
      {
        name: "Software & Technology",
        description: "Software licenses and technology agreements",
        icon: "lightning",
        color: "#8B5CF6",
        keywords: ["software", "license", "saas", "technology", "platform"],
        aiClassificationPrompt: "Software licensing, SaaS, and technology contracts",
        children: [
          {
            name: "SaaS Subscriptions",
            keywords: ["saas", "subscription", "cloud", "hosted"],
            aiClassificationPrompt: "Cloud-based software subscriptions",
          },
          {
            name: "Software Licenses",
            keywords: ["license", "perpetual", "software license"],
            aiClassificationPrompt: "Traditional software licensing agreements",
          },
        ],
      },
      {
        name: "Purchasing",
        description: "Goods and equipment purchases",
        icon: "document",
        color: "#10B981",
        keywords: ["purchase", "buy", "procurement", "equipment", "goods"],
        aiClassificationPrompt: "Contracts for purchasing goods, equipment, or materials",
      },
      {
        name: "Legal",
        description: "Legal and compliance agreements",
        icon: "shield",
        color: "#EF4444",
        keywords: ["legal", "nda", "confidentiality", "non-disclosure"],
        aiClassificationPrompt: "Legal agreements including NDAs and confidentiality",
        children: [
          {
            name: "NDA",
            keywords: ["nda", "non-disclosure", "confidentiality"],
            aiClassificationPrompt: "Non-disclosure and confidentiality agreements",
          },
          {
            name: "Compliance",
            keywords: ["compliance", "regulatory", "gdpr", "sox"],
            aiClassificationPrompt: "Compliance and regulatory agreements",
          },
        ],
      },
      {
        name: "Real Estate",
        description: "Leases and property agreements",
        icon: "building",
        color: "#F59E0B",
        keywords: ["lease", "rent", "property", "real estate", "office"],
        aiClassificationPrompt: "Real estate leases and property agreements",
      },
    ],
  },
  
  it: {
    id: "it",
    name: "IT & Technology",
    description: "Categories optimized for IT departments",
    categories: [
      {
        name: "Infrastructure",
        description: "Hardware and infrastructure contracts",
        icon: "building",
        color: "#3B82F6",
        keywords: ["hardware", "server", "infrastructure", "data center"],
        aiClassificationPrompt: "IT infrastructure, hardware, and data center contracts",
        children: [
          {
            name: "Hardware",
            keywords: ["hardware", "server", "storage", "networking"],
          },
          {
            name: "Cloud Infrastructure",
            keywords: ["aws", "azure", "gcp", "cloud", "iaas"],
          },
          {
            name: "Hosting",
            keywords: ["hosting", "colocation", "data center"],
          },
        ],
      },
      {
        name: "Software",
        description: "Software and application contracts",
        icon: "lightning",
        color: "#8B5CF6",
        keywords: ["software", "application", "platform"],
        children: [
          {
            name: "Enterprise Applications",
            keywords: ["erp", "crm", "enterprise", "salesforce", "sap"],
          },
          {
            name: "Development Tools",
            keywords: ["development", "ide", "devops", "github", "jira"],
          },
          {
            name: "Security Software",
            keywords: ["security", "antivirus", "firewall", "siem"],
          },
        ],
      },
      {
        name: "Services",
        description: "IT service contracts",
        icon: "briefcase",
        color: "#10B981",
        keywords: ["support", "maintenance", "service"],
        children: [
          {
            name: "Support & Maintenance",
            keywords: ["support", "maintenance", "helpdesk"],
          },
          {
            name: "Implementation",
            keywords: ["implementation", "deployment", "integration"],
          },
          {
            name: "Consulting",
            keywords: ["consulting", "advisory", "architecture"],
          },
        ],
      },
      {
        name: "Telecommunications",
        description: "Network and telecom contracts",
        icon: "globe",
        color: "#06B6D4",
        keywords: ["telecom", "network", "internet", "phone"],
        children: [
          {
            name: "Internet & Network",
            keywords: ["internet", "wan", "mpls", "sd-wan"],
          },
          {
            name: "Voice & Collaboration",
            keywords: ["phone", "voip", "teams", "zoom", "unified communications"],
          },
        ],
      },
    ],
  },
  
  procurement: {
    id: "procurement",
    name: "Procurement",
    description: "Procurement and supply chain categories (UNSPSC-aligned)",
    categories: [
      {
        name: "Professional Services",
        description: "Business and professional services",
        icon: "briefcase",
        color: "#3B82F6",
        keywords: ["consulting", "professional", "advisory"],
        aiClassificationPrompt: "Professional and business services",
        children: [
          {
            name: "Management Consulting",
            keywords: ["management consulting", "strategy", "business advisory"],
          },
          {
            name: "Legal Services",
            keywords: ["legal", "law firm", "attorney"],
          },
          {
            name: "Marketing Services",
            keywords: ["marketing", "advertising", "pr", "communications"],
          },
        ],
      },
      {
        name: "IT & Technology",
        description: "Technology products and services",
        icon: "lightning",
        color: "#8B5CF6",
        keywords: ["software", "hardware", "technology"],
        children: [
          {
            name: "Software",
            keywords: ["software", "license", "saas"],
          },
          {
            name: "Hardware",
            keywords: ["hardware", "computer", "equipment"],
          },
          {
            name: "IT Services",
            keywords: ["it services", "support", "implementation"],
          },
        ],
      },
      {
        name: "Facilities",
        description: "Facilities and property management",
        icon: "building",
        color: "#10B981",
        keywords: ["facilities", "maintenance", "janitorial", "security"],
        children: [
          {
            name: "Building Services",
            keywords: ["janitorial", "cleaning", "maintenance"],
          },
          {
            name: "Security Services",
            keywords: ["security", "guard", "surveillance"],
          },
          {
            name: "Real Estate",
            keywords: ["lease", "property", "real estate"],
          },
        ],
      },
      {
        name: "Staffing",
        description: "Temporary and contract staffing",
        icon: "user",
        color: "#F59E0B",
        keywords: ["staffing", "temporary", "contractor", "temp"],
        aiClassificationPrompt: "Temporary staffing and contractor agreements",
      },
      {
        name: "Logistics",
        description: "Shipping and logistics services",
        icon: "globe",
        color: "#EF4444",
        keywords: ["shipping", "freight", "logistics", "transportation"],
      },
    ],
  },
  
  hr: {
    id: "hr",
    name: "HR & Employment",
    description: "Human resources and employment contracts",
    categories: [
      {
        name: "Employment",
        description: "Employee contracts and agreements",
        icon: "user",
        color: "#3B82F6",
        keywords: ["employment", "employee", "hire"],
        children: [
          {
            name: "Full-Time Employment",
            keywords: ["full-time", "permanent", "employee"],
          },
          {
            name: "Part-Time Employment",
            keywords: ["part-time", "hourly"],
          },
          {
            name: "Executive Employment",
            keywords: ["executive", "c-level", "officer"],
          },
        ],
      },
      {
        name: "Contractors",
        description: "Independent contractor agreements",
        icon: "briefcase",
        color: "#8B5CF6",
        keywords: ["contractor", "freelance", "1099", "independent"],
        aiClassificationPrompt: "Independent contractor and freelancer agreements",
      },
      {
        name: "Benefits",
        description: "Benefits and compensation agreements",
        icon: "star",
        color: "#10B981",
        keywords: ["benefits", "insurance", "401k", "health"],
        children: [
          {
            name: "Health Insurance",
            keywords: ["health", "medical", "dental", "vision"],
          },
          {
            name: "Retirement",
            keywords: ["401k", "pension", "retirement"],
          },
        ],
      },
      {
        name: "Confidentiality",
        description: "Employee confidentiality and IP agreements",
        icon: "lock",
        color: "#EF4444",
        keywords: ["confidentiality", "non-compete", "ip assignment"],
        children: [
          {
            name: "NDA",
            keywords: ["nda", "confidentiality", "non-disclosure"],
          },
          {
            name: "Non-Compete",
            keywords: ["non-compete", "non-solicitation"],
          },
          {
            name: "IP Assignment",
            keywords: ["ip assignment", "invention", "intellectual property"],
          },
        ],
      },
      {
        name: "Training",
        description: "Training and development agreements",
        icon: "document",
        color: "#F59E0B",
        keywords: ["training", "education", "development", "learning"],
      },
    ],
  },

  // ============================================================================
  // SALES & REVENUE CONTRACTS
  // ============================================================================
  sales: {
    id: "sales",
    name: "Sales & Revenue",
    description: "Customer-facing and revenue-generating contracts",
    categories: [
      {
        name: "Customer Agreements",
        description: "Direct customer contracts and subscriptions",
        icon: "users",
        color: "#10B981",
        keywords: ["customer", "client", "subscription", "order", "purchase order"],
        aiClassificationPrompt: "Customer-facing contracts and subscription agreements",
        children: [
          {
            name: "Master Service Agreement (MSA)",
            keywords: ["msa", "master service", "customer msa", "framework"],
            aiClassificationPrompt: "Master service agreements with customers",
          },
          {
            name: "Order Forms",
            keywords: ["order form", "sow", "work order", "statement of work"],
            aiClassificationPrompt: "Order forms and statements of work under MSAs",
          },
          {
            name: "Subscription Agreements",
            keywords: ["subscription", "saas", "recurring", "annual contract"],
            aiClassificationPrompt: "SaaS and subscription-based customer agreements",
          },
          {
            name: "Enterprise License",
            keywords: ["enterprise", "license", "site license", "volume"],
            aiClassificationPrompt: "Enterprise and volume license agreements",
          },
        ],
      },
      {
        name: "Channel & Partners",
        description: "Partner, reseller, and distribution agreements",
        icon: "globe",
        color: "#6366F1",
        keywords: ["partner", "reseller", "distributor", "channel", "referral"],
        aiClassificationPrompt: "Channel partner and distribution agreements",
        children: [
          {
            name: "Reseller Agreements",
            keywords: ["reseller", "var", "value added reseller", "distribution"],
            aiClassificationPrompt: "Reseller and VAR agreements",
          },
          {
            name: "Referral Agreements",
            keywords: ["referral", "affiliate", "commission", "finder"],
            aiClassificationPrompt: "Referral and affiliate partner agreements",
          },
          {
            name: "OEM Agreements",
            keywords: ["oem", "white label", "embedded", "bundling"],
            aiClassificationPrompt: "OEM and white-label licensing agreements",
          },
          {
            name: "Strategic Partnerships",
            keywords: ["strategic", "alliance", "co-marketing", "joint"],
            aiClassificationPrompt: "Strategic alliance and partnership agreements",
          },
        ],
      },
      {
        name: "Licensing Out",
        description: "IP and technology licensing to third parties",
        icon: "key",
        color: "#8B5CF6",
        keywords: ["license out", "royalty", "ip license", "technology transfer"],
        aiClassificationPrompt: "Outbound IP and technology licensing",
        children: [
          {
            name: "Technology License",
            keywords: ["technology", "platform", "api", "sdk"],
            aiClassificationPrompt: "Technology and platform licensing",
          },
          {
            name: "Patent License",
            keywords: ["patent", "royalty", "invention"],
            aiClassificationPrompt: "Patent and invention licensing",
          },
          {
            name: "Brand License",
            keywords: ["brand", "trademark", "logo", "merchandising"],
            aiClassificationPrompt: "Brand and trademark licensing",
          },
        ],
      },
      {
        name: "Government & Public Sector",
        description: "Government and public sector contracts",
        icon: "landmark",
        color: "#0EA5E9",
        keywords: ["government", "federal", "state", "municipal", "public sector"],
        aiClassificationPrompt: "Government and public sector contracts",
        children: [
          {
            name: "Federal Contracts",
            keywords: ["federal", "gsa", "far", "dfar", "government"],
            aiClassificationPrompt: "Federal government contracts and GSA schedules",
          },
          {
            name: "State & Local",
            keywords: ["state", "municipal", "county", "local government"],
            aiClassificationPrompt: "State and local government contracts",
          },
          {
            name: "Education",
            keywords: ["education", "university", "school", "k-12", "higher ed"],
            aiClassificationPrompt: "Educational institution contracts",
          },
        ],
      },
      {
        name: "Proposals & Bids",
        description: "RFP responses and bid documents",
        icon: "file-text",
        color: "#F59E0B",
        keywords: ["rfp", "rfq", "bid", "proposal", "tender"],
        aiClassificationPrompt: "RFP responses and bid documents",
      },
    ],
  },

  // ============================================================================
  // DIRECT PROCUREMENT (MANUFACTURING/SUPPLY CHAIN)
  // ============================================================================
  direct: {
    id: "direct",
    name: "Direct Procurement",
    description: "Raw materials, components, and manufacturing contracts",
    categories: [
      {
        name: "Raw Materials",
        description: "Raw materials and commodities",
        icon: "layers",
        color: "#78716C",
        keywords: ["raw material", "commodity", "feedstock", "chemical", "metal"],
        aiClassificationPrompt: "Raw material and commodity supply contracts",
        children: [
          {
            name: "Metals & Minerals",
            keywords: ["metal", "steel", "aluminum", "copper", "mineral"],
            aiClassificationPrompt: "Metal and mineral supply agreements",
          },
          {
            name: "Chemicals & Polymers",
            keywords: ["chemical", "polymer", "plastic", "resin", "compound"],
            aiClassificationPrompt: "Chemical and polymer supply contracts",
          },
          {
            name: "Agricultural Products",
            keywords: ["agricultural", "grain", "produce", "organic", "food ingredient"],
            aiClassificationPrompt: "Agricultural and food ingredient supply",
          },
          {
            name: "Energy & Fuels",
            keywords: ["energy", "fuel", "gas", "oil", "power"],
            aiClassificationPrompt: "Energy and fuel supply agreements",
          },
        ],
      },
      {
        name: "Components & Parts",
        description: "Manufactured components and assemblies",
        icon: "cpu",
        color: "#3B82F6",
        keywords: ["component", "part", "assembly", "sub-assembly", "oem part"],
        aiClassificationPrompt: "Component and parts supply contracts",
        children: [
          {
            name: "Electronic Components",
            keywords: ["electronic", "semiconductor", "pcb", "chip", "circuit"],
            aiClassificationPrompt: "Electronic component supply agreements",
          },
          {
            name: "Mechanical Parts",
            keywords: ["mechanical", "machined", "casting", "forging", "stamping"],
            aiClassificationPrompt: "Mechanical parts and machining contracts",
          },
          {
            name: "Sub-Assemblies",
            keywords: ["sub-assembly", "module", "kit", "assembly"],
            aiClassificationPrompt: "Sub-assembly and module supply",
          },
        ],
      },
      {
        name: "Contract Manufacturing",
        description: "Outsourced manufacturing and production",
        icon: "factory",
        color: "#EF4444",
        keywords: ["contract manufacturing", "cm", "ems", "toll manufacturing", "co-packer"],
        aiClassificationPrompt: "Contract manufacturing and production agreements",
        children: [
          {
            name: "Electronics Manufacturing (EMS)",
            keywords: ["ems", "electronics manufacturing", "pcba", "box build"],
            aiClassificationPrompt: "Electronics manufacturing services",
          },
          {
            name: "Toll Manufacturing",
            keywords: ["toll", "processing", "formulation", "blending"],
            aiClassificationPrompt: "Toll and custom manufacturing",
          },
          {
            name: "Co-Packing",
            keywords: ["co-pack", "packaging", "labeling", "kitting"],
            aiClassificationPrompt: "Co-packing and packaging services",
          },
        ],
      },
      {
        name: "Packaging Materials",
        description: "Packaging and labeling materials",
        icon: "package",
        color: "#F59E0B",
        keywords: ["packaging", "label", "container", "box", "carton"],
        aiClassificationPrompt: "Packaging material supply contracts",
        children: [
          {
            name: "Primary Packaging",
            keywords: ["bottle", "container", "blister", "pouch"],
            aiClassificationPrompt: "Primary packaging materials",
          },
          {
            name: "Secondary Packaging",
            keywords: ["carton", "box", "case", "shrink wrap"],
            aiClassificationPrompt: "Secondary and tertiary packaging",
          },
          {
            name: "Labels & Printing",
            keywords: ["label", "printing", "barcode", "artwork"],
            aiClassificationPrompt: "Labels and printed materials",
          },
        ],
      },
      {
        name: "Supply Chain Services",
        description: "Supply chain and logistics for direct materials",
        icon: "truck",
        color: "#10B981",
        keywords: ["supply chain", "logistics", "warehouse", "3pl", "fulfillment"],
        aiClassificationPrompt: "Supply chain and logistics services",
        children: [
          {
            name: "Warehousing",
            keywords: ["warehouse", "storage", "inventory", "distribution center"],
            aiClassificationPrompt: "Warehousing and storage agreements",
          },
          {
            name: "Transportation",
            keywords: ["freight", "shipping", "carrier", "trucking"],
            aiClassificationPrompt: "Transportation and freight contracts",
          },
          {
            name: "3PL Services",
            keywords: ["3pl", "fulfillment", "pick pack", "order fulfillment"],
            aiClassificationPrompt: "Third-party logistics services",
          },
        ],
      },
    ],
  },

  // ============================================================================
  // M&A & CORPORATE TRANSACTIONS
  // ============================================================================
  corporate: {
    id: "corporate",
    name: "M&A & Corporate",
    description: "Mergers, acquisitions, and corporate transactions",
    categories: [
      {
        name: "M&A Transactions",
        description: "Merger and acquisition agreements",
        icon: "git-merge",
        color: "#6366F1",
        keywords: ["merger", "acquisition", "m&a", "purchase", "sale"],
        aiClassificationPrompt: "Merger and acquisition transaction documents",
        children: [
          {
            name: "Asset Purchase",
            keywords: ["asset purchase", "apa", "asset sale", "business sale"],
            aiClassificationPrompt: "Asset purchase agreements",
          },
          {
            name: "Stock Purchase",
            keywords: ["stock purchase", "spa", "equity purchase", "share purchase"],
            aiClassificationPrompt: "Stock and equity purchase agreements",
          },
          {
            name: "Merger Agreement",
            keywords: ["merger", "combination", "amalgamation"],
            aiClassificationPrompt: "Merger and combination agreements",
          },
          {
            name: "LOI / Term Sheet",
            keywords: ["loi", "letter of intent", "term sheet", "mou"],
            aiClassificationPrompt: "Letters of intent and term sheets",
          },
        ],
      },
      {
        name: "Due Diligence",
        description: "Due diligence and disclosure documents",
        icon: "search",
        color: "#8B5CF6",
        keywords: ["due diligence", "disclosure", "representations", "warranties"],
        aiClassificationPrompt: "Due diligence and disclosure materials",
        children: [
          {
            name: "Disclosure Schedules",
            keywords: ["disclosure", "schedule", "exhibit", "representation"],
            aiClassificationPrompt: "Disclosure schedules and exhibits",
          },
          {
            name: "Data Room Documents",
            keywords: ["data room", "vdr", "diligence", "document request"],
            aiClassificationPrompt: "Virtual data room documents",
          },
        ],
      },
      {
        name: "Investment & Financing",
        description: "Investment and financing documents",
        icon: "trending-up",
        color: "#10B981",
        keywords: ["investment", "financing", "equity", "debt", "venture"],
        aiClassificationPrompt: "Investment and financing agreements",
        children: [
          {
            name: "Equity Investment",
            keywords: ["equity", "series", "preferred stock", "venture", "private equity"],
            aiClassificationPrompt: "Equity investment and venture agreements",
          },
          {
            name: "Convertible Notes",
            keywords: ["convertible", "safe", "note", "bridge"],
            aiClassificationPrompt: "Convertible notes and SAFE agreements",
          },
          {
            name: "Credit Agreements",
            keywords: ["credit", "loan", "debt", "facility", "revolver"],
            aiClassificationPrompt: "Credit and loan facility agreements",
          },
          {
            name: "Shareholder Agreements",
            keywords: ["shareholder", "stockholder", "voting", "rights"],
            aiClassificationPrompt: "Shareholder and voting agreements",
          },
        ],
      },
      {
        name: "Corporate Governance",
        description: "Governance and board documents",
        icon: "shield",
        color: "#EF4444",
        keywords: ["governance", "board", "bylaws", "charter", "corporate"],
        aiClassificationPrompt: "Corporate governance documents",
        children: [
          {
            name: "Board Resolutions",
            keywords: ["resolution", "board", "consent", "approval"],
            aiClassificationPrompt: "Board resolutions and consents",
          },
          {
            name: "Bylaws & Charter",
            keywords: ["bylaws", "charter", "articles", "incorporation"],
            aiClassificationPrompt: "Corporate bylaws and charter documents",
          },
          {
            name: "D&O Insurance",
            keywords: ["d&o", "directors", "officers", "liability", "indemnification"],
            aiClassificationPrompt: "Directors and officers insurance and indemnification",
          },
        ],
      },
      {
        name: "Joint Ventures",
        description: "Joint venture and partnership structures",
        icon: "users",
        color: "#F59E0B",
        keywords: ["joint venture", "jv", "partnership", "consortium"],
        aiClassificationPrompt: "Joint venture and partnership agreements",
        children: [
          {
            name: "JV Operating Agreement",
            keywords: ["operating", "jv agreement", "joint venture agreement"],
            aiClassificationPrompt: "Joint venture operating agreements",
          },
          {
            name: "Consortium Agreement",
            keywords: ["consortium", "teaming", "collaboration"],
            aiClassificationPrompt: "Consortium and teaming agreements",
          },
        ],
      },
      {
        name: "Restructuring",
        description: "Corporate restructuring and reorganization",
        icon: "refresh-cw",
        color: "#0EA5E9",
        keywords: ["restructuring", "reorganization", "spinoff", "carveout"],
        aiClassificationPrompt: "Corporate restructuring documents",
        children: [
          {
            name: "Spin-Off",
            keywords: ["spinoff", "spin-off", "separation", "distribution"],
            aiClassificationPrompt: "Corporate spin-off and separation agreements",
          },
          {
            name: "Carve-Out",
            keywords: ["carveout", "carve-out", "divestiture"],
            aiClassificationPrompt: "Business carve-out and divestiture",
          },
        ],
      },
    ],
  },
};

// ============================================================================
// GET - List available presets
// ============================================================================

export const GET = withApiHandler(async (_request, ctx) => {
  const presets = Object.values(PRESET_TAXONOMIES).map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    categoryCount: preset.categories.reduce(
      (acc, cat) => acc + 1 + (cat.children?.length || 0),
      0
    ),
  }));

  return createSuccessResponse(ctx, presets);
});

// ============================================================================
// POST - Apply a preset
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const body = await request.json();
  const { presetId, clearExisting = false } = body;

  const preset = PRESET_TAXONOMIES[presetId as keyof typeof PRESET_TAXONOMIES];

  if (!preset) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Preset not found', 404);
  }

  // Optionally clear existing categories
  if (clearExisting) {
    await prisma.taxonomyCategory.deleteMany({
      where: { tenantId },
    });
  }

  // Create categories from preset
  let createdCount = 0;

  for (const category of preset.categories) {
    // Create parent category
    const parent = await prisma.taxonomyCategory.create({
      data: {
        tenantId,
        name: category.name,
        description: category.description,
        icon: category.icon || "folder",
        color: category.color || "#3B82F6",
        level: 0,
        path: `/${category.name}`,
        sortOrder: createdCount,
        keywords: category.keywords || [],
        aiClassificationPrompt: category.aiClassificationPrompt,
        isActive: true,
      },
    });
    createdCount++;

    // Create children
    if (category.children) {
      for (let i = 0; i < category.children.length; i++) {
        const child = category.children[i];
        if (!child) continue;
        await prisma.taxonomyCategory.create({
          data: {
            tenantId,
            name: child.name,
            description: 'description' in child ? String(child.description) : null,
            icon: category.icon || "folder",
            color: category.color || "#3B82F6",
            level: 1,
            path: `/${category.name}/${child.name}`,
            parentId: parent.id,
            sortOrder: i,
            keywords: child.keywords || [],
            aiClassificationPrompt: 'aiClassificationPrompt' in child ? String(child.aiClassificationPrompt) : null,
            isActive: true,
          },
        });
        createdCount++;
      }
    }
  }

  return createSuccessResponse(ctx, {
    success: true,
    message: `Applied "${preset.name}" preset with ${createdCount} categories`,
    categoriesCreated: createdCount,
  });
});

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export const OPTIONS = withAuthApiHandler(async (request: NextRequest, ctx) => {
  return cors.optionsResponse(request, "GET, POST, OPTIONS");
});
