/**
 * Converts route handlers to use withAuthApiHandler pattern.
 * 
 * For each file:
 * 1. Adds import for withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, AuthenticatedApiContext
 * 2. Wraps each exported handler with withAuthApiHandler
 * 3. Removes outer try/catch (wrapper handles it)
 * 4. Removes getServerSession + 401 checks
 * 5. Replaces request.headers.get('x-tenant-id') with ctx.tenantId
 * 6. Replaces request.headers.get('x-request-id') with ctx.requestId
 * 7. Cleans up unused imports
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const BASE = '/workspaces/CLI-AI-RAW/apps/web/app/api/contracts';

const FILES = [
  'ai-report/route.ts',
  'alerts/route.ts',
  'artifacts/enhanced/route.ts',
  'batch/route.ts',
  'bulk-extract-metadata/route.ts',
  'bulk-extract/route.ts',
  'bulk/route.ts',
  'categorize/route.ts',
  'comments/route.ts',
  'compare/route.ts',
  'expirations/route.ts',
  'export/route.ts',
  'extraction-feedback/route.ts',
  'generate/clause/route.ts',
  'generate/route.ts',
  'generate/translate/route.ts',
  'health-scores/route.ts',
  'intelligent-analysis/route.ts',
  'metadata/bulk-update/route.ts',
  'organize/route.ts',
  'orphans/route.ts',
  'populate-from-artifacts/route.ts',
  'renewal-history/route.ts',
  'search/route.ts',
  'stats/route.ts',
  'summary/route.ts',
  'sync-expirations/route.ts',
  'sync-health-scores/route.ts',
  'sync/route.ts',
  'tags/suggest/route.ts',
  'upload/chunk/route.ts',
  'upload/finalize/route.ts',
  'upload/init/route.ts',
  'upload/route.ts',
];

const MIDDLEWARE_IMPORT = `import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';`;

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

function addMiddlewareImport(content) {
  // Don't add if already present
  if (content.includes('withAuthApiHandler')) return content;
  
  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || line.startsWith('import{') || 
        (line.startsWith("} from '") || line.startsWith("} from \""))) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex === -1) {
    // No imports found, add at top
    return MIDDLEWARE_IMPORT + '\n' + content;
  }
  
  // Insert after the last import
  lines.splice(lastImportIndex + 1, 0, MIDDLEWARE_IMPORT);
  return lines.join('\n');
}

function removeSessionAuthCheck(body) {
  // Pattern 1: const session = await getServerSession(); if (!session?.user) { return ... }
  // Pattern 2: const session = await auth(); followed by check
  
  // Remove multi-line session check blocks
  let result = body;
  
  // Remove: const session = await getServerSession();\n    if (!session?.user) {\n      return NextResponse.json(...)\n    }
  result = result.replace(
    /\s*(?:const|let)\s+session\s*=\s*await\s+(?:getServerSession|auth)\s*\(\s*\)\s*;?\s*\n\s*if\s*\(\s*!session(?:\?\.user)?\s*\)\s*\{[^}]*\}\s*\n?/g,
    '\n'
  );
  
  // Remove standalone: const session = await getServerSession();
  // (if the session check was already removed but the line remains)
  // Only remove if session isn't used afterward
  // We'll be conservative and leave it if session is used elsewhere
  
  return result;
}

function replaceTenantIdFromHeaders(body) {
  // Replace request.headers.get('x-tenant-id') or request.headers.get("x-tenant-id") with ctx.tenantId
  let result = body;
  result = result.replace(/request\.headers\.get\s*\(\s*['"]x-tenant-id['"]\s*\)/g, 'ctx.tenantId');
  result = result.replace(/req\.headers\.get\s*\(\s*['"]x-tenant-id['"]\s*\)/g, 'ctx.tenantId');
  return result;
}

function replaceRequestIdFromHeaders(body) {
  let result = body;
  result = result.replace(/request\.headers\.get\s*\(\s*['"]x-request-id['"]\s*\)/g, 'ctx.requestId');
  result = result.replace(/req\.headers\.get\s*\(\s*['"]x-request-id['"]\s*\)/g, 'ctx.requestId');
  return result;
}

function findMatchingBrace(content, startIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let templateDepth = 0;
  let inLineComment = false;
  let inBlockComment = false;
  
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    const prevChar = content[i - 1];
    
    // Handle comments
    if (!inString && !inBlockComment && char === '/' && nextChar === '/') {
      inLineComment = true;
      continue;
    }
    if (inLineComment && char === '\n') {
      inLineComment = false;
      continue;
    }
    if (inLineComment) continue;
    
    if (!inString && !inLineComment && char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++; // skip *
      continue;
    }
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i++; // skip /
      continue;
    }
    if (inBlockComment) continue;
    
    // Handle template literals
    if (char === '`' && prevChar !== '\\') {
      inTemplate = !inTemplate;
      continue;
    }
    if (inTemplate) {
      if (char === '$' && nextChar === '{') {
        templateDepth++;
      }
      if (char === '}' && templateDepth > 0) {
        templateDepth--;
      }
      if (templateDepth > 0 && char === '{') depth++;
      if (templateDepth > 0 && char === '}' && depth > 0) {
        // This is handled by template depth
      }
      continue;
    }
    
    // Handle strings
    if (!inString && (char === '"' || char === "'") && prevChar !== '\\') {
      inString = true;
      stringChar = char;
      continue;
    }
    if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      continue;
    }
    if (inString) continue;
    
    // Count braces
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  
  return -1;
}

function removeOuterTryCatch(handlerBody) {
  // Check if the handler body starts with try {
  const trimmed = handlerBody.trim();
  
  // Find the try block
  const tryMatch = trimmed.match(/^(\s*)try\s*\{/);
  if (!tryMatch) return handlerBody;
  
  // Find the opening brace of try
  const tryStart = trimmed.indexOf('try');
  const tryBraceStart = trimmed.indexOf('{', tryStart);
  
  // Find the matching closing brace
  const tryBraceEnd = findMatchingBrace(trimmed, tryBraceStart);
  if (tryBraceEnd === -1) return handlerBody;
  
  // Check if followed by catch
  const afterTry = trimmed.substring(tryBraceEnd + 1).trim();
  if (!afterTry.startsWith('catch')) return handlerBody;
  
  // Find the catch block
  const catchBraceStart = afterTry.indexOf('{');
  if (catchBraceStart === -1) return handlerBody;
  const catchBraceEnd = findMatchingBrace(afterTry, catchBraceStart);
  if (catchBraceEnd === -1) return handlerBody;
  
  // Check if after the catch block there's more code (meaning the try/catch is not the outer wrapper)
  const afterCatch = afterTry.substring(catchBraceEnd + 1).trim();
  if (afterCatch.length > 0) {
    // There's code after the catch, so try/catch might not be the outer wrapper
    // Only remove if the remaining is empty or just whitespace
    return handlerBody;
  }
  
  // Extract the body inside try { ... }
  const tryBody = trimmed.substring(tryBraceStart + 1, tryBraceEnd);
  
  // Dedent by 2 spaces (one level)
  const dedented = tryBody.split('\n').map(line => {
    if (line.startsWith('    ')) return line.substring(2);
    if (line.startsWith('  ')) return line.substring(2);
    return line;
  }).join('\n');
  
  return dedented;
}

function convertHandler(content, method) {
  // Find the handler declaration
  // Pattern: export async function METHOD(request: NextRequest) {
  // or: export async function METHOD(request: NextRequest): Promise<NextResponse> {
  // or: export async function METHOD(req: NextRequest) {
  // or: export async function METHOD() {
  
  const patterns = [
    new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(\\s*(request|req)\\s*:\\s*NextRequest\\s*\\)\\s*(?::\\s*Promise<NextResponse>)?\\s*\\{`),
    new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(\\s*(?:_?request|_?req)?\\s*(?::\\s*NextRequest)?\\s*\\)\\s*(?::\\s*Promise<NextResponse>)?\\s*\\{`),
  ];
  
  let match = null;
  let pattern = null;
  for (const p of patterns) {
    match = content.match(p);
    if (match) { pattern = p; break; }
  }
  
  if (!match) return content;
  
  const matchStart = match.index;
  const matchEnd = matchStart + match[0].length;
  
  // Find the opening brace
  const braceStart = content.indexOf('{', matchStart);
  
  // Find the matching closing brace
  const braceEnd = findMatchingBrace(content, braceStart);
  if (braceEnd === -1) return content;
  
  // Extract the handler body
  let handlerBody = content.substring(braceStart + 1, braceEnd);
  
  // Determine param name
  const paramName = match[0].includes('req:') || match[0].includes('req)') ? 'req' : 'request';
  // Handle no-param or underscore-param handlers
  const hasParam = match[0].includes('request') || match[0].includes('req');
  
  // Remove outer try/catch
  handlerBody = removeOuterTryCatch(handlerBody);
  
  // Remove session auth checks
  handlerBody = removeSessionAuthCheck(handlerBody);
  
  // Replace header accesses
  handlerBody = replaceTenantIdFromHeaders(handlerBody);
  handlerBody = replaceRequestIdFromHeaders(handlerBody);
  
  // Build the new handler
  let paramStr;
  if (match[0].includes('_request') || match[0].includes('_req')) {
    paramStr = `(_request, ctx)`;
  } else if (!hasParam || match[0].match(/\(\s*\)/)) {
    paramStr = `(_request, ctx)`;
  } else {
    paramStr = `(${paramName}, ctx)`;
  }
  
  const newDeclaration = `export const ${method} = withAuthApiHandler(async ${paramStr} => {`;
  
  // Rebuild the content
  const before = content.substring(0, matchStart);
  const after = content.substring(braceEnd + 1);
  
  return before + newDeclaration + handlerBody + '});' + after;
}

function removeUnusedImports(content) {
  // Check if NextResponse is still used in the body (outside of imports)
  const importSection = content.match(/^([\s\S]*?(?:^(?!import).*$))/m);
  
  // Find all import lines
  const lines = content.split('\n');
  let result = content;
  
  // Check if NextResponse is used outside import statements
  const bodyContent = content.replace(/^import\s+.*$/gm, '');
  const nextResponseUsed = bodyContent.includes('NextResponse');
  
  if (!nextResponseUsed) {
    // Remove NextResponse from imports
    // Pattern: import { NextRequest, NextResponse } from 'next/server';
    result = result.replace(
      /import\s*\{\s*NextRequest\s*,\s*NextResponse\s*\}\s*from\s*['"]next\/server['"]\s*;?/g,
      "import { NextRequest } from 'next/server';"
    );
    result = result.replace(
      /import\s*\{\s*NextResponse\s*,\s*NextRequest\s*\}\s*from\s*['"]next\/server['"]\s*;?/g,
      "import { NextRequest } from 'next/server';"
    );
    // If only NextResponse was imported
    result = result.replace(
      /import\s*\{\s*NextResponse\s*\}\s*from\s*['"]next\/server['"]\s*;?\n?/g,
      ''
    );
  }
  
  // Check if getServerSession is still used
  const getServerSessionUsed = bodyContent.includes('getServerSession');
  if (!getServerSessionUsed) {
    // Remove getServerSession import
    result = result.replace(
      /import\s*\{\s*getServerSession\s*\}\s*from\s*['"]@\/lib\/auth['"]\s*;?\n?/g,
      ''
    );
    // Handle: import { getServerSession } from '@/lib/auth'; where it's part of a multi-import
    // This is tricky - leave it for now unless it's the only import
  }
  
  // Check if auth is still used
  const authUsed = bodyContent.match(/\bauth\b\s*\(/);
  if (!authUsed) {
    result = result.replace(
      /import\s*\{\s*auth\s*\}\s*from\s*['"]@\/lib\/auth['"]\s*;?\n?/g,
      ''
    );
  }
  
  // Check if getSessionTenantId is still used
  const getSessionTenantIdUsed = bodyContent.includes('getSessionTenantId');
  if (!getSessionTenantIdUsed) {
    // Remove from combined imports with getServerSession
    result = result.replace(
      /import\s*\{\s*getServerSession\s*,\s*getSessionTenantId\s*\}\s*from\s*['"]@\/lib\/auth['"]\s*;?\n?/g,
      ''
    );
    result = result.replace(
      /import\s*\{\s*getSessionTenantId\s*,\s*getServerSession\s*\}\s*from\s*['"]@\/lib\/auth['"]\s*;?\n?/g,
      ''
    );
  }
  
  return result;
}

async function convertFile(relativePath) {
  const filePath = join(BASE, relativePath);
  let content;
  
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    console.error(`  ERROR: Cannot read ${relativePath}: ${err.message}`);
    return false;
  }
  
  // Skip if already converted
  if (content.includes('withAuthApiHandler')) {
    console.log(`  SKIP: ${relativePath} (already converted)`);
    return true;
  }
  
  let modified = content;
  
  // Step 1: Add middleware import
  modified = addMiddlewareImport(modified);
  
  // Step 2: Convert each handler method (process in reverse to not mess up indices)
  for (const method of HTTP_METHODS) {
    // Check if this method exists as an export
    const regex = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`);
    if (regex.test(modified)) {
      modified = convertHandler(modified, method);
    }
  }
  
  // Also handle OPTIONS specially - skip conversion for OPTIONS with cors
  // (We already only look for GET, POST, PUT, DELETE, PATCH above)
  
  // Step 3: Clean up unused imports
  modified = removeUnusedImports(modified);
  
  // Step 4: Clean up double blank lines
  modified = modified.replace(/\n{3,}/g, '\n\n');
  
  // Write the file
  try {
    await writeFile(filePath, modified, 'utf-8');
    console.log(`  OK: ${relativePath}`);
    return true;
  } catch (err) {
    console.error(`  ERROR: Cannot write ${relativePath}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`Converting ${FILES.length} files to withAuthApiHandler pattern...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of FILES) {
    const success = await convertFile(file);
    if (success) successCount++;
    else failCount++;
  }
  
  console.log(`\nDone: ${successCount} converted, ${failCount} failed`);
}

main().catch(console.error);
