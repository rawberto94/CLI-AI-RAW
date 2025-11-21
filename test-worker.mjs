// Test worker processing directly
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: './apps/web/.env' });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function test() {
  try {
    console.log('Fetching latest contract...');
    const contract = await prisma.contract.findFirst({
      where: { status: 'PROCESSING' },
      orderBy: { uploadedAt: 'desc' }
    });
    
    if (!contract) {
      console.log('No processing contracts found');
      return;
    }
    
    console.log('Contract found:', {
      id: contract.id,
      tenantId: contract.tenantId,
      storagePath: contract.storagePath,
      storageProvider: contract.storageProvider,
      status: contract.status
    });
    
    // Try to check if file exists in MinIO
    console.log('\nChecking MinIO connection...');
    const { S3Client, GetObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({
      endpoint: `http://localhost:9000`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
      },
      forcePathStyle: true,
    });
    
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: 'contracts',
        Key: contract.storagePath,
      });
      
      const metadata = await s3Client.send(headCommand);
      console.log('File exists in MinIO:', {
        size: metadata.ContentLength,
        type: metadata.ContentType
      });
    } catch (err) {
      console.error('MinIO file check failed:', err.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
