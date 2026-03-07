/**
 * API Persistence Audit
 * Checks which API routes use database vs file storage
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const API_DIR = 'apps/web/app/api';

interface RouteInfo {
  path: string;
  usePrisma: boolean;
  useFileWrite: boolean;
  useFileRead: boolean;
  methods: string[];
  isMock: boolean;
}

function analyzeRoute(filePath: string): RouteInfo | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    const usePrisma = content.includes('prisma.') || content.includes('from "@/lib/prisma"') || content.includes("from '@/lib/prisma'");
    const useFileWrite = content.includes('writeFile') || content.includes('writeFileSync');
    const useFileRead = content.includes('readFile') && content.includes('JSON.parse');
    const isMock = content.includes('getMock') || content.includes('mockData') || 
                   (content.includes('mock') && content.includes('return'));
    
    const methods: string[] = [];
    if (content.includes('export async function GET')) methods.push('GET');
    if (content.includes('export async function POST')) methods.push('POST');
    if (content.includes('export async function PUT')) methods.push('PUT');
    if (content.includes('export async function PATCH')) methods.push('PATCH');
    if (content.includes('export async function DELETE')) methods.push('DELETE');
    
    const relativePath = filePath.replace(process.cwd() + '/', '');
    
    return { path: relativePath, usePrisma, useFileWrite, useFileRead, methods, isMock };
  } catch {
    return null;
  }
}

function walkDir(dir: string, results: RouteInfo[] = []): RouteInfo[] {
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath, results);
      } else if (item === 'route.ts') {
        const info = analyzeRoute(fullPath);
        if (info && info.methods.length > 0) {
          results.push(info);
        }
      }
    }
  } catch {}
  return results;
}

const routes = walkDir(join(process.cwd(), API_DIR));

console.log('============================================================');
console.log('API ROUTE PERSISTENCE AUDIT');
console.log('============================================================\n');

// Find concerning routes (file-based mutations)
const concerning = routes.filter(r => 
  (r.methods.includes('PUT') || r.methods.includes('PATCH') || r.methods.includes('DELETE') || r.methods.includes('POST')) && 
  (r.useFileWrite || r.useFileRead) && 
  !r.usePrisma
);

console.log(`Total API routes: ${routes.length}`);
console.log(`Routes using Prisma: ${routes.filter(r => r.usePrisma).length}`);
console.log(`Routes with file writes: ${routes.filter(r => r.useFileWrite).length}`);
console.log(`Routes with file reads for data: ${routes.filter(r => r.useFileRead).length}`);
console.log(`Mock-only routes: ${routes.filter(r => r.isMock && !r.usePrisma).length}`);
console.log();

if (concerning.length > 0) {
  console.log('⚠️  CONCERNING: Routes with mutations but no Prisma:');
  concerning.forEach(r => {
    console.log(`  - ${r.path}`);
    console.log(`    Methods: ${r.methods.join(', ')}`);
    if (r.useFileWrite) console.log('    ⚠️  Uses file write');
    if (r.useFileRead) console.log('    ⚠️  Uses file read');
  });
} else {
  console.log('✅ All mutation routes use Prisma or are mock-only!');
}

// Show file write routes
const fileWriteRoutes = routes.filter(r => r.useFileWrite);
if (fileWriteRoutes.length > 0) {
  console.log('\n📁 Routes using file writes (may be legitimate for uploads):');
  fileWriteRoutes.forEach(r => {
    const isPrisma = r.usePrisma ? '✅ + Prisma' : '⚠️  No Prisma';
    console.log(`  - ${r.path} ${isPrisma}`);
  });
}

console.log('\n============================================================');
