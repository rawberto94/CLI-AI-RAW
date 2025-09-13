declare module 'schemas' {
  import { z } from 'zod';
  export const DocumentTypeEnum: z.ZodEnum<["MSA","SOW","Secondment","LOI","LOE","Addendum","Unknown"]>;
  export const ProfessionalServicesOverviewV1Schema: z.ZodTypeAny;
  export const KeyClauseMatrixV1Schema: z.ZodTypeAny;
  export const InteractiveAnalysisV1Schema: z.ZodTypeAny;
  export const IntelligenceBundleV1Schema: z.ZodTypeAny;
}
