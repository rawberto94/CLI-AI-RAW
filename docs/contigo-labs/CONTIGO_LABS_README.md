# Contigo Labs

**AI-Powered Contract Intelligence Platform**

Contigo Labs is the unified interface for all AI-powered capabilities in the Contigo contract management platform. It brings together 19 specialized AI agents, predictive analytics, knowledge graphs, and human-in-the-loop workflows into a single, cohesive experience.

---

## 🚀 Quick Start

```bash
# Navigate to Contigo Labs
http://localhost:3000/contigo-labs

# Or access specific sections
/contigo-labs?tab=dashboard     # Overview dashboard
/contigo-labs?tab=agents        # Agent Command Center
/contigo-labs?tab=approvals     # Approval Queue
/contigo-labs?tab=opportunities # RFx Opportunities
/contigo-labs?tab=chat          # AI Chat
/contigo-labs?tab=analytics     # Predictive Analytics
/contigo-labs?tab=knowledge     # Knowledge Graph
```

---

## 🧠 Agent Ecosystem

### 19 AI Agents in 5 Clusters

| Cluster | Emoji | Description | Agents |
|---------|-------|-------------|--------|
| **Guardians** | 🛡️ | Compliance & Risk Protection | Sentinel, Vigil, Warden |
| **Oracles** | 🔮 | Intelligence & Discovery | Sage, Prospector, Scout |
| **Operators** | ⚡ | Execution & Monitoring | Clockwork, Steward, Artificer |
| **Strategists** | 🎯 | Workflow & Planning | Architect, Merchant, Conductor |
| **Evolution** | 🧬 | Learning & Improvement | Mnemosyne, A/B, Swarm |

### Agent Codenames & @mentions

Use `@codename` in chat to direct questions to specific agents:

| @mention | Codename | Purpose |
|----------|----------|---------|
| `@merchant` | Merchant | RFx procurement & sourcing |
| `@scout` | Scout | RFx opportunity detection |
| `@sage` | Sage | Contract search & Q&A |
| `@vigil` | Vigil | Compliance monitoring |
| `@warden` | Warden | Risk detection |
| `@clockwork` | Clockwork | Deadline management |
| `@prospector` | Prospector | Opportunity discovery |
| `@architect` | Architect | Workflow design |
| `@conductor` | Conductor | Conflict resolution |

---

## 🎛️ Features

### 1. Dashboard
Real-time overview of:
- Active agents count
- Pending approvals
- Detected opportunities
- Success metrics

### 2. Agent Command Center
- Monitor all 19 agents
- View agent health & status
- See recent activities
- Configure agent settings

### 3. Approval Queue (HITL)
Human-in-the-loop workflows for:
- Agent goal approvals
- RFx award decisions
- Compliance alert reviews
- Renewal decisions

**Actions available:** Approve, Reject, Modify, Escalate, Defer

### 4. RFx Opportunities (Scout)
AI-powered opportunity detection:
- **Expiration detection**: Contracts expiring in 6 months
- **Savings analysis**: Pricing above market rates
- **Performance issues**: Vendors with problems
- **Consolidation**: Multiple contracts eligible for bundling

### 5. AI Chat
Natural language interface:
- @mention agents for specialized help
- Context-aware responses
- Conversation history
- Action suggestions

**Example queries:**
- "@scout find RFx opportunities"
- "@sage search for NDAs expiring this quarter"
- "@merchant create a new RFx for IT services"
- "@vigil show compliance alerts"

### 6. Predictive Analytics
- Renewal predictions
- Cost forecasting
- Risk scoring
- Optimization recommendations

### 7. Knowledge Graph
- Entity-relationship explorer
- Contract connections
- Vendor networks
- Obligation mappings

---

## 🔌 API Reference

### Status & Overview
```http
GET /api/agents/status
```
Returns dashboard statistics, agent health, and recent activity.

### Activity Feed
```http
GET /api/agents/activities?limit=50&agent=scout
POST /api/agents/activities/clear
```

### Approvals (HITL)
```http
GET /api/agents/approvals
POST /api/agents/approvals
Body: { actionId, action: "approve|reject|modify", notes? }
```

