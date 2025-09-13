import { getAllBundles, getSection, listContracts, getAllRates } from './store';
// Optional LLM client (OpenAI). Guarded by env and availability.
let OpenAI: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OpenAI = require('openai').OpenAI;
} catch {
  OpenAI = null;
}

export type Provenance = {
  type: 'artifact' | 'computed';
  docId?: string;
  section?: 'overview' | 'clauses' | 'rates' | 'compliance' | 'benchmark' | 'risk';
  path?: string; // e.g., /api/contracts/:docId/artifacts/:section.json
  clauseId?: string;
  page?: number;
  policyId?: string;
  note?: string;
};

export type QueryResult = {
  ok: boolean;
  kind: 'table' | 'metrics' | 'findings';
  columns?: Array<{ key: string; label: string }>;
  rows?: Array<Record<string, any> & { provenance: Provenance[] }>;
  metrics?: Array<{ label: string; value: number | string; unit?: string; provenance: Provenance[] }>;
  findings?: Array<{ title: string; description?: string; severity?: 'low'|'medium'|'high'; provenance: Provenance[] }>;
  sources: Provenance[];
  error?: string;
  debug?: any;
};

const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  const idx = Math.floor((p/100)*(s.length-1));
  return s[idx];
};

function textIncludes(s: string|undefined, needle: RegExp) {
  if (!s) return false;
  return needle.test(s);
}

function daysFromText(txt: string): number | null {
  const m = (txt || '').toLowerCase().match(/(\d{1,4})\s*(day|days)/);
  return m ? Number(m[1]) : null;
}

// -----------------------
// LLM-backed open-ended NLI
// -----------------------
type QueryPlan = {
  scope: 'portfolio' | 'contract';
  contractId?: string;
  return: 'table' | 'metrics' | 'findings';
  where?: {
    docTypes?: string[];
    supplier?: string[];
  client?: string[];
    country?: string[];
  region?: string[];
    lineOfService?: string[];
    role?: string[];
    hasGDPR?: boolean;
    missingGDPR?: boolean;
    noticeDaysGt?: number;
    textContains?: string[];
    expiringInDays?: number;
  clauseContains?: string[];
  startDateGte?: string; // ISO date
  startDateLte?: string; // ISO date
  endDateGte?: string;   // ISO date
  endDateLte?: string;   // ISO date
  signedDateGte?: string; // ISO date
  signedDateLte?: string; // ISO date
  };
  compute?: Array<{
  op: 'count' | 'avg' | 'p50' | 'p75' | 'p90' | 'sum' | 'max' | 'min';
    on?: 'dailyUsd' | 'tcv';
    groupBy?: Array<'role' | 'supplier' | 'country' | 'lineOfService'>;
    label?: string;
  }>;
  limit?: number;
};

async function interpretWithLLM(question: string, scope: 'portfolio'|'contract', contractId?: string): Promise<QueryPlan | null> {
  try {
    const allow = String(process.env.ANALYSIS_USE_LLM_NLI ?? process.env.ANALYSIS_USE_LLM ?? 'true') === 'true';
    const key = process.env.OPENAI_API_KEY;
    if (!allow || !OpenAI || !key) return null;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const client = new OpenAI({ apiKey: key });
    const system = [
      'Translate user questions about contracts into a strict JSON "query plan" to run over artifacts: overview, clauses, rates, compliance, benchmark, risk.',
      'Never fabricate data; do not include answers; only return a plan to execute locally.',
      'Return a single JSON object, no prose.'
    ].join(' ');
    const examples = [
      '"Which contracts are missing a GDPR clause?" => {"scope":"portfolio","return":"table","where":{"missingGDPR":true}}',
      '"Deloitte blended daily rate vs market P75" => {"scope":"portfolio","return":"metrics","where":{"supplier":["Deloitte"]},"compute":[{"op":"avg","on":"dailyUsd","label":"Blended daily rate"},{"op":"p75","on":"dailyUsd","label":"Market P75"}]}',
      '"SOWs with notice > 60 days" => {"scope":"portfolio","return":"table","where":{"docTypes":["SOW"],"noticeDaysGt":60}}',
      '"market p75 by role" => {"scope":"portfolio","return":"table","compute":[{"op":"p75","on":"dailyUsd","groupBy":["role"],"label":"P75 USD/day"}]}',
      '"Accenture client contracts in EMEA expiring before 2026" => {"scope":"portfolio","return":"table","where":{"client":["Accenture"],"region":["EMEA"],"endDateLte":"2026-01-01"}}',
  '"Clauses mentioning subcontracting" => {"scope":"portfolio","return":"table","where":{"clauseContains":["subcontract"]}}',
  '"What is the highest daily rate?" => {"scope":"portfolio","return":"metrics","compute":[{"op":"max","on":"dailyUsd","label":"Highest daily rate"}]}',
  '"List suppliers" => {"scope":"portfolio","return":"table","compute":[{"op":"count"}],"where":{}}'
    ].join('\n');
    const prompt = `scope: ${scope}${contractId ? `\ncontractId: ${contractId}`: ''}\nquestion: ${question}\nReturn ONLY JSON for a plan. Examples:\n${examples}`;
    const resp = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
    });
    const text = resp.choices?.[0]?.message?.content || '';
    const plan = JSON.parse(text) as QueryPlan;
    plan.scope = scope;
    if (scope === 'contract') plan.contractId = contractId;
    return plan;
  } catch {
    return null;
  }
}

