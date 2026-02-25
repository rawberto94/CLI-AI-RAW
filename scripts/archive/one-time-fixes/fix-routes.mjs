#!/usr/bin/env node
/**
 * Fix-up script: Add tenantId/userId aliases and clean remaining session refs
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const BASE = '/workspaces/CLI-AI-RAW/apps/web/app/api';
const DIRS = ['ai', 'agents', 'copilot', 'chat', 'rag'];

const files = execSync(
  `find ${DIRS.map(d => `${BASE}/${d}`).join(' ')} -name "route.ts" 2>/dev/null`
).toString().trim().split('\n').filter(Boolean).sort();

let fixed = 0;

for (const filePath of files) {
  const rel = filePath.replace(`${BASE}/`, '');
  let src = readFileSync(filePath, 'utf-8');
  let changed = false;
  
  // Check if file has bare tenantId usage (not preceded by . or ctx.)
  // We look for tenantId used as a variable, not as a property key (tenantId:) or property access (.tenantId)
  const hasBaretenantId = hasBareVariable(src, 'tenantId');
  const hasBareUserId = hasBareVariable(src, 'userId');
  
  if (!hasBaretenantId && !hasBareUserId) continue;
  
  console.log(`FIX: ${rel} (tenantId=${hasBaretenantId}, userId=${hasBareUserId})`);
  
  // For static routes (withAuthApiHandler), add aliases after the arrow function opening
  // Pattern: withAuthApiHandler(async (request, ctx) => {\n
  // For dynamic routes (getApiContext), add after const ctx = getApiContext(request);
  
  const isDynamic = filePath.includes('[');
  
  if (isDynamic) {
    // Dynamic: add after each getApiContext line
    if (hasBaretenantId) {
      src = src.replace(
        /(const ctx = getApiContext\(request\);)/g,
        (match) => {
          let result = match;
          if (hasBaretenantId) result += '\n  const tenantId = ctx.tenantId;';
          if (hasBareUserId) result += '\n  const userId = ctx.userId;';
          return result;
        }
      );
      changed = true;
    }
  } else {
    // Static: add aliases inside each withAuthApiHandler wrapper
    // Find all: withAuthApiHandler(async (request|_request, ctx) => {
    const handlerPattern = /withAuthApiHandler\(async \((?:request|_request), ctx\) => \{/g;
    let match;
    const insertions = [];
    
    while ((match = handlerPattern.exec(src)) !== null) {
      const insertPos = match.index + match[0].length;
      
      // Find the matching closing of this handler to check if tenantId/userId is used in THIS handler
      const handlerEnd = findHandlerEnd(src, insertPos);
      const handlerBody = src.substring(insertPos, handlerEnd);
      
      const needsTenantAlias = hasBareVariable(handlerBody, 'tenantId');
      const needsUserAlias = hasBareVariable(handlerBody, 'userId');
      
      if (needsTenantAlias || needsUserAlias) {
        let alias = '';
        if (needsTenantAlias) alias += '\n  const tenantId = ctx.tenantId;';
        if (needsUserAlias) alias += '\n  const userId = ctx.userId;';
        insertions.push({ pos: insertPos, text: alias });
      }
    }
    
    // Apply insertions in reverse order to maintain positions
    for (let i = insertions.length - 1; i >= 0; i--) {
      const { pos, text } = insertions[i];
      src = src.substring(0, pos) + text + src.substring(pos);
      changed = true;
    }
  }
  
  // Clean up remaining session references
  // Remove: const session = await getServerSession();
  // and any associated auth guard that's redundant with the wrapper
  src = cleanRemainingSessionRefs(src);
  
  if (changed || src !== readFileSync(filePath, 'utf-8')) {
    writeFileSync(filePath, src);
    fixed++;
  }
}

console.log(`\nFixed ${fixed} files.`);

function hasBareVariable(code, varName) {
  // Match varName used as a standalone variable, not as:
  // - property access (.varName)
  // - property key (varName:) -- but allow shorthand: { tenantId } or { tenantId,
  // - part of ctx.varName
  // - in comments
  // - in import lines
  // - declaration (const varName =)
  
  const lines = code.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import')) continue;
    if (trimmed.startsWith(`const ${varName} = ctx.`)) continue;
    
    // Check for bare variable usage patterns:
    // - function call: someFunc(tenantId, ...)
    // - object shorthand: { tenantId } or { tenantId, ... }
    // - object value: { key: tenantId }
    // - standalone: tenantId (in expressions)
    
    const re = new RegExp(`(?<![.])\\b${varName}\\b(?!\\s*[:=])`, 'g');
    const matches = line.match(re);
    if (matches) {
      // Check it's not .tenantId or ctx.tenantId
      const dotRe = new RegExp(`\\.${varName}\\b`, 'g');
      const dotCount = (line.match(dotRe) || []).length;
      const ctxRe = new RegExp(`ctx\\.${varName}\\b`, 'g');
      const ctxCount = (line.match(ctxRe) || []).length;
      
      if (matches.length > dotCount + ctxCount) {
        return true;
      }
    }
  }
  return false;
}

function findHandlerEnd(src, startPos) {
  // Find the end of this handler (});)
  let depth = 1; // We're inside the first {
  let inStr = false, strCh = '';
  for (let i = startPos; i < src.length; i++) {
    const c = src[i], p = i > 0 ? src[i-1] : '';
    if (inStr) { if (c === strCh && p !== '\\') inStr = false; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = true; strCh = c; continue; }
    if (c === '/' && src[i+1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i+1] === '*') { i = src.indexOf('*/', i+2); if (i < 0) break; i++; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return src.length;
}

