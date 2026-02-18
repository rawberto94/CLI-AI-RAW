import { prisma } from '@/lib/prisma';

// Fetch contract details directly from database when contractId is provided
// ENHANCED: Now includes ALL artifact types for comprehensive AI context
// UPDATED: Uses official schema fields (external_parties, tcv_amount, start_date, end_date)
export async function getContractContext(contractId: string): Promise<string> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artifacts: {
          select: {
            type: true,
            data: true,
            updatedAt: true },
          // Get ALL artifacts, not just 5
        },
        // Include parent and child contracts for hierarchy context
        parentContract: {
          select: {
            id: true,
            contractTitle: true,
            fileName: true,
            contractType: true,
            status: true,
            clientName: true,
            supplierName: true,
            totalValue: true,
            effectiveDate: true,
            expirationDate: true } },
        childContracts: {
          select: {
            id: true,
            contractTitle: true,
            fileName: true,
            contractType: true,
            status: true,
            relationshipType: true,
            clientName: true,
            supplierName: true,
            totalValue: true,
            effectiveDate: true,
            expirationDate: true },
          orderBy: { createdAt: 'desc' },
          take: 20, // Limit to prevent context overflow
        } } });

    if (!contract) return '';

    // Parse aiMetadata for official schema fields
    const aiMeta = typeof contract.aiMetadata === 'object' && contract.aiMetadata 
      ? (contract.aiMetadata as any) 
      : {};
    
    // Build parties list from external_parties (official schema) or fallback to legacy
    const externalParties = aiMeta.external_parties || [];
    const partiesList = externalParties.length > 0
      ? externalParties.map((p: { legalName?: string; name?: string; role?: string }) => `${p.legalName}${p.role ? ` (${p.role})` : ''}`).join(', ')
      : contract.supplierName || contract.clientName || 'Not specified';

    let context = `\n\n**Current Contract Details:**\n`;
    context += `• Name: ${aiMeta.document_title || contract.contractTitle || contract.fileName}\n`;
    context += `• Status: ${contract.status}\n`;
    context += `• Parties: ${partiesList}\n`;
    context += `• Type: ${contract.category || contract.contractType || 'Not specified'}\n`;
    
    // Use official schema date fields with fallback
    const startDate = aiMeta.start_date || contract.startDate;
    const endDate = aiMeta.end_date || contract.endDate;
    if (startDate) context += `• Start Date: ${typeof startDate === 'string' ? startDate : startDate.toLocaleDateString()}\n`;
    if (endDate) context += `• End Date: ${typeof endDate === 'string' ? endDate : endDate.toLocaleDateString()}\n`;
    
    // Use official schema TCV field with fallback
    const tcvAmount = aiMeta.tcv_amount || contract.totalValue;
    if (tcvAmount) {
      const currency = aiMeta.currency || contract.currency || 'USD';
      context += `• Total Contract Value: ${currency} ${Number(tcvAmount).toLocaleString()}\n`;
    }
    
    // Add jurisdiction and language if available (official schema)
    if (aiMeta.jurisdiction) context += `• Jurisdiction: ${aiMeta.jurisdiction}\n`;
    if (aiMeta.contract_language) context += `• Language: ${aiMeta.contract_language}\n`;
    if (aiMeta.notice_period) context += `• Notice Period: ${aiMeta.notice_period}\n`;

    // Contract Hierarchy Context
    const parentContract = (contract as any).parentContract;
    const childContracts = (contract as any).childContracts || [];
    
    if (parentContract || childContracts.length > 0) {
      context += `\n**Contract Hierarchy:**\n`;
      
      if (parentContract) {
        const parentName = parentContract.contractTitle || parentContract.fileName || 'Untitled';
        const parentType = parentContract.contractType || 'Contract';
        const relType = contract.relationshipType ? ` (${contract.relationshipType.replace(/_/g, ' ')})` : '';
        context += `• Parent Contract${relType}: ${parentName} (${parentType})\n`;
        context += `  - ID: ${parentContract.id}\n`;
        if (parentContract.clientName || parentContract.supplierName) {
          context += `  - Party: ${parentContract.clientName || parentContract.supplierName}\n`;
        }
        if (parentContract.totalValue) {
          context += `  - Value: ${Number(parentContract.totalValue).toLocaleString()}\n`;
        }
        if (parentContract.status) {
          context += `  - Status: ${parentContract.status}\n`;
        }
      }
      
      if (childContracts.length > 0) {
        context += `• Child Contracts (${childContracts.length}):\n`;
        const totalChildValue = childContracts.reduce((sum: number, c: { totalValue?: number; contractTitle?: string; name?: string; status?: string; id?: string }) => sum + (Number(c.totalValue) || 0), 0);
        if (totalChildValue > 0) {
          context += `  - Combined Value: ${totalChildValue.toLocaleString()}\n`;
        }
        childContracts.slice(0, 10).forEach((child: { contractTitle?: string; fileName?: string; contractType?: string; relationshipType?: string; status?: string; totalValue?: number }) => {
          const childName = child.contractTitle || child.fileName || 'Untitled';
          const childType = child.contractType || child.relationshipType || 'Contract';
          context += `  - ${childName} (${childType.replace(/_/g, ' ')}) - ${child.status}`;
          if (child.totalValue) context += ` - $${Number(child.totalValue).toLocaleString()}`;
          context += `\n`;
        });
        if (childContracts.length > 10) {
          context += `  - ... and ${childContracts.length - 10} more\n`;
        }
      }
    }

    // Comprehensive artifact context builder
    if (contract.artifacts && contract.artifacts.length > 0) {
      context += `\n**Extracted Contract Intelligence (${contract.artifacts.length} artifacts):**\n`;
      
      for (const artifact of contract.artifacts) {
        try {
          const data = typeof artifact.data === 'string' 
            ? JSON.parse(artifact.data) 
            : artifact.data;
          
          if (!data) continue;
          
          switch (artifact.type) {
            case 'OVERVIEW':
              context += `\n### Contract Overview\n`;
              if (data.summary) context += `**Summary:** ${String(data.summary).slice(0, 800)}\n`;
              if (data.keyTerms?.length) context += `**Key Terms:** ${data.keyTerms.slice(0, 10).join(', ')}\n`;
              // Use external_parties from schema or fall back to overview parties
              if (externalParties.length > 0) {
                context += `**Parties:** ${externalParties.map((p: { legalName?: string; name?: string; role?: string }) => `${p.legalName} (${p.role || 'Party'})`).join(', ')}\n`;
              } else if (data.parties?.length) {
                context += `**Parties:** ${data.parties.map((p: { legalName?: string; name?: string; role?: string }) => p.name || p).join(', ')}\n`;
              }
              // Use schema dates or artifact dates
              const overviewStartDate = aiMeta.start_date || data.effectiveDate || data.start_date;
              const overviewEndDate = aiMeta.end_date || data.expirationDate || data.end_date;
              if (overviewStartDate) context += `**Start Date:** ${overviewStartDate}\n`;
              if (overviewEndDate) context += `**End Date:** ${overviewEndDate}\n`;
              if (data.contractValue || aiMeta.tcv_amount) context += `**Contract Value:** ${aiMeta.tcv_amount || data.contractValue}\n`;
              if (data.governingLaw || aiMeta.jurisdiction) context += `**Governing Law:** ${aiMeta.jurisdiction || data.governingLaw}\n`;
              if (data.additionalFindings?.length) {
                context += `**Additional Findings:** ${data.additionalFindings.map((f: { field?: string; value?: unknown }) => `${f.field}: ${f.value}`).join('; ')}\n`;
              }
              if (data.openEndedNotes) context += `**Notes:** ${data.openEndedNotes}\n`;
              break;
              
            case 'CLAUSES':
              context += `\n### Key Clauses (${data.clauses?.length || 0} found)\n`;
              if (data.clauses?.length) {
                data.clauses.slice(0, 15).forEach((clause: { type?: string; risk?: string; importance?: string; title?: string; name?: string; content?: string; risks?: string[] }, i: number) => {
                  context += `${i + 1}. **${clause.title || clause.name}** (${clause.importance || 'medium'} priority)\n`;
                  if (clause.content) context += `   ${String(clause.content).slice(0, 200)}\n`;
                  if (clause.risks?.length) context += `   ⚠️ Risks: ${clause.risks.join(', ')}\n`;
                });
              }
              if (data.missingClauses?.length) context += `**Missing Clauses:** ${data.missingClauses.join(', ')}\n`;
              if (data.unusualClauses?.length) context += `**Unusual Clauses:** ${data.unusualClauses.join(', ')}\n`;
              if (data.additionalFindings?.length) {
                context += `**Additional Clause Findings:** ${data.additionalFindings.map((f: { field?: string; value?: unknown }) => f.value).join('; ')}\n`;
              }
              break;
              
            case 'FINANCIAL':
              context += `\n### Financial Terms\n`;
              if (data.totalValue) context += `**Total Value:** ${data.currency || 'USD'} ${Number(data.totalValue).toLocaleString()}\n`;
              if (data.paymentTerms) context += `**Payment Terms:** ${data.paymentTerms}\n`;
              if (data.rateCards?.length) {
                context += `**Rate Cards (${data.rateCards.length}):**\n`;
                data.rateCards.slice(0, 10).forEach((rate: { role?: string; rate?: number; currency?: string; unit?: string }) => {
                  context += `  • ${rate.role}: ${rate.currency || 'USD'} ${rate.rate}/${rate.unit || 'hour'}\n`;
                });
              }
              if (data.penalties?.length) {
                context += `**Penalties:** ${data.penalties.map((p: { description?: string; type?: string }) => p.description || p.type).join('; ')}\n`;
              }
              if (data.discounts?.length) {
                context += `**Discounts:** ${data.discounts.map((d: { value?: number; unit?: string; description?: string; type?: string }) => `${d.value}${d.unit === 'percentage' ? '%' : ''} ${d.description || d.type}`).join('; ')}\n`;
              }
              if (data.additionalFindings?.length) {
                context += `**Additional Financial Info:** ${data.additionalFindings.map((f: { field?: string; value?: unknown }) => `${f.field}: ${f.value}`).join('; ')}\n`;
              }
              break;
              
            case 'RISK':
              context += `\n### Risk Assessment\n`;
              context += `**Overall Risk:** ${data.overallRisk || data.riskLevel || 'Unknown'} (Score: ${data.riskScore || data.overallScore || 'N/A'}/100)\n`;
              if (data.risks?.length || data.riskFactors?.length) {
                const risks = data.risks || data.riskFactors || [];
                context += `**Risk Factors (${risks.length}):**\n`;
                risks.slice(0, 8).forEach((risk: { level?: string; severity?: string; factor?: string; description?: string; mitigation?: string; title?: string; category?: string }) => {
                  context += `  • [${risk.level || risk.severity || 'medium'}] ${risk.title || risk.category}: ${String(risk.description).slice(0, 150)}\n`;
                  if (risk.mitigation) context += `    → Mitigation: ${String(risk.mitigation).slice(0, 100)}\n`;
                });
              }
              if (data.redFlags?.length) context += `**Red Flags:** ${data.redFlags.join('; ')}\n`;
              if (data.missingProtections?.length) context += `**Missing Protections:** ${data.missingProtections.join('; ')}\n`;
              break;
              
            case 'COMPLIANCE':
              context += `\n### Compliance Status\n`;
              context += `**Compliance Score:** ${data.complianceScore || data.score || 'N/A'}%\n`;
              if (data.checks?.length) {
                context += `**Compliance Checks:**\n`;
                data.checks.slice(0, 10).forEach((check: { regulation?: string; status?: string; requirement?: string }) => {
                  const icon = check.status === 'compliant' ? '✅' : check.status === 'non-compliant' ? '❌' : '⚠️';
                  context += `  ${icon} ${check.regulation}: ${check.status}\n`;
                });
              }
              if (data.issues?.length) {
                context += `**Issues:** ${data.issues.map((i: { severity?: string; description?: string }) => `[${i.severity}] ${i.description}`).join('; ')}\n`;
              }
              break;
              
            case 'OBLIGATIONS':
              context += `\n### Obligations & Milestones\n`;
              if (data.obligations?.length) {
                context += `**Obligations (${data.obligations.length}):**\n`;
                data.obligations.slice(0, 10).forEach((ob: { party?: string; obligation?: string; title?: string; type?: string; dueDate?: string }) => {
                  context += `  • ${ob.party}: ${ob.obligation || ob.title} (${ob.type || 'general'})`;
                  if (ob.dueDate) context += ` - Due: ${ob.dueDate}`;
                  context += `\n`;
                });
              }
              if (data.milestones?.length) {
                context += `**Milestones (${data.milestones.length}):**\n`;
                data.milestones.slice(0, 8).forEach((m: { name?: string; dueDate?: string; date?: string }) => {
                  context += `  • ${m.name}: ${m.dueDate || m.date || 'No date'}\n`;
                });
              }
              if (data.keyDeadlines?.length) context += `**Key Deadlines:** ${data.keyDeadlines.join(', ')}\n`;
              break;
              
            case 'RENEWAL':
              context += `\n### Renewal & Termination\n`;
              context += `**Auto-Renewal:** ${data.autoRenewal ? 'Yes' : 'No'}\n`;
              if (data.renewalTerms) context += `**Renewal Terms:** ${typeof data.renewalTerms === 'string' ? data.renewalTerms : data.renewalTerms.renewalPeriod || JSON.stringify(data.renewalTerms)}\n`;
              if (data.expirationDate) context += `**Expiration Date:** ${data.expirationDate}\n`;
              if (data.noticeRequirements?.noticePeriod) context += `**Notice Required:** ${data.noticeRequirements.noticePeriod}\n`;
              if (data.terminationRights) {
                context += `**Termination Rights:** For cause: ${data.terminationRights.forCause || 'Yes'}; For convenience: ${data.terminationRights.forConvenience || 'Check contract'}\n`;
              }
              if (data.earlyTerminationFees) context += `**Early Termination Fees:** ${data.earlyTerminationFees}\n`;
              break;
              
            case 'NEGOTIATION_POINTS':
              context += `\n### Negotiation Analysis\n`;
              context += `**Favorability Score:** ${data.favorabilityScore || 'N/A'}/100\n`;
              if (data.favorabilityAssessment) context += `**Assessment:** ${data.favorabilityAssessment}\n`;
              if (data.negotiationPoints?.length) {
                context += `**Points to Negotiate (${data.negotiationPoints.length}):**\n`;
                data.negotiationPoints.slice(0, 5).forEach((np: { priority?: string; clause?: string; concern?: string; suggestedChange?: string }) => {
                  context += `  • [${np.priority}] ${np.clause}: ${np.concern}\n`;
                  if (np.suggestedChange) context += `    → Suggest: ${String(np.suggestedChange).slice(0, 100)}\n`;
                });
              }
              if (data.strongPoints?.length) context += `**Strong Points:** ${data.strongPoints.slice(0, 5).join('; ')}\n`;
              if (data.imbalances?.length) context += `**Imbalances:** ${data.imbalances.slice(0, 5).join('; ')}\n`;
              break;
              
            case 'AMENDMENTS':
              context += `\n### Amendments History\n`;
              if (data.amendments?.length) {
                context += `**Amendments (${data.amendments.length}):**\n`;
                data.amendments.forEach((a: { number?: string; title?: string; summary?: string; date?: string }) => {
                  context += `  • ${a.number || a.title}: ${a.summary || 'See details'} (${a.date || 'No date'})\n`;
                });
              } else {
                context += `No amendments recorded.\n`;
              }
              break;
              
            case 'CONTACTS':
              context += `\n### Key Contacts\n`;
              if (data.contacts?.length) {
                data.contacts.slice(0, 8).forEach((c: { name?: string; role?: string; partyType?: string; email?: string; phone?: string }) => {
                  context += `  • ${c.name} (${c.role || c.partyType}): ${c.email || c.phone || 'No contact info'}\n`;
                });
              }
              if (data.signatories?.length) {
                context += `**Signatories:** ${data.signatories.map((s: { name?: string; title?: string }) => `${s.name} (${s.title})`).join(', ')}\n`;
              }
              break;
              
            default:
              // Handle any other artifact types dynamically
              context += `\n### ${artifact.type}\n`;
              context += `Data available: ${Object.keys(data).slice(0, 10).join(', ')}\n`;
          }
          
        } catch {
          // Skip if can't parse artifact
        }
      }
    }

    // Add last updated timestamp
    const latestArtifact = contract.artifacts?.reduce((latest: { updatedAt?: Date } | null, a: { updatedAt?: Date }) => 
      !latest || (a.updatedAt && a.updatedAt > (latest.updatedAt ?? new Date(0))) ? a : latest, null);
    if (latestArtifact?.updatedAt) {
      context += `\n---\n*Artifacts last updated: ${latestArtifact.updatedAt.toLocaleString()}*\n`;
    }

    return context;
  } catch {
    return '';
  }
}
