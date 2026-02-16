# ConTigo — Frequently Asked Questions (FAQ)

**For Customers, Prospects & Partners**
**Version 1.0 — February 2026**

---

## Table of Contents

1. [General](#1-general)
2. [Getting Started](#2-getting-started)
3. [AI & Intelligence](#3-ai--intelligence)
4. [Contracts & Documents](#4-contracts--documents)
5. [Rate Cards & Pricing Analysis](#5-rate-cards--pricing-analysis)
6. [Security & Compliance](#6-security--compliance)
7. [Integrations](#7-integrations)
8. [Billing & Plans](#8-billing--plans)
9. [Data & Privacy](#9-data--privacy)
10. [Technical / Developer](#10-technical--developer)
11. [Support](#11-support)

---

## 1. General

### What is ConTigo?

ConTigo is an AI-powered Contract Lifecycle Management (CLM) platform that helps Swiss and European businesses automate contract ingestion, analysis, obligation tracking, and collaborative drafting. Upload any contract — ConTigo's AI extracts key metadata, identifies risks, and tracks deadlines automatically.

### Who is ConTigo for?

ConTigo is designed for:

- **Legal teams** managing contract portfolios
- **Procurement / Sourcing** teams analysing rate cards and vendor agreements
- **Finance** teams tracking contract values and obligations
- **Operations** teams managing service-level agreements
- **C-suite** needing portfolio visibility and risk dashboards

We serve companies of all sizes — from SMEs with 50 contracts to enterprises managing 50,000+.

### What makes ConTigo different from other CLM tools?

| Feature | ConTigo | Traditional CLM |
|---|---|---|
| **Data residency** | Switzerland 🇨🇭 (Zurich) | Usually US or Ireland |
| **AI extraction** | Real-time, multi-model | Basic OCR or manual |
| **Languages** | DE, FR, IT, EN natively | English-focused |
| **Rate card analysis** | Built-in benchmarking & forecasting | Requires separate tools |
| **Swiss compliance** | nDSG / FADP, OR, MWST native | Requires customisation |
| **Pricing** | CHF, transparent, no hidden fees | Often USD, complex tiers |

### Is ConTigo available in my language?

ConTigo supports:

- **German** (Deutsch) — Full UI + AI extraction
- **French** (Français) — Full UI + AI extraction
- **Italian** (Italiano) — Full UI + AI extraction
- **English** — Full UI + AI extraction

The AI can analyse contracts in all four languages simultaneously.

---

## 2. Getting Started

### How do I get started with ConTigo?

1. **Sign up** at [contigo-app.ch](https://contigo-app.ch) or request a demo
2. **Set up** your organisation (company name, departments, users)
3. **Upload** your first contract — the AI processes it in under 2 minutes
4. **Review** the AI extraction and make any corrections
5. **Invite** your team members

### How long does onboarding take?

| Scenario | Time |
|---|---|
| **Self-service (Starter)** | 15 minutes |
| **Guided setup (Professional)** | 1–2 hours with our team |
| **Enterprise onboarding** | 1–2 weeks (includes data migration, SSO setup, integrations) |

### Can I import my existing contracts?

Yes. ConTigo supports:

- **Bulk upload** — Drag & drop up to 500 files at once
- **ZIP import** — Upload a ZIP archive of your contract folder
- **SFTP import** — Automated import from SFTP server (Enterprise)
- **SharePoint sync** — Bi-directional sync with Microsoft SharePoint

All imported contracts are automatically processed by AI.

### Is there a free trial?

Yes — we offer a **14-day free trial** on the Professional plan. No credit card required. After the trial, you can continue on the Starter plan or upgrade.

---

## 3. AI & Intelligence

### How does the AI extraction work?

When you upload a contract, ConTigo:

1. **Parses** the document (PDF text, scanned PDF via OCR, or DOCX)
2. **Analyses** the content using AI models (GPT-4o, hosted in Switzerland)
3. **Extracts** key metadata: parties, dates, values, clauses, obligations
4. **Classifies** the contract type and assigns a risk score
5. **Embeds** the content for semantic search (ask questions in natural language)

The entire process takes **30–120 seconds** depending on document length.

### How accurate is the AI?

| Data Type | Accuracy |
|---|---|
| **Contract type** | 95%+ |
| **Parties** | 92%+ |
| **Key dates** | 93%+ |
| **Financial values** | 90%+ |
| **Clause classification** | 88%+ |

Accuracy improves as you use ConTigo — your corrections train the system for better results.

### Does the AI learn from my data?

**Your data is never used to train foundation models.** ConTigo improves per-tenant accuracy through:

- **Extraction corrections** — When you correct an AI result, it's stored and used for future extractions on your contracts
- **Tenant-specific embeddings** — Your contracts are embedded and searchable only by your organisation

### Which AI models does ConTigo use?

| Model | Provider | Location | Use Case |
|---|---|---|---|
| GPT-4o | Azure OpenAI | Switzerland 🇨🇭 | Primary extraction & analysis |
| GPT-4o-mini | Azure OpenAI | Switzerland 🇨🇭 | Classification, parsing |
| Mistral Large | Mistral AI | EU 🇪🇺 | EU fallback option |

All AI processing uses Swiss-hosted Azure OpenAI by default.

### Can I ask questions about my contracts in plain language?

Yes — ConTigo's AI chatbot lets you ask questions like:

- "What is the termination clause in our Swisscom MSA?"
- "Show me all contracts expiring in the next 90 days"
- "Which contracts have a liability cap under CHF 500,000?"
- "Compare the developer rates in our Accenture and Deloitte rate cards"

The AI searches your contract portfolio semantically (not just keywords) and returns precise answers with source references.

---

## 4. Contracts & Documents

### What file formats does ConTigo support?

| Format | Extensions | Processing |
|---|---|---|
| **PDF (text)** | `.pdf` | Direct text extraction |
| **PDF (scanned)** | `.pdf` | OCR → text extraction |
| **Word** | `.docx` | Native parsing |
| **Excel** | `.xlsx`, `.csv` | Rate card / tabular data |
| **Images** | `.png`, `.jpg`, `.tiff` | OCR → text extraction |

### What is the maximum file size?

| Plan | Max File Size | Max Files/Month |
|---|---|---|
| **Starter** | 25 MB | 500 |
| **Professional** | 100 MB | 5,000 |
| **Enterprise** | 500 MB | Unlimited |

### Can I edit contracts within ConTigo?

ConTigo is primarily a contract **management and analysis** tool. You can:

- Edit metadata (title, type, parties, dates, values)
- Add notes, comments, and tags
- Use AI to generate new contracts from templates
- Track versions (upload new versions of the same contract)

For full document editing, we integrate with your existing tools (Word, Google Docs) and sync changes back.

### How does version control work?

Every upload or change creates a new version. You can:

- View any previous version
- Compare two versions side by side (redline diff)
- Restore a previous version
- See the full audit trail (who changed what, when)

---

## 5. Rate Cards & Pricing Analysis

### What is rate card management?

ConTigo helps you manage vendor/supplier rate cards:

- **Upload** rate cards (Excel, CSV, or manual entry)
- **Normalise** roles automatically (e.g., "Sr. Dev" = "Senior Developer")
- **Benchmark** rates against your portfolio and market data
- **Detect outliers** — rates significantly above or below market
- **Forecast** rate trends for budget planning
- **Compare** multiple suppliers side by side

### How does benchmarking work?

ConTigo compares rates across:

1. **Your own data** — Average rates across all your rate cards
2. **Industry data** — Market intelligence for Swiss/DACH IT consulting rates
3. **Historical data** — Year-over-year trends for the same supplier

The AI highlights outliers and recommends actions (negotiate, accept, escalate).

---

## 6. Security & Compliance

### Where is my data stored?

All data is stored in **Azure Switzerland North (Zurich)**. This includes:

- Databases (PostgreSQL)
- File storage (Azure Blob Storage)
- AI processing (Azure OpenAI)
- Backups (geo-redundant within Switzerland)

**No customer data leaves Switzerland** unless you explicitly enable an optional integration that requires it.

### Is ConTigo compliant with Swiss data protection law (nDSG)?

Yes. ConTigo is fully compliant with:

- **nDSG / FADP** (Neues Datenschutzgesetz) — Swiss Federal Act on Data Protection (Sept. 2023)
- **VDSG** (Verordnung über den Datenschutz) — Data Protection Ordinance
- **GDPR** — For EU data subjects (applicable as supplementary law)

### Is ConTigo GDPR compliant?

Yes. ConTigo complies with all GDPR requirements:

- Right to access (Art. 15)
- Right to rectification (Art. 16)
- Right to erasure (Art. 17)
- Right to data portability (Art. 20)
- Data Processing Agreement (DPA) available for enterprise customers

### What security measures are in place?

| Measure | Details |
|---|---|
| **Encryption at rest** | AES-256 |
| **Encryption in transit** | TLS 1.3 |
| **Authentication** | Email/password + optional TOTP MFA |
| **Access control** | Role-based (RBAC) |
| **Tenant isolation** | Complete data separation between organisations |
| **Audit logging** | Every action is logged immutably |
| **IP allowlisting** | Restrict access to trusted networks (Enterprise) |
| **Penetration testing** | Annual third-party pen test |
| **Vulnerability scanning** | Automated (Dependabot + Snyk) |

### Do you have SOC 2 certification?

SOC 2 Type II certification is planned for post-Series A (estimated Q3 2027). In the meantime, we provide:

- Security architecture documentation
- Data Processing Agreement (DPA)
- List of sub-processors
- Annual penetration test reports (on request under NDA)

---

## 7. Integrations

### What integrations are available?

| Integration | Direction | Plan Required |
|---|---|---|
| **DocuSign** | Bidirectional | Professional+ |
| **SharePoint** | Bidirectional | Professional+ |
| **Outlook Calendar** | Outbound | All |
| **Google Calendar** | Outbound | All |
| **Slack** | Outbound (notifications) | Professional+ |
| **Microsoft Teams** | Outbound (notifications) | Professional+ |
| **SAP** | Bidirectional | Enterprise |
| **Webhooks** | Outbound (custom events) | Professional+ |
| **SFTP** | Inbound (file import) | Enterprise |
| **REST API** | Bidirectional | Enterprise |

### Can I build custom integrations?

Yes — Enterprise customers get full REST API access with:

- OpenAPI specification
- API key authentication
- Rate-limited endpoints
- Webhook events for real-time notifications
- SDKs (planned for TypeScript, Python)

### Is there a Zapier / Make.com integration?

Not yet — planned for Q4 2026. In the meantime, Enterprise customers can use our webhook events to connect with Zapier or Make.com via their webhook triggers.

---

## 8. Billing & Plans

### What plans are available?

| Plan | Price (Monthly) | Price (Annual) | Contracts |
|---|---|---|---|
| **Starter** | CHF 490 | CHF 4,900 (save 17%) | Up to 500 |
| **Professional** | CHF 1,490 | CHF 14,900 (save 17%) | Up to 5,000 |
| **Enterprise** | Custom | Custom | Unlimited |

All prices exclude 8.1% MWST.

### What's included in each plan?

| Feature | Starter | Professional | Enterprise |
|---|---|---|---|
| AI extraction | ✅ | ✅ | ✅ |
| AI chatbot | ✅ (100 queries/mo) | ✅ (2,000 queries/mo) | ✅ (unlimited) |
| Rate card analysis | ✅ (basic) | ✅ (full + benchmarking) | ✅ (full + market data) |
| Obligation tracking | ✅ | ✅ | ✅ |
| Workflows | — | ✅ | ✅ (custom) |
| Integrations | Calendar only | DocuSign, SharePoint, Slack | All + API |
| Users | Up to 5 | Up to 25 | Unlimited |
| SSO (SAML/OIDC) | — | — | ✅ |
| IP allowlisting | — | — | ✅ |
| Support | Email | Email + chat | Dedicated CSM |

### Can I upgrade or downgrade at any time?

Yes. Changes take effect on your next billing cycle. Upgrades are prorated.

### Do you offer discounts for non-profits or startups?

Yes — contact us at <sales@contigo-app.ch> for special pricing.

---

## 9. Data & Privacy

### Who owns the data I upload?

**You do.** ConTigo is a data processor — you remain the data controller. We never claim ownership of your contracts, rate cards, or any other data.

### Can I export all my data?

Yes — at any time:

- **Contracts:** PDF, JSON, CSV export
- **Metadata:** Excel, CSV, JSON export
- **Rate cards:** Excel, CSV export
- **Analytics:** PDF, Excel export
- **Full data export:** JSON bulk export (all data in one archive)

There is no lock-in — you can leave at any time with all your data.

### What happens to my data if I cancel?

- **30-day grace period** — Your data is preserved for 30 days after cancellation
- **Data export** — You can export all data during the grace period
- **Permanent deletion** — After 30 days, all data is permanently deleted
- **Confirmation** — You receive a written confirmation of deletion

### Does ConTigo use my data to train AI models?

**No.** Your data is never used to train or fine-tune foundation models (GPT-4o, Mistral, etc.). AI providers have zero-data-retention agreements with ConTigo.

Your corrections improve extraction accuracy only within your own tenant.

### Who are your sub-processors?

| Sub-Processor | Purpose | Location |
|---|---|---|
| **Microsoft Azure** | Cloud hosting, compute, storage | Switzerland North |
| **Azure OpenAI** | AI processing | Switzerland North |
| **Sentry** | Error monitoring | EU (Frankfurt) |
| **Stripe** | Payment processing | EU |

A complete sub-processor list is available on request and in our DPA.

---

## 10. Technical / Developer

### What technology stack does ConTigo use?

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS |
| **Backend** | Node.js 22, Prisma ORM |
| **Database** | PostgreSQL 16 (pgvector for AI) |
| **Queues** | Redis 7, BullMQ |
| **AI** | Azure OpenAI (GPT-4o), Mistral AI |
| **Storage** | Azure Blob Storage (S3-compatible) |
| **Infrastructure** | Docker, PM2, Azure Container Apps |

### Is there a public API?

A full REST API is available on the Enterprise plan. It includes:

- Contract CRUD operations
- Search & filtering
- Rate card management
- AI extraction triggers
- Webhook event subscriptions
- OpenAPI 3.0 specification

### What are the API rate limits?

| Plan | Rate Limit |
|---|---|
| **Enterprise** | 1,000 requests/minute |
| **Professional (future)** | 100 requests/minute |

### Does ConTigo support SSO?

Yes — Enterprise customers can use **SAML 2.0** or **OpenID Connect (OIDC)** to integrate with their identity provider (Azure AD, Okta, Google Workspace, etc.).

---

## 11. Support

### How do I get support?

| Channel | Plan | Availability | Response Time |
|---|---|---|---|
| **Knowledge Base** | All | 24/7 | Self-service |
| **Email** | All | <support@contigo-app.ch> | <24 hours |
| **In-app chat** | Professional+ | Business hours (CET) | <4 hours |
| **Dedicated CSM** | Enterprise | Business hours (CET) | <1 hour |
| **Phone** | Enterprise | Mon–Fri 08:00–18:00 CET | Immediate |

### What languages is support available in?

- German (Deutsch) ✅
- French (Français) ✅
- English ✅
- Italian (Italiano) — Email only

### How do I report a bug or request a feature?

- **Bug:** In-app → Help → Report Issue (or email <support@contigo-app.ch>)
- **Feature request:** In-app → Help → Feature Request (or email <feedback@contigo-app.ch>)

All feature requests are reviewed monthly and prioritised by customer impact.

### Is there an SLA?

| Plan | Uptime SLA | Credits |
|---|---|---|
| **Starter** | 99.5% | None |
| **Professional** | 99.9% | 10% monthly credit for breach |
| **Enterprise** | 99.95% | Custom SLA with financial credits |

See [SLO_SLA_DEFINITIONS.md](SLO_SLA_DEFINITIONS.md) for detailed SLA terms.

---

*ConTigo GmbH — Zurich, Switzerland*
*Last updated: February 2026*
