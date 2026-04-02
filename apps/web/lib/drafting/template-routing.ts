import type { TemplateCategory } from '@/types/contract-generation';

export const BLANK_DRAFTING_PATH = '/drafting/copilot?mode=blank';

const VALID_TEMPLATE_CATEGORIES = new Set<TemplateCategory>([
  'MSA',
  'SOW',
  'NDA',
  'AMENDMENT',
  'RENEWAL',
  'ORDER_FORM',
  'SLA',
  'DPA',
  'SUBCONTRACT',
  'CONSULTING',
  'LICENSE',
  'OTHER',
]);

const TEMPLATE_CATEGORY_ALIASES: Record<string, TemplateCategory> = {
  amendment: 'AMENDMENT',
  consulting: 'CONSULTING',
  dpa: 'DPA',
  license: 'LICENSE',
  msa: 'MSA',
  nda: 'NDA',
  orderform: 'ORDER_FORM',
  renewal: 'RENEWAL',
  sla: 'SLA',
  sow: 'SOW',
  statementofwork: 'SOW',
  subcontract: 'SUBCONTRACT',
};

function normalizeTemplateTypeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function coerceTemplateCategory(value?: string | null): TemplateCategory | null {
  if (!value) {
    return null;
  }

  const normalizedValue = normalizeTemplateTypeKey(value);
  const aliasedCategory = TEMPLATE_CATEGORY_ALIASES[normalizedValue];

  if (aliasedCategory) {
    return aliasedCategory;
  }

  const upperCasedValue = value.trim().toUpperCase() as TemplateCategory;
  return VALID_TEMPLATE_CATEGORIES.has(upperCasedValue) ? upperCasedValue : null;
}

export function buildTemplateLibraryPath(templateType?: string | null) {
  const params = new URLSearchParams();
  const category = coerceTemplateCategory(templateType);
  const trimmedTemplateType = templateType?.trim();

  if (category) {
    params.set('category', category);
  } else if (trimmedTemplateType) {
    params.set('search', trimmedTemplateType);
  }

  const query = params.toString();
  return query ? `/generate/templates?${query}` : '/generate/templates';
}