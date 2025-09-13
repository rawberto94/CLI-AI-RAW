#!/usr/bin/env node

const FormData = require('form-data');
const fs = require('fs');
const http = require('http');

async function testDirectUpload() {
  console.log('🧪 Testing Direct Upload System\n');
  
  // Test 1: API Health
  console.log('1. Testing API health...');
  try {
    const res = await fetch('http://localhost:3001/healthz');
    if (res.ok) {
      const data = await res.json();
      console.log('✅ API Health:', data.status);
    } else {
      console.log('❌ API Health Check Failed:', res.status);
      return;
    }
  } catch (error) {
    console.log('❌ API Health Check Failed:', error.message);
    return;
  }

  // Test 2: Create test PDF file
  console.log('\n2. Creating test file...');
  const testContent = `
    TEST CONTRACT FOR UPLOAD
    This is a sample contract for testing the upload system.
    Date: ${new Date().toISOString()}
    Parties: Acme Corp and Test Client
    Terms: Standard testing terms apply
  `;
  const testFile = '/tmp/test-upload-contract.pdf';
  fs.writeFileSync(testFile, testContent);
  console.log('✅ Test file created:', testFile);

  // Test 3: Test single upload (which works)
  console.log('\n3. Testing single file upload...');
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile), 'test-contract.pdf');

    const response = await fetch('http://localhost:3001/uploads', {
      method: 'POST',
      body: form,
      headers: {
        'x-tenant-id': 'demo',
        ...form.getHeaders()
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Single upload successful!');
      console.log('   Contract ID:', data.id);
      console.log('   Status:', data.status);
      return data.id;
    } else {
      const errorText = await response.text();
      console.log('❌ Single upload failed:', response.status, errorText);
    }
  } catch (error) {
    console.log('❌ Single upload error:', error.message);
  }
}

testDirectUpload().catch(console.error);
