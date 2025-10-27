# Rate Card Benchmarking API Documentation

Complete API reference for the Rate Card Benchmarking System.

## Base URL

```
http://localhost:3005/api/benchmarking
```

---

## Endpoints

### 1. Calculate Benchmark

Calculate statistical benchmark for a specific rate card.

**Endpoint:** `POST /api/benchmarking/calculate/:rateCardId`

**Parameters:**
- `rateCardId` (path): ID of the rate card to benchmark

**Response:**
```json
{
  "success": true,
  "data": {
    "rateCard": { /* rate card object */ },
    "benchmark": {
      "id": "snapshot-id",
      "statistics": {
        "mean": 1050.00,
        "median": 1000.00,
        "mode": 1000.00,
        "standardDeviation": 225.46,
        "variance": 50832.00,
        "min": 750.00,
        "max": 1300.00,
        "range": 550.00,
        "p10": 762.50,
        "p25": 825.00,
        "p50": 1000.00,
        "p75": 1175.00,
        "p90": 1270.00,
        "p95": 1285.00,
        "sampleSize": 5
      },
      "marketPosition": {
        "position": "TOP_DECILE",
        "percentile": 95.0,
        "deviationFromMedian": 300.00,
        "percentageDeviation": 30.0
      },
      "savingsAnalysis": {
        "savingsToMedian": 300.00,
        "savingsToP25": 475.00,
        "savingsToP10": 537.50,
        "percentageSavingsToMedian": 30.0,
        "percentageSavingsToP25": 57.6,
        "percentageSavingsToP10": 70.4,
        "isAboveMarket": true
      },
      "cohortCriteria": {
        "role": "Java Developer",
        "seniority": "Senior",
        "country": "United States",
        "lineOfService": "Technology"
      },
      "snapshotDate": "2025-01-24T10:30:00Z"
    }
  }
}
```

**Get Existing Benchmark:** `GET /api/benchmarking/calculate/:rateCardId`

Returns existing benchmark or calculates new one if none exists.

---

### 2. Market Intelligence

Get market-wide intelligence for specific criteria.

**Endpoint:** `GET /api/benchmarking/market`

**Query Parameters:**
- `role` (optional): Role name (e.g., "Java Developer")
- `seniority` (optional): Seniority level (e.g., "Senior")
- `country` (optional): Country name (e.g., "United States")
- `lineOfService` (optional): Line of service (e.g., "Technology")

**Example:**
```
GET /api/benchmarking/market?role=Java%20Developer&seniority=Senior&country=United%20States
```

**Response:**
```json
{
  "success": true,
  "data": {
    "criteria": {
      "role": "Java Developer",
      "seniority": "Senior",
      "country": "United States"
    },
    "sampleSize": 5,
    "averageRate": 1050.00,
    "medianRate": 1000.00,
    "standardDeviation": 225.46,
    "rateRange": {
      "min": 750.00,
      "max": 1300.00
    },
    "percentiles": {
      "p10": 762.50,
      "p25": 825.00,
      "p50": 1000.00,
      "p75": 1175.00,
      "p90": 1270.00
    },
    "supplierDistribution": {
      "TIER_1": 3,
      "TIER_2": 2,
      "TIER_3": 0
    },
    "topSuppliers": [
      {
        "name": "Budget Solutions Ltd",
        "averageRate": 775.00,
        "tier": "TIER_2"
      },
      {
        "name": "Global Tech Partners",
        "averageRate": 1000.00,
        "tier": "TIER_1"
      }
    ],
    "insights": [
      "Top 10% of rates are 66% higher than bottom 10%",
      "2 suppliers account for 80% of this market",
      "TIER_2 suppliers offer 26% lower rates on average"
    ]
  }
}
```

---

### 3. Savings Opportunities

Detect savings opportunities for a rate card.

**Endpoint:** `POST /api/benchmarking/opportunities/:rateCardId`

**Parameters:**
- `rateCardId` (path): ID of the rate card to analyze

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "opportunity-id",
      "category": "RATE_REDUCTION",
      "description": "Current rate is 30% above market median",
      "estimatedSavings": 300.00,
      "savingsPercentage": 23.1,
      "confidence": 0.95,
      "effortLevel": "LOW",
      "riskLevel": "LOW",
      "status": "IDENTIFIED",
      "recommendedAction": "Negotiate rate reduction to market median ($1000)",
      "talkingPoints": [
        "Your current rate of $1300 is at the 95th percentile",
        "Market median for Senior Java Developers is $1000",
        "Potential savings: $300 per day"
      ],
      "alternativeSuppliers": [
        "Budget Solutions Ltd - $775",
        "Global Tech Partners - $1000"
      ]
    },
    {
      "category": "SUPPLIER_SWITCH",
      "description": "Alternative suppliers offer competitive rates",
      "estimatedSavings": 525.00,
      "savingsPercentage": 40.4,
      "confidence": 0.80,
      "effortLevel": "MEDIUM",
      "riskLevel": "MEDIUM",
      "recommendedAction": "Consider switching to Budget Solutions Ltd"
    }
  ]
}
```

**List All Opportunities:** `GET /api/benchmarking/opportunities`

**Query Parameters:**
- `tenantId` (optional): Filter by tenant
- `status` (optional): Filter by status (IDENTIFIED, IN_PROGRESS, COMPLETED, REJECTED)
- `minSavings` (optional): Minimum savings amount

**Response:**
```json
{
  "success": true,
  "data": {
    "opportunities": [ /* array of opportunities */ ],
    "summary": {
      "totalOpportunities": 8,
      "totalPotentialSavings": 2400.00,
      "byCategory": {
        "RATE_REDUCTION": 3,
        "SUPPLIER_SWITCH": 2,
        "VOLUME_DISCOUNT": 2,
        "TERM_RENEGOTIATION": 1
      }
    }
  }
}
```

---

### 4. Bulk Benchmarking

Process all rate cards for a tenant.

**Endpoint:** `POST /api/benchmarking/bulk`

**Request Body:**
```json
{
  "tenantId": "tenant-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 150,
    "successful": 147,
    "failed": 3,
    "errors": [
      {
        "rateCardId": "rc-123",
        "error": "Insufficient data for benchmarking"
      }
    ],
    "duration": "12.45s"
  }
}
```

**Get Bulk Status:** `GET /api/benchmarking/bulk?tenantId=tenant-123`

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "benchmarked": 147,
    "unbenchmarked": 3,
    "totalPotentialSavings": 45000.00,
    "positionDistribution": {
      "BOTTOM_DECILE": 15,
      "BOTTOM_QUARTILE": 22,
      "BELOW_AVERAGE": 30,
      "AVERAGE": 35,
      "ABOVE_AVERAGE": 25,
      "TOP_QUARTILE": 15,
      "TOP_DECILE": 8
    }
  }
}
```

