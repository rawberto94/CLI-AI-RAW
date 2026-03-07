declare module 'utils' {
  export function convertCurrency(amount: number, from: string, to: string): number;
  export function normalizeToDaily(amount: number, uom: string): number;
  export type RoleMapping = { role: string; seniority: string; confidence: number };
  export function mapRoleDetail(raw: string): RoleMapping;
}
