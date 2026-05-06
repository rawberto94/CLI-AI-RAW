import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Minimal "general business" taxonomy auto-seeded the first time we try to
 * categorize a contract for a tenant that has no `TaxonomyCategory` rows yet.
 * Mirrors `PRESET_TAXONOMIES.general` in `app/api/taxonomy/presets/route.ts`
 * but kept inline here to avoid pulling that route's other deps into the
 * artifact-generator code path. Tenants can override via Settings → Taxonomy.
 */
const DEFAULT_TAXONOMY: Array<{
  name: string;
  description: string;
  icon: string;
  color: string;
  keywords: string[];
  aiClassificationPrompt: string;
  children?: Array<{
    name: string;
    keywords: string[];
    aiClassificationPrompt: string;
  }>;
}> = [
  {
    name: 'Services',
    description: 'Service agreements and consulting contracts',
    icon: 'briefcase',
    color: '#3B82F6',
    keywords: ['service', 'consulting', 'advisory', 'professional services', 'sow', 'statement of work'],
    aiClassificationPrompt: 'Contracts for professional services, consulting, statements of work, or advisory work',
    children: [
      { name: 'Consulting', keywords: ['consultant', 'consulting', 'advisory'], aiClassificationPrompt: 'Consulting and advisory service contracts' },
      { name: 'Managed Services', keywords: ['managed service', 'outsourcing', 'maintenance'], aiClassificationPrompt: 'Ongoing managed service agreements' },
      { name: 'Statement of Work', keywords: ['sow', 'statement of work', 'work order', 'engagement'], aiClassificationPrompt: 'Statements of work and engagement letters' },
    ],
  },
  {
    name: 'Software & Technology',
    description: 'Software licenses and technology agreements',
    icon: 'lightning',
    color: '#8B5CF6',
    keywords: ['software', 'license', 'saas', 'technology', 'platform', 'subscription'],
    aiClassificationPrompt: 'Software licensing, SaaS, and technology contracts',
    children: [
      { name: 'SaaS Subscriptions', keywords: ['saas', 'subscription', 'cloud', 'hosted'], aiClassificationPrompt: 'Cloud-based software subscriptions' },
      { name: 'Software Licenses', keywords: ['license', 'perpetual', 'software license'], aiClassificationPrompt: 'Traditional software licensing agreements' },
      { name: 'Data Processing', keywords: ['dpa', 'data processing', 'gdpr'], aiClassificationPrompt: 'Data processing agreements' },
    ],
  },
  {
    name: 'Purchasing',
    description: 'Goods and equipment purchases',
    icon: 'document',
    color: '#10B981',
    keywords: ['purchase', 'buy', 'procurement', 'equipment', 'goods', 'supply'],
    aiClassificationPrompt: 'Contracts for purchasing goods, equipment, or materials',
  },
  {
    name: 'Legal',
    description: 'Legal and compliance agreements',
    icon: 'shield',
    color: '#EF4444',
    keywords: ['legal', 'nda', 'confidentiality', 'non-disclosure'],
    aiClassificationPrompt: 'Legal agreements including NDAs and confidentiality',
    children: [
      { name: 'NDA', keywords: ['nda', 'non-disclosure', 'confidentiality'], aiClassificationPrompt: 'Non-disclosure and confidentiality agreements' },
      { name: 'Compliance', keywords: ['compliance', 'regulatory', 'gdpr', 'sox', 'iso'], aiClassificationPrompt: 'Compliance and regulatory agreements' },
    ],
  },
  {
    name: 'Real Estate',
    description: 'Leases and property agreements',
    icon: 'building',
    color: '#F59E0B',
    keywords: ['lease', 'rent', 'property', 'real estate', 'office', 'tenant'],
    aiClassificationPrompt: 'Real estate leases and property agreements',
  },
  {
    name: 'HR & Employment',
    description: 'Employment, contractor, and HR agreements',
    icon: 'users',
    color: '#EC4899',
    keywords: ['employment', 'contractor', 'staffing', 'offer letter', 'hr'],
    aiClassificationPrompt: 'Employment, contractor, and HR-related agreements',
  },
  {
    name: 'Other',
    description: 'Uncategorized contracts',
    icon: 'folder',
    color: '#6B7280',
    keywords: [],
    aiClassificationPrompt: 'Generic catch-all for contracts that do not fit other categories',
  },
];

// In-process guard so a multi-upload burst does not race on the same tenant.
const inFlight = new Map<string, Promise<void>>();

/**
 * Ensure the given tenant has at least one TaxonomyCategory row. If it has
 * none, seed the default "general business" tree. Idempotent and safe to call
 * before every categorization attempt — the count check is cheap and the seed
 * runs at most once per tenant.
 */
export async function ensureTenantTaxonomy(tenantId: string): Promise<void> {
  if (!tenantId) return;
  const existing = inFlight.get(tenantId);
  if (existing) return existing;

  const work = (async () => {
    try {
      const count = await prisma.taxonomyCategory.count({ where: { tenantId } });
      if (count > 0) return;

      logger.info('Seeding default taxonomy for tenant', { tenantId });
      let sortOrder = 0;
      for (const cat of DEFAULT_TAXONOMY) {
        // Idempotent on the (tenantId, name) unique key — if a parallel
        // request just inserted the same parent, skip and reuse it.
        const parent = await prisma.taxonomyCategory.upsert({
          where: { tenantId_name: { tenantId, name: cat.name } },
          create: {
            tenantId,
            name: cat.name,
            description: cat.description,
            icon: cat.icon,
            color: cat.color,
            level: 0,
            path: `/${cat.name}`,
            sortOrder: sortOrder++,
            keywords: cat.keywords,
            aiClassificationPrompt: cat.aiClassificationPrompt,
            isActive: true,
          },
          update: {},
        });

        if (cat.children) {
          for (let i = 0; i < cat.children.length; i++) {
            const child = cat.children[i];
            if (!child) continue;
            await prisma.taxonomyCategory.upsert({
              where: { tenantId_name: { tenantId, name: child.name } },
              create: {
                tenantId,
                name: child.name,
                description: null,
                icon: cat.icon,
                color: cat.color,
                level: 1,
                path: `/${cat.name}/${child.name}`,
                parentId: parent.id,
                sortOrder: i,
                keywords: child.keywords,
                aiClassificationPrompt: child.aiClassificationPrompt,
                isActive: true,
              },
              update: {},
            });
          }
        }
      }
      logger.info('Default taxonomy seeded', { tenantId, categoriesSeeded: DEFAULT_TAXONOMY.length });
    } catch (err) {
      // Non-fatal: categorization will simply skip if seeding races.
      logger.warn('ensureTenantTaxonomy failed (non-fatal)', { tenantId, err: err instanceof Error ? err.message : String(err) });
    } finally {
      inFlight.delete(tenantId);
    }
  })();

  inFlight.set(tenantId, work);
  return work;
}
