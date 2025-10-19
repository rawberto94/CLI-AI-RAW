# Supplier Analytics - User Guide

## Overview

The Supplier Analytics module provides comprehensive insights into supplier performance, financial health, and relationship metrics. Use this tool to evaluate suppliers, track performance trends, and make data-driven procurement decisions.

**Access:** `/analytics/suppliers`

---

## Key Features

### 1. Performance Metrics Dashboard
- **Delivery Score** - On-time delivery performance (0-100%)
- **Quality Score** - Product/service quality rating (0-100%)
- **Cost Efficiency** - Value for money assessment (0-100%)
- **Risk Score** - Overall supplier risk level (0-100%, lower is better)

### 2. Financial Health Indicators
- **Credit Rating** - Supplier creditworthiness (AAA to D)
- **Annual Revenue** - Supplier's financial scale
- **Profit Margin** - Profitability indicator
- **Debt Ratio** - Financial stability metric

### 3. Relationship Metrics
- **Active Contracts** - Number of current contracts
- **Total Value** - Combined contract value
- **Average Contract Length** - Typical engagement duration
- **Renewal Rate** - Historical renewal percentage

### 4. Historical Trends
- Performance over time (6, 12, or 24 months)
- Trend analysis for all key metrics
- Period-over-period comparisons

---

## How to Use

### Getting Started

1. **Navigate to Supplier Analytics**
   ```
   Main Menu → Procurement Intelligence → Supplier Analytics
   or
   Direct URL: /analytics/suppliers
   ```

2. **Select Data Mode**
   - Click "Switch Mode" button (top right)
   - Choose "Mock Data" for testing/demos
   - Choose "Real Data" for live analysis

### Filtering Suppliers

#### By Supplier ID
1. Click the "Supplier ID" dropdown
2. Select a specific supplier
3. View detailed metrics for that supplier

#### By Timeframe
1. Click the "Timeframe" dropdown
2. Select 6, 12, or 24 months
3. Historical trends update automatically

#### By Search
1. Enter supplier name or ID in search box
2. Results filter in real-time

### Understanding the Metrics

#### Performance Scores
- **80-100%** - Excellent (Green)
- **60-79%** - Good (Yellow)
- **0-59%** - Needs Improvement (Red)

#### Risk Scores
- **0-20%** - Low Risk (Green)
- **21-50%** - Medium Risk (Yellow)
- **51-100%** - High Risk (Red)

#### Financial Health
- **Credit Rating**
  - AAA/AA - Excellent
  - A/BBB - Good
  - BB/B - Fair
  - Below B - Poor

- **Profit Margin**
  - Positive - Profitable
  - Negative - Operating at loss

- **Debt Ratio**
  - <30% - Healthy
  - 30-60% - Moderate
  - >60% - High leverage

---

## Common Workflows

### Workflow 1: Supplier Performance Review

**Goal:** Evaluate a supplier's overall performance

1. Select supplier from dropdown
2. Review the 4 performance metric cards
3. Check financial health section
4. Analyze relationship metrics
5. Review historical trends
6. Export data if needed

**Key Questions to Answer:**
- Is the supplier meeting delivery commitments?
- Is quality consistent?
- Are we getting good value?
- What are the risk factors?

### Workflow 2: Supplier Comparison

**Goal:** Compare multiple suppliers

1. View first supplier's metrics
2. Note key performance indicators
3. Switch to second supplier
4. Compare metrics side-by-side
5. Make informed decision

**Comparison Criteria:**
- Performance scores
- Financial stability
- Contract history
- Trend direction

### Workflow 3: Risk Assessment

**Goal:** Identify high-risk suppliers

1. Filter by timeframe (12 months recommended)
2. Review risk score
3. Check financial health indicators
4. Analyze performance trends
5. Identify mitigation strategies

**Risk Indicators:**
- High risk score (>50%)
- Declining performance trends
- Poor financial health
- Low renewal rate

### Workflow 4: Renewal Decision

**Goal:** Decide whether to renew a supplier contract

1. Select supplier up for renewal
2. Review overall performance
3. Check financial stability
4. Analyze trend direction
5. Compare against benchmarks
6. Make renewal recommendation

**Decision Factors:**
- Consistent high performance
- Stable financial health
- Positive trend direction
- Competitive pricing

---

## Data Mode Guide

### Mock Data Mode
**When to Use:**
- Demonstrations
- Training sessions
- Testing new features
- Exploring the interface

**Characteristics:**
- Realistic but simulated data
- Consistent scenarios
- No database required
- Instant response

### Real Data Mode
**When to Use:**
- Actual supplier analysis
- Business decisions
- Reporting to stakeholders
- Contract negotiations

**Characteristics:**
- Live database data
- Current information
- Requires backend connection
- May have slight delay

---

## Tips & Best Practices

### Performance Monitoring
- Review supplier metrics quarterly
- Track trends over time, not just snapshots
- Set performance thresholds
- Document improvement plans

### Risk Management
- Monitor high-risk suppliers monthly
- Diversify supplier base
- Maintain backup suppliers
- Document risk mitigation strategies

### Data Quality
- Verify data accuracy regularly
- Update supplier information promptly
- Cross-reference with contracts
- Maintain audit trail

### Reporting
- Export data for presentations
- Share insights with stakeholders
- Document decision rationale
- Track action items

---

## Troubleshooting

### Issue: No Data Displayed
**Solution:**
1. Check data mode (switch to Mock if needed)
2. Verify supplier selection
3. Refresh the page
4. Check network connection

### Issue: Metrics Seem Incorrect
**Solution:**
1. Verify correct supplier selected
2. Check timeframe setting
3. Confirm data mode
4. Contact support if persists

### Issue: Slow Loading
**Solution:**
1. Check internet connection
2. Try shorter timeframe
3. Clear browser cache
4. Use Mock data mode for testing

---

## Keyboard Shortcuts

- `Ctrl/Cmd + R` - Refresh data
- `Ctrl/Cmd + E` - Export data
- `Ctrl/Cmd + F` - Focus search
- `Esc` - Clear filters

---

## API Integration

For developers integrating with the Supplier Analytics API:

**Endpoint:** `GET /api/analytics/procurement-intelligence`

**Parameters:**
```
module=supplier-analytics
mode=real|mock
supplierId=SUP001 (optional)
timeframe=6months|12months|24months
metrics=deliveryScore,qualityScore,costEfficiency,riskScore
```

**Response:**
```json
{
  "success": true,
  "data": {
    "performance": { ... },
    "financialHealth": { ... },
    "relationships": { ... },
    "trends": [ ... ]
  },
  "metadata": {
    "source": "database",
    "lastUpdated": "2025-01-19T10:00:00Z"
  }
}
```

---

## Support

**Questions?** Contact the procurement team or IT support.

**Feedback?** We welcome suggestions for improvement.

**Training?** Schedule a session with your team lead.

---

**Last Updated:** January 19, 2025  
**Version:** 1.0.0
