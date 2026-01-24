import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import {
  DocumentTypeEnum,
  ProfessionalServicesOverviewV1Schema as PSOverview,
  KeyClauseMatrixV1Schema as ClauseMatrix,
  IntelligenceBundleV1Schema as Bundle,
} from 'schemas';
import { convertCurrency, normalizeToDaily } from 'utils';
import { mapRoleDetail } from 'utils';

const detectDocTypePrompt = `Classify the contract document type into one of: MSA, SOW, Secondment, LOI, LOE, Addendum, Unknown.
Return strict JSON: { docType: "..." }`;

const overviewPrompt = `You are a Professional Services contract analyst.
Summarize and extract: parties, effectiveDate (if any), terminationDate (if any), scope, deliverables, acceptanceCriteria, paymentTerms, changeControl, serviceLevels, rolesMentioned (array).
Return strict JSON matching the schema.`;

const clauseMatrixPrompt = `Identify presence of key clauses relevant to PS: Liability Cap, Termination, Confidentiality, IP Ownership, Indemnity, Non-solicitation, Change Control, Service Levels, Acceptance, Payment Terms, Expenses, Governing Law.
Return strict JSON { clauses: [{ name, present, snippet? }] }`;

export class ProfessionalServicesAnalyzer {
  llm: ChatOpenAI | any;

  constructor(opts?: { apiKey?: string; model?: string }) {
    const key = opts?.apiKey || process.env['OPENAI_API_KEY'];
    if (!key) {
      // simple deterministic fallback
      this.llm = {
        async invoke(input: any) {
          const user = Array.isArray(input?.messages) ? input.messages.find((m: any) => m.role === 'user') : null;
          const t = String(user?.content || '');
          if (/Classify the contract document type/i.test(JSON.stringify(input))) {
            const guess = /statement of work|SOW/i.test(t) ? 'SOW' : (/master services|MSA/i.test(t) ? 'MSA' : 'Unknown');
            return { content: JSON.stringify({ docType: guess }) };
          }
          if (/Summarize and extract/i.test(JSON.stringify(input))) {
            const parties = Array.from(new Set((t.match(/between\s+([A-Z][\w&., ]+)/gi) || []).map(s => s.replace(/between\s+/i,'').trim()))).slice(0, 2);
            return { content: JSON.stringify({
              docType: 'Unknown',
              summary: t.slice(0, 400),
              parties,
              rolesMentioned: Array.from(new Set((t.match(/Analyst|Consultant|Manager|Engineer|Director/gi) || []).map(s=>s)))
            }) };
          }
          if (/Identify presence of key clauses/i.test(JSON.stringify(input))) {
            const names = ['Liability Cap','Termination','Confidentiality','IP Ownership','Indemnity','Non-solicitation','Change Control','Service Levels','Acceptance','Payment Terms','Expenses','Governing Law'];
            const clauses = names.map(n => ({ name: n, present: new RegExp(n.split(' ')[0]!, 'i').test(t) }));
            return { content: JSON.stringify({ clauses }) };
          }
          return { content: '{}' };
        }
      };
    } else {
      this.llm = new ChatOpenAI({ openAIApiKey: key, azureOpenAIApiKey: undefined, modelName: opts?.model || process.env['OPENAI_MODEL'] || 'gpt-4o-mini', temperature: 0.2 });
    }
  }

  private chain(system: string) {
    return RunnableSequence.from([
      async (input: { text: string }) => [
        new SystemMessage(system),
        new HumanMessage(input.text.slice(0, 16000)),
      ],
      this.llm,
      async (output: any) => {
        const content = typeof output?.content === 'string' ? output.content : JSON.stringify(output);
        try { return JSON.parse(content); } catch { return {}; }
      }
    ]);
  }

