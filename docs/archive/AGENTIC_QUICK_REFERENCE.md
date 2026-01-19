# Agentic AI Quick Reference

## 🚀 Quick Start

### 1. Run Database Migration
```bash
psql $DATABASE_URL -f scripts/migrations/agentic-enhancements.sql
```

### 2. Enable Features
```env
ENABLE_INTENT_DETECTION=true
ENABLE_MULTI_AGENT=true
ENABLE_PROACTIVE_RISK=true
ENABLE_FEEDBACK_LEARNING=true
ENABLE_AB_TESTING=true
```

### 3. Test
Upload a contract and watch logs for:
- 🎯 Intent detected
- 🤝 Negotiation completed
- 🚨 Risks detected
- 📚 Thresholds adjusted
- 🧪 A/B test recorded

---

## 📊 System Overview

```
User Goal → Intent Detection → Multi-Agent Negotiation → Artifact Generation → Risk Detection → Learning
```

| Step | Agent | Purpose | Output |
|------|-------|---------|--------|
| 1 | Goal-Oriented Reasoner | Detect intent | Primary goal + priorities |
| 2 | Multi-Agent Coordinator | Optimize plan | Execution plan with phases |
| 3 | Artifact Generator | Generate with quality | Validated artifacts |
| 4 | Proactive Risk Detector | Find issues | Risk analysis + score |
| 5 | Feedback Learner | Improve | Adjusted thresholds |

---

## 🎯 Agent Files

| Agent | File | Lines | Purpose |
|-------|------|-------|---------|
| Goal-Oriented | `goal-oriented-reasoner.ts` | 500+ | Detect intent (7 goals) |
| Multi-Agent | `multi-agent-coordinator.ts` | 400+ | 5 specialists negotiate |
| Risk Detection | `proactive-risk-detector.ts` | 600+ | 8 risk types detected |
| Feedback Learning | `user-feedback-learner.ts` | 400+ | Learn from user edits |
| A/B Testing | `ab-testing-engine.ts` | 500+ | Optimize prompts/models |

---

## 🎯 Goal Detection

**7 User Goals:**
1. `NEGOTIATE` - Prepare for negotiations
2. `RISK_ASSESSMENT` - Identify risks
3. `COST_OPTIMIZATION` - Find savings
4. `COMPLIANCE_CHECK` - Verify compliance
5. `RENEWAL_PREP` - Prepare for renewal
6. `QUICK_REVIEW` - Fast overview
7. `DEEP_ANALYSIS` - Comprehensive analysis

**Signals Used:**
- User query keywords
- User role (legal, procurement, executive)
- Contract type
- Previous actions
- Contract metadata (renewal date, urgency)

**Output:** Primary goal, secondary goals, confidence, urgency, artifact priorities

---

## 🤝 Multi-Agent System

**5 Specialist Agents:**

| Agent | Priority | Expertise | Cost Multiplier |
|-------|----------|-----------|-----------------|
| LEGAL | 10 | Clauses, obligations, compliance | 1.5x |
| COMPLIANCE | 9 | Regulatory requirements | 1.3x |
| PRICING | 8 | Financial, pricing analysis | 1.2x |
| RISK | 7 | Risk analysis, liability | 1.0x |
| OPERATIONS | 6 | Overview, renewal | 0.8x |

**Negotiation:** Winner = highest `(priority × confidence)`

**Execution Plan:**
- Dependency graph (topological sort)
- Parallel phases where possible
- Cost + time estimation
- Optimization score (parallelization + efficiency + cost)

---

## 🚨 Risk Detection

**8 Risk Types:**

| Risk Type | Example | Severity |
|-----------|---------|----------|
| MISSING_CRITICAL_CLAUSE | No liability cap | CRITICAL |
| UNFAVORABLE_TERMS | Unlimited liability | HIGH |
| COMPLIANCE_GAP | Missing GDPR clause | HIGH |
| EXCESSIVE_LIABILITY | Risk score > 70 | CRITICAL |
| RENEWAL_RISK | <30 days to expiration | CRITICAL |
| PRICING_ANOMALY | >50% above average | HIGH |
| AMBIGUOUS_LANGUAGE | >3 vague terms | MEDIUM |
| OBLIGATION_CONFLICT | Overlapping deadlines | MEDIUM |

**Risk Score:** `CRITICAL×40 + HIGH×20 + MEDIUM×10 + LOW×5`

**Triggers:**
- Action required: `criticalCount > 0 OR highCount > 2`
- Escalation: `criticalCount > 2 OR (criticalCount > 0 AND highCount > 3)`

---

## 📚 Learning System

