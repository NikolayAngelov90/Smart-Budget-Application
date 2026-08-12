# ADR-023: Anomaly Detection Algorithm for Story 12.2

**Date**: 2026-04-14  
**Status**: Proposed  
**Epic**: 12 — AI Financial Intelligence  
**Story**: 12.2 — Spending Anomaly & Trend Detection  
**Deciders**: Dev, PM, Architect

---

## Context

Story 12.2 requires detecting unusual spending patterns in a user's transaction history and surfacing them as actionable insights. The core engineering decision is **which detection algorithm to use** given our constraints:

- Users have variable transaction volumes (some have 20/month, some 500/month)
- We need near-real-time detection (triggered after transaction save, or on dashboard load)
- We already have an insight generation pipeline (`insightService.ts`) and scheduling (`cron`)
- No dedicated ML infrastructure exists — compute runs in Next.js API routes (serverless, ~10s timeout)
- The existing rule-based insight engine (Epic 6) cannot be easily extended for anomaly detection because it is threshold-based, not distribution-aware

---

## Decision Drivers

1. **Accuracy**: Must produce meaningful signals with sparse data (< 3 months of history)
2. **Cost**: No per-inference API costs for users on the free tier
3. **Latency**: Must complete within the serverless timeout window (~10s)
4. **Explainability**: User must understand *why* something is flagged as anomalous
5. **Maintenance**: Dev team has no ML/data science background

---

## Options Considered

### Option A: Statistical Z-score / IQR per category

Compute mean and standard deviation (or IQR for robustness) for each spending category over a rolling window. Flag transactions where the spend deviates beyond a threshold (e.g., > 2σ or > 1.5× IQR).

**Pros**:
- Zero external dependencies
- Fast (pure arithmetic, runs in < 100ms)
- Explainable: "Your dining spend this week is 2.4× your monthly average"
- Works with sparse data (IQR needs only 5+ data points)

**Cons**:
- Category-level only — misses cross-category budget overrun patterns
- Static threshold may over-flag volatile categories (e.g., irregular subscriptions)
- Requires tuning per category type

### Option B: LLM-based analysis (Claude API)

Send a structured summary of recent transactions to Claude and ask it to identify anomalies and explain them in natural language.

**Pros**:
- Rich, human-readable explanations
- Can detect cross-category correlations and behavioral patterns
- No algorithm maintenance

**Cons**:
- Per-request cost — not viable on free tier without strict rate limiting
- Non-deterministic: same data may produce different flags, making tests fragile
- Latency: 2–5s per call adds up when scanning full transaction history
- Privacy consideration: transaction data leaves our infrastructure

### Option C: Hybrid — statistical detection + LLM explanation

Run statistical detection (Option A) to identify candidate anomalies cheaply, then pass only the flagged candidates to Claude to generate a user-facing explanation.

**Pros**:
- Combines accuracy of statistics with quality of LLM explanations
- LLM only called when anomaly is detected — reduces cost and latency to near-zero for normal weeks
- Deterministic detection step makes unit testing straightforward

**Cons**:
- Two-step complexity
- LLM still called on free tier users (mitigation: cap at 3 anomaly explanations/week)

---

## Decision

**Chosen: Option C — Hybrid statistical + LLM explanation**, with the following constraints:

1. **Detection layer** (serverless, runs on each dashboard load or post-transaction hook):
   - IQR-based per category, rolling 90-day window
   - Flag if current period spend > median + 1.5× IQR for that category
   - Minimum 5 data points required; categories with < 5 months of data use a simpler "2× last month" heuristic

2. **Explanation layer** (Claude API, `claude-haiku-4-5` for speed/cost):
   - Only invoked when ≥ 1 anomaly is detected
   - Input: category name, historical average, current spend, flagged transactions (dates + amounts, no merchant names)
   - Output: 1–2 sentence plain-English explanation stored as insight record
   - Rate limit: max 3 LLM explanation calls per user per week (enforced in `rateLimitService.ts`)

3. **Fallback**: If Claude API is unavailable or rate limit exceeded, surface the statistical finding with a template explanation: "Your {category} spending this week ({amount}) is significantly above your {N}-month average ({avg})."

---

## Implementation Notes

- Add `detectAnomalies(userId, windowDays = 90)` to `insightService.ts`
- Use `toLocalISODate()` from `src/lib/utils/date.ts` for all date boundaries
- New insight type: `'anomaly'` (extends existing `InsightType` union)
- Store detection metadata in insight `metadata` JSON: `{ zScore, median, iqr, category }`
- Test the detection layer with deterministic data fixtures — do **not** mock statistics, test actual computations
- Test the LLM layer by mocking the Claude API at the boundary (`src/lib/services/claudeService.ts` if it exists, or at `fetch`)

---

## Consequences

- **Positive**: Cheap for most users (no anomalies = no LLM cost), high explainability, testable detection logic
- **Negative**: Hybrid adds code complexity; IQR approach will miss gradual drift (spending creeping up 10%/month never triggers)
- **Risk**: Category taxonomy differences between users may make cross-user calibration impossible — each user's thresholds must be computed independently

---

## Review

This ADR should be revisited if:
- User opt-out rates for anomaly notifications exceed 30% (signal: too noisy)
- Claude API costs exceed $0.01/active-user/month (signal: LLM called too frequently)
- A data science resource joins the team (opportunity to replace IQR with proper time-series model)
