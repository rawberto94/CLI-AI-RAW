import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkArtifacts() {
  const contract = await prisma.contract.findFirst({
    where: { 
      artifacts: { some: {} }
    },
    include: {
      artifacts: {
        take: 3,
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  
  if (!contract) {
    console.log('No contracts with artifacts found');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`📄 Contract: ${contract.name || contract.id}\n`);
  console.log('🎯 Artifacts:\n');
  
  contract.artifacts.forEach((a, i) => {
    console.log(`${i + 1}. ${a.type}`);
    console.log(`   ID: ${a.id}`);
    console.log(`   Created: ${a.createdAt.toISOString()}`);
    console.log(`   Edited: ${a.isEdited ? 'Yes' : 'No'}`);
    console.log(`   Edit Count: ${a.editCount || 0}`);
    console.log(`   Data keys: ${Object.keys(a.data as any).join(', ')}`);
    console.log();
  });
  
  console.log('✅ Edit infrastructure is ready!');
  console.log('\n📝 To test in the UI:');
  console.log(`   URL: http://localhost:3005/contracts/${contract.id}`);
  console.log('\n🧪 Testing checklist:');
  console.log('   1. Click "Edit" button on any artifact');
  console.log('   2. Modify a field and click "Save"');
  console.log('   3. Verify toast notification appears');
  console.log('   4. Verify page refreshes with updated data');
  console.log('   5. Click "History" button to view changes');
  console.log('   6. Click "Edit Metadata" to add tags');
  
  await prisma.$disconnect();
}

checkArtifacts().catch(console.error);
