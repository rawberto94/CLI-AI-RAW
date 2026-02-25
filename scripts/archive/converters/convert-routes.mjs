/**
 * Batch route converter: wraps Next.js API routes with withAuthApiHandler / withApiHandler
 * Run: node scripts/convert-routes.mjs
 */
import fs from 'fs';
import path from 'path';

const API_DIR = '/workspaces/CLI-AI-RAW/apps/web/app/api';

// Files that should use withApiHandler (public/internal)
const PUBLIC_ROUTES = new Set([
  'contact/route.ts',
  'docs/openapi/route.ts',
  'monitoring/alerts/route.ts',
  'monitoring/errors/route.ts',
  'monitoring/memory/route.ts',
  'monitoring/metrics/route.ts',
  'monitoring/prometheus/route.ts',
  'monitoring/resources/route.ts',
  'internal/send-email/route.ts',
  'webhooks/trigger/route.ts',
]);

const ALL_ROUTES = [
  'activity/route.ts',
  'approvals/notify/route.ts',
  'approvals/queue/route.ts',
  'approvals/quick/route.ts',
  'approvals/route.ts',
  'approvals/submit/route.ts',
  'baselines/import/route.ts',
  'benchmarking/bulk/route.ts',
  'benchmarking/market/route.ts',
  'clauses/library/route.ts',
  'clauses/route.ts',
  'collaborators/route.ts',
  'connections/route.ts',
  'contact/route.ts',
  'contract-sources/browse/route.ts',
  'contract-sources/metrics/route.ts',
  'contract-sources/route.ts',
  'contract-sources/sync/route.ts',
  'deadlines/scan/route.ts',
  'docs/openapi/route.ts',
  'drafts/route.ts',
  'extraction/accuracy/route.ts',
  'gdpr/delete/route.ts',
  'gdpr/export/route.ts',
  'governance/route.ts',
  'import/external-database/route.ts',
  'import/history/route.ts',
  'import/progress/route.ts',
  'import/sync/route.ts',
  'import/upload/route.ts',
  'integrations/google-drive/route.ts',
  'integrations/route.ts',
  'intelligence/route.ts',
  'internal/send-email/route.ts',
  'knowledge-graph/route.ts',
  'legal-review/redlines/route.ts',
  'legal-review/route.ts',
  'monitoring/alerts/route.ts',
  'monitoring/errors/route.ts',
  'monitoring/memory/route.ts',
  'monitoring/metrics/route.ts',
  'monitoring/prometheus/route.ts',
  'monitoring/resources/route.ts',
  'notifications/preferences/route.ts',
  'notifications/push-subscription/route.ts',
  'obligations/calendar-sync/route.ts',
  'obligations/integrations/route.ts',
  'obligations/metrics/route.ts',
  'obligations/notifications/route.ts',
  'obligations/route.ts',
  'obligations/v2/bulk/route.ts',
  'obligations/v2/export/route.ts',
  'obligations/v2/metrics/route.ts',
  'obligations/v2/route.ts',
  'ocr/analyze/route.ts',
  'ocr/quality/metrics/route.ts',
  'ocr/review-queue/route.ts',
  'ocr/review-queue/stats/route.ts',
  'ocr/settings/route.ts',
  'platform/tenants/route.ts',
  'playbooks/route.ts',
  'policies/packs/route.ts',
  'portal/route.ts',
  'processing-status/route.ts',
  'push/subscribe/route.ts',
  'renewals/scan/route.ts',
  'search/semantic/route.ts',
  'search/suggestions/route.ts',
  'settings/artifacts/route.ts',
  'settings/metadata-schema/route.ts',
  'sharing/route.ts',
  'signatures/route.ts',
  'suppliers/performance/route.ts',
  'tags/route.ts',
  'taxonomy/custom-presets/route.ts',
  'taxonomy/export/route.ts',
  'taxonomy/presets/route.ts',
  'taxonomy/route.ts',
  'taxonomy/upload/route.ts',
  'team/route.ts',
  'templates/import/route.ts',
  'templates/route.ts',
  'user/favorites/route.ts',
  'user/preferences/route.ts',
  'user/profile/route.ts',
  'users/route.ts',
  'webhooks/route.ts',
  'webhooks/trigger/route.ts',
  'workflows/executions/route.ts',
  'workflows/manage/route.ts',
  'workflows/orchestrator/route.ts',
  'workflows/route.ts',
  'workflows/suggest/route.ts',
  'workflows/templates/route.ts',
];

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function convertFile(relPath) {
  const fullPath = path.join(API_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`NOT FOUND: ${relPath}`);
    return 'notfound';
  }

  let src = fs.readFileSync(fullPath, 'utf-8');

  // Already converted?
  if (
    src.includes('withAuthApiHandler') ||
    src.includes('withApiHandler(') ||
    src.includes('withCronHandler') ||
    src.includes('getApiContext')
  ) {
    console.log(`SKIP (already converted): ${relPath}`);
    return 'skip';
  }

  const isPublic = PUBLIC_ROUTES.has(relPath);
  const wrapper = isPublic ? 'withApiHandler' : 'withAuthApiHandler';

  // --- 1. Remove session-related imports ---
  src = src.replace(/import\s*\{[^}]*getServerSession[^}]*\}\s*from\s*['"][^'"]+['"];\s*\n?/g, '');
  src = src.replace(/import\s*\{[^}]*\bauth\b[^}]*\}\s*from\s*['"][^'"]+['"];\s*\n?/g, '');
  
  // Remove getApiTenantId import
  src = src.replace(/import\s*\{\s*getApiTenantId\s*\}\s*from\s*['"][^'"]+['"];\s*\n?/g, '');

  // --- 2. Replace session acquisition + guards ---
  // const session = await getServerSession(...); 
  src = src.replace(/\s*const\s+session\s*=\s*await\s+(?:getServerSession|auth)\s*\([^)]*\)\s*;?\s*\n/g, '\n');
  
  // if (!session) { return ... 401 ... }  (multi-line)
  src = src.replace(/\s*if\s*\(\s*!session(?:\.user)?\s*\)\s*\{[^}]*?return[^}]*?(?:401)[^}]*?\}\s*\n?/gs, '\n');

  // --- 3. Replace tenant/user header access ---
  src = src.replace(/getApiTenantId\s*\(\s*request\s*\)/g, 'ctx.tenantId');
  src = src.replace(/request\.headers\.get\s*\(\s*['"]x-tenant-id['"]\s*\)/g, 'ctx.tenantId');
  if (!isPublic) {
    src = src.replace(/request\.headers\.get\s*\(\s*['"]x-user-id['"]\s*\)/g, 'ctx.userId');
  }

  // --- 4. Convert each exported handler ---
  let anyConverted = false;
  
  for (const method of HTTP_METHODS) {
    // Match patterns for exported async functions
    const patterns = [
      // (request: NextRequest): Promise<NextResponse<...>> {
      new RegExp(`(export\\s+async\\s+function\\s+${method})\\s*\\(\\s*(request|_request|req|_req)\\s*:\\s*NextRequest\\s*\\)\\s*(?::\\s*Promise\\s*<\\s*NextResponse\\s*(?:<[^>]*>)?\\s*>\\s*)?\\{`),
      new RegExp(`(export\\s+async\\s+function\\s+${method})\\s*\\(\\s*(request|_request|req|_req)\\s*:\\s*Request\\s*\\)\\s*(?::\\s*Promise\\s*<\\s*NextResponse\\s*(?:<[^>]*>)?\\s*>\\s*)?\\{`),
      // No params: export async function GET(): Promise<NextResponse> {
      new RegExp(`(export\\s+async\\s+function\\s+${method})\\s*\\(\\s*\\)\\s*(?::\\s*Promise\\s*<\\s*NextResponse\\s*(?:<[^>]*>)?\\s*>\\s*)?\\{`),
    ];
    
    for (const pat of patterns) {
      const match = src.match(pat);
      if (!match) continue;
      
      const paramName = match[2] || '_request';
      const startIdx = src.indexOf(match[0]);
      if (startIdx === -1) continue;
      
      // Find matching closing brace
      const bodyStart = startIdx + match[0].length;
      let depth = 1;
      let pos = bodyStart;
      while (pos < src.length && depth > 0) {
        const ch = src[pos];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        // Skip string literals
        if (ch === "'" || ch === '"' || ch === '`') {
          const quote = ch;
          pos++;
          while (pos < src.length) {
            if (src[pos] === '\\') { pos++; }
            else if (src[pos] === quote) break;
            pos++;
          }
        }
        pos++;
      }
      // pos is right after closing }
      
      let body = src.substring(bodyStart, pos - 1);
      
      // Remove outer try-catch
      body = removeOuterTryCatch(body);
      
      // Convert NextResponse.json error responses
      body = convertResponses(body);
      
      // Build new signature
      const hasRequestParam = match[0].includes('request') || match[0].includes('_request');
      let sig;
      if (hasRequestParam) {
        sig = `export const ${method} = ${wrapper}(async (${paramName}: NextRequest, ctx) => {`;
      } else {
        sig = `export const ${method} = ${wrapper}(async (_request: NextRequest, ctx) => {`;
      }
      
      const replacement = sig + body + '});';
      src = src.substring(0, startIdx) + replacement + src.substring(pos);
      anyConverted = true;
      break; // Only first matching pattern per method
    }
  }

  if (!anyConverted) {
    console.log(`SKIP (no handlers matched): ${relPath}`);
    return 'skip';
  }

  // --- 5. Add middleware import after last existing import ---
  const middlewareImport = `import { ${wrapper}, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';`;
  
  const importRegex = /^import\s.+?;$/gm;
  let lastImportEnd = 0;
  let m;
  while ((m = importRegex.exec(src)) !== null) {
    const end = m.index + m[0].length;
    if (end > lastImportEnd) lastImportEnd = end;
  }
  
  if (lastImportEnd > 0) {
    src = src.substring(0, lastImportEnd) + '\n' + middlewareImport + src.substring(lastImportEnd);
  } else {
    src = middlewareImport + '\n' + src;
  }

  // --- 6. Clean up NextResponse import ---
  const usesNextResponse = /\bNextResponse[.\s(]/.test(src.substring(src.indexOf(middlewareImport) + middlewareImport.length));
  const usesNewNextResponse = /new\s+NextResponse/.test(src);
  
  if (!usesNextResponse && !usesNewNextResponse) {
    // Remove NextResponse from combined import
    src = src.replace(
      /import\s*\{\s*NextRequest\s*,\s*NextResponse\s*\}\s*from\s*'next\/server'\s*;/,
      "import { NextRequest } from 'next/server';"
    );
    src = src.replace(
      /import\s*\{\s*NextResponse\s*,\s*NextRequest\s*\}\s*from\s*'next\/server'\s*;/,
      "import { NextRequest } from 'next/server';"
    );
    // Standalone NextResponse import
    src = src.replace(
      /import\s*\{\s*NextResponse\s*\}\s*from\s*'next\/server'\s*;\n?/,
      ''
    );
  }
  
  // Ensure NextRequest import exists (for the handler parameter type)
  if (!src.includes("from 'next/server'") && !src.includes('from "next/server"')) {
    src = "import { NextRequest } from 'next/server';\n" + src;
  }

  // Clean up multiple blank lines
  src = src.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(fullPath, src, 'utf-8');
  console.log(`CONVERTED: ${relPath} [${wrapper}]`);
  return 'converted';
}

function removeOuterTryCatch(body) {
  const trimmed = body.trimStart();
  if (!trimmed.startsWith('try')) return body;
  
  // Check it's try {
  const tryMatch = trimmed.match(/^try\s*\{/);
  if (!tryMatch) return body;
  
  const leadingWhitespace = body.substring(0, body.length - trimmed.length);
  const braceStart = trimmed.indexOf('{');
  let depth = 1;
  let i = braceStart + 1;
  
  while (i < trimmed.length && depth > 0) {
    const ch = trimmed[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      i++;
      while (i < trimmed.length) {
        if (trimmed[i] === '\\') i++;
        else if (trimmed[i] === q) break;
        i++;
      }
    }
    i++;
  }
  
  const tryBodyEnd = i - 1; // index of closing }
  const tryBody = trimmed.substring(braceStart + 1, tryBodyEnd);
  const afterTry = trimmed.substring(i).trim();
  
  if (!afterTry.startsWith('catch')) return body;
  
  // Find catch block end
  const catchBrace = afterTry.indexOf('{');
  if (catchBrace === -1) return body;
  
  depth = 1;
  let ci = catchBrace + 1;
  while (ci < afterTry.length && depth > 0) {
    if (afterTry[ci] === '{') depth++;
    if (afterTry[ci] === '}') depth--;
    if (afterTry[ci] === "'" || afterTry[ci] === '"' || afterTry[ci] === '`') {
      const q = afterTry[ci];
      ci++;
      while (ci < afterTry.length) {
        if (afterTry[ci] === '\\') ci++;
        else if (afterTry[ci] === q) break;
        ci++;
      }
    }
    ci++;
  }
  
  const afterCatch = afterTry.substring(ci).trim();
  
  // Only unwrap if catch is the last thing
  if (afterCatch.length > 3) return body;
  
  // Dedent the try body by one level (2 spaces)
  return dedent(tryBody);
}

function dedent(code) {
  const lines = code.split('\n');
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const m = line.match(/^(\s*)/);
    if (m && m[1].length < minIndent) minIndent = m[1].length;
  }
  if (minIndent === Infinity || minIndent === 0) return code;
  const remove = Math.min(minIndent, 2);
  return lines.map(line => {
    if (line.trim() === '') return '';
    return line.substring(remove);
  }).join('\n');
}

function convertResponses(body) {
  // Convert error responses: NextResponse.json({ error: '...' }, { status: N })
  // Also handles { success: false, error: '...' }
  body = body.replace(
    /NextResponse\.json\s*\(\s*\{\s*(?:success:\s*false\s*,\s*)?error:\s*(['"`])(.*?)\1(?:\s*,\s*\w+:\s*[^}]*)?\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)/g,
    (_match, _q, msg, status) => {
      const code = statusToCode(parseInt(status));
      return `createErrorResponse(ctx, '${code}', '${esc(msg)}', ${status})`;
    }
  );
  
  // Error with template literal: NextResponse.json({ error: `...` }, { status: N })
  body = body.replace(
    /NextResponse\.json\s*\(\s*\{\s*(?:success:\s*false\s*,\s*)?error:\s*(`[^`]*`)\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)/g,
    (_match, msg, status) => {
      const code = statusToCode(parseInt(status));
      return `createErrorResponse(ctx, '${code}', ${msg}, ${status})`;
    }
  );
  
  // Error with variable: NextResponse.json({ error: varName }, { status: N })
  body = body.replace(
    /NextResponse\.json\s*\(\s*\{\s*(?:success:\s*false\s*,\s*)?error:\s*([a-zA-Z_][\w.]*(?:\s*\|\|\s*['"][^'"]*['"])?)\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)/g,
    (_match, errExpr, status) => {
      const code = statusToCode(parseInt(status));
      return `createErrorResponse(ctx, '${code}', ${errExpr.trim()}, ${status})`;
    }
  );
  
  // Error response with object spread / extra fields  
  body = body.replace(
    /NextResponse\.json\s*\(\s*\{(\s*(?:success:\s*false\s*,\s*)?error:\s*(?:'[^']*'|"[^"]*"|`[^`]*`|[^,}\n]+)(?:\s*,\s*(?!status)[^}]+)?)\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\s*\)/g,
    (match, content, status) => {
      // Try to extract just the error message
      const errMatch = content.match(/error:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|([^,}\s][^,}]*))/);
      if (!errMatch) return match;
      const msg = errMatch[1] || errMatch[2] || errMatch[3] || errMatch[4] || 'Error';
      const code = statusToCode(parseInt(status));
      if (errMatch[3] !== undefined) {
        return `createErrorResponse(ctx, '${code}', \`${errMatch[3]}\`, ${status})`;
      }
      if (errMatch[4] !== undefined) {
        return `createErrorResponse(ctx, '${code}', ${errMatch[4].trim()}, ${status})`;
      }
      return `createErrorResponse(ctx, '${code}', '${esc(msg)}', ${status})`;
    }
  );
  
  // Success with status: NextResponse.json({...}, { status: 2xx })
  body = body.replace(
    /NextResponse\.json\s*\((\s*\{[^]*?\})\s*,\s*\{\s*status:\s*(2\d\d)\s*\}\s*\)/g,
    (match, data, status) => {
      // Make sure it's not an error response
      if (/\berror\s*:/.test(data)) return match;
      if (status === '200') {
        return `createSuccessResponse(ctx, ${data.trim()})`;
      }
      return `createSuccessResponse(ctx, ${data.trim()}, { status: ${status} })`;
    }
  );
  
  // Simple success: NextResponse.json({...}) - be careful with greedy matching
  // Use a more targeted approach: find NextResponse.json( and then balance parens
  let result = '';
  let idx = 0;
  while (idx < body.length) {
    const nextCall = body.indexOf('NextResponse.json(', idx);
    if (nextCall === -1) {
      result += body.substring(idx);
      break;
    }
    
    result += body.substring(idx, nextCall);
    
    // Find matching closing paren
    const parenStart = nextCall + 'NextResponse.json('.length;
    let depth = 1;
    let pi = parenStart;
    while (pi < body.length && depth > 0) {
      if (body[pi] === '(') depth++;
      else if (body[pi] === ')') depth--;
      if (body[pi] === "'" || body[pi] === '"' || body[pi] === '`') {
        const q = body[pi];
        pi++;
        while (pi < body.length) {
          if (body[pi] === '\\') pi++;
          else if (body[pi] === q) break;
          pi++;
        }
      }
      pi++;
    }
    // pi is right after closing )
    const fullCall = body.substring(nextCall, pi);
    const args = body.substring(parenStart, pi - 1);
    
    // Check if this has a status option (second arg with status)
    // If it has , { status: ... } we already handled it above
    if (fullCall.includes('createSuccessResponse') || fullCall.includes('createErrorResponse')) {
      result += fullCall;
      idx = pi;
      continue;
    }
    
    // Check if it has error: in the first arg
    const hasError = /^\s*\{[^]*?\berror\s*:/.test(args);
    
    if (hasError) {
      // Leave as-is (should already be converted above, or complex case)
      result += fullCall;
    } else {
      // Success response - convert
      const trimmedArgs = args.trim();
      // Check for { status: ... } second arg
      if (/,\s*\{\s*status:/.test(args)) {
        result += fullCall; // Already handled above
      } else {
        result += `createSuccessResponse(ctx, ${trimmedArgs})`;
      }
    }
    idx = pi;
  }
  body = result;
  
  return body;
}

function statusToCode(status) {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 405: return 'METHOD_NOT_ALLOWED';
    case 409: return 'CONFLICT';
    case 413: return 'PAYLOAD_TOO_LARGE';
    case 422: return 'VALIDATION_ERROR';
    case 429: return 'RATE_LIMITED';
    case 500: return 'INTERNAL_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    default: return status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  }
}

function esc(s) {
  return s.replace(/'/g, "\\'");
}

// === MAIN ===
let converted = 0;
let skipped = 0;
let notFound = 0;

// Only process previously-skipped files
const RETRY_ONLY = [
  'approvals/queue/route.ts',
  'baselines/import/route.ts',
  'contract-sources/metrics/route.ts',
  'extraction/accuracy/route.ts',
  'import/progress/route.ts',
  'import/upload/route.ts',
  'knowledge-graph/route.ts',
  'taxonomy/custom-presets/route.ts',
  'taxonomy/export/route.ts',
  'taxonomy/presets/route.ts',
  'taxonomy/route.ts',
  'taxonomy/upload/route.ts',
];

const routesToProcess = RETRY_ONLY.length > 0 ? RETRY_ONLY : ALL_ROUTES;
for (const route of routesToProcess) {
  const result = convertFile(route);
  if (result === 'converted') converted++;
  else if (result === 'skip') skipped++;
  else if (result === 'notfound') notFound++;
}

console.log('\n========== SUMMARY ==========');
console.log(`Converted: ${converted}`);
console.log(`Skipped:   ${skipped}`);
console.log(`Not found: ${notFound}`);
console.log(`Total:     ${ALL_ROUTES.length}`);
