# Production Readiness Design

## Overview

This design document outlines the architecture and implementation approach for achieving full production readiness across the Contract Intelligence Platform. The design builds upon the existing event-driven infrastructure and focuses on integration, monitoring, error handling, performance, security, and operational excellence.

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Production-Ready System                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │───▶│  API Layer   │───▶│   Services   │      │
│  │  Components  │◀───│  + Middleware│◀───│   + Events   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                    │                    │              │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Real-Time   │    │  Monitoring  │    │   Database   │      │
│  │  SSE Stream  │    │  + Logging   │    │  + Caching   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Global Error Boundary**: Catches and handles all React errors
2. **API Middleware Layer**: Handles auth, rate limiting, logging, error handling
3. **Health Check System**: Monitors all critical services
4. **Monitoring Dashboard**: Real-time system metrics and status
5. **Connection Manager**: Manages SSE connections and reconnection logic
6. **Performance Monitor**: Tracks and reports performance metrics
7. **Security Layer**: Input validation, sanitization, rate limiting
8. **Testing Framework**: Comprehensive test suite for all layers

---

## Components and Interfaces

### 1. Global Error Handling

#### Error Boundary Component
```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps> {
  // Catches all React errors
  // Logs to monitoring service
  // Shows user-friendly error UI
  // Provides recovery options
}
```

#### API Error Handler
```typescript
interface ApiErrorHandler {
  handleError(error: Error, context: RequestContext): ErrorResponse;
  shouldRetry(error: Error): boolean;
  getRetryDelay(attemptNumber: number): number;
  logError(error: Error, context: RequestContext): void;
}
```

### 2. Health Check System

#### Health Check Service
```typescript
interface HealthCheckService {
  checkDatabase(): Promise<HealthStatus>;
  checkCache(): Promise<HealthStatus>;
  checkEventBus(): Promise<HealthStatus>;
  checkSSE(): Promise<HealthStatus>;
  checkExternalServices(): Promise<HealthStatus>;
  getOverallHealth(): Promise<SystemHealth>;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: HealthStatus;
    cache: HealthStatus;
    eventBus: HealthStatus;
    sse: HealthStatus;
    external: HealthStatus;
  };
  timestamp: string;
  uptime: number;
}
```

#### Health Check Endpoint
```
GET /api/health
GET /api/health/detailed
GET /api/health/database
GET /api/health/cache
GET /api/health/events
```

### 3. Monitoring and Observability

#### Monitoring Service
```typescript
interface MonitoringService {
  // Metrics
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  incrementCounter(name: string, tags?: Record<string, string>): void;
  recordTiming(name: string, duration: number, tags?: Record<string, string>): void;
  
  // Logging
  logInfo(message: string, context?: Record<string, any>): void;
  logWarning(message: string, context?: Record<string, any>): void;
  logError(error: Error, context?: Record<string, any>): void;
  
  // Tracing
  startTrace(name: string): Trace;
  endTrace(trace: Trace): void;
}
```

#### Monitoring Dashboard Component
```typescript
interface MonitoringDashboardProps {
  refreshInterval?: number;
}

// Displays:
// - System health status
// - Active SSE connections
// - Event processing metrics
// - Cache hit/miss ratios
// - API response times
// - Error rates
// - Resource utilization
```

### 4. Performance Optimization

#### Performance Monitor
```typescript
interface PerformanceMonitor {
  measurePageLoad(): void;
  measureApiCall(endpoint: string, duration: number): void;
  measureRenderTime(component: string, duration: number): void;
  getMetrics(): PerformanceMetrics;
  reportSlowOperations(): SlowOperation[];
}

interface PerformanceMetrics {
  pageLoadTime: number;
  timeToInteractive: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  apiResponseTimes: Record<string, number[]>;
}
```

#### Lazy Loading Strategy
```typescript
// Component-level lazy loading
const LazyComponent = lazy(() => import('./Component'));

// Route-level code splitting
const routes = [
  { path: '/contracts', component: lazy(() => import('./pages/Contracts')) },
  { path: '/rate-cards', component: lazy(() => import('./pages/RateCards')) },
  // ...
];

// Image lazy loading
<img loading="lazy" src={imageUrl} alt={alt} />

// Data pagination and virtual scrolling
<VirtualList items={largeDataset} itemHeight={50} />
```

### 5. Security Hardening

#### Security Middleware
```typescript
interface SecurityMiddleware {
  validateInput(data: any, schema: ValidationSchema): ValidationResult;
  sanitizeInput(data: any): any;
  checkRateLimit(userId: string, endpoint: string): boolean;
  validateAuth(token: string): AuthResult;
  checkPermissions(user: User, resource: string, action: string): boolean;
}
```

#### Rate Limiter
```typescript
interface RateLimiter {
  checkLimit(key: string, limit: number, window: number): Promise<boolean>;
  getRemainingRequests(key: string): Promise<number>;
  resetLimit(key: string): Promise<void>;
}

// Configuration
const rateLimits = {
  '/api/contracts': { limit: 100, window: 60000 }, // 100 req/min
  '/api/rate-cards': { limit: 200, window: 60000 }, // 200 req/min
  '/api/search': { limit: 50, window: 60000 }, // 50 req/min
};
```

