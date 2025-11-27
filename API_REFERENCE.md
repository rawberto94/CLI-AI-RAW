# Backend API Reference

## Overview
All APIs return JSON with a consistent structure:
```json
{
  "success": true | false,
  "data": { ... },
  "error": "Error message" // Only if success is false
}
```

## Dashboard APIs

### GET /api/dashboard/stats
Get aggregated contract statistics for the main dashboard.

**Response:**
```json
{
  "overview": {
    "totalContracts": 1247,
    "activeContracts": 892,
    "portfolioValue": 45600000,
    "recentlyAdded": 18
  },
  "renewals": {
    "expiringIn30Days": 12,
    "expiringIn90Days": 47,
    "urgentCount": 3
  },
  "breakdown": {
    "byStatus": [...],
    "byType": [...]
  },
  "riskScore": 23,
  "complianceScore": 94
}
```

### GET /api/dashboard/widgets
Get all widget data in a single request for efficient dashboard loading.

---

## Approvals API

### GET /api/approvals
Get pending approvals with filtering options.

**Query Parameters:**
- `status` - Filter by status (pending, approved, rejected, on-hold)
- `priority` - Filter by priority (critical, high, medium, low)
- `type` - Filter by type (contract, amendment, renewal, termination)
- `assignedTo` - Filter by assignee ID

**Response:**
```json
{
  "approvals": [...],
  "stats": {
    "total": 3,
    "pending": 3,
    "approved": 0,
    "rejected": 0,
    "critical": 1,
    "overdue": 0
  }
}
```

### POST /api/approvals
Perform approval actions.

**Actions:**
- `approve` - Approve an item
- `reject` - Reject an item (requires `reason`)
- `delegate` - Delegate to another user
- `request-info` - Request more information
- `escalate` - Escalate to next level

---

## Renewals API

### GET /api/renewals
Get upcoming contract renewals.

**Query Parameters:**
- `status` - Filter by status
- `priority` - Filter by priority
- `daysUntilExpiry` - Filter by days until expiry (max)
- `assignedTo` - Filter by assignee

**Response:**
```json
{
  "renewals": [...],
  "stats": {
    "total": 4,
    "urgent": 1,
    "inNegotiation": 1,
    "autoRenewal": 2,
    "totalValue": 2450000
  },
  "timeline": [...]
}
```

### POST /api/renewals
Perform renewal actions.

**Actions:**
- `initiate` - Start renewal process
- `send-notice` - Send vendor notice
- `update-terms` - Update renewal terms
- `toggle-auto-renewal` - Toggle auto-renewal setting
- `complete` - Complete renewal
- `assign` - Assign to user

---

## Governance API

### GET /api/governance
Get governance policies and risk flags.

**Query Parameters:**
- `section` - Get specific section (policies, flags, or all)

**Response:**
```json
{
  "policies": [...],
  "flags": [...],
  "stats": {
    "activePolicies": 2,
    "openFlags": 2,
    "criticalFlags": 1,
    "totalViolations": 2
  }
}
```

### POST /api/governance
Perform governance actions.

**Actions:**
- `create-policy` - Create new policy
- `update-policy` - Update policy
- `toggle-policy` - Enable/disable policy
- `resolve-flag` - Resolve a risk flag
- `acknowledge-flag` - Acknowledge a flag
- `dismiss-flag` - Dismiss as false positive
- `check-compliance` - Run compliance check on contract

---

## Intelligence API

### GET /api/intelligence
Get intelligence hub summary.

**Query Parameters:**
- `section` - Get specific section (health, insights, activity)

### GET /api/intelligence/health
Get contract health scores.

**Query Parameters:**
- `contractId` - Get health for specific contract
- `status` - Filter by health status

### GET /api/intelligence/search
Semantic search across contracts.

### GET /api/intelligence/graph
Get knowledge graph data.

### GET /api/intelligence/negotiate
Get negotiation analysis.

---

## Forecast API

### GET /api/forecast
Get predictive analytics and forecasts.

**Query Parameters:**
- `type` - Type of forecast (cost, renewal, risk, savings, insights)
- `timeframe` - Forecast timeframe in months (default: 12)

**Response:**
```json
{
  "costForecast": {...},
  "renewalForecast": {...},
  "riskForecast": {...},
  "savingsOpportunities": {...},
  "aiInsights": [...],
  "summary": {
    "totalContractValue": 15200000,
    "projectedAnnualSpend": 3744000,
    "potentialSavings": 485000,
    "riskScore": 72
  }
}
```

### POST /api/forecast
Perform forecast actions.

**Actions:**
- `run-scenario` - Run what-if scenario
- `generate-report` - Generate forecast report
- `export` - Export forecast data
- `refresh-predictions` - Refresh AI predictions

---

## Health & System APIs

### GET /api/health
Basic health check for load balancers.

### GET /api/healthz
Detailed health status with component checks.

### GET /api/monitoring
System monitoring and performance metrics.

---

## Real-Time Events

The application uses Server-Sent Events (SSE) for real-time updates:

### GET /api/events
Subscribe to real-time events.

**Event Types:**
- `contract:created` - New contract uploaded
- `contract:completed` - Contract processing complete
- `job:progress` - Processing progress update
- `approval:updated` - Approval status change
- `renewal:reminder` - Renewal deadline reminder
- `notification` - General notification

---

## Error Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Internal error |
| 503 | Service Unavailable - System down |

