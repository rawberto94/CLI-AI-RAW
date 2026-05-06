export const MAX_SEARCHABLE_TEXT_LENGTH = 65535;

export function buildPersistedContractTextFields(rawText: string): {
  rawText: string;
  searchableText: string;
} {
  return {
    rawText,
    searchableText: rawText.slice(0, MAX_SEARCHABLE_TEXT_LENGTH),
  };
}