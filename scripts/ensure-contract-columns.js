#!/usr/bin/env node

import { createRequire } from "module";

// Reuse the pg dependency that lives under apps/api to avoid installing duplicates
const require = createRequire(
  new URL("../apps/api/package.json", import.meta.url)
);
const { Client } = require("pg");

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/contracts";
  const client = new Client({ connectionString });

  const statements = [
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "uploadedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "rawText" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP WITHOUT TIME ZONE',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP WITHOUT TIME ZONE',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "totalValue" NUMERIC(15, 2)',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "currency" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "clientId" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "supplierId" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "category" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "clientName" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "contractTitle" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "description" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "keywords" JSONB',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "lastViewedAt" TIMESTAMP WITHOUT TIME ZONE',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "lastViewedBy" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "searchableText" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "supplierName" TEXT',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT \'[]\'::jsonb',
    'ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0',
  ];

  try {
    await client.connect();
    for (const sql of statements) {
      console.log(`Executing: ${sql}`);
      await client.query(sql);
    }
    console.log("All statements executed successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
