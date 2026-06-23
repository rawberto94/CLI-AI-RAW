import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export interface TenantTagEntry {
  name: string;
  color?: string;
  description?: string;
  createdAt?: string;
  createdBy?: string;
}

const DEFAULT_TAG_COLOR = '#8B5CF6';

export function normalizeTagName(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().toLowerCase();
}

export function normalizeTagArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of input) {
    const value = normalizeTagName(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

function toSlug(name: string): string {
  return normalizeTagName(name).replace(/\s+/g, '-');
}

function parseTagEntry(input: unknown): TenantTagEntry | null {
  if (typeof input === 'string') {
    const name = normalizeTagName(input);
    if (!name) return null;
    return { name, color: DEFAULT_TAG_COLOR, description: '' };
  }

  if (!input || typeof input !== 'object') return null;

  const candidate = input as Record<string, unknown>;
  const name = normalizeTagName(candidate.name);
  if (!name) return null;

  return {
    name,
    color: typeof candidate.color === 'string' && candidate.color.trim().length > 0
      ? candidate.color.trim()
      : DEFAULT_TAG_COLOR,
    description: typeof candidate.description === 'string' ? candidate.description.trim() : '',
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
    createdBy: typeof candidate.createdBy === 'string' ? candidate.createdBy : undefined,
  };
}

async function getTenantSettingsRecord(tenantId: string) {
  let record = await prisma.tenantSettings.findFirst({
    where: { tenantId },
    select: { id: true, customFields: true },
  });

  if (!record) {
    record = await prisma.tenantSettings.create({
      data: {
        tenantId,
        customFields: { predefinedTags: [] },
      },
      select: { id: true, customFields: true },
    });
  }

  return record;
}

async function listTenantTagRows(tenantId: string) {
  try {
    return await prisma.tenantTag.findMany({
      where: { tenantId },
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
    });
  } catch {
    // Legacy mode: table may not exist yet in all environments.
    return null;
  }
}

export async function getTenantTagRegistry(tenantId: string): Promise<Map<string, TenantTagEntry>> {
  const tenantTagRows = await listTenantTagRows(tenantId);
  if (tenantTagRows && tenantTagRows.length > 0) {
    const registry = new Map<string, TenantTagEntry>();
    for (const row of tenantTagRows) {
      registry.set(normalizeTagName(row.name), {
        name: normalizeTagName(row.name),
        color: row.color,
        description: row.description || '',
        createdAt: row.createdAt.toISOString(),
        createdBy: row.createdBy || undefined,
      });
    }
    return registry;
  }

  const tenantSettings = await prisma.tenantSettings.findFirst({
    where: { tenantId },
    select: { customFields: true },
  });

  const customFields = (tenantSettings?.customFields as Record<string, unknown>) || {};
  const raw = Array.isArray(customFields.predefinedTags)
    ? customFields.predefinedTags
    : [];

  const registry = new Map<string, TenantTagEntry>();
  for (const item of raw) {
    const parsed = parseTagEntry(item);
    if (!parsed) continue;
    registry.set(parsed.name, parsed);
  }

  return registry;
}

export async function getTenantTagNameSet(tenantId: string): Promise<Set<string>> {
  return new Set((await getTenantTagRegistry(tenantId)).keys());
}

export async function upsertTenantTags(
  tenantId: string,
  tags: Array<string | TenantTagEntry>,
  options?: { createdBy?: string },
): Promise<TenantTagEntry[]> {
  const incomingEntries = tags
    .map((entry) => parseTagEntry(entry))
    .filter((entry): entry is TenantTagEntry => Boolean(entry));

  if (incomingEntries.length === 0) return [];

  try {
    const now = new Date();
    for (const entry of incomingEntries) {
      const slug = toSlug(entry.name);
      await prisma.tenantTag.upsert({
        where: {
          tenantId_slug: {
            tenantId,
            slug,
          },
        },
        create: {
          tenantId,
          name: entry.name,
          slug,
          color: entry.color || DEFAULT_TAG_COLOR,
          description: entry.description || '',
          category: null,
          isSystem: false,
          createdBy: entry.createdBy || options?.createdBy,
          createdAt: entry.createdAt ? new Date(entry.createdAt) : now,
        },
        update: {
          name: entry.name,
          color: entry.color || DEFAULT_TAG_COLOR,
          description: entry.description ?? '',
          updatedAt: now,
        },
      });
    }

    const persisted = await prisma.tenantTag.findMany({
      where: {
        tenantId,
        slug: { in: incomingEntries.map((entry) => toSlug(entry.name)) },
      },
    });

    return persisted.map((row) => ({
      name: normalizeTagName(row.name),
      color: row.color,
      description: row.description || '',
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy || undefined,
    }));
  } catch {
    // Legacy fallback while rolling migrations.
    const tenantSettings = await getTenantSettingsRecord(tenantId);
    const customFields = (tenantSettings.customFields as Record<string, unknown>) || {};
    const existingRaw = Array.isArray(customFields.predefinedTags)
      ? customFields.predefinedTags
      : [];

    const merged = new Map<string, TenantTagEntry>();
    for (const item of existingRaw) {
      const parsed = parseTagEntry(item);
      if (!parsed) continue;
      merged.set(parsed.name, parsed);
    }

    const nowIso = new Date().toISOString();
    for (const entry of incomingEntries) {
      const existing = merged.get(entry.name);
      merged.set(entry.name, {
        ...existing,
        ...entry,
        name: entry.name,
        createdAt: existing?.createdAt || entry.createdAt || nowIso,
        createdBy: existing?.createdBy || entry.createdBy || options?.createdBy,
        color: entry.color || existing?.color || DEFAULT_TAG_COLOR,
        description: entry.description ?? existing?.description ?? '',
      });
    }

    const predefinedTags = Array.from(merged.values());

    await prisma.tenantSettings.update({
      where: { id: tenantSettings.id },
      data: {
        customFields: {
          ...customFields,
          predefinedTags,
        } as Prisma.InputJsonValue,
      },
    });

    return incomingEntries.map((entry) => merged.get(entry.name)!).filter(Boolean);
  }
}

export async function deleteTenantTag(tenantId: string, tagName: string): Promise<boolean> {
  const normalizedName = normalizeTagName(tagName);
  if (!normalizedName) return false;

  try {
    const deleted = await prisma.tenantTag.deleteMany({
      where: {
        tenantId,
        OR: [{ slug: toSlug(normalizedName) }, { name: normalizedName }],
      },
    });
    if (deleted.count > 0) return true;
  } catch {
    // Legacy fallback below.
  }

  const tenantSettings = await prisma.tenantSettings.findFirst({
    where: { tenantId },
    select: { id: true, customFields: true },
  });
  if (!tenantSettings) return false;

  const customFields = (tenantSettings.customFields as Record<string, unknown>) || {};
  const existingRaw = Array.isArray(customFields.predefinedTags)
    ? customFields.predefinedTags
    : [];

  const kept: TenantTagEntry[] = [];
  let removed = false;

  for (const item of existingRaw) {
    const parsed = parseTagEntry(item);
    if (!parsed) continue;
    if (parsed.name === normalizedName) {
      removed = true;
      continue;
    }
    kept.push(parsed);
  }

  if (!removed) return false;

  await prisma.tenantSettings.update({
    where: { id: tenantSettings.id },
    data: {
      customFields: {
        ...customFields,
        predefinedTags: kept,
      } as Prisma.InputJsonValue,
    },
  });

  return true;
}

export async function validateOrRegisterTenantTags(
  tenantId: string,
  input: unknown,
  options?: { createdBy?: string },
): Promise<string[]> {
  const tags = normalizeTagArray(input);
  if (tags.length === 0) return [];

  const knownTags = await getTenantTagNameSet(tenantId);
  const unknown = tags.filter((tag) => !knownTags.has(tag));

  if (unknown.length > 0) {
    await upsertTenantTags(
      tenantId,
      unknown.map((name) => ({ name })),
      { createdBy: options?.createdBy },
    );
  }

  return tags;
}
