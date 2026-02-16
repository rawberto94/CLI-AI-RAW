/**
 * Table View Configuration
 */

export interface TableColumn {
  id: string
  label: string
  key: string
  width?: string
  sortable?: boolean
  visible?: boolean
  editable?: boolean
  format?: (value: any) => string
}

export const DEFAULT_COLUMNS: TableColumn[] = [
  {
    id: 'name',
    label: 'Contract Name',
    key: 'filename',
    width: '300px',
    sortable: true,
    visible: true,
    editable: true,
  },
  {
    id: 'status',
    label: 'Status',
    key: 'status',
    width: '120px',
    sortable: true,
    visible: true,
    editable: false,
  },
  {
    id: 'value',
    label: 'Value',
    key: 'extractedData.financial.totalValue',
    width: '150px',
    sortable: true,
    visible: true,
    editable: false,
  },
  {
    id: 'date',
    label: 'Upload Date',
    key: 'uploadDate',
    width: '150px',
    sortable: true,
    visible: true,
    editable: false,
  },
  {
    id: 'parties',
    label: 'Parties',
    key: 'extractedData.metadata.parties',
    width: '200px',
    sortable: false,
    visible: true,
    editable: false,
  },
  {
    id: 'risk',
    label: 'Risk Score',
    key: 'extractedData.risk.overallScore',
    width: '120px',
    sortable: true,
    visible: false,
    editable: false,
  },
  {
    id: 'compliance',
    label: 'Compliance',
    key: 'extractedData.compliance.score',
    width: '120px',
    sortable: true,
    visible: false,
    editable: false,
  },
  {
    id: 'type',
    label: 'Type',
    key: 'extractedData.metadata.contractType',
    width: '180px',
    sortable: true,
    visible: false,
    editable: false,
  },
  {
    id: 'size',
    label: 'File Size',
    key: 'fileSize',
    width: '100px',
    sortable: true,
    visible: false,
    editable: false,
  },
]

export function getNestedValue(obj: any, path: string): any {
  const value = path.split('.').reduce((current, key) => current?.[key], obj)
  // Unwrap potentially wrapped AI values
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value
  }
  return value
}

export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.')
  const lastKey = keys.pop()!
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {}
    return current[key]
  }, obj)
  target[lastKey] = value
}