**Feedback Types:**
1. `ARTIFACT_EDIT` - User edited artifact
2. `ARTIFACT_REGENERATION` - User requested regeneration
3. `QUALITY_RATING` - User rated 1-5
4. `ERROR_REPORT` - User reported issue
5. `POSITIVE_FEEDBACK` - User praised

**Pattern Analysis:**
- Edit rate >50% → quality issue
- Field edited >30% → improve extraction
- Avg rating <3 → review generation

**Threshold Adjustment:**
- High edit rate → +0.05 accuracy
- Low rating → +0.05 overall
- Field issues → +0.03 completeness
- Max adjustment: +0.1 per cycle, cap at 0.95

---

## 🧪 A/B Testing

**Strategy:** Epsilon-greedy (20% explore, 80% exploit)

**Tests:**
- Different models: GPT-4o vs GPT-4o-mini vs GPT-3.5-turbo
- Different prompts: detailed vs concise vs structured
- Different temperatures: creative vs deterministic

**Winner Determination:**
- Min sample size: 20 per variant
- Statistical test: T-test with 95% confidence
- Selection criteria: `quality × (1 - cost/max_cost)`

**Example Tests:**
- `overview-model-test`: Compare GPT-4o vs GPT-4o-mini vs GPT-3.5-turbo
- `risk-prompt-test`: Compare detailed vs concise vs structured prompts

---

## 📊 Key Metrics

### Intent Detection
```sql
SELECT * FROM intent_detection_accuracy;
```
- Accuracy rate by goal
- Average confidence
- Total detections

### Agent Performance
```sql
SELECT * FROM agent_performance_summary;
```
- Win rate per agent
- Average cost per agent
- Average quality per agent

### Risk Detection
```sql
SELECT * FROM risk_detection_summary;
```
- Detections by severity
- Acknowledgment rate
- Resolution time

### A/B Testing
```sql
SELECT * FROM ab_test_performance_summary;
```
- Acceptance rate by variant
- Average quality by variant
- Average cost by variant

### Current Winners
```sql
SELECT * FROM ab_test_winners;
```
- Winning variant per test
- T-statistic (significance)
- Determined date

---

## 🔧 API Usage

### Goal-Oriented Reasoner
```typescript
import { getGoalOrientedReasoner } from './agents/goal-oriented-reasoner';

const reasoner = getGoalOrientedReasoner();

const intent = await reasoner.detectIntent({
  userQuery: "assess risks before renewal",
  contractType: "service_agreement",
  userRole: "legal",
  previousActions: [],
  contractMetadata: { hasRenewalDate: true }
});

const plan = reasoner.generateGoalPlan(intent, allArtifactTypes);
```

### Multi-Agent Coordinator
```typescript
import { getMultiAgentCoordinator } from './agents/multi-agent-coordinator';

const coordinator = getMultiAgentCoordinator();

const negotiation = await coordinator.analyzeContract(
  contractId,
  contractType,
  artifactTypes,
  contractText
);

const executionPlan = await coordinator.createExecutionPlan(negotiation);
```

### Proactive Risk Detector
```typescript
import { getProactiveRiskDetector } from './agents/proactive-risk-detector';

const detector = getProactiveRiskDetector();

const riskAnalysis = await detector.analyzeContract(
  contractId,
  tenantId,
  contractType,
  contractText,
  artifactsMap
);
```

### User Feedback Learner
```typescript
import { getUserFeedbackLearner, FeedbackType } from './agents/user-feedback-learner';

const learner = getUserFeedbackLearner();

await learner.processFeedback({
  feedbackType: FeedbackType.ARTIFACT_EDIT,
  artifactType: "FINANCIAL",
  originalData: { ... },
  editedData: { ... },
  timestamp: new Date(),
  userId,
  tenantId
});
```

### A/B Testing Engine
```typescript
import { getABTestingEngine } from './agents/ab-testing-engine';

const abTesting = getABTestingEngine();

// Select variant
const variant = await abTesting.selectVariant(artifactType);

// Record result
await abTesting.recordResult(testName, result, tenantId);

// Get winner
const winner = await abTesting.getCurrentWinner(testName);
```

---

## 🐛 Troubleshooting

### Intent Detection Not Working
```typescript
// Check logs
logger.info('🎯 User intent detected');

// Verify signals
const intent = await reasoner.detectIntent({...});
console.log("Primary goal:", intent.primaryGoal);
console.log("Confidence:", intent.confidence);
console.log("Signals:", intent.signals);
```

### Multi-Agent Conflicts
```typescript
// Check negotiation results
const negotiation = await coordinator.analyzeContract(...);
console.log("Conflicts:", negotiation.conflicts);
console.log("Consensus:", negotiation.consensusReached);
```

### Risk Detection False Positives
```typescript
// Adjust thresholds in code
// proactive-risk-detector.ts lines ~101-180
// Lower severity levels if too sensitive
```

