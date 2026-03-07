/**
 * Chatbot Constants
 * Shared constants for the chatbot system
 */

// Contract type mappings for natural language
export const CONTRACT_TYPE_ALIASES: Record<string, string> = {
  'sow': 'SOW',
  'statement of work': 'SOW',
  'msa': 'MSA',
  'master agreement': 'MSA',
  'master service agreement': 'MSA',
  'master services agreement': 'MSA',
  'amendment': 'AMENDMENT',
  'addendum': 'ADDENDUM',
  'change order': 'CHANGE_ORDER',
  'co': 'CHANGE_ORDER',
  'nda': 'NDA',
  'non-disclosure': 'NDA',
  'non disclosure': 'NDA',
  'confidentiality agreement': 'NDA',
  'service agreement': 'SERVICE_AGREEMENT',
  'sa': 'SERVICE_AGREEMENT',
  'purchase order': 'PURCHASE_ORDER',
  'po': 'PURCHASE_ORDER',
  'work order': 'WORK_ORDER',
  'wo': 'WORK_ORDER',
};

// Status mappings for natural language
export const STATUS_ALIASES: Record<string, string> = {
  'draft': 'DRAFT',
  'pending': 'PENDING',
  'under review': 'UNDER_REVIEW',
  'reviewing': 'UNDER_REVIEW',
  'active': 'ACTIVE',
  'expired': 'EXPIRED',
  'expiring': 'EXPIRING_SOON',
  'expiring soon': 'EXPIRING_SOON',
  'terminated': 'TERMINATED',
  'renewed': 'RENEWED',
  'on hold': 'ON_HOLD',
};

// Risk level mappings
export const RISK_LEVEL_ALIASES: Record<string, string> = {
  'high': 'HIGH',
  'medium': 'MEDIUM',
  'low': 'LOW',
  'critical': 'CRITICAL',
  'minimal': 'MINIMAL',
};

// Time period mappings
export const TIME_PERIOD_ALIASES: Record<string, string> = {
  'today': 'TODAY',
  'this week': 'THIS_WEEK',
  'this month': 'THIS_MONTH',
  'this quarter': 'THIS_QUARTER',
  'this year': 'THIS_YEAR',
  'last week': 'LAST_WEEK',
  'last month': 'LAST_MONTH',
  'last quarter': 'LAST_QUARTER',
  'last year': 'LAST_YEAR',
  'q1': 'Q1',
  'q2': 'Q2',
  'q3': 'Q3',
  'q4': 'Q4',
  '2024': '2024',
  '2023': '2023',
  '2022': '2022',
};