function normalizeDailyUSD(raw: any): number {
  if (!raw) return 0;
  const fx: Record<string, number> = {
    USD: Number(process.env.FX_USD || 1),
    EUR: Number(process.env.FX_EUR || 1.1),
    GBP: Number(process.env.FX_GBP || 1.27),
  };
  const uom = String(raw.uom || raw.unit || 'Day').toLowerCase();
  const currency = String((raw.currency || 'USD')).toUpperCase();
  const amount = Number(raw.amount || 0);
  const dailyUsdFromAmount = (() => {
    if (!(amount > 0)) return 0;
    const fxRate = fx[currency] ?? 1;
    if (uom.startsWith('hour')) return Math.round(amount * fxRate * Number(process.env.HOURS_PER_DAY || 8));
    if (uom.startsWith('day')) return Math.round(amount * fxRate);
    if (uom.startsWith('week')) return Math.round((amount * fxRate) / Number(process.env.DAYS_PER_WEEK || 5));
    if (uom.startsWith('month')) return Math.round((amount * fxRate) / Number(process.env.DAYS_PER_MONTH || 20));
    if (uom.startsWith('year') || uom.startsWith('ann')) return Math.round((amount * fxRate) / Number(process.env.DAYS_PER_YEAR || 260));
    return Math.round(amount * fxRate);
  })();
  const dailyField = Number(raw.dailyUsd || 0);
  if (dailyField > 0) {
    // If a currency is specified and not USD, convert the daily field too
    const fxRate = fx[currency] ?? 1;
    return Math.round(dailyField * (currency === 'USD' ? 1 : fxRate));
  }
  return dailyUsdFromAmount;
}

function collectRatesFromBundles() {
  const bundles = getAllBundles();
  const out: Array<{ docId: string; role?: string; dailyUsd: number; raw?: any }> = [];
  for (const { docId, bundle } of bundles) {
    const rates: any[] = Array.isArray((bundle as any)?.rates?.rates) ? (bundle as any).rates.rates : [];
    for (const r of rates) {
      const dailyUsd = normalizeDailyUSD(r);
      if (dailyUsd > 0) out.push({ docId, role: r?.role, dailyUsd, raw: r });
    }
  }
  return out;
}

// Repository-wide (extracted + manual + overrides)
function collectRatesFromRepository() {
  const rows = getAllRates();
  const out: Array<{ docId: string; role?: string; dailyUsd: number; raw?: any }> = [];
  for (const r of rows as any[]) {
  const v = normalizeDailyUSD(r?.raw ?? r);
    if (v > 0) out.push({ docId: r.docId, role: r.role, dailyUsd: v, raw: r.raw ?? r });
  }
  return out;
}

function supplierOf(docId: string) {
  const ov: any = getSection(docId, 'overview');
  const parties: string[] = Array.isArray(ov?.parties) ? ov.parties : [];
  return (parties[1] || parties[0] || 'Unknown').replace(/\(.*?\)/g, '').trim();
}

function clientOf(docId: string) {
  const ov: any = getSection(docId, 'overview');
  const parties: string[] = Array.isArray(ov?.parties) ? ov.parties : [];
  return (parties[0] || parties[1] || 'Unknown').replace(/\(.*?\)/g, '').trim();
}

const COUNTRY_REGION: Record<string, 'EMEA'|'AMER'|'APAC'|'OTHER'> = {
  // Europe, Middle East, Africa
  'uk':'EMEA','gb':'EMEA','ie':'EMEA','fr':'EMEA','de':'EMEA','es':'EMEA','pt':'EMEA','it':'EMEA','nl':'EMEA','be':'EMEA','lu':'EMEA','ch':'EMEA','se':'EMEA','no':'EMEA','dk':'EMEA','fi':'EMEA','pl':'EMEA','cz':'EMEA','hu':'EMEA','at':'EMEA','gr':'EMEA','ro':'EMEA','bg':'EMEA','ua':'EMEA','ru':'EMEA','tr':'EMEA','il':'EMEA','ae':'EMEA','sa':'EMEA','za':'EMEA','ng':'EMEA','ke':'EMEA',
  // Americas
  'us':'AMER','ca':'AMER','mx':'AMER','br':'AMER','ar':'AMER','cl':'AMER','co':'AMER','pe':'AMER',
  // Asia Pacific
  'cn':'APAC','jp':'APAC','kr':'APAC','sg':'APAC','hk':'APAC','tw':'APAC','in':'APAC','au':'APAC','nz':'APAC','th':'APAC','vn':'APAC','id':'APAC','my':'APAC','ph':'APAC'
};

function countryToRegion(country?: string): 'EMEA'|'AMER'|'APAC'|'OTHER' {
  if (!country) return 'OTHER';
  const c = country.toLowerCase().trim();
  // Try 2-letter code
  if (COUNTRY_REGION[c as keyof typeof COUNTRY_REGION]) return COUNTRY_REGION[c as keyof typeof COUNTRY_REGION];
  // Try matching common names
  const mapByName: Record<string,string> = {
    'united kingdom':'uk','great britain':'uk','britain':'uk','england':'uk',
    'united states':'us','usa':'us','u.s.':'us','u.s.a.':'us','america':'us','canada':'ca','mexico':'mx','brazil':'br','argentina':'ar','chile':'cl',
    'france':'fr','germany':'de','spain':'es','portugal':'pt','italy':'it','netherlands':'nl','belgium':'be','luxembourg':'lu','switzerland':'ch','sweden':'se','norway':'no','denmark':'dk','finland':'fi','poland':'pl','czech republic':'cz','hungary':'hu','austria':'at','greece':'gr','romania':'ro','bulgaria':'bg','ukraine':'ua','russia':'ru','turkey':'tr','israel':'il','united arab emirates':'ae','saudi arabia':'sa','south africa':'za','nigeria':'ng','kenya':'ke',
    'china':'cn','japan':'jp','korea':'kr','south korea':'kr','singapore':'sg','hong kong':'hk','taiwan':'tw','india':'in','australia':'au','new zealand':'nz','thailand':'th','vietnam':'vn','indonesia':'id','malaysia':'my','philippines':'ph'
  };
  const key = mapByName[c] || mapByName[c.replace(/\./g,'')];
  if (key && COUNTRY_REGION[key as keyof typeof COUNTRY_REGION]) return COUNTRY_REGION[key as keyof typeof COUNTRY_REGION];
  return 'OTHER';
}

function dateBetween(value?: string, gte?: string, lte?: string): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  if (isNaN(t)) return false;
  if (gte) {
    const tg = new Date(gte).getTime();
    if (!isNaN(tg) && t < tg) return false;
  }
  if (lte) {
    const tl = new Date(lte).getTime();
    if (!isNaN(tl) && t > tl) return false;
  }
  return true;
}

