#!/usr/bin/env node

/**
 * Accessibility Audit Script
 * 
 * Scans TSX files for common accessibility issues:
 * - Icon-only buttons without aria-label
 * - Images without alt text
 * - Interactive elements without proper labels
 * - Missing form labels
 * 
 * Usage: node scripts/audit-accessibility.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = join(__dirname, '..');
const SCAN_DIRS = ['app', 'components'];
const IGNORE_DIRS = ['node_modules', '.next', 'dist', '__tests__', 'tests'];

// Issue patterns to check
const PATTERNS = [
  {
    name: 'Icon-only button without aria-label',
    pattern: /<Button[^>]*size=["']icon["'][^>]*>[\s\n]*<[\w]+Icon/g,
    fix: 'Add aria-label="Description of action" to the Button',
    severity: 'high',
    validate: (match, content, startIndex) => {
      // Check if aria-label exists before the closing >
      const buttonMatch = content.slice(Math.max(0, startIndex - 200), startIndex + match.length);
      return !buttonMatch.includes('aria-label');
    },
  },
  {
    name: 'Native img tag (should use next/image)',
    pattern: /<img\s+[^>]*>/g,
    fix: 'Use the AccessibleImage component from @/components/ui/accessible-image',
    severity: 'medium',
  },
  {
    name: 'onClick without keyboard handler',
    pattern: /<div[^>]*onClick=[^>]*(?!onKeyDown|onKeyPress|onKeyUp)[^>]*>/g,
    fix: 'Add onKeyDown handler or use a <button> element instead',
    severity: 'medium',
    validate: (match) => {
      // Allow if it has role="button" and keyboard handler
      return !match.includes('role="button"') || !match.includes('onKey');
    },
  },
  {
    name: 'Input without associated label',
    pattern: /<input[^>]*>/g,
    fix: 'Add aria-label or associate with a <label> element',
    severity: 'high',
    validate: (match, content, startIndex) => {
      // Check if input has aria-label or id
      if (match.includes('aria-label')) return false;
      if (match.includes('type="hidden"')) return false;
      if (match.includes('type="submit"')) return false;
      
      // If input has an id, check for matching htmlFor in nearby label
      const idMatch = match.match(/id="([^"]+)"/);
      if (idMatch) {
        const inputId = idMatch[1];
        // Check broader context for label with matching htmlFor
        const context = content.slice(Math.max(0, startIndex - 500), startIndex + 500);
        if (context.includes(`htmlFor="${inputId}"`) || context.includes(`for="${inputId}"`)) {
          return false;
        }
      }
      
      // Check for nearby label wrapping the input
      const context = content.slice(Math.max(0, startIndex - 200), startIndex);
      if (context.includes('<label') && !context.includes('</label>')) {
        return false; // Input is likely inside a label
      }
      
      return true;
    },
  },
  {
    name: 'Image without alt text',
    pattern: /<img[^>]*(?!alt=)[^>]*>/g,
    fix: 'Add alt="description" (use alt="" for decorative images)',
    severity: 'high',
    validate: (match) => !match.includes('alt='),
  },
  {
    name: 'Link without accessible name',
    pattern: /<a[^>]*>\s*<svg|<Link[^>]*>\s*<svg/g,
    fix: 'Add aria-label or include text content',
    severity: 'high',
  },
  {
    name: 'Button type missing',
    pattern: /<button(?!\s+type=)[^>]*>/gi,
    fix: 'Add type="button" or type="submit" to prevent unexpected form submission',
    severity: 'low',
  },
];

// Collect all issues
const issues = [];

function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(ROOT_DIR, filePath);
    
    for (const pattern of PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      
      while ((match = regex.exec(content)) !== null) {
        // Validate if validation function exists
        if (pattern.validate && !pattern.validate(match[0], content, match.index)) {
          continue;
        }
        
        // Get line number
        const lines = content.slice(0, match.index).split('\n');
        const lineNumber = lines.length;
        
        issues.push({
          file: relativePath,
          line: lineNumber,
          issue: pattern.name,
          severity: pattern.severity,
          fix: pattern.fix,
          snippet: match[0].slice(0, 80) + (match[0].length > 80 ? '...' : ''),
        });
      }
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
  }
}

function scanDirectory(dir) {
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry)) {
        scanDirectory(fullPath);
      }
    } else if (entry.endsWith('.tsx') || entry.endsWith('.jsx')) {
      scanFile(fullPath);
    }
  }
}

// Run the audit
console.log('🔍 Starting accessibility audit...\n');

for (const scanDir of SCAN_DIRS) {
  const fullPath = join(ROOT_DIR, scanDir);
  try {
    scanDirectory(fullPath);
  } catch (error) {
    console.error(`Could not scan ${scanDir}:`, error.message);
  }
}

// Report results
if (issues.length === 0) {
  console.log('✅ No accessibility issues found!\n');
} else {
  // Group by severity
  const high = issues.filter(i => i.severity === 'high');
  const medium = issues.filter(i => i.severity === 'medium');
  const low = issues.filter(i => i.severity === 'low');
  
  console.log(`Found ${issues.length} potential accessibility issues:\n`);
  console.log(`  🔴 High: ${high.length}`);
  console.log(`  🟡 Medium: ${medium.length}`);
  console.log(`  🟢 Low: ${low.length}\n`);
  
  // Print high severity issues
  if (high.length > 0) {
    console.log('─'.repeat(60));
    console.log('🔴 HIGH SEVERITY ISSUES');
    console.log('─'.repeat(60));
    
    for (const issue of high) {
      console.log(`\n📄 ${issue.file}:${issue.line}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Fix: ${issue.fix}`);
      console.log(`   Code: ${issue.snippet}`);
    }
  }
  
  // Print medium severity issues
  if (medium.length > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('🟡 MEDIUM SEVERITY ISSUES');
    console.log('─'.repeat(60));
    
    for (const issue of medium) {
      console.log(`\n📄 ${issue.file}:${issue.line}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Fix: ${issue.fix}`);
    }
  }
  
  // Summary of low severity
  if (low.length > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log(`🟢 LOW SEVERITY: ${low.length} issues (use --verbose to see)`);
    console.log('─'.repeat(60));
  }
}

// Exit with error code if high severity issues found
if (issues.filter(i => i.severity === 'high').length > 0) {
  console.log('\n⚠️  Please fix high severity issues before deployment.\n');
  process.exit(1);
}

console.log('\n✅ Audit complete.\n');
