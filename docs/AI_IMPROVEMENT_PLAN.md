# AI Chatbot Deep Audit — Improvement Plan

> Generated from comprehensive audit of the ConTigo AI chatbot system.  
> **Codebase Status:** 0 TypeScript errors across all packages.

---

## Executive Summary

The ConTigo AI chatbot is a well-architected system with 28 streaming tools, parallel RAG, semantic caching, episodic memory, input/output guardrails, model failover, token budgeting, and self-critique. This audit identified **8 P0/P1 issues** to fix immediately and **10 P2/P3 enhancements** for future iterations.

---

## P0 — CRITICAL (Security & Reliability)

### 1. Greedy JSON Regex in ReAct Agent
**File:** `packages/agents/src/react-agent.ts` ~line 628  
**Bug:** `content.match(/\{[\s\S]*\}/)` uses a greedy quantifier that matches from the *first* `{` to the *last* `}` in the entire LLM response. If the model outputs `{"thought": "..."} some text {"action": ...}`, it captures everything including "some text" — producing invalid JSON.  
**Fix:** Use balanced-brace extraction or non-greedy with validation.  
**Impact:** Agent tool execution silently fails on multi-object responses.

### 2. System Prompt — No Role Sanitization
**File:** `apps/web/lib/ai/chat-stream/system-prompt.ts` line 72  
**Bug:** `userRole` is interpolated directly into the system prompt (`Current user role: ${userRole}`). If a compromised token or API caller sends a crafted role string, it could inject instructions into the system prompt.  
**Fix:** Allowlist valid roles before interpolation.  
**Impact:** Prompt injection vector via role field.

---

## P1 — HIGH (Quality & Correctness)

### 3. Memory Decay Never Triggered
**File:** `apps/web/lib/ai/episodic-memory-integration.ts` line 251  
**Bug:** `applyMemoryDecay()` is fully implemented but **never called** anywhere in the codebase. Memories accumulate indefinitely with no importance decay, degrading retrieval relevance over time.  
**Fix:** Add a scheduled call (cron job or BullMQ recurring task) that runs decay daily.

### 4. `consolidateMemories()` Is a Stub
**File:** `apps/web/lib/ai/episodic-memory-integration.ts` line 285  
**Bug:** Returns `0` with a "TODO" comment. Similar memories are never merged, leading to duplicate context in prompts.  
**Fix:** Implement embedding-based similarity grouping and merge.

### 5. Hardcoded Anthropic Model IDs
**File:** `apps/web/lib/ai/chat-stream/model-routing.ts` lines 52-53  
**Bug:** Anthropic models are hardcoded (`claude-3-5-haiku-20241022`, `claude-sonnet-4-20250514`). Updating requires a code deploy.  
**Fix:** Add `ANTHROPIC_MODEL_FAST` / `ANTHROPIC_MODEL_SMART` env vars with current values as defaults.

### 6. RRF Scores Not Normalized
**File:** `apps/web/lib/rag/parallel-rag.service.ts` lines 486-554  
**Bug:** RRF scores are summed across queries without normalization. With 4+ query variations, scores can exceed 1.0 (e.g., 0.016 + 0.016 + 0.016 + 0.016 = 0.064 per chunk per query). Downstream confidence calibration expects 0–1 range scores.  
**Fix:** Normalize by dividing by number of query sources.

