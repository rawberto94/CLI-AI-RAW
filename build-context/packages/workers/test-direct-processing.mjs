import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config({ path: './packages/workers/.env' });

const prisma = new PrismaClient();

const s3Client = new S3Client({
  endpoint: `http://localhost:9000`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
});

async function testProcessing() {
  try {
    console.log('1. Fetching latest contract...');
    const contract = await prisma.contract.findFirst({
      where: { status: 'PROCESSING' },
      orderBy: { uploadedAt: 'desc' }
    });
    
    if (!contract) {
      console.log('No processing contracts found');
      return;
    }
    
    console.log('2. Contract found:', contract.id);
    console.log('   Storage:', contract.storageProvider, contract.storagePath);
    
    console.log('\n3. Downloading file from MinIO...');
    const getObjectCommand = new GetObjectCommand({
      Bucket: 'contracts',
      Key: contract.storagePath,
    });

    const response = await s3Client.send(getObjectCommand);
    console.log('   File downloaded successfully');
    
    const tempDir = os.tmpdir();
    const fileName = path.basename(contract.storagePath);
    const localFilePath = path.join(tempDir, `test-${contract.id}-${fileName}`);
    
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(Buffer.from(chunk));
    }
    
    const fileBuffer = Buffer.concat(chunks);
    await fs.writeFile(localFilePath, fileBuffer);
    console.log('   Saved to:', localFilePath);
    console.log('   Size:', fileBuffer.length, 'bytes');
    
    console.log('\n4. Testing Mistral OCR...');
    const { Mistral } = await import('@mistralai/mistralai');
    
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY not found in environment');
    }
    
    const client = new Mistral({ apiKey });
    
    const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
    const file = new File([fileBlob], fileName, { type: 'application/pdf' });
    
    console.log('   Uploading to Mistral...');
    const uploadResponse = await client.files.upload({ file });
    console.log('   File uploaded, ID:', uploadResponse.id);
    
    console.log('   Running OCR...');
    const chatResponse = await client.chat.complete({
      model: 'mistral-ocr-latest',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this document.',
            },
            {
              type: 'file_url',
              fileUrl: `mcp://files/${uploadResponse.id}`,
            },
          ],
        },
      ],
    });
    
    const extractedText = chatResponse.choices?.[0]?.message?.content || '';
    console.log('   OCR completed! Extracted', extractedText.length, 'characters');
    console.log('   Preview:', extractedText.substring(0, 200));
    
    // Cleanup
    await fs.unlink(localFilePath);
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testProcessing();
