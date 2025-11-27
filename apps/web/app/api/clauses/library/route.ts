import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock library clauses matching the contract editor's LibraryClause type
const mockLibraryClauses = [
  {
    id: 'lib1',
    tenantId: 'demo',
    name: 'standard_indemnification',
    title: 'Standard Indemnification',
    category: 'INDEMNIFICATION',
    content: 'Each party shall indemnify, defend, and hold harmless the other party, its officers, directors, employees, and agents from and against any and all claims, damages, losses, and expenses arising out of or resulting from the indemnifying party\'s breach of this Agreement or negligence.',
    riskLevel: 'MEDIUM',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['indemnification', 'standard'],
    usageCount: 45,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lib2',
    tenantId: 'demo',
    name: 'data_protection',
    title: 'Data Protection & GDPR',
    category: 'DATA_PROTECTION',
    content: 'The parties agree to comply with all applicable data protection laws, including but not limited to the General Data Protection Regulation (GDPR). Each party shall implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk involved in processing personal data.',
    riskLevel: 'HIGH',
    isStandard: true,
    isMandatory: true,
    isNegotiable: false,
    tags: ['gdpr', 'data', 'privacy', 'mandatory'],
    usageCount: 78,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lib3',
    tenantId: 'demo',
    name: 'force_majeure',
    title: 'Force Majeure',
    category: 'FORCE_MAJEURE',
    content: 'Neither party shall be liable for any failure or delay in performing its obligations under this Agreement if such failure or delay results from circumstances beyond the reasonable control of that party, including but not limited to acts of God, natural disasters, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, or pandemics.',
    riskLevel: 'LOW',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['force majeure', 'acts of god'],
    usageCount: 56,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lib4',
    tenantId: 'demo',
    name: 'confidentiality',
    title: 'Confidentiality',
    category: 'CONFIDENTIALITY',
    content: 'Each party agrees to maintain in strict confidence all Confidential Information disclosed by the other party, and to use such information solely for the purposes of this Agreement. "Confidential Information" means any non-public, proprietary information, including but not limited to trade secrets, technical data, and business information.',
    riskLevel: 'MEDIUM',
    isStandard: true,
    isMandatory: true,
    isNegotiable: true,
    tags: ['confidentiality', 'nda', 'proprietary'],
    usageCount: 92,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lib5',
    tenantId: 'demo',
    name: 'limitation_of_liability',
    title: 'Limitation of Liability',
    category: 'LIABILITY',
    content: 'IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, REGARDLESS OF THE CAUSE OF ACTION OR WHETHER SUCH PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. EACH PARTY\'S TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.',
    riskLevel: 'HIGH',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['liability', 'limitation', 'damages', 'cap'],
    usageCount: 67,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lib6',
    tenantId: 'demo',
    name: 'dispute_resolution',
    title: 'Dispute Resolution',
    category: 'DISPUTE_RESOLUTION',
    content: 'Any dispute arising out of or in connection with this Agreement shall first be attempted to be resolved through good faith negotiations between the parties. If negotiations fail, the parties agree to submit the dispute to binding arbitration under the rules of the [Arbitration Body], with the arbitration to take place in [Location].',
    riskLevel: 'MEDIUM',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['dispute', 'arbitration', 'resolution'],
    usageCount: 34,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lib7',
    tenantId: 'demo',
    name: 'intellectual_property',
    title: 'Intellectual Property Rights',
    category: 'IP_RIGHTS',
    content: 'All intellectual property rights in any work product, deliverables, or materials created by Supplier in the performance of this Agreement shall be the exclusive property of the Client. Supplier hereby assigns all right, title, and interest in such intellectual property to the Client upon creation.',
    riskLevel: 'HIGH',
    isStandard: true,
    isMandatory: true,
    isNegotiable: true,
    tags: ['ip', 'intellectual property', 'ownership', 'assignment'],
    usageCount: 51,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'lib8',
    tenantId: 'demo',
    name: 'termination_for_cause',
    title: 'Termination for Cause',
    category: 'TERMINATION',
    content: 'Either party may terminate this Agreement immediately upon written notice if the other party: (a) materially breaches this Agreement and fails to cure such breach within thirty (30) days after receipt of written notice; (b) becomes insolvent or files for bankruptcy; or (c) engages in any fraudulent or illegal activity.',
    riskLevel: 'MEDIUM',
    isStandard: true,
    isMandatory: false,
    isNegotiable: true,
    tags: ['termination', 'breach', 'cause'],
    usageCount: 43,
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// GET /api/clauses/library - Get clause library
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const mandatory = searchParams.get('mandatory');

    // Try to get clauses from database
    try {
      // When Clause model is added to schema:
      // const clauses = await prisma.clause.findMany({
      //   where: {
      //     isLibrary: true,
      //     ...(category && { category }),
      //     ...(mandatory === 'true' && { isMandatory: true }),
      //   },
      //   orderBy: { usageCount: 'desc' },
      // });
      // if (clauses.length > 0) {
      //   return NextResponse.json({ clauses, source: 'database' });
      // }
    } catch (dbError) {
      console.warn('Database lookup failed:', dbError);
    }

    // Filter mock data
    let filteredClauses = [...mockLibraryClauses];
    
    if (category) {
      filteredClauses = filteredClauses.filter(c => c.category === category);
    }
    
    if (mandatory === 'true') {
      filteredClauses = filteredClauses.filter(c => c.isMandatory);
    }

    return NextResponse.json({ 
      clauses: filteredClauses,
      source: 'mock'
    });
  } catch (error) {
    console.error('Error fetching clause library:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clause library' },
      { status: 500 }
    );
  }
}

// POST /api/clauses/library - Add clause to library
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      title, 
      category, 
      content, 
      riskLevel = 'MEDIUM',
      isStandard = false,
      isMandatory = false,
      isNegotiable = true,
      tags = [],
    } = body;

    const newClause = {
      id: `lib-${Date.now()}`,
      tenantId: 'demo',
      name,
      title,
      category,
      content,
      riskLevel,
      isStandard,
      isMandatory,
      isNegotiable,
      tags,
      usageCount: 0,
      createdBy: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Try to save to database when schema is available
    // try {
    //   const clause = await prisma.clause.create({
    //     data: {
    //       ...newClause,
    //       isLibrary: true,
    //     },
    //   });
    //   return NextResponse.json({ clause, source: 'database' });
    // } catch (dbError) {
    //   console.warn('Database save failed:', dbError);
    // }

    return NextResponse.json({ 
      clause: newClause,
      source: 'mock'
    });
  } catch (error) {
    console.error('Error adding clause to library:', error);
    return NextResponse.json(
      { error: 'Failed to add clause to library' },
      { status: 500 }
    );
  }
}
