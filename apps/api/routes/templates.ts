/**
 * Template Intelligence API Routes
 * Endpoints for template detection, analysis, and standardization
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../src/errors';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Request validation schemas
const TemplateDetectionSchema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
  tenantId: z.string().default('default')
});

const TemplateAnalysisSchema = z.object({
  content: z.string().min(1),
  templateId: z.string(),
  tenantId: z.string().default('default')
});

const TemplateStandardizationSchema = z.object({
  content: z.string().min(1),
  templateId: z.string(),
  tenantId: z.string().default('default'),
  fieldValues: z.record(z.any()).optional()
});

const TemplateCreationSchema = z.object({
  content: z.string().min(1),
  templateName: z.string(),
  templateType: z.enum(['service-agreement', 'nda', 'employment', 'purchase-order', 'lease', 'license', 'partnership', 'other']),
  tenantId: z.string().default('default'),
  description: z.string().optional(),
  category: z.string().optional(),
  complianceRequirements: z.array(z.string()).optional()
});

interface MockResult {
  documentId: any;
  operation: any;
  confidence: number;
  processingTime: number;
  suggestions: string[];
  riskFactors: any[];
  templateMatches?: any[];
  complianceAnalysis?: any;
  standardizedDocument?: any;
  newTemplate?: any;
}

/**
 * POST /api/templates/detect
 * Detect template matches for a document
 */
