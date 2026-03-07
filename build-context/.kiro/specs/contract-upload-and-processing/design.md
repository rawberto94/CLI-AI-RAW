# Design Document

## Overview

This design leverages the existing robust service architecture to create a complete contract upload and processing pipeline. Rather than building from scratch, we'll wire together existing services (AI artifact generator, parallel processing, SSE connection manager, file integrity) and fill critical gaps (upload endpoint, AI integration, real-time progress) to transform the system from prototype to production-ready.

The design follows a pragmatic approach: use what works, fix what's broken, and add what's missing.

## Architecture

### High-Level Flow

```
┌─────────────┐
│   Browser   │
│  (Upload)   │
└──────┬──────┘
       │ POST /api/contracts/upload
       ▼
┌─────────────────────────────────────┐
│  Upload API Route Handler           │
│  - Validate file                    │
│  - Create contract record           │
│  - Store file securely              │
│  - Initiate processing              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Upload Orchestrator Service        │
│  (EXISTING - needs activation)      │
│  - Coordinate workflow              │
│  - Emit progress events             │
└──────┬──────────────────────────────┘
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       ▼                  ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ File         │  │ Processing   │  │ AI Artifact  │  │ SSE Progress │
│ Integrity    │  │ Job Service  │  │ Generator    │  │ Stream       │
│ (EXISTING)   │  │ (EXISTING)   │  │ (EXISTING)   │  │ (EXISTING)   │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │ Parallel     │
                                    │ Artifact Gen │
                                    │ (EXISTING)   │
                                    └──────────────┘
```

### Integration Points

**Existing Services to Leverage:**
- `chunked-upload.service.ts` - For large file handling
- `file-integrity.service.ts` - For SHA-256 validation
- `processing-job.service.ts` - For job tracking
- `ai-artifact-generator.service.ts` - Needs AI integration
- `parallel-artifact-generator.service.ts` - For concurrent processing
- `sse-connection-manager.service.ts` - For real-time updates
- `event-orchestrator.service.ts` - For event coordination
- `contract.service.ts` - For database operations

**New Components Needed:**
- `/api/contracts/upload` route handler
- AI service integration layer
- Progress event emitter
- Upload orchestration coordinator

## Components and Interfaces

### 1. Upload API Route (`apps/web/app/api/contracts/upload/route.ts`)

**Purpose:** Handle file uploads from the UI

**Interface:**
```typescript
POST /api/contracts/upload
Content-Type: multipart/form-data

Request Body:
- file: File (PDF or HTML)
- metadata?: {
    name?: string
    supplier?: string
    client?: string
  }

Response (Success):
{
  contractId: string
  status: "processing"
  progressStreamUrl: string
}

Response (Error):
{
  error: string
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "VALIDATION_FAILED"
  details?: string
}
```

**Implementation Strategy:**
```typescript
// Use Next.js 14 route handler
import { NextRequest } from 'next/server';
import { uploadOrchestrator } from '@/services/upload-orchestrator';
import { fileIntegrityService } from '@/services/file-integrity.service';

export async function POST(request: NextRequest) {
  // 1. Parse multipart form data
  // 2. Validate file (size, type)
  // 3. Calculate file hash using fileIntegrityService
  // 4. Create contract record via contract.service
  // 5. Store file securely
  // 6. Initiate processing via uploadOrchestrator
  // 7. Return contract ID and SSE stream URL
}
```

### 2. Upload Orchestrator Enhancement

**File:** `packages/data-orchestration/src/services/upload-artifact-orchestrator.service.ts` (EXISTS)

**Current State:** Service exists but doesn't orchestrate the full workflow

