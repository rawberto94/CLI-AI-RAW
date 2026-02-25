# RFx (Merchant Agent) UI Behavior Specification

## Overview
The **Merchant** agent manages the complete RFx lifecycle with **5 HITL checkpoints** where human approval is required before proceeding.

---

## 📍 RFx UI Entry Points

### Entry Point 1: Contigo Lab → Approval Queue
```
[Approval Queue Card]
🟡 3 RFx items awaiting approval
   ├─ Vendor Shortlist: "Laptop Procurement RFQ" 
   ├─ Award Decision: "Cloud Services RFP"
   └─ RFx Draft: "Office Furniture RFP"
```

### Entry Point 2: Contract Page → "Create RFx" Button
```
[Contract Detail Page]
┌─────────────────────────────────────────────┐
│ TechCorp MSA 2024                    [⋯]   │
├─────────────────────────────────────────────┤
│ ...                                         │
│                                             │
│ [🤝 Create RFx from this contract]          │
│     Auto-extract requirements & terms       │
└─────────────────────────────────────────────┘
```

### Entry Point 3: Chat → @Merchant
```
User: "@Merchant create an RFQ for 500 laptops"
Merchant: "I'll create that RFQ. What budget and timeline?"
```

---

## 🔄 RFx Phase-by-Phase UI Behavior

### PHASE 1: RFx Creation 🤖→👤

#### Step 1: User Initiates
```
┌──────────────────────────────────────────────────────────────┐
│ Create RFx Event                                    [Close X] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Event Type:    [RFP ▼] [RFQ] [RFI] [Auction]               │
│                                                              │
│  Title:         [Laptop Procurement - Q3 2024        ]      │
│                                                              │
│  Description:   [Procurement of 500 business laptops        │
│                  for engineering team...                     │
│                  ─────────────────────────────────────       │
│                  💡 Auto-generated from contract:            │
│                  "Based on TechCorp MSA Section 4.2,         │
│                   standard IT procurement terms apply"       │
│                                                              │
│  Category:      [IT Equipment ▼]                            │
│  Contract Type: [Hardware Purchase ▼]                       │
│                                                              │
│  Estimated Value:  [$800,000                      ] [USD]   │
│                                                              │
│  Response Deadline:  [Oct 15, 2024        ] [📅]            │
│                                                              │
│  [📎 Attach Contract Requirements]                          │
│      └─ TechCorp_MSA_2024.pdf (auto-attached)               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🤖 Merchant will generate:                            │   │
│  │  • Technical requirements                             │   │
│  │  • Commercial terms                                   │   │
│  │  • Evaluation criteria                                │   │
│  │  • Suggested vendor list                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│              [Cancel]    [Preview Requirements →]            │
└──────────────────────────────────────────────────────────────┘
```

#### Step 2: AI Generates Requirements (Loading State)
```
┌──────────────────────────────────────────────────────────────┐
│ Generating RFx Requirements...                       [Cancel] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🤖 Merchant is creating your RFx...                         │
│                                                              │
│  [████████████████████░░░░░░░░░░] 65%                       │
│                                                              │
│  ✓ Analyzing contract terms                                  │
│  ✓ Generating technical requirements                         │
│  ✓ Creating evaluation criteria                              │
│  → Sourcing vendor database...                               │
│                                                              │
│  [⚡ This takes ~30 seconds]                                 │
└──────────────────────────────────────────────────────────────┘
```

