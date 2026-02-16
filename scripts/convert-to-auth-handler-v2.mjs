/**
 * Converts route handlers to use withAuthApiHandler pattern.
 * v2 - with robust brace matching that handles template literals + SQL
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

// ========== Robust brace matching ==========

function skipTemplateLiteral(content, i) {
  // We're inside a template literal, just past the opening backtick
  while (i < content.length) {
    const ch = content[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '`') { return i + 1; }
    if (ch === '$' && i + 1 < content.length && content[i + 1] === '{') {
      i += 2; // Skip ${
      let exprDepth = 1;
      while (i < content.length && exprDepth > 0) {
        const ec = content[i];
        if (ec === '\\') { i += 2; continue; }
        // Strings inside expression
        if (ec === "'" || ec === '"') {
          const q = ec;
          i++;
          while (i < content.length && content[i] !== q) {
            if (content[i] === '\\') i++;
            i++;
          }
          i++; continue;
        }
        // Nested template literal inside expression
        if (ec === '`') {
          i++;
          i = skipTemplateLiteral(content, i);
          continue;
        }
        // Comments inside expression
        if (ec === '/' && i + 1 < content.length) {
          if (content[i + 1] === '/') {
            const nl = content.indexOf('\n', i);
            i = nl === -1 ? content.length : nl + 1;
            continue;
          }
          if (content[i + 1] === '*') {
            const end = content.indexOf('*/', i + 2);
            i = end === -1 ? content.length : end + 2;
            continue;
          }
        }
        if (ec === '{') exprDepth++;
        if (ec === '}') {
          exprDepth--;
          if (exprDepth === 0) { i++; break; }
        }
        i++;
      }
      continue;
    }
    i++;
  }
  return i;
}

function findMatchingBrace(content, openBraceIndex) {
  let depth = 1;
  let i = openBraceIndex + 1;

  while (i < content.length && depth > 0) {
    const ch = content[i];

    // Line comments
    if (ch === '/' && i + 1 < content.length && content[i + 1] === '/') {
      const nl = content.indexOf('\n', i);
      i = nl === -1 ? content.length : nl + 1;
      continue;
    }
    // Block comments
    if (ch === '/' && i + 1 < content.length && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2);
      i = end === -1 ? content.length : end + 2;
      continue;
    }
    // Single-quoted strings
    if (ch === "'") {
      i++;
      while (i < content.length && content[i] !== "'") {
        if (content[i] === '\\') i++;
        i++;
      }
      i++; continue;
    }
    // Double-quoted strings
    if (ch === '"') {
      i++;
      while (i < content.length && content[i] !== '"') {
        if (content[i] === '\\') i++;
        i++;
      }
      i++; continue;
    }
    // Template literals
    if (ch === '`') {
      i++;
      i = skipTemplateLiteral(content, i);
      continue;
    }
    // Braces
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

// ========== Import handling ==========

function addMiddlewareImport(content) {
  if (content.includes('withAuthApiHandler')) return content;
  const lines = content.split('\n');
  let lastImportEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) {
      // Multi-line import - find the end
      let j = i;
      while (j < lines.length && !lines[j].includes(';') && !lines[j].match(/from\s+['"][^'"]+['"]/)) {
        j++;
      }
      lastImportEnd = j;
    }
  }
  if (lastImportEnd === -1) {
    return MIDDLEWARE_IMPORT + '\n' + content;
  }
  lines.splice(lastImportEnd + 1, 0, MIDDLEWARE_IMPORT);
  return lines.join('\n');
}

// ========== Session removal ==========

function removeSessionAuthChecks(body) {
  let result = body;

  // Pattern: const session = await getServerSession();\n    if (!session?.user) { return NextResponse.json({...}, {status:401}); }\n
  // Handle both ; and no-; variants, with varying whitespace
  result = result.replace(
    /\n?\s*(?:const|let)\s+session\s*=\s*await\s+(?:getServerSession|auth)\s*\(\s*\)\s*;?\s*\n\s*if\s*\(\s*!session(?:\?\.user)?\s*\)\s*\{\s*\n?\s*return\s+NextResponse\.json\s*\([^)]*\{[^}]*\}[^)]*\)\s*;?\s*\n?\s*\}/g,
    ''
  );

  // Pattern without curly on same line: if (!session?.user)\n  return ...
  result = result.replace(
    /\n?\s*(?:const|let)\s+session\s*=\s*await\s+(?:getServerSession|auth)\s*\(\s*\)\s*;?\s*\n\s*if\s*\(\s*!session(?:\?\.user)?\s*\)\s*\n\s*return\s+NextResponse\.json\s*\([^)]*\)\s*;?\s*/g,
    ''
  );

  return result;
}

// ========== Tenant/request ID replacement ==========

