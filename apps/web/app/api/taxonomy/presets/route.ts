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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from "@/lib/tenant-server";

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
};

// ============================================================================
// GET - List available presets
// ============================================================================

export async function GET(): Promise<NextResponse> {
  const presets = Object.values(PRESET_TAXONOMIES).map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    categoryCount: preset.categories.reduce(
      (acc, cat) => acc + 1 + (cat.children?.length || 0),
      0
    ),
  }));

  return NextResponse.json({
    success: true,
    data: presets,
  });
}

// ============================================================================
// POST - Apply a preset
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = await getApiTenantId(request);
    const body = await request.json();
    const { presetId, clearExisting = false } = body;

    const preset = PRESET_TAXONOMIES[presetId as keyof typeof PRESET_TAXONOMIES];

    if (!preset) {
      return NextResponse.json(
        { success: false, error: "Preset not found" },
        { status: 404 }
      );
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

    console.log(`✅ Applied preset "${preset.name}" with ${createdCount} categories`);

    return NextResponse.json({
      success: true,
      message: `Applied "${preset.name}" preset with ${createdCount} categories`,
      categoriesCreated: createdCount,
    });
  } catch (error) {
    console.error("Error applying preset:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to apply preset",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
    },
  });
}