function execPlanPortfolio(plan: QueryPlan, showPlan = false): QueryResult {
  const bundles = getAllBundles();
  const sources: Provenance[] = [];
  const rows: Array<any & { provenance: Provenance[] }> = [];
  const ratesRepo = collectRatesFromRepository();

  // Filter helpers
  const matches = (docId: string, bundle: any): boolean => {
    const w = plan.where || {};
    const ov: any = (bundle as any).overview;
    const cl: any = (bundle as any).clauses;
    const comp: any = (bundle as any).compliance;
    const rates: any[] = Array.isArray((bundle as any)?.rates?.rates) ? (bundle as any).rates.rates : [];
    // Type
    if (w.docTypes && w.docTypes.length) {
      const typ = String(ov?.type || '');
      if (!w.docTypes.some(t => new RegExp(t, 'i').test(typ))) return false;
    }
    // Supplier includes
    if (w.supplier && w.supplier.length) {
      const joined = (Array.isArray(ov?.parties) ? ov.parties.join(' ') : String(ov?.summary || '')).toLowerCase();
      if (!w.supplier.some(s => joined.includes(String(s).toLowerCase()))) return false;
    }
    // Client includes
    if (w.client && w.client.length) {
      const joined = (Array.isArray(ov?.parties) ? ov.parties.join(' ') : String(ov?.summary || '')).toLowerCase();
      if (!w.client.some(s => joined.includes(String(s).toLowerCase()))) return false;
    }
    // Rates-derived filters
    if ((w.country && w.country.length) || (w.lineOfService && w.lineOfService.length) || (w.role && w.role.length)) {
      const rts: any[] = rates;
      const roles = new Set<string>(rts.map(r => String(r?.role || 'Unknown')));
      const countries = new Set<string>(rts.map(r => String(r?.country || r?.location || 'Unknown')));
      const los = new Set<string>(rts.map(r => String(r?.lineOfService || r?.los || 'Unknown')));
      if (w.role && w.role.length && !w.role.some(v => roles.has(String(v)))) return false;
      if (w.country && w.country.length && !w.country.some(v => countries.has(String(v)))) return false;
      if (w.lineOfService && w.lineOfService.length && !w.lineOfService.some(v => los.has(String(v)))) return false;
    }
    // Region filter from country or explicit region on rates
    if (w.region && w.region.length) {
      const countries = Array.from(new Set<string>(rates.map(r => String(r?.country || r?.location || 'Unknown'))));
      const regions = new Set<string>(countries.map(c => countryToRegion(c)));
      if (!w.region.some(rg => regions.has(String(rg).toUpperCase() as any))) return false;
    }
    // GDPR
    if (w.hasGDPR || w.missingGDPR) {
      const clauses: any[] = Array.isArray(cl?.clauses) ? cl.clauses : [];
      const hit = clauses.find((c: any) => textIncludes(c?.text, /gdpr|general data protection|data\s+protection|privacy/i));
      if (w.hasGDPR && !hit) return false;
      if (w.missingGDPR && !!hit) return false;
    }
    // Clause keyword queries
    if (w.clauseContains && w.clauseContains.length) {
      const clauses: any[] = Array.isArray(cl?.clauses) ? cl.clauses : [];
      const lowerNeedles = (w.clauseContains || []).map(s => String(s).toLowerCase());
      const textArr = clauses.map(c => String(c?.text || '').toLowerCase());
      const ok = lowerNeedles.every(n => textArr.some(t => t.includes(n)));
      if (!ok) return false;
    }
    // Notice via compliance or clauses
    if (typeof w.noticeDaysGt === 'number') {
      let days: number | undefined;
      const compArr: any[] = Array.isArray(comp?.compliance) ? comp.compliance : [];
      const term = compArr.find(it => String(it?.policyId).toUpperCase() === 'TERMINATION_NOTICE');
      if (term?.details) {
        const mm = String(term.details).match(/(\d{1,4})\s*(day|days)/i);
        if (mm) days = parseInt(mm[1], 10);
      }
      if (typeof days !== 'number') {
        const clauses: any[] = Array.isArray(cl?.clauses) ? cl.clauses : [];
        for (const c of clauses) {
          const d = daysFromText(String(c?.text || ''));
          if (d != null) { days = d; break; }
        }
      }
      if (!(typeof days === 'number' && days > (w.noticeDaysGt as number))) return false;
    }
    // Text contains
    if (w.textContains && w.textContains.length) {
      const text = [ov?.summary, ov?.scope, ov?.fees, ov?.paymentTerms].filter(Boolean).join(' ').toLowerCase();
      const ok = (w.textContains || []).every(f => text.includes(String(f).toLowerCase()));
      if (!ok) return false;
    }
    // Date ranges: startDate, endDate, signedDate (metadata)
    if (w.startDateGte || w.startDateLte) {
      const v = ov?.startDate || ov?.effectiveDate;
      if (!dateBetween(v, w.startDateGte, w.startDateLte)) return false;
    }
    if (w.endDateGte || w.endDateLte) {
      const v = ov?.terminationDate || ov?.endDate;
      if (!dateBetween(v, w.endDateGte, w.endDateLte)) return false;
    }
    if (w.signedDateGte || w.signedDateLte) {
      const v = ov?.signedDate || ov?.executionDate;
      if (!dateBetween(v, w.signedDateGte, w.signedDateLte)) return false;
    }
    // Expiring in N days
    if (typeof w.expiringInDays === 'number') {
      const end = ov?.terminationDate || ov?.endDate;
      const now = Date.now();
      if (!end) return false;
      const t = new Date(end).getTime();
      if (isNaN(t)) return false;
      const diffDays = Math.round((t - now) / (1000*60*60*24));
      if (!(diffDays >= 0 && diffDays <= (w.expiringInDays as number))) return false;
    }
    return true;
  };

  // Compute block? If groupBy present, prefer table; else metrics
  const bundlesFiltered = bundles.filter(({ docId, bundle }) => matches(docId, bundle));
  if (plan.compute && plan.compute.length) {
    const compute = plan.compute[0];
    const label = compute.label || `${compute.op}${compute.on ? `(${compute.on})` : ''}`;
    // Build working set of rate values for matched docs
    const docSet = new Set(bundlesFiltered.map(b => b.docId));
    const rateSlice = ratesRepo.filter(r => docSet.size ? docSet.has(r.docId) : true).map(r => ({ ...r, supplier: supplierOf(r.docId), country: (r.raw?.country || r.raw?.location || 'Unknown'), lineOfService: (r.raw?.lineOfService || r.raw?.los || 'Unknown') }));

  if (compute.groupBy && compute.groupBy.length) {
      const keyOf = (r: any) => compute.groupBy!.map(g => g==='role'? (r.role||'Unknown'): g==='supplier'? (r.supplier||'Unknown') : g==='country'? (r.country||'Unknown') : (r.lineOfService||'Unknown')).join(' · ');
      const groups = new Map<string, number[]>();
      for (const r of rateSlice) {
        const k = keyOf(r);
        const arr = groups.get(k) || [];
        arr.push(Number(r.dailyUsd));
        groups.set(k, arr);
      }
      const rowsOut: Array<any & { provenance: Provenance[] }> = [];
      for (const [k, arr] of groups.entries()) {
        let v = 0;
  if (compute.op === 'count') v = arr.length;
  else if (compute.op === 'avg') v = Math.round(arr.reduce((s,x)=>s+x,0)/(arr.length||1));
  else if (compute.op === 'p50') v = Math.round(pct(arr, 50));
  else if (compute.op === 'p75') v = Math.round(pct(arr, 75));
  else if (compute.op === 'p90') v = Math.round(pct(arr, 90));
  else if (compute.op === 'sum') v = Math.round(arr.reduce((s,x)=>s+x,0));
  else if (compute.op === 'max') v = Math.max(...arr);
  else if (compute.op === 'min') v = Math.min(...arr);
        rowsOut.push({ group: k, [label]: v, provenance: [] });
      }
      // Attach sample provenance
      const prov: Provenance[] = rateSlice.slice(0,3).map(r => ({ type:'artifact', docId: r.docId, section:'rates', path: `/api/contracts/${r.docId}/artifacts/rates.json` }));
      for (const row of rowsOut) row.provenance = prov;
      sources.push(...prov);
  return { ok: true, kind:'table', columns: [{ key:'group', label:'Group' }, { key: label, label }], rows: rowsOut, sources, ...(showPlan ? { debug: { plan } } : {}) } as any;
    }

    // Ungrouped -> metrics
    const vals = rateSlice.map(r => Number(r.dailyUsd)).filter(n => n>0);
    const metrics = [] as NonNullable<QueryResult['metrics']>;
    let value = 0;
  if (compute.op === 'count') value = vals.length;
  else if (compute.op === 'avg') value = Math.round(vals.reduce((s,x)=>s+x,0)/(vals.length||1));
  else if (compute.op === 'p50') value = Math.round(pct(vals, 50));
  else if (compute.op === 'p75') value = Math.round(pct(vals, 75));
  else if (compute.op === 'p90') value = Math.round(pct(vals, 90));
  else if (compute.op === 'sum') value = Math.round(vals.reduce((s,x)=>s+x,0));
  else if (compute.op === 'max') value = Math.max(...vals);
  else if (compute.op === 'min') value = Math.min(...vals);
    const prov: Provenance[] = rateSlice.slice(0,3).map(r => ({ type:'artifact', docId: r.docId, section:'rates', path: `/api/contracts/${r.docId}/artifacts/rates.json` }));
    metrics.push({ label, value, unit: compute.on==='dailyUsd' ? 'USD/day' : undefined, provenance: prov });
    sources.push(...prov);
  return { ok: true, kind:'metrics', metrics, sources, ...(showPlan ? { debug: { plan } } : {}) } as any;
  }

  // Default table of matched contracts
  for (const { docId, bundle } of bundlesFiltered) {
    const ov: any = (bundle as any).overview;
    const cl: any = (bundle as any).clauses;
    const rowProv: Provenance[] = [];
    const hit = (Array.isArray(cl?.clauses) ? cl.clauses : [])[0];
    if (hit) rowProv.push({ type:'artifact', docId, section:'clauses', path:`/api/contracts/${docId}/artifacts/clauses.json`, page: hit?.page, clauseId: hit?.clauseId });
    else rowProv.push({ type:'artifact', docId, section:'overview', path:`/api/contracts/${docId}/artifacts/overview.json` });
    rows.push({ contract: ov?.metadata?.name || docId, type: ov?.type || 'Unknown', docId, provenance: rowProv });
    sources.push(...rowProv);
  }
  return { ok: true, kind:'table', columns: [ { key:'contract', label:'Contract' }, { key:'type', label:'Type' }, { key:'docId', label:'Doc' } ], rows, sources, ...(showPlan ? { debug: { plan } } : {}) } as any;
}