  async analyze(text: string) {
    // doc type first
    const dtRaw = await this.chain(detectDocTypePrompt).invoke({ text });
    const docType = DocumentTypeEnum.safeParse(dtRaw?.docType).success ? dtRaw.docType : 'Unknown';

    // overview
    const ovwRaw = await this.chain(overviewPrompt).invoke({ text });
    const overview = PSOverview.safeParse({ docType, ...ovwRaw }).success ? { docType, ...ovwRaw } : { docType, summary: String(ovwRaw?.summary || text.slice(0, 400)), parties: Array.isArray(ovwRaw?.parties) ? ovwRaw.parties : [] };

    // clauses matrix
    const cmRaw = await this.chain(clauseMatrixPrompt).invoke({ text });
    const clauseMatrix = ClauseMatrix.safeParse(cmRaw).success ? cmRaw : { clauses: [] };

    return { overview, clauseMatrix };
  }

  private parseRates(text: string) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows: Array<{ pdfRole?: string; role?: string; seniority?: string; mappingConfidence?: number; currency?: string; uom?: string; amount?: number; dailyUsd?: number }>= [];
    for (const line of lines) {
      // Match role and amount/uom/currency
      const roleMatch = line.match(/(Analyst|Consultant|Senior Consultant|Manager|Senior Manager|Director|Partner|Engineer|Developer|Architect|Specialist|Category Manager|Contract Specialist)/i);
      const amtMatch = line.match(/(?:(USD|EUR|GBP|INR|CAD|AUD)|\$|€|£)?\s*(\d{2,5})(?:[.,](\d{1,2}))?\s*(per\s*)?(Hour|Day|Month|Year|Hr|h|Mo|Yr|Annum)?/i);
      if (!roleMatch || !amtMatch) continue;
      const pdfRole = roleMatch[1];
      const rawAmount = parseFloat(`${amtMatch[2]}${amtMatch[3] ? '.' + amtMatch[3] : ''}`);
      const uomRaw = (amtMatch[5] || '').toLowerCase();
      const uom = /hour|hr|h/.test(uomRaw) ? 'Hour' : /month|mo/.test(uomRaw) ? 'Month' : /year|yr|annum/.test(uomRaw) ? 'Year' : 'Day';
      const sym = amtMatch[1] || (line.includes('€') ? 'EUR' : line.includes('£') ? 'GBP' : line.includes('$') ? 'USD' : 'USD');
      const currency = sym.toUpperCase();
      const mapped = mapRoleDetail(pdfRole || '');
      const daily = normalizeToDaily(rawAmount, uom);
      const usd = convertCurrency(daily, currency, 'USD');
      rows.push({ pdfRole: pdfRole || '', role: mapped.role, seniority: mapped.seniority, mappingConfidence: mapped.confidence, currency, uom, amount: rawAmount, dailyUsd: Math.round(usd) });
      if (rows.length >= 64) break;
    }
    return rows;
  }

  private buildInsights(_text: string, clauseMatrix: any, rates: any[]) {
    const insights: any[] = [];
    const missing = (name: string) => !clauseMatrix?.clauses?.some((c: any) => c.name === name && c.present);
    if (missing('Liability Cap')) insights.push({ id: 'risk-liability-cap', type: 'risk', severity: 'high', title: 'Missing Liability Cap', description: 'The contract may lack a clear liability cap.', suggestions: ['Add a liability cap aligned to risk/tcv.'] });
    if (missing('Confidentiality')) insights.push({ id: 'risk-conf', type: 'risk', severity: 'medium', title: 'Missing Confidentiality Clause', description: 'Confidentiality may be insufficient.', suggestions: ['Add NDA/confidentiality terms.'] });
    const high = rates.filter(r => (r.dailyUsd || 0) > 2000);
    if (high.length) insights.push({ id: 'cost-high-rates', type: 'deviation', severity: 'medium', title: 'High daily rates detected', description: `${high.length} role(s) above $2000/day.`, suggestions: ['Negotiate rates', 'Consider blended rate caps'] });
    return { insights };
  }

  async bundle(text: string) {
    const { overview, clauseMatrix } = await this.analyze(text);
    const normalizedRates = this.parseRates(text);
    const interactive = this.buildInsights(text, clauseMatrix, normalizedRates);
    const out = { psOverview: overview, clauseMatrix, normalizedRates, interactive };
    return Bundle.safeParse(out).success ? out : out;
  }
}
