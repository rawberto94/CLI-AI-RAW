#!/usr/bin/env node
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStuckContract() {
  const contractId = 'cmidai5yg0002g93okcuvlqov';
  
  try {
    // Update contract status to FAILED
    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: { 
        status: 'FAILED',
        processedAt: new Date()
      }
    });
    
    console.log('✅ Updated contract:', updated.id);
    console.log('   Status:', updated.status);
    console.log('   Artifacts:', await prisma.artifact.count({ where: { contractId } }));
    
    // Also update any stuck processing jobs
    const jobs = await prisma.processingJob.updateMany({
      where: { 
        contractId,
        status: 'PROCESSING'
      },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: 'Marked as failed due to stuck state'
      }
    });
    
    console.log('✅ Updated processing jobs:', jobs.count);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixStuckContract();
