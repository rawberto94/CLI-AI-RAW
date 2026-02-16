# Agentic Enhancements - Self-Healing & Quality Validation System

## 🎯 Overview

Implemented a comprehensive **autonomous quality validation and self-healing system** that makes the contract processing agent significantly more intelligent and reliable.

## ✨ Key Features Implemented

### 1. **Artifact Quality Validator** (`artifact-quality-validator.ts`)

Validates generated artifacts across multiple dimensions:

- **Completeness** (0.6 threshold): Checks if required fields are present
- **Accuracy** (0.7 threshold): Anti-hallucination detection
  - Verifies `extractedFromText` flags are properly set
  - Detects placeholder values (e.g., "Client Name", "[Company]")
  - Ensures sources are cited for extracted data
  - Flags inferred data for human review
  
- **Consistency** (0.65 threshold): Data format validation
  - ISO date format validation (YYYY-MM-DD)
  - Non-negative amounts
  - Non-empty required arrays
  
- **Confidence** (0.6 threshold): Extracted from artifact certainty scores
- **Overall Score** (0.7 threshold): Weighted average of all dimensions

**Self-Critique Mechanism:**

- AI reviews its own output using GPT-4o-mini
- Identifies hallucinations by cross-referencing contract text
- Suggests specific improvements
- Recommends regeneration when quality is too low

### 2. **Adaptive Retry Strategy** (`adaptive-retry-strategy.ts`)

Smart retry logic with model fallback:

**Model Hierarchy:**

1. GPT-4o (highest capability, highest cost)
2. GPT-4o-mini (balanced)
3. GPT-3.5-turbo (fallback, lowest cost)

**Failure Classification:**

- `RATE_LIMIT`: Exponential backoff with 2x delay multiplier
- `CONTEXT_LENGTH`: Automatic fallback to next model or text chunking
- `TIMEOUT`: Retry same model (network issue)
- `INVALID_RESPONSE`: Retry, fallback after 2 attempts
- `AUTHENTICATION`: Immediate fallback (API key issue)
- `NETWORK`: Retry with jitter to avoid thundering herd

**Adaptive Behavior:**

- Exponential backoff: 1s → 2s → 4s → 8s (max 30s)
- Jitter factor: ±30% to distribute load
- Smart model switching based on error type
- Text chunking when context window exceeded

### 3. **Auto-Regeneration Logic**

When quality validation fails:

1. **First attempt**: Generate with primary model (GPT-4o-mini)
2. **Quality check**: Validate against thresholds
3. **Self-critique**: AI reviews own output
4. **Decision**:
   - If quality good → Store artifact
   - If quality low → Regenerate (max 2 times)
   - If max regenerations → Store with warning flag

**Stored Metadata:**

```json
{
  "qualityScore": 0.85,
  "completeness": 0.9,
  "accuracy": 0.87,
  "consistency": 0.92,
  "confidence": 0.85,
  "regenerationAttempts": 1,
  "qualityIssues": ["Missing source for party names"],
  "qualityRecommendations": ["Review for hallucinations"],
  "modelUsed": "gpt-4o-mini"
}
```

## 📊 Benefits

### **Reliability Improvements:**

- ✅ Automatic recovery from transient failures
- ✅ Graceful degradation with model fallback
- ✅ Context-aware retry strategies
- ✅ Reduced false positives (hallucinations)

### **Quality Improvements:**

- ✅ Consistent data formatting
- ✅ Source attribution for all extracted data
- ✅ Flagged inferred vs. extracted information
- ✅ Human review triggers for low confidence

### **Cost Optimization:**

- ✅ Use cheaper models first (GPT-4o-mini)
- ✅ Only escalate to expensive models when needed
- ✅ Avoid unnecessary regenerations with smart thresholds

### **Observability:**

- ✅ Detailed quality scores for each artifact
- ✅ Regeneration tracking
- ✅ Model usage analytics
- ✅ Failure reason classification

## 🔄 Workflow Example

```
1. User uploads contract
2. Agent orchestrator triggers artifact generation
3. For each artifact:
   
   ATTEMPT 1:
   - Generate with GPT-4o-mini
   - Validate quality → Score: 0.65 (FAIL)
   - Self-critique → Issues: ["Missing sources", "Placeholder names"]
   - Decision: REGENERATE
   
   ATTEMPT 2:
   - Regenerate with improved prompt
   - Validate quality → Score: 0.82 (PASS)
   - Decision: STORE
   
4. Artifact saved with metadata:
   - validationStatus: "valid"
   - qualityScore: 0.82
   - regenerationAttempts: 1
   - modelUsed: "gpt-4o-mini"
```

## 🎓 Learning & Adaptation

The system learns from:

- **Quality scores**: Track which artifact types need regeneration
- **Model performance**: Which models work best for each type
- **Failure patterns**: Common error types and their solutions
- **Retry metrics**: Optimal retry strategies per error type

## 🚀 Future Enhancements

Ready to add:

1. **Learning from user feedback**: Adjust thresholds based on user edits
2. **A/B testing**: Compare different prompts/models automatically
3. **Predictive quality**: Estimate quality before generation
4. **Dynamic thresholds**: Adjust based on contract complexity
5. **Cost tracking**: Optimize model selection based on budget
6. **Parallel generation**: Generate with multiple models, pick best

## 📈 Monitoring

Key metrics now tracked:

- Quality scores per artifact type
- Regeneration rates
- Model fallback frequency
- Retry attempt distribution
- Cost per artifact (by model)
- Average quality improvement from regeneration

## ⚙️ Configuration

Environment variables for tuning:

```env
# Quality Thresholds
ARTIFACT_QUALITY_OVERALL=0.7
ARTIFACT_QUALITY_ACCURACY=0.7
ARTIFACT_QUALITY_COMPLETENESS=0.6

# Retry Configuration
ARTIFACT_MAX_REGENERATIONS=2
ADAPTIVE_RETRY_MAX_ATTEMPTS=3
ADAPTIVE_RETRY_MAX_DELAY_MS=30000

# Model Preferences
PRIMARY_MODEL=gpt-4o-mini
FALLBACK_MODEL=gpt-3.5-turbo
ENABLE_SELF_CRITIQUE=true
```

## 🎯 Impact Summary

**Before:**

- Fixed retry count (3 attempts with same model)
- No quality validation
- No self-awareness of output quality
- Hallucinations went undetected
- All-or-nothing artifact generation

**After:**

- ✅ Adaptive retry with model fallback
- ✅ Multi-dimensional quality validation
- ✅ Self-critique and auto-regeneration
- ✅ Hallucination detection & flagging
- ✅ Graceful degradation with quality metadata
- ✅ Cost-optimized model selection
- ✅ Observable quality metrics

---

**The system is now truly agentic**: It validates its own work, learns from failures, adapts strategies, and autonomously improves output quality! 🤖✨
