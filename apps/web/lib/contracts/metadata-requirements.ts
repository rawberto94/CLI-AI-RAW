/**
 * Contract-type-aware metadata requirements.
 *
 * Single source of truth for which metadata fields/issues are required for a
 * given contract type. Subtractive model: every base-required field applies
 * unless the contract type explicitly exempts it (e.g. an NDA has no contract
 * value, so `tcv_amount` must not penalize its completeness score).
 *
 * Imported by both server-side scoring (lib/contracts/server/collection.ts)
 * and the detail UI (components/contracts/EnhancedContractMetadataSection.tsx)
 * — keep it free of server-only or client-only dependencies.
 */

export type MetadataIssueKey =
  | 'missing-title'
  | 'missing-party'
  | 'missing-value'
  | 'missing-dates'
  | 'missing-category'
  | 'missing-tags'
  | 'low-confidence';

/**
 * Issue keys that feed the completeness denominator (everything except the
 * orthogonal `low-confidence` signal).
 */
export const BASE_REQUIRED_ISSUE_KEYS: readonly MetadataIssueKey[] = [
  'missing-title',
  'missing-party',
  'missing-value',
  'missing-dates',
  'missing-category',
  'missing-tags',
];

/**
 * Field keys a contract type does NOT require. Keys are canonical
 * CONTRACT_TYPES values (lib/contracts/constants.ts); lookups are
 * case-insensitive and punctuation-tolerant so the two NDA spellings
 * ("NDA" / "Non-Disclosure Agreement") both match.
 */
const TYPE_EXEMPTIONS: Record<string, readonly string[]> = {
  'NDA': ['tcv_amount', 'currency', 'payment_type', 'billing_frequency_type'],
  'Non-Disclosure Agreement': ['tcv_amount', 'currency', 'payment_type', 'billing_frequency_type'],
  'Partnership Agreement': ['tcv_amount', 'currency'],
  // extend as needed; keys must exist in CONTRACT_TYPES
};

/** Maps an exempted metadata field key to the list issue it drives (if any). */
const FIELD_TO_ISSUE: Record<string, MetadataIssueKey> = {
  document_title: 'missing-title',
  external_parties: 'missing-party',
  tcv_amount: 'missing-value',
  start_date: 'missing-dates',
  end_date: 'missing-dates',
};

function normalizeContractType(contractType: string | null | undefined): string {
  return (contractType ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const NORMALIZED_TYPE_EXEMPTIONS: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(TYPE_EXEMPTIONS).map(([type, fields]) => [normalizeContractType(type), fields]),
);

const EMPTY_SET: ReadonlySet<string> = new Set();

/** Exempted field keys for a contract type (empty set for unknown/null types). */
export function exemptionsForType(contractType: string | null | undefined): ReadonlySet<string> {
  const fields = NORMALIZED_TYPE_EXEMPTIONS[normalizeContractType(contractType)];
  return fields ? new Set(fields) : EMPTY_SET;
}

/**
 * Whether a schema-required field is required for this contract type.
 * Fields not listed in the type's exemptions are required (default rule set).
 */
export function isFieldRequired(fieldKey: string, contractType: string | null | undefined): boolean {
  return !exemptionsForType(contractType).has(fieldKey);
}

/**
 * Required issue keys for a contract type — the completeness denominator.
 * Unknown/null types fall back to the full base set.
 */
export function requiredIssueKeysForType(contractType: string | null | undefined): Set<MetadataIssueKey> {
  const exemptions = exemptionsForType(contractType);
  const exemptedIssues = new Set<MetadataIssueKey>();
  for (const fieldKey of exemptions) {
    const issue = FIELD_TO_ISSUE[fieldKey];
    if (issue) exemptedIssues.add(issue);
  }
  return new Set(BASE_REQUIRED_ISSUE_KEYS.filter((key) => !exemptedIssues.has(key)));
}

/**
 * Canonical contract type names that exempt a given issue — used by the list
 * filter (`metadataIssue=missing-value`) to exclude those types in SQL.
 * Stays in sync with scoring because both read TYPE_EXEMPTIONS.
 */
export function contractTypesExemptFromIssue(issueKey: MetadataIssueKey): string[] {
  return Object.entries(TYPE_EXEMPTIONS)
    .filter(([, fields]) => fields.some((field) => FIELD_TO_ISSUE[field] === issueKey))
    .map(([type]) => type);
}