router.post('/detect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, title, tenantId } = TemplateDetectionSchema.parse(req.body);

    // Use template worker for processing
    const workerResult = await processWithTemplateWorker({
      documentId: `detect_${Date.now()}`,
      content,
      title,
      tenantId,
      operation: 'detect'
    });

    res.json({
      success: true,
      data: {
        matches: workerResult.templateMatches || [],
        confidence: workerResult.confidence,
        suggestions: workerResult.suggestions,
        riskFactors: workerResult.riskFactors,
        processingTime: workerResult.processingTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/analyze
 * Analyze template compliance for a document
 */
router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, templateId, tenantId } = TemplateAnalysisSchema.parse(req.body);

    const workerResult = await processWithTemplateWorker({
      documentId: `analyze_${Date.now()}`,
      content,
      templateId,
      tenantId,
      operation: 'analyze'
    });

    res.json({
      success: true,
      data: {
        compliance: workerResult.complianceAnalysis || {},
        confidence: workerResult.confidence,
        suggestions: workerResult.suggestions,
        riskFactors: workerResult.riskFactors,
        processingTime: workerResult.processingTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/standardize
 * Generate standardized version of a document
 */
router.post('/standardize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, templateId, tenantId, fieldValues } = TemplateStandardizationSchema.parse(req.body);

    const workerResult = await processWithTemplateWorker({
      documentId: `standardize_${Date.now()}`,
      content,
      templateId,
      tenantId,
      operation: 'standardize',
      metadata: { fieldValues }
    });

    res.json({
      success: true,
      data: {
        standardizedDocument: workerResult.standardizedDocument || {},
        confidence: workerResult.confidence,
        suggestions: workerResult.suggestions,
        riskFactors: workerResult.riskFactors,
        processingTime: workerResult.processingTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/create
 * Create a new template from a document
 */
router.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, templateName, templateType, tenantId, description, category, complianceRequirements } = 
      TemplateCreationSchema.parse(req.body);

    const workerResult = await processWithTemplateWorker({
      documentId: `create_${Date.now()}`,
      content,
      tenantId,
      operation: 'create-template',
      metadata: {
        templateName,
        templateType,
        description,
        category,
        complianceRequirements
      }
    });

    res.json({
      success: true,
      data: {
        template: workerResult.newTemplate || {},
        confidence: workerResult.confidence,
        suggestions: workerResult.suggestions,
        processingTime: workerResult.processingTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates
 * Get available templates for a tenant
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.query.tenantId as string || 'default';
    
    // This would query templates from the database
    // For now, return mock data
    const templates = [
      {
        id: 'std-nda',
        name: 'Non-Disclosure Agreement',
        type: 'nda',
        category: 'confidentiality',
        version: '1.0.0',
        usage: { totalDocuments: 45, successRate: 0.92, avgConfidence: 0.87 }
      },
      {
        id: 'std-service-agreement',
        name: 'Service Agreement',
        type: 'service-agreement',
        category: 'services',
        version: '1.0.0',
        usage: { totalDocuments: 23, successRate: 0.89, avgConfidence: 0.84 }
      }
    ];

    res.json({
      success: true,
      data: { templates }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/:templateId
 * Get specific template details
 */
router.get('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params;
    const tenantId = req.query.tenantId as string || 'default';

    // This would query the specific template from the database
    // For now, return mock data
    if (templateId === 'std-nda') {
      const template = {
        id: 'std-nda',
        name: 'Non-Disclosure Agreement',
        type: 'nda',
        category: 'confidentiality',
        version: '1.0.0',
        description: 'Standard non-disclosure agreement template',
        signature: {
          keyPhrases: ['confidential information', 'non-disclosure', 'proprietary', 'trade secrets'],
          sectionHeaders: ['definitions', 'confidential information', 'obligations', 'term'],
          confidenceThreshold: 0.7
        },
        standardClauses: [
          {
            id: 'nda-definition',
            name: 'Definition of Confidential Information',
            type: 'mandatory',
            riskLevel: 'high'
          },
          {
            id: 'nda-obligations',
            name: 'Recipient Obligations',
            type: 'mandatory',
            riskLevel: 'high'
          }
        ],
        riskProfile: {
          overallRisk: 'medium',
          riskFactors: ['Information scope definition', 'Term duration'],
          reviewRequirements: ['Legal review for broad definitions']
        },
        usage: { totalDocuments: 45, successRate: 0.92, avgConfidence: 0.87 }
      };

      res.json({
        success: true,
        data: { template }
      });
    } else {
      throw new AppError(404, 'Template not found');
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/templates/upload
 * Upload document for template analysis
 */
router.post('/upload', upload.single('document'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No document uploaded');
    }

    const { operation = 'detect', templateId, tenantId = 'default' } = req.body;
    const content = req.file.buffer.toString('utf-8');
    const title = req.file.originalname;

    const workerResult = await processWithTemplateWorker({
      documentId: `upload_${Date.now()}`,
      content,
      title,
      templateId,
      tenantId,
      operation
    });

    res.json({
      success: true,
      data: {
        filename: title,
        operation,
        result: workerResult,
        processingTime: workerResult.processingTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/templates/:templateId
 * Update template based on usage patterns
 */
router.put('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params;
    const { tenantId = 'default', usageData } = req.body;

    // This would update the template in the database
    // For now, return success response
    res.json({
      success: true,
      data: {
        templateId,
        message: 'Template updated successfully',
        version: '1.0.1'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/templates/:templateId
 * Delete a custom template
 */
router.delete('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params;
    const { tenantId = 'default' } = req.query;

    // Only allow deletion of custom templates, not standard ones
    if (templateId.startsWith('std-')) {
      throw new AppError(403, 'Cannot delete standard templates');
    }

    // This would delete the template from the database
    // For now, return success response
    res.json({
      success: true,
      data: {
        templateId,
        message: 'Template deleted successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper function to process requests with template worker
 */
async function processWithTemplateWorker(request: any): Promise<any> {
  try {
    // In a real implementation, this would use the actual worker
    // For now, return mock response based on operation
    const mockResult: MockResult = {
      documentId: request.documentId,
      operation: request.operation,
      confidence: 0.85,
      processingTime: 1250,
      suggestions: [
        `Template ${request.operation} completed successfully`,
        'Document analysis shows good structure compliance'
      ],
      riskFactors: []
    };

    switch (request.operation) {
      case 'detect':
        mockResult.templateMatches = [
          {
            templateId: 'std-nda',
            confidence: 0.87,
            matchedElements: {
              keyPhrases: 0.9,
              structuralPatterns: 0.8,
              sectionHeaders: 0.85,
              legalTerms: 0.9
            }
          }
        ];
        break;

      case 'analyze':
        mockResult.complianceAnalysis = {
          compliance: 0.82,
          deviations: [
            {
              type: 'missing-clause',
              severity: 'moderate',
              description: 'Standard termination clause not found',
              riskImpact: 'Medium risk - unclear termination process'
            }
          ],
          suggestions: [
            {
              type: 'add-clause',
              priority: 'medium',
              description: 'Add standard termination clause'
            }
          ]
        };
        break;

      case 'standardize':
        mockResult.standardizedDocument = {
          content: 'Standardized document content...',
          changes: [
            { type: 'added-clause', description: 'Added termination clause' },
            { type: 'formatted-section', description: 'Standardized payment terms format' }
          ],
          improvement: 0.15
        };
        break;

      case 'create-template':
        mockResult.newTemplate = {
          id: `custom_${Date.now()}`,
          name: request.metadata.templateName,
          type: request.metadata.templateType,
          version: '1.0.0',
          standardClauses: [],
          riskProfile: { overallRisk: 'medium' }
        };
        break;
    }

    return mockResult;
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(500, `Template worker error: ${error.message}`);
    }
    throw new AppError(500, 'An unknown error occurred in the template worker');
  }
}

export default router;