function replaceHeaderAccess(body) {
  let result = body;
  result = result.replace(/request\.headers\.get\s*\(\s*['"]x-tenant-id['"]\s*\)/g, 'ctx.tenantId');
  result = result.replace(/req\.headers\.get\s*\(\s*['"]x-tenant-id['"]\s*\)/g, 'ctx.tenantId');
  result = result.replace(/request\.headers\.get\s*\(\s*['"]x-request-id['"]\s*\)/g, 'ctx.requestId');
  result = result.replace(/req\.headers\.get\s*\(\s*['"]x-request-id['"]\s*\)/g, 'ctx.requestId');
  return result;
}

// ========== Outer try/catch removal ==========

function removeOuterTryCatch(body) {
  const trimmed = body.trimStart();

  // Must start with try {
  const tryMatch = trimmed.match(/^try\s*\{/);
  if (!tryMatch) return body;

  const tryBraceStart = trimmed.indexOf('{');
  const tryBraceEnd = findMatchingBrace(trimmed, tryBraceStart);
  if (tryBraceEnd === -1) return body;

  // After try block, must have catch
  const afterTry = trimmed.substring(tryBraceEnd + 1).trimStart();
  if (!afterTry.startsWith('catch')) return body;

  // Find catch block
  const catchBraceStart = afterTry.indexOf('{');
  if (catchBraceStart === -1) return body;
  const catchBraceEnd = findMatchingBrace(afterTry, catchBraceStart);
  if (catchBraceEnd === -1) return body;

  // Must be at the end (nothing significant after catch block)
  const afterCatch = afterTry.substring(catchBraceEnd + 1).trim();
  if (afterCatch.length > 0) return body;

  // Extract try body
  const tryBody = trimmed.substring(tryBraceStart + 1, tryBraceEnd);

  // Dedent by 2 spaces
  const lines = tryBody.split('\n');
  const dedented = lines.map(line => {
    if (line.startsWith('    ')) return line.substring(2);
    if (line.startsWith('\t\t')) return line.substring(1);
    return line;
  }).join('\n');

  // Preserve leading whitespace from original body
  const leadingWs = body.match(/^(\s*)/);
  return (leadingWs ? leadingWs[1] : '') + dedented.trim() + '\n';
}

// ========== Handler conversion ==========

function findHandlerDeclarations(content) {
  const handlers = [];
  for (const method of HTTP_METHODS) {
    // Pattern: export async function METHOD(
    const regex = new RegExp(
      `export\\s+async\\s+function\\s+${method}\\s*\\(`,
      'g'
    );
    let m;
    while ((m = regex.exec(content)) !== null) {
      handlers.push({ method, index: m.index, matchText: m[0] });
    }
  }
  // Sort by position (reverse order so we can replace from end to start)
  handlers.sort((a, b) => b.index - a.index);
  return handlers;
}

function convertHandler(content, handler) {
  const { method, index: matchStart } = handler;

  // Find the opening brace of the function body
  const braceStart = content.indexOf('{', matchStart);
  if (braceStart === -1) return content;

  // Find closing brace
  const braceEnd = findMatchingBrace(content, braceStart);
  if (braceEnd === -1) {
    console.log(`    WARN: Could not find matching brace for ${method}`);
    return content;
  }

  // Extract the function signature to determine param name
  const sig = content.substring(matchStart, braceStart + 1);
  
  // Determine parameter names
  let paramName = 'request';
  if (sig.includes('req:') || sig.match(/\breq\b/)) paramName = 'req';
  const hasRequest = sig.includes('request') || sig.includes('req');
  const isUnused = sig.includes('_request') || sig.includes('_req');
  
  let paramStr;
  if (isUnused || !hasRequest || sig.match(/\(\s*\)/)) {
    paramStr = '(_request, ctx)';
  } else {
    paramStr = `(${paramName}, ctx)`;
  }

  // Extract handler body
  let handlerBody = content.substring(braceStart + 1, braceEnd);

  // Remove outer try/catch
  handlerBody = removeOuterTryCatch(handlerBody);

  // Remove session auth checks
  handlerBody = removeSessionAuthChecks(handlerBody);

  // Replace header access patterns
  handlerBody = replaceHeaderAccess(handlerBody);

  // Build new handler
  const newHandler = `export const ${method} = withAuthApiHandler(async ${paramStr} => {${handlerBody}});`;

  // Replace in content
  const before = content.substring(0, matchStart);
  const after = content.substring(braceEnd + 1);

  return before + newHandler + after;
}

// ========== Import cleanup ==========

function cleanupImports(content) {
  // Get body without import lines for usage checking
  const bodyOnly = content.replace(/^import\s+.*$/gm, '').replace(/^\s*\}\s*from\s+.*$/gm, '');

  // Check NextResponse usage in body
  const nextResponseUsed = /\bNextResponse\b/.test(bodyOnly);
  if (!nextResponseUsed) {
    content = content.replace(
      /import\s*\{\s*NextRequest\s*,\s*NextResponse\s*\}\s*from\s*['"]next\/server['"]\s*;?/g,
      "import { NextRequest } from 'next/server';"
    );
    content = content.replace(
      /import\s*\{\s*NextResponse\s*,\s*NextRequest\s*\}\s*from\s*['"]next\/server['"]\s*;?/g,
      "import { NextRequest } from 'next/server';"
    );
  }

  // Check getServerSession usage in body
  if (!/\bgetServerSession\b/.test(bodyOnly)) {
    // Standalone import
    content = content.replace(
      /import\s*\{\s*getServerSession\s*\}\s*from\s*['"]@\/lib\/auth['"]\s*;?\n?/g,
      ''
    );
  }

  // Check auth() usage in body
  if (!/\bauth\s*\(/.test(bodyOnly)) {
    content = content.replace(
      /import\s*\{\s*auth\s*\}\s*from\s*['"]@\/lib\/auth['"]\s*;?\n?/g,
      ''
    );
    // auth + getSessionTenantId combo
    content = content.replace(
      /import\s*\{\s*auth\s*,\s*getSessionTenantId\s*\}\s*from\s*['"]@\/lib\/auth['"]\s*;?\n?/g,
      (m) => {
        if (/\bgetSessionTenantId\b/.test(bodyOnly)) {
          return "import { getSessionTenantId } from '@/lib/auth';\n";
        }
        return '';
      }
    );
  }

  // Check getSessionTenantId usage
  if (!/\bgetSessionTenantId\b/.test(bodyOnly)) {
    // Combined with getServerSession
    content = content.replace(
      /import\s*\{\s*getServerSession\s*,\s*getSessionTenantId\s*\}\s*from\s*['"]@\/lib\/(?:auth|tenant-server)['"]\s*;?\n?/g,
      (m) => {
        if (/\bgetServerSession\b/.test(bodyOnly)) {
          return "import { getServerSession } from '@/lib/auth';\n";
        }
        return '';
      }
    );
    content = content.replace(
      /import\s*\{\s*getSessionTenantId\s*,\s*getServerSession\s*\}\s*from\s*['"]@\/lib\/(?:auth|tenant-server)['"]\s*;?\n?/g,
      (m) => {
        if (/\bgetServerSession\b/.test(bodyOnly)) {
          return "import { getServerSession } from '@/lib/auth';\n";
        }
        return '';
      }
    );
  }

  return content;
}

// ========== Main conversion ==========

async function convertFile(relativePath) {
  const filePath = join(BASE, relativePath);
  let content;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (err) {
    console.error(`  ERROR: Cannot read ${relativePath}: ${err.message}`);
    return false;
  }

  if (content.includes('withAuthApiHandler')) {
    console.log(`  SKIP: ${relativePath} (already converted)`);
    return true;
  }

  let modified = content;

  // Step 1: Add middleware import
  modified = addMiddlewareImport(modified);

  // Step 2: Convert each handler (process from end to start to preserve indices)
  const handlers = findHandlerDeclarations(modified);
  for (const handler of handlers) {
    // Skip OPTIONS handlers (usually CORS)
    if (handler.method === 'OPTIONS') continue;
    modified = convertHandler(modified, handler);
  }

  // Step 3: Clean up imports
  modified = cleanupImports(modified);

  // Step 4: Clean up triple+ blank lines
  modified = modified.replace(/\n{3,}/g, '\n\n');

  // Verify conversion happened
  let convertedCount = 0;
  for (const method of HTTP_METHODS) {
    if (new RegExp(`export\\s+const\\s+${method}\\s*=\\s*withAuthApiHandler`).test(modified)) {
      convertedCount++;
    }
  }

  // Check if any handlers still remain unconverted
  let remainingCount = 0;
  for (const method of HTTP_METHODS) {
    if (new RegExp(`export\\s+async\\s+function\\s+${method}\\b`).test(modified)) {
      remainingCount++;
    }
  }

  if (convertedCount === 0 && remainingCount > 0) {
    console.error(`  PARTIAL: ${relativePath} - ${remainingCount} handler(s) not converted`);
  }

  try {
    await writeFile(filePath, modified, 'utf-8');
    console.log(`  OK: ${relativePath} (${convertedCount} converted, ${remainingCount} remaining)`);
    return true;
  } catch (err) {
    console.error(`  ERROR: Cannot write ${relativePath}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`Converting ${FILES.length} files to withAuthApiHandler pattern...\n`);
  let success = 0, fail = 0;
  for (const file of FILES) {
    if (await convertFile(file)) success++; else fail++;
  }
  console.log(`\nDone: ${success} OK, ${fail} failed`);
}

main().catch(console.error);