#### Input Validation
```typescript
// Zod schemas for all API inputs
const contractSchema = z.object({
  title: z.string().min(1).max(200),
  supplierId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  // ...
});

// Automatic validation in API routes
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validated = contractSchema.parse(body); // Throws if invalid
  // ...
}
```

### 6. Connection Management

#### SSE Connection Manager
```typescript
interface ConnectionManager {
  connect(tenantId: string, userId?: string): Promise<EventSource>;
  disconnect(connectionId: string): void;
  reconnect(connectionId: string): Promise<void>;
  getConnectionStatus(connectionId: string): ConnectionStatus;
  getActiveConnections(): Connection[];
  cleanupStaleConnections(): void;
}

interface ConnectionStatus {
  id: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity: Date;
  reconnectAttempts: number;
  latency: number;
}
```

#### Reconnection Strategy
```typescript
// Exponential backoff with jitter
function getReconnectDelay(attempt: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * 1000; // Add up to 1 second jitter
  return delay + jitter;
}

// Automatic reconnection
useEffect(() => {
  let reconnectTimer: NodeJS.Timeout;
  
  if (!isConnected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    const delay = getReconnectDelay(reconnectAttempts);
    reconnectTimer = setTimeout(() => {
      reconnect();
    }, delay);
  }
  
  return () => clearTimeout(reconnectTimer);
}, [isConnected, reconnectAttempts]);
```

### 7. Data Consistency

#### Optimistic Locking
```typescript
interface OptimisticLockService {
  acquireLock(resourceId: string, version: number): Promise<Lock>;
  releaseLock(lock: Lock): Promise<void>;
  checkVersion(resourceId: string, expectedVersion: number): Promise<boolean>;
}

// Usage in update operations
async function updateContract(id: string, data: any, version: number) {
  const lock = await optimisticLockService.acquireLock(id, version);
  
  try {
    // Check version hasn't changed
    const current = await db.contract.findUnique({ where: { id } });
    if (current.version !== version) {
      throw new ConflictError('Contract was modified by another user');
    }
    
    // Perform update with version increment
    const updated = await db.contract.update({
      where: { id, version },
      data: { ...data, version: version + 1 }
    });
    
    return updated;
  } finally {
    await optimisticLockService.releaseLock(lock);
  }
}
```

#### Transaction Management
```typescript
// Database transactions for multi-step operations
async function createContractWithArtifacts(contractData: any, artifacts: any[]) {
  return await db.$transaction(async (tx) => {
    // Create contract
    const contract = await tx.contract.create({ data: contractData });
    
    // Create artifacts
    const createdArtifacts = await Promise.all(
      artifacts.map(artifact => 
        tx.artifact.create({
          data: { ...artifact, contractId: contract.id }
        })
      )
    );
    
    // Create audit log
    await tx.auditLog.create({
      data: {
        action: 'CONTRACT_CREATED',
        resourceId: contract.id,
        userId: contractData.userId
      }
    });
    
    return { contract, artifacts: createdArtifacts };
  });
}
```

---

## Data Models

### Health Check Models

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latency?: number;
  details?: Record<string, any>;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthStatus>;
  timestamp: string;
  uptime: number;
  version: string;
}
```

### Monitoring Models

```typescript
interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
}

interface LogEntry {
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  context: Record<string, any>;
  userId?: string;
  requestId?: string;
}

interface Trace {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  spans: Span[];
}
```

### Error Models

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    requestId: string;
    timestamp: string;
  };
  retry?: {
    allowed: boolean;
    after?: number;
  };
}

interface ErrorLog {
  error: Error;
  context: {
    userId?: string;
    requestId: string;
    endpoint: string;
    method: string;
    timestamp: Date;
  };
  stack: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

---

## Error Handling

### Error Handling Strategy

```typescript
// 1. API Layer Error Handling
export async function handleApiError(error: Error, context: RequestContext): Promise<Response> {
  // Log error with full context
  await monitoringService.logError(error, {
    endpoint: context.endpoint,
    method: context.method,
    userId: context.userId,
    requestId: context.requestId
  });
  
  // Determine error type and response
  if (error instanceof ValidationError) {
    return Response.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }
  
  if (error instanceof AuthenticationError) {
    return Response.json({
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      }
    }, { status: 401 });
  }
  
  if (error instanceof NotFoundError) {
    return Response.json({
      error: {
        code: 'NOT_FOUND',
        message: error.message,
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      }
    }, { status: 404 });
  }
  
  if (error instanceof ConflictError) {
    return Response.json({
      error: {
        code: 'CONFLICT',
        message: error.message,
        requestId: context.requestId,
        timestamp: new Date().toISOString()
      },
      retry: {
        allowed: true,
        after: 1000
      }
    }, { status: 409 });
  }
  
  // Generic server error (don't expose internal details)
  return Response.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: context.requestId,
      timestamp: new Date().toISOString()
    }
  }, { status: 500 });
}