### 7. Self-Critique Uses Word-Level Grounding (Not Semantic)
**File:** `apps/web/app/api/ai/chat/stream/route.ts` lines 735-765  
**Bug:** Grounding check splits response into words and checks `ragTexts.includes(word)`. This fails for paraphrasing ("contractual obligations" won't match "duties under the agreement") and produces false negatives.  
**Fix:** Use embedding similarity between response sentences and RAG chunks.

### 8. Reranker LLM Score Parsing Is Fragile
**File:** `apps/web/lib/rag/reranker.service.ts` line 198  
**Bug:** `line.match(/(\d+\.?\d*)/)` extracts the first number from LLM output. If the model outputs "Document 3: 0.8" the regex captures "3" not "0.8".  
**Fix:** Use structured output format or match the last number on each line.

---

## P2 — MEDIUM (UX & Performance)

### 9. Semantic Cache Threshold May Be Too Strict (RAG Cache)
**File:** `apps/web/lib/rag/semantic-cache.service.ts` line 60  
The RAG semantic cache uses 0.95 threshold — paraphrased queries miss the cache. The AI chat cache at 0.92 is better. Consider aligning both to 0.92.

### 10. System Prompt Has No Token Budget Cap
**File:** `apps/web/lib/ai/chat-stream/system-prompt.ts`  
The system prompt grows unboundedly with contract profile, RAG context, memory, and learning patterns. While `allocateBudget()` truncates downstream, the prompt itself has no size awareness.

### 11. No Typing Indicator During Tool Execution
The frontend shows tool_start/tool_done events but no visual "thinking" indicator between tool completion and next content stream.

### 12. RAG Source Attribution Not Shown to User
Tool results and RAG sources are used internally but never displayed as citations in the chat UI.

### 13. Token Counting Uses `countTokens()` — Verify Accuracy
The `countTokens` import is used consistently, but the ReAct agent uses `char_count / 4` approximation instead. Should unify.

### 14. Redis Cache Invalidation Is O(N) Scan
**File:** `apps/web/lib/rag/semantic-cache.service.ts`  
Cache invalidation scans all Redis keys matching a pattern. At scale (>100K cached queries), this causes latency spikes.

---

## P3 — NICE-TO-HAVE

### 15. Voice Input Dead Code
FloatingAIBubble has a microphone button with no functional handler.

### 16. Copy Buttons for Code/Table Blocks
Chat responses with markdown tables or code blocks have no copy-to-clipboard affordance.

### 17. Complexity Detection Keywords Not Configurable
`detectQueryComplexity()` uses hardcoded keyword lists. Should be configurable or ML-based.

### 18. Tool Composition Stubs
`tool-registry.ts` has composition patterns that are never invoked.

---

## Implementation Status

| # | Priority | Issue | Status |
|---|----------|-------|--------|
| 1 | P0 | Greedy JSON regex → balanced-brace extraction | ✅ Done |
| 2 | P0 | Role sanitization → allowlist in system prompt | ✅ Done |
| 3 | P1 | Memory decay → 24h setInterval in workers | ✅ Done |
| 4 | P1 | consolidateMemories → pgvector cosine similarity | ✅ Done |
| 5 | P1 | Anthropic model env vars → ANTHROPIC_MODEL_FAST/SMART | ✅ Done |
| 6 | P1 | RRF normalization → max-score normalization | ✅ Done |
| 7 | P1 | Self-critique → n-gram (bigram+trigram) grounding | ✅ Done |
| 8 | P1 | Reranker score parsing → colon-anchored regex | ✅ Done |
| 9 | P2 | Cache threshold alignment (0.92) | ✅ Done |
| 10| P2 | System prompt token cap (truncateSection helper) | ✅ Done |
| 11| P2 | Typing indicator ("Synthesizing response…") | ✅ Done |
| 12| P2 | RAG source attribution → streaming metadata pipeline | ✅ Done |
| 13| P2 | Token counting unification (react-agent) | ✅ Done |
| 14| P2 | Redis O(N) invalidation → ZSCAN batching | ✅ Done |
| 15| P3 | Voice input — verified functional (Web Speech API) | ✅ N/A |
| 16| P3 | Copy buttons for code blocks & tables | ✅ Done |
| 17| P3 | Complexity config → COMPLEXITY_KEYWORDS_COMPLEX env var | ✅ Done |
| 18| P3 | Tool composition → registered 2 composed tools | ✅ Done |
