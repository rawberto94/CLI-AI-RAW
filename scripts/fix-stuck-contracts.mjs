#!/usr/bin/env node
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAndFixStuckContracts() {
  try {
    // Find all PROCESSING contracts
    const stuck = await prisma.contract.findMany({
      where: { 
        status: 'PROCESSING',
        tenantId: 'demo'
      },
      include: {
        artifacts: {
          select: { id: true, type: true, validationStatus: true }
        },
        processingJobs: {
          select: { id: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    console.log(`Found ${stuck.length} stuck contracts in PROCESSING status:\n`);
    
    for (const contract of stuck) {
      console.log(`Contract: ${contract.id}`);
      console.log(`  Created: ${contract.createdAt}`);
      console.log(`  Filename: ${contract.filename}`);
      console.log(`  Artifacts: ${contract.artifacts.length}`);
      console.log(`  Last Job: ${contract.processingJobs[0]?.status || 'none'}`);
      
      // Check if contract is older than 5 minutes
      const ageMinutes = (Date.now() - contract.createdAt.getTime()) / (1000 * 60);
      
      if (ageMinutes > 5 && contract.artifacts.length === 0) {
        console.log(`  ⚠️  Stuck for ${Math.round(ageMinutes)} minutes - fixing...`);
        
        // Update to FAILED
        await prisma.contract.update({
          where: { id: contract.id },
          data: { 
            status: 'FAILED',
            processedAt: new Date()
          }
        });
        
        // Update processing jobs
        await prisma.processingJob.updateMany({
          where: { 
            contractId: contract.id,
            status: 'PROCESSING'
          },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: 'Timeout: No artifacts generated'
          }
        });
        
        console.log(`  ✅ Fixed!\n`);
      } else {
        console.log(`  ⏳ Still processing (${Math.round(ageMinutes)} min old)\n`);
      }
    }
    
    console.log('Done!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

findAndFixStuckContracts();