#### Step 3: HITL Checkpoint - Review Draft RFx
```
┌──────────────────────────────────────────────────────────────────────┐
│ 📋 Review RFx Draft: Laptop Procurement - Q3 2024          [Edit ✏️] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ⚠️ HITL CHECKPOINT: Review before publishing                        │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  📋 REQUIREMENTS (AI-Generated - 8 items)                       │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  Technical Requirements:                                        │ │
│  │  ☐ Processor: Intel Core i7 or equivalent (Confidence: 95%)    │ │
│  │  ☐ RAM: Minimum 16GB DDR4 (Confidence: 98%)                    │ │
│  │  ☐ Storage: 512GB NVMe SSD (Confidence: 92%)                   │ │
│  │  ☐ Display: 14" FHD IPS (Confidence: 88%)                      │ │
│  │  ☐ Warranty: 3-year on-site (Confidence: 85%)                  │ │
│  │                                                                 │ │
│  │  Commercial Requirements:                                       │ │
│  │  ☐ Delivery: Within 30 days of PO                               │ │
│  │  ☐ Payment: Net 30                                              │ │
│  │  ☐ Support: 24/7 phone support required                         │ │
│  │                                                                 │ │
│  │  [+ Add Requirement]  [🔄 Regenerate All]                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  ⚖️ EVALUATION CRITERIA (100 points total)                      │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  Price Competitiveness ............ 40 points                  │ │
│  │  Technical Compliance ............. 30 points                  │ │
│  │  Delivery Timeline ................ 15 points                  │ │
│  │  Warranty & Support ............... 10 points                  │ │
│  │  Vendor Track Record .............. 5 points                   │ │
│  │                                                                 │ │
│  │  [Edit Criteria]                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  🏢 SUGGESTED VENDORS (5 found in database)                     │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  ☑️ Dell Technologies        [🗑️ Remove] [📊 View History]     │ │
│  │     Past: 3 contracts, 4.2★ rating, avg $650/unit              │ │
│  │                                                                 │ │
│  │  ☑️ HP Enterprise            [🗑️ Remove] [📊 View History]     │ │
│  │     Past: 2 contracts, 4.0★ rating, avg $680/unit              │ │
│  │                                                                 │ │
│  │  ☑️ Lenovo Business          [🗑️ Remove] [📊 View History]     │ │
│  │     Past: 1 contract, 4.5★ rating, avg $620/unit               │ │
│  │                                                                 │ │
│  │  ☐ Microsoft Surface (new)   [➕ Add]                          │ │
│  │                                                                 │ │
│  │  [+ Add Custom Vendor]                                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Estimated Timeline:                                                 │
│  • Publish: Today → Responses due: Oct 15                            │
│  • Evaluation: Oct 16-20                                             │
│  • Award: Oct 25                                                     │
│                                                                      │
│  [💾 Save as Draft]          [Cancel]    [✅ Publish RFx →]         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**User Actions:**
- Edit requirements (add/remove/modify)
- Adjust evaluation criteria weights
- Add/remove suggested vendors
- Save as draft OR publish

**On "Publish":** RFx moves to "Published" status, vendors notified

---

### PHASE 2: Vendor Shortlisting (Optional - for complex sourcing)

If user didn't select vendors in Phase 1, Merchant suggests shortlisted vendors:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🏆 Vendor Shortlist Recommendation                        [Skip →]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🤖 Merchant analyzed 23 potential vendors and recommends:           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  RECOMMENDED VENDORS (Top 5 by composite score)                 │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  1. 🥇 Dell Technologies                    Score: 94/100      │ │
│  │     Capabilities: ✅ Technical ✅ Financial ✅ Delivery         │ │
│  │     Past Performance: 4.2★ (3 contracts, $2.1M total)          │ │
│  │     Risk: Low | Certifications: ISO 9001, SOC 2                │ │
│  │     [📊 Full Profile]  [⚠️ Risk Report]                        │ │
│  │                                                                 │ │
│  │  2. 🥈 Lenovo Business                        Score: 91/100    │ │
│  │     Capabilities: ✅ Technical ✅ Financial ✅ Delivery         │ │
│  │     Past Performance: 4.5★ (1 contract, $450K)                 │ │
│  │     Risk: Low | Certifications: ISO 9001                       │ │
│  │     [📊 Full Profile]  [⚠️ Risk Report]                        │ │
│  │                                                                 │ │
│  │  3. 🥉 HP Enterprise                          Score: 87/100    │ │
│  │     Capabilities: ✅ Technical ✅ Financial ⚠️ Delivery         │ │
│  │     Past Performance: 4.0★ (2 contracts, $890K)                │ │
│  │     Risk: Medium (delivery delays in past)                     │ │
│  │     [📊 Full Profile]  [⚠️ Risk Report]                        │ │
│  │                                                                 │ │
│  │  [View Vendors 4-5]  [📋 Export Analysis]                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  💡 Recommendation Rationale:                                        │
│  "Dell leads due to strong past performance and competitive         │
│   pricing history. Lenovo offers best price but limited track       │
│   record. HP has delivery risk flagged in previous contract."       │
│                                                                      │
│  ⚠️ HITL CHECKPOINT: Approve shortlist before inviting              │
│                                                                      │
│  [Edit Selection]  [+ Add Vendor]  [❌ Reject]  [✅ Approve & Invite]│
└──────────────────────────────────────────────────────────────────────┘
```

