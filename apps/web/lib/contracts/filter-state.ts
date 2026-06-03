/**
 * Canonical FilterState for the contracts list page.
 * Previously split between useState values and a monolithic object.
 * Now unified into a single source of truth.
 */

export interface FilterState {
  statuses: string[];
  documentRoles: string[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
  valueRange: {
    min: number;
    max: number;
  };
  categories: string[];
  hasDeadline: boolean | null;
  isExpiring: boolean | null;
  riskLevels: string[];
  suppliers: string[];
  clients: string[];
  contractTypes: string[];
  currencies: string[];
  jurisdictions: string[];
  paymentTerms: string[];
  tags: string[];
  metadataIssues: string[];
  relationshipType: string[];
  /** Preset-based value range key (e.g. 'under10k', '10k-50k') */
  valueRangePreset: string | null;
  /** Preset-based date range key (e.g. 'week', 'month', 'quarter') */
  dateRangePreset: string | null;
  /** Expiration bucket filters (e.g. ['expired', 'expiring-30']) */
  expirationFilters: string[];
  /** Signature status filters */
  signatureFilters: string[];
  /** Document classification filters */
  documentTypeFilters: string[];
}

export const DEFAULT_FILTER_STATE: FilterState = {
  statuses: [],
  documentRoles: [],
  dateRange: {},
  valueRange: { min: 0, max: 1000000 },
  categories: [],
  hasDeadline: null,
  isExpiring: null,
  riskLevels: [],
  suppliers: [],
  clients: [],
  contractTypes: [],
  currencies: [],
  jurisdictions: [],
  paymentTerms: [],
  tags: [],
  metadataIssues: [],
  relationshipType: [],
  valueRangePreset: null,
  dateRangePreset: null,
  expirationFilters: [],
  signatureFilters: [],
  documentTypeFilters: [],
};
