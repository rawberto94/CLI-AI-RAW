export interface ContractDisplayNameSource {
  contractTitle?: string | null;
  originalName?: string | null;
  fileName?: string | null;
}

export function shouldApplyExtractedContractTitle(existingContract?: ContractDisplayNameSource | null): boolean {
  const hasDisplayedName = Boolean(
    existingContract?.contractTitle?.trim() ||
    existingContract?.originalName?.trim() ||
    existingContract?.fileName?.trim()
  );

  return !hasDisplayedName;
}