---

### PHASE 3: Bid Collection (Background - No UI until complete)

**Status shown in Activity Feed:**
```
[Activity Feed]
🤝 Merchant    2 hours ago
   Cloud Services RFP - Collecting bids
   • 4 of 5 vendors responded
   • 1 pending (Dell - due in 2 days)
   • Auto-reminder sent

[View RFx Progress →]
```

---

### PHASE 4: Bid Comparison 🤖→👤

Once all bids received:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📊 Bid Comparison Analysis                              [💾 Export]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  RFx: Cloud Services RFP ($2.4M estimated)                           │
│  Bids Received: 4 of 5 invited vendors                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  SIDE-BY-SIDE COMPARISON                                        │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  Criteria          │ AWS        │ Azure      │ GCP      │ IBM  │ │
│  │  ──────────────────┼────────────┼────────────┼──────────┼──────┤ │
│  │  Total Price       │ $2.1M      │ $2.3M      │ $2.0M ⭐  │ $2.5M│ │
│  │  Monthly           │ $175K      │ $192K      │ $167K ⭐  │ $208K│ │
│  │  ──────────────────┼────────────┼────────────┼──────────┼──────┤ │
│  │  Technical (30%)   │ 28/30      │ 27/30      │ 26/30    │ 22/30│ │
│  │  • Compute         │ ✅✅✅     │ ✅✅✅     │ ✅✅○   │ ✅○○ │ │
│  │  • Storage         │ ✅✅✅     │ ✅✅✅     │ ✅✅✅  │ ✅✅○│ │
│  │  • Security        │ ✅✅✅     │ ✅✅✅     │ ✅✅○   │ ✅✅○│ │
│  │  ──────────────────┼────────────┼────────────┼──────────┼──────┤ │
│  │  Delivery (15%)    │ 15/15 ⭐   │ 12/15      │ 13/15    │ 10/15│ │
│  │  Support (10%)     │ 8/10       │ 9/10 ⭐    │ 8/10     │ 7/10 │ │
│  │  Track Record (5%) │ 5/5 ⭐     │ 5/5 ⭐     │ 3/5      │ 4/5  │ │
│  │  ──────────────────┼────────────┼────────────┼──────────┼──────┤ │
│  │  TOTAL SCORE       │ 91/100     │ 90/100     │ 88/100   │ 78/100│ │
│  │  Confidence        │ 95%        │ 95%        │ 92%      │ 88%  │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  💡 KEY INSIGHTS (AI-Generated)                                 │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  • Price Gap: $500K between highest (IBM) and lowest (GCP)    │ │
│  │  • AWS offers best delivery timeline (2-week migration)        │ │
│  │  • Azure has strongest enterprise support track record         │ │
│  │  • GCP lowest cost but fewer referenceable enterprise clients  │ │
│  │  • IBM non-compliant on 2 technical requirements               │ │
│  │                                                                 │ │
│  │  [📋 View Detailed Technical Analysis]                         │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ⚠️ HITL CHECKPOINT: Review comparison before award recommendation  │
│                                                                      │
│  [❌ Request Re-bids]  [📧 Ask Vendor Questions]  [✅ Proceed to Award →]│
└──────────────────────────────────────────────────────────────────────┘
```

---

### PHASE 5: Award Recommendation 🤖→👤 ⭐ CRITICAL

**This is the most important HITL checkpoint:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🏆 Award Recommendation                          [Urgent - 2 days]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🤖 Merchant Recommendation:                                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                                                                 │ │
│  │           🥇 AWARD TO: Amazon Web Services (AWS)               │ │
│  │                                                                 │ │
│  │              Total Score: 91/100 (1st place)                   │ │
│  │              Contract Value: $2.1M (3-year)                    │ │
│  │              Savings vs Budget: $300K (12.5%)                  │ │
│  │                                                                 │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │ │
│  │                                                                 │ │
│  │  JUSTIFICATION:                                                 │ │
│  │                                                                 │ │
│  │  AWS scored highest overall with strong technical compliance   │ │
│  │  (28/30), perfect delivery score (15/15), and proven track     │ │
│  │  record (5/5). While not the lowest price, the $100K premium   │ │
│  │  over GCP is justified by superior delivery capabilities and   │ │
│  │  lower implementation risk based on historical performance.    │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  ⚠️ RISK ANALYSIS                                               │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  Selected Vendor (AWS) Risks:                                   │ │
│  │  • Low: Proven track record with your organization              │ │
│  │  • Low: Strong financial stability                              │ │
│  │  • Medium: Price escalation risk in years 2-3 (mitigated by    │ │
│  │            price lock clause in contract)                       │ │
│  │                                                                 │ │
│  │  Alternative (GCP) Risks if chosen:                            │ │
│  │  • Medium: Fewer enterprise references in your industry        │ │
│  │  • Medium: Migration complexity - longer time-to-value         │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  🔄 ALTERNATIVES CONSIDERED                                     │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  2nd Place: Microsoft Azure ($2.3M, Score: 90/100)             │ │
│  │  • Pros: Strong enterprise support, hybrid cloud capabilities  │ │
│  │  • Cons: $200K more expensive, longer migration timeline       │ │
│  │  • [🔄 Select Azure Instead]                                   │ │
│  │                                                                 │ │
│  │  3rd Place: Google Cloud ($2.0M, Score: 88/100)                │ │
│  │  • Pros: Lowest cost, modern infrastructure                    │ │
│  │  • Cons: Higher delivery risk, fewer enterprise refs           │ │
│  │  • [🔄 Select GCP Instead]                                     │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  📝 APPROVAL DETAILS                                            │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  Your Approval Required Because:                               │ │
│  │  • Contract value exceeds $1M threshold                        │ │
│  │  • Strategic vendor relationship impact                        │ │
│  │  • Multi-year commitment (3 years)                             │ │
│  │                                                                 │ │
│  │  Approval Chain:                                               │ │
│  │  ☐ You (Procurement Manager)                                   │ │
│  │  ☐ CFO (Required for >$2M - notification sent)                 │ │
│  │  ☐ Legal (Required - notification sent)                        │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [💾 Save for Later]  [❌ Reject & Request Re-bids]                  │
│                                                                      │
│  [✅ APPROVE AWARD TO AWS - $2.1M]                                  │
│  [🔄 APPROVE WITH MODIFICATIONS]                                    │
│  [🔄 AWARD TO DIFFERENT VENDOR]                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**On Approval:**
- Award letter generated
- Vendor notification sent
- Contract creation workflow triggered
- Savings tracked in dashboard

---

### PHASE 6: Negotiation Support (Optional)

If user selects "Approve with Modifications":

```
┌──────────────────────────────────────────────────────────────────────┐
│ 💬 Negotiation Strategy Assistant                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Vendor: Amazon Web Services                                          │
│  Current Offer: $2.1M (3-year)                                       │
│                                                                      │
│  🤖 Merchant Suggested Counter-Offer:                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  LEVERAGE POINTS IDENTIFIED:                                    │ │
│  │                                                                 │ │
│  │  1. 💰 Price Leverage                                           │ │
│  │     Your Position: GCP bid $100K lower                         │ │
│  │     Suggested Action: Request 5% reduction ($105K savings)     │ │
│  │     Success Probability: 75%                                   │ │
│  │                                                                 │ │
│  │  2. 📅 Payment Terms                                            │ │
│  │     Current: Net 30                                              │ │
│  │     Suggested: Net 45 (improves your cash flow)                │ │
│  │     Success Probability: 90%                                   │ │
│  │                                                                 │ │
│  │  3. 🔒 Price Lock                                               │ │
│  │     Suggested: Cap year 2-3 increases at 3% (vs standard 5%)   │ │
│  │     Risk Mitigation: High                                        │ │
│  │                                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  📝 COUNTER-OFFER LETTER (AI-Drafted)                           │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ │
│  │                                                                 │ │
│  │  Subject: Award Notification with Contract Terms Discussion    │ │
│  │                                                                 │ │
│  │  Dear AWS Team,                                                  │ │
│  │                                                                 │ │
│  │  We are pleased to inform you that AWS has been selected...    │ │
│  │  [Full letter editable below]                                    │ │
│  │                                                                 │ │
│  │  [✏️ Edit Letter]  [📋 View Full Text]                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [💾 Save Draft]  [🤝 Send Counter-Offer]  [⏭️ Accept Original]      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📱 RFx Status Card (In Contigo Lab Dashboard)

