/**
 * Public document number helpers.
 * Contract.id stays a cuid; document_number is the human-facing identifier.
 */

export function documentNumberFromFileName(fileName: string | null | undefined): string {
  if (!fileName) return '';
  const base = fileName.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '');
  return base
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

export function isOpaqueDocumentNumber(value: string | null | undefined, contractId?: string | null): boolean {
  if (!value) return true;
  if (contractId && value === contractId) return true;
  // Prisma cuid() — not a realistic contract ID for users.
  return /^c[a-z0-9]{20,}$/i.test(value);
}

export function resolveDocumentNumber(options: {
  extracted?: string | null;
  existing?: string | null;
  fileName?: string | null;
  contractId?: string | null;
}): string {
  const extracted = options.extracted?.trim();
  if (extracted && !isOpaqueDocumentNumber(extracted, options.contractId)) {
    return extracted;
  }
  const existing = options.existing?.trim();
  if (existing && !isOpaqueDocumentNumber(existing, options.contractId)) {
    return existing;
  }
  return documentNumberFromFileName(options.fileName) || '';
}