**Enhancements Needed:**
```typescript
class UploadArtifactOrchestrator {
  // EXISTING methods to keep
  
  // NEW: Main orchestration method
  async processUploadedContract(contractId: string): Promise<void> {
    // 1. Create processing job
    const job = await this.processingJobService.create({
      contractId,
      status: 'pending'
    });
    
    // 2. Emit initial progress event
    this.emitProgress(contractId, { stage: 'started', progress: 0 });
    
    // 3. Extract text from document
    this.emitProgress(contractId, { stage: 'extracting', progress: 10 });
    const documentText = await this.extractDocumentText(contractId);
    
    // 4. Trigger parallel artifact generation
    this.emitProgress(contractId, { stage: 'analyzing', progress: 30 });
    await this.parallelArtifactGenerator.generateAll(contractId, documentText);
    
    // 5. Update job status
    await this.processingJobService.complete(job.id);
    this.emitProgress(contractId, { stage: 'completed', progress: 100 });
  }
  
  private emitProgress(contractId: string, progress: ProgressEvent) {
    this.eventOrchestrator.emit('contract.processing.progress', {
      contractId,
      ...progress
    });
  }
}
```

### 3. AI Artifact Generator Integration

**File:** `packages/data-orchestration/src/services/ai-artifact-generator.service.ts` (EXISTS)

**Current Issue:** Generates empty artifacts instead of calling AI

**Solution:** Integrate with AI service (OpenAI, Anthropic, or local model)

```typescript
class AIArtifactGenerator {
  // EXISTING structure to keep
  
  // ENHANCE: Add actual AI integration
  async generateArtifact(
    type: ArtifactType,
    documentText: string,
    context: ArtifactContext
  ): Promise<Artifact> {
    // 1. Get appropriate prompt template
    const prompt = this.promptTemplateService.getTemplate(type, context);
    
    // 2. Call AI service (NEW integration)
    const aiResponse = await this.callAIService(prompt, documentText);
    
    // 3. Parse and validate response
    const parsedData = this.parseAIResponse(aiResponse, type);
    
    // 4. Calculate confidence scores
    const withConfidence = this.confidenceScoringService.score(parsedData);
    
    // 5. Store artifact
    return await this.enhancedArtifactService.create({
      contractId: context.contractId,
      type,
      data: withConfidence,
      version: 1
    });
  }
  
  private async callAIService(prompt: string, content: string): Promise<string> {
    // Integration point for AI service
    // Could use: OpenAI, Anthropic Claude, Azure OpenAI, or local model
    const apiKey = process.env.OPENAI_API_KEY;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: content }
        ],
        temperature: 0.1, // Low temperature for consistency
        response_format: { type: 'json_object' }
      })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

### 4. Real-Time Progress Stream

**File:** `apps/web/app/api/contracts/[id]/progress/route.ts` (NEW)

**Purpose:** SSE endpoint for real-time progress updates

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const contractId = params.id;
  
  // Use existing SSE connection manager
  const stream = sseConnectionManager.createStream(contractId);
  
  // Subscribe to progress events
  const unsubscribe = eventOrchestrator.on(
    'contract.processing.progress',
    (event) => {
      if (event.contractId === contractId) {
        stream.send({
          type: 'progress',
          data: event
        });
      }
    }
  );
  
  // Cleanup on disconnect
  request.signal.addEventListener('abort', () => {
    unsubscribe();
    stream.close();
  });
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### 5. Parallel Artifact Processing Enhancement

**File:** `packages/data-orchestration/src/services/parallel-artifact-generator.service.ts` (EXISTS)

**Current State:** Structure exists but needs workflow coordination

**Enhancement:**
```typescript
class ParallelArtifactGenerator {
  async generateAll(contractId: string, documentText: string): Promise<void> {
    // Define artifact types that can be processed in parallel
    const artifactTypes = [
      'rate_card',
      'contract_metadata',
      'financial_terms',
      'key_dates'
    ];
    
    // Process up to 4 in parallel (configurable)
    const concurrency = 4;
    const results = await pLimit(concurrency)(
      artifactTypes.map(type => 
        () => this.aiArtifactGenerator.generateArtifact(
          type,
          documentText,
          { contractId }
        )
      )
    );
    
    // Emit completion event
    this.eventOrchestrator.emit('contract.artifacts.generated', {
      contractId,
      artifactCount: results.length
    });
  }
}
```

## Data Models

### Existing Models (No Changes Needed)

The database schema already supports our needs:
- `Contract` table - stores contract metadata
- `Artifact` table - stores extracted artifacts
- `ProcessingJob` table - tracks processing status
- `ArtifactVersion` table - version history

### New Environment Variables

```env
# AI Service Configuration
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4-turbo-preview
AI_TEMPERATURE=0.1
AI_MAX_TOKENS=4000

