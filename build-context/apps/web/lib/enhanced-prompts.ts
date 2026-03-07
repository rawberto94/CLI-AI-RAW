
// Stub function for real examples (original file was removed during cleanup)
function getRealExamples(_type: string, _count: number): Array<{ input: string; output: unknown }> {
  return [];
}

export type EnhancedPromptConfig = {
  systemPrompt: string;
  userPrompt: (text: string, extra?: string) => string;
  temperature: number;
};

type ValidationResult = {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
};

function jsonSchemaRequirement(name: string, schema: string) {
  return `RETURN JSON OBJECT with keys: ${name}. Schema: ${schema}. Respond ONLY with the JSON object.`;
}

export function getEnhancedPrompt(type: string): EnhancedPromptConfig | null {
  // Get real contract examples for this artifact type
  const realExamples = getRealExamples(type, 1);
  const firstExample = realExamples[0];
  const realExampleText = realExamples.length > 0 && firstExample
    ? `\n\nREAL CONTRACT EXAMPLE:\nInput: ${firstExample.input}\nExpected Output: ${JSON.stringify(firstExample.output, null, 2)}\n`
    : '';

  const fewShotOverview = `
Example (OVERVIEW):
{
  "summary": "Short summary sentence.",
  "contractType": "Statement of Work",
  "parties": [{ "role": "Supplier", "name": "ACME Corp" }],
  "effectiveDate": "2025-01-01",
  "expirationDate": "2026-01-01",
  "confidenceScore": 0.93
}${realExampleText}
`;

  switch (type) {
    case 'OVERVIEW':
      return {
        systemPrompt:
          'You are a contract analysis assistant. Extract a concise structured overview from the contract text. Prefer accuracy over verbosity. If uncertain, include nulls and explain in the confidence field.',
        userPrompt: (text: string, extra = '') => {
          const schema = '{summary: string, contractType: string|null, parties: [{role:string,name:string}] , effectiveDate: string|null, expirationDate: string|null, confidenceScore: number}';
          return `${fewShotOverview}\nCONTRACT_TEXT:\n${text}\n\n${jsonSchemaRequirement('overview', schema)} ${extra}`;
        },
        temperature: 0.0,
      };

    case 'CLAUSES':
      return {
        systemPrompt:
          'You are a contract clause extractor. Identify key clauses, give clause name, short extract (one sentence), and relevance score 0-1. Provide sources (page or snippet indices) if available.',
        userPrompt: (text: string, extra = '') => {
          const schema = '{clauses: [{name:string, excerpt:string, relevance:number, location?:string}] }';
          return `CONTRACT_TEXT:\n${text}\n\n${jsonSchemaRequirement('clauses', schema)} ${extra}`;
        },
        temperature: 0.0,
      };

    case 'FINANCIAL':
      return {
        systemPrompt:
          'You are a financial extraction assistant. Extract monetary values, currencies, payment terms, totals, and any obligations. Where numbers are ambiguous, provide best-guess and a confidence field.',
        userPrompt: (text: string, extra = '') => {
          const schema = '{currency:string|null, totalValue:number|null, paymentTerms:[string], paymentSchedule:[{milestone:string, amount:number|null}], confidenceScore:number}';
          return `CONTRACT_TEXT:\n${text}\n\n${jsonSchemaRequirement('financial', schema)} ${extra}`;
        },
        temperature: 0.0,
      };

    case 'RISK':
      return {
        systemPrompt:
          'You are a risk analysis assistant. Identify potential risks, severity (low/medium/high), suggested mitigations, and a short rationale.',
        userPrompt: (text: string, extra = '') => {
          const schema = '{risks:[{title:string, severity:string, mitigation:string, rationale:string}], confidenceScore:number}';
          return `CONTRACT_TEXT:\n${text}\n\n${jsonSchemaRequirement('risk', schema)} ${extra}`;
        },
        temperature: 0.0,
      };

    case 'COMPLIANCE':
      return {
        systemPrompt:
          'You are a compliance extraction assistant. Identify regulatory clauses, requirements, and whether the contract meets common standards (GDPR, PCI, SOC2) with explanations.',
        userPrompt: (text: string, extra = '') => {
          const schema = '{compliance:[{standard:string, present:boolean, excerpt?:string, notes?:string}], summary:string, confidenceScore:number}';
          return `CONTRACT_TEXT:\n${text}\n\n${jsonSchemaRequirement('compliance', schema)} ${extra}`;
        },
        temperature: 0.0,
      };

    default:
      return null;
  }
}

export function validateExtractedData(type: string, data: any): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];

  if (!data) {
    errors.push({ field: 'data', message: 'No data returned from model' });
    return { isValid: false, errors, warnings };
  }

  try {
    switch (type) {
      case 'OVERVIEW':
        if (!data.summary) errors.push({ field: 'summary', message: 'Missing summary' });
        break;
      case 'CLAUSES':
        if (!Array.isArray(data.clauses)) errors.push({ field: 'clauses', message: 'clauses should be an array' });
        break;
      case 'FINANCIAL':
        // Accept missing totals but warn
        if (!data.currency && !data.totalValue) warnings.push({ field: 'financial', message: 'Missing currency/totalValue' });
        break;
      case 'RISK':
        if (!Array.isArray(data.risks)) warnings.push({ field: 'risks', message: 'Expected risks array' });
        break;
      case 'COMPLIANCE':
        if (!Array.isArray(data.compliance)) warnings.push({ field: 'compliance', message: 'Expected compliance array' });
        break;
      default:
        break;
    }
  } catch (err) {
    errors.push({ field: 'validation', message: 'Validation threw an error' });
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export default getEnhancedPrompt;
