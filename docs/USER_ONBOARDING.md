# ConTigo — User Onboarding Guide

**Getting Started with AI-Powered Contract Management**
**Version 1.0 — February 2026**

---

## Table of Contents

1. [Welcome to ConTigo](#1-welcome-to-contigo)
2. [Creating Your Account](#2-creating-your-account)
3. [Navigating the Dashboard](#3-navigating-the-dashboard)
4. [Uploading Your First Contract](#4-uploading-your-first-contract)
5. [Understanding AI Extraction](#5-understanding-ai-extraction)
6. [Managing Contracts](#6-managing-contracts)
7. [Using the AI Chatbot](#7-using-the-ai-chatbot)
8. [Rate Card Management](#8-rate-card-management)
9. [Obligation Tracking](#9-obligation-tracking)
10. [Workflows & Approvals](#10-workflows--approvals)
11. [Team Collaboration](#11-team-collaboration)
12. [Analytics & Reporting](#12-analytics--reporting)
13. [Settings & Customisation](#13-settings--customisation)
14. [Security Features](#14-security-features)
15. [Integrations](#15-integrations)
16. [Mobile Access](#16-mobile-access)
17. [Tips & Best Practices](#17-tips--best-practices)
18. [Getting Help](#18-getting-help)

---

## 1. Welcome to ConTigo

ConTigo is your AI-powered contract lifecycle management platform, designed for Swiss and European businesses. It helps you:

- **Upload** contracts in any format (PDF, DOCX, images) and have AI extract key metadata in seconds
- **Track** obligations, deadlines, and renewals automatically
- **Analyse** rate cards, benchmark pricing, and detect outliers
- **Chat** with your contracts using natural language AI
- **Collaborate** with your team on reviews, approvals, and redlines
- **Report** on your entire contract portfolio with real-time analytics

### What Makes ConTigo Different

| Feature | Traditional CLM | ConTigo |
|---|---|---|
| Contract ingestion | Manual data entry | AI-powered auto-extraction |
| Search | Keyword-based | Semantic AI search ("find NDAs expiring in Q3") |
| Rate analysis | Spreadsheets | AI benchmarking with market intelligence |
| Compliance | Manual review | Automated clause detection & risk scoring |
| Language | English-only | German, French, Italian, English |
| Data residency | Cloud (US) | Switzerland 🇨🇭 (Zurich data centre) |

---

## 2. Creating Your Account

### Step 1: Accept Your Invitation

Your organisation administrator will send you an email invitation. Click the link to reach the registration page.

### Step 2: Set Up Your Profile

1. Enter your **full name** and choose a **strong password** (minimum 12 characters)
2. Select your **department** (Legal, Procurement, Finance, Operations, etc.)
3. Select your **preferred language** (DE, FR, IT, EN)
4. Review and accept the Terms of Service

### Step 3: Enable Multi-Factor Authentication (Recommended)

For enhanced security, enable MFA:

1. Go to **Settings → Security**
2. Click **Enable MFA**
3. Scan the QR code with your authenticator app (Google Authenticator, Authy, or Microsoft Authenticator)
4. Enter the 6-digit verification code
5. Save your backup codes in a secure location

> **Note:** Enterprise plans may require MFA for all users.

### Step 4: Complete the Guided Tour

On your first login, ConTigo offers an interactive walkthrough highlighting key features. We recommend completing it — it takes about 3 minutes.

---

## 3. Navigating the Dashboard

### Main Navigation

| Section | Icon | Purpose |
|---|---|---|
| **Dashboard** | 🏠 | Overview: key metrics, recent activity, upcoming deadlines |
| **Contracts** | 📄 | Full contract list with search, filter, sort |
| **Rate Cards** | 💰 | Rate card management and benchmarking |
| **Analytics** | 📊 | Charts, reports, portfolio insights |
| **Workflows** | ⚡ | Approval workflows and automation |
| **Obligations** | ⏰ | Deadline tracking and notifications |
| **Chat / AI** | 🤖 | AI assistant for contract Q&A |
| **Settings** | ⚙️ | Account, team, integrations |

### Dashboard Widgets

Your dashboard shows at a glance:

- **Contract Portfolio** — Total contracts, active vs expired, value summary
- **Upcoming Deadlines** — Contracts expiring, renewals due, obligations overdue
- **Recent Activity** — Latest uploads, reviews, approvals
- **AI Insights** — Smart recommendations and risk alerts
- **Team Activity** — Who's working on what

### Customising Your View

- **Drag-and-drop** widgets to rearrange your dashboard
- **Filter** by team, department, contract type, or date range
- **Bookmark** frequently used views for quick access

---

## 4. Uploading Your First Contract

### Supported Formats

| Format | Extension | OCR Required |
|---|---|---|
| PDF (text) | `.pdf` | No |
| PDF (scanned) | `.pdf` | Yes (automatic) |
| Word | `.docx`, `.doc` | No |
| Excel (rate cards) | `.xlsx`, `.csv` | No |
| Images | `.png`, `.jpg`, `.tiff` | Yes (automatic) |

### Upload Methods

#### Method 1: Drag & Drop

1. Navigate to **Contracts** page
2. Drag one or more files onto the upload zone
3. ConTigo auto-detects the file type and begins processing

#### Method 2: Click to Upload

1. Click the **Upload Contract** button (top right)
2. Select files from your computer
3. Optionally add metadata (title, type, counterparty)
4. Click **Upload & Process**

#### Method 3: Email Forwarding

Forward contracts to your dedicated ConTigo email address:
`contracts@yourcompany.contigo-app.ch`

#### Method 4: Bulk Upload

For migrating your existing contract library:
1. Go to **Settings → Import**
2. Upload a ZIP archive or select a folder
3. ConTigo queues all files for processing

### What Happens After Upload

```
📁 File Uploaded
    ↓ (5 seconds)
🔍 OCR & Text Extraction
    ↓ (10-30 seconds)
🤖 AI Analysis & Metadata Extraction
    ↓ (30-90 seconds)
📋 Structured Contract Created
    ↓
✅ Ready for Review
```

The AI extracts:
- **Parties** — Who is involved (names, roles)
- **Key dates** — Start date, end date, renewal date
- **Financial terms** — Contract value, payment terms, currency
- **Contract type** — NDA, MSA, SOW, SLA, amendment, etc.
- **Clauses** — Termination, liability, IP, confidentiality, etc.
- **Risk indicators** — Unusual clauses, missing protections
- **Language** — Auto-detected (DE, FR, IT, EN)

---

## 5. Understanding AI Extraction

### How It Works

ConTigo uses multiple AI models, hosted in Swiss data centres, to analyse your contracts:

1. **Document parsing** — Converts PDF/DOCX to structured text
2. **Entity recognition** — Identifies parties, dates, amounts
3. **Clause classification** — Categorises clauses by type and risk level
4. **Metadata extraction** — Fills in structured fields automatically
5. **Embedding** — Creates a semantic fingerprint for intelligent search

### Reviewing AI Results

After extraction, you'll see a **Review** panel:

- **Green fields** ✅ — High-confidence extraction (>95%), auto-accepted
- **Yellow fields** ⚠️ — Medium confidence (70–95%), review recommended
- **Red fields** ❌ — Low confidence (<70%), manual entry needed

### Correcting the AI

If the AI gets something wrong:

1. Click on any extracted field
2. Enter the correct value
3. Click **Save Correction**

> **Learning:** Your corrections improve ConTigo's accuracy for future contracts. The AI learns from your feedback over time.

### Confidence Scores

| Score | Meaning | Action Needed |
|---|---|---|
| 95–100% | Very confident | Auto-accepted |
| 80–94% | Confident | Quick review |
| 60–79% | Uncertain | Review required |
| <60% | Low confidence | Manual entry likely |

---

## 6. Managing Contracts

### Contract List View

The contracts page shows all your contracts with:

- **Search** — Type to search by title, party, or clause content
- **Smart search** — Use natural language: "NDAs expiring in 2026" or "contracts over CHF 100K"
- **Filters** — Status, type, date range, department, value range
- **Bulk actions** — Select multiple contracts to export, assign, or archive

### Contract Statuses

| Status | Meaning |
|---|---|
| **Draft** | Contract being prepared |
| **Pending Review** | Awaiting team review |
| **Active** | Signed and in effect |
| **Expired** | Past end date |
| **Terminated** | Ended early |
| **Renewed** | Automatically or manually renewed |
| **Archived** | Moved to long-term storage |

### Contract Detail Page

Each contract has a detailed view with tabs:

| Tab | Content |
|---|---|
| **Overview** | Key metadata, parties, dates, value |
| **Document** | Original file viewer with AI highlights |
| **Clauses** | Extracted clauses with risk ratings |
| **Obligations** | Tracked obligations and deadlines |
| **History** | All changes, versions, and audit trail |
| **Comments** | Team discussions and notes |
| **Related** | Linked contracts (amendments, renewals) |

### Version Control

Every change creates a new version. You can:

- **Compare** two versions side by side (redline)
- **Restore** any previous version
- **Track** who made which changes and when

---

## 7. Using the AI Chatbot

### Starting a Conversation

1. Click the **AI Chat** icon (💬) in the sidebar or on any contract page
2. Ask questions in natural language

### What You Can Ask

| Category | Example Questions |
|---|---|
| **Contract queries** | "What is the termination clause in contract X?" |
| **Portfolio search** | "Show me all NDAs with Company Y" |
| **Compliance** | "Which contracts don't have a GDPR clause?" |
| **Analytics** | "What's our total contract value this quarter?" |
| **Rate cards** | "How do our Java developer rates compare to market?" |
| **Obligations** | "What deadlines are coming up next month?" |
| **Drafting** | "Draft an NDA for a Swiss technology partner" |

### Tips for Better AI Responses

- **Be specific** — "What is the liability cap in our MSA with Swisscom?" works better than "Tell me about liability"
- **Ask follow-ups** — The AI remembers the conversation context
- **Reference contracts** — "In contract #CR-2024-0042, what are the payment terms?"
- **Use your language** — Ask in German, French, Italian, or English

---

## 8. Rate Card Management

### Uploading Rate Cards

1. Navigate to **Rate Cards**
2. Click **Import Rate Card**
3. Upload an Excel/CSV file or paste data directly
4. ConTigo normalises roles, rates, and currencies automatically

### Key Features

- **Role normalisation** — Automatically matches "Sr. Developer" = "Senior Developer" = "Développeur Senior"
- **Benchmarking** — Compare supplier rates against market data and your portfolio averages
- **Outlier detection** — Flags rates significantly above or below market
- **Forecasting** — Projects rate trends for budget planning
- **Supplier scoring** — Ranks suppliers by value, compliance, and quality

### Rate Card Comparison

Select two or more rate cards to see:
- Side-by-side rate comparison by role
- Percentage differences highlighted
- Recommended actions (negotiate, accept, escalate)

---

## 9. Obligation Tracking

### How It Works

ConTigo automatically extracts obligations from your contracts:

- **Payment deadlines** — Invoice dates, payment terms
- **Delivery milestones** — Service delivery dates
- **Renewal dates** — Auto-renewal windows
- **Compliance deadlines** — Regulatory submissions, audits
- **Notice periods** — Termination notice windows

### Notifications

| Notification | Timing | Channel |
|---|---|---|
| **Upcoming deadline** | 30, 14, 7 days before | Email + in-app |
| **Overdue obligation** | Day of + daily reminders | Email + in-app + push |
| **Renewal window** | 90, 60, 30 days before | Email + in-app |
| **Assigned to you** | Immediately | Email + in-app |

### Calendar Integration

Sync obligations to your calendar:
- **Outlook** — One-click calendar sync
- **Google Calendar** — OAuth integration
- **iCal** — Standard calendar feed

---

## 10. Workflows & Approvals

### Creating a Workflow

1. Go to **Workflows → Create New**
2. Define **steps** (review, approve, sign)
3. Assign **reviewers/approvers** by role or person
4. Set **conditions** (e.g., contracts over CHF 50K require CFO approval)
5. Enable **notifications** at each step

### Approval Flow Example

```
Contract Created → Legal Review → Finance Approval → Executive Sign-off → Active
```

### Quick Actions

- **Approve** — Advance to the next step
- **Reject** — Return with comments
- **Delegate** — Forward to another approver
- **Escalate** — Flag for management attention

---

## 11. Team Collaboration

### Features

| Feature | Description |
|---|---|
| **Comments** | Leave notes on any contract, clause, or extraction |
| **@Mentions** | Tag team members for immediate notification |
| **Real-time editing** | See who's viewing/editing the same contract |
| **Tasks** | Assign review tasks to team members |
| **Activity feed** | See all team activity in one stream |
| **Departments** | Organise users by department with separate permissions |

### User Roles

| Role | Capabilities |
|---|---|
| **Viewer** | Read contracts, view analytics |
| **Contributor** | Upload, edit, comment on contracts |
| **Reviewer** | All contributor + approve workflows |
| **Manager** | All reviewer + manage team members |
| **Admin** | Full access + settings + integrations |

---

## 12. Analytics & Reporting

### Dashboard Analytics

- **Portfolio overview** — Total contracts, value, status distribution
- **Expiry timeline** — Visual calendar of upcoming expirations
- **Risk heatmap** — Contracts flagged by risk level
- **Spend analysis** — Contract spend by department, vendor, type
- **Processing metrics** — Upload-to-active timelines

### Custom Reports

1. Go to **Analytics → Reports**
2. Select a **template** or create a custom report
3. Choose **data sources** (contracts, rate cards, obligations)
4. Apply **filters** (date range, department, type)
5. Select **format** (PDF, Excel, CSV)
6. **Schedule** for automatic generation (daily, weekly, monthly)

### Export Options

| Format | Best For |
|---|---|
| **PDF** | Sharing with stakeholders |
| **Excel** | Further analysis in spreadsheets |
| **CSV** | Data integration with other systems |
| **API** | Programmatic access (Enterprise plan) |

---

## 13. Settings & Customisation

### Tenant Settings (Admin)

| Setting | Description |
|---|---|
| **Company profile** | Name, logo, address, billing |
| **Departments** | Create/manage organisational units |
| **Custom fields** | Add custom metadata fields to contracts |
| **Templates** | Upload contract templates for generation |
| **Branding** | Custom colours and logos |
| **Notifications** | Global notification preferences |

### Personal Settings

| Setting | Description |
|---|---|
| **Profile** | Name, email, language preference |
| **Notifications** | Email and in-app notification preferences |
| **Security** | Password, MFA, active sessions |
| **API tokens** | Generate personal access tokens |
| **Preferences** | Default view, timezone, date format |

---

## 14. Security Features

### Your Data Is Protected

| Feature | Details |
|---|---|
| **Data location** | Zurich, Switzerland 🇨🇭 |
| **Encryption at rest** | AES-256 |
| **Encryption in transit** | TLS 1.3 |
| **Authentication** | Email/password + optional MFA (TOTP) |
| **Access control** | Role-based (RBAC) with tenant isolation |
| **Audit trail** | Complete log of all actions |
| **IP restrictions** | Allowlist trusted IP ranges (Enterprise) |
| **Compliance** | nDSG/FADP, GDPR compliant |

### Data Ownership

- **You own your data** — We are a processor, not an owner
- **Data export** — Export all your data at any time (GDPR Art. 20)
- **Data deletion** — Request complete deletion of your data (GDPR Art. 17)
- **No vendor lock-in** — Standard export formats (PDF, JSON, CSV)

---

## 15. Integrations

### Available Integrations

| Integration | Type | Plan |
|---|---|---|
| **DocuSign** | E-signature | Professional+ |
| **SAP** | ERP sync | Enterprise |
| **SharePoint** | Document sync | Professional+ |
| **Outlook** | Calendar sync | All plans |
| **Google Calendar** | Calendar sync | All plans |
| **Slack** | Notifications | Professional+ |
| **Teams** | Notifications | Professional+ |
| **Webhooks** | Custom events | Professional+ |
| **SFTP** | File transfer | Enterprise |
| **REST API** | Full programmatic access | Enterprise |

### Setting Up an Integration

1. Go to **Settings → Integrations**
2. Click **Connect** next to the integration
3. Authenticate with the external service
4. Configure sync options (direction, frequency, mapping)
5. Test the connection
6. Enable

---

## 16. Mobile Access

ConTigo is fully responsive and works on:

- **Desktop** — Full feature set
- **Tablet** — Optimised layout for iPad/Android tablets
- **Mobile** — Key features: view contracts, approve workflows, check deadlines

### Mobile-Optimised Features

| Feature | Available on Mobile |
|---|---|
| Contract viewing | ✅ |
| AI chat | ✅ |
| Workflow approvals | ✅ |
| Obligation alerts | ✅ |
| Document upload | ✅ (camera capture) |
| Analytics dashboards | ✅ |
| Full contract editing | ⚠️ (basic) |
| Rate card management | ⚠️ (view only) |

---

## 17. Tips & Best Practices

### Getting the Most from ConTigo

1. **Upload all your contracts** — The more data ConTigo has, the better its AI insights become
2. **Review AI extractions early** — Corrections in the first 50 contracts dramatically improve accuracy
3. **Set up obligations** — Never miss a renewal or deadline again
4. **Use the chatbot** — It's faster than manual searching for most queries
5. **Create templates** — Standardise your contracts for faster drafting
6. **Schedule reports** — Automate weekly/monthly portfolio summaries
7. **Train your team** — Share this guide and use the in-app tour

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Global search |
| `Ctrl/Cmd + U` | Upload contract |
| `Ctrl/Cmd + N` | New contract |
| `Ctrl/Cmd + /` | Open AI chat |
| `Esc` | Close modal/panel |

---

## 18. Getting Help

### Self-Service

| Resource | Location |
|---|---|
| **Knowledge Base** | [help.contigo-app.ch](https://help.contigo-app.ch) |
| **FAQ** | See [FAQ.md](FAQ.md) |
| **Video Tutorials** | In-app → Help → Video Guides |
| **Release Notes** | In-app → Help → What's New |

### Support Channels

| Channel | Availability | Response Time |
|---|---|---|
| **In-app chat** | 24/7 (AI) + Business hours (human) | <5 min (AI), <4 hours (human) |
| **Email** | support@contigo-app.ch | <24 hours |
| **Phone** | +41 44 XXX XX XX | Mon–Fri, 08:00–18:00 CET |
| **Enterprise Slack** | Dedicated channel | <1 hour (business hours) |

### Reporting a Bug

1. Click **Help → Report an Issue** in the app
2. Describe what happened and what you expected
3. Attach screenshots if possible
4. Our team will investigate and respond within 24 hours

---

*ConTigo GmbH — Zurich, Switzerland*
*Last updated: February 2026*