---

## Data Models

### Market Position Categories

- `BOTTOM_DECILE`: Below 10th percentile (cheapest 10%)
- `BOTTOM_QUARTILE`: 10th-25th percentile
- `BELOW_AVERAGE`: 25th-50th percentile
- `AVERAGE`: Around median (±10%)
- `ABOVE_AVERAGE`: 50th-75th percentile
- `TOP_QUARTILE`: 75th-90th percentile
- `TOP_DECILE`: Above 90th percentile (most expensive 10%)

### Savings Categories

- `RATE_REDUCTION`: Negotiate lower daily rate
- `SUPPLIER_SWITCH`: Switch to cheaper supplier
- `VOLUME_DISCOUNT`: Leverage volume for better rates
- `TERM_RENEGOTIATION`: Extend contract terms for discounts
- `GEOGRAPHIC_ARBITRAGE`: Use lower-cost locations
- `SKILL_OPTIMIZATION`: Adjust seniority/skill requirements

### Effort Levels

- `LOW`: Can be achieved quickly with minimal effort
- `MEDIUM`: Requires some negotiation or planning
- `HIGH`: Significant effort, may involve supplier changes

### Risk Levels

- `LOW`: Minimal risk to delivery or quality
- `MEDIUM`: Some risk that should be managed
- `HIGH`: Significant risk, careful consideration needed

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad request (missing required parameters)
- `404`: Resource not found
- `500`: Internal server error

---

## Usage Examples

### cURL Examples

**Calculate Benchmark:**
```bash
curl -X POST http://localhost:3005/api/benchmarking/calculate/rc-123
```

**Get Market Intelligence:**
```bash
curl "http://localhost:3005/api/benchmarking/market?role=Java%20Developer&seniority=Senior"
```

**Detect Opportunities:**
```bash
curl -X POST http://localhost:3005/api/benchmarking/opportunities/rc-123
```

**Bulk Benchmark:**
```bash
curl -X POST http://localhost:3005/api/benchmarking/bulk \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-123"}'
```

### JavaScript/TypeScript Examples

```typescript
// Calculate benchmark
const response = await fetch(`/api/benchmarking/calculate/${rateCardId}`, {
  method: 'POST',
});
const { data } = await response.json();

// Get market intelligence
const params = new URLSearchParams({
  role: 'Java Developer',
  seniority: 'Senior',
  country: 'United States',
});
const response = await fetch(`/api/benchmarking/market?${params}`);
const { data } = await response.json();

// Detect opportunities
const response = await fetch(`/api/benchmarking/opportunities/${rateCardId}`, {
  method: 'POST',
});
const opportunities = await response.json();

// Bulk benchmark
const response = await fetch('/api/benchmarking/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenantId: 'tenant-123' }),
});
const results = await response.json();
```

---

## Integration Notes

### Automated Benchmarking

The system can automatically re-benchmark rate cards:

1. **On Upload**: New rate cards are benchmarked when extracted from contracts
2. **Monthly**: All rate cards are re-benchmarked monthly to reflect market changes
3. **On Demand**: Users can trigger benchmarking via the bulk endpoint

### Background Jobs

For large tenants, consider using background jobs:

```typescript
import { queue } from '@queue/client';

// Queue bulk benchmarking
await queue.add('benchmark-all-rates', {
  tenantId: 'tenant-123',
  forceRecalculate: false,
});
```

### Caching

Market intelligence results are cached for performance:
- Cache duration: 1 hour
- Cache key: `market-intel:{role}:{seniority}:{country}:{lineOfService}`

---

## Performance

**Benchmark Calculation:**
- Single rate card: ~50-100ms
- Bulk (100 rate cards): ~5-10 seconds

**Market Intelligence:**
- Typical query: ~100-200ms
- Cached results: ~10ms

**Savings Detection:**
- Per rate card: ~100-150ms
- Includes alternative supplier search

---

## Best Practices

1. **Always benchmark new rate cards** as soon as they're created
2. **Re-benchmark monthly** to keep data fresh
3. **Use market intelligence** before negotiations
4. **Review opportunities regularly** to maximize savings
5. **Track opportunity status** to measure ROI
6. **Cache market intelligence** for frequently requested criteria

---

## Support

For issues or questions:
- Check error messages in API responses
- Review Next.js logs for detailed error traces
- Verify database connections (PostgreSQL must be running)
- Ensure rate cards have sufficient data for benchmarking (minimum 3 comparable rates recommended)
