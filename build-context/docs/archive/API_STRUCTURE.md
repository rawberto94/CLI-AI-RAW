# PactumAI API Structure

## Overview

- **Total Routes**: 231 API endpoints
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis with configurable TTL
- **Architecture**: Next.js App Router with RESTful conventions

## API Organization

### Core Contract Management

```
/api/contracts
  GET     /                     - List contracts (paginated, filtered)
  POST    /upload               - Upload new contract
  GET     /[id]                 - Get contract details
  DELETE  /[id]                 - Delete contract
  GET     /[id]/status          - Get processing status
  GET     /[id]/artifacts       - Get AI-generated artifacts
  POST    /[id]/retry           - Retry failed processing
```

### AI & Intelligence

```
/api/ai
  POST    /analyze              - AI contract analysis
  POST    /chat                 - AI chat interface
  GET     /chat/stream          - Streaming chat responses
  POST    /compare              - Contract comparison

/api/intelligence
  GET     /                     - Intelligence dashboard
  GET     /search               - Semantic search
  POST    /negotiate            - Negotiation assistance
  GET     /graph                - Relationship graph
```

### Analytics & Reporting

```
/api/analytics
  GET     /dashboard            - Main dashboard metrics
  GET     /forecasting          - Predictive analytics
  GET     /renewals             - Renewal tracking
  GET     /compliance           - Compliance metrics
  GET     /cost-savings         - Cost optimization
```

### Rate Cards

```
/api/rate-cards
  GET     /                     - List rate cards
  GET     /entries              - Rate card entries
  GET     /opportunities        - Savings opportunities
  GET     /baselines            - Baseline comparisons
  GET     /market-intelligence  - Market data
```

### System Health

```
/api/health
  GET     /                     - Basic health check
  GET     /detailed             - Detailed system status
  GET     /database             - Database connection
  GET     /cache                - Redis cache status
```

## Production Features

### ✅ Implemented

- Multi-tenant isolation via x-tenant-id header
- Redis caching with cache invalidation
- Pagination with limit/offset
- Input validation
- Error handling with structured responses
- Connection pooling (10 connections default)
- Graceful shutdown handling
- Slow query logging (dev mode)

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  },
  "meta": {
    "cached": false,
    "responseTime": "45ms"
  }
}
```

## Database Schema Highlights

### Core Tables

- `Contract` - Main contract storage
- `Artifact` - AI-generated analysis
- `ProcessingJob` - Background job tracking
- `RateCard` - Rate card management
- `rate_card_entries` - Individual rates

### Indexes (Contract table)

- `Contract_tenantId_idx` - Tenant isolation
- `Contract_status_idx` - Status filtering
- `Contract_tenantId_status_idx` - Combined queries
- `Contract_createdAt_idx` - Date sorting