function execPlanContract(docId: string, plan: QueryPlan, showPlan = false): QueryResult {
  const bundle = {
    overview: getSection(docId, 'overview'),
    clauses: getSection(docId, 'clauses'),
    rates: getSection(docId, 'rates'),
    compliance: getSection(docId, 'compliance'),
    benchmark: getSection(docId, 'benchmark'),
    risk: getSection(docId, 'risk'),
  } as any;
  const sources: Provenance[] = [];

  if (plan.compute && plan.compute.length) {
    const compute = plan.compute[0];
    const label = compute.label || `${compute.op}${compute.on ? `(${compute.on})` : ''}`;
  const rates: any[] = Array.isArray(bundle?.rates?.rates) ? bundle.rates.rates : [];
  // Normalize to USD/day for consistency
  const vals = rates.map((r:any)=> Number(normalizeDailyUSD(r) || 0)).filter((n:number)=>n>0);
    let v = 0;
    if (compute.op === 'count') v = vals.length;
    else if (compute.op === 'avg') v = Math.round(vals.reduce((s:number,x:number)=>s+x,0)/(vals.length||1));
    else if (compute.op === 'p50') v = Math.round(pct(vals, 50));
    else if (compute.op === 'p75') v = Math.round(pct(vals, 75));
    else if (compute.op === 'p90') v = Math.round(pct(vals, 90));
  else if (compute.op === 'sum') v = Math.round(vals.reduce((s:number,x:number)=>s+x,0));
  else if (compute.op === 'max') v = vals.length ? Math.max(...vals) : 0;
  else if (compute.op === 'min') v = vals.length ? Math.min(...vals) : 0;
    const prov: Provenance[] = [ { type:'artifact', docId, section:'rates', path:`/api/contracts/${docId}/artifacts/rates.json` } ];
    sources.push(...prov);
  return { ok: true, kind:'metrics', metrics: [ { label, value: v, unit: compute.on==='dailyUsd'? 'USD/day' : undefined, provenance: prov } ], sources, ...(showPlan ? { debug: { plan } } : {}) } as any;
  }

  // Findings based on filters
  const w = plan.where || {};
  const findings: NonNullable<QueryResult['findings']> = [];
  if (typeof w.noticeDaysGt === 'number') {
    const compArr: any[] = Array.isArray(bundle?.compliance?.compliance) ? bundle.compliance.compliance : [];
    const term = compArr.find((it:any)=> String(it?.policyId).toUpperCase() === 'TERMINATION_NOTICE');
    let days: number | undefined;
    if (term?.details) {
      const mm = String(term.details).match(/(\d{1,4})\s*(day|days)/i);
      if (mm) days = parseInt(mm[1], 10);
    }
    if (typeof days !== 'number') {
      const list: any[] = Array.isArray(bundle?.clauses?.clauses) ? bundle.clauses.clauses : [];
      for (const c of list) { const d = daysFromText(String(c?.text||'')); if (d!=null) { days = d; break; } }
    }
    if (typeof days === 'number' && days > (w.noticeDaysGt as number)) {
      const prov: Provenance[] = [ { type:'artifact', docId, section:'compliance', path:`/api/contracts/${docId}/artifacts/compliance.json`, policyId:'TERMINATION_NOTICE' } ];
      findings.push({ title: `Notice period ${days} days (> ${w.noticeDaysGt})`, provenance: prov });
      sources.push(...prov);
    } else {
      findings.push({ title: 'No notice period above threshold found', provenance: [] });
    }
  }
  if (w.hasGDPR || w.missingGDPR) {
    const clauses: any[] = Array.isArray(bundle?.clauses?.clauses) ? bundle.clauses.clauses : [];
    const hit = clauses.find(c => textIncludes(c?.text, /gdpr|general data protection|data\s+protection|privacy/i));
    if (w.hasGDPR && hit) {
      const prov: Provenance[] = [ { type:'artifact', docId, section:'clauses', path:`/api/contracts/${docId}/artifacts/clauses.json`, clauseId: hit?.clauseId, page: hit?.page } ];
      findings.push({ title: 'GDPR clause found', provenance: prov });
      sources.push(...prov);
    }
    if (w.missingGDPR && !hit) {
      const prov: Provenance[] = [ { type:'artifact', docId, section:'clauses', path:`/api/contracts/${docId}/artifacts/clauses.json` } ];
      findings.push({ title: 'GDPR clause not detected', provenance: prov });
      sources.push(...prov);
    }
  }
  if (!findings.length) {
    const ov: any = bundle?.overview;
    const prov: Provenance[] = [ { type:'artifact', docId, section:'overview', path:`/api/contracts/${docId}/artifacts/overview.json` } ];
    findings.push({ title: ov?.summary ? String(ov.summary).slice(0, 120) + '…' : 'No specific findings', provenance: prov });
    sources.push(...prov);
  }
  return { ok: true, kind:'findings', findings, sources, ...(showPlan ? { debug: { plan } } : {}) } as any;
}