function cleanRemainingSessionRefs(src) {
  // Remove remaining: const session = await getServerSession(); + guard
  src = src.replace(
    /\s*const session = await getServerSession\(\);?\s*\n\s*if\s*\(!session(?:\?\.user)?(?:\?\.id)?\)\s*\{\s*\n(?:\s*.*\n)*?\s*\}\s*\n/g,
    '\n'
  );
  src = src.replace(
    /\s*const session = await getServerSession\(\);?\s*\n\s*if\s*\(!session(?:\?\.user)?(?:\?\.id)?\)\s*\{[^}]+\}\s*\n/g,
    '\n'
  );
  
  // Remove bare session declarations if session is no longer used
  const withoutDecl = src.replace(/const session = await getServerSession\(\);?/g, '');
  if (!/\bsession\b/.test(withoutDecl.replace(/getServerSession/g, '').replace(/import.*auth/g, ''))) {
    src = src.replace(/\s*const session = await getServerSession\(\);?\s*\n/g, '\n');
  }
  
  // Remove getServerSession import if no longer used
  if (!/getServerSession\s*\(/.test(src)) {
    src = src.replace(/import\s*\{\s*getServerSession\s*\}\s*from\s*['"]@\/lib\/auth['"];?\s*\n?/g, '');
    // From combined imports
    src = src.replace(/(import\s*\{[^}]*)(?:,\s*)?getServerSession(?:\s*,)?([^}]*\}\s*from\s*['"]@\/lib\/auth['"];?)/g, (m, before, after) => {
      let r = before + after;
      r = r.replace(/\{\s*,/, '{').replace(/,\s*\}/, ' }').replace(/,\s*,/, ',');
      if (/import\s*\{\s*\}\s*from/.test(r)) return '';
      return r;
    });
    src = src.replace(/import\s*\{\s*\}\s*from\s*['"]@\/lib\/auth['"];?\s*\n?/g, '');
  }
  
  // Remove remaining redundant auth guard inside withAuthApiHandler
  // if (!ctx.tenantId) { return createErrorResponse(...UNAUTHORIZED...) }
  src = src.replace(
    /\s*\/\/ Authentication check\s*\n/g,
    '\n'
  );
  src = src.replace(
    /\s*if\s*\(!ctx\.tenantId\)\s*\{\s*\n\s*return createErrorResponse\(ctx,\s*'UNAUTHORIZED'[^}]+\}\s*\n/g,
    '\n'
  );
  
  return src;
}
