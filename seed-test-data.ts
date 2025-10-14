#!/usr/bin/env ts-node
/**
 * Seed test data for Contract Intelligence Platform
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/contract_intelligence?schema=public",
    },
  },
});

async function main() {
  console.log("🌱 Seeding test data...");

  // Create demo tenant if it doesn't exist
  let tenant = await prisma.tenant.findUnique({
    where: { slug: "demo" },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Demo Tenant",
        slug: "demo",
        status: "ACTIVE",
      },
    });
    console.log("✅ Created demo tenant");
  } else {
    console.log("✅ Demo tenant exists");
  }

  // Check if contracts exist
  const existingCount = await prisma.contract.count({
    where: { tenantId: tenant.id },
  });

  if (existingCount > 0) {
    console.log(`✅ Found ${existingCount} existing contracts`);
    return;
  }

  // Create sample contracts
  const contracts = [
    {
      tenantId: tenant.id,
      fileName: "software-license-agreement.pdf",
      originalName: "Software License Agreement - ACME Corp.pdf",
      fileSize: BigInt(245678),
      mimeType: "application/pdf",
      contractTitle: "Software License Agreement",
      description:
        "Enterprise software licensing agreement with ACME Corporation",
      category: "Software",
      contractType: "LICENSE",
      status: "COMPLETED" as const,
      clientName: "ACME Corporation",
      supplierName: "TechVendor Inc.",
      totalValue: 150000.0,
      currency: "USD",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2025-12-31"),
      jurisdiction: "California, USA",
      uploadedBy: "admin@demo.com",
      processedAt: new Date(),
      viewCount: 12,
      tags: ["software", "license", "enterprise"],
      searchableText: "software license agreement enterprise saas subscription",
    },
    {
      tenantId: tenant.id,
      fileName: "consulting-services-agreement.pdf",
      originalName: "Consulting Services Agreement - Q1 2024.pdf",
      fileSize: BigInt(189234),
      mimeType: "application/pdf",
      contractTitle: "Consulting Services Agreement",
      description:
        "Professional consulting services for digital transformation project",
      category: "Services",
      contractType: "CONSULTING",
      status: "COMPLETED" as const,
      clientName: "Digital Solutions Ltd",
      supplierName: "Consulting Experts LLC",
      totalValue: 85000.0,
      currency: "USD",
      startDate: new Date("2024-03-01"),
      endDate: new Date("2024-09-30"),
      jurisdiction: "New York, USA",
      uploadedBy: "manager@demo.com",
      processedAt: new Date(),
      viewCount: 8,
      tags: ["consulting", "services", "transformation"],
      searchableText: "consulting services professional digital transformation",
    },
    {
      tenantId: tenant.id,
      fileName: "nda-confidentiality-agreement.pdf",
      originalName: "Non-Disclosure Agreement - Partner Corp.pdf",
      fileSize: BigInt(123456),
      mimeType: "application/pdf",
      contractTitle: "Non-Disclosure Agreement",
      description:
        "Mutual NDA for partnership discussions and confidential information exchange",
      category: "Legal",
      contractType: "NDA",
      status: "COMPLETED" as const,
      clientName: "Innovation Partners Inc",
      supplierName: "Tech Startup Co",
      totalValue: null,
      currency: null,
      startDate: new Date("2024-06-15"),
      endDate: new Date("2026-06-14"),
      jurisdiction: "Delaware, USA",
      uploadedBy: "legal@demo.com",
      processedAt: new Date(),
      viewCount: 5,
      tags: ["nda", "confidentiality", "legal"],
      searchableText: "non disclosure agreement nda confidentiality mutual",
    },
    {
      tenantId: tenant.id,
      fileName: "master-service-agreement.pdf",
      originalName: "Master Service Agreement - Cloud Services.pdf",
      fileSize: BigInt(312890),
      mimeType: "application/pdf",
      contractTitle: "Master Service Agreement",
      description: "Cloud infrastructure and hosting services agreement",
      category: "Technology",
      contractType: "MSA",
      status: "COMPLETED" as const,
      clientName: "Enterprise Solutions Corp",
      supplierName: "Cloud Provider Inc",
      totalValue: 500000.0,
      currency: "USD",
      startDate: new Date("2024-01-15"),
      endDate: new Date("2027-01-14"),
      jurisdiction: "Washington, USA",
      uploadedBy: "procurement@demo.com",
      processedAt: new Date(),
      viewCount: 25,
      tags: ["msa", "cloud", "infrastructure"],
      searchableText: "master service agreement cloud infrastructure hosting",
    },
    {
      tenantId: tenant.id,
      fileName: "procurement-contract.pdf",
      originalName: "Procurement Contract - Office Equipment.pdf",
      fileSize: BigInt(198765),
      mimeType: "application/pdf",
      contractTitle: "Office Equipment Procurement",
      description: "Bulk purchase agreement for office furniture and equipment",
      category: "Procurement",
      contractType: "PURCHASE",
      status: "PROCESSING" as const,
      clientName: "Office Supplies Inc",
      supplierName: "Equipment Manufacturer Ltd",
      totalValue: 45000.0,
      currency: "USD",
      startDate: new Date("2024-08-01"),
      endDate: new Date("2024-12-31"),
      jurisdiction: "Texas, USA",
      uploadedBy: "ops@demo.com",
      processedAt: null,
      viewCount: 3,
      tags: ["procurement", "equipment", "office"],
      searchableText: "procurement contract office equipment furniture",
    },
  ];

  for (const contractData of contracts) {
    const contract = await prisma.contract.create({
      data: contractData,
    });
    console.log(`✅ Created contract: ${contract.contractTitle}`);
  }

  console.log("");
  console.log("🎉 Test data seeded successfully!");
  console.log(`📊 Total contracts: ${contracts.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
