# Renewal Radar - User Guide

## Overview

Track upcoming contract renewals, manage renewal processes, and ensure no contracts auto-renew without review.

**Access:** `/analytics/renewals`

---

## Key Features

1. **Renewal Tracking** - All upcoming contract renewals
2. **Risk Analysis** - Identify high-risk renewals
3. **Action Items** - Tasks with due dates and priorities
4. **Auto-Renewal Alerts** - Flag contracts with auto-renewal clauses
5. **Notice Period Tracking** - Ensure timely notifications

---

## Risk Levels

- **High Risk** - <60 days or high value + <90 days
- **Medium Risk** - 60-120 days or medium value
- **Low Risk** - >120 days and lower value

---

## Quick Start

### Daily Check
1. Navigate to `/analytics/renewals`
2. Review high-risk renewals
3. Check action items due today
4. Complete urgent tasks

### Weekly Review
1. Review all upcoming renewals
2. Update action item status
3. Prepare for negotiations
4. Conduct market analysis

### Monthly Planning
1. Review 90-day outlook
2. Schedule negotiations
3. Prepare renewal packs
4. Allocate resources

---

## Action Item Types

- **Notice Submission** - Submit renewal/termination notice
- **Market Analysis** - Research current market rates
- **Negotiation Prep** - Prepare negotiation strategy
- **Auto-Renewal Review** - Review auto-renewal terms

---

## Best Practices

### Timing
- Review auto-renewals 120 days before
- Start negotiations 90 days before
- Submit notices per contract terms
- Allow buffer for approvals

### Documentation
- Track all renewal decisions
- Document negotiation outcomes
- Update contract records
- Share lessons learned

---

## API Endpoint

```
GET /api/analytics/procurement-intelligence?module=renewal-radar&timeframe=6months&riskLevel=high
```

---

**Last Updated:** January 19, 2025