export async function handlePortfolioQuery(q: string, opts?: { showPlan?: boolean }): Promise<QueryResult> {
  const ql = q.toLowerCase();
  const bundles = getAllBundles();
  const sources: Provenance[] = [];
  const showPlan = !!opts?.showPlan;

  // Intent: SOWs where notice period > N days
  const mNotice = ql.match(/notice\s*(?:period|window)\s*(?:>|greater than|over)\s*(\d{1,4})\s*day/);
  const wantsSOW = /\b(sow|statement of work)\b/.test(ql);
  if (mNotice) {
    const threshold = parseInt(mNotice[1], 10);
    const rows: Array<any & { provenance: Provenance[] }> = [];
    for (const { docId, bundle } of bundles) {
      const ov: any = (bundle as any).overview;
      if (wantsSOW) {
        const typ = ov?.type || '';
        if (!/sow/i.test(typ)) continue;
      }
      const comp: any = (bundle as any).compliance;
      const compArr: any[] = Array.isArray(comp?.compliance) ? comp.compliance : [];
      const term = compArr.find(it => String(it?.policyId).toUpperCase() === 'TERMINATION_NOTICE');
      let days: number | undefined;
      if (term?.details) {
        const mm = String(term.details).match(/(\d{1,4})\s*(day|days)/i);
        if (mm) days = parseInt(mm[1], 10);
      }
      if (typeof days === 'number' && days > threshold) {
        const prov: Provenance[] = [
          { type: 'artifact', docId, section: 'compliance', path: `/api/contracts/${docId}/artifacts/compliance.json`, policyId: 'TERMINATION_NOTICE' },
        ];
        sources.push(...prov);
        rows.push({ docId, name: (ov?.metadata?.docId ? undefined : undefined), type: ov?.type || 'Unknown', noticeDays: days, provenance: prov });
      }
    }
    return {
      ok: true,
      kind: 'table',
      columns: [
        { key: 'docId', label: 'Contract' },
        { key: 'type', label: 'Type' },
        { key: 'noticeDays', label: 'Notice (days)' },
      ],
      rows,
      sources,
      ...(showPlan ? { debug: { threshold, wantsSOW } } : {}),
    };
  }

  // Intent: Supplier blended vs market P75
  const mSupplier = q.match(/what(?:'| i)?s\s+([A-Za-z0-9 &.'-]{2,60})\s+(?:blended|average)\s+(?:daily|day)\s+rate/i);
  if (mSupplier) {
    const supplierName = mSupplier[1].trim();
    const supplierDocs = new Set<string>();
    for (const { docId, bundle } of bundles) {
      const ov: any = (bundle as any).overview;
      let isSupplier = false;
      const parties: string[] = Array.isArray(ov?.parties) ? ov.parties : [];
      if (parties.some(p => p && p.toLowerCase().includes(supplierName.toLowerCase()))) isSupplier = true;
      if (!isSupplier && typeof ov?.summary === 'string' && ov.summary.toLowerCase().includes(supplierName.toLowerCase())) isSupplier = true;
      if (!isSupplier && typeof (bundle as any)?.ingestion?.content === 'string' && (bundle as any).ingestion.content.toLowerCase().includes(supplierName.toLowerCase())) isSupplier = true;
      if (isSupplier) supplierDocs.add(docId);
    }
    const repoRates = collectRatesFromRepository();
    const allRates: number[] = repoRates.map(r => Number(r.dailyUsd || 0)).filter(n => n>0);
    const supplierRates: number[] = repoRates.filter(r => supplierDocs.has(r.docId)).map(r => Number(r.dailyUsd || 0)).filter(n => n>0);
    const p75 = Math.round(pct(allRates.filter(n=>n>0), 75));
    const blended = supplierRates.length ? Math.round(supplierRates.reduce((a,b)=>a+b,0)/supplierRates.length) : 0;
    const prov: Provenance[] = [
  ...Array.from(supplierDocs).map(docId => ({ type:'artifact' as const, docId, section:'rates' as const, path: `/api/contracts/${docId}/artifacts/rates.json` })),
  { type: 'computed' as const, note: 'P75 computed over portfolio rates (rates.dailyUsd > 0)' },
    ];
    sources.push(...prov);
    return {
      ok: true,
      kind: 'metrics',
      metrics: [
        { label: `${supplierName} blended daily`, value: blended, unit: 'USD/day', provenance: prov },
        { label: 'Market P75', value: p75, unit: 'USD/day', provenance: prov },
        { label: 'Delta %', value: (p75? Math.round(((blended - p75)/p75)*100): 0) + '%', provenance: prov },
      ],
      sources,
      ...(showPlan ? { debug: { supplierName, sample: supplierRates.slice(0,5) } } : {}),
    };
  }

  // Intent: Missing GDPR clause
  if (/missing\s+(gdpr|data\s*protection|privacy)\s+clause/i.test(q)) {
  const rows: Array<any & { provenance: Provenance[] }> = [];
    for (const { docId, bundle } of bundles) {
      const cl: any = (bundle as any).clauses;
      const clauses: any[] = Array.isArray(cl?.clauses) ? cl.clauses : [];
      const hits = clauses.filter(c => textIncludes(c?.text, /gdpr|general data protection|data\s+protection|privacy/i));
      if (hits.length === 0) {
        const prov: Provenance[] = [
          { type: 'artifact', docId, section: 'clauses', path: `/api/contracts/${docId}/artifacts/clauses.json`, note: 'Searched: gdpr|data protection|privacy' },
        ];
        sources.push(...prov);
        rows.push({ docId, status: 'Missing GDPR', provenance: prov });
      }
    }
    return {
      ok: true,
      kind: 'findings',
      findings: rows.map(r => ({ title: r.docId, description: 'GDPR clause not found in clauses artifact', severity: 'medium', provenance: r.provenance })),
      sources,
    };
  }

  // Intent: Contracts expiring in N days (default 90)
  const mExpire = ql.match(/expiring\s+in\s+(\d{1,4})\s*days/);
  if (mExpire || /expiring\s+soon/.test(ql)) {
    const windowDays = mExpire ? parseInt(mExpire[1], 10) : 90;
    const rows: Array<any & { provenance: Provenance[] }> = [];
    const now = Date.now();
    for (const { docId, bundle } of bundles) {
      const ov: any = (bundle as any).overview;
      const end = ov?.terminationDate || ov?.endDate;
      if (!end) continue;
      const t = new Date(end).getTime();
      if (isNaN(t)) continue;
      const diffDays = Math.round((t - now) / (1000*60*60*24));
      if (diffDays >= 0 && diffDays <= windowDays) {
        const prov: Provenance[] = [ { type:'artifact' as const, docId, section:'overview', path: `/api/contracts/${docId}/artifacts/overview.json` } ];
        rows.push({ docId, endDate: end, daysinset-inline-start: diffDays, provenance: prov });
      }
    }
  return { ok:true, kind:'table', columns: [ { key:'docId', label:'Contract' }, { key:'endDate', label:'End' }, { key:'daysLeft', label:'Days Left' } ], rows, sources: rows.flatMap(r=>r.provenance) };
  }

  // Deterministic analytics: percentile/average by grouping (role|supplier|country|line of service)
  const groupKey = (key: 'role'|'supplier'|'country'|'lineOfService', r: any): string => {
    if (key === 'role') return String(r?.role || 'Unknown');
    if (key === 'supplier') return supplierOf(String(r?.docId || '')) || 'Unknown';
    if (key === 'country') return String(r?.raw?.country || r?.raw?.location || 'Unknown');
    return String(r?.raw?.lineOfService || r?.raw?.los || 'Unknown');
  };
  const computeGroupedTable = (op: 'avg'|'p50'|'p75'|'p90', label: string, by: 'role'|'supplier'|'country'|'lineOfService') => {
    const bundles = getAllBundles();
    const rates: Array<{ docId: string; role?: string; dailyUsd: number; raw?: any }> = collectRatesFromRepository();
    const groups = new Map<string, number[]>();
    for (const r of rates) {
      const k = groupKey(by, r);
      const arr = groups.get(k) || [];
      arr.push(Number(r.dailyUsd));
      groups.set(k, arr);
    }
    const rows: Array<any & { provenance: Provenance[] }> = [];
    for (const [k, arr] of groups.entries()) {
      let v = 0;
      if (op === 'avg') v = Math.round(arr.reduce((s,x)=>s+x,0)/(arr.length||1));
      else if (op === 'p50') v = Math.round(pct(arr, 50));
      else if (op === 'p75') v = Math.round(pct(arr, 75));
      else if (op === 'p90') v = Math.round(pct(arr, 90));
      const prov: Provenance[] = [];
      rows.push({ group: k, [label]: v, provenance: prov });
    }
    // Attach sample provenance (top 3 entries)
    const prov: Provenance[] = rates.slice(0,3).map(r => ({ type:'artifact', docId: r.docId, section:'rates', path:`/api/contracts/${r.docId}/artifacts/rates.json` }));
    for (const row of rows) row.provenance = prov;
    return { ok:true as const, kind:'table' as const, columns:[{ key:'group', label: by === 'lineOfService' ? 'Line of Service' : by.charAt(0).toUpperCase()+by.slice(1) }, { key: label, label }], rows, sources: prov };
  };

  // Parse patterns
  const byRolePxx = q.match(/\b(p50|p75|p90)\b.*by\s+role/i);
  if (byRolePxx) {
    const op = byRolePxx[1].toLowerCase() as 'p50'|'p75'|'p90';
    const label = `${op.toUpperCase()} USD/day`;
    return computeGroupedTable(op, label, 'role');
  }
  const avgByRole = /\b(avg|average|blended)\b.*(daily|day)?.*rate.*by\s+role/i.test(q);
  if (avgByRole) {
    return computeGroupedTable('avg', 'Average USD/day', 'role');
  }
  const bySupplierPxx = q.match(/\b(p50|p75|p90)\b.*by\s+supplier/i);
  if (bySupplierPxx) {
    const op = bySupplierPxx[1].toLowerCase() as 'p50'|'p75'|'p90';
    const label = `${op.toUpperCase()} USD/day`;
    return computeGroupedTable(op, label, 'supplier');
  }
  const avgBySupplier = /\b(avg|average|blended)\b.*(daily|day)?.*rate.*by\s+supplier/i.test(q);
  if (avgBySupplier) {
    return computeGroupedTable('avg', 'Average USD/day', 'supplier');
  }
  const byCountryPxx = q.match(/\b(p50|p75|p90)\b.*by\s+country/i);
  if (byCountryPxx) {
    const op = byCountryPxx[1].toLowerCase() as 'p50'|'p75'|'p90';
    const label = `${op.toUpperCase()} USD/day`;
    return computeGroupedTable(op, label, 'country');
  }
  const avgByCountry = /\b(avg|average|blended)\b.*(daily|day)?.*rate.*by\s+country/i.test(q);
  if (avgByCountry) {
    return computeGroupedTable('avg', 'Average USD/day', 'country');
  }
  const byLoSPxx = q.match(/\b(p50|p75|p90)\b.*by\s+(line\s+of\s+service|los)/i);
  if (byLoSPxx) {
    const op = byLoSPxx[1].toLowerCase() as 'p50'|'p75'|'p90';
    const label = `${op.toUpperCase()} USD/day`;
    return computeGroupedTable(op, label, 'lineOfService');
  }
  const avgByLoS = /\b(avg|average|blended)\b.*(daily|day)?.*rate.*by\s+(line\s+of\s+service|los)/i.test(q);
  if (avgByLoS) {
    return computeGroupedTable('avg', 'Average USD/day', 'lineOfService');
  }

  // Synonyms: top/cheapest/median by <group>
  const topBy = q.match(/\b(top|highest|max(?:imum)?)\b.*by\s+(role|supplier|country|line\s+of\s+service|los)/i);
  if (topBy) {
    const grp = topBy[2].toLowerCase().includes('line') || topBy[2].toLowerCase()==='los' ? 'lineOfService' : (topBy[2].toLowerCase() as 'role'|'supplier'|'country');
    return computeGroupedTable('p90', 'P90 USD/day', grp as any);
  }
  const cheapestBy = q.match(/\b(cheapest|lowest|min(?:imum)?)\b.*by\s+(role|supplier|country|line\s+of\s+service|los)/i);
  if (cheapestBy) {
    const grp = cheapestBy[2].toLowerCase().includes('line') || cheapestBy[2].toLowerCase()==='los' ? 'lineOfService' : (cheapestBy[2].toLowerCase() as 'role'|'supplier'|'country');
    return computeGroupedTable('p50', 'P50 USD/day', grp as any);
  }
  const medianBy = q.match(/\b(median|p50)\b.*by\s+(role|supplier|country|line\s+of\s+service|los)/i);
  if (medianBy) {
    const grp = medianBy[2].toLowerCase().includes('line') || medianBy[2].toLowerCase()==='los' ? 'lineOfService' : (medianBy[2].toLowerCase() as 'role'|'supplier'|'country');
    return computeGroupedTable('p50', 'P50 USD/day', grp as any);
  }

  // Open-ended aggregates over repository
  const repoRates = collectRatesFromRepository();
  const vals = repoRates.map(r => Number(r.dailyUsd || 0)).filter(n => n > 0);
  if (/highest|max(imum)?\s+(daily|day)?\s*rate|top\s+rate/i.test(ql)) {
    const maxVal = vals.length ? Math.max(...vals) : 0;
    const maxRow = repoRates.find(r => Number(r.dailyUsd) === maxVal);
    const prov: Provenance[] = maxRow ? [{ type:'artifact', docId: maxRow.docId, section:'rates', path:`/api/contracts/${maxRow.docId}/artifacts/rates.json` }] : [];
    return { ok: true, kind:'metrics', metrics:[{ label:'Highest daily rate', value:maxVal, unit:'USD/day', provenance: prov }], sources: prov } as any;
  }
  if (/lowest|min(imum)?\s+(daily|day)?\s*rate|bottom\s+rate/i.test(ql)) {
    const minVal = vals.length ? Math.min(...vals) : 0;
    const minRow = repoRates.find(r => Number(r.dailyUsd) === minVal);
    const prov: Provenance[] = minRow ? [{ type:'artifact', docId: minRow.docId, section:'rates', path:`/api/contracts/${minRow.docId}/artifacts/rates.json` }] : [];
    return { ok: true, kind:'metrics', metrics:[{ label:'Lowest daily rate', value:minVal, unit:'USD/day', provenance: prov }], sources: prov } as any;
  }
  if (/how\s+many\s+contracts|total\s+contracts|count\s+of\s+contracts/i.test(ql)) {
    const count = bundles.length;
    const prov: Provenance[] = bundles.slice(0,1).map(b => ({ type:'artifact', docId: b.docId, section:'overview', path:`/api/contracts/${b.docId}/artifacts/overview.json` }));
    return { ok: true, kind:'metrics', metrics:[{ label:'Total contracts', value: count, provenance: prov }], sources: prov } as any;
  }
  if (/list\s+suppliers|which\s+suppliers|unique\s+suppliers/i.test(ql)) {
    const supps = Array.from(new Set(bundles.map(b => supplierOf(b.docId)))).filter(Boolean).sort();
    const rows = supps.map(s => ({ supplier: s, provenance: [] as Provenance[] }));
    return { ok: true, kind:'table', columns:[{ key:'supplier', label:'Supplier' }], rows, sources: [] } as any;
  }

  // LLM fallback: attempt to interpret into a plan and execute
  const plan = await interpretWithLLM(q, 'portfolio');
  if (plan) return execPlanPortfolio(plan, showPlan);
  // Default: not understood
  return { ok: false, kind: 'findings', error: 'Query not recognized', findings: [], sources, ...(showPlan ? { debug: { q } } : {}) } as any;
}

