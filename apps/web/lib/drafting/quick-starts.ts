export interface DraftingQuickStart {
  id: string;
  label: string;
  icon: string;
  desc: string;
  contractType: string;
  defaultTitle: string;
  searchTerms: string[];
  starterContent: string;
}

export const DRAFTING_QUICK_STARTS: DraftingQuickStart[] = [
  {
    id: 'nda',
    label: 'NDA',
    icon: '🔒',
    desc: 'Non-Disclosure Agreement',
    contractType: 'NDA',
    defaultTitle: 'NDA Draft',
    searchTerms: ['nda', 'non-disclosure', 'non disclosure', 'confidentiality'],
    starterContent: [
      '<h1>Mutual Non-Disclosure Agreement</h1>',
      '<p>This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of [Effective Date] by and between [Party A] and [Party B].</p>',
      '<h2>Purpose</h2>',
      '<p>The parties wish to evaluate a potential business relationship relating to [Project / Opportunity] and may disclose confidential information in that context.</p>',
      '<h2>Confidential Information</h2>',
      '<p>"Confidential Information" means non-public business, technical, financial, or commercial information disclosed by either party, whether in oral, written, electronic, or other form, that should reasonably be understood to be confidential.</p>',
      '<h2>Permitted Use and Protection</h2>',
      '<p>The receiving party shall use Confidential Information solely for the permitted purpose and shall protect it with at least the same degree of care it uses for its own confidential information, and in any event no less than reasonable care.</p>',
      '<h2>Exclusions</h2>',
      '<ul><li>Information already known without confidentiality restriction</li><li>Information that becomes public through no breach of this Agreement</li><li>Information lawfully received from a third party without restriction</li><li>Information independently developed without use of the Confidential Information</li></ul>',
      '<h2>Term and Return of Materials</h2>',
      '<p>This Agreement starts on the Effective Date and continues for [Term]. Upon request or termination, each party shall return or destroy the other party\'s Confidential Information, except where retention is required by law.</p>',
      '<h2>Governing Law</h2>',
      '<p>This Agreement is governed by the laws of [Jurisdiction].</p>',
      '<h2>Signatures</h2>',
      '<p>[Party A]</p><p>By: ______________________</p><p>[Party B]</p><p>By: ______________________</p>',
    ].join('\n'),
  },
  {
    id: 'msa',
    label: 'MSA',
    icon: '📋',
    desc: 'Master Services Agreement',
    contractType: 'MSA',
    defaultTitle: 'MSA Draft',
    searchTerms: ['msa', 'master services agreement', 'services agreement'],
    starterContent: [
      '<h1>Master Services Agreement</h1>',
      '<p>This Master Services Agreement ("Agreement") is entered into as of [Effective Date] by and between [Customer] and [Supplier].</p>',
      '<h2>Services</h2>',
      '<p>[Supplier] will provide the services described in each applicable statement of work, order form, or schedule entered into under this Agreement.</p>',
      '<h2>Commercial Terms</h2>',
      '<p>Fees, invoicing, and payment timing will be set out in the applicable order document. Unless otherwise agreed, invoices are due within [30] days of receipt.</p>',
      '<h2>Customer and Supplier Responsibilities</h2>',
      '<p>Each party will perform the responsibilities assigned to it under this Agreement and each applicable order document, including timely cooperation, access, approvals, and decision-making.</p>',
      '<h2>Confidentiality and Intellectual Property</h2>',
      '<p>Each party will protect the other party\'s confidential information and retain ownership of its pre-existing intellectual property, except as expressly agreed for deliverables.</p>',
      '<h2>Term and Termination</h2>',
      '<p>This Agreement begins on the Effective Date and continues until terminated in accordance with this Agreement. Either party may terminate for material breach if that breach is not cured within [30] days after written notice.</p>',
      '<h2>Liability and Indemnity</h2>',
      '<p>The parties will define liability caps, excluded losses, and indemnity obligations in this Agreement or the applicable order document.</p>',
      '<h2>Signatures</h2>',
      '<p>[Customer]</p><p>By: ______________________</p><p>[Supplier]</p><p>By: ______________________</p>',
    ].join('\n'),
  },
  {
    id: 'sow',
    label: 'SOW',
    icon: '📝',
    desc: 'Statement of Work',
    contractType: 'SOW',
    defaultTitle: 'SOW Draft',
    searchTerms: ['sow', 'statement of work', 'work order'],
    starterContent: [
      '<h1>Statement of Work</h1>',
      '<p>This Statement of Work ("SOW") is issued under the Master Services Agreement between [Customer] and [Supplier].</p>',
      '<h2>Project Overview</h2>',
      '<p>The purpose of this SOW is to describe the services, deliverables, milestones, assumptions, and commercial terms for [Project Name].</p>',
      '<h2>Scope of Services</h2>',
      '<p>[Supplier] will perform the following services: [Describe services and scope].</p>',
      '<h2>Deliverables and Milestones</h2>',
      '<table><thead><tr><th>Milestone</th><th>Deliverable</th><th>Owner</th><th>Target Date</th></tr></thead><tbody><tr><td>[Milestone 1]</td><td>[Deliverable]</td><td>[Owner]</td><td>[Date]</td></tr><tr><td>[Milestone 2]</td><td>[Deliverable]</td><td>[Owner]</td><td>[Date]</td></tr></tbody></table>',
      '<h2>Dependencies and Assumptions</h2>',
      '<p>This SOW is based on the following assumptions, dependencies, and customer-provided inputs: [List assumptions].</p>',
      '<h2>Fees and Invoicing</h2>',
      '<p>Fees for the services under this SOW are [Time and Materials / Fixed Fee] and will be invoiced according to the following schedule: [Invoicing schedule].</p>',
      '<h2>Acceptance</h2>',
      '<p>Deliverables will be deemed accepted if [Customer] does not notify [Supplier] of material non-conformity within [10] business days after delivery.</p>',
      '<h2>Signatures</h2>',
      '<p>[Customer]</p><p>By: ______________________</p><p>[Supplier]</p><p>By: ______________________</p>',
    ].join('\n'),
  },
  {
    id: 'employment',
    label: 'Employment',
    icon: '👥',
    desc: 'Employment Contract',
    contractType: 'EMPLOYMENT',
    defaultTitle: 'Employment Contract Draft',
    searchTerms: ['employment', 'employment contract', 'job offer', 'employee'],
    starterContent: [
      '<h1>Employment Agreement</h1>',
      '<p>This Employment Agreement is entered into as of [Effective Date] between [Employer] and [Employee].</p>',
      '<h2>Position and Duties</h2>',
      '<p>[Employee] will serve as [Job Title] and will perform the duties reasonably assigned by [Manager / Department]. The primary place of work will be [Location].</p>',
      '<h2>Compensation and Benefits</h2>',
      '<p>[Employee] will receive a base salary of [Amount] payable in accordance with the Employer\'s standard payroll practices, together with any bonus, commission, or benefit arrangements expressly described in this Agreement or the Employer\'s policies.</p>',
      '<h2>Working Time and Leave</h2>',
      '<p>Working hours, holiday entitlement, sick leave, and other leave arrangements will apply as set out in Employer policy and applicable law, except as otherwise stated in this Agreement.</p>',
      '<h2>Confidentiality and Intellectual Property</h2>',
      '<p>[Employee] will keep confidential information strictly confidential and assign to [Employer] any work product or intellectual property created within the scope of employment, to the extent permitted by law.</p>',
      '<h2>Termination</h2>',
      '<p>Either party may terminate employment by giving [Notice Period] written notice, subject to any immediate termination rights available under applicable law or this Agreement.</p>',
      '<h2>Restrictive Covenants</h2>',
      '<p>Any non-solicitation, non-compete, or related post-termination restrictions will apply only to the extent enforceable under applicable law and as expressly stated in this Agreement.</p>',
      '<h2>Signatures</h2>',
      '<p>[Employer]</p><p>By: ______________________</p><p>[Employee]</p><p>By: ______________________</p>',
    ].join('\n'),
  },
];

export function resolveDraftingQuickStart(type?: string | null): DraftingQuickStart | null {
  const normalizedType = type?.trim().toLowerCase();
  if (!normalizedType) return null;

  return (
    DRAFTING_QUICK_STARTS.find((quickStart) => {
      if (quickStart.id === normalizedType) return true;
      if (quickStart.contractType.toLowerCase() === normalizedType) return true;
      return quickStart.searchTerms.includes(normalizedType);
    }) || null
  );
}