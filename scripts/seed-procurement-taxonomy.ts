/**
 * Seed Procurement Taxonomy
 * 
 * Populates the ProcurementCategory table with standard indirect procurement categories
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategoryData {
  categoryL1: string;
  categoryL2: string;
  description?: string;
  keywords?: string[];
}

// Standard indirect procurement taxonomy
const INDIRECT_CATEGORIES: CategoryData[] = [
  // Business Costs
  { categoryL1: 'Business costs', categoryL2: 'Business costs', description: 'General business operating costs' },
  
  // Corporate Insurance
  { categoryL1: 'Corporate Insurance', categoryL2: 'Insurances', description: 'Corporate insurance policies and coverage', keywords: ['insurance', 'policy', 'coverage', 'liability'] },
  
  // Employee Expenses
  { categoryL1: 'Employee expenses', categoryL2: 'Employee Education', description: 'Training, courses, certifications', keywords: ['training', 'course', 'education', 'certification', 'learning'] },
  { categoryL1: 'Employee expenses', categoryL2: 'Employee Events', description: 'Team events, offsites, celebrations', keywords: ['event', 'team building', 'offsite', 'party'] },
  { categoryL1: 'Employee expenses', categoryL2: 'Employee expenses', description: 'General employee expenses and reimbursements' },
  { categoryL1: 'Employee expenses', categoryL2: 'Employees Benefits', description: 'Benefits, perks, wellness programs', keywords: ['benefit', 'wellness', 'gym', 'health'] },
  
  // Facility Management
  { categoryL1: 'Facility Management', categoryL2: 'Catering', description: 'Office catering, food services', keywords: ['catering', 'food', 'beverage', 'lunch', 'breakfast'] },
  { categoryL1: 'Facility Management', categoryL2: 'Cleaning', description: 'Cleaning and janitorial services', keywords: ['cleaning', 'janitorial', 'housekeeping'] },
  { categoryL1: 'Facility Management', categoryL2: 'FM Services', description: 'General facilities management services' },
  { categoryL1: 'Facility Management', categoryL2: 'Mail', description: 'Mail and courier services', keywords: ['mail', 'courier', 'post', 'delivery'] },
  { categoryL1: 'Facility Management', categoryL2: 'Maintenance & Repair', description: 'Building maintenance and repairs', keywords: ['maintenance', 'repair', 'fix', 'upkeep'] },
  { categoryL1: 'Facility Management', categoryL2: 'Personal facilities', description: 'Personal facilities and amenities' },
  { categoryL1: 'Facility Management', categoryL2: 'Security', description: 'Security services and systems', keywords: ['security', 'guard', 'surveillance', 'access control'] },
  { categoryL1: 'Facility Management', categoryL2: 'Workplace', description: 'Workplace services and management' },
  
  // Intercompany
  { categoryL1: 'Intercompany', categoryL2: 'Intercompany', description: 'Intercompany transactions and services' },
  
  // IT Infrastructure
  { categoryL1: 'IT Infrastructure', categoryL2: 'Corporate Voice', description: 'Corporate phone systems and voice services', keywords: ['phone', 'voice', 'pbx', 'voip', 'telephony'] },
  { categoryL1: 'IT Infrastructure', categoryL2: 'Data Lines', description: 'Internet, WAN, data connectivity', keywords: ['internet', 'wan', 'connectivity', 'bandwidth', 'fiber'] },
  { categoryL1: 'IT Infrastructure', categoryL2: 'Hardware / Network', description: 'Servers, networking equipment, infrastructure hardware', keywords: ['server', 'router', 'switch', 'firewall', 'hardware'] },
  { categoryL1: 'IT Infrastructure', categoryL2: 'Hardware/Network', description: 'Servers, networking equipment (alternate)' },
  { categoryL1: 'IT Infrastructure', categoryL2: 'Mobile Voice', description: 'Mobile phones and cellular services', keywords: ['mobile', 'cell', 'smartphone', 'cellular'] },
  { categoryL1: 'IT Infrastructure', categoryL2: 'Software', description: 'Software licenses and SaaS subscriptions', keywords: ['software', 'saas', 'license', 'subscription', 'application'] },
  { categoryL1: 'IT Infrastructure', categoryL2: 'Software  ', description: 'Software licenses (alternate)' },
  
  // Market Data Services
  { categoryL1: 'Market Data Services', categoryL2: 'Bloomberg', description: 'Bloomberg terminal and data services', keywords: ['bloomberg'] },
  { categoryL1: 'Market Data Services', categoryL2: 'Market Data Other', description: 'Other market data providers' },
  { categoryL1: 'Market Data Services', categoryL2: 'Ratings', description: 'Credit ratings and rating agencies', keywords: ['rating', 'credit rating', 'moody', 's&p', 'fitch'] },
  { categoryL1: 'Market Data Services', categoryL2: 'SIX Financial Information', description: 'SIX Financial data services', keywords: ['six'] },
  { categoryL1: 'Market Data Services', categoryL2: 'Thomas Reuters/ Datastream', description: 'Reuters and Datastream services', keywords: ['reuters', 'datastream', 'refinitiv'] },
  
  // Marketing
  { categoryL1: 'Marketing', categoryL2: 'Events & Fairs', description: 'Trade shows, conferences, exhibitions', keywords: ['event', 'trade show', 'conference', 'exhibition', 'booth'] },
  { categoryL1: 'Marketing', categoryL2: 'Marketing & Communications', description: 'Marketing and PR services', keywords: ['marketing', 'pr', 'communications', 'advertising'] },
  { categoryL1: 'Marketing', categoryL2: 'Marketing Services', description: 'Marketing agency and services' },
  { categoryL1: 'Marketing', categoryL2: 'Memberships & Donations', description: 'Industry memberships and charitable donations', keywords: ['membership', 'donation', 'charity', 'association'] },
  { categoryL1: 'Marketing', categoryL2: 'Printed Materials', description: 'Brochures, business cards, printed collateral', keywords: ['print', 'brochure', 'business card', 'flyer'] },
  { categoryL1: 'Marketing', categoryL2: 'Promotional Materials', description: 'Branded merchandise and promotional items', keywords: ['promotional', 'merchandise', 'swag', 'branded'] },
  { categoryL1: 'Marketing', categoryL2: 'Sponsoring', description: 'Sponsorships and partnerships', keywords: ['sponsor', 'sponsorship', 'partnership'] },
  
  // Professional Services
  { categoryL1: 'Professional Services', categoryL2: 'Business Consulting', description: 'Management and strategy consulting', keywords: ['consulting', 'consultant', 'advisory', 'strategy', 'mckinsey', 'bcg', 'bain'] },
  { categoryL1: 'Professional Services', categoryL2: 'HR Services', description: 'HR consulting, recruitment, talent management', keywords: ['hr', 'recruitment', 'talent', 'hiring', 'headhunter'] },
  { categoryL1: 'Professional Services', categoryL2: 'IT Professional Services', description: 'IT consulting, development, implementation', keywords: ['it consulting', 'developer', 'implementation', 'integration', 'software development'] },
  { categoryL1: 'Professional Services', categoryL2: 'Legal Services', description: 'Legal counsel, law firms, compliance', keywords: ['legal', 'lawyer', 'attorney', 'law firm', 'counsel'] },
  { categoryL1: 'Professional Services', categoryL2: 'Tax & Audit Services', description: 'Accounting, tax, audit services', keywords: ['tax', 'audit', 'accounting', 'deloitte', 'pwc', 'ey', 'kpmg'] },
  { categoryL1: 'Professional Services', categoryL2: 'Translation', description: 'Translation and localization services', keywords: ['translation', 'localization', 'interpreter'] },
  
  // Public Sector Cost
  { categoryL1: 'Public Sector Cost', categoryL2: 'Fees', description: 'Government fees, licenses, regulatory costs', keywords: ['fee', 'license', 'permit', 'regulatory'] },
  
  // Real Estate
  { categoryL1: 'Real Estate', categoryL2: 'Relocation', description: 'Employee relocation services', keywords: ['relocation', 'moving', 'relocation services'] },
  { categoryL1: 'Real Estate', categoryL2: 'Rent Building', description: 'Office rent and lease payments', keywords: ['rent', 'lease', 'office space', 'building'] },
  { categoryL1: 'Real Estate', categoryL2: 'Rent Parking', description: 'Parking space rental', keywords: ['parking', 'garage'] },
  { categoryL1: 'Real Estate', categoryL2: 'Utilities', description: 'Electricity, water, gas, utilities', keywords: ['utility', 'electricity', 'water', 'gas', 'heating'] },
  
  // Travel
  { categoryL1: 'Travel', categoryL2: 'Air travel', description: 'Flights and air travel', keywords: ['flight', 'airline', 'air travel', 'airplane'] },
  { categoryL1: 'Travel', categoryL2: 'Company Cars', description: 'Company vehicle fleet and leasing', keywords: ['company car', 'fleet', 'vehicle lease'] },
  { categoryL1: 'Travel', categoryL2: 'Hotel', description: 'Hotel accommodations', keywords: ['hotel', 'accommodation', 'lodging'] },
  { categoryL1: 'Travel', categoryL2: 'Public Transport', description: 'Public transportation, trains, buses', keywords: ['train', 'bus', 'public transport', 'rail'] },
  { categoryL1: 'Travel', categoryL2: 'Rental Cars', description: 'Car rental services', keywords: ['car rental', 'rental car', 'hertz', 'avis'] },
];

async function seedProcurementTaxonomy(tenantId: string = 'demo') {
  console.log('🌱 Seeding procurement taxonomy...');
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const category of INDIRECT_CATEGORIES) {
    try {
      // Create full category path
      const categoryPath = category.categoryL2 
        ? `${category.categoryL1}/${category.categoryL2}`
        : category.categoryL1;
      
      // Generate display name
      const displayName = category.categoryL2 || category.categoryL1;
      
      // Upsert category
      const result = await prisma.procurementCategory.upsert({
        where: {
          tenantId_categoryL1_categoryL2: {
            tenantId,
            categoryL1: category.categoryL1,
            categoryL2: category.categoryL2,
          },
        },
        create: {
          tenantId,
          categoryL1: category.categoryL1,
          categoryL2: category.categoryL2,
          categoryPath,
          displayName,
          description: category.description || displayName,
          keywords: category.keywords || [],
          isIndirectSpend: true,
          spendType: 'INDIRECT',
          enableBenchmarking: true,
          isActive: true,
        },
        update: {
          description: category.description || displayName,
          keywords: category.keywords || [],
          updatedAt: new Date(),
        },
      });
      
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
        console.log(`  ✅ Created: ${categoryPath}`);
      } else {
        updated++;
        console.log(`  ♻️  Updated: ${categoryPath}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing ${category.categoryL1}/${category.categoryL2}:`, error);
      skipped++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${INDIRECT_CATEGORIES.length}`);
  
  // Display category breakdown
  const l1Categories = [...new Set(INDIRECT_CATEGORIES.map(c => c.categoryL1))];
  console.log(`\n📁 Category L1 count: ${l1Categories.length}`);
  l1Categories.forEach(l1 => {
    const count = INDIRECT_CATEGORIES.filter(c => c.categoryL1 === l1).length;
    console.log(`  ${l1}: ${count} subcategories`);
  });
}

async function main() {
  try {
    // Get tenant ID from command line or use demo
    const tenantId = process.argv[2] || 'demo';
    
    console.log(`\n🚀 Starting procurement taxonomy seed for tenant: ${tenantId}\n`);
    
    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    
    if (!tenant) {
      console.error(`❌ Tenant '${tenantId}' not found. Please create tenant first.`);
      process.exit(1);
    }
    
    await seedProcurementTaxonomy(tenantId);
    
    console.log('\n✅ Procurement taxonomy seed completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

export { seedProcurementTaxonomy };