export async function handleContractQuery(docId: string, q: string, opts?: { showPlan?: boolean }): Promise<QueryResult> {
  const bundle: any = {
    overview: getSection(docId, 'overview'),
    clauses: getSection(docId, 'clauses'),
    rates: getSection(docId, 'rates'),
    compliance: getSection(docId, 'compliance'),
    benchmark: getSection(docId, 'benchmark'),
    risk: getSection(docId, 'risk'),
  };
  const sources: Provenance[] = [];
  const ql = q.toLowerCase();
  const showPlan = !!opts?.showPlan;

  // Scoped versions of above intents
  if (/notice\s*(?:period|window)/.test(ql)) {
    const compArr: any[] = Array.isArray(bundle?.compliance?.compliance) ? bundle.compliance.compliance : [];
    const term = compArr.find(it => String(it?.policyId).toUpperCase() === 'TERMINATION_NOTICE');
    if (term?.details) {
      const mm = String(term.details).match(/(\d{1,4})\s*(day|days)/i);
      const days = mm ? parseInt(mm[1], 10) : undefined;
      if (typeof days === 'number') {
        const prov: Provenance[] = [ { type:'artifact', docId, section:'compliance', path: `/api/contracts/${docId}/artifacts/compliance.json`, policyId:'TERMINATION_NOTICE' } ];
        sources.push(...prov);
        return { ok: true, kind:'metrics', metrics: [{ label: 'Notice period', value: days, unit: 'days', provenance: prov }], sources };
      }
    }
  return { ok: false, kind:'findings', error: 'Notice period not found', findings: [], sources };
  }

  if (/gdpr|data\s*protection|privacy/i.test(ql)) {
    const clauses: any[] = Array.isArray(bundle?.clauses?.clauses) ? bundle.clauses.clauses : [];
    const hits = clauses.filter(c => textIncludes(c?.text, /gdpr|general data protection|data\s+protection|privacy/i));
    const provBase: Provenance = { type:'artifact', docId, section:'clauses', path: `/api/contracts/${docId}/artifacts/clauses.json` };
    if (hits.length > 0) {
      const prov = hits.slice(0,3).map((c: any) => ({ ...provBase, clauseId: c?.clauseId, page: c?.page }));
    return { ok: true, kind: 'findings', findings: [{ title: 'GDPR clause present', description: `Found ${hits.length} matching clauses`, severity:'low', provenance: prov }], sources: prov } as any;
    }
    const prov = [ { ...provBase, note: 'No matches for gdpr|data protection|privacy' } ];
    return { ok: true, kind: 'findings', findings: [{ title: 'GDPR clause missing', description: 'No matching clauses found', severity:'medium', provenance: prov }], sources: prov } as any;
  }

  if (/blended|average/.test(ql) && /rate/i.test(ql)) {
  const rates: any[] = Array.isArray(bundle?.rates?.rates) ? bundle.rates.rates : [];
  const vals = rates.map(r => Number(normalizeDailyUSD(r) || 0)).filter(n => n>0);
    const blended = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
    const prov = [ { type:'artifact', docId, section:'rates', path:`/api/contracts/${docId}/artifacts/rates.json` } ];
    return { ok: true, kind: 'metrics', metrics: [{ label: 'Blended daily rate', value: blended, unit:'USD/day', provenance: prov }], sources: prov } as any;
  }

  // LLM fallback for contract scope
  const plan = await interpretWithLLM(q, 'contract', docId);
  if (plan) return execPlanContract(docId, plan, showPlan);

  return { ok: false, kind: 'findings', error: 'Query not recognized', findings: [], sources, ...(showPlan ? { debug: { docId, q } } : {}) } as any;
}

// Direct plan execution (power users / debug)
export function handlePortfolioPlan(plan: QueryPlan, opts?: { showPlan?: boolean }): QueryResult {
  return execPlanPortfolio(plan, !!opts?.showPlan);
}

export function handleContractPlan(docId: string, plan: QueryPlan, opts?: { showPlan?: boolean }): QueryResult {
  return execPlanContract(docId, plan, !!opts?.showPlan);
}