# Processing Configuration
MAX_FILE_SIZE_MB=50
PARALLEL_ARTIFACT_LIMIT=4
PROCESSING_TIMEOUT_MS=300000

# Storage Configuration
UPLOAD_STORAGE_PATH=./uploads
```

## Error Handling

### Error Categories

1. **User-Correctable Errors**
   - File too large → "Please upload a file smaller than 50MB"
   - Invalid format → "Please upload a PDF or HTML file"
   - Missing required fields → "Please provide contract name"

2. **Transient Errors**
   - AI service timeout → Retry with exponential backoff
   - Database connection lost → Retry up to 3 times
   - Network issues → Retry with backoff

3. **System Errors**
   - AI service quota exceeded → Log and notify admin
   - Disk space full → Alert operations team
   - Parsing failures → Store raw data for manual review

### Error Recovery Strategy

```typescript
class ErrorRecoveryService {
  async handleProcessingError(
    error: Error,
    context: ProcessingContext
  ): Promise<RecoveryAction> {
    // Categorize error
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'transient':
        if (context.retryCount < 3) {
          return {
            action: 'retry',
            delay: Math.pow(2, context.retryCount) * 1000
          };
        }
        break;
        
      case 'user_correctable':
        return {
          action: 'notify_user',
          message: this.getUserFriendlyMessage(error)
        };
        
      case 'system':
        return {
          action: 'alert_admin',
          preserveData: true
        };
    }
  }
}
```

## Testing Strategy

### Unit Tests

**Existing test files to enhance:**
- `file-integrity.service.test.ts` - Add upload validation tests
- `processing-job.service.test.ts` - Add workflow tests

**New test files needed:**
- `upload-route.test.ts` - Test upload endpoint
- `ai-integration.test.ts` - Test AI service calls (with mocks)
- `progress-stream.test.ts` - Test SSE functionality

### Integration Tests

**Existing test to enhance:**
- `api-endpoints.test.ts` - Add upload endpoint tests

**New integration tests:**
```typescript
describe('Contract Upload Workflow', () => {
  it('should process uploaded contract end-to-end', async () => {
    // 1. Upload file
    const response = await uploadContract(testPDF);
    expect(response.contractId).toBeDefined();
    
    // 2. Connect to progress stream
    const progressEvents = await collectProgressEvents(response.contractId);
    
    // 3. Wait for completion
    await waitForProcessing(response.contractId);
    
    // 4. Verify artifacts created
    const artifacts = await getArtifacts(response.contractId);
    expect(artifacts).toHaveLength(4);
    expect(artifacts[0].data).not.toBeEmpty();
  });
});
```

### E2E Tests

**Existing test to enhance:**
- `contract-upload.e2e.spec.ts` - Add real-time progress verification

## Performance Considerations

### Optimization Strategies

1. **Parallel Processing**
   - Process independent artifacts concurrently (already implemented)
   - Limit concurrency to 4 to prevent resource exhaustion

2. **Caching**
   - Cache AI prompts (use existing `smart-cache.service.ts`)
   - Cache document text extraction results

3. **Streaming**
   - Use SSE for progress (existing infrastructure)
   - Stream large file uploads (use existing `chunked-upload.service.ts`)

4. **Resource Management**
   - Implement timeout for AI calls (5 minutes max)
   - Clean up SSE connections on completion
   - Use existing `resource-monitor.service.ts` for tracking

### Performance Targets

- File upload: < 2 seconds for 10MB file
- Initial response: < 500ms
- Progress updates: Every 2 seconds minimum
- Total processing: < 5 minutes for typical contract
- Parallel artifact generation: 4 concurrent tasks

## Security Considerations

### File Upload Security

**Leverage existing services:**
- `file-integrity.service.ts` - SHA-256 validation
- `input-validation.service.ts` - Input sanitization
- `security.middleware.ts` - Request validation

**Additional measures:**
```typescript
// File validation
const ALLOWED_MIME_TYPES = ['application/pdf', 'text/html'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Path traversal prevention
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Virus scanning (optional)
async function scanFile(filePath: string): Promise<boolean> {
  // Integration point for ClamAV or similar
}
```

### API Key Management

- Store AI API keys in environment variables
- Use secret management service in production
- Rotate keys regularly
- Monitor API usage and costs

## Deployment Considerations

### Environment Setup

1. **Development**
   - Use OpenAI API with development key
   - Mock AI responses for faster testing
   - Local file storage

2. **Staging**
   - Use production-like AI service
   - S3 or cloud storage for files
   - Monitor costs and performance

3. **Production**
   - Production AI API keys
   - Redundant storage
   - Rate limiting and monitoring
   - Existing monitoring infrastructure

### Migration Strategy

**Phase 1: Wire Up Existing Services (Week 1)**
- Create upload endpoint
- Connect to existing services
- Basic error handling

**Phase 2: AI Integration (Week 2)**
- Integrate AI service
- Implement prompt templates
- Add confidence scoring

**Phase 3: Real-Time Updates (Week 3)**
- Implement SSE progress stream
- Connect to event orchestrator
- Add UI integration

**Phase 4: Polish & Testing (Week 4)**
- Comprehensive testing
- Performance optimization
- Documentation

## Monitoring and Observability

### Metrics to Track

**Leverage existing monitoring service:**
- Upload success rate
- Processing duration
- AI API latency
- Error rates by category
- SSE connection count

**New dashboards:**
- Upload workflow funnel
- AI service performance
- Cost per contract processed

### Logging Strategy

```typescript
// Use existing monitoring service
monitoringService.logEvent('contract.upload.started', {
  contractId,
  fileSize,
  fileType
});

monitoringService.logEvent('contract.processing.completed', {
  contractId,
  duration,
  artifactCount,
  aiCost
});
```

## Integration with Existing Systems

### Event Bus Integration

**Use existing event orchestrator:**
```typescript
// Emit events for downstream systems
eventOrchestrator.emit('contract.uploaded', { contractId });
eventOrchestrator.emit('artifacts.generated', { contractId, artifacts });
eventOrchestrator.emit('processing.completed', { contractId });
```

### Cache Invalidation

**Use existing cache invalidation service:**
```typescript
// Invalidate relevant caches
cacheInvalidationService.invalidate(`contract:${contractId}`);
cacheInvalidationService.invalidate('contracts:list');
```

### Analytics Integration

**Trigger analytics updates:**
```typescript
// Use existing analytics service
analyticsService.updateContractMetrics(contractId);
analyticsService.recalculateSavingsOpportunities(contractId);
```

## Summary

This design leverages your existing robust architecture and fills the critical gaps:

**What We're Using:**
- ✅ Existing services (90% of infrastructure)
- ✅ Database schema (no changes needed)
- ✅ SSE infrastructure
- ✅ Event orchestration
- ✅ Error handling framework

**What We're Adding:**
- 🆕 Upload API endpoint
- 🆕 AI service integration
- 🆕 Progress stream endpoint
- 🆕 Workflow coordination

**What We're Fixing:**
- 🔧 Empty artifact generation → Real AI processing
- 🔧 Missing upload endpoint → Complete API
- 🔧 No progress updates → Real-time SSE stream

The implementation will be incremental, building on what works and minimizing disruption to existing functionality.