```
┌──────────────────────────────────────────────────────────────┐
│ 🤝 Active RFx Events (3)                              [+ New] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🟡 Laptop Procurement RFQ                      [View →] │ │
│  │    Status: Awaiting Award Decision ⏳                  │ │
│  │    Bids: 4 received | Budget: $800K | Value: $725K    │ │
│  │    ⏰ Decision due in 2 days                           │ │
│  │    [🏆 View Comparison]  [✅ Make Award Decision]      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🟢 Cloud Services RFP                          [View →] │ │
│  │    Status: Published (Collecting Bids)                 │ │
│  │    Bids: 2 of 5 received | Closes: Oct 15             │ │
│  │    [📊 View Progress]  [📧 Send Reminder]              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ✅ Office Furniture RFP                        [View →] │ │
│  │    Status: Awarded to Steelcase (3 days ago)           │ │
│  │    Award Value: $450K | Savings: $50K (10%)           │ │
│  │    [📄 View Contract]  [📈 View Savings Report]        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔔 Notification Examples

### Email Notification: Award Approval Needed
```
Subject: [ACTION REQUIRED] RFx Award Decision - Cloud Services RFP ($2.1M)

Hi [User],

The bid evaluation for Cloud Services RFP is complete. Merchant recommends 
awarding to Amazon Web Services for $2.1M (3-year term).

Key Details:
• Savings vs Budget: $300K (12.5%)
• Vendor Score: 91/100 (1st of 4 bidders)
• Risk Level: Low

This award requires your approval because:
✓ Value exceeds $1M threshold
✓ Multi-year strategic commitment

[Review & Approve] [View Comparison] [Request Changes]

Decision needed by: October 25, 2024
```

---

## Summary: HITL Touch Points

| Phase | User Action | AI Assistance | Time Required |
|-------|-------------|---------------|---------------|
| 1. Create RFx | Fill basic info | Generate requirements, criteria, vendors | 10 min |
| 2. Review Draft | Edit/approve AI output | Draft complete RFx package | 15 min |
| 3. Shortlist (opt) | Approve/reject suggestions | Analyze vendors, rank by score | 5 min |
| 4. Collect Bids | Wait | Auto-collect, send reminders | Passive |
| 5. Compare | Review comparison | Score bids, generate insights | 10 min |
| 6. Award ⭐ | Make final decision | Recommend winner with justification | 10 min |
| 7. Negotiate (opt) | Edit/approve counter | Draft negotiation strategy | 10 min |

**Total Human Time:** ~30-60 minutes per RFx event
**Total AI Processing:** Fully automated between checkpoints
