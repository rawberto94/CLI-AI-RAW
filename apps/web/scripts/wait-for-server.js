#!/usr/bin/env node

/**
 * Wait for Next.js server to be ready before running tests
 */

const http = require('http');

const MAX_ATTEMPTS = 60; // 60 seconds
const RETRY_DELAY = 1000; // 1 second
const PORT = process.env.PORT || 3005;
const HOST = process.env.HOST || 'localhost';

let attempts = 0;

function checkServer() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${HOST}:${PORT}/`, (res) => {
      if (res.statusCode === 200 || res.statusCode === 404) {
        resolve(true);
      } else {
        reject(new Error(`Server returned status ${res.statusCode}`));
      }
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function waitForServer() {
  console.log(`⏳ Waiting for server at http://${HOST}:${PORT}...`);

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    
    try {
      await checkServer();
      console.log(`✅ Server is ready after ${attempts} attempt(s)`);
      process.exit(0);
    } catch (err) {
      if (attempts === MAX_ATTEMPTS) {
        console.error(`❌ Server not ready after ${MAX_ATTEMPTS} attempts`);
        console.error(`   Last error: ${err.message}`);
        process.exit(1);
      }
      
      if (attempts % 10 === 0) {
        console.log(`   Still waiting... (attempt ${attempts}/${MAX_ATTEMPTS})`);
      }
      
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

waitForServer();
