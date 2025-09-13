// Canonical role ladder for Professional Services
export const CANONICAL_ROLES = [
    'Analyst',
    'Consultant',
    'Senior Consultant',
    'Manager',
    'Senior Manager',
    'Director',
    'Partner',
    'Category Manager',
    'Contract Specialist',
];

// Fuzzy map supplier titles to canonical roles
export function mapRole(raw: string): string {
    const r = (raw || '').toLowerCase();
    if (!r) return 'Consultant';
    if (/category\s*manager|category\s*lead/.test(r)) return 'Category Manager';
    if (/contract\s*specialist/.test(r)) return 'Contract Specialist';
    if (/data\/?reporting\s*analyst|reporting\s*analyst/.test(r)) return 'Analyst';
    if (/procurement\s*analyst/.test(r)) return 'Analyst';
    if (/analyst|associate|junior/.test(r)) return 'Analyst';
    if (/(sr\.?|senior)\s*(consultant|analyst)|lead\s*analyst/.test(r)) return 'Senior Consultant';
    if (/consultant|engineer|specialist/.test(r)) return 'Consultant';
    if (/manager|team lead/.test(r)) return 'Manager';
    if (/senior manager|principal/.test(r)) return 'Senior Manager';
    if (/director/.test(r)) return 'Director';
    if (/partner|vp|vice president/.test(r)) return 'Partner';
    return 'Consultant';
}

export function mapSeniority(raw: string): 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Partner' {
    const r = (raw || '').toLowerCase();
    if (/junior|jr\.?/.test(r)) return 'Junior';
    if (/(sr\.?|senior)/.test(r)) return 'Senior';
    if (/lead|principal|head/.test(r)) return 'Lead';
    if (/partner|vp|vice president/.test(r)) return 'Partner';
    return 'Mid';
}

// Detailed mapping with confidence score
export type RoleMapping = {
    role: string;
    seniority: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Partner';
    confidence: number; // 0..1
    matchedPattern?: string;
};

const PATTERNS: Array<{ re: RegExp; role: string; seniority?: RoleMapping['seniority']; weight: number }>= [
    { re: /\bjun(?:ior)?\b/, role: 'Analyst', seniority: 'Junior', weight: 0.8 },
    { re: /\b(analy(st|st ii|st i)|associate)\b/, role: 'Analyst', weight: 0.7 },
    { re: /\b(procurement\s*analyst)\b/, role: 'Analyst', weight: 0.9 },
    { re: /\b(data\/?reporting\s*analyst|reporting\s*analyst)\b/, role: 'Analyst', weight: 0.9 },
    { re: /\b(contract\s*specialist)\b/, role: 'Contract Specialist', weight: 0.9 },
    { re: /\bcategory\s*manager\b/, role: 'Category Manager', weight: 0.92 },
    { re: /\b(senior|sr\.?)[ -]?(consultant|engineer)\b/, role: 'Senior Consultant', seniority: 'Senior', weight: 0.9 },
    { re: /\bconsultant\b/, role: 'Consultant', weight: 0.8 },
    { re: /\b(manager|team lead)\b/, role: 'Manager', weight: 0.85 },
    { re: /\bsenior manager|principal\b/, role: 'Senior Manager', weight: 0.9 },
    { re: /\bdirector\b/, role: 'Director', weight: 0.9 },
    { re: /\b(partner|vp|vice president)\b/, role: 'Partner', seniority: 'Partner', weight: 0.95 },
];

export function mapRoleDetail(raw: string): RoleMapping {
    const text = (raw || '').toLowerCase();
    let best: RoleMapping | undefined;
    for (const p of PATTERNS) {
        if (p.re.test(text)) {
            const m: RoleMapping = {
                role: p.role,
                seniority: p.seniority ?? mapSeniority(raw),
                confidence: p.weight,
                matchedPattern: String(p.re),
            };
            if (!best || m.confidence > best.confidence) best = m;
        }
    }
    if (!best) {
        return { role: 'Consultant', seniority: mapSeniority(raw), confidence: 0.4 };
    }
    return best;
}
