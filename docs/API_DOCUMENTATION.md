# Procurement Intelligence API Documentation

## Overview

The Procurement Intelligence API provides unified access to all procurement analytics modules through a single endpoint.

**Base URL:** `/api/analytics/procurement-intelligence`

---

## Authentication

Currently no authentication required for internal use. Future versions will implement JWT-based authentication.

---

## Unified Endpoint

### GET /api/analytics/procurement-intelligence

Retrieve data from any procurement intelligence module.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `module` | string | Yes | Module name: `supplier-analytics`, `negotiation-prep`, `savings-pipeline`, `renewal-radar`, `rate-benchmarking` |
| `mode` | string | No | Data mode: `real` or `mock` (default: `real`) |
| Additional params | varies | No | Module-specific parameters |

#### Response Format

```json
{
  "success": boolean,
  "module": string,
  "data": object,
  "metadata": {
    "source": string,
    "mode": string,
    "lastUpdated": string (ISO 8601),
    "recordCount": number,
    "confidence": number,
    "description": string
  },
  "timestamp": string (ISO 8601)
}
```

---

## Module-Specific Parameters

### Supplier Analytics

**Parameters:**
- `supplierId` (optional) - Specific supplier ID
- `timeframe` - `6months`, `12months`, or `24months`
- `metrics` - Comma-separated list of metrics

**Example:**
```
GET /api/analytics/procurement-intelligence?module=supplier-analytics&supplierId=SUP001&timeframe=12months
```

**Response Data Structure:**
```json
{
  "performance": {
    "deliveryScore": number,
    "qualityScore": number,
    "costEfficiency": number,
    "riskScore": number
  },
  "financialHealth": {
    "creditRating": string,
    "revenue": number,
    "profitMargin": number,
    "debtRatio": number
  },
  "relationships": {
    "contractCount": number,
    "totalValue": number,
    "averageContractLength": number,
    "renewalRate": number
  },
  "trends": array
}
```

### Negotiation Prep

**Parameters:**
- `contractId` (optional) - Contract ID
- `supplierId` (optional) - Supplier ID
- `category` (optional) - Procurement category

**Example:**
```
GET /api/analytics/procurement-intelligence?module=negotiation-prep&contractId=CNT001
```

**Response Data Structure:**
```json
{
  "leveragePoints": array,
  "marketPosition": {
    "supplierRank": number,
    "totalSuppliers": number,
    "marketShare": number
  },
  "historicalPerformance": array,
  "recommendations": array
}
```

### Savings Pipeline

**Parameters:**
- `timeframe` - `6months`, `12months`, or `24months`
- `category` (optional) - Filter by category
- `status` (optional) - Filter by status

**Example:**
```
GET /api/analytics/procurement-intelligence?module=savings-pipeline&timeframe=12months&status=in_progress
```

**Response Data Structure:**
```json
{
  "opportunities": array,
  "pipeline": {
    "total": number,
    "byStatus": object,
    "byCategory": object
  },
  "trends": array
}
```

### Renewal Radar

**Parameters:**
- `timeframe` - `3months`, `6months`, or `12months`
- `riskLevel` (optional) - Filter by risk: `high`, `medium`, `low`

**Example:**
```
GET /api/analytics/procurement-intelligence?module=renewal-radar&timeframe=6months&riskLevel=high
```

**Response Data Structure:**
```json
{
  "upcomingRenewals": array,
  "riskAnalysis": {
    "totalContracts": number,
    "totalValue": number,
    "riskDistribution": object
  },
  "actionItems": array
}
```

---

## Health Check

### POST /api/analytics/procurement-intelligence

Check health of all data providers.

**Request Body:**
```json
{
  "action": "health-check"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rate-benchmarking": { "real": false, "mock": true },
    "supplier-analytics": { "real": false, "mock": true },
    "negotiation-prep": { "real": false, "mock": true },
    "savings-pipeline": { "real": false, "mock": true },
    "renewal-radar": { "real": false, "mock": true }
  },
  "timestamp": "2025-01-19T10:00:00Z"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": string,
  "details": string (optional),
  "timestamp": string (ISO 8601)
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Module or resource not found |
| 500 | Internal Server Error - Server-side error |

---

## Rate Limiting

Currently no rate limiting. Future versions will implement:
- 100 requests per minute per IP
- 1000 requests per hour per IP

---

## Data Modes

### Mock Data Mode
- Use `mode=mock` parameter
- Returns realistic simulated data
- No database connection required
- Instant response
- Ideal for testing and demos

### Real Data Mode
- Use `mode=real` parameter (default)
- Returns live database data
- Requires backend connection
- May have slight delay
- For production use

---

## Code Examples

### JavaScript/TypeScript

```typescript
async function getSupplierAnalytics(supplierId: string) {
  const response = await fetch(
    `/api/analytics/procurement-intelligence?module=supplier-analytics&supplierId=${supplierId}&mode=mock`
  );
  const data = await response.json();
  return data;
}
```

### Python

```python
import requests

def get_supplier_analytics(supplier_id):
    url = "/api/analytics/procurement-intelligence"
    params = {
        "module": "supplier-analytics",
        "supplierId": supplier_id,
        "mode": "mock"
    }
    response = requests.get(url, params=params)
    return response.json()
```

### cURL

```bash
curl "http://localhost:3000/api/analytics/procurement-intelligence?module=supplier-analytics&supplierId=SUP001&mode=mock"
```

---

## Changelog

### Version 1.0.0 (2025-01-19)
- Initial release
- Unified endpoint for all modules
- Mock data support
- Health check endpoint

---

## Support

For API support, contact the development team or refer to the technical documentation.

---

**Last Updated:** January 19, 2025  
**API Version:** 1.0.0