### RFx Opportunities
```http
GET /api/agents/rfx-opportunities?algorithm=all&urgency=high
POST /api/agents/rfx-opportunities/detect
PATCH /api/agents/rfx-opportunities
Body: { opportunityId, action: "accept|reject|snooze" }
```

### Agent Chat
```http
GET /api/agents/chat?threadId=xxx
POST /api/agents/chat
Body: { message: "@scout find opportunities", context? }
DELETE /api/agents/chat?threadId=xxx
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Contigo Labs UI                          │
│         (Next.js 15 + React 19 + TypeScript)                │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  API Routes  │    │   WebSocket  │    │    Redis     │
│  (REST)      │    │  (Real-time) │    │   (Cache)    │
└──────────────┘    └──────────────┘    └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Agent Ecosystem                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Guardians│ │ Oracles  │ │ Operators│ │Strategists│      │
│  │Sentinel  │ │Sage      │ │Clockwork │ │Merchant   │      │
│  │Vigil     │ │Scout     │ │Steward   │ │Architect  │      │
│  │Warden    │ │Prospector│ │Artificer │ │Conductor  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Prisma     │    │    Neo4j     │    │  Pinecone    │
│  (PostgreSQL)│    │(Knowledge   │    │  (Vectors)   │
│              │    │    Graph)    │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## 🔄 Data Flow

### Opportunity Detection (Scout)
1. Scout agent scans contracts periodically
2. Detects opportunities using 4 algorithms
3. Stores in `RFxOpportunity` table
4. Appears in dashboard with urgency scoring
5. User reviews and takes action

### HITL Approval Flow
1. Agent creates recommendation
2. Stored in appropriate table with `AWAITING_APPROVAL` status
3. Appears in Approval Queue
4. User reviews context and recommendation
5. User takes action (approve/reject/modify)
6. Audit logged to `ApprovalAction` table
7. Agent proceeds based on decision

### Chat Flow
1. User sends message with @mention
2. API routes to appropriate agent handler
3. Agent processes with context enrichment
4. Response stored in `AgentConversation`
5. Real-time update to UI

---

## 🛠️ Development

### Running Locally

```bash
# Start all services
docker-compose up -d

# Run migrations
pnpm prisma migrate dev

# Start dev server
pnpm dev

# Access Contigo Labs
open http://localhost:3000/contigo-labs
```

### Adding a New Agent

1. Add agent to `AGENT_CLUSTERS` in `apps/web/app/contigo-labs/page.tsx`
2. Create agent handler in `apps/web/app/api/agents/chat/route.ts`
3. Add agent persona to `packages/workers/src/agents/agent-personas.ts`
4. Implement agent worker in `packages/workers/src/agents/`

### Database Changes

```bash
# Add new model to schema.prisma
# Then run:
pnpm prisma migrate dev --name add_contigo_labs_models
pnpm prisma generate
```

---

## 📊 Monitoring

### Key Metrics
- Agent execution success rate
- API response times (p95 < 500ms)
- Pending approval count
- Opportunity detection rate
- Chat response accuracy

### Alerts
Configure alerts for:
- Failed agent executions
- High pending approval count
- API error rates
- Database connection issues

---

## 🔐 Security

- All APIs require authentication
- Tenant isolation enforced
- Rate limiting on all endpoints
- Audit logging for all approval actions
- Sensitive data encrypted at rest

---

## 📝 Changelog

### v2.0.0 (Current)
- Unified Contigo Labs experience
- 19 AI agents with codenames
- @mention chat interface
- Scout opportunity detection
- HITL approval workflows
- Real-time dashboard

### v1.0.0 (Legacy)
- Individual agent interfaces
- Separate chat and analytics pages
- Basic approval queue

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## 📄 License

Proprietary - Contigo Platform

---

## 🆘 Support

- **Documentation**: See `CONTIGO_LABS_PRODUCTION_READINESS.md`
- **API Docs**: See `API_INTEGRATION_SUMMARY.md`
- **Issues**: File in GitHub Issues
- **Slack**: #contigo-labs-support