### Learning Not Adjusting
```typescript
// Check sample size
const feedback = await learner.getRecentFeedback(tenantId, artifactType, 30);
console.log("Sample size:", feedback.length);
// Need at least 5 samples
```

### A/B Test Not Converging
```typescript
// Check variant performance
const performances = await abTesting.getVariantPerformances(testName);
console.log("Total tests per variant:", performances.map(p => p.totalTests));
// Need at least 20 per variant
```

---

## 📈 Performance Tuning

### Speed vs Quality Tradeoff
```env
# Fast mode (lower quality thresholds)
QUALITY_THRESHOLD_OVERALL=0.6
QUALITY_THRESHOLD_ACCURACY=0.6

# High quality mode (higher thresholds)
QUALITY_THRESHOLD_OVERALL=0.8
QUALITY_THRESHOLD_ACCURACY=0.8
```

### Cost Optimization
```env
# Use cheaper models by default
DEFAULT_MODEL=gpt-4o-mini

# Enable A/B testing to find best cost/quality
ENABLE_AB_TESTING=true
AB_EXPLORATION_RATE=0.3  # More exploration
```

### Risk Sensitivity
```env
# Strict risk detection
RISK_CRITICAL_THRESHOLD=30
RISK_HIGH_THRESHOLD=15

# Relaxed risk detection
RISK_CRITICAL_THRESHOLD=50
RISK_HIGH_THRESHOLD=25
```

---

## 🎯 Common Scenarios

### Scenario 1: Quick Contract Review
**Goal:** QUICK_REVIEW  
**Artifacts:** Top 3 only (OVERVIEW, RISK, COMPLIANCE)  
**Speed:** Fast (lower thresholds)  
**Cost:** Low (GPT-3.5-turbo)

### Scenario 2: Pre-Negotiation Analysis
**Goal:** NEGOTIATE  
**Artifacts:** NEGOTIATION_POINTS, FINANCIAL, PRICING_ANALYSIS  
**Speed:** Medium  
**Cost:** Medium (GPT-4o-mini)

### Scenario 3: Compliance Audit
**Goal:** COMPLIANCE_CHECK  
**Artifacts:** COMPLIANCE, CLAUSES, OBLIGATIONS  
**Speed:** Slow (high thresholds)  
**Cost:** High (GPT-4o)

### Scenario 4: Renewal Preparation
**Goal:** RENEWAL_PREP  
**Artifacts:** RENEWAL, RISK, FINANCIAL  
**Speed:** Medium  
**Cost:** Medium

---

## 📚 Documentation Links

- **Full Guide:** `/NEXT_LEVEL_AGENTIC_ENHANCEMENTS.md`
- **Implementation Summary:** `/AGENTIC_IMPLEMENTATION_SUMMARY.md`
- **Self-Healing:** `/AGENTIC_ENHANCEMENTS.md`
- **Database Schema:** `/scripts/migrations/agentic-enhancements.sql`

---

## ✅ Deployment Checklist

- [ ] Run database migration
- [ ] Set environment variables
- [ ] Test intent detection
- [ ] Test multi-agent negotiation
- [ ] Test risk detection
- [ ] Verify learning system
- [ ] Enable A/B testing
- [ ] Monitor logs
- [ ] Check metrics dashboard
- [ ] Tune thresholds per tenant

---

## 🆘 Support

**Issue:** System not detecting intent  
**Fix:** Check `ENABLE_INTENT_DETECTION=true` and verify user query has keywords

**Issue:** Agents not negotiating  
**Fix:** Check `ENABLE_MULTI_AGENT=true` and verify contract type is set

**Issue:** No risks detected  
**Fix:** Check `ENABLE_PROACTIVE_RISK=true` and verify artifacts are generated

**Issue:** Learning not improving  
**Fix:** Check `ENABLE_FEEDBACK_LEARNING=true` and verify feedback is being logged

**Issue:** A/B tests not running  
**Fix:** Check `ENABLE_AB_TESTING=true` and verify test configs exist

---

## 🎉 Success Indicators

✅ Logs show `🎯 User intent detected` on every contract  
✅ Logs show `🤝 Multi-agent negotiation completed` with execution plan  
✅ Logs show `🚨 Proactive risk analysis completed` with risk score  
✅ Database has rows in `intent_detection_log`  
✅ Database has rows in `agent_performance_log`  
✅ Database has rows in `risk_detection_log`  
✅ Quality thresholds are adjusting based on feedback  
✅ A/B test winners are being determined  
✅ Processing time is 40% lower  
✅ Quality scores are 50% higher

---

**System Status:** ✅ **READY FOR DEPLOYMENT**