// 2. Frontend Error Handling
export function useApiCall<T>(apiFunction: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  
  const execute = async () => {
    setLoading(true);
    setError(null);
    
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      try {
        const result = await apiFunction();
        setData(result);
        setLoading(false);
        return result;
      } catch (err) {
        attempt++;
        
        if (attempt >= maxAttempts || !shouldRetry(err)) {
          setError(err as Error);
          setLoading(false);
          throw err;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  };
  
  return { data, error, loading, execute };
}

// 3. SSE Error Handling
useEffect(() => {
  const handleError = (error: Event) => {
    console.error('[SSE] Connection error:', error);
    
    // Attempt reconnection
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = getReconnectDelay(reconnectAttempts);
      setTimeout(() => {
        setReconnectAttempts(prev => prev + 1);
        reconnect();
      }, delay);
    } else {
      // Max attempts reached, show error to user
      showToast({
        title: 'Connection Lost',
        description: 'Unable to establish real-time connection. Please refresh the page.',
        variant: 'error'
      });
    }
  };
  
  eventSource?.addEventListener('error', handleError);
  
  return () => {
    eventSource?.removeEventListener('error', handleError);
  };
}, [eventSource, reconnectAttempts]);
```

---

## Testing Strategy

### Test Pyramid

```
        ┌─────────────┐
        │   E2E Tests │  ← 10% (Critical user journeys)
        └─────────────┘
      ┌─────────────────┐
      │ Integration Tests│  ← 30% (API + Service layer)
      └─────────────────┘
    ┌───────────────────────┐
    │     Unit Tests        │  ← 60% (Business logic)
    └───────────────────────┘
```

### Test Coverage Goals

- **Unit Tests**: 80% coverage for services and utilities
- **Integration Tests**: All API endpoints and critical workflows
- **E2E Tests**: Top 10 user journeys
- **Performance Tests**: Load testing for expected traffic

### Test Examples

```typescript
// 1. Unit Test Example
describe('RateCardService', () => {
  it('should calculate benchmark correctly', () => {
    const rates = [100, 120, 110, 130, 105];
    const benchmark = rateCardService.calculateBenchmark(rates);
    expect(benchmark.median).toBe(110);
    expect(benchmark.mean).toBe(113);
  });
  
  it('should handle empty rate array', () => {
    expect(() => rateCardService.calculateBenchmark([])).toThrow();
  });
});

// 2. Integration Test Example
describe('POST /api/contracts', () => {
  it('should create contract and emit event', async () => {
    const eventSpy = jest.spyOn(eventBus, 'emit');
    
    const response = await fetch('/api/contracts', {
      method: 'POST',
      body: JSON.stringify(mockContractData)
    });
    
    expect(response.status).toBe(201);
    expect(eventSpy).toHaveBeenCalledWith(
      Events.CONTRACT_CREATED,
      expect.objectContaining({ contractId: expect.any(String) })
    );
  });
});

// 3. E2E Test Example
describe('Contract Upload Flow', () => {
  it('should upload contract and see it in list', async () => {
    await page.goto('/upload');
    await page.setInputFiles('input[type="file"]', 'test-contract.pdf');
    await page.click('button:has-text("Upload")');
    
    await page.waitForSelector('.success-message');
    await page.goto('/contracts');
    
    await expect(page.locator('.contract-list')).toContainText('test-contract.pdf');
  });
});

// 4. Load Test Example
describe('Load Testing', () => {
  it('should handle 100 concurrent requests', async () => {
    const requests = Array(100).fill(null).map(() => 
      fetch('/api/rate-cards')
    );
    
    const responses = await Promise.all(requests);
    const successCount = responses.filter(r => r.ok).length;
    
    expect(successCount).toBeGreaterThan(95); // 95% success rate
  });
});
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- Global error boundary
- API error handling middleware
- Health check system
- Basic monitoring

### Phase 2: Real-Time Integration (Week 1-2)
- Complete SSE integration across all pages
- Connection management and reconnection
- Real-time UI updates
- Connection status indicators

### Phase 3: Performance & Security (Week 2)
- Performance monitoring
- Lazy loading implementation
- Rate limiting
- Input validation and sanitization

### Phase 4: Testing & Quality (Week 3)
- Unit test suite
- Integration tests
- E2E tests
- Load testing

### Phase 5: Documentation & Deployment (Week 3-4)
- Deployment runbooks
- Environment configuration
- Monitoring dashboard
- Production deployment

---

## Success Metrics

- **Uptime**: 99.9% availability
- **Performance**: < 2s page load, < 200ms API response
- **Error Rate**: < 0.1% of requests
- **Test Coverage**: > 70% overall
- **Security**: Zero critical vulnerabilities
- **User Satisfaction**: Positive feedback on stability and performance
