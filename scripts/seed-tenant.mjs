#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedTenant() {
  try {
    // Check if demo tenant exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { id: "demo" },
    });

    if (existingTenant) {
      console.log("✅ Demo tenant already exists");
      return;
    }

    // Create demo tenant
    const tenant = await prisma.tenant.create({
      data: {
        id: "demo",
        slug: "demo",
        name: "Demo Organization",
        status: "ACTIVE",
      },
    });

    console.log("✅ Created demo tenant:", tenant.id);
  } catch (error) {
    console.error("❌ Error seeding tenant:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTenant();
