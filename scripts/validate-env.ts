#!/usr/bin/env npx tsx
/**
 * Production Environment Validation Script
 * 
 * Run before deployment to validate all required environment variables
 * are properly configured for production.
 * 
 * Usage: npx tsx scripts/validate-env.ts [--strict]
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
  sensitiveExample?: string;
}

// Required environment variables for production
const REQUIRED_ENV_VARS: EnvVar[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string',
    validator: (v) => v.startsWith('postgresql://') && !v.includes('localhost'),
  },
  
  // Authentication
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    description: 'NextAuth.js secret for session encryption',
    validator: (v) => v.length >= 32,
  },
  {
    name: 'NEXTAUTH_URL',
    required: true,
    description: 'Canonical URL of the application',
    validator: (v) => v.startsWith('https://'),
  },
  
  // OpenAI
  {
    name: 'OPENAI_API_KEY',
    required: true,
    description: 'OpenAI API key for AI features',
    validator: (v) => v.startsWith('sk-') && v.length > 20,
  },
  
  // Redis (for caching and queues)
  {
    name: 'REDIS_URL',
    required: true,
    description: 'Redis connection URL',
    validator: (v) => (v.startsWith('redis://') || v.startsWith('rediss://')) && !v.includes('localhost'),
  },
  
  // Storage
  {
    name: 'S3_BUCKET',
    required: true,
    description: 'S3 bucket name for file storage',
    validator: (v) => v.length > 0 && !v.includes('demo'),
  },
  {
    name: 'S3_ACCESS_KEY',
    required: true,
    description: 'S3 access key ID',
    validator: (v) => v.length >= 16,
  },
  {
    name: 'S3_SECRET_KEY',
    required: true,
    description: 'S3 secret access key',
    validator: (v) => v.length >= 20,
  },
  {
    name: 'S3_REGION',
    required: true,
    description: 'S3 region (e.g., us-east-1)',
    validator: (v) => /^[a-z]{2}-[a-z]+-\d$/.test(v),
  },
  
  // Email
  {
    name: 'SMTP_HOST',
    required: true,
    description: 'SMTP server hostname',
    validator: (v) => v.length > 0 && !v.includes('localhost'),
  },
  {
    name: 'SMTP_USER',
    required: true,
    description: 'SMTP authentication username',
    validator: (v) => v.length > 0,
  },
  {
    name: 'SMTP_PASSWORD',
    required: true,
    description: 'SMTP authentication password',
    validator: (v) => v.length > 0,
  },
  {
    name: 'FROM_EMAIL',
    required: true,
    description: 'Default sender email address',
    validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  
  // Application
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    description: 'Public application URL',
    validator: (v) => v.startsWith('https://') && !v.includes('localhost'),
  },
  {
    name: 'NODE_ENV',
    required: true,
    description: 'Node environment',
    validator: (v) => v === 'production',
  },
];

// Optional but recommended environment variables
const OPTIONAL_ENV_VARS: EnvVar[] = [
  // Monitoring
  {
    name: 'SENTRY_DSN',
    required: false,
    description: 'Sentry error tracking DSN',
    validator: (v) => v.startsWith('https://') && v.includes('sentry'),
  },
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING',
    required: false,
    description: 'Azure Application Insights connection string',
  },
  
  // Rate Limiting
  {
    name: 'RATE_LIMIT_REQUESTS_PER_MINUTE',
    required: false,
    description: 'API rate limit per minute',
    validator: (v) => parseInt(v) > 0,
  },
  
  // Feature Flags
  {
    name: 'ENABLE_AI_FEATURES',
    required: false,
    description: 'Enable AI-powered features',
    validator: (v) => v === 'true' || v === 'false',
  },
  
  // Webhooks
  {
    name: 'WEBHOOK_SECRET',
    required: false,
    description: 'Secret for webhook signature verification',
    validator: (v) => v.length >= 32,
  },
  
  // Azure (if using Azure services)
  {
    name: 'AZURE_STORAGE_CONNECTION_STRING',
    required: false,
    description: 'Azure Storage connection string (alternative to S3)',
  },
  
  // Google Cloud (if using GCP)
  {
    name: 'GOOGLE_APPLICATION_CREDENTIALS',
    required: false,
    description: 'Path to GCP service account JSON',
  },
];

// Check for dangerous values
const DANGEROUS_PATTERNS = [
  { pattern: /localhost/i, message: 'Contains localhost - not suitable for production' },
  { pattern: /127\.0\.0\.1/, message: 'Contains 127.0.0.1 - not suitable for production' },
  { pattern: /demo|test|example/i, message: 'Contains demo/test/example - likely placeholder' },
  { pattern: /your[_-]?(api[_-]?)?key/i, message: 'Looks like a placeholder API key' },
  { pattern: /xxx+/i, message: 'Contains xxx placeholder' },
  { pattern: /change[_-]?me/i, message: 'Contains "change me" placeholder' },
  { pattern: /^password$/i, message: 'Using "password" as password - insecure' },
  { pattern: /^secret$/i, message: 'Using "secret" as secret - insecure' },
];

function checkDangerousPatterns(name: string, value: string): string[] {
  const warnings: string[] = [];
  
  // Skip pattern check for certain env vars where these might be valid
  if (['NODE_ENV', 'LOG_LEVEL'].includes(name)) {
    return warnings;
  }
  
  for (const { pattern, message } of DANGEROUS_PATTERNS) {
    if (pattern.test(value)) {
      warnings.push(message);
    }
  }
  
  return warnings;
}

function validateEnv(strict: boolean = false): void {
  console.log('\n🔍 Production Environment Validation\n');
  console.log('='.repeat(60) + '\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check required variables
  console.log('📋 Required Environment Variables:\n');
  
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];
    const exists = value !== undefined && value !== '';
    
    if (!exists) {
      console.log(`  ❌ ${envVar.name}`);
      console.log(`     Missing: ${envVar.description}`);
      hasErrors = true;
      continue;
    }
    
    // Check for dangerous patterns
    const warnings = checkDangerousPatterns(envVar.name, value);
    if (warnings.length > 0) {
      console.log(`  ⚠️  ${envVar.name}`);
      for (const warning of warnings) {
        console.log(`     Warning: ${warning}`);
      }
      hasWarnings = true;
      if (strict) hasErrors = true;
      continue;
    }
    
    // Run custom validator if provided
    if (envVar.validator && !envVar.validator(value)) {
      console.log(`  ⚠️  ${envVar.name}`);
      console.log(`     Invalid format: ${envVar.description}`);
      hasWarnings = true;
      if (strict) hasErrors = true;
      continue;
    }
    
    // Mask sensitive values for display
    const displayValue = value.length > 8 
      ? value.substring(0, 4) + '****' + value.substring(value.length - 4)
      : '****';
    console.log(`  ✅ ${envVar.name} = ${displayValue}`);
  }
  
  console.log('\n' + '-'.repeat(60) + '\n');
  
  // Check optional variables
  console.log('📋 Optional Environment Variables:\n');
  
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar.name];
    const exists = value !== undefined && value !== '';
    
    if (!exists) {
      console.log(`  ⬜ ${envVar.name} (not set)`);
      console.log(`     ${envVar.description}`);
      continue;
    }
    
    // Check for dangerous patterns
    const warnings = checkDangerousPatterns(envVar.name, value);
    if (warnings.length > 0) {
      console.log(`  ⚠️  ${envVar.name}`);
      for (const warning of warnings) {
        console.log(`     Warning: ${warning}`);
      }
      hasWarnings = true;
      continue;
    }
    
    console.log(`  ✅ ${envVar.name} = configured`);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Summary
  if (hasErrors) {
    console.log('❌ VALIDATION FAILED\n');
    console.log('   Please fix the errors above before deploying to production.\n');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  VALIDATION PASSED WITH WARNINGS\n');
    console.log('   Review the warnings above. Use --strict to treat warnings as errors.\n');
    process.exit(strict ? 1 : 0);
  } else {
    console.log('✅ VALIDATION PASSED\n');
    console.log('   All required environment variables are properly configured.\n');
    process.exit(0);
  }
}

// Check for additional security configurations
function checkSecuritySettings(): void {
  console.log('\n🔒 Security Configuration Check:\n');
  
  // Check CORS
  const corsOrigin = process.env.CORS_ALLOWED_ORIGINS;
  if (corsOrigin === '*') {
    console.log('  ⚠️  CORS_ALLOWED_ORIGINS is set to * (allow all) - consider restricting');
  }
  
  // Check if debug mode is off
  const debug = process.env.DEBUG;
  if (debug === 'true' || debug === '1') {
    console.log('  ⚠️  DEBUG mode is enabled - should be disabled in production');
  }
  
  // Check HTTPS enforcement
  const forceHttps = process.env.FORCE_HTTPS;
  if (forceHttps !== 'true') {
    console.log('  ⚠️  FORCE_HTTPS is not enabled - consider enabling');
  }
  
  // Check rate limiting
  if (!process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) {
    console.log('  ⚠️  Rate limiting is not configured');
  }
  
  console.log('');
}

// Main execution
const isStrict = process.argv.includes('--strict');
const skipSecurity = process.argv.includes('--skip-security');

if (!skipSecurity) {
  checkSecuritySettings();
}

validateEnv(isStrict